/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// The internal BlockAboutProfiles policy must actually take effect (block
// about:profiles) even though it is never surfaced as an active policy.

const { INTERNAL_POLICIES } = ChromeUtils.importESModule(
  "resource://gre/modules/InternalPolicies.sys.mjs"
);

add_setup(async function () {
  Services.prefs.setBoolPref("browser.policies.testEnableInternal", true);
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("browser.policies.testEnableInternal");
  });
});

add_task(async function test_about_profiles_blocked_by_internal_policy() {
  ok(
    "BlockAboutProfiles" in INTERNAL_POLICIES,
    "BlockAboutProfiles is an internal policy"
  );

  // No administrator policy is set, so only the internal policies apply.
  await setupPolicyEngineWithJson({ policies: {} });

  await BrowserTestUtils.withNewTab(
    { gBrowser, url: "about:blank" },
    async browser => {
      BrowserTestUtils.startLoadingURIString(browser, "about:profiles");
      await BrowserTestUtils.browserLoaded(
        browser,
        false,
        "about:profiles",
        true
      );
      await SpecialPowers.spawn(browser, [], () => {
        ok(
          content.document.documentURI.startsWith(
            "about:neterror?e=blockedByPolicyEnterprise"
          ),
          `about:profiles should be blocked by policy, got ${content.document.documentURI}`
        );
      });
    }
  );
});
