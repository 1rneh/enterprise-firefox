/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const customSchema = {
  properties: {
    DisableLocalPolicies: {
      type: "boolean",
      "x-restart-required": false,
    },

    simple_policy0: {
      type: "string",
      "x-restart-required": false,
    },

    simple_policy1: {
      type: "string",
      "x-restart-required": false,
    },
  },
};

let policy_value0 = POLICY_PARAM_STATE.DEFAULT;

const simple_policy0 = {
  onBeforeUIStartup: (_manager, param) => {
    policy_value0 = param;
  },
  onRemove: (_manager, _oldParam) => {
    policy_value0 = POLICY_PARAM_STATE.REMOVED;
  },
};

const simple_policy1 = {
  onBeforeUIStartup: () => {},
  onRemove: () => {},
};

add_setup(() => {
  Policies.DisableLocalPolicies = {};
  Policies.simple_policy0 = simple_policy0;
  Policies.simple_policy1 = simple_policy1;

  registerCleanupFunction(() => {
    delete Policies.DisableLocalPolicies;
    delete Policies.simple_policy0;
    delete Policies.simple_policy1;
  });
});

add_task(async function test_remote_disables_local_policies_on_startup() {
  policy_value0 = POLICY_PARAM_STATE.DEFAULT;

  const localPolicies = {
    policies: {
      simple_policy0: POLICY_PARAM_STATE.APPLIED_LOCAL_POLICY,
    },
  };
  const remotePolicies = {
    policies: {
      DisableLocalPolicies: true,
      simple_policy1: POLICY_PARAM_STATE.APPLIED_REMOTE_POLICY,
    },
  };

  await EnterprisePolicyTesting.setupPolicyEngineWithCombinedPolicyProvider(
    localPolicies,
    remotePolicies,
    customSchema
  );

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    {
      DisableLocalPolicies: true,
      simple_policy1: POLICY_PARAM_STATE.APPLIED_REMOTE_POLICY,
    },
    "Expected the local policy to be suppressed while remote policies apply."
  );
  Assert.equal(
    policy_value0,
    POLICY_PARAM_STATE.DEFAULT,
    "Expected the local policy callback to never run."
  );
});

add_task(async function test_local_policies_apply_without_directive() {
  policy_value0 = POLICY_PARAM_STATE.DEFAULT;

  const localPolicies = {
    policies: {
      simple_policy0: POLICY_PARAM_STATE.APPLIED_LOCAL_POLICY,
    },
  };

  // Without the directive the local provider is part of the combined provider
  // and its policies apply normally.
  await EnterprisePolicyTesting.setupPolicyEngineWithCombinedPolicyProvider(
    localPolicies,
    { policies: {} },
    customSchema
  );

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { simple_policy0: POLICY_PARAM_STATE.APPLIED_LOCAL_POLICY },
    "Expected the local policy to apply when local policies are not disabled."
  );
  Assert.equal(
    policy_value0,
    POLICY_PARAM_STATE.APPLIED_LOCAL_POLICY,
    "Expected the local policy callback to run."
  );
});
