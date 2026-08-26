"use strict";

// Enterprise builds hide the FxA menu toolbar button,
// so use the enterprise badge as the overflowed widget there instead.
const OVERFLOW_WIDGET_ID = AppConstants.MOZ_ENTERPRISE
  ? "enterprise-badge-toolbar-button"
  : "fxa-toolbar-menu-button";

var overflowPanel, originalWindowWidth;

add_setup(function () {
  overflowPanel = document.getElementById("widget-overflow");
  originalWindowWidth = ensureToolbarOverflow(window);
});

registerCleanupFunction(function () {
  overflowPanel.removeAttribute("animate");
  window.resizeTo(originalWindowWidth, window.outerHeight);
  let navbar = document.getElementById(CustomizableUI.AREA_NAVBAR);
  return TestUtils.waitForCondition(() => !navbar.hasAttribute("overflowing"));
});

// Right-click on an item within the overflow panel should
// show a context menu with options to move it.
add_task(async function () {
  overflowPanel.setAttribute("animate", "false");
  let overflowWidget = document.getElementById(OVERFLOW_WIDGET_ID);
  ok(overflowWidget, "Overflow widget was found");
  if (!overflowWidget) {
    return;
  }
  // In regular builds the FxA button is hidden while signed out, so sign in to
  // reveal it. The enterprise badge is always visible, so this only applies to
  // the FxA button.
  if (
    OVERFLOW_WIDGET_ID === "fxa-toolbar-menu-button" &&
    BrowserTestUtils.isHidden(overflowWidget)
  ) {
    let initialFxaStatus = document.documentElement.getAttribute("fxastatus");
    document.documentElement.setAttribute("fxastatus", "signed_in");
    registerCleanupFunction(() =>
      document.documentElement.setAttribute("fxastatus", initialFxaStatus)
    );
    ok(
      BrowserTestUtils.isVisible(overflowWidget),
      "Overflow widget is visible"
    );
  }

  let navbar = document.getElementById(CustomizableUI.AREA_NAVBAR);
  ok(
    !navbar.hasAttribute("overflowing"),
    "Should start with a non-overflowing toolbar."
  );
  window.resizeTo(kForceOverflowWidthPx, window.outerHeight);

  await TestUtils.waitForCondition(() => navbar.hasAttribute("overflowing"));
  ok(navbar.hasAttribute("overflowing"), "Should have an overflowing toolbar.");

  let chevron = document.getElementById("nav-bar-overflow-button");
  let shownPanelPromise = promisePanelElementShown(window, overflowPanel);
  chevron.click();
  await shownPanelPromise;

  let contextMenu = document.getElementById(
    "customizationPanelItemContextMenu"
  );
  let shownContextPromise = popupShown(contextMenu);
  is(
    overflowWidget.getAttribute("overflowedItem"),
    "true",
    "Overflow widget is overflowing"
  );
  EventUtils.synthesizeMouseAtCenter(overflowWidget, {
    type: "contextmenu",
    button: 2,
  });
  await shownContextPromise;

  is(
    overflowPanel.state,
    "open",
    "The widget overflow panel should still be open."
  );

  let expectedEntries = [
    [".customize-context-moveToPanel", true],
    [".customize-context-removeFromPanel", true],
    ["---"],
    [".viewCustomizeToolbar", true],
  ];
  checkContextMenu(contextMenu, expectedEntries);

  let hiddenContextPromise = popupHidden(contextMenu);
  let hiddenPromise = promisePanelElementHidden(window, overflowPanel);
  let moveToPanel = contextMenu.querySelector(".customize-context-moveToPanel");
  if (moveToPanel) {
    contextMenu.activateItem(moveToPanel);
  } else {
    contextMenu.hidePopup();
  }
  await hiddenContextPromise;
  await hiddenPromise;

  let overflowWidgetPlacement =
    CustomizableUI.getPlacementOfWidget(OVERFLOW_WIDGET_ID);
  ok(overflowWidgetPlacement, "Overflow widget should still have a placement");
  is(
    overflowWidgetPlacement && overflowWidgetPlacement.area,
    CustomizableUI.AREA_FIXED_OVERFLOW_PANEL,
    "Overflow widget should be pinned now"
  );
  CustomizableUI.reset();
  ensureToolbarOverflow(window, false);

  // In some cases, it can take a tick for the navbar to overflow again. Wait for it:
  await TestUtils.waitForCondition(() =>
    overflowWidget.hasAttribute("overflowedItem")
  );
  ok(navbar.hasAttribute("overflowing"), "Should have an overflowing toolbar.");

  overflowWidgetPlacement =
    CustomizableUI.getPlacementOfWidget(OVERFLOW_WIDGET_ID);
  ok(overflowWidgetPlacement, "Overflow widget should still have a placement");
  is(
    overflowWidgetPlacement && overflowWidgetPlacement.area,
    "nav-bar",
    "Overflow widget should be back in the navbar now"
  );

  is(
    overflowWidget.getAttribute("overflowedItem"),
    "true",
    "Overflow widget should still be overflowed"
  );
});
