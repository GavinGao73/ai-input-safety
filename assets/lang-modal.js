// =========================
// assets/lang-modal.js (NEW)
// Minimal modal for language confirmation / manual switch
// - Only used when __LangDetect decides uncertainty
// =========================
(function () {
  "use strict";

  const API = (window.__LangModal = window.__LangModal || {});
  API.__state = API.__state || { onClose: null, isOpen: false };

  function ensureRoot() {
    let root = document.getElementById("langModalRoot");
    if (root) return root;

    root = document.createElement("div");
    root.id = "langModalRoot";
    root.style.position = "fixed";
    root.style.left = "0";
    root.style.top = "0";
    root.style.right = "0";
    root.style.bottom = "0";
    root.style.zIndex = "99999";
    root.style.display = "none";
    root.style.alignItems = "center";
    root.style.justifyContent = "center";
    root.style.background = "rgba(0,0,0,.55)";

    root.innerHTML = `
      <div id="langModalCard" style="
        width:min(520px, calc(100vw - 32px));
        border-radius:16px;
        background:#0b0f14;
        color:#e8eef7;
        border:1px solid rgba(255,255,255,.08);
        box-shadow:0 20px 60px rgba(0,0,0,.6);
        padding:18px 16px;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      ">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div id="langModalTitle" style="font-size:14px; font-weight:700;">选择内容语言 / Content Language</div>
          <button id="langModalClose" style="
            border:1px solid rgba(255,255,255,.12);
            background:transparent;
            color:#e8eef7;
            border-radius:10px;
            padding:6px 10px;
            cursor:pointer;
          ">×</button>
        </div>

        <div id="langModalHint" style="margin-top:10px; font-size:12px; color: rgba(232,238,247,.75); line-height:1.5;">
          系统无法稳定判断输入内容属于哪种语言。请选择一次，之后将锁定（Lock），避免漂移。
        </div>

        <div id="langModalMeta" style="margin-top:10px; font-size:12px; color: rgba(232,238,247,.65);"></div>

        <div id="langModalBtns" style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;"></div>

        <div style="margin-top:14px; font-size:12px; color: rgba(232,238,247,.55); line-height:1.5;">
          提示：你仍可通过“手动切换语言”触发此弹窗再次选择（不在主 UI 堆按钮）。
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // click outside to close (统一走 API.close，确保触发 onClose & 复位)
    root.addEventListener("click", (e) => {
      if (e && e.target === root) API.close();
    });

    // ESC to close
    window.addEventListener("keydown", (e) => {
      if (e && (e.key === "Escape" || e.key === "Esc")) {
        const r = document.getElementById("langModalRoot");
        if (r && r.style.display === "flex") API.close();
      }
    });

    return root;
  }

  function i18n(uiLang) {
    const t = (window.I18N && window.I18N[uiLang]) ? window.I18N[uiLang] : {};
    return {
      title: t.langModalTitle || "选择内容语言 / Content Language",
      hint:
        t.langModalHint ||
        "系统无法稳定判断输入内容属于哪种语言。请选择一次，之后将锁定（Lock），避免漂移。"
    };
  }

  function labelForLang(l) {
    return l === "zh" ? "中文 (zh)" : l === "de" ? "Deutsch (de)" : "English (en)";
  }

  function buildButtons(container, langs, detected, onPick) {
    container.innerHTML = "";
    langs.forEach((l) => {
      const b = document.createElement("button");
      b.textContent = labelForLang(l);
      b.style.border = "1px solid rgba(255,255,255,.14)";
      b.style.background = (l === detected) ? "rgba(120,255,240,.12)" : "transparent";
      b.style.color = "#e8eef7";
      b.style.borderRadius = "12px";
      b.style.padding = "10px 12px";
      b.style.cursor = "pointer";
      b.onclick = () => onPick(l);
      container.appendChild(b);
    });
  }

  function resetOpeningFlag() {
    try { window.__LANG_MODAL_OPENING__ = false; } catch (_) {}
  }

  // ✅ unified close path: always calls stored onClose + resets flag + dispatches safe:updated
  API.close = function close() {
    const root = document.getElementById("langModalRoot");
    if (root) root.style.display = "none";

    API.__state.isOpen = false;

    // reset "opening" guard (important)
    resetOpeningFlag();

    // call stored onClose if any
    try {
      const fn = API.__state.onClose;
      API.__state.onClose = null;
      if (typeof fn === "function") fn();
    } catch (_) {}

    try { window.dispatchEvent(new Event("safe:updated")); } catch (_) {}
  };

  API.open = function open(opts) {
    // if already open, close first to avoid stacked state
    try {
      const r0 = document.getElementById("langModalRoot");
      if (r0 && r0.style.display === "flex") API.close();
    } catch (_) {}

    const uiLang = (opts && opts.uiLang) || "en";
    const detected = (opts && opts.detected) || "";
    const reason = (opts && opts.reason) || "";
    const confidence = (opts && typeof opts.confidence === "number") ? opts.confidence : null;
    const candidates = Array.isArray(opts && opts.candidates) ? opts.candidates.slice(0, 6) : [];
    const onPick = (opts && opts.onPick) || function () {};
    const onClose = (opts && opts.onClose) || function () {};

    // store onClose so ANY close path can trigger it
    API.__state.onClose = onClose;

    const root = ensureRoot();
    const t = i18n(uiLang);

    const title = root.querySelector("#langModalTitle");
    const meta = root.querySelector("#langModalMeta");
    const hint = root.querySelector("#langModalHint");
    const btns = root.querySelector("#langModalBtns");
    const closeBtn = root.querySelector("#langModalClose");

    if (title) title.textContent = t.title;
    if (hint) hint.textContent = t.hint;

    const packs = window.__ENGINE_LANG_PACKS__ || {};
    let langs = ["zh", "de", "en"].filter((k) => !!packs[k]);
    if (!langs.length) langs = ["zh", "de", "en"];

    // If detector provides candidates, prefer them (but keep within supported langs)
    const cand = candidates.filter((x) => langs.includes(x));
    const finalLangs = cand.length ? Array.from(new Set(cand.concat(langs))) : langs;

    const metaParts = [];
    metaParts.push(`detected=${detected || "(none)"}`);
    if (confidence != null) metaParts.push(`confidence=${confidence.toFixed(2)}`);
    metaParts.push(`reason=${reason || "(n/a)"}`);
    if (meta) meta.textContent = metaParts.join("  ");

    function doPick(lang) {
      // pick -> close (will reset flag + dispatch + onClose)
      API.close();
      try { onPick(lang); } catch (_) {}
    }

    buildButtons(btns, finalLangs, detected, doPick);

    if (closeBtn) closeBtn.onclick = API.close;

    // mark open
    API.__state.isOpen = true;

    // align with guard flag if caller uses it
    try { window.__LANG_MODAL_OPENING__ = true; } catch (_) {}

    root.style.display = "flex";
  };

})();
