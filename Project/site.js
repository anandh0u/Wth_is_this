(() => {
  "use strict";

  const demoUrl =
    "https://github.com/anandh0u/Wth_is_this/releases/download/v0.1.2/WTH-Is-This-0.1.2-demo.zip";
  const artboard = document.querySelector("#artboard");
  const cta = document.querySelector("#runawayCta");
  const lui = document.querySelector("#luiDownload");
  const status = document.querySelector("#interactionStatus");

  if (!artboard || !cta || !lui || !status) return;

  cta.href = demoUrl;
  lui.href = demoUrl;

  let previousX = 0;
  let previousY = 0;
  let dodges = 0;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function chooseDifferent(min, max, previous, minimumDistance) {
    let value = previous;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      value = randomBetween(min, max);
      if (Math.abs(value - previous) >= minimumDistance) break;
    }
    return value;
  }

  function dodge() {
    const boardBox = artboard.getBoundingClientRect();
    const ctaBox = cta.getBoundingClientRect();
    const originalLeft = boardBox.width * 0.614063;
    const originalTop = boardBox.height * 0.764815;
    const minLeft = boardBox.width * 0.52;
    const maxLeft = boardBox.width - ctaBox.width - boardBox.width * 0.025;
    const minTop = boardBox.height * 0.68;
    const maxTop = boardBox.height - ctaBox.height - boardBox.height * 0.035;

    const nextLeft = chooseDifferent(
      minLeft,
      Math.max(minLeft, maxLeft),
      originalLeft + previousX,
      boardBox.width * 0.07,
    );
    const nextTop = chooseDifferent(
      minTop,
      Math.max(minTop, maxTop),
      originalTop + previousY,
      boardBox.height * 0.04,
    );

    previousX = Math.round(nextLeft - originalLeft);
    previousY = Math.round(nextTop - originalTop);
    cta.style.setProperty("--move-x", `${previousX}px`);
    cta.style.setProperty("--move-y", `${previousY}px`);
    dodges += 1;
    status.textContent = dodges > 2 ? "Too slow. Click Lui the cat to download." : "Lui moved the link.";
  }

  cta.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") dodge();
  });

  cta.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") {
      event.preventDefault();
      dodge();
    }
  });

  cta.addEventListener("click", (event) => {
    if (event.detail > 0) {
      event.preventDefault();
      dodge();
    }
  });

  lui.addEventListener("click", () => {
    status.textContent = "Downloading your Lui demo.";
  });

  window.addEventListener("resize", () => {
    previousX = 0;
    previousY = 0;
    cta.style.setProperty("--move-x", "0px");
    cta.style.setProperty("--move-y", "0px");
  });
})();
