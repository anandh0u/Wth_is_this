const status = document.querySelector("#status");
const hint = document.querySelector("#hint");
const buttons = [...document.querySelectorAll("[data-action]")];

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
renderStatus();
