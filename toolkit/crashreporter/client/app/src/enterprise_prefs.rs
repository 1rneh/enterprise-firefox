/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//! Enterprise console preferences and endpoint URLs.
//!
//! Concentrates the enterprise console address resolution and the hard-coded
//! console endpoint paths used for crash report submission and Glean telemetry.
//!
//! The console address normally comes from the `ServerURL` crash annotation
//! (recorded by the browser once AutoConfig has run). A crash before then has
//! no usable annotation, so we recover the address by reading the AutoConfig
//! (`.cfg`) file ourselves.

use crate::config::installation_resource_path;
use crate::prefs_parser::find_string_pref_call;
use url::Url;

/// The enterprise AutoConfig file name. Enterprise builds point
/// `general.config.filename` at this (set in `firefox-branding.js`); it is not
/// a default value anywhere else.
const ENTERPRISE_AUTOCONFIG_FILENAME: &str = "firefox.cfg";

/// The pref holding the enterprise console address.
const CONSOLE_ADDRESS_PREF: &str = "enterprise.console.address";

/// Path appended to the console address to form the crash submission endpoint.
const CRASH_SUBMIT_PATH: &str = "api/browser/crash-reports/submit";

/// Path appended to the console address to form the Glean telemetry endpoint.
const GLEAN_SUBMIT_PATH: &str = "api/browser/telemetry";

/// Default byte shift applied to AutoConfig files (`general.config.obscure_value`).
const DEFAULT_OBSCURE_VALUE: u8 = 13;

/// Pref-setting functions an AutoConfig file may use to set a string pref.
const PREF_FUNCTIONS: &[&str] = &["lockPref", "defaultPref", "pref"];

/// Resolve the crash report submission URL.
///
/// Prefers `server_url` (the `ServerURL` crash annotation) when it is already
/// an absolute URL, since that is the submission endpoint itself. Otherwise
/// (missing, or a domainless placeholder such as `/submit?...`) constructs the
/// endpoint from the enterprise console address.
pub fn console_report_url(server_url: Option<&str>) -> anyhow::Result<String> {
    if let Some(server_url) = server_url {
        if Url::parse(server_url).is_ok() {
            return Ok(server_url.to_owned());
        }
    }
    Ok(format!("{}/{}", console_base(None)?, CRASH_SUBMIT_PATH))
}

/// Construct the Glean telemetry endpoint from the enterprise console address.
///
/// `server_url` is the `ServerURL` crash annotation, when available.
pub fn console_glean_url(server_url: Option<&str>) -> anyhow::Result<String> {
    let base = console_base(server_url)?;
    let mut url = Url::parse(&base)?;
    url.set_path(&format!(
        "{}/{}",
        url.path().trim_end_matches('/'),
        GLEAN_SUBMIT_PATH
    ));
    Ok(url.to_string())
}

/// Resolve the enterprise console base URL (without a trailing slash).
///
/// Resolution order:
/// 1. `server_url` (the `ServerURL` crash annotation, i.e. the submission
///    endpoint) by stripping the submission path back to the base;
/// 2. the AutoConfig file.
fn console_base(server_url: Option<&str>) -> anyhow::Result<String> {
    if let Some(server_url) = server_url {
        let trimmed = server_url.trim_end_matches('/');
        if let Some(base) = trimmed.strip_suffix(CRASH_SUBMIT_PATH) {
            return Ok(base.trim_end_matches('/').to_owned());
        }
    }
    let base = read_autoconfig_string_pref(CONSOLE_ADDRESS_PREF)?;
    Ok(base.trim_end_matches('/').to_owned())
}

/// Read a string preference from the installation's AutoConfig file.
///
/// AutoConfig files are byte-shifted by `general.config.obscure_value` (13 by
/// default) and have an intentionally unparseable first line. We undo the
/// shift (trying the default value, then plaintext) and scan for the pref.
fn read_autoconfig_string_pref(pref: &str) -> anyhow::Result<String> {
    let path = installation_resource_path().join(ENTERPRISE_AUTOCONFIG_FILENAME);
    let bytes = crate::std::fs::read(&path)?;

    for shift in [DEFAULT_OBSCURE_VALUE, 0] {
        let decoded: Vec<u8> = bytes.iter().map(|b| b.wrapping_sub(shift)).collect();
        let Ok(text) = String::from_utf8(decoded) else {
            continue;
        };
        for func in PREF_FUNCTIONS {
            if let Some(value) = find_string_pref_call(&text, func, pref) {
                return Ok(value.to_owned());
            }
        }
    }
    anyhow::bail!("could not find pref {pref:?} in {}", path.display())
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::std::{fs::MockFS, fs::MockFiles, mock};

    const CFG: &str = "// first line is ignored\n\
         lockPref(\"enterprise.console.address\", \"https://console.example.com/foo/\");";

    /// Byte-shift plaintext into an encoded AutoConfig file.
    fn encode(plaintext: &str) -> Vec<u8> {
        plaintext
            .bytes()
            .map(|b| b.wrapping_add(DEFAULT_OBSCURE_VALUE))
            .collect()
    }

    fn with_autoconfig<R>(body: impl FnOnce() -> R) -> R {
        let mock_files = MockFiles::new();
        mock_files.add_dir("work_dir");
        mock_files.add_file("work_dir/firefox.cfg", encode(CFG));
        mock::builder()
            .set(MockFS, mock_files.clone())
            .set(
                crate::std::env::MockCurrentExe,
                "work_dir/crashreporter".into(),
            )
            .run(body)
    }

    #[test]
    fn console_base_prefers_annotation() {
        // No file access needed: the submission path is stripped to the base.
        assert_eq!(
            console_base(Some(
                "https://console.example.com/foo/api/browser/crash-reports/submit"
            ))
            .unwrap(),
            "https://console.example.com/foo"
        );
    }

    #[test]
    fn console_base_reads_encoded_autoconfig() {
        with_autoconfig(|| {
            assert_eq!(
                console_base(None).unwrap(),
                "https://console.example.com/foo"
            );
        });
    }

    #[test]
    fn console_base_errors_without_source() {
        let mock_files = MockFiles::new();
        mock::builder()
            .set(MockFS, mock_files.clone())
            .set(
                crate::std::env::MockCurrentExe,
                "work_dir/crashreporter".into(),
            )
            .run(|| {
                assert!(console_base(None).is_err());
            });
    }

    #[test]
    fn report_url_uses_valid_annotation() -> anyhow::Result<()> {
        // An absolute annotation is the submission endpoint; return it as-is.
        assert_eq!(
            console_report_url(Some(
                "https://console.example.com/foo/api/browser/crash-reports/submit"
            ))?,
            "https://console.example.com/foo/api/browser/crash-reports/submit"
        );
        anyhow::Ok(())
    }

    #[test]
    fn report_url_constructs_when_annotation_unusable() -> anyhow::Result<()> {
        // A domainless placeholder is ignored; the URL is built from AutoConfig.
        with_autoconfig(|| {
            assert_eq!(
                console_report_url(Some("/submit?id=x"))?,
                "https://console.example.com/foo/api/browser/crash-reports/submit"
            );
            anyhow::Ok(())
        })
    }

    #[test]
    fn glean_url_appends_telemetry_path_from_annotation() -> anyhow::Result<()> {
        // Derived from the ServerURL annotation without touching the filesystem.
        assert_eq!(
            console_glean_url(Some(
                "https://console.example.com/foo/api/browser/crash-reports/submit"
            ))?,
            "https://console.example.com/foo/api/browser/telemetry"
        );
        anyhow::Ok(())
    }
}
