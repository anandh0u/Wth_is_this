const initialValues = new WeakMap();

document.querySelectorAll("input, textarea, select").forEach((element) => {
  initialValues.set(element, {
    value: element.value,
    checked: "checked" in element ? element.checked : undefined,
  });
});

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type !== "page_state") return;
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
});
