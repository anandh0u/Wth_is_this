const test = require("node:test");
const assert = require("node:assert/strict");
const { fallbackDecision, parseModelContent, replaceEchoedLine, restrictDecision, sanitizeDecision } = require("../desktop/ai/lui-engine");

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

test("small-model uppercase JSON keys are normalized", () => {
  const result = sanitizeDecision({ Verdict: "like", Line: "Fine.", Action: "open_meme" }, "ollama:test");
  assert.deepEqual(result, { verdict: "like", line: "Fine.", action: "open_meme", source: "ollama:test" });
});

test("todo verdict cannot close a browser tab", () => {
  const result = restrictDecision({ verdict: "dislike", line: "No.", action: "close_active", source: "test" }, "todo");
  assert.equal(result.action, "none");
});

test("echoed model lines are replaced by a joke", () => {
  const result = replaceEchoedLine({ verdict: "like", line: "Watch a movie", action: "none", source: "ollama:test" }, { kind: "todo", text: "Watch a movie" });
  assert.notEqual(result.line, "Watch a movie");
  assert.equal(result.source, "ollama:test+rules");
});
