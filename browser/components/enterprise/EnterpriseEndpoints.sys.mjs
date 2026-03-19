/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  ConsoleClient: "resource:///modules/enterprise/ConsoleClient.sys.mjs",
  EnterpriseCommon: "resource:///modules/enterprise/EnterpriseCommon.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "log", () => {
  return console.createInstance({
    prefix: "EnterpriseEndpoints",
    maxLogLevelPref: lazy.EnterpriseCommon.ENTERPRISE_LOGLEVEL_PREF,
  });
});

const RELATIVE_CONSOLE_ENDPOINT_PREFS = [
  {
    pref: "security.certerrors.mitm.priming.endpoint",
    path: "api/misc/mitm/",
  },
  {
    pref: "captivedetect.canonicalURL",
    path: "api/misc/portal/canonical.html",
  },
  {
    pref: "network.connectivity-service.IPv4.url",
    path: "api/misc/connectivity?ipv4",
  },
  {
    pref: "network.connectivity-service.IPv6.url",
    path: "api/misc/connectivity?ipv6",
  },
];

const BASE_CONSOLE_URI_PREFS = new Set([
  "browser.ipProtection.guardian.endpoint",
  "identity.fxaccounts.remote.root",
]);

export const EnterpriseEndpoints = {
  init() {
    lazy.log.log("Setting enterprise endpoints");

    const consoleBaseURI = lazy.ConsoleClient.consoleBaseURI;

    const defaultBranch = Services.prefs.getDefaultBranch("");

    for (const { pref, path } of RELATIVE_CONSOLE_ENDPOINT_PREFS) {
      const url = new URL(path, consoleBaseURI).href;
      defaultBranch.setStringPref(pref, url);
      Services.prefs.lockPref(pref);
    }

    for (const pref of BASE_CONSOLE_URI_PREFS) {
      defaultBranch.setStringPref(pref, consoleBaseURI.href);
      Services.prefs.lockPref(pref);
    }
  },
};
