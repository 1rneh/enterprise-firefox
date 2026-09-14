//! Test double for the DLP wasm module, standing in for the real
//! content-analysis-wasm policy engine in Firefox's own tests.
//!
//! It implements the same ABI the real module does (see
//! content-analysis-wasm-sandbox.js) but performs no matching: the rules handed
//! to `ca_analyze` are ignored entirely. Instead the test states, in the content
//! it submits, which rules should fire and with what action:
//!
//! ```text
//! "warn-ai-paste=warn;block-confidential-content=block"
//! ```
//!
//! Each `name=action` pair becomes one `TriggeredRule` in the response, in the
//! order given. Empty content triggers nothing, which Firefox reads as allow.
//! `action` is one of `report`, `warn`, or `block`.
//!
//! This keeps verdicts under the test's direct control, so tests don't have to
//! encode the real engine's domain and content-pattern matching to provoke a
//! particular outcome. Matching itself is covered by the real module's own
//! tests, not here.

mod proto {
    // Generated from analysis.proto; most of the SDK's messages go unused here.
    #![allow(dead_code)]
    include!(concat!(env!("OUT_DIR"), "/content_analysis.sdk.rs"));
}

use prost::Message;
use proto::content_analysis_response::Result as CaResult;
use proto::content_analysis_response::result::triggered_rule::Action;
use proto::content_analysis_response::result::{Status, TriggeredRule};
use proto::{ContentAnalysisRequest, ContentAnalysisResponse};

/// Must match ABI_VERSION in content-analysis-wasm-sandbox.js.
pub const ABI_VERSION: u32 = 1;

/// The tag Firefox sends on its requests, echoed on the result.
const DLP_TAG: &str = "dlp";

#[unsafe(no_mangle)]
pub extern "C" fn ca_abi_version() -> u32 {
    ABI_VERSION
}

/// Allocate a `len`-byte buffer for the host to write into. Freed with
/// `ca_free()`.
#[unsafe(no_mangle)]
pub extern "C" fn ca_alloc(len: usize) -> *mut u8 {
    let buffer = vec![0u8; len].into_boxed_slice();
    Box::into_raw(buffer) as *mut u8
}

/// Free a buffer from `ca_alloc()` or `ca_analyze()`.
///
/// # Safety
///
/// `ptr` must come from `ca_alloc()`/`ca_analyze()` with the matching `len`,
/// and must not have been freed already.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ca_free(ptr: *mut u8, len: usize) {
    if ptr.is_null() || len == 0 {
        return;
    }
    let _ = unsafe { Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)) };
}

/// Parse the `name=action;...` spec into triggered rules.
fn parse_spec(spec: &str) -> Result<Vec<TriggeredRule>, ()> {
    spec.split(';')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| {
            let (name, action) = entry.split_once('=').ok_or(())?;
            let name = name.trim();
            if name.is_empty() {
                return Err(());
            }
            let action = match action.trim().to_ascii_lowercase().as_str() {
                "report" => Action::ReportOnly,
                "warn" => Action::Warn,
                "block" => Action::Block,
                _ => return Err(()),
            };
            Ok(TriggeredRule {
                action: Some(action as i32),
                rule_name: Some(name.to_owned()),
                rule_id: None,
            })
        })
        .collect()
}

/// A response reporting that the module could not act on the request, as the
/// real module does for input it can't decode.
fn failure_response(request_token: Option<String>) -> ContentAnalysisResponse {
    ContentAnalysisResponse {
        request_token,
        results: vec![CaResult {
            tag: Some(DLP_TAG.to_owned()),
            status: Some(Status::Failure as i32),
            triggered_rules: Vec::new(),
        }],
    }
}

/// Analyze a request by reading the test's spec out of it.
///
/// The spec is taken from `content_ptr` when the host supplied content bytes
/// (file uploads and printing), and otherwise from the request's inline
/// `text_content` (clipboard paste and drag-and-drop, where WasmModuleBackend
/// passes no content bytes at all).
///
/// # Safety
///
/// `req_ptr` must point to `req_len` readable bytes (or be null with
/// `req_len == 0`), `content_ptr` likewise for `content_len`, and `out_len`
/// must point to a writable `usize`. `rules_ptr`/`rules_count` are ignored.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn ca_analyze(
    req_ptr: *const u8,
    req_len: usize,
    content_ptr: *const u8,
    content_len: usize,
    _rules_ptr: *const core::ffi::c_void,
    _rules_count: usize,
    out_len: *mut usize,
) -> *mut u8 {
    let request_bytes: &[u8] = if req_ptr.is_null() || req_len == 0 {
        &[]
    } else {
        unsafe { std::slice::from_raw_parts(req_ptr, req_len) }
    };
    let content_bytes: &[u8] = if content_ptr.is_null() || content_len == 0 {
        &[]
    } else {
        unsafe { std::slice::from_raw_parts(content_ptr, content_len) }
    };

    let response = match ContentAnalysisRequest::decode(request_bytes) {
        Ok(request) => {
            let spec = if content_bytes.is_empty() {
                match request.content_data {
                    Some(proto::content_analysis_request::ContentData::TextContent(ref text)) => {
                        text.clone()
                    }
                    _ => String::new(),
                }
            } else {
                String::from_utf8_lossy(content_bytes).into_owned()
            };

            match parse_spec(&spec) {
                Ok(triggered_rules) => ContentAnalysisResponse {
                    request_token: request.request_token.clone(),
                    results: vec![CaResult {
                        tag: Some(DLP_TAG.to_owned()),
                        status: Some(Status::Success as i32),
                        triggered_rules,
                    }],
                },
                Err(()) => failure_response(request.request_token.clone()),
            }
        }
        Err(_) => failure_response(None),
    };

    let encoded = response.encode_to_vec().into_boxed_slice();
    let len = encoded.len();
    unsafe { *out_len = len };
    Box::into_raw(encoded) as *mut u8
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_pairs_in_order() {
        let rules = parse_spec("warn-ai-paste=warn;block-confidential-content=block").unwrap();
        assert_eq!(rules.len(), 2);
        assert_eq!(rules[0].rule_name.as_deref(), Some("warn-ai-paste"));
        assert_eq!(rules[0].action, Some(Action::Warn as i32));
        assert_eq!(
            rules[1].rule_name.as_deref(),
            Some("block-confidential-content")
        );
        assert_eq!(rules[1].action, Some(Action::Block as i32));
    }

    #[test]
    fn empty_spec_triggers_nothing() {
        assert!(parse_spec("").unwrap().is_empty());
    }

    #[test]
    fn rejects_malformed_entries() {
        // No `=`, no name, and an action that isn't one of the three.
        for spec in ["no-action", "=block", "bad=nonsense"] {
            assert!(parse_spec(spec).is_err(), "should reject {spec:?}");
        }
    }

    #[test]
    fn one_malformed_entry_rejects_the_whole_spec() {
        assert!(parse_spec("good=block;bad=nonsense").is_err());
    }

    #[test]
    fn accepts_all_actions() {
        let rules = parse_spec("a=report;b=WARN;c=Block").unwrap();
        let actions: Vec<_> = rules.iter().map(|r| r.action.unwrap()).collect();
        assert_eq!(
            actions,
            vec![
                Action::ReportOnly as i32,
                Action::Warn as i32,
                Action::Block as i32
            ]
        );
    }
}
