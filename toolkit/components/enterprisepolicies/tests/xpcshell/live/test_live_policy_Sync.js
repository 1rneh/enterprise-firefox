/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Testing the Sync policy in an xpcshell test because exercising the Sync
// policy's real connection changes needs the services-sync testing harness to
// fake a signed-in state.

// The services-sync modules read the profile directory at import time.
do_get_profile();

const { TestUtils } = ChromeUtils.importESModule(
  "resource://testing-common/TestUtils.sys.mjs"
);
const { Service } = ChromeUtils.importESModule(
  "resource://services-sync/service.sys.mjs"
);
const { configureIdentity } = ChromeUtils.importESModule(
  "resource://testing-common/services/sync/utils.sys.mjs"
);
const { STATUS_OK, CLIENT_NOT_CONFIGURED } = ChromeUtils.importESModule(
  "resource://services-sync/constants.sys.mjs"
);
const { getFxAccountsSingleton } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccounts.sys.mjs"
);

const SYNC_FEATURE = "sync";

// Engine prefs the Sync policy drives, keyed by their policy property name.
const ENGINE_PREFS = {
  Bookmarks: "services.sync.engine.bookmarks",
  History: "services.sync.engine.history",
  Passwords: "services.sync.engine.passwords",
  Addresses: "services.sync.engine.addresses",
};

function checkEnginePref(pref, expectedValue, expectedLocked) {
  Assert.strictEqual(
    Services.prefs.getBoolPref(pref),
    expectedValue,
    `${pref} has the expected value`
  );
  Assert.equal(
    Services.prefs.prefIsLocked(pref),
    expectedLocked,
    `${pref} lock status is as expected`
  );
}

function checkSyncFeatureAllowed(expectedAllowed) {
  Assert.equal(
    Services.policies.isAllowed(SYNC_FEATURE),
    expectedAllowed,
    `${SYNC_FEATURE} feature is ${expectedAllowed ? "allowed" : "disallowed"}`
  );
}

async function updatePolicies(policies) {
  const updateApplied = EnterprisePolicyTesting.awaitNextPolicyUpdate();
  EnterprisePolicyTesting.stubRemotePolicies(policies);
  await updateApplied;
}

// Fake a signed-in FxA account with sync keys so the policy's connect path
// (Service.configure) succeeds. Returns a function that restores the originals.
function mockSignedInAccount() {
  const fxAccounts = getFxAccountsSingleton();
  const originalGetSignedInUser = fxAccounts.getSignedInUser;
  const originalHasKeysForScope = fxAccounts.keys.hasKeysForScope;
  fxAccounts.getSignedInUser = () =>
    Promise.resolve({ email: "test@example.com", uid: "12345" });
  fxAccounts.keys.hasKeysForScope = () => Promise.resolve(true);
  return () => {
    fxAccounts.getSignedInUser = originalGetSignedInUser;
    fxAccounts.keys.hasKeysForScope = originalHasKeysForScope;
  };
}

registerCleanupFunction(() => {
  Services.prefs.clearUserPref("services.sync.username");
});

// ---- Unlocked Sync policy does not change the connection ----

// Enabled without Locked doesn't change the connection,
// so a disconnected Sync stays disconnected.
add_task(async function test_unlocked_enabled_does_not_connect() {
  await Service.startOver();
  Assert.ok(
    !Services.prefs.prefHasUserValue("services.sync.username"),
    "Sync is disconnected before the policy applies"
  );

  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    { policies: { Sync: { Enabled: true } } },
    null
  );

  Assert.ok(
    "Sync" in Services.policies.getActivePolicies(),
    "the Sync policy was applied"
  );
  Assert.equal(
    Service.status.checkSetup(),
    CLIENT_NOT_CONFIGURED,
    "Sync stays disconnected because the policy is not locked"
  );
  checkSyncFeatureAllowed(true);

  await updatePolicies({ policies: {} });
});

// Disabled without Locked doesn't change the connection,
// so a connected Sync stays connected.
add_task(async function test_unlocked_disabled_does_not_disconnect() {
  await Service.startOver();
  await configureIdentity();
  Assert.equal(
    Service.status.checkSetup(),
    STATUS_OK,
    "Sync is connected before the policy applies"
  );

  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    { policies: { Sync: { Enabled: false } } },
    null
  );

  Assert.ok(
    Services.prefs.prefHasUserValue("services.sync.username"),
    "the Sync account is still configured"
  );
  Assert.equal(
    Service.status.checkSetup(),
    STATUS_OK,
    "Sync stays connected because the policy is not locked"
  );
  checkSyncFeatureAllowed(true);

  await updatePolicies({ policies: {} });
});

