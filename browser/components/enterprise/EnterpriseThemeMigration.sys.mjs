/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  BuiltInThemes: "resource:///modules/BuiltInThemes.sys.mjs",
});

const ACTIVE_THEME_PREF = "extensions.activeThemeID";
const AUTO_THEME_ID = "firefox-enterprise-auto@mozilla.org";

// Enterprise themes that were replaced by the single auto theme.
const REMOVED_THEME_IDS = [
  "firefox-enterprise-light@mozilla.org",
  "firefox-enterprise-dark@mozilla.org",
];

export const EnterpriseThemeMigration = {
  /**
   * Repoint profiles whose selected theme is one of the removed enterprise
   * light/dark themes at the auto theme, and activate it. Without this, an
   * upgrade leaves `extensions.activeThemeID` pointing at a theme that no
   * longer exists, so no enterprise theme is applied. Self-guards on the pref
   * value, so it is safe to run on every startup.
   */
  async migrate() {
    if (!Services.prefs.prefHasUserValue(ACTIVE_THEME_PREF)) {
      return;
    }
    if (
      !REMOVED_THEME_IDS.includes(
        Services.prefs.getStringPref(ACTIVE_THEME_PREF, "")
      )
    ) {
      return;
    }

    Services.prefs.setStringPref(ACTIVE_THEME_PREF, AUTO_THEME_ID);
    await lazy.BuiltInThemes.maybeInstallActiveBuiltInTheme();
  },
};
