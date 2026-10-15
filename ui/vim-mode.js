/* Optional Vim keybindings for Portanote's markdown textarea. */
"use strict";

(() => {
  const STORAGE_KEY = "pn-vim-enabled";
  let vim = null;
  let enabled = localStorage.getItem(STORAGE_KEY) === "1";
  let dispatchingChange = false;

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
      onYank: (text) => {
        // Mirror Vim yanks to the system clipboard when browser permissions
        // allow it; Vimee's own register still works if this is unavailable.
        navigator.clipboard?.writeText(text).catch(() => {});
      },
    });
    renderMode(vim.getMode());
  }

  function sync() {
    // Portanote replaces textarea.value when a different note is opened.
    // Vimee owns an internal TextBuffer, so rebuilding the attachment is the
    // supported way to seed it with the new note's content and cursor.
    if (!enabled) return;
    detach();
    attach();
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
    attach();

    // Toolbar operations can change textarea.value without switching notes.
    // They normally emit input; if that change did not originate in Vimee,
    // rebuild Vimee's buffer so the next motion sees the current text.
    editor()?.addEventListener("input", () => {
      if (!enabled || dispatchingChange || !vim) return;
      if (vim.getContent() !== editor().value) sync();
    });
  });
})();
