/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Enterprise policies come in two kinds, flagged per policy by
// x-restart-required in policies-schema.json. A startup policy
// (x-restart-required: true) only takes effect when Firefox starts and any
// attempted update at runtime is ignored; a live policy (x-restart-required: false)
// can also be applied at runtime.

const customSchema = {
  properties: {
    StartupTestPolicy: { type: "string", "x-restart-required": true },
    LiveTestPolicy: { type: "string", "x-restart-required": false },
  },
};

let startupValue;
let liveValue;

const StartupTestPolicy = {
  onBeforeUIStartup(manager, param) {
    startupValue = param;
  },
};

const LiveTestPolicy = {
  onBeforeUIStartup(manager, param) {
    liveValue = param;
  },
  onRemove() {
    liveValue = POLICY_PARAM_STATE.REMOVED;
  },
};

add_setup(async () => {
  Policies.StartupTestPolicy = StartupTestPolicy;
  Policies.LiveTestPolicy = LiveTestPolicy;

  registerCleanupFunction(() => {
    delete Policies.StartupTestPolicy;
    delete Policies.LiveTestPolicy;
  });
});

// A startup policy applied at startup must not be changed by a live update.
add_task(async function test_startup_policy_update_ignored_live() {
  startupValue = POLICY_PARAM_STATE.DEFAULT;

  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    { policies: { StartupTestPolicy: POLICY_PARAM_STATE.APPLIED } },
    customSchema
  );
  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { StartupTestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Startup policy is applied at startup."
  );
  Assert.equal(startupValue, POLICY_PARAM_STATE.APPLIED);

  // Reset so any (unexpected) re-application is detectable.
  startupValue = POLICY_PARAM_STATE.DEFAULT;

  info("Live-updating the startup policy's parameters");
  await waitForLivePolicyUpdate({
    StartupTestPolicy: POLICY_PARAM_STATE.UPDATED_BY_REMOTE_POLICY,
  });

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { StartupTestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Startup policy keeps its startup value; the live update is not applied."
  );
  Assert.equal(
    startupValue,
    POLICY_PARAM_STATE.DEFAULT,
    "Startup policy callback did not re-run on the live update."
  );
});

// A startup policy applied at startup must not be removed by a live update
add_task(async function test_startup_policy_removal_ignored_live() {
  startupValue = POLICY_PARAM_STATE.DEFAULT;

  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    { policies: { StartupTestPolicy: POLICY_PARAM_STATE.APPLIED } },
    customSchema
  );
  Assert.equal(startupValue, POLICY_PARAM_STATE.APPLIED);

  // Reset so a stray onRemove is detectable.
  startupValue = POLICY_PARAM_STATE.DEFAULT;

  info("Removing the startup policy live");
  await waitForLivePolicyUpdate({});

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { StartupTestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Startup policy stays applied."
  );
});
