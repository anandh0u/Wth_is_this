const lui = document.querySelector("#lui");
const bubble = document.querySelector("#bubble");
const frame = document.querySelector("#lui-frame");

const frames = {
  idle: ["idle-01", "idle-02", "idle-03", "idle-04", "idle-05"],
  walk: ["walk-right-01", "walk-right-02", "walk-right-03", "walk-right-04", "walk-right-05"],
  swipe: ["action-02", "action-03", "action-04", "action-05", "action-03"],
  wave: ["action-01", "action-02", "action-03", "action-04"],
  happy: ["reaction-04", "reaction-04", "expression-03", "reaction-04"],
  talk: ["expression-01", "expression-02", "expression-03", "expression-02"],
};

let bubbleTimer;
let mode = "walk";
let frameIndex = 0;
let modeUntil = 0;
let walkingEnabled = true;

function framePath(name) {
  return `../assets/pet/lui-v2-${name}.png`;
}

function chooseMode(nextMode, duration = 0) {
  if (!frames[nextMode]) return;
  mode = nextMode;
  frameIndex = 0;
  modeUntil = duration ? Date.now() + duration : 0;
  lui.classList.toggle("acting", nextMode !== "walk" && nextMode !== "idle");
  frame.src = framePath(frames[mode][frameIndex]);
}

function restoreMovement() {
  chooseMode(walkingEnabled ? "walk" : "idle");
}

setInterval(() => {
  if (modeUntil && Date.now() >= modeUntil) restoreMovement();
  const sequence = frames[mode];
  frameIndex = (frameIndex + 1) % sequence.length;
  frame.src = framePath(sequence[frameIndex]);
}, 115);

lui.addEventListener("click", () => window.wth.petClick());
window.wth.onDirection((direction) => lui.classList.toggle("left", direction < 0));
window.wth.onPetAnimation((name) => {
  const durations = { swipe: 600, wave: 480, happy: 550 };
  chooseMode(name, durations[name] || 450);
});
window.wth.onState((state) => {
  lui.classList.remove("neutral", "annoyed", "chaotic");
  lui.classList.add(state.mood);
  walkingEnabled = state.settings?.petWalkingEnabled !== false;
  if (!state.petLine) return;
  bubble.textContent = state.petLine;
  lui.classList.add("talking");
  const actionIsPlaying = modeUntil > Date.now() && ["swipe", "wave", "happy"].includes(mode);
  if (!actionIsPlaying) chooseMode("talk", 4500);
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => lui.classList.remove("talking"), 4500);
});
