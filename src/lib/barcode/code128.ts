/**
 * Code 128 (set B) barcodes as SVG — pure, no dependencies, so labels print
 * on a computer with no internet. Set B covers printable ASCII (codes,
 * batch and serial numbers); anything outside it is refused (null).
 *
 * Each symbol is six alternating bar/space widths (in modules) summing to
 * 11; the stop symbol has seven, summing to 13. A 10-module quiet zone is
 * kept on both sides.
 */

export const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START_B = 104;
const STOP = 106;

/** The symbol values for `text` in set B, with the start, check and stop symbols; null if a character is outside set B. */
export function encode128B(text: string): number[] | null {
  if (!text) return null;
  const values: number[] = [];
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126 || ch.length !== 1) return null;
    values.push(c - 32);
  }
  const check = values.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
  return [START_B, ...values, check, STOP];
}

/** Bar positions in modules: [x, width] for each black bar, and the total width including quiet zones. */
export function bars(text: string): { bars: [number, number][]; width: number } | null {
  const symbols = encode128B(text);
  if (!symbols) return null;
  const out: [number, number][] = [];
  let x = 10; // quiet zone
  for (const s of symbols) {
    const p = PATTERNS[s];
    for (let i = 0; i < p.length; i++) {
      const w = +p[i];
      if (i % 2 === 0) out.push([x, w]);
      x += w;
    }
  }
  return { bars: out, width: x + 10 };
}

/** An SVG barcode, `height` modules tall; null if the text cannot be encoded. */
export function barcodeSvg(text: string, height = 40): string | null {
  const b = bars(text);
  if (!b) return null;
  const rects = b.bars.map(([x, w]) => `<rect x="${x}" y="0" width="${w}" height="${height}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b.width} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000">${rects}</svg>`;
}
