const lui = document.querySelector("#lui");
const bubble = document.querySelector("#bubble");
let bubbleTimer;

lui.addEventListener("click", () => window.wth.petClick());
window.wth.onDirection((direction) => lui.classList.toggle("left", direction < 0));
window.wth.onState((state) => {
  lui.classList.remove("neutral", "annoyed", "chaotic");
  lui.classList.add(state.mood);
  if (!state.petLine) return;
  bubble.textContent = state.petLine;
  lui.classList.add("talking");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => lui.classList.remove("talking"), 4500);
});
