const DEFAULT_ENDPOINT = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "gemma3:270m";
const SARVAM_ENDPOINT = "https://api.sarvam.ai/v1/chat/completions";
const SARVAM_MODEL = "sarvam-105b-conversations";
const ACTIONS = new Set(["none", "open_meme", "close_active", "void_todo", "pet_visit"]);
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["like", "dislike"] },
    line: { type: "string" },
    action: { type: "string", enum: [...ACTIONS] },
  },
  required: ["verdict", "line", "action"],
};

const SYSTEM_PROMPT = `You are Lui, a petty funny anti-productivity desktop pet.
The line must be a sarcastic reaction under 12 words and must not repeat the user text.
Never target passwords, payments, accounts, meetings, or local development. Choose only a safe action.`;

function simpleHash(text) {
  let hash = 0;
  for (const char of text) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

function sanitizeDecision(input, source = "local") {
  const normalized = Object.fromEntries(
    Object.entries(input || {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const verdict = normalized.verdict === "like" ? "like" : "dislike";
  const line = String(normalized.line || "Lui has formed an opinion and refuses to explain it.")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 90);
  const action = ACTIONS.has(normalized.action) ? normalized.action : "none";
  return { verdict, line, action, source };
}

function restrictDecision(decision, kind) {
  const allowedByKind = {
    todo: new Set(["none", "void_todo"]),
    schedule: new Set(["none"]),
    chat: new Set(["none"]),
    boredom: new Set(["none", "open_meme", "close_active", "pet_visit"]),
    activity: new Set(["none", "open_meme", "close_active", "pet_visit"]),
    manual: ACTIONS,
  };
  const allowed = allowedByKind[kind] || new Set(["none"]);
  return allowed.has(decision.action) ? decision : { ...decision, action: "none" };
}

function aiMessages(context) {
  const history = Array.isArray(context.history) ? context.history.slice(-8) : [];
  return [
    { role: "system", content: `${SYSTEM_PROMPT}\nReply as strict JSON with verdict, line, and action. For chat and schedule, action must be none.` },
    ...history
      .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      .map((item) => ({ role: item.role, content: item.content.slice(0, 500) })),
    { role: "user", content: JSON.stringify({ ...context, history: undefined }) },
  ];
}

function replaceEchoedLine(decision, context) {
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const line = normalize(decision.line);
  const input = normalize(context.text);
  if (!line || (input && (input.includes(line) || line.includes(input)))) {
    return { ...decision, line: fallbackDecision(context).line, source: `${decision.source}+rules` };
  }
  return decision;
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
    : ["open_meme", "pet_visit", "close_active", "none"];
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
        format: RESPONSE_SCHEMA,
        options: { temperature: 0.6, num_predict: 160 },
        messages: aiMessages(context),
      }),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const body = await response.json();
    return sanitizeDecision(parseModelContent(body?.message?.content), `ollama:${model}`);
  } finally {
    clearTimeout(timer);
  }
}

async function sarvamDecision(context, options = {}) {
  const apiKey = options.sarvamApiKey || process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error("Sarvam is not configured");
  const endpoint = options.sarvamEndpoint || process.env.SARVAM_API_URL || SARVAM_ENDPOINT;
  const model = options.sarvamModel || process.env.SARVAM_MODEL || SARVAM_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 8000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "api-subscription-key": apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: context.kind === "chat" ? [
          { role: "system", content: "You are Lui, a funny orange desktop cat. Have a helpful, playful conversation in the user's language, including Malayalam. Keep replies under 100 words. Never claim to have performed actions. You cannot access the computer through chat." },
          ...aiMessages(context).slice(1, -1),
          { role: "user", content: String(context.text || "Hello") },
        ] : aiMessages(context),
        temperature: 0.7,
        max_tokens: 350,
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Sarvam returned ${response.status}`);
    const body = await response.json();
    if (context.kind === "chat") return { verdict: "like", action: "none", line: String(body?.choices?.[0]?.message?.content || "").slice(0, 2000), source: `sarvam:${model}` };
    return sanitizeDecision(parseModelContent(body?.choices?.[0]?.message?.content), `sarvam:${model}`);
  } finally {
    clearTimeout(timer);
  }
}

async function decide(context, options = {}) {
  if (options.localAiEnabled === false) return restrictDecision(fallbackDecision(context), context.kind);
  try {
    const decision = context.kind === "chat" && (process.env.SARVAM_API_KEY || options.sarvamApiKey)
      ? await sarvamDecision(context, options)
      : await localDecision(context, options);
    return restrictDecision(replaceEchoedLine(decision, context), context.kind);
  } catch (error) {
    if (context.kind === "chat") return { verdict: "dislike", action: "none", source: "unavailable", line: `Chat unavailable (${error.name === "AbortError" ? "request timed out" : error.message}). Check AI settings and your connection.` };
    return restrictDecision(fallbackDecision(context), context.kind);
  }
}

async function getStatus(options = {}) {
  if (options.sarvamApiKey || process.env.SARVAM_API_KEY) {
    return {
      available: true,
      running: false,
      configured: true,
      provider: "sarvam",
      model: options.sarvamModel || process.env.SARVAM_MODEL || SARVAM_MODEL,
    };
  }
  const endpoint = options.endpoint || process.env.WTH_OLLAMA_URL || DEFAULT_ENDPOINT;
  const model = options.model || process.env.WTH_OLLAMA_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 1500);
  try {
    const response = await fetch(`${endpoint}/api/tags`, { signal: controller.signal });
    if (!response.ok) throw new Error("offline");
    const body = await response.json();
    const installed = (body.models || []).some((item) => item.name === model || item.model === model);
    return { available: installed, running: true, provider: "ollama", model };
  } catch {
    return { available: false, running: false, provider: "rules", model };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { aiMessages, decide, fallbackDecision, getStatus, localDecision, parseModelContent, replaceEchoedLine, restrictDecision, sanitizeDecision, sarvamDecision };
