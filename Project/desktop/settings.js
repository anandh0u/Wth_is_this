window.wth.getState().then((state) => {
  document.querySelector('#idle').value = state.settings.idleMemeSeconds || 60;
  document.querySelector('#pranks').checked = state.settings.sleepPranksEnabled;
});
document.querySelector('#settings').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.querySelector('#status');
  try {
    await window.wth.configure({ apiKey: document.querySelector('#key').value.trim(),
      idleSeconds: Number(document.querySelector('#idle').value), pranks: document.querySelector('#pranks').checked });
    document.querySelector('#key').value = '';
    status.textContent = 'Saved. You can test chat and local meme audio from Lui.';
  } catch { status.textContent = 'Settings could not be saved securely.'; }
});
