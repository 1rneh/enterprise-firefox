/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// This test only runs in enterprise builds (see xpcshell.toml), where the
// InternalPolicies module exists and the internal provider can be enabled.
const { INTERNAL_POLICIES } = ChromeUtils.importESModule(
  "resource://gre/modules/InternalPolicies.sys.mjs"
);

const INTERNAL_POLICY_NAMES = Object.keys(INTERNAL_POLICIES);

add_setup(function () {
  // Enable the internal provider outside of a felt browser.
  Services.prefs.setBoolPref("browser.policies.testEnableInternal", true);
  registerCleanupFunction(() => {
    Services.prefs.clearUserPref("browser.policies.testEnableInternal");
    Services.obs.notifyObservers(null, "EnterprisePolicies:Reset");
  });
});

add_task(async function test_internal_applied_but_engine_stays_inactive() {
  await setupPolicyEngineWithJson({ policies: {} });

  // Internal policies are applied even with no administrator policy set, so
  // they are visible to functional consumers via getActivePolicies()...
  let active = Services.policies.getActivePolicies();
  for (let name of INTERNAL_POLICY_NAMES) {
    ok(
      name in active,
      `Internal policy ${name} is returned by getActivePolicies`
    );
  }

  // ...but they must not surface the engine as active.
  equal(
    Services.policies.status,
    Ci.nsIEnterprisePolicies.INACTIVE,
    "Engine stays inactive when only internal policies are present"
  );
  ok(
    !Services.policies.isEnterprise,
    "isEnterprise is false when only internal policies are present"
  );
});

add_task(async function test_real_policy_surfaces_but_internal_does_not() {
  await setupPolicyEngineWithJson({
    policies: { BlockAboutSupport: true },
  });

  equal(
    Services.policies.status,
    Ci.nsIEnterprisePolicies.ACTIVE,
    "A real administrator policy makes the engine active"
  );
  ok(
    Services.policies.isEnterprise,
    "isEnterprise reflects the real administrator policy"
  );

  let active = Services.policies.getActivePolicies();
  ok("BlockAboutSupport" in active, "The administrator policy is surfaced");
  for (let name of INTERNAL_POLICY_NAMES) {
    ok(
      name in active,
      `Internal policy ${name} is still returned by getActivePolicies`
    );
  }
});

add_task(async function test_internal_takes_precedence_over_local() {
  // An administrator cannot really configure an internal policy (it shows up as
  // unsupported in the console), but if a conflicting value is supplied locally
  // the internal provider still wins.
  let [name] = INTERNAL_POLICY_NAMES;
  await setupPolicyEngineWithJson({
    policies: { [name]: !INTERNAL_POLICIES[name] },
  });

  equal(
    Services.policies.getActivePolicies()[name],
    INTERNAL_POLICIES[name],
    `Internal value for ${name} overrides the locally supplied value`
  );
});
