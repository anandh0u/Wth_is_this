/* Prepare the generated sprite atlas for rendering. Flood-fill only neutral
   background pixels connected to a cell border, preserving enclosed eye glints. */
globalThis.loadLuiAtlas = async function loadLuiAtlas(url) {
  const source = new Image(); source.src = url; await source.decode();
  const output = [];
  for (let index = 0; index < 16; index++) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, (index % 4) * source.width / 4, Math.floor(index / 4) * source.height / 4,
      source.width / 4, source.height / 4, 0, 0, 256, 256);
    const pixels = ctx.getImageData(0, 0, 256, 256); const data = pixels.data;
    const seen = new Uint8Array(65536); const queue = [];
    function visit(p) {
      if (p < 0 || p >= 65536 || seen[p]) return;
      seen[p] = 1; const i = p * 4;
      if (Math.max(data[i], data[i+1], data[i+2]) - Math.min(data[i], data[i+1], data[i+2]) > 35 || data[i] < 100) return;
      data[i+3] = 0; queue.push(p);
    }
    for (let x=0; x<256; x++) { visit(x); visit(65280+x); visit(x*256); visit(x*256+255); }
    for (let cursor=0; cursor<queue.length; cursor++) {
      const p=queue[cursor]; if(p%256) visit(p-1); if(p%256<255) visit(p+1); visit(p-256); visit(p+256);
    }
    ctx.putImageData(pixels,0,0);
    // Use one baseline and fixed scale: no per-frame resizing or bouncing.
    output.push(canvas.toDataURL('image/png'));
  }
  return output;
};
