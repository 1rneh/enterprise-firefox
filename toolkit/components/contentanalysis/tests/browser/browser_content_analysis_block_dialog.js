/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

let mockCA = makeMockContentAnalysis();

add_setup(async function test_setup() {
  mockCA = await mockContentAnalysisService(mockCA);
});

const testPage =
  "<body style='margin: 0'><input id='input' type='text'></body>";

const CLIPBOARD_TEXT_STRING = "Just some text";

function setClipboardData(clipboardString) {
  const trans = Cc["@mozilla.org/widget/transferable;1"].createInstance(
    Ci.nsITransferable
  );
  trans.init(null);
  trans.addDataFlavor("text/plain");
  const str = Cc["@mozilla.org/supports-string;1"].createInstance(
    Ci.nsISupportsString
  );
  str.data = clipboardString;
  trans.setTransferData("text/plain", str);

  // Write to clipboard.
  Services.clipboard.setData(trans, null, Ci.nsIClipboard.kGlobalClipboard);
}

async function getElementValue(browser, elementId) {
  return await SpecialPowers.spawn(browser, [elementId], async elementId => {
    return content.document.getElementById(elementId).value;
  });
}

const RULE_MESSAGE =
  "Pasting work data into AI services may violate company policy.";

const l10n = new Localization(
  [
    "toolkit/contentanalysis/contentanalysis.ftl",
    ...(AppConstants.MOZ_ENTERPRISE
      ? ["toolkit/enterprise/enterprise.ftl"]
      : []),
  ],
  true
);

const BASE_DESCRIPTION = l10n.formatValueSync(
  "contentanalysis-block-dialog-body-clipboard"
);

// Lives in enterprise.ftl, so it only resolves in enterprise builds.
const ADMIN_MESSAGE_LABEL = AppConstants.MOZ_ENTERPRISE
  ? l10n.formatValueSync("contentanalysis-admin-message-label")
  : null;

async function testBlockDialog(options) {
  mockCA.setupForTest(
    !options.block,
    /* waitForEvent */ false,
    /* showDialogs */ true,
    options.ruleMessage
  );
  let tab = BrowserTestUtils.addTab(gBrowser);
  let browser = gBrowser.getBrowserForTab(tab);
  gBrowser.selectedTab = tab;
  await BrowserTestUtils.loadURIString({
    browser: tab.linkedBrowser,
    uriString: "data:text/html," + escape(testPage),
  });
  await SimpleTest.promiseFocus(browser);

  setClipboardData(CLIPBOARD_TEXT_STRING);

  // Paste into content
  await SpecialPowers.spawn(browser, [], () => {
    content.document.getElementById("input").value = "";
    content.document.getElementById("input").focus();
  });

  // Wait for blocked dialog if applicable
  let blockDialogPromise;
  if (options.shouldShowDialog) {
    blockDialogPromise = BrowserTestUtils.promiseAlertDialogOpen();
  }

  let dialogOpened = false;
  let modalDialogListener = () => {
    dialogOpened = true;
    browser.removeEventListener("DOMWillOpenModalDialog", modalDialogListener);
  };

  browser.addEventListener("DOMWillOpenModalDialog", modalDialogListener);

  await BrowserTestUtils.synthesizeKey("v", { accelKey: true }, browser);
  is(dialogOpened, options.shouldShowDialog, "check if block dialog shown");
  if (options.shouldShowDialog) {
    let win = await blockDialogPromise;
    let body = win.document.getElementById("infoBody").textContent;
    ok(
      body.includes(BASE_DESCRIPTION),
      "block dialog keeps its built-in description"
    );
    if (options.ruleMessage) {
      ok(
        body.includes(options.ruleMessage),
        "block dialog shows the rule's admin message"
      );
      ok(
        body.includes(ADMIN_MESSAGE_LABEL),
        "the admin message is labeled as such"
      );
    } else if (AppConstants.MOZ_ENTERPRISE) {
      ok(
        !body.includes(ADMIN_MESSAGE_LABEL),
        "no admin message section when the rule supplied none"
      );
    }
    let dialog = win.document.querySelector("dialog");
    dialog.getButton("accept").click();
  }
  if (!dialogOpened) {
    browser.removeEventListener("DOMWillOpenModalDialog", modalDialogListener);
  }

  is(
    await getElementValue(browser, "input"),
    options.block ? "" : CLIPBOARD_TEXT_STRING,
    "checking text field contents"
  );

  BrowserTestUtils.removeTab(tab);
}

add_task(async function testBlockedContentShowsBlockDialog() {
  await testBlockDialog({ block: true, shouldShowDialog: true });
});

add_task(async function testBlockedContentWithPrefOffDoesNotShowBlockDialog() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.contentanalysis.show_blocked_result", false]],
  });
  await testBlockDialog({ block: true, shouldShowDialog: false });
  await SpecialPowers.popPrefEnv();
});

add_task(async function testAllowedContentDoesNotShowBlockDialog() {
  await testBlockDialog({ block: false, shouldShowDialog: false });
});

// Only the enterprise-only DataLossPrevention policy supplies a rule message,
// and its label lives in enterprise.ftl.
add_task(
  { skip_if: () => !AppConstants.MOZ_ENTERPRISE },
  async function testBlockDialogShowsRuleMessage() {
    await testBlockDialog({
      block: true,
      shouldShowDialog: true,
      ruleMessage: RULE_MESSAGE,
    });
  }
);
