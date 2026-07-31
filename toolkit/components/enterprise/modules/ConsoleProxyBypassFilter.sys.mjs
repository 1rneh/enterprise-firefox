/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = XPCOMUtils.declareLazy({
  ConsoleClient: "resource://gre/modules/enterprise/ConsoleClient.sys.mjs",
  createEnterpriseLogger:
    "resource://gre/modules/enterprise/EnterpriseCommon.sys.mjs",
  log: () => lazy.createEnterpriseLogger("ConsoleProxyBypassFilter"),
  ProxyService: {
    service: "@mozilla.org/network/protocol-proxy-service;1",
    iid: Ci.nsIProtocolProxyService,
  },
});

// This filter always runs last and takes precedence over any other proxy filter.
const MAX_UINT32 = 0xffffffff;

/**
 * Forces traffic to the enterprise console host to use a direct connection,
 * regardless of how a proxy was configured, to prevent breaking the console connection.
 */
export const ConsoleProxyBypassFilter = {
  QueryInterface: ChromeUtils.generateQI([
    "nsIProtocolProxyFilter",
    "nsIObserver",
  ]),

  /** @type {string} Hostname of the enterprise console, or null if unset. */
  _consoleHost: null,
  /** @type {boolean} Whether the filter and observer have been initialized. */
  _initialized: false,

  /**
   * Registers the proxy filter and the observer.
   */
  async init() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    lazy.ProxyService.registerFilter(this, MAX_UINT32);
    Services.obs.addObserver(this, "xpcom-shutdown");
    await this._updateConsoleHost();
  },

  /**
   * Unregisters the proxy filter and observer.
   */
  uninit() {
    if (!this._initialized) {
      return;
    }
    this._initialized = false;

    Services.obs.removeObserver(this, "xpcom-shutdown");
    try {
      lazy.ProxyService.unregisterFilter(this);
    } catch (e) {
      lazy.log.error("Failed to unregister proxy filter:", e);
    }
  },

  /**
   * Gets the console hostname from ConsoleClient, falling back to null if unavailable.
   */
  async _updateConsoleHost() {
    try {
      const url = await lazy.ConsoleClient.consoleBaseURI;
      this._consoleHost = url.hostname;
    } catch (e) {
      lazy.log.warn("Console host unavailable, proxy bypass inactive:", e);
      this._consoleHost = null;
    }
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
   * @param {nsISupports} _subject The subject of the notification.
   * @param {string} topic The "xpcom-shutdown" notification topic.
   */
  observe(_subject, topic) {
    if (topic === "xpcom-shutdown") {
      this.uninit();
    }
  },
};
