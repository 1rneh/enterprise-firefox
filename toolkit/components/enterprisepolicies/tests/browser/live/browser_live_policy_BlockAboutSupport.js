/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ABOUT_SUPPORT_PAGE = "about:support";

function checkAboutSupportState(blocked) {
  Assert.equal(
    Services.policies.isAllowed("aboutSupport"),
    !blocked,
    `aboutSupport feature is ${blocked ? "disallowed" : "allowed"}`
  );
}

// Driving BlockAboutSupport through its full lifecycle live
add_task(async function test_block_about_support_live_lifecycle() {
  info("Starting with no policies");
  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    { policies: {} },
    null
  );
  await EnterprisePolicyTesting.checkBlockedPage(ABOUT_SUPPORT_PAGE, false);
  checkAboutSupportState(false);

  info("Applying BlockAboutSupport: true");
  await waitForLivePolicyUpdate({ BlockAboutSupport: true });
  await EnterprisePolicyTesting.checkBlockedPage(ABOUT_SUPPORT_PAGE, true);
  checkAboutSupportState(true);

  info("Live-updating BlockAboutSupport to false");
  await waitForLivePolicyUpdate({ BlockAboutSupport: false });
  await EnterprisePolicyTesting.checkBlockedPage(ABOUT_SUPPORT_PAGE, false);
  checkAboutSupportState(false);

  info("Removing BlockAboutSupport");
  await waitForLivePolicyUpdate({});
  await EnterprisePolicyTesting.checkBlockedPage(ABOUT_SUPPORT_PAGE, false);
  checkAboutSupportState(false);
});