// Enabled and Locked connects a disconnected Sync and locks the feature.
add_task(async function test_locked_enabled_connects_and_locks_feature() {
  await Service.startOver();
  Assert.ok(
    !Services.prefs.prefHasUserValue("services.sync.username"),
    "Sync is disconnected before the policy applies"
  );

  const restoreFxa = mockSignedInAccount();
  try {
    await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
      { policies: { Sync: { Enabled: true, Locked: true } } },
      null
    );

    // applySettings drives connectSync asynchronously; wait for the connection.
    await TestUtils.waitForCondition(
      () =>
        Services.prefs.getStringPref("services.sync.username", "") ===
        "test@example.com",
      "the signed-in account was connected to Sync"
    );
    checkSyncFeatureAllowed(false);
  } finally {
    restoreFxa();
  }

  await updatePolicies({ policies: {} });
  checkSyncFeatureAllowed(true);
});

// Disabled and Locked disconnects a connected Sync and locks the feature.
add_task(async function test_locked_disabled_disconnects_and_locks_feature() {
  await Service.startOver();
  await configureIdentity();
  Assert.equal(
    Service.status.checkSetup(),
    STATUS_OK,
    "Sync is connected before the policy applies"
  );

  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    { policies: { Sync: { Enabled: false, Locked: true } } },
    null
  );

  // applySettings drives disconnectSync asynchronously; wait for the teardown.
  await TestUtils.waitForCondition(
    () => !Services.prefs.prefHasUserValue("services.sync.username"),
    "the Sync account was torn down"
  );
  Assert.equal(
    Service.status.checkSetup(),
    CLIENT_NOT_CONFIGURED,
    "Sync setup state was reset"
  );
  checkSyncFeatureAllowed(false);

  await updatePolicies({ policies: {} });
  checkSyncFeatureAllowed(true);
});

// An unlocked Sync policy only changes the engine setting's default values;
// the preferences stay unlocked and the sync feature stays allowed.
add_task(async function test_unlocked_engine_pref_sets_default() {
  const initialPasswords = Services.prefs.getBoolPref(ENGINE_PREFS.Passwords);

  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    { policies: { Sync: { Passwords: false } } },
    null
  );

  checkEnginePref(ENGINE_PREFS.Passwords, false, false);
  checkSyncFeatureAllowed(true);

  await updatePolicies({ policies: {} });

  checkEnginePref(ENGINE_PREFS.Passwords, initialPasswords, false);
  checkSyncFeatureAllowed(true);
});

// A locked Sync policy overrides the engine settings and locks the prefs.
// A live update reconciles them, and removal reverts to the initial values.
add_task(async function test_locked_engine_prefs_override_and_revert() {
  const initialBookmarks = Services.prefs.getBoolPref(ENGINE_PREFS.Bookmarks);
  const initialHistory = Services.prefs.getBoolPref(ENGINE_PREFS.History);

  info("Applying a locked engine configuration.");
  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    {
      policies: {
        Sync: {
          Locked: true,
          Bookmarks: false,
          History: false,
        },
      },
    },
    null
  );

  checkEnginePref(ENGINE_PREFS.Bookmarks, false, true);
  checkEnginePref(ENGINE_PREFS.History, false, true);
  checkSyncFeatureAllowed(true);

  info("Live-updating the locked engine configuration.");
  await updatePolicies({
    policies: {
      Sync: {
        Locked: true,
        Bookmarks: true,
      },
    },
  });

  // Bookmarks flips to locked true; History was dropped from the config so it
  // reverts to its unlocked default.
  checkEnginePref(ENGINE_PREFS.Bookmarks, true, true);
  checkEnginePref(ENGINE_PREFS.History, initialHistory, false);

  info("Removing the Sync policy.");
  await updatePolicies({ policies: {} });

  checkEnginePref(ENGINE_PREFS.Bookmarks, initialBookmarks, false);
  checkEnginePref(ENGINE_PREFS.History, initialHistory, false);
  checkSyncFeatureAllowed(true);
});
