/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  createEnterpriseLogger:
    "resource:///modules/enterprise/EnterpriseCommon.sys.mjs",
  getResolvedErrorConfig: "chrome://global/content/errors/error-lookup.mjs",
  initializeRegistry: "chrome://global/content/errors/error-registry.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "log", () => {
  return lazy.createEnterpriseLogger("FeltErrorReport");
});

export const ERROR_SOURCE = {
  XHR: "xhr",
  NET: "net",
  RESET: "reset",
};

export const FeltErrorReport = {
  _wrapper: null,

  /* Per UX requirements, there are some error messages where it is required
   * there is more control over on enterprise builds: it can be because the
   * way information is displayed is not as efficient as the original
   * about:neterror page and string needs rewording, incorrect casing,
   * duplicated error messages that may refers to UI elements that do not
   * exists, etc.
   */
  _errorCodesMapping: {
    dnsNotFound: "dnsNotFound-enterprise",
    netOffline: "NS_ERROR_OFFLINE",
  },

  /* Show simpler "No Network Connection" only for truly offline scenarios:
   *  - netOffline for offline mode,
   *  - dnsNotFound for actual network disconnect
   */
  _noNetworkErrors: ["netOffline", "dnsNotFound"],

  init(doc) {
    this._document = doc;
    lazy.initializeRegistry();
    this._wrapper = this._document.querySelector(".felt-browser-error");
    this._wrapper.addEventListener("message-bar:user-dismissed", e => {
      e.preventDefault();
      e.target.classList.add("is-hidden");
    });
  },

  reset() {
    if (!this._wrapper) {
      return;
    }
    for (const bar of this._wrapper.querySelectorAll("moz-message-bar")) {
      bar.classList.add("is-hidden");
    }
  },

  async _maybeResetErrorElement(errorElement) {
    errorElement.dismiss();
    errorElement.removeAttribute("source");

    errorElement
      .querySelectorAll(".felt-browser-error-details[added]")
      .forEach(el => el.remove());

    // Remove so next l10n.setAttributes() will re-translate from original HTML
    errorElement.removeAttribute("heading");
    if (errorElement.dataset.l10nId) {
      this._document.l10n.setAttributes(
        errorElement,
        errorElement.dataset.l10nId
      );
      await this._document.l10n.translateElements([errorElement]);
    }

    return errorElement;
  },

  /**
   * Leverages existing about:certerror/about:neterror string IDs and error
   * handling to update the error message displayed to the user
   *
   * @param {object} errorElement - The HTML element holding the error message
   * @param {string} errorCode - The specific error code used for displaying the error message.
   * @param {object} context - Additional context for the error.
   * @param {string} context.hostname - The hostname related to the error.
   * @param {boolean} context.canUseCustomNetError - Indicates if a custom network error can be used.
   * @param {object} detailsElement - The HTML element holding the error message details, if used.
   */
  async _applyErrorConfig(
    errorElement,
    errorCode,
    context,
    detailsElement = null
  ) {
    try {
      const errorConfig = lazy.getResolvedErrorConfig(errorCode, context);
      if (errorConfig.introContent) {
        this._document.l10n.setAttributes(
          detailsElement,
          errorConfig.introContent.dataL10nId,
          errorConfig.introContent.dataL10nArgs
        );
      }
      if (errorConfig.customNetError && context.canUseCustomNetError) {
        errorElement.setAttribute(
          "heading",
          await this._document.l10n.formatValue(
            errorConfig.customNetError.titleL10nId
          )
        );
        if (errorConfig.customNetError.whatCanYouDoL10nId) {
          this._document.l10n.setAttributes(
            detailsElement,
            errorConfig.customNetError.whatCanYouDoL10nId,
            errorConfig.customNetError.whatCanYouDoL10nArgs
          );
        } else if (errorConfig.customNetError.whatCanYouDoItems) {
          errorConfig.customNetError.whatCanYouDoItems.forEach(itemL10nId => {
            const itemElement = this._document.createElement("span");
            itemElement.slot = "message";
            itemElement.className = "felt-browser-error-details";
            itemElement.setAttribute("added", "true");
            this._document.l10n.setAttributes(itemElement, itemL10nId);
            errorElement.appendChild(itemElement);
          });
        }
      }
    } catch (ex) {
      lazy.log.debug(
        `_applyErrorConfig(${errorCode}) not resolved: ${ex} -- Falling back`
      );
    }
  },

  /**
   * Updates the error display based on the error type and details.
   *
   * @param {string} errorType - The type of error to display.
   * @param {string|null} errorCode - The specific error code used for displaying the error message.
   * @param {object|null} context - Additional context for the error.
   * @param {string} source - The source of the error, from ERROR_SOURCE
   */
  async update(errorType, errorCode = null, context = null, source = null) {
    const errorElement = this._wrapper.querySelector(`.${errorType}`);
    if (!errorElement) {
      lazy.log.error(`Error element ${errorType} not found`);
      return;
    }

    await this._maybeResetErrorElement(errorElement);

    if (errorCode) {
      const detailsElement = errorElement.querySelector(
        ".felt-browser-error-details"
      );
      if (detailsElement) {
        if (context) {
          await this._applyErrorConfig(
            errorElement,
            errorCode,
            context,
            detailsElement
          );
        }

        const l10n = this._document.l10n.getAttributes(detailsElement);
        if (!l10n?.id) {
          const message = await this._document.l10n.formatValue(
            `felt-error-${errorCode}`
          );
          detailsElement.textContent = message || errorCode;
        }
      }
    }

    if (source) {
      errorElement.setAttribute("source", source);
    }

    errorElement.classList.remove("is-hidden");
  },

  /**
   * Handle displaying an error produced by about:neterror/about:certerror
   * sent from FeltErrorWindowChild.
   *
   * @param {object} aData - The message containing the error URL in 'errorPageURI'
   *                         field which is a URL containing error code as 'e'
   *                         parameter and URL triggering the error as
   *                         'u' parameter.
   */
  async handleNetError(aData) {
    try {
      const parsedErrorPage = new URL(aData.errorPageURI);
      const errorCode = (() => {
        const parsedErrorCode = parsedErrorPage.searchParams.get("e");
        const mappedErrorCode = this._errorCodesMapping[parsedErrorCode];
        if (mappedErrorCode) {
          return mappedErrorCode;
        }
        return parsedErrorCode;
      })();

      const errorHostname = new URL(parsedErrorPage.searchParams.get("u")).host;

      await this.updateNetworkError(
        errorCode,
        {
          hostname: errorHostname,
          canUseCustomNetError: true,
        },
        ERROR_SOURCE.NET
      );
    } catch (ex) {
      await this.updateNetworkError("network", null, ERROR_SOURCE.NET);
    }

    this._document
      .querySelector(".felt-login__email-pane")
      .classList.remove("is-hidden");
    this._document.querySelector(".felt-login__sso").classList.add("is-hidden");
  },

  /**
   * Handle displaying a network error generated from about: or XHR.
   * Error codes are filtered to display either the error connection or the
   * no network display.
   *
   * @param {string} errorCode - The error code as a string value
   * @param {object} context - The error context, with hostname field holding the
   *                         value of the host triggering the error
   * @param {string} source - The source of the error, ERROR_SOURCE.XHR or
   *                          ERROR_SOURCE.NET. Useful for assertions in tests.
   */
  async updateNetworkError(errorCode, context, source) {
    if (this._noNetworkErrors.includes(errorCode)) {
      await this.update(
        "felt-browser-error-no-network",
        "no-network-connection",
        null,
        source
      );
    } else {
      await this.update(
        "felt-browser-error-connection",
        errorCode,
        context,
        source
      );
    }
  },
};
