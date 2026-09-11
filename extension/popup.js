const status = document.querySelector("#status");
const hint = document.querySelector("#hint");
const buttons = [...document.querySelectorAll("[data-action]")];
const HEALTH = "http://127.0.0.1:17381/health";

async function grantLoopbackAccessAndConnect() {
  try {
    const response = await fetch(HEALTH, { cache: "no-store", targetAddressSpace: "local" });
    if (!response.ok) throw new Error("desktop unavailable");
    await chrome.runtime.sendMessage({ type: "bridge_retry" });
    return true;
  } catch {
    return false;
  }
}

async function renderStatus() {
  const stored = await chrome.storage.local.get(["bridgeState", "lastResult"]);
  const connected = stored.bridgeState === "connected";
  status.textContent = connected ? "desktop connected" : "waiting for desktop app";
  status.className = connected ? "connected" : "";
  buttons.forEach((button) => { button.disabled = !connected; });
  hint.textContent = stored.lastResult || (connected ? "Lui has browser privileges." : "Start the WTH desktop app, then reopen this popup.");
}

buttons.forEach((button) => {
  button.addEventListener("click", async () => {
    hint.textContent = "Lui is considering a bad decision…";
    await chrome.runtime.sendMessage({ type: "popup_action", action: button.dataset.action });
    setTimeout(renderStatus, 250);
  });
});

chrome.storage.onChanged.addListener(renderStatus);
grantLoopbackAccessAndConnect().then(async (reachable) => {
  if (!reachable) hint.textContent = "Allow Chrome's local-network prompt and keep the WTH app running.";
  await new Promise((resolve) => setTimeout(resolve, 350));
  renderStatus();
});
