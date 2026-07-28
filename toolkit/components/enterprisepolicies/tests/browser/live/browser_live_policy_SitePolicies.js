/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Extract the site URI (scheme + eTLD+1) that SitePolicies match patterns are
// keyed on.
function siteURI(url) {
  let uri = Services.io.newURI(url);
  return Services.io.newURI(
    Services.scriptSecurityManager.createContentPrincipal(uri, {})
      .siteOriginNoSuffix
  );
}

function assertJitAllowed(url, isAllowed) {
  Assert.equal(
    Services.policies.isAllowedForURI("jit", siteURI(url)),
    isAllowed,
    `JIT should be ${isAllowed ? "allowed" : "disallowed"} for ${url}`
  );
}

function assertHasSitePolicy(url, expected) {
  Assert.equal(
    Services.policies.hasSitePoliciesForURI(Services.io.newURI(url)),
    expected,
    `hasSitePoliciesForURI should return ${expected} for ${url}`
  );
}

function assertSharedDataSitePolicyCount(expected) {
  let shared = Services.ppmm.sharedData.get("EnterprisePolicies:SitePolicies");
  Assert.equal(
    shared?.length ?? 0,
    expected,
    `Expected ${expected} site policies in the shared data sent to content`
  );
}

function assertNoSitePolicies() {
  assertHasSitePolicy("https://example.com/", false);
  assertHasSitePolicy("https://example.org/", false);
  assertJitAllowed("https://example.com/", true);
  assertJitAllowed("https://example.org/", true);
  assertSharedDataSitePolicyCount(0);
}

add_task(async function test_apply_then_remove_sitepolicies() {
  assertNoSitePolicies();

  info("Applying SitePolicies remotely.");
  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    {
      policies: {
        SitePolicies: [
          {
            Match: ["*.example.com"],
            Policies: { DisableJit: true },
          },
        ],
      },
    },
    null
  );

  assertHasSitePolicy("https://example.com/", true);
  assertHasSitePolicy("https://example.org/", false);
  assertJitAllowed("https://example.com/", false);
  assertJitAllowed("https://example.org/", true);
  assertSharedDataSitePolicyCount(1);

  info("Removing SitePolicies.");
  let updateApplied = EnterprisePolicyTesting.awaitNextPolicyUpdate();
  EnterprisePolicyTesting.stubRemotePolicies({ policies: {} });
  await updateApplied;

  // onRemove must reset both the parent's internal state and
  // the shared data snapshot read by content processes.
  assertNoSitePolicies();
});

add_task(async function test_apply_then_update_sitepolicies() {
  assertNoSitePolicies();

  info("Applying SitePolicies matching example.com.");
  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    {
      policies: {
        SitePolicies: [
          {
            Match: ["*.example.com"],
            Policies: { DisableJit: true },
          },
        ],
      },
    },
    null
  );

  assertJitAllowed("https://example.com/", false);
  assertJitAllowed("https://example.org/", true);
  assertSharedDataSitePolicyCount(1);

  info("Updating SitePolicies to match example.org instead.");
  let updateApplied = EnterprisePolicyTesting.awaitNextPolicyUpdate();
  EnterprisePolicyTesting.stubRemotePolicies({
    policies: {
      SitePolicies: [
        {
          Match: ["*.example.org"],
          Policies: { DisableJit: true },
        },
      ],
    },
  });
  await updateApplied;

  assertHasSitePolicy("https://example.com/", false);
  assertHasSitePolicy("https://example.org/", true);
  assertJitAllowed("https://example.com/", true);
  assertJitAllowed("https://example.org/", false);
  assertSharedDataSitePolicyCount(1);

  info("Removing SitePolicies.");
  updateApplied = EnterprisePolicyTesting.awaitNextPolicyUpdate();
  EnterprisePolicyTesting.stubRemotePolicies({ policies: {} });
  await updateApplied;

  assertNoSitePolicies();
});

add_task(async function test_live_update_exceptions() {
  assertNoSitePolicies();

  info("Applying an Exceptions-based SitePolicies remotely.");
  await EnterprisePolicyTesting.setupEngineWithRemotePolicies(
    {
      policies: {
        SitePolicies: [
          {
            Exceptions: ["*.example.com"],
            Policies: { DisableJit: true },
          },
        ],
      },
    },
    null
  );

  assertSharedDataSitePolicyCount(1);
  assertJitAllowed("https://example.com/", true);

  info("Updating the exception to example.org so the diff re-applies it.");
  let updateApplied = EnterprisePolicyTesting.awaitNextPolicyUpdate();
  EnterprisePolicyTesting.stubRemotePolicies({
    policies: {
      SitePolicies: [
        {
          Exceptions: ["*.example.org"],
          Policies: { DisableJit: true },
        },
      ],
    },
  });
  await updateApplied;

  assertSharedDataSitePolicyCount(1);
  assertJitAllowed("https://example.com/", false);
  assertJitAllowed("https://example.org/", true);

  info("Removing SitePolicies.");
  updateApplied = EnterprisePolicyTesting.awaitNextPolicyUpdate();
  EnterprisePolicyTesting.stubRemotePolicies({ policies: {} });
  await updateApplied;

  assertNoSitePolicies();
});
