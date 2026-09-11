const test = require("node:test");
const assert = require("node:assert/strict");
const { fallbackDecision, parseModelContent, sanitizeDecision } = require("../desktop/ai/lui-engine");

test("fallback protects sensitive tasks", () => {
  const result = fallbackDecision({ kind: "todo", text: "Pay bank bill" });
  assert.equal(result.action, "none");
  assert.equal(result.source, "rules");
});

test("model JSON is extracted after thinking text", () => {
  const result = parseModelContent('<think>private</think>{"verdict":"like","line":"fine","action":"none"}');
  assert.equal(result.verdict, "like");
});

test("unknown actions are rejected", () => {
  const result = sanitizeDecision({ verdict: "dislike", line: "x", action: "delete_everything" });
  assert.equal(result.action, "none");
});
