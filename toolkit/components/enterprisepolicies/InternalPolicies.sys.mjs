/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Internal enterprise policies: a fixed set compiled into enterprise builds to
 * disable features that are not supported in Firefox Enterprise. These are only
 * policies that an administrator cannot configure.
 *
 * They are always applied and take precedence over every other provider. Since
 * they are not admin-configurable, they are not surfaced as active policies (in
 * the engine status, telemetry, isEnterprise or about:policies). They are still
 * included in getActivePolicies() so components that read a policy value back at
 * runtime continue to behave correctly.
 */

import { PoliciesProvider } from "resource://gre/modules/EnterprisePoliciesParent.sys.mjs";

export const INTERNAL_POLICIES = {
  BlockAboutProfiles: true,
};

/**
 * Provider supplying the fixed set of internal policies. Marked as internal so
 * the engine can apply it with the highest precedence while excluding it from
 * the surfaces that show policies as active.
 */
export class InternalPoliciesProvider extends PoliciesProvider {
  constructor() {
    super();
    this.isInternal = true;
    this._policies = { ...INTERNAL_POLICIES };
  }
}
