const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
function dpapi(mode, input) {
  const prefix = '[void][System.Reflection.Assembly]::LoadWithPartialName("System.Security"); $s=[Console]::In.ReadToEnd(); ';
  const script = prefix + (mode === 'encrypt'
    ? '[Console]::Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($s),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'
    : '[Console]::Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($s.Trim()),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))');
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
    { input, encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['pipe','pipe','pipe'] }).trim();
}
function saveKey(directory, key) { fs.mkdirSync(directory,{recursive:true}); fs.writeFileSync(path.join(directory,'sarvam-key.dpapi'),dpapi('encrypt',key)); }
function readKey(directory) { try { return dpapi('decrypt',fs.readFileSync(path.join(directory,'sarvam-key.dpapi'),'utf8')); } catch { return ''; } }
module.exports = { saveKey, readKey };
