// QR encoder tests. Expected symbols come from an independent encoder (the `qrcode`
// npm package, byte mode, same error-correction level and mask); larger symbols are
// compared by an FNV-1a hash of their modules. Usage: node tests/qr-test.js
"use strict";
require("../qr.js");
const QR = globalThis.StorageFitQR;
let failures = 0, total = 0;
function result(ok, name, detail = "") {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${detail && !ok ? ` — ${detail}` : ""}`);
}
const rows = qr => qr.modules.map(row => row.map(dark => (dark ? 1 : 0)).join(""));
const fnv = qr => {
  let h = 0x811c9dc5;
  for (const row of qr.modules) for (const dark of row) { h ^= dark ? 49 : 48; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
};

const small = QR.encode("Storage Fit", { ecc: "M", mask: 2 });
result(small.version === 1 && small.size === 21 && rows(small).join("\n") === [
  "111111100001001111111", "100000100010101000001", "101110101101001011101", "101110101110101011101",
  "101110101110101011101", "100000101101001000001", "111111101010101111111", "000000001110000000000",
  "101111100001001111100", "110000001101100111111", "000010101100100100110", "010111001101110001111",
  "111101100100100000000", "000000001110110111010", "111111100111001001010", "100000101010010011111",
  "101110101101001001001", "101110101000101110100", "101110101100110000000", "100000100000110001100",
  "111111101011111100010"
].join("\n"), "a short text gives the same version-1 symbol as an independent encoder");

const share = "https://example.com/share.html#p=" + "eyJ2IjoxLCJuIjoiVG9wIGRyYXdlciIsInUiOiJjbSIsImciOiJCZXN0IHVzZSBvZiBzcGFjZSJ9".repeat(12);
const shareQr = QR.encode(share, { ecc: "L", mask: 1 });
result(shareQr.version === 22 && shareQr.size === 105 && fnv(shareQr) === "5af517d0", "a 945-character share link gives the same version-22 symbol, with version information and many alignment patterns", `${shareQr.version} ${fnv(shareQr)}`);

const unicode = QR.encode("Kitchen → Base cabinet → Top drawer", { ecc: "Q", mask: 3 });
result(unicode.version === 4 && fnv(unicode) === "407a8ba6", "non-ASCII text is encoded as UTF-8 bytes, matching the independent encoder", `${unicode.version} ${fnv(unicode)}`);

const largest = QR.encode("x".repeat(2953), { ecc: "L", mask: 0 });
result(largest.version === 40 && largest.size === 177 && fnv(largest) === "187ef879", "the largest byte payload at level L fills a version-40 symbol exactly as the independent encoder does", `${largest.version} ${fnv(largest)}`);
result(QR.encode("x".repeat(2954), { ecc: "L" }) === null, "a payload one byte over the version-40 capacity is refused instead of being cut short");

const auto = QR.encode(share, { ecc: "L" });
const forced = QR.encode(share, { ecc: "L", mask: auto.mask });
result(auto.mask >= 0 && auto.mask < 8 && fnv(auto) === fnv(forced), "an automatically chosen mask produces the same symbol as forcing that mask");
result(QR.encode("Storage Fit").version === 1 && QR.encode("Storage Fit").ecc === "M", "the default error-correction level is M");

const svg = QR.svg(small, { margin: 4, label: 'Plan "A" & <B>' });
const darkCount = small.modules.flat().filter(Boolean).length;
result(/viewBox="0 0 29 29"/.test(svg) && (svg.match(/h1v1h-1z/g) || []).length === darkCount, "the SVG has a four-module quiet zone and one square per dark module", `${(svg.match(/h1v1h-1z/g) || []).length} of ${darkCount}`);
result(svg.includes('aria-label="Plan &quot;A&quot; &amp; &lt;B&gt;"') && !svg.includes('"A"'), "the SVG's accessible label is escaped");

console.log(`QR tests passed: ${total - failures}/${total}`);
process.exit(failures ? 1 : 0);
