const toast = document.querySelector(".toast");
const main = document.querySelector("main");
const autosaveStatus = document.querySelector("[data-autosave-status]");

const storageKeys = {
  content: "vietnam-action-plan-main-html-v2",
  checks: "vietnam-action-plan-checks-v2",
  editMode: "vietnam-action-plan-edit-mode-v2",
  githubToken: "vietnam-action-plan-github-token-session",
};

const githubConfig = {
  owner: "ryusoeun",
  repo: "vietnam-action-plan",
  branch: "main",
  path: "index.html",
};

const editableSelector = [
  "main h2",
  "main h3",
  "main p:not(.eyebrow)",
  "main li",
  "main td",
  "main th",
  "main figcaption",
  "main code",
  "main .stage-index",
  "main .score",
  "main .deck-grid span",
  "main .source-note summary",
].join(",");

let saveTimer;
let lastSavedAt = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function setSaveStatus(message, state = "saved") {
  if (!autosaveStatus) return;
  autosaveStatus.textContent = message;
  autosaveStatus.classList.toggle("is-saving", state === "saving");
  autosaveStatus.classList.toggle("is-unsaved", state === "unsaved");
}

function saveContent() {
  localStorage.setItem(storageKeys.content, main.innerHTML);
  lastSavedAt = new Date();
  setSaveStatus(`Auto-saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
}

function scheduleSave() {
  setSaveStatus("Saving...", "saving");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveContent();
    saveChecks(false);
  }, 350);
}

function restoreContent() {
  const saved = localStorage.getItem(storageKeys.content);
  if (saved) {
    main.innerHTML = saved;
  }
}

function setEditMode(enabled) {
  document.body.classList.toggle("edit-mode", enabled);
  document.querySelector("[data-edit-toggle]")?.classList.toggle("is-active", enabled);
  document.querySelector("[data-edit-toggle]")?.setAttribute("aria-pressed", String(enabled));
  localStorage.setItem(storageKeys.editMode, String(enabled));

  document.querySelectorAll(editableSelector).forEach((element) => {
    element.contentEditable = String(enabled);
    element.dataset.liveEdit = String(enabled);
    if (enabled) {
      element.setAttribute("spellcheck", "true");
    } else {
      element.removeAttribute("spellcheck");
    }
  });
}

function getChecks() {
  return Array.from(document.querySelectorAll("input[type='checkbox']")).map((box) => box.checked);
}

function saveChecks(showStatus = true) {
  localStorage.setItem(storageKeys.checks, JSON.stringify(getChecks()));
  if (showStatus) {
    setSaveStatus("Auto-saved");
  }
}

function restoreChecks() {
  try {
    const checked = JSON.parse(localStorage.getItem(storageKeys.checks) || "[]");
    document.querySelectorAll("input[type='checkbox']").forEach((box, index) => {
      box.checked = Boolean(checked[index]);
    });
  } catch {
    localStorage.removeItem(storageKeys.checks);
  }
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function encodeBase64Unicode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function cleanCloneForPublishing(clone) {
  clone.querySelector("body")?.classList.remove("edit-mode");
  clone.querySelector("[data-autosave-status]")?.classList.remove("is-saving", "is-unsaved");
  if (clone.querySelector("[data-autosave-status]")) {
    clone.querySelector("[data-autosave-status]").textContent = "Saved locally";
  }
  clone.querySelectorAll("[contenteditable], [data-live-edit]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute("data-live-edit");
    element.removeAttribute("spellcheck");
  });
}

async function getCurrentScriptText() {
  const externalScript = document.querySelector("script[src]");
  if (externalScript) {
    try {
      const response = await fetch(externalScript.getAttribute("src"));
      if (response.ok) {
        return await response.text();
      }
    } catch {
      // Fall through to inline script lookup.
    }
  }
  return Array.from(document.scripts).find((script) => !script.src)?.textContent || "";
}

async function buildStandaloneHtml() {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelector("main").innerHTML = main.innerHTML;
  cleanCloneForPublishing(clone);

  const cssText = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");

  if (clone.querySelectorAll("link[rel='stylesheet']").length) {
    const style = document.createElement("style");
    style.textContent = cssText;
    clone.querySelectorAll("link[rel='stylesheet']").forEach((link) => link.replaceWith(style.cloneNode(true)));
  }

  const scriptText = await getCurrentScriptText();
  if (clone.querySelectorAll("script[src]").length) {
    const script = document.createElement("script");
    script.textContent = scriptText;
    clone.querySelectorAll("script[src]").forEach((scriptNode) => scriptNode.replaceWith(script.cloneNode(true)));
  }

  return `<!doctype html>\n${clone.outerHTML}`;
}

function exportJson() {
  saveContent();
  saveChecks();
  const payload = {
    title: document.title,
    exportedAt: new Date().toISOString(),
    version: 2,
    mainHtml: main.innerHTML,
    checks: getChecks(),
  };
  downloadText(
    "vietnam-action-plan-edits.json",
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8",
  );
  showToast("Editable data exported.");
}

async function exportHtml() {
  saveContent();
  saveChecks(false);
  const html = await buildStandaloneHtml();

  downloadText(
    "2026-vietnam-action-plan-standard-editable.html",
    html,
    "text/html;charset=utf-8",
  );
  showToast("Standalone HTML exported.");
}

function getGitHubToken() {
  const saved = sessionStorage.getItem(storageKeys.githubToken);
  if (saved) return saved;
  const token = window.prompt(
    "Paste a fine-grained GitHub token with Contents: Read and write permission for ryusoeun/vietnam-action-plan. It will be kept only in this browser tab session.",
  );
  if (token) {
    sessionStorage.setItem(storageKeys.githubToken, token.trim());
  }
  return token?.trim();
}

async function saveToGitHub() {
  saveContent();
  saveChecks(false);

  const confirmed = window.confirm(
    "Commit the current page as the official GitHub Pages version?\n\nRepository: ryusoeun/vietnam-action-plan\nFile: index.html",
  );
  if (!confirmed) return;

  const token = getGitHubToken();
  if (!token) {
    showToast("GitHub save canceled.");
    return;
  }

  const apiBase = `https://api.github.com/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${githubConfig.path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    setSaveStatus("Saving to GitHub...", "saving");
    const currentResponse = await fetch(`${apiBase}?ref=${githubConfig.branch}`, { headers });
    if (!currentResponse.ok) {
      if (currentResponse.status === 401 || currentResponse.status === 403) {
        sessionStorage.removeItem(storageKeys.githubToken);
      }
      throw new Error(`Could not read GitHub file (${currentResponse.status}).`);
    }
    const currentFile = await currentResponse.json();
    const html = await buildStandaloneHtml();
    const updateResponse = await fetch(apiBase, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        branch: githubConfig.branch,
        message: "Update Vietnam action plan page from site editor",
        content: encodeBase64Unicode(html),
        sha: currentFile.sha,
      }),
    });

    if (!updateResponse.ok) {
      if (updateResponse.status === 401 || updateResponse.status === 403) {
        sessionStorage.removeItem(storageKeys.githubToken);
      }
      throw new Error(`Could not update GitHub file (${updateResponse.status}).`);
    }

    setSaveStatus("Saved to GitHub");
    showToast("Official GitHub Pages version updated. It may take a minute to refresh.");
  } catch (error) {
    console.error(error);
    setSaveStatus("GitHub save failed", "unsaved");
    showToast("GitHub save failed. Check token permission and try again.");
  }
}

