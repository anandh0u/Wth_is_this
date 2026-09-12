const panel = document.body.dataset.panel;
const container = document.querySelector("#items");

function makeButton(label, action) {
  const button = document.createElement("button");
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

function draw(items) {
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Lui sees nothing worth judging yet.";
    container.replaceChildren(empty);
    return;
  }
  container.replaceChildren(...items.map((item) => {
    const card = document.createElement("article");
    card.className = `item ${item.status || ""}`;
    const text = document.createElement("div");
    text.textContent = item.title || item.text;
    card.append(text);
    if (panel === "calendar") {
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = `${new Date(item.startsAt).toLocaleString()} · Lui: ${item.luiVerdict}`;
      card.append(meta, makeButton(item.status === "void" ? "Restore" : "Send to void", async () => draw(await window.wth.voidEvent(item.id))));
    } else if (panel === "todos") {
      card.append(makeButton(item.status === "void" ? "Restore" : "Send to void", async () => draw((await window.wth.voidTodo(item.id)).todos)));
    } else {
      const meta = document.createElement("p");
      meta.className = "meta";
      meta.textContent = new Date(item.createdAt).toLocaleString();
      card.append(meta, makeButton(item.status === "void" ? "Restore" : "Send to void", async () => draw(await window.wth.deleteNote(item.id))));
    }
    return card;
  }));
}

document.querySelector("#item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (panel === "todos") {
    const input = document.querySelector("#text");
    draw((await window.wth.addTodo(input.value)).todos);
    input.value = "";
  } else if (panel === "notes") {
    const input = document.querySelector("#text");
    draw(await window.wth.addNote(input.value));
    input.value = "";
  } else {
    draw(await window.wth.addEvent({
      title: document.querySelector("#title").value,
      startsAt: document.querySelector("#starts-at").value,
      luiVerdict: document.querySelector("#verdict").value,
    }));
    event.target.reset();
  }
});

window.wth.listData(panel === "calendar" ? "events" : panel).then(draw);
window.wth.onState((state) => draw(state[panel === "calendar" ? "events" : panel] || []));
