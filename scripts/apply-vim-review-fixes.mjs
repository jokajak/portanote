import fs from "node:fs";

const path = "ui/app.js";
let src = fs.readFileSync(path, "utf8");

function replaceOnce(needle, replacement) {
  const count = src.split(needle).length - 1;
  if (count !== 1) throw new Error(`expected one match, found ${count}: ${needle.slice(0, 90)}`);
  src = src.replace(needle, replacement);
}

replaceOnce(
  '  window.portanoteVim?.sync();\n  renderFolderSelect();',
  '  window.portanoteVim?.sync(n.id);\n  renderFolderSelect();',
);

for (const needle of [
  '  ta.focus();\n  onBodyInput();\n}\n\nfunction mdLinePrefix',
  '  ta.focus();\n  onBodyInput();\n}\n\n/* Indent',
  '    ta.focus();\n    onBodyInput();\n    return;',
  '  ta.focus();\n  onBodyInput();\n}\n\nfunction mdInsertBlock',
  '  ta.focus();\n  onBodyInput();\n}\n\n// paste an image',
]) {
  const replacement = needle.replace('onBodyInput();', 'ta.dispatchEvent(new Event("input", { bubbles: true }));');
  replaceOnce(needle, replacement);
}

replaceOnce(
  '  document.addEventListener("keydown", (e) => {\n    if (e.defaultPrevented) return;\n    if (e.key === "Escape"',
  '  document.addEventListener("keydown", (e) => {\n    if (e.key === "Escape"',
);

fs.writeFileSync(path, src);
