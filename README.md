# WTH Is This? — Lui

An orange desktop cat with an unnecessarily strong opinion about productivity.
Built by Anandhu and Abhijith. Windows desktop app, Chrome companion extension,
and a pixel-art web demo. Version 0.1.3.

## Features

- Desktop walking, sitting, yawning, sleeping and paw reactions.
- Sarvam conversational chat, including Malayalam; chat cannot execute computer commands.
- Optional Ollama personality decisions and offline rules.
- Local todos, notes and events, with reversible void/restore actions.
- Ctrl+1 todos, Ctrl+2 notes, Ctrl+3 calendar; global when Windows permits registration.
- Original-art mood graph driven by simulated pet state, not the user's real emotions.
- Optional idle meme audio and controlled Chrome visits, meme links and guarded tab closing.
- Local-time reminders without a burst of old missed meetings on startup.

## Run

Requires Windows x64. For source builds install Node.js and npm:

```powershell
npm ci
npm start
```

For packaged builds, extract the entire Windows folder ZIP and run `WTH Is This.exe`
inside that folder. Keep its supporting files together. Closing the main window exits Lui.

## Chrome

Open `chrome://extensions`, enable Developer mode, Load unpacked and select `extension`.
Reload the extension after upgrading. Keep the desktop app running, open the extension popup,
and connect. Approve Chrome's local-network permission only if you choose to connect.
The local bridge binds `127.0.0.1:17381`; WebSocket origins must belong to Chrome extensions.
This is a demonstration bridge, not a hardened multi-user service.

## Sarvam

Open **Lui → AI and idle settings**, enter your own key and save. The key is encrypted for your
Windows account outside the app package and repository. A process `SARVAM_API_KEY` also works.
The model is `sarvam-105b-conversations`. Only chat text and bounded session history go to Sarvam.
Automatic tab/task decisions do not go to Sarvam. Internet, valid credentials and credit are required.
Errors are displayed honestly. No model was fine-tuned: prompts, constrained actions and an animation
state machine control Lui. Optional local decisions use `ollama pull gemma3:270m`.

## Memes and demo

First test **Lui → Play local meme audio** and check Windows volume.
In AI and idle settings enable idle memes and set a delay of 10–3600 seconds.
Use 10 seconds for a demo, then stop keyboard/mouse input. Local playback has a two-minute cooldown.
Set the delay shorter than Windows' display-off timeout. Lui detects inactivity, not sleep;
it cannot play while Windows is suspended and does not override power settings.
Browser sleep pranks additionally require browser chaos and have a ten-minute cooldown.
Ctrl+D runs the short browser/audio demo. Stop being sentient cancels pending demo actions.

## Safety and limitations

Automatic pranks are opt-in. The extension avoids pinned, internal, account/payment/login and
local-development pages, edited forms, password fields, frames and content-editable pages.
Undo reopens the last closed URL, not unsaved page state. Use demonstration tabs, not important work.
The paw animation is visual; Chrome APIs perform tab actions. A webpage cannot reach the native tab strip.

The executable is **unsigned**. SmartScreen reputation warnings differ from Defender malware detections.
Do not disable antivirus or add exclusions. If Defender identifies a threat, stop and retain the exact
detection name for investigation. Acceptance by every antivirus engine is not guaranteed.

## Verification

```powershell
npm run check
npm test
npm audit --omit=dev
npm run dist:win
```

Tests cover action restrictions, chat failures/history, reminder boundaries and idle cooldown/lock behavior.
They do not certify all UI, Chrome versions, displays or antivirus engines.
`desktop/` contains Electron and widgets; `extension/` contains Chrome integration; `public/` is original
page artwork; `assets/pet/` contains sprites. The public web demo is separate from desktop capabilities.

## Demo video

Video link will be added after recording.

## Art

Lui-land artwork is preserved. The built-in image tool generated `assets/pet/lui-atlas-v3.png` from the
existing orange/brown cat reference. Prompt: uniform 4×4 atlas, eight natural walking phases, seated,
closed-eye, yawning, sleeping, paw lift/reach, happy and curious poses; consistent pixel size, fixed
baseline, no text or scenery. Runtime background removal cleans connected neutral checkerboard pixels.
