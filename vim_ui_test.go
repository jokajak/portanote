package main

import (
	"os/exec"
	"strings"
	"testing"
)

func TestVimUIIntegration(t *testing.T) {
	indexBytes, err := uiEmbed.ReadFile("ui/index.html")
	if err != nil {
		t.Fatal(err)
	}
	index := string(indexBytes)
	for _, want := range []string{
		`vendor/vimee-textarea-0.1.2.min.js`,
		`vim-mode.js`,
		`id="setVimMode"`,
		`id="vimMode"`,
	} {
		if !strings.Contains(index, want) {
			t.Fatalf("index.html missing Vim integration marker %q", want)
		}
	}
	if strings.Index(index, `vendor/vimee-textarea-0.1.2.min.js`) > strings.Index(index, `vim-mode.js`) ||
		strings.Index(index, `vim-mode.js`) > strings.Index(index, `app.js`) {
		t.Fatal("Vim scripts must load after Vimee and before app.js")
	}

	appBytes, err := uiEmbed.ReadFile("ui/app.js")
	if err != nil {
		t.Fatal(err)
	}
	app := string(appBytes)
	for _, want := range []string{
		`window.portanoteVim?.sync();`,
		`if (window.portanoteVim?.enabled()) return;`,
		`if (e.defaultPrevented) return;`,
	} {
		if !strings.Contains(app, want) {
			t.Fatalf("app.js missing Vim integration marker %q", want)
		}
	}

	if _, err := uiEmbed.ReadFile("ui/vendor/vimee-textarea-0.1.2.min.js"); err != nil {
		t.Fatalf("vendored Vimee bundle missing: %v", err)
	}
}

func TestVendoredVimeeBehavior(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not installed; skipping browser-library smoke test")
	}
	cmd := exec.Command(node, "scripts/vim-smoke.mjs")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("Vimee smoke test failed: %v\n%s", err, out)
	}
}
