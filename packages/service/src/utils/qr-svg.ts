// ─── QR Code SVG ───
// Renders a URL as a crisp, self-contained SVG QR code (byte mode, ECC M,
// 4-module quiet zone). Always dark-on-white — QR codes need a light
// background to scan reliably regardless of UI theme.

import qrcode from "qrcode-generator";

export function qrSvg(text: string, sizePx = 220): string {
  const qr = qrcode(0, "M"); // typeNumber 0 = auto-fit
  qr.addData(text);
  qr.make();

  const modules = qr.getModuleCount();
  const quiet = 4;
  const total = modules + quiet * 2;

  const rects: string[] = [];
  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if (qr.isDark(r, c)) {
        rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="1" height="1"/>`);
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects.join("")}</g>` +
    `</svg>`
  );
}
