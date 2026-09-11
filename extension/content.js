const initialValues = new WeakMap();

document.querySelectorAll("input, textarea, select").forEach((element) => {
  initialValues.set(element, {
    value: element.value,
    checked: "checked" in element ? element.checked : undefined,
  });
});

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "page_state") {
    const fields = [...document.querySelectorAll("input, textarea, select")];
    const editedForm = fields.some((field) => {
      if (field.type === "password") return true;
      const initial = initialValues.get(field) || { value: field.defaultValue, checked: field.defaultChecked };
      if (field instanceof HTMLInputElement && ["checkbox", "radio"].includes(field.type)) {
        return field.checked !== initial.checked;
      }
      return field.value !== initial.value;
    });
    respond({ editedForm });
    return;
  }

  if (message.type === "pet_visit") {
    document.querySelector("#wth-lui-browser-visit")?.remove();
    const host = document.createElement("div");
    host.id = "wth-lui-browser-visit";
    Object.assign(host.style, {
      all: "initial",
      position: "fixed",
      zIndex: "2147483647",
      left: "-190px",
      bottom: "18px",
      width: "170px",
      height: "190px",
      pointerEvents: "none",
      transition: "transform 6s linear",
    });
    const shadow = host.attachShadow({ mode: "closed" });
    const bubble = document.createElement("div");
    bubble.textContent = String(message.line || "This page looked unsupervised.").slice(0, 90);
    Object.assign(bubble.style, {
      padding: "7px 9px",
      border: "2px solid #17161b",
      borderRadius: "10px",
      background: "#fff9e9",
      color: "#17161b",
      font: "700 11px/1.2 system-ui",
      textAlign: "center",
    });
    const image = document.createElement("img");
    image.src = message.imageUrl;
    Object.assign(image.style, {
      display: "block",
      width: "130px",
      height: "130px",
      margin: "4px auto 0",
      objectFit: "contain",
      filter: "drop-shadow(0 5px 4px #0008)",
    });
    shadow.append(bubble, image);
    document.documentElement.append(host);
    image.animate([
      { transform: "translateY(0) rotate(-2deg) scaleY(1)" },
      { transform: "translateY(-7px) rotate(2deg) scaleY(.97)" },
      { transform: "translateY(-1px) rotate(2deg) scaleY(1.03)" },
      { transform: "translateY(-7px) rotate(-2deg) scaleY(.97)" },
      { transform: "translateY(0) rotate(-2deg) scaleY(1)" },
    ], { duration: 520, iterations: Infinity, easing: "ease-in-out" });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      host.style.transform = `translateX(${window.innerWidth + 380}px)`;
    }));
    setTimeout(() => host.remove(), 6500);
    respond({ shown: true });
  }
});
