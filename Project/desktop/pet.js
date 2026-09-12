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
  sit: ["expression-01"],
  sleep: ["reaction-02"],
  yawn: ["expression-01", "reaction-01", "reaction-01", "expression-01"],
  peek: ["expression-04"],
};

let bubbleTimer;
let mode = "walk";
let frameIndex = 0;
let modeUntil = 0;
let walkingEnabled = true;
let lastLine = "";
let atlas = null;
const atlasFrames = { walk: [0,1,2,3,4,5,6,7], idle:[8,9,8], sit:[8], sleep:[11], yawn:[8,10,10,8],
  swipe:[12,13,13,12], wave:[12,13,12], happy:[14], talk:[8,14], peek:[15] };
loadLuiAtlas('../assets/pet/lui-atlas-v3.png').then((images) => { atlas = images; restoreMovement(); });
for (const name of new Set(Object.values(frames).flat())) {
  const image = new Image();
  image.src = framePath(name);
}

function framePath(name) {
  return `../assets/pet/lui-v2-${name}.png`;
}

function chooseMode(nextMode, duration = 0) {
  if (!frames[nextMode]) return;
  mode = nextMode;
  frameIndex = 0;
  modeUntil = duration ? Date.now() + duration : 0;
  lui.classList.toggle("acting", nextMode !== "walk" && nextMode !== "idle");
  lui.dataset.mode = nextMode;
  frame.src = atlas ? atlas[atlasFrames[mode][0]] : framePath(frames[mode][frameIndex]);
}

function restoreMovement() {
  chooseMode(walkingEnabled ? "walk" : "idle");
}

setInterval(() => {
  if (modeUntil && Date.now() >= modeUntil) restoreMovement();
  const sequence = atlas ? atlasFrames[mode] : frames[mode];
  frameIndex = (frameIndex + 1) % sequence.length;
  frame.src = atlas ? atlas[sequence[frameIndex]] : framePath(sequence[frameIndex]);
}, 115);

lui.addEventListener("click", () => window.wth.petClick());
window.wth.onDirection((direction) => lui.classList.toggle("left", direction < 0));
window.wth.onPetLift((lift) => lui.style.setProperty("--lui-lift", String(Math.max(0, Math.min(124, lift)))));
window.wth.onPetAnimation((name) => {
  const durations = { swipe: 900, wave: 900, happy: 900, sit: 4000, sleep: 8000, yawn: 1800, peek: 2500 };
  chooseMode(name, durations[name] || 450);
});
window.wth.onState((state) => {
  lui.classList.remove("neutral", "annoyed", "chaotic");
  lui.classList.add(state.mood);
  walkingEnabled = state.settings?.petWalkingEnabled !== false;
  if (!modeUntil) restoreMovement();
  if (!state.petLine || state.petLine === lastLine) return;
  lastLine = state.petLine;
  bubble.textContent = state.petLine;
  lui.classList.add("talking");
  const actionIsPlaying = modeUntil > Date.now() && ["swipe", "wave", "happy"].includes(mode);
  // Speech is an overlay; it must not reset or slide the walking cycle.
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => lui.classList.remove("talking"), 4500);
});
