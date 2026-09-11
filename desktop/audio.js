const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const SUPPORTED = new Set([".mp3", ".wav", ".ogg", ".m4a"]);

function listAudio(assetRoot) {
  const directory = path.join(assetRoot, "memes");
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && SUPPORTED.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(directory, entry.name));
  } catch {
    return [];
  }
}

function randomAudioUrl(assetRoot, random = Math.random) {
  const files = listAudio(assetRoot);
  if (!files.length) return null;
  return pathToFileURL(files[Math.floor(random() * files.length)]).href;
}

module.exports = { listAudio, randomAudioUrl };
