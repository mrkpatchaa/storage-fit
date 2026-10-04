// Applies the colour theme before the page paints. "auto" follows the system
// setting; a choice of light or dark is remembered on this device only.
(() => {
const KEY = "storage-fit-theme";
const systemDark = () => !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
function get() {
  try { const mode = localStorage.getItem(KEY); return mode === "light" || mode === "dark" ? mode : "auto"; } catch (e) { return "auto"; }
}
function apply(mode = get()) {
  const theme = mode === "dark" || (mode === "auto" && systemDark()) ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  return theme;
}
function set(mode) {
  const choice = mode === "light" || mode === "dark" ? mode : "auto";
  try { if (choice === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch (e) {}
  return apply(choice);
}
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => apply());
apply();
window.StorageFitTheme = { get, set, apply };
})();
