import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class FakeTextarea {
  constructor(value) {
    this.value = value;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.scrollTop = 0;
    this.clientHeight = 200;
    this.dataset = {};
    this.listeners = new Map();
  }

  addEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((x) => x !== fn));
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  key(key, { ctrlKey = false, altKey = false, metaKey = false, shiftKey = false } = {}) {
    let prevented = false;
    const event = {
      key, ctrlKey, altKey, metaKey, shiftKey,
      preventDefault() { prevented = true; },
    };
    for (const fn of this.listeners.get("keydown") || []) fn(event);
    return prevented;
  }
}

const source = fs.readFileSync("ui/vendor/vimee-textarea-0.1.2.min.js", "utf8");
const context = {
  console,
  getComputedStyle: () => ({ lineHeight: "20px", fontSize: "14px", paddingTop: "0px", paddingBottom: "0px" }),
};
vm.createContext(context);
vm.runInContext(source, context);
const { attach } = context.VimeeTextarea;
assert.equal(typeof attach, "function");

const textarea = new FakeTextarea("one two\nthree four");
const modes = [];
let changes = 0;
const vim = attach(textarea, {
  onChange: () => { changes++; },
  onModeChange: (mode) => modes.push(mode),
});

assert.equal(vim.getMode(), "normal");
assert.equal(textarea.dataset.vimeeMode, "normal");
assert.equal(textarea.key("w"), true);
assert.equal(textarea.selectionStart, 4, "w moves to the next word");

textarea.key("0");
textarea.key("i");
assert.equal(vim.getMode(), "insert");
textarea.key("X");
textarea.key("Escape");
assert.equal(vim.getMode(), "normal");
assert.equal(vim.getContent(), "Xone two\nthree four");
assert.ok(changes >= 1, "editing emits onChange");
assert.ok(modes.includes("insert") && modes.includes("normal"), "mode changes are observable");

textarea.key("0");
textarea.key("d");
textarea.key("d");
assert.equal(vim.getContent(), "three four", "dd deletes the current line");

vim.destroy();
console.log("Vimee textarea smoke test passed");
