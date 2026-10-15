/* Optional Vim keybindings for Portanote's markdown textarea. */
"use strict";

(() => {
  const STORAGE_KEY = "pn-vim-enabled";
  const APP_SHORTCUTS = new Set(["k", "s", "e"]);
  const NATIVE_CTRL_KEYS = new Set(["a", "c", "v", "x", "y", "z"]);
  let vim = null;
  let enabled = localStorage.getItem(STORAGE_KEY) === "1";
  let dispatchingChange = false;
  let composing = false;
  let noteKey = null;

  const editor = () => document.querySelector("#mdtext");
  const badge = () => document.querySelector("#vimMode");
  const toggle = () => document.querySelector("#setVimMode");

  function modeLabel(mode) {
    return ({
      normal: "NORMAL",
      insert: "INSERT",
      visual: "VISUAL",
      "visual-line": "V-LINE",
      "visual-block": "V-BLOCK",
      "command-line": "COMMAND",
    })[mode] || String(mode || "NORMAL").toUpperCase();
  }

  function renderMode(mode) {
    const el = badge();
    if (!el) return;
    el.hidden = !enabled || !vim;
    el.textContent = enabled && vim ? modeLabel(mode) : "";
    el.dataset.mode = mode || "";
  }

  function detach() {
    if (vim) vim.destroy();
    vim = null;
    renderMode("");
  }

  function attach() {
    const ta = editor();
    if (!enabled || !ta || !window.VimeeTextarea?.attach) return;

    vim = window.VimeeTextarea.attach(ta, {
      onChange: () => {
        // Vimee updates textarea.value programmatically. Re-emit the normal
        // input event so Portanote's autosave, preview, and stats stay intact.
        dispatchingChange = true;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        dispatchingChange = false;
      },
      onModeChange: renderMode,
      onSave: () => window.saveNow?.(),
    });
    renderMode(vim.getMode());
  }

  function restoreMode(mode) {
    const ta = editor();
    if (!vim || !ta || mode === "normal") return;
    const key = ({
      insert: "i",
      visual: "v",
      "visual-line": "V",
      "command-line": ":",
    })[mode];
    if (key) ta.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  }

  function rebuild({ preserveMode = false } = {}) {
    if (!enabled) return;
    const ta = editor();
    if (!ta) return;
    const previousMode = preserveMode ? vim?.getMode() : "normal";
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    detach();
    ta.setSelectionRange(start, end);
    attach();
    restoreMode(previousMode);
  }

  function sync(nextNoteKey) {
    if (!enabled) {
      if (nextNoteKey !== undefined) noteKey = nextNoteKey;
      return;
    }
    const ta = editor();
    if (!ta) return;

    const noteChanged = nextNoteKey !== undefined && nextNoteKey !== noteKey;
    if (nextNoteKey !== undefined) noteKey = nextNoteKey;
    const contentChanged = !vim || vim.getContent() !== ta.value;
    if (!noteChanged && !contentChanged) return;

    // A different note should begin in NORMAL mode. A background refresh of
    // the same note keeps the user's mode/cursor, but Vimee's undo/register
    // state necessarily resets because its textarea adapter has no reseed API.
    rebuild({ preserveMode: !noteChanged });
  }

  function setEnabled(on) {
    enabled = !!on;
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    const cb = toggle();
    if (cb) cb.checked = enabled;
    detach();
    if (enabled) attach();
  }

  function isEnabled() {
    return enabled;
  }

  function isAppShortcut(e) {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    return mod && ((e.altKey && key === "n") || (!e.altKey && APP_SHORTCUTS.has(key)));
  }

  function bypassVimeeKeydown(e) {
    if (!enabled) return;
    const key = e.key.toLowerCase();

    // Vimee 0.1.2 consumes modified keys too aggressively and ignores Meta.
    // Keep Vim's Ctrl motions, but bypass Vimee for Portanote shortcuts and
    // native browser/OS shortcuts. Portanote shortcuts are re-dispatched on
    // document so its existing global handler still owns their behavior.
    if (isAppShortcut(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        bubbles: true,
        cancelable: true,
      }));
      return;
    }

    if (e.metaKey || e.altKey || (e.ctrlKey && NATIVE_CTRL_KEYS.has(key))) {
      e.stopImmediatePropagation();
    }
  }

  window.portanoteVim = {
    enabled: isEnabled,
    setEnabled,
    sync,
    getMode: () => vim?.getMode() || null,
    modeLabel,
  };

  document.addEventListener("DOMContentLoaded", () => {
    const cb = toggle();
    if (cb) {
      cb.checked = enabled;
      cb.addEventListener("change", () => setEnabled(cb.checked));
    }

    const ta = editor();
    // Capture runs before Vimee's textarea keydown listener.
    ta?.addEventListener("keydown", bypassVimeeKeydown, true);
    ta?.addEventListener("compositionstart", () => { composing = true; });
    ta?.addEventListener("compositionend", () => {
      composing = false;
      if (enabled && vim && vim.getContent() !== ta.value) rebuild({ preserveMode: true });
    });

    attach();

    // Programmatic editor helpers dispatch input just like user edits. If the
    // change did not originate in Vimee, rebuild its internal TextBuffer while
    // keeping the current mode and cursor.
    ta?.addEventListener("input", () => {
      if (!enabled || dispatchingChange || composing || !vim) return;
      if (vim.getContent() !== ta.value) rebuild({ preserveMode: true });
    });
  });
})();