async function importJson(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!payload.mainHtml) {
    throw new Error("Invalid edit file.");
  }

  main.innerHTML = payload.mainHtml;
  localStorage.setItem(storageKeys.content, payload.mainHtml);
  if (Array.isArray(payload.checks)) {
    localStorage.setItem(storageKeys.checks, JSON.stringify(payload.checks));
  }

  bindDynamicControls();
  restoreChecks();
  setEditMode(localStorage.getItem(storageKeys.editMode) === "true");
  showToast("Editable data imported.");
}

function bindTopbarControls() {
  document.querySelector("[data-print]")?.addEventListener("click", () => {
    window.print();
  });

  document.querySelector("[data-expand]")?.addEventListener("click", () => {
    document.querySelectorAll("details").forEach((detail) => {
      detail.open = true;
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.add("is-active");
    });
    document.querySelectorAll("[role='tab']").forEach((tab) => {
      tab.setAttribute("aria-selected", "true");
    });
    showToast("All sections expanded for review.");
  });

  document.querySelector("[data-edit-toggle]")?.addEventListener("click", () => {
    const enabled = !document.body.classList.contains("edit-mode");
    setEditMode(enabled);
    showToast(enabled ? "Edit mode on. Click text or table cells to edit." : "Edit mode off.");
  });

  document.querySelector("[data-save-edits]")?.addEventListener("click", () => {
    saveContent();
    saveChecks(false);
    showToast("Saved in this browser.");
  });

  document.querySelector("[data-export-edits]")?.addEventListener("click", exportJson);
  document.querySelector("[data-export-html]")?.addEventListener("click", exportHtml);
  document.querySelector("[data-save-github]")?.addEventListener("click", saveToGitHub);

  document.querySelector("[data-import-edits]")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importJson(file);
    } catch {
      showToast("Could not import that JSON file.");
    } finally {
      event.target.value = "";
    }
  });

  document.querySelector("[data-reset-edits]")?.addEventListener("click", () => {
    const shouldReset = window.confirm("Reset edited content saved in this browser?");
    if (!shouldReset) return;
    localStorage.removeItem(storageKeys.content);
    localStorage.removeItem(storageKeys.checks);
    localStorage.removeItem(storageKeys.editMode);
    window.location.reload();
  });
}

function bindDynamicControls() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.querySelector(button.dataset.copy);
      if (!target) return;

      const text = target.innerText.trim();
      try {
        await navigator.clipboard.writeText(text);
        showToast("Canvas copied.");
      } catch {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
        showToast("Canvas selected. Press Ctrl+C to copy.");
      }
    });
  });

  document.querySelectorAll("[data-tabs]").forEach((tabs) => {
    const tabButtons = Array.from(tabs.querySelectorAll("[role='tab']"));
    const panels = Array.from(tabs.querySelectorAll("[role='tabpanel']"));

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const selected = button.dataset.tab;
        tabButtons.forEach((tab) => {
          tab.setAttribute("aria-selected", String(tab === button));
        });
        panels.forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.panel === selected);
        });
      });
    });
  });

  document.querySelectorAll("input[type='checkbox']").forEach((box) => {
    box.addEventListener("change", saveChecks);
  });

  if (!main.dataset.autosaveBound) {
    main.dataset.autosaveBound = "true";
    main.addEventListener("input", (event) => {
      if (event.target.closest(editableSelector)) {
        scheduleSave();
      }
    });

    main.addEventListener("blur", (event) => {
      if (event.target.closest(editableSelector)) {
        saveContent();
        saveChecks(false);
      }
    }, true);
  }
}

restoreContent();
bindTopbarControls();
bindDynamicControls();
restoreChecks();
setEditMode(localStorage.getItem(storageKeys.editMode) === "true");
setSaveStatus(localStorage.getItem(storageKeys.content) ? "Restored saved edits" : "Saved locally");

window.addEventListener("beforeunload", () => {
  saveContent();
  saveChecks(false);
});
