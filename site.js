(() => {
  "use strict";

  const demoUrl =
    "https://github.com/anandh0u/Wth_is_this/releases/download/v0.1.2/WTH-Is-This-0.1.2-demo.zip";
  const cta = document.querySelector("#runawayCta");
  const zone = document.querySelector(".cta-zone");
  const lui = document.querySelector("#luiDownload");
  const hint = document.querySelector("#downloadHint");

  if (!cta || !zone || !lui || !hint) return;

  cta.href = demoUrl;
  lui.href = demoUrl;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let dodges = 0;
  let previousX = 0;
  let previousY = 0;
  let hintTimer;

  function showHint(message) {
    window.clearTimeout(hintTimer);
    hint.textContent = message;
    hint.classList.add("is-visible");
    hintTimer = window.setTimeout(() => hint.classList.remove("is-visible"), 2200);
  }

  function pickOffset(limit, previous) {
    if (limit <= 0) return 0;

    let next = previous;
    for (let attempt = 0; attempt < 8 && Math.abs(next - previous) < limit * 0.38; attempt += 1) {
      next = Math.round((Math.random() * 2 - 1) * limit);
    }
    return next;
  }

  function dodge() {
    if (reducedMotion.matches) {
      showHint("Motion is off. You may click either Lui or this link.");
      return;
    }

    const zoneBox = zone.getBoundingClientRect();
    const ctaBox = cta.getBoundingClientRect();
    const limitX = Math.max(0, (zoneBox.width - ctaBox.width) / 2 - 8);
    const limitY = Math.max(0, (zoneBox.height - ctaBox.height) / 2 - 8);

    previousX = pickOffset(limitX, previousX);
    previousY = pickOffset(limitY, previousY);
    cta.style.setProperty("--escape-x", `${previousX}px`);
    cta.style.setProperty("--escape-y", `${previousY}px`);
    dodges += 1;

    cta.textContent = dodges > 3 ? "Nope. Click Lui." : "Get Your Lui.";
    showHint(dodges > 3 ? "The cat is the real download button 😼" : "Too slow. Try Lui instead.");
  }

  cta.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") dodge();
  });

  cta.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" && !reducedMotion.matches) {
      event.preventDefault();
      dodge();
    }
  });

  cta.addEventListener("click", (event) => {
    if (event.detail > 0 && !reducedMotion.matches) {
      event.preventDefault();
      dodge();
    }
  });

  lui.addEventListener("click", () => {
    lui.classList.add("is-downloading");
    showHint("Lui acquired. Your productivity is now in danger.");
    window.setTimeout(() => lui.classList.remove("is-downloading"), 800);
  });

  window.addEventListener("resize", () => {
    previousX = 0;
    previousY = 0;
    cta.style.setProperty("--escape-x", "0px");
    cta.style.setProperty("--escape-y", "0px");
  });
})();
