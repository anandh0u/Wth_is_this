# WTH Is This — development checkpoint

Pet name: **Lui**

## Ownership boundary

- Mani: root website, visual app design, pet design/assets.
- Behavior/integration: Electron runtime, local data, reminders, browser extension,
  controlled chaos, audio/AI integrations.
- The root `index.html` is intentionally untouched.

## Run locally

```powershell
npm install
npm start
```

The application menu provides temporary access to the functional modules:

- `Ctrl+1`: todos
- `Ctrl+2`: notes
- `Ctrl+3`: calendar
- `Lui`: behavior and safety switches

## Load the Chrome extension

1. Navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this repository's `extension` directory.
5. Keep the desktop app running; its connection label changes to `connected`.

The extension talks only to `ws://127.0.0.1:17381`.

## Current safety defaults

- Manual meme and tab-prank buttons work when the extension is connected.
- Automatic browser chaos is off by default.
- Sleep pranks are off by default.
- Enabling both switches lets Lui open one of the approved videos after Chrome
  reports the user idle, with a ten-minute cooldown.
- Pinned, internal, account, localhost, and edited-form tabs cannot be closed.
- The last prank-closed tab can be restored.
- Calendar/todo items sent to the void remain recoverable.

## Approved automatic video targets

- <https://youtu.be/XqZsoesa55w?si=6oJfXHm_esOwN4fl>
- <https://youtu.be/dxo23k5voiE?si=afoFkCiKQBzd2rUp>

## Next integration inputs

- Copy short audio files into `assets/memes/` after they are selected.
- Mani can replace the temporary generated icon and provide Lui's mood-state
  assets without changing the behavior APIs exposed from `desktop/preload.js`.

## Local AI (no training required)

Lui uses deterministic rules until Ollama and the configured model are available.
When available, the app asks the local model for a restricted JSON verdict; the
application—not the model—enforces the allowed action list and safety gates.

```powershell
ollama pull qwen3:1.7b
npm start
```

Optional environment overrides:

```powershell
$env:WTH_OLLAMA_MODEL = 'qwen3:1.7b'
$env:WTH_OLLAMA_URL = 'http://127.0.0.1:11434'
```
