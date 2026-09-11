const elements = {
  connection: document.querySelector("#connection"),
  mood: document.querySelector("#mood"),
  boredom: document.querySelector("#boredom"),
  boredomBar: document.querySelector("#boredom-bar"),
  pet: document.querySelector("#pet"),
  petLine: document.querySelector("#pet-line"),
  todos: document.querySelector("#todos"),
  currentTab: document.querySelector("#current-tab"),
  eventLog: document.querySelector("#event-log"),
};

const lines = {
  neutral: "I am observing your questionable decisions.",
  annoyed: "Could you become interesting soon?",
  chaotic: "Fine. I will entertain myself.",
};

function render(state) {
  elements.connection.textContent = state.connection;
  elements.connection.className = `connection ${state.connection}`;
  elements.mood.textContent = state.mood;
  elements.boredom.textContent = state.boredom;
  elements.boredomBar.style.width = `${state.boredom}%`;
  elements.pet.className = `pet ${state.mood}`;
  elements.petLine.textContent = lines[state.mood];
  elements.currentTab.textContent = state.currentTab?.title || "nothing yet";

  elements.todos.replaceChildren(...state.todos.map((todo) => {
    const li = document.createElement("li");
    li.className = todo.status;
    const button = document.createElement("button");
    button.textContent = todo.status === "void" ? "restore" : "send to void";
    button.addEventListener("click", () => window.wth.voidTodo(todo.id));
    li.append(document.createTextNode(`${todo.text} `), button);
    return li;
  }));

  elements.eventLog.replaceChildren(...state.eventLog.map((message) => {
    const li = document.createElement("li");
    li.textContent = message;
    return li;
  }));
}

document.querySelector("#todo-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#todo-input");
  await window.wth.addTodo(input.value);
  input.value = "";
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => window.wth.browserAction(button.dataset.action));
});

window.wth.onState(render);
window.wth.getState().then(render);
