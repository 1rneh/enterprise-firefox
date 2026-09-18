/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { EnterpriseThemeMigration } = ChromeUtils.importESModule(
  "resource:///modules/enterprise/EnterpriseThemeMigration.sys.mjs"
);
const { BuiltInThemes } = ChromeUtils.importESModule(
  "resource:///modules/BuiltInThemes.sys.mjs"
);

const ACTIVE_THEME_PREF = "extensions.activeThemeID";
const AUTO_THEME_ID = "firefox-enterprise-auto@mozilla.org";

// Isolate the pref remap from the real add-on machinery.
let installCount = 0;
BuiltInThemes.maybeInstallActiveBuiltInTheme = async () => {
  installCount++;
};

function setup(themeId) {
  installCount = 0;
  if (themeId === undefined) {
    Services.prefs.clearUserPref(ACTIVE_THEME_PREF);
  } else {
    Services.prefs.setStringPref(ACTIVE_THEME_PREF, themeId);
  }
}

add_task(async function test_migrates_removed_light_theme() {
  setup("firefox-enterprise-light@mozilla.org");
  await EnterpriseThemeMigration.migrate();
  Assert.equal(
    Services.prefs.getStringPref(ACTIVE_THEME_PREF),
    AUTO_THEME_ID,
    "light theme is remapped to the auto theme"
  );
  Assert.equal(installCount, 1, "the auto theme is activated");
});

add_task(async function test_migrates_removed_dark_theme() {
  setup("firefox-enterprise-dark@mozilla.org");
  await EnterpriseThemeMigration.migrate();
  Assert.equal(
    Services.prefs.getStringPref(ACTIVE_THEME_PREF),
    AUTO_THEME_ID,
    "dark theme is remapped to the auto theme"
  );
  Assert.equal(installCount, 1, "the auto theme is activated");
});

add_task(async function test_leaves_unrelated_theme_untouched() {
  setup("firefox-compact-dark@mozilla.org");
  await EnterpriseThemeMigration.migrate();
  Assert.equal(
    Services.prefs.getStringPref(ACTIVE_THEME_PREF),
    "firefox-compact-dark@mozilla.org",
    "an unrelated selected theme is left untouched"
  );
  Assert.equal(
    installCount,
    0,
    "no theme is activated for unrelated selections"
  );
});

add_task(async function test_no_user_selection() {
  setup(undefined);
  await EnterpriseThemeMigration.migrate();
  Assert.ok(
    !Services.prefs.prefHasUserValue(ACTIVE_THEME_PREF),
    "no active theme is set when the user never selected one"
  );
  Assert.equal(installCount, 0, "no theme is activated");
});
