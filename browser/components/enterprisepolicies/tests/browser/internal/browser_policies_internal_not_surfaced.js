/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Only enterprise builds support internal polcicies

const { INTERNAL_POLICIES } = ChromeUtils.importESModule(
  "resource://gre/modules/InternalPolicies.sys.mjs"
);

const INTERNAL_POLICY_NAMES = Object.keys(INTERNAL_POLICIES);

add_setup(async function () {
  Services.prefs.setBoolPref("browser.policies.testEnableInternal", true);
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("browser.policies.testEnableInternal");
  });
});

add_task(async function test_internal_policies_hidden_from_about_policies() {
  await setupPolicyEngineWithJson({ policies: {} });

  // The internal policies are applied ...
  let active = Services.policies.getActivePolicies();
  for (let name of INTERNAL_POLICY_NAMES) {
    ok(name in active, `Internal policy ${name} is applied`);
  }

  // ... but they are absent from about:policies
  await BrowserTestUtils.withNewTab("about:policies", async browser => {
    await SpecialPowers.spawn(
      browser,
      [INTERNAL_POLICY_NAMES],
      internalNames => {
        let activeSection = content.document.getElementById("activeContent");
        Assert.ok(activeSection, "The active policies section exists");
        let text = activeSection.textContent;

        for (let name of internalNames) {
          Assert.ok(
            !text.includes(name),
            `Internal policy ${name} is not surfaced in about:policies`
          );
        }
      }
    );
  });
});
