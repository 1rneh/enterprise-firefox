/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { EnterprisePolicyTesting } = ChromeUtils.importESModule(
  "resource://testing-common/EnterprisePolicyTesting.sys.mjs"
);

async function clearPolicyEngine() {
  await EnterprisePolicyTesting.servePolicyWithJson({ policies: {} }, {});
  is(
    Object.keys(Services.policies.getActivePolicies()).length,
    0,
    "No policies should be defined"
  );
  is(
    Services.policies.status,
    Ci.nsIEnterprisePolicies.INACTIVE,
    "Engine is inactive at the end of the test"
  );
}
