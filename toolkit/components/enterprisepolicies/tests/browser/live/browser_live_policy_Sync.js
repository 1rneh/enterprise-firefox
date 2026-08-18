/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// The feature the Sync policy disallows when it locks the sync state.
const SYNC_FEATURE = "change-sync-state";

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

const { UIState } = ChromeUtils.importESModule(
  "resource://services-sync/UIState.sys.mjs"
);
const { getFxAccountsSingleton } = ChromeUtils.importESModule(
  "resource://gre/modules/FxAccounts.sys.mjs"
);

// The sync pane renders from UIState, so we mock it to reach the signed-in
// states that expose the controls gated on the change-sync-state feature.
const SIGNED_IN_SYNC_ON = {
  status: UIState.STATUS_SIGNED_IN,
  email: "test@example.com",
  displayName: "Test User",
  syncEnabled: true,
};

const SIGNED_IN_SYNC_OFF = {
  status: UIState.STATUS_SIGNED_IN,
  email: "test@example.com",
  displayName: "Test User",
  syncEnabled: false,
};

// Open the settings sync pane with a mocked UIState and run a check
// against its document.
async function withSyncPane(uiStateData, assertionCallback) {
  const oldGet = UIState.get;
  UIState.get = () => uiStateData;

  const paneLoaded = TestUtils.topicObserved("sync-pane-loaded", () => true);
  gBrowser.selectedTab = BrowserTestUtils.addTab(gBrowser, "about:blank", {
    allowInheritPrincipal: true,
  });
  openPreferences("paneSync");
  await paneLoaded;

  const doc = gBrowser.contentDocument;

  // The sync settings render from the mocked UIState during pane load; wait for
  // the signed-in state to be reflected before asserting.
  await TestUtils.waitForCondition(() => {
    const signedIn = doc.getElementById("fxaSignedInGroup");
    return signedIn && BrowserTestUtils.isVisible(signedIn);
  }, "the signed-in account state is rendered");

  try {
    await assertionCallback(doc);
  } finally {
    UIState.get = oldGet;
    BrowserTestUtils.removeTab(gBrowser.selectedTab);
  }
}

function syncGroup(doc) {
  return doc.querySelector('setting-group[groupid="sync"]');
}

// The Disconnect control only appears while Sync is on.
async function checkDisconnect(expectedHidden) {
  await withSyncPane(SIGNED_IN_SYNC_ON, doc => {
    const group = syncGroup(doc);
    ok(
      !BrowserTestUtils.isHidden(group.querySelector("#syncConfigured")),
      "The 'Sync is on' section is shown for a signed-in, syncing user."
    );
    is(
      BrowserTestUtils.isHidden(group.querySelector("#syncDisconnect")),
      expectedHidden,
      `The Disconnect button is ${expectedHidden ? "hidden" : "shown"}.`
    );
  });
}

// The "Sync is off" section only appears while Sync is off.
async function checkTurnOn(expectedHidden) {
  await withSyncPane(SIGNED_IN_SYNC_OFF, doc => {
    const group = syncGroup(doc);
    is(
      BrowserTestUtils.isHidden(group.querySelector("#syncNotConfigured")),
      expectedHidden,
      `The 'Sync is off' section is ${expectedHidden ? "hidden" : "shown"}.`
    );
    is(
      BrowserTestUtils.isHidden(group.querySelector("#syncSetup")),
      expectedHidden,
      `The 'Turn on syncing' button is ${expectedHidden ? "hidden" : "shown"}.`
    );
  });
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

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({
    // The mocked signed-in UIState has no real FxA account, so the urlbar trust
    // panel's breach check logs NO_ACCOUNT errors on the tab switch into the sync
    // pane. It is unrelated to these tests, so turn it off.
    set: [["browser.urlbar.trustPanel.featureGate", false]],
  });
});

// Sync locked and enabled: Hides the Disconnect control.
// Sync locked and disabled: Hides the "Sync is off" section (info box + 'Turn on syncing' button).
// Removing the policy hides no on/off controls.
add_task(async function test_sync_controls_reflect_feature_lock() {
  const restoreFxa = mockSignedInAccount();

  try {
    info("Enabled and Locked: the Disconnect control is hidden.");
    await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
      { policies: { Sync: { Enabled: true, Locked: true } } },
      null
    );
    // Enabling awaits connectSync before disallowFeature, so wait for the lock.
    await TestUtils.waitForCondition(
      () => !Services.policies.isAllowed(SYNC_FEATURE),
      "the change-sync-state feature is locked"
    );
    await checkDisconnect(true);

    info("Disabled and Locked: the 'Sync is off' controls are hidden.");
    await updatePolicies({
      policies: { Sync: { Enabled: false, Locked: true } },
    });
    // A prior connect means this may disconnect (async) before disallowFeature.
    await TestUtils.waitForCondition(
      () => !Services.policies.isAllowed(SYNC_FEATURE),
      "the change-sync-state feature is locked"
    );
    await checkTurnOn(true);

    info("Removed: the controls are shown again.");
    await updatePolicies({ policies: {} });
    checkSyncFeatureAllowed(true);
    await checkDisconnect(false);
    await checkTurnOn(false);
  } finally {
    restoreFxa();
    Services.prefs.clearUserPref("services.sync.username");
  }
});
