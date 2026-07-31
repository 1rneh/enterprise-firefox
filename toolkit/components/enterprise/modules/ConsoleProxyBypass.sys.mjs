/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = XPCOMUtils.declareLazy({
  CONSOLE_ADDRESS_PREF:
    "resource://gre/modules/enterprise/ConsoleClient.sys.mjs",
  createEnterpriseLogger:
    "resource://gre/modules/enterprise/EnterpriseCommon.sys.mjs",
  log: () => lazy.createEnterpriseLogger("ConsoleProxyBypass"),
  ProxyService: {
    service: "@mozilla.org/network/protocol-proxy-service;1",
    iid: Ci.nsIProtocolProxyService,
  },
});

// Run after other registered filters, so the console bypass takes precedence.
const FILTER_POSITION = 100;

/**
 * Forces traffic to the enterprise console host to use a direct connection,
 * regardless of how a proxy was configured, to prevent breaking the console connection.
 */
export const ConsoleProxyBypass = {
  QueryInterface: ChromeUtils.generateQI([
    "nsIProtocolProxyFilter",
    "nsIObserver",
  ]),

  /** @type {string} Hostname of the enterprise console, or null if unset. */
  _consoleHost: null,
  /** @type {boolean} Whether the filter and observers have been initialized. */
  _initialized: false,

  /**
   * Registers the proxy filter and the observers.
   */
  init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    this._updateConsoleHost();
    lazy.ProxyService.registerFilter(this, FILTER_POSITION);
    Services.prefs.addObserver(lazy.CONSOLE_ADDRESS_PREF, this);
    Services.obs.addObserver(this, "xpcom-shutdown");
  },

  /**
   * Unregisters the proxy filter and observers.
   */
  uninit() {
    if (!this._initialized) {
      return;
    }
    this._initialized = false;

    Services.prefs.removeObserver(lazy.CONSOLE_ADDRESS_PREF, this);
    Services.obs.removeObserver(this, "xpcom-shutdown");
    try {
      lazy.ProxyService.unregisterFilter(this);
    } catch (e) {
      lazy.log.error("Failed to unregister proxy filter:", e);
    }
  },

  /**
   * Parses and caches the console hostname from the console address pref.
   */
  _updateConsoleHost() {
    const address = Services.prefs.getStringPref(lazy.CONSOLE_ADDRESS_PREF, "");
    this._consoleHost = URL.parse(address)?.hostname || null;
  },

  /**
   * @see nsIProtocolProxyFilter
   * @param {nsIURI} uri The URI the proxy settings apply to.
   * @param {nsIProxyInfo} proxy The proxy resolved for the URI, or null.
   * @param {nsIProxyProtocolFilterResult} callback Receives the result.
   */
  applyFilter(uri, proxy, callback) {
    let host;
    try {
      host = uri.host;
    } catch {
      // Some URIs (e.g. about:) have no host and never match the console.
      host = null;
    }
    if (this._consoleHost && host === this._consoleHost) {
      // Passing null forces a direct connection.
      callback.onProxyFilterResult(null);
      return;
    }
    callback.onProxyFilterResult(proxy);
  },

  /**
   * @see nsIObserver
   * @param {nsISupports} _subject The pref branch or subject of the notification.
   * @param {string} topic Either "nsPref:changed" or "xpcom-shutdown".
   */
  observe(_subject, topic) {
    switch (topic) {
      case "nsPref:changed":
        this._updateConsoleHost();
        break;
      case "xpcom-shutdown":
        this.uninit();
        break;
    }
  },
};
