/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//! Best-effort Felt bearer token for authenticating enterprise crash uploads.
//!
//! In Firefox Enterprise, crash reports and crash pings are uploaded to the
//! admin console, which requires the same bearer token used for other console
//! communication. The crashing Firefox process exports its current access token
//! into its environment as `MOZ_CRASHREPORTER_AUTH_TOKEN`; the crash reporter
//! client (and the `crashreporterNetworkBackend` background task it may spawn)
//! inherit that environment and attach it as an `Authorization` header.
//!
//! This is best-effort: only the access token that was valid at crash time is
//! available (the refresh token never leaves the Felt UI process), so there is
//! no way to refresh it here. If the token is missing or the server rejects it,
//! the upload is sent unauthenticated (and a pending report is retried later by
//! an authenticated in-process session).

/// Return an `Authorization: Bearer` header for an upload to `url`, built from
/// the access token that the crashing process exported into the environment.
///
/// Returns `None` if no token is present (non-enterprise builds, or a crash
/// before sign-in), or if `url` is not on the enterprise console.
pub fn enterprise_authorization_header(url: &str) -> Option<(String, String)> {
    let token = crate::std::env::var(ekey!("AUTH_TOKEN")).ok()?;
    if token.is_empty() {
        return None;
    }
    if !crate::enterprise_prefs::is_console_url(url) {
        log::warn!("not authenticating the upload: {url} is not the enterprise console");
        return None;
    }
    Some(("Authorization".to_owned(), format!("Bearer {token}")))
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::std::{
        env::{MockCurrentExe, MockEnv},
        fs::{MockFS, MockFiles},
        mock,
    };

    const CONSOLE_URL: &str = "https://console.example.com/api/browser/crash-reports/submit";

    fn run_with_env(value: Option<&str>, url: &str) -> Option<(String, String)> {
        let files = MockFiles::new();
        files.add_dir("work_dir").add_file(
            "work_dir/firefox.cfg",
            crate::test::enterprise_autoconfig("https://console.example.com"),
        );

        let mut builder = mock::builder();
        builder
            .set(MockFS, files)
            .set(MockCurrentExe, "work_dir/crashreporter".into());
        if let Some(value) = value {
            builder.set(MockEnv(ekey!("AUTH_TOKEN").into()), value.to_owned());
        }
        builder.run(|| enterprise_authorization_header(url))
    }

    #[test]
    fn token_present_yields_header() {
        let header = run_with_env(Some("abc"), CONSOLE_URL).expect("expected a header");
        assert_eq!(header.0, "Authorization");
        assert_eq!(header.1, "Bearer abc");
    }

    #[test]
    fn empty_token_yields_none() {
        assert!(run_with_env(Some(""), CONSOLE_URL).is_none());
    }

    #[test]
    fn missing_token_yields_none() {
        assert!(run_with_env(None, CONSOLE_URL).is_none());
    }

    #[test]
    fn non_console_url_yields_none() {
        assert!(run_with_env(Some("abc"), "https://evil.example.com/submit").is_none());
    }
}
