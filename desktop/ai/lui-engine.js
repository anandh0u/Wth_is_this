const DEFAULT_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3:1.7b";
const ACTIONS = new Set(["none", "open_meme", "close_active", "void_todo"]);

const SYSTEM_PROMPT = `You are Lui, a cute but petty anti-productivity desktop pet.
Judge the user's activity in one short, funny sentence. You may suggest one harmless action.
Never target passwords, payments, unsaved work, accounts, meetings in progress, or local development.
Return JSON only with keys: verdict (like or dislike), line (maximum 90 characters), action
(none, open_meme, close_active, or void_todo).`;

function simpleHash(text) {
  let hash = 0;
  for (const char of text) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function sanitizeDecision(input, source = "local") {
  const verdict = input?.verdict === "like" ? "like" : "dislike";
  const line = String(input?.line || "Lui has formed an opinion and refuses to explain it.")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 90);
  const action = ACTIONS.has(input?.action) ? input.action : "none";
  return { verdict, line, action, source };
}

function fallbackDecision(context) {
  const text = `${context.kind || "activity"} ${context.text || ""} ${context.tab?.title || ""}`.toLowerCase();
  const protectedWords = ["password", "payment", "checkout", "bank", "meeting", "localhost", "exam"];
  const funWords = ["movie", "music", "meme", "game", "sleep", "food", "youtube"];

  if (protectedWords.some((word) => text.includes(word))) {
    return sanitizeDecision({ verdict: "dislike", line: "I dislike this, but even I have legal boundaries.", action: "none" }, "rules");
  }
  if (funWords.some((word) => text.includes(word))) {
    return sanitizeDecision({ verdict: "like", line: "Finally, a decision with absolutely no professional value.", action: "none" }, "rules");
  }

  const choices = context.kind === "todo"
    ? ["none", "void_todo", "none"]
    : ["open_meme", "none", "close_active", "none"];
  const action = choices[simpleHash(text) % choices.length];
  const lines = [
    "I watched you work. I would like those minutes back.",
    "This tab has the emotional range of a spreadsheet.",
    "Your productivity is making me uncomfortable.",
    "I have reviewed the situation and chosen unnecessary violence.",
  ];
  return sanitizeDecision({ verdict: "dislike", line: lines[simpleHash(`${text}:line`) % lines.length], action }, "rules");
}

function parseModelContent(content) {
  const cleaned = String(content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Local model did not return JSON");
    return JSON.parse(match[0]);
  }
}

async function localDecision(context, options = {}) {
  const endpoint = options.endpoint || process.env.WTH_OLLAMA_URL || DEFAULT_ENDPOINT;
  const model = options.model || process.env.WTH_OLLAMA_MODEL || DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs || 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        options: { temperature: 0.8, num_predict: 100 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(context) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const body = await response.json();
    return sanitizeDecision(parseModelContent(body?.message?.content), `ollama:${model}`);
  } finally {
    clearTimeout(timer);
  }
}

async function decide(context, options = {}) {
  if (options.localAiEnabled === false) return fallbackDecision(context);
  try {
    return await localDecision(context, options);
  } catch {
    return fallbackDecision(context);
  }
}

async function getStatus(options = {}) {
  const endpoint = options.endpoint || process.env.WTH_OLLAMA_URL || DEFAULT_ENDPOINT;
  const model = options.model || process.env.WTH_OLLAMA_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 1500);
  try {
    const response = await fetch(`${endpoint}/api/tags`, { signal: controller.signal });
    if (!response.ok) throw new Error("offline");
    const body = await response.json();
    const installed = (body.models || []).some((item) => item.name === model || item.model === model);
    return { available: installed, running: true, model };
  } catch {
    return { available: false, running: false, model };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { decide, fallbackDecision, getStatus, parseModelContent, sanitizeDecision };
