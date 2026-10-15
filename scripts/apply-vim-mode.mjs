import fs from "node:fs";

function replaceOnce(source, needle, replacement, file) {
  if (source.includes(replacement)) return source;
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`${file}: expected one match, found ${count}: ${needle.slice(0, 80)}`);
  return source.replace(needle, replacement);
}

let index = fs.readFileSync("ui/index.html", "utf8");
index = replaceOnce(
  index,
  '<script defer src="vendor/mermaid.min.js"></script>\n<script defer src="app.js"></script>',
  '<script defer src="vendor/mermaid.min.js"></script>\n<script defer src="vendor/vimee-textarea-0.1.2.min.js"></script>\n<script defer src="vim-mode.js"></script>\n<script defer src="app.js"></script>',
  "ui/index.html",
);
index = replaceOnce(
  index,
  '<span id="stats"></span>\n        <span id="noteDates"></span>',
  '<span id="vimMode" class="vim-mode" hidden></span>\n        <span id="stats"></span>\n        <span id="noteDates"></span>',
  "ui/index.html",
);
index = replaceOnce(
  index,
  '    <div class="settings-body">\n      <h3>Automatic backups</h3>',
  '    <div class="settings-body">\n      <h3>Editor</h3>\n      <label class="setting-row"><input type="checkbox" id="setVimMode">\n        Enable Vim keybindings in the Markdown editor\n      </label>\n      <p class="settings-desc">Uses Vimee for Normal, Insert, Visual, and command-line editing. This preference is stored in this browser.</p>\n\n      <h3>Automatic backups</h3>',
  "ui/index.html",
);
fs.writeFileSync("ui/index.html", index);

let app = fs.readFileSync("ui/app.js", "utf8");
app = replaceOnce(
  app,
  '  $("#mdtext").value = n.body;\n  renderFolderSelect();',
  '  $("#mdtext").value = n.body;\n  window.portanoteVim?.sync();\n  renderFolderSelect();',
  "ui/app.js",
);
app = replaceOnce(
  app,
  '  $("#mdtext").addEventListener("keydown", (e) => {\n    if (e.key === "Tab") {',
  '  $("#mdtext").addEventListener("keydown", (e) => {\n    if (window.portanoteVim?.enabled()) return;\n    if (e.key === "Tab") {',
  "ui/app.js",
);
app = replaceOnce(
  app,
  '  document.addEventListener("keydown", (e) => {\n    if (e.key === "Escape" && !$("#cheatOverlay").hidden)',
  '  document.addEventListener("keydown", (e) => {\n    if (e.defaultPrevented) return;\n    if (e.key === "Escape" && !$("#cheatOverlay").hidden)',
  "ui/app.js",
);
fs.writeFileSync("ui/app.js", app);

let css = fs.readFileSync("ui/app.css", "utf8");
const cssBlock = `\n\n/* Vim mode -------------------------------------------------------------- */\n.vim-mode {\n  flex: 0 0 auto;\n  padding: 1px 6px;\n  border-radius: 4px;\n  font: 600 10px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  letter-spacing: .04em;\n  background: var(--accent, #2563eb);\n  color: #fff;\n}\n.vim-mode[data-mode="insert"] { opacity: .78; }\n.vim-mode[data-mode^="visual"] { outline: 1px solid currentColor; outline-offset: -2px; }\n`;
if (!css.includes("/* Vim mode -------------------------------------------------------------- */")) css += cssBlock;
fs.writeFileSync("ui/app.css", css);
