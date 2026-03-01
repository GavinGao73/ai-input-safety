// =========================
// assets/lang-modal.js (NEW)
// Minimal modal for language confirmation / manual switch
// - Only used when __LangDetect decides uncertainty
// =========================
(function () {
  "use strict";

  const API = (window.__LangModal = window.__LangModal || {});

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
          <div style="font-size:14px; font-weight:700;">选择内容语言 / Content Language</div>
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
    return root;
  }

  function i18n(uiLang) {
    const t = (window.I18N && window.I18N[uiLang]) ? window.I18N[uiLang] : {};
    // Provide minimal safe fallbacks; do not require you to add I18N keys now
    return {
      title: t.langModalTitle || "选择内容语言 / Content Language",
      hint:
        t.langModalHint ||
        "系统无法稳定判断输入内容属于哪种语言。请选择一次，之后将锁定（Lock），避免漂移。",
      picked: t.langModalPicked || "已选择并锁定：",
      close: t.langModalClose || "关闭",
      btnManual: t.langModalManual || "手动切换语言"
    };
  }

  function buildButtons(container, langs, detected, onPick) {
    container.innerHTML = "";
    langs.forEach((l) => {
      const b = document.createElement("button");
      b.textContent = (l === "zh" ? "中文" : l === "de" ? "Deutsch" : "English") + ` (${l})`;
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

  API.open = function open(opts) {
    const uiLang = (opts && opts.uiLang) || "en";
    const detected = (opts && opts.detected) || "";
    const reason = (opts && opts.reason) || "";
    const onPick = (opts && opts.onPick) || function () {};

    const root = ensureRoot();
    const t = i18n(uiLang);

    const meta = root.querySelector("#langModalMeta");
    const hint = root.querySelector("#langModalHint");
    const btns = root.querySelector("#langModalBtns");
    const close = root.querySelector("#langModalClose");

    hint.textContent = t.hint;
    meta.textContent = `detected=${detected || "(none)"}  reason=${reason || "(n/a)"}`;

    const packs = window.__ENGINE_LANG_PACKS__ || {};
    const langs = ["zh", "de", "en"].filter((k) => !!packs[k]);
    // fallback if packs not ready
    const finalLangs = langs.length ? langs : ["zh", "de", "en"];

    buildButtons(btns, finalLangs, detected, function (lang) {
      try { root.style.display = "none"; } catch (_) {}
      try { onPick(lang); } catch (_) {}
      try { window.dispatchEvent(new Event("safe:updated")); } catch (_) {}
    });

    if (close) {
      close.onclick = () => {
        try { root.style.display = "none"; } catch (_) {}
      };
    }

    root.style.display = "flex";
  };

  API.close = function close() {
    const root = document.getElementById("langModalRoot");
    if (root) root.style.display = "none";
  };

})();
