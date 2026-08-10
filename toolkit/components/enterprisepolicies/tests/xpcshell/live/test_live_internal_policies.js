/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { INTERNAL_POLICIES } = ChromeUtils.importESModule(
  "resource://gre/modules/InternalPolicies.sys.mjs"
);

const INTERNAL_POLICY_NAMES = Object.keys(INTERNAL_POLICIES);

add_setup(function () {
  Services.prefs.setBoolPref("browser.policies.testEnableInternal", true);
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("browser.policies.testEnableInternal");
  });
});

add_task(async function test_internal_only_stays_inactive_across_live_update() {
  // Start with a real remote policy so the engine is active alongside the
  // internal policies.
  await EnterprisePolicyTesting.setupEngineWithRemotePolicies({
    policies: { BlockAboutSupport: true },
  });

  Assert.equal(
    Services.policies.status,
    Ci.nsIEnterprisePolicies.ACTIVE,
    "Engine is active with a real remote policy"
  );
  for (let name of INTERNAL_POLICY_NAMES) {
    Assert.ok(
      name in Services.policies.getActivePolicies(),
      `Internal policy ${name} is applied while the engine is active`
    );
  }

  // Live-update to an empty remote set: only the internal policies remain.
  const updateApplied = EnterprisePolicyTesting.awaitNextPolicyUpdate();
  EnterprisePolicyTesting.stubRemotePolicies({ policies: {} });
  await updateApplied;

  Assert.equal(
    Services.policies.status,
    Ci.nsIEnterprisePolicies.INACTIVE,
    "Engine returns to inactive when only internal policies remain after a live update"
  );
  Assert.ok(
    !Services.policies.isEnterprise,
    "isEnterprise is false after the live downgrade to internal-only"
  );
  for (let name of INTERNAL_POLICY_NAMES) {
    Assert.ok(
      name in Services.policies.getActivePolicies(),
      `Internal policy ${name} is still applied after the live update`
    );
  }
});
