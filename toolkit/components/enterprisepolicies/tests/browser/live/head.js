/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { EnterprisePolicyTesting, PoliciesPrefTracker } =
  ChromeUtils.importESModule(
    "resource://testing-common/EnterprisePolicyTesting.sys.mjs"
  );

const { Policies } = ChromeUtils.importESModule(
  "resource:///modules/policies/Policies.sys.mjs"
);

EnterprisePolicyTesting.pathResolver = getTestFilePath;

const POLICY_PARAM_STATE = {
  DEFAULT: "default",
  APPLIED: "applied",
  APPLIED_LOCAL_POLICY: "applied-by-local-policy",
  APPLIED_REMOTE_POLICY: "applied-by-remote-policy",
  UPDATED: "updated",
  REMOVED: "removed",
};

add_setup(async () => {
  PoliciesPrefTracker.start();
  registerCleanupFunction(() => {
    PoliciesPrefTracker.stop();
  });

  registerCleanupFunction(async () => {
    Services.obs.notifyObservers(null, "EnterprisePolicies:Reset");
    if (EnterprisePolicyTesting.remotePoliciesStub) {
      EnterprisePolicyTesting.remotePoliciesStub.restore();
      EnterprisePolicyTesting.remotePoliciesStub = null;
    }
  });
});

/**
 * Set up a policy engine that combines local policies (read from a local
 * policies.json) and remote policies (fetched from the stubbed ConsoleClient
 * endpoint).
 *
 * @param {object} localPolicies Policies to be read from a local policies.json
 * @param {object} remotePolicies Policies to be fetched from the stubbed endpoint
 * @param {object} customSchema
 * @returns {Promise} Resolves once local and remote policies are applied after a restart.
 */
async function setupPolicyEngineWithCombinedPolicyProvider(
  localPolicies,
  remotePolicies,
  customSchema
) {
  PoliciesPrefTracker.restoreDefaultValues();

  // Stub the remote policies endpoint.
  const remotePoliciesAppliedPromise =
    EnterprisePolicyTesting.applyRemotePolicies(remotePolicies, false);

  // Put local policies in place (local policies.json file).
  const localPoliciesAppliedPromise =
    EnterprisePolicyTesting.setupPolicyEngineWithJson(
      localPolicies,
      customSchema
    );

  return Promise.all([
    localPoliciesAppliedPromise,
    remotePoliciesAppliedPromise,
  ]);
}
