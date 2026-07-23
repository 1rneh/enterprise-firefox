/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// Verifies the DataLossPrevention policy and its arbitration with the external
// ContentAnalysis policy, as implemented by reconcileContentAnalysis in
// Policies.sys.mjs. Assertions are on the browser.contentanalysis.* prefs the
// handler sets; the built-in WASM backend consumes them.

const CA_PREFIX = "browser.contentanalysis.";

const INTERCEPTION_POINTS = [
  "clipboard",
  "download",
  "drag_and_drop",
  "file_upload",
  "print",
];

function getSerializedRules() {
  let json = Services.prefs.getStringPref(CA_PREFIX + "dlp_rules", "");
  return json ? JSON.parse(json).DLPRules.Rules : [];
}

registerCleanupFunction(async function () {
  await setupPolicyEngineWithJson({ policies: {} });
});

add_task(async function test_builtin_dlp_only() {
  await setupPolicyEngineWithJson({
    policies: {
      DataLossPrevention: {
        FallbackResult: "block",
        Rules: [
          {
            Name: "warn-ai-paste",
            Enabled: true,
            Actions: ["TextPaste"],
            Domains: ["chatgpt.com"],
            Type: "warn",
          },
        ],
      },
    },
  });

  is(Services.prefs.getBoolPref(CA_PREFIX + "enabled"), true, "CA enabled");
  is(
    Services.prefs.getBoolPref(CA_PREFIX + "use_wasm_backend"),
    true,
    "built-in WASM backend selected"
  );
  is(
    Services.prefs.getStringPref(CA_PREFIX + "agent_name", ""),
    "Firefox Enterprise DLP Engine",
    "built-in agent name set"
  );
  // FallbackResult "block" maps to the numeric result 0.
  is(
    Services.prefs.getIntPref(CA_PREFIX + "default_result"),
    0,
    "default_result"
  );
  is(
    Services.prefs.getIntPref(CA_PREFIX + "timeout_result"),
    0,
    "timeout_result"
  );

  // TextPaste derives clipboard + drag_and_drop; the rest are off.
  let expectedOn = new Set(["clipboard", "drag_and_drop"]);
  for (let point of INTERCEPTION_POINTS) {
    is(
      Services.prefs.getBoolPref(
        `${CA_PREFIX}interception_point.${point}.enabled`
      ),
      expectedOn.has(point),
      `interception_point.${point}.enabled`
    );
  }

  let rules = getSerializedRules();
  is(rules.length, 1, "one rule serialized to dlp_rules");
  is(rules[0].Name, "warn-ai-paste", "correct rule serialized");
});

add_task(async function test_builtin_active_when_external_disabled() {
  await setupPolicyEngineWithJson({
    policies: {
      ContentAnalysis: { Enabled: false },
      DataLossPrevention: {
        Rules: [
          {
            Name: "block-upload",
            Enabled: true,
            Actions: ["FileUpload"],
            Domains: ["dropbox.com"],
            Type: "block",
          },
        ],
      },
    },
  });

  is(
    Services.prefs.getBoolPref(CA_PREFIX + "use_wasm_backend"),
    true,
    "built-in backend runs when ContentAnalysis is present but disabled"
  );
  let rules = getSerializedRules();
  is(rules.length, 1, "built-in rule delivered");
  is(rules[0].Name, "block-upload", "correct rule");
});

add_task(async function test_invalid_regex_rule_excluded() {
  await setupPolicyEngineWithJson({
    policies: {
      DataLossPrevention: {
        Rules: [
          {
            Name: "bad-pattern",
            Enabled: true,
            Actions: ["FileUpload"],
            Domains: ["*"],
            ContentPatterns: ["("],
            Type: "block",
          },
          {
            Name: "good-pattern",
            Enabled: true,
            Actions: ["FileUpload"],
            Domains: ["*"],
            ContentPatterns: ["secret"],
            Type: "block",
          },
        ],
      },
    },
  });

  let rules = getSerializedRules();
  is(rules.length, 1, "rule with an invalid ContentPatterns regex is excluded");
  is(rules[0].Name, "good-pattern", "the valid rule survives");
});
