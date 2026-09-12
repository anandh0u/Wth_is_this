// Read the key from standard input, never from a committed configuration file.
const { app, safeStorage } = require('electron');
const fs = require('fs'); const path = require('path');
app.setName('wth-is-this');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  await app.whenReady();
  try {
    const key = input.trim();
    if (!key || !safeStorage.isEncryptionAvailable()) throw new Error('Secure storage unavailable');
    const directory = app.getPath('userData'); fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'sarvam-key.bin'), safeStorage.encryptString(key));
    const { sarvamDecision } = require('../desktop/ai/lui-engine');
    const result = await sarvamDecision({ kind: 'chat', text: 'Say hello as Lui in one short sentence.' }, { sarvamApiKey: key });
    console.log('Encrypted key saved. Live Sarvam chat:', result.line);
  } catch(error) { console.error(error.message); process.exitCode=1; }
  app.quit();
});
