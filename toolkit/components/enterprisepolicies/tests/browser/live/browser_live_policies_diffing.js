/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const customSchema = {
  properties: {
    TestPolicy: {
      type: "string",
    },
  },
};

let policyValue = POLICY_PARAM_STATE.DEFAULT;

const TestPolicy = {
  onBeforeUIStartup(manager, param) {
    policyValue = param;
  },
  onRemove(_manager, _oldParam) {
    policyValue = POLICY_PARAM_STATE.REMOVED;
  },
};

add_setup(async () => {
  Policies.TestPolicy = TestPolicy;

  registerCleanupFunction(async () => {
    delete Policies.TestPolicy;
  });
});

add_task(async function test_policy_update_apply_new_policy() {
  policyValue = POLICY_PARAM_STATE.DEFAULT;

  await EnterprisePolicyTesting.servePolicyWithRemoteJson(
    {
      policies: {},
    },
    customSchema
  );

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    {},
    "Expected no policies to be applied."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.DEFAULT,
    "Expected the default policy parameter."
  );

  const policies = {
    policies: {
      TestPolicy: POLICY_PARAM_STATE.APPLIED,
    },
  };

  await EnterprisePolicyTesting.applyRemotePolicies(policies);

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { TestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Expected remote policy TestPolicy with parameter APPLIED."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.APPLIED,
    `Expected the policy parameter "applied".`
  );
});

add_task(async function test_policy_update_apply_policy_param_update() {
  policyValue = POLICY_PARAM_STATE.DEFAULT;

  await EnterprisePolicyTesting.servePolicyWithRemoteJson(
    {
      policies: {
        TestPolicy: POLICY_PARAM_STATE.APPLIED,
      },
    },
    customSchema
  );

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { TestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Expected remote policy TestPolicy with parameter APPLIED."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.APPLIED,
    `Expected the policy parameter "applied".`
  );

  policyValue = POLICY_PARAM_STATE.DEFAULT;

  const policies = {
    policies: {
      TestPolicy: POLICY_PARAM_STATE.UPDATED,
    },
  };

  await EnterprisePolicyTesting.applyRemotePolicies(policies);

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { TestPolicy: POLICY_PARAM_STATE.UPDATED },
    "Expected remote policy TestPolicy with parameter UPDATED."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.UPDATED,
    `Expected the policy parameter "updated".`
  );
});

add_task(async function test_policy_update_remove_old_policy() {
  policyValue = POLICY_PARAM_STATE.DEFAULT;

  await EnterprisePolicyTesting.servePolicyWithRemoteJson(
    {
      policies: {
        TestPolicy: POLICY_PARAM_STATE.APPLIED,
      },
    },
    customSchema
  );

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { TestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Expected remote policy TestPolicy with parameter APPLIED."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.APPLIED,
    `Expected the policy parameter "applied".`
  );

  const policies = {
    policies: {},
  };

  await EnterprisePolicyTesting.applyRemotePolicies(policies);

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    {},
    "Expected remote policy TestPolicy to be removed."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.REMOVED,
    "Expected the policy parameter to be of state REMOVED."
  );
});

add_task(async function test_policy_update_no_changes() {
  policyValue = POLICY_PARAM_STATE.DEFAULT;

  await EnterprisePolicyTesting.servePolicyWithRemoteJson(
    {
      policies: {
        TestPolicy: POLICY_PARAM_STATE.APPLIED,
      },
    },
    customSchema
  );

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { TestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Expected remote policy TestPolicy with parameter APPLIED."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.APPLIED,
    `Expected the policy parameter "applied".`
  );

  // Revert back to DEFAULT (pref is unlocked)
  policyValue = POLICY_PARAM_STATE.DEFAULT;

  // Wait for next policy update to complete
  await EnterprisePolicyTesting.awaitNextPolicyUpdate();

  // Verify that the policy's callback wasn't called a second time.
  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { TestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Expected no changes to the active policy specifications."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.DEFAULT,
    "Expected local changes to policy parameters to not get overridden."
  );

  const policies = {
    policies: {},
  };

  await EnterprisePolicyTesting.applyRemotePolicies(policies);

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    {},
    "Expected remote policy TestPolicy to be removed."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.REMOVED,
    "Expected the policy parameter to be of state REMOVED."
  );
});

add_task(async function test_policy_update_invalid_params_keeps_previous() {
  policyValue = POLICY_PARAM_STATE.DEFAULT;

  // Apply the policy with valid parameters.
  await EnterprisePolicyTesting.servePolicyWithRemoteJson(
    {
      policies: {
        TestPolicy: POLICY_PARAM_STATE.APPLIED,
      },
    },
    customSchema
  );

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { TestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Expected remote policy TestPolicy with parameter APPLIED."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.APPLIED,
    `Expected the policy parameter "applied".`
  );

  // Reset so we can detect whether any callback runs on the next update.
  policyValue = POLICY_PARAM_STATE.DEFAULT;

  // Update the policy with invalid parameters (an object where the schema
  // requires a string). The previously applied policy must be kept, i.e.
  // neither removed nor re-applied.
  await EnterprisePolicyTesting.applyRemotePolicies({
    policies: {
      TestPolicy: { invalid: true },
    },
  });

  Assert.deepEqual(
    Services.policies.getActivePolicies(),
    { TestPolicy: POLICY_PARAM_STATE.APPLIED },
    "Expected the previously applied TestPolicy to be kept on invalid params."
  );
  Assert.equal(
    policyValue,
    POLICY_PARAM_STATE.DEFAULT,
    "Expected the policy to be neither removed nor re-applied."
  );
});
