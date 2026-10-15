import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn, options = false) {
    const capture = options === true || options?.capture === true;
    const list = this.listeners.get(type) || [];
    list.push({ fn, capture });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((x) => x.fn !== fn));
  }
  dispatchEvent(event) {
    event.target ||= this;
    event.currentTarget = this;
    const list = [...(this.listeners.get(event.type) || [])];
    for (const phase of [true, false]) {
      for (const { fn, capture } of list) {
        if (capture !== phase) continue;
        fn(event);
        if (event.immediatePropagationStopped) return !event.defaultPrevented;
      }
    }
    return !event.defaultPrevented;
  }
}

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
    this.defaultPrevented = false;
    this.immediatePropagationStopped = false;
  }
  preventDefault() { if (this.cancelable !== false) this.defaultPrevented = true; }
  stopImmediatePropagation() { this.immediatePropagationStopped = true; }
}

class FakeKeyboardEvent extends FakeEvent {
  constructor(type, init = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.key ||= "";
    this.code ||= "";
    this.ctrlKey = !!this.ctrlKey;
    this.metaKey = !!this.metaKey;
    this.altKey = !!this.altKey;
    this.shiftKey = !!this.shiftKey;
  }
}

class FakeTextarea extends FakeEventTarget {
  constructor(value) {
    super();
    this.value = value;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.scrollTop = 0;
    this.clientHeight = 200;
    this.dataset = {};
  }
  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
  key(key, init = {}) {
    const event = new FakeKeyboardEvent("keydown", { key, ...init });
    this.dispatchEvent(event);
    return event;
  }
}

class FakeDocument extends FakeEventTarget {
  constructor(elements) {
    super();
    this.elements = elements;
  }
  querySelector(selector) { return this.elements[selector] || null; }
}

class FakeElement extends FakeEventTarget {
  constructor() {
    super();
    this.hidden = false;
    this.checked = false;
    this.textContent = "";
    this.dataset = {};
  }
}

const textarea = new FakeTextarea("one two\nthree four");
const badge = new FakeElement();
const toggle = new FakeElement();
const document = new FakeDocument({ "#mdtext": textarea, "#vimMode": badge, "#setVimMode": toggle });
const storage = new Map([["pn-vim-enabled", "1"]]);
const localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
};
const documentShortcuts = [];
document.addEventListener("keydown", (e) => documentShortcuts.push(e.key.toLowerCase()));

const context = {
  console,
  document,
  localStorage,
  navigator: {},
  Event: FakeEvent,
  KeyboardEvent: FakeKeyboardEvent,
  getComputedStyle: () => ({ lineHeight: "20px", fontSize: "14px", paddingTop: "0px", paddingBottom: "0px" }),
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("ui/vendor/vimee-textarea-0.1.2.min.js", "utf8"), context);
vm.runInContext(fs.readFileSync("ui/vim-mode.js", "utf8"), context);
document.dispatchEvent(new FakeEvent("DOMContentLoaded"));

const vim = context.window.portanoteVim;
assert.equal(vim.enabled(), true);
assert.equal(vim.getMode(), "normal");
assert.equal(badge.textContent, "NORMAL");

let e = textarea.key("w");
assert.equal(e.defaultPrevented, true);
assert.equal(textarea.selectionStart, 4, "w moves to the next word");

textarea.key("0");
textarea.key("i");
assert.equal(vim.getMode(), "insert");
textarea.key("X");
textarea.key("Escape");
assert.equal(vim.getMode(), "normal");
assert.equal(textarea.value, "Xone two\nthree four");

// Native/browser shortcuts must bypass Vimee, including Meta on macOS.
const before = textarea.value;
e = textarea.key("v", { metaKey: true });
assert.equal(e.defaultPrevented, false, "Cmd+V remains available to the browser");
assert.equal(vim.getMode(), "normal", "Cmd+V does not enter Visual mode");
assert.equal(textarea.value, before);
e = textarea.key("v", { ctrlKey: true });
assert.equal(e.defaultPrevented, false, "Ctrl+V remains available to the browser");

// Portanote shortcuts bypass Vimee but are re-dispatched to document.
e = textarea.key("k", { ctrlKey: true });
assert.equal(e.defaultPrevented, true);
assert.ok(documentShortcuts.includes("k"), "Ctrl+K reaches Portanote's document shortcut handler");

// An external/programmatic editor mutation must reseed Vimee before the next
// Vim edit so the new text is not overwritten by a stale internal buffer.
textarea.value = "**bold**hello";
textarea.setSelectionRange(0, 0);
textarea.dispatchEvent(new FakeEvent("input", { bubbles: true }));
textarea.key("x");
assert.equal(textarea.value, "*bold**hello", "Vim edit preserves externally changed text");

// Background render of the same note/body should be a no-op, while switching
// notes resets to NORMAL and adopts the new textarea content.
vim.sync("note-a");
textarea.key("i");
assert.equal(vim.getMode(), "insert");
vim.sync("note-a");
assert.equal(vim.getMode(), "insert", "same-note refresh preserves mode");
textarea.value = "other note";
textarea.setSelectionRange(0, 0);
vim.sync("note-b");
assert.equal(vim.getMode(), "normal", "note switch resets to NORMAL");
textarea.key("x");
assert.equal(textarea.value, "ther note");

console.log("Portanote Vimee integration smoke test passed");
