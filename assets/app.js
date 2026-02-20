// =========================
// assets/app.js (FULL)
// ✅ Personal build (2026-02-19d1)
// This revision:
// - FIX: avoid "blank risk card flash" by delaying expand until AFTER riskBox rendered.
// - FIX: keep left/right expanded heights aligned (manual follows risk; manual scrolls if needed).
// - Keep: auto expand after file upload (pdf/image).
// - Keep: collapse on Clear.
// - Keep: progress uses existing HTML slot #exportStatus (index.html/m.html) first.
// - Keep: clearProgress clears BOTH #exportStatus and injected #progressBox.
// - Progress texts follow i18n (with safe fallbacks).
// - Backward-compatible with legacy <details> if present.
// =========================

console.log("[APP] loaded v20260219d1-personal-auto-ctl-progress-syncheight");

let currentLang = "zh";
window.currentLang = currentLang;

const enabled = new Set();

// ✅ Money protection always ON (M1). No UI selector.
let moneyMode = "m1"; // fixed: "m1"
window.__safe_moneyMode = moneyMode;

let lastOutputPlain = "";

// ================= Stage 3 state (minimal glue) =================
let lastUploadedFile = null;       // File object (pdf or image)
let lastFileKind = "";             // "pdf" | "image" | ""
let lastProbe = null;              // { hasTextLayer, text }
let lastPdfOriginalText = "";      // extracted text for readable PDF
let lastStage3Mode = "none";       // "A" | "B" | "none"

// ================= Manual terms (NO auto NER) =================
let manualTerms = []; // array of strings (user-provided)

function normalizeTerm(s){
  return String(s || "").trim();
}

/**
 * 输入规则（不做“必须人名”的限制）：
 * - 支持逗号/中文逗号/分号/顿号/换行作为分隔
 * - 自动去重（不区分大小写）
 * - 最大 24 个（防止本地正则性能问题）
 */
function setManualTermsFromText(raw){
  const s = String(raw || "");
  const parts = s
    .split(/[\n\r,，;；、]+/g)
    .map(normalizeTerm)
    .filter(Boolean);

  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  manualTerms = out.slice(0, 24);
}

function show(el, yes){
  if (!el) return;
  el.style.display = yes ? "" : "none";
}

// --- Risk scoring meta (local only) ---
let lastRunMeta = {
  fromPdf: false,
  inputLen: 0,
  enabledCount: 0,
  moneyMode: "m1",
  lang: "zh"
};

function $(id) { return document.getElementById(id); }

function escapeHTML(s){
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ================= RULES SAFE ACCESS (CRITICAL) ================= */
function getRulesSafe() {
  const r = window.RULES_BY_KEY;
  return (r && typeof r === "object") ? r : null;
}

/* ================= ENABLED KEYS FOR EXPORT ================= */
// Personal: keep strategy simple. We DO NOT force person_name.
function effectiveEnabledKeys() {
  const MUST_INCLUDE = ["company"]; // optional; remove if you want pure personal
  const base = new Set(Array.from(enabled || []));
  for (const k of MUST_INCLUDE) base.add(k);
  return Array.from(base);
}

/* ================= placeholders ================= */
function placeholder(key) {
  const map = {
    zh: {
      PHONE: "【电话】",
      EMAIL: "【邮箱】",
      ACCOUNT: "【账号】",
      ADDRESS: "【地址】",
      HANDLE: "【账号名】",
      REF: "【编号】",
      TITLE: "【称谓】",
      NUMBER: "【数字】",
      MONEY: "【金额】",
      COMPANY: "【公司】",
      TERM: "【遮盖】"
    },
    de: {
      PHONE: "[Telefon]",
      EMAIL: "[E-Mail]",
      ACCOUNT: "[Konto]",
      ADDRESS: "[Adresse]",
      HANDLE: "[Handle]",
      REF: "[Referenz]",
      TITLE: "[Anrede]",
      NUMBER: "[Zahl]",
      MONEY: "[Betrag]",
      COMPANY: "[Firma]",
      TERM: "[REDACTED]"
    },
    en: {
      PHONE: "[Phone]",
      EMAIL: "[Email]",
      ACCOUNT: "[Account]",
      ADDRESS: "[Address]",
      HANDLE: "[Handle]",
      REF: "[Ref]",
      TITLE: "[Title]",
      NUMBER: "[Number]",
      MONEY: "[Amount]",
      COMPANY: "[Company]",
      TERM: "[REDACTED]"
    }
  };
  return (map[currentLang] && map[currentLang][key]) || `[${key}]`;
}

/* ================= output render (highlight placeholders) ================= */
function renderOutput(outPlain){
  lastOutputPlain = String(outPlain || "");
  const host = $("outputText");
  if (!host) return;

  const html = escapeHTML(lastOutputPlain)
    .replace(/(【[^【】]{1,36}】|\[[^\[\]]{1,36}\])/g, `<span class="hl">$1</span>`);

  host.innerHTML = html;
}

/* ================= input watermark hide ================= */
function updateInputWatermarkVisibility(){
  const ta = $("inputText");
  const wrap = $("inputWrap");
  if (!ta || !wrap) return;
  const has = String(ta.value || "").trim().length > 0;
  wrap.classList.toggle("has-content", has);
}

/* ================= Manual terms masking ================= */
function escapeRegExp(s){
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function makeLatinTermRegex(term){
  const n = escapeRegExp(term);
  return new RegExp(`\\b${n}\\b`, "gi");
}
function makeCjkTermRegex(term){
  const n = escapeRegExp(term);
  return new RegExp(`(^|[^\\u4E00-\\u9FFF])(${n})(?=$|[^\\u4E00-\\u9FFF])`, "g");
}

function applyManualTermsMask(out, addHit){
  if (!manualTerms || !manualTerms.length) return out;

  let s = String(out || "");
  for (const tm of manualTerms) {
    if (!tm) continue;

    const hasCjk = /[\u4E00-\u9FFF]/.test(tm);
    if (hasCjk) {
      const re = makeCjkTermRegex(tm);
      s = s.replace(re, (m, p1) => {
        if (typeof addHit === "function") addHit("manual_term");
        return `${p1}${placeholder("TERM")}`;
      });
    } else {
      const re = makeLatinTermRegex(tm);
      s = s.replace(re, () => {
        if (typeof addHit === "function") addHit("manual_term");
        return placeholder("TERM");
      });
    }
  }
  return s;
}

/* ================= PDF input overlay highlight (only for PDF) ================= */
function renderInputOverlayForPdf(originalText){
  const overlay = $("inputOverlay");
  const ta = $("inputText");
  const wrap = $("inputWrap");
  if (!overlay || !ta || !wrap) return;

  if (!lastRunMeta.fromPdf) {
    overlay.innerHTML = "";
    wrap.classList.remove("pdf-overlay-on");
    return;
  }

  const marked = markHitsInOriginal(originalText);
  overlay.innerHTML = marked;

  wrap.classList.add("pdf-overlay-on");

  overlay.scrollTop = ta.scrollTop;
  overlay.scrollLeft = ta.scrollLeft;
}

function markHitsInOriginal(text){
  let s = String(text || "");

  const S1 = "⟦HIT⟧";
  const S2 = "⟦/HIT⟧";

  const snap = window.__export_snapshot || null;
  const enabledKeysArr = (snap && Array.isArray(snap.enabledKeys))
    ? snap.enabledKeys
    : Array.from(enabled || []);

  const enabledSet = new Set(enabledKeysArr);

  const PRIORITY = [
    "company",
    "email",
    "bank",
    "account",
    "phone",
    "money",
    "address_de_street",
    "handle",
    "ref",
    "title",
    "number"
  ];

  if (manualTerms && manualTerms.length) {
    for (const tm of manualTerms) {
      const hasCjk = /[\u4E00-\u9FFF]/.test(tm);
      if (hasCjk) {
        const re = makeCjkTermRegex(tm);
        s = s.replace(re, (m, p1, p2) => `${p1}${S1}${p2}${S2}`);
      } else {
        const re = makeLatinTermRegex(tm);
        s = s.replace(re, (m) => `${S1}${m}${S2}`);
      }
    }
  }

  for (const key of PRIORITY) {
    if (key !== "money" && !enabledSet.has(key)) continue;

    const r = window.RULES_BY_KEY && window.RULES_BY_KEY[key];
    if (!r || !r.pattern) continue;

    s = s.replace(r.pattern, (m) => `${S1}${m}${S2}`);
  }

  const esc = escapeHTML(s);
  return esc
    .replaceAll(S1, `<span class="hit">`)
    .replaceAll(S2, `</span>`);
}

/* ================= init enabled ================= */
function initEnabled() {
  enabled.clear();
  Object.values(window.DETECTION_ITEMS || {}).flat().forEach(i => {
    if (i && i.defaultOn) enabled.add(i.key);
  });
}

/* ================= Risk scoring ================= */
const RISK_WEIGHTS = {
  bank: 28,
  account: 26,
  email: 14,
  phone: 16,
  address_de_street: 18,
  handle: 10,
  ref: 6,
  title: 4,
  number: 2,
  money: 0,
  company: 8,
  manual_term: 10
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function riskI18n(lang) {
  const zh = {
    low: "低风险",
    mid: "中风险",
    high: "高风险",
    top: "主要风险来源",
    advice: "建议",
    adviceLow: "可以继续使用；金额保护已默认开启。",
    adviceMid: "建议检查 Top 项；必要时加严遮盖或手工涂抹。",
    adviceHigh: "不建议直接发送：请删除签名落款/账号信息，并加严遮盖后再试。",
    meta: (m) => `命中 ${m.hits}｜金额 M1${m.fromPdf ? "｜文件" : ""}`
  };
  const de = {
    low: "Niedrig",
    mid: "Mittel",
    high: "Hoch",
    top: "Top-Risiken",
    advice: "Empfehlung",
    adviceLow: "Kann verwendet werden. Betragsschutz ist standardmäßig aktiv.",
    adviceMid: "Top-Risiken prüfen; ggf. stärker maskieren oder manuell schwärzen.",
    adviceHigh: "Nicht direkt senden: Signatur/Kontodaten entfernen und mehr Maskierung aktivieren.",
    meta: (m) => `Treffer ${m.hits}｜Betrag M1${m.fromPdf ? "｜Datei" : ""}`
  };
  const en = {
    low: "Low",
    mid: "Medium",
    high: "High",
    top: "Top risk sources",
    advice: "Advice",
    adviceLow: "Ok to use. Money protection is on by default.",
    adviceMid: "Review top risks; consider stronger masking or manual redaction.",
    adviceHigh: "Do not send as-is: remove signature/account details and mask more.",
    meta: (m) => `Hits ${m.hits}｜Money M1${m.fromPdf ? "｜File" : ""}`
  };
  return (lang === "de") ? de : (lang === "en") ? en : zh;
}

function labelForKey(k) {
  const map = {
    zh: {
      bank: "银行/支付信息",
      account: "账号/卡号",
      email: "邮箱",
      phone: "电话",
      address_de_street: "地址（街道门牌）",
      handle: "账号名/Handle",
      ref: "编号/引用",
      title: "称谓",
      number: "数字",
      money: "金额",
      company: "公司",
      manual_term: "补充遮盖（手工词条）"
    },
    de: {
      bank: "Bank/Payment",
      account: "Konto/Nummer",
      email: "E-Mail",
      phone: "Telefon",
      address_de_street: "Adresse (Straße/Nr.)",
      handle: "Handle/Account",
      ref: "Referenz",
      title: "Anrede",
      number: "Zahl",
      money: "Betrag",
      company: "Firma",
      manual_term: "Zusatz (manuell)"
    },
    en: {
      bank: "Bank/Payment",
      account: "Account/Number",
      email: "Email",
      phone: "Phone",
      address_de_street: "Address (street/no.)",
      handle: "Handle/Account",
      ref: "Reference",
      title: "Title",
      number: "Numbers",
      money: "Money",
      company: "Company",
      manual_term: "Extra (manual)"
    }
  };
  const m = map[currentLang] || map.zh;
  return m[k] || k;
}

function computeRiskReport(hitsByKey, meta) {
  let score = 0;

  for (const [k, c] of Object.entries(hitsByKey || {})) {
    if (!c) continue;
    const w = RISK_WEIGHTS[k] || 0;
    const capped = Math.min(c, 12);
    score += w * capped;
  }

  // money fixed M1
  score += 10;

  if (meta.inputLen >= 1500) score += 6;
  if (meta.inputLen >= 4000) score += 8;
  if (meta.fromPdf) score += 6;

  score = clamp(Math.round(score), 0, 100);

  let level = "low";
  if (score >= 70) level = "high";
  else if (score >= 35) level = "mid";

  const pairs = Object.entries(hitsByKey || {})
    .filter(([, c]) => c > 0)
    .map(([k, c]) => {
      const w = RISK_WEIGHTS[k] || 0;
      return { k, c, w, s: c * w };
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  return { score, level, top: pairs };
}

function renderRiskBox(report, meta) {
  const box = $("riskBox");
  if (!box) return;

  const t = riskI18n(currentLang);
  const levelText = report.level === "high" ? t.high : report.level === "mid" ? t.mid : t.low;

  const topHtml = (report.top && report.top.length)
    ? report.top.map(x => {
      return `<div class="riskitem">
        <span class="rk">${labelForKey(x.k)}</span>
        <span class="rv">${x.c}</span>
      </div>`;
    }).join("")
    : `<div class="tiny muted">-</div>`;

  const advice =
    report.level === "high" ? t.adviceHigh :
    report.level === "mid" ? t.adviceMid :
    t.adviceLow;

  box.innerHTML = `
    <div class="riskhead">
      <div class="riskleft">
        <div class="riskmeta">${t.meta(meta)}</div>
      </div>

      <div class="riskscore">
        <div class="n">${report.score}</div>
        <div class="l">${levelText}</div>
      </div>
    </div>

    <div class="risksec">
      <div class="risklabel">${t.top}</div>
      <div class="risklist">${topHtml}</div>
    </div>

    <div class="risksec">
      <div class="risklabel">${t.advice}</div>
      <div class="riskadvice">${advice}</div>
    </div>
  `;
}

/* ================= Stage 3 UI texts (fallback-safe) ================= */
function stage3Text(key){
  const map = {
    zh: { btnExportText: "导出文本", btnExportPdf: "红删PDF", btnManual: "人工处理" },
    de: { btnExportText: "Text", btnExportPdf: "PDF", btnManual: "Manuell" },
    en: { btnExportText: "Text", btnExportPdf: "PDF", btnManual: "Manual" }
  };
  const m = map[currentLang] || map.zh;
  return m[key] || "";
}

function setStage3Ui(mode){
  lastStage3Mode = mode || "none";
  const btnText = $("btnExportText");
  const btnPdf  = $("btnExportRasterPdf");
  const btnMan  = $("btnManualRedact");

  show(btnText, lastStage3Mode === "A");
  show(btnPdf,  lastStage3Mode === "A");
  show(btnMan,  lastStage3Mode === "B");

  const t = (window.I18N && window.I18N[currentLang]) ? window.I18N[currentLang] : null;

  if (btnText) btnText.textContent = stage3Text("btnExportText");
  if (btnPdf)  btnPdf.textContent  = (t && t.btnRedactPdf) ? t.btnRedactPdf : stage3Text("btnExportPdf");
  if (btnMan)  btnMan.textContent  = stage3Text("btnManual");
}

/* ================= Unified control toggles (button + body) ================= */
function setCtlExpanded(btn, body, expanded){
  if (btn) btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  if (body) {
    body.classList.toggle("open", !!expanded);
    body.style.display = expanded ? "" : "none";
  }
}
function toggleCtl(btn, body){
  const cur = (btn && btn.getAttribute("aria-expanded") === "true");
  setCtlExpanded(btn, body, !cur);
}

/* ================= Height sync: manual follows risk ================= */
function syncManualToRiskHeight(){
  const riskBody = $("riskBody");
  const manualBody = $("manualBody");
  if (!riskBody || !manualBody) return;

  const riskOpen = $("btnToggleRisk")?.getAttribute("aria-expanded") === "true";
  const manOpen  = $("btnToggleManual")?.getAttribute("aria-expanded") === "true";
  if (!riskOpen || !manOpen) return;

  const riskH = riskBody.getBoundingClientRect().height;
  if (!riskH || riskH < 40) return;

  manualBody.style.height = `${Math.ceil(riskH)}px`;
  manualBody.style.maxHeight = `${Math.ceil(riskH)}px`;
  manualBody.style.overflow = "auto";
}

function resetManualHeightLock(){
  const manualBody = $("manualBody");
  if (!manualBody) return;
  manualBody.style.height = "";
  manualBody.style.maxHeight = "";
  manualBody.style.overflow = "";
}

function expandManualArea(){
  const btn = $("btnToggleManual");
  const body = $("manualBody");
  if (btn && body) { setCtlExpanded(btn, body, true); return; }
  const md = $("manualDetails");
  if (md && "open" in md) md.open = true;
}
function expandRiskArea(){
  const btn = $("btnToggleRisk");
  const body = $("riskBody");
  if (btn && body) { setCtlExpanded(btn, body, true); return; }
  const rd = $("riskDetails");
  if (rd && "open" in rd) rd.open = true;
}
function collapseManualArea(){
  const btn = $("btnToggleManual");
  const body = $("manualBody");
  if (btn && body) { setCtlExpanded(btn, body, false); return; }
  const md = $("manualDetails");
  if (md && "open" in md) md.open = false;
}
function collapseRiskArea(){
  const btn = $("btnToggleRisk");
  const body = $("riskBody");
  if (btn && body) { setCtlExpanded(btn, body, false); return; }
  const rd = $("riskDetails");
  if (rd && "open" in rd) rd.open = false;
}

/* ================= Progress area (prefer HTML slot #exportStatus) ================= */
function ensureProgressBox(){
  // ✅ Prefer index.html/m.html slot
  const slot = $("exportStatus");
  if (slot) return slot;

  // reuse injected
  const existing = $("progressBox");
  if (existing) return existing;

  // inject under risk railcard
  const riskBody = $("riskBody");
  if (riskBody) {
    const rails = riskBody.querySelectorAll(".railcard");
    if (rails && rails.length) {
      const rail = rails[0];

      const box = document.createElement("div");
      box.id = "progressBox";
      box.className = "tiny muted";
      box.style.whiteSpace = "pre-wrap";
      box.style.lineHeight = "1.6";
      box.style.marginTop = "10px";
      box.style.paddingTop = "8px";
      box.style.borderTop = "1px solid rgba(255,255,255,.06)";
      rail.appendChild(box);
      return box;
    }
  }

  // fallback
  return $("riskBox");
}

function setProgressText(lines, isError){
  const box = ensureProgressBox();
  if (!box) return;

  const s = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
  const html = escapeHTML(s);

  if (box.id === "riskBox") {
    box.innerHTML = `<div class="tiny" style="white-space:pre-wrap;line-height:1.6;${isError ? "color:#ffb4b4;" : ""}">${html}</div>`;
  } else {
    box.style.color = isError ? "#ffb4b4" : "";
    box.textContent = s;
  }
}

function clearProgress(){
  const a = $("exportStatus");
  if (a) a.textContent = "";
  const b = $("progressBox");
  if (b) b.textContent = "";
}

/* ================= UI text ================= */
function exportTitleFallback(){
  if (currentLang === "de") return "Fortschritt";
  if (currentLang === "en") return "Progress";
  return "生成进程";
}

function setText() {
  const t = window.I18N && window.I18N[currentLang];
  if (!t) return;

  window.currentLang = currentLang;

  if ($("ui-in-title")) $("ui-in-title").textContent = t.inTitle;
  if ($("ui-out-title")) $("ui-out-title").textContent = t.outTitle;

  if ($("inputText")) $("inputText").placeholder = t.placeholder;
  if ($("ui-input-watermark")) $("ui-input-watermark").textContent = t.inputWatermark;

  if ($("ui-upload-btn")) $("ui-upload-btn").textContent = t.btnUpload;

  // Mobile tabs
  if ($("ui-tab-in")) $("ui-tab-in").textContent = t.tabIn || "";
  if ($("ui-tab-out")) $("ui-tab-out").textContent = t.tabOut || "";

  // control titles (button spans) — DO NOT overwrite button DOM
  const spMan = document.getElementById("ui-manual-toggle-title");
  const spRisk = document.getElementById("ui-risk-toggle-title");

  if (spMan) spMan.textContent = t.manualTitle || "手工输入";
  else if ($("btnToggleManual")) $("btnToggleManual").textContent = t.manualTitle || "手工输入"; // fallback

  if (spRisk) spRisk.textContent = t.riskTitle || "风险评分";
  else if ($("btnToggleRisk")) $("btnToggleRisk").textContent = t.riskTitle || "风险评分"; // fallback

  // rail titles + note (i18n)
  const railManTitle = document.getElementById("ui-manual-rail-title");
  if (railManTitle) railManTitle.textContent = t.manualRailTitle || "";

  const railManNote = document.getElementById("ui-manual-rail-note");
  if (railManNote) railManNote.textContent = t.manualRailText || "";

  const exportTitle = document.getElementById("ui-export-title");
  if (exportTitle) exportTitle.textContent = t.exportTitle || exportTitleFallback();

  // Manual terms placeholder
  if ($("manualTerms")) $("manualTerms").placeholder = t.manualPlaceholder || "例如：张三, 李四, Bei.de Tech GmbH";

  // Money UI removed
  if ($("ui-money-label")) $("ui-money-label").textContent = "";
  const sel = $("moneyMode");
  if (sel) sel.style.display = "none";

  // Legacy "Filter" button removed
  const btnGenerate = $("btnGenerate");
  if (btnGenerate) {
    btnGenerate.textContent = "";
    btnGenerate.style.display = "none";
  }

  if ($("btnCopy")) $("btnCopy").textContent = t.btnCopy;
  if ($("btnClear")) $("btnClear").textContent = t.btnClear;

  if ($("ui-fb-q")) $("ui-fb-q").textContent = t.fbQ;

  if ($("linkLearn")) $("linkLearn").textContent = t.learn;
  if ($("linkPrivacy")) $("linkPrivacy").textContent = t.privacy;
  if ($("linkScope")) $("linkScope").textContent = t.scope;

  if ($("ui-foot")) $("ui-foot").textContent = t.foot;

  setStage3Ui(lastStage3Mode);
}

/* ================= rule application ================= */
function applyRules(text) {
  let out = String(text || "");
  let hits = 0;
  const hitsByKey = {};

  const PRIORITY = [
    "company",
    "email",
    "bank",
    "account",
    "phone",
    "money",
    "address_de_street",
    "handle",
    "ref",
    "title",
    "number"
  ];

  function addHit(key) {
    hits++;
    hitsByKey[key] = (hitsByKey[key] || 0) + 1;
  }

  const rules = getRulesSafe();

  const enabledKeysArr = effectiveEnabledKeys();
  const enabledSet = new Set(enabledKeysArr);

  // meta
  lastRunMeta.inputLen = (String(text || "")).length;
  lastRunMeta.enabledCount = enabledSet.size;
  lastRunMeta.moneyMode = "m1";
  lastRunMeta.lang = currentLang;

  if (!rules) {
    out = applyManualTermsMask(out, addHit);

    renderOutput(out);

    const report = computeRiskReport(hitsByKey, {
      hits,
      enabledCount: enabledSet.size,
      moneyMode,
      fromPdf: lastRunMeta.fromPdf,
      inputLen: out.length
    });

    renderRiskBox(report, {
      hits,
      enabledCount: enabledSet.size,
      moneyMode,
      fromPdf: lastRunMeta.fromPdf,
      inputLen: out.length
    });

    updateInputWatermarkVisibility();
    const ta = $("inputText");
    if (ta) renderInputOverlayForPdf(ta.value || "");

    window.__export_snapshot = {
      enabledKeys: enabledKeysArr,
      moneyMode: "m1",
      lang: currentLang,
      fromPdf: !!lastRunMeta.fromPdf,
      manualTerms: manualTerms.slice(0)
    };

    // ✅ Expand AFTER render (avoid blank flash) + sync heights
    requestAnimationFrame(() => {
      if (lastUploadedFile) {
        expandRiskArea();
        expandManualArea();
        syncManualToRiskHeight();
      }
    });

    window.dispatchEvent(new Event("safe:updated"));
    return out;
  }

  // 1) manual terms first
  out = applyManualTermsMask(out, addHit);

  // 2) built-in rules
  for (const key of PRIORITY) {
    if (key !== "money" && !enabledSet.has(key)) continue;

    const r = rules[key];
    if (!r || !r.pattern) continue;

    if (key === "money") {
      out = out.replace(r.pattern, () => {
        addHit("money");
        return placeholder("MONEY");
      });
      continue;
    }

    out = out.replace(r.pattern, () => {
      addHit(key);
      return placeholder(r.tag);
    });
  }

  const report = computeRiskReport(hitsByKey, {
    hits,
    enabledCount: enabledSet.size,
    moneyMode: "m1",
    fromPdf: lastRunMeta.fromPdf,
    inputLen: lastRunMeta.inputLen
  });

  window.__safe_hits = hits;
  window.__safe_moneyMode = "m1";
  window.__safe_breakdown = hitsByKey;
  window.__safe_score = report.score;
  window.__safe_level = report.level;
  window.__safe_report = {
    hits,
    hitsByKey,
    score: report.score,
    level: report.level,
    moneyMode: "m1",
    enabledCount: enabledSet.size,
    fromPdf: lastRunMeta.fromPdf
  };

  renderOutput(out);
  renderRiskBox(report, {
    hits,
    enabledCount: enabledSet.size,
    moneyMode: "m1",
    fromPdf: lastRunMeta.fromPdf,
    inputLen: lastRunMeta.inputLen
  });

  updateInputWatermarkVisibility();
  const ta = $("inputText");
  if (ta) renderInputOverlayForPdf(ta.value || "");

  window.__export_snapshot = {
    enabledKeys: enabledKeysArr,
    moneyMode: "m1",
    lang: currentLang,
    fromPdf: !!lastRunMeta.fromPdf,
    manualTerms: manualTerms.slice(0)
  };

  // ✅ Expand AFTER render (avoid blank flash) + sync heights
  requestAnimationFrame(() => {
    if (lastUploadedFile) {
      expandRiskArea();
      expandManualArea();
      syncManualToRiskHeight();
    }
  });

  window.dispatchEvent(new Event("safe:updated"));
  return out;
}

/* ================= Stage 3 file handler (PDF + image) ================= */
async function handleFile(file) {
  if (!file) return;

  // ✅ IMPORTANT: DO NOT expand here (prevents blank flash on right)
  // We expand after riskBox has content (in applyRules rAF) or in Mode B rAF.

  lastUploadedFile = file;
  lastProbe = null;
  lastPdfOriginalText = "";
  lastFileKind = (file.type === "application/pdf") ? "pdf" : (file.type && file.type.startsWith("image/") ? "image" : "");

  setStage3Ui("none");

  // Image => manual mode button; open panels without waiting for risk render
  if (lastFileKind === "image") {
    lastRunMeta.fromPdf = false;
    setStage3Ui("B");
    requestAnimationFrame(() => {
      expandManualArea();
      expandRiskArea();
      syncManualToRiskHeight();
    });
    return;
  }

  if (lastFileKind !== "pdf") return;

  try {
    if (!window.probePdfTextLayer) {
      console.error("[handleFile] probePdfTextLayer missing");
      lastRunMeta.fromPdf = false;
      setStage3Ui("B");
      requestAnimationFrame(() => {
        expandManualArea();
        expandRiskArea();
        syncManualToRiskHeight();
      });
      return;
    }

    const probe = await window.probePdfTextLayer(file);
    lastProbe = probe || null;

    if (!probe || !probe.hasTextLayer) {
      // Mode B
      lastRunMeta.fromPdf = false;
      setStage3Ui("B");
      requestAnimationFrame(() => {
        expandManualArea();
        expandRiskArea();
        syncManualToRiskHeight();
      });
      return;
    }

    lastRunMeta.fromPdf = true;
    setStage3Ui("A");

    const text = String(probe.text || "").trim();
    lastPdfOriginalText = text;

    if (!text) {
      requestAnimationFrame(() => {
        expandManualArea();
        expandRiskArea();
        syncManualToRiskHeight();
      });
      return;
    }

    const ta = $("inputText");
    if (ta) {
      ta.value = text;
      ta.readOnly = false;
    }

    updateInputWatermarkVisibility();

    // applyRules() will render riskBox then expand + sync in rAF
    applyRules(text);
    renderInputOverlayForPdf(text);

    window.dispatchEvent(new Event("safe:updated"));
  } catch (e) {
    console.error("[handleFile] ERROR:", e);
    lastRunMeta.fromPdf = false;
    setStage3Ui("B");
    requestAnimationFrame(() => {
      expandManualArea();
      expandRiskArea();
      syncManualToRiskHeight();
    });
  }
}

function bindPdfUI() {
  const pdfInput = $("pdfFile");
  if (!pdfInput) return;

  pdfInput.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f && $("pdfName")) $("pdfName").textContent = f.name || "";
    clearProgress();
    handleFile(f);
    e.target.value = "";
  });
}

/* ================= bind ================= */
function bind() {
  // language buttons
  document.querySelectorAll(".lang button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".lang button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentLang = b.dataset.lang;
      window.currentLang = currentLang;

      setText();

      const ta = $("inputText");
      const inTxt = (ta && ta.value) ? String(ta.value).trim() : "";

      if (inTxt) applyRules(inTxt);
      else window.dispatchEvent(new Event("safe:updated"));

      if (ta) renderInputOverlayForPdf(ta.value || "");

      // language switch might change risk content height slightly
      requestAnimationFrame(syncManualToRiskHeight);
    };
  });

  // title-row toggles
  const btnToggleManual = $("btnToggleManual");
  const manualBody = $("manualBody");
  if (btnToggleManual && manualBody) {
    setCtlExpanded(btnToggleManual, manualBody, false);
    btnToggleManual.onclick = () => {
      toggleCtl(btnToggleManual, manualBody);
      requestAnimationFrame(syncManualToRiskHeight);
    };
  }

  const btnToggleRisk = $("btnToggleRisk");
  const riskBody = $("riskBody");
  if (btnToggleRisk && riskBody) {
    setCtlExpanded(btnToggleRisk, riskBody, false);
    btnToggleRisk.onclick = () => {
      toggleCtl(btnToggleRisk, riskBody);
      requestAnimationFrame(syncManualToRiskHeight);
    };
  }

  // Manual terms input
  const termInput = $("manualTerms") || $("nameList");
  if (termInput) {
    termInput.addEventListener("input", () => {
      setManualTermsFromText(termInput.value || "");

      if (!window.__export_snapshot) window.__export_snapshot = {};
      window.__export_snapshot.manualTerms = manualTerms.slice(0);

      const inTxt = (($("inputText") && $("inputText").value) || "").trim();
      if (inTxt) applyRules(inTxt);
      else window.dispatchEvent(new Event("safe:updated"));

      renderInputOverlayForPdf(($("inputText") && $("inputText").value) || "");
      requestAnimationFrame(syncManualToRiskHeight);
    });

    // init
    setManualTermsFromText(termInput.value || "");
    if (!window.__export_snapshot) window.__export_snapshot = {};
    window.__export_snapshot.manualTerms = manualTerms.slice(0);
  }

  // Legacy btnGenerate: disable/hide safely
  const btnGenerate = $("btnGenerate");
  if (btnGenerate) {
    btnGenerate.onclick = null;
    btnGenerate.style.display = "none";
  }

  const btnClear = $("btnClear");
  if (btnClear) {
    btnClear.onclick = () => {
      if ($("inputText")) $("inputText").value = "";
      renderOutput("");

      window.__safe_hits = 0;
      window.__safe_breakdown = {};
      window.__safe_score = 0;
      window.__safe_level = "low";
      window.__safe_report = null;

      lastRunMeta.fromPdf = false;

      // ✅ collapse areas + clear progress
      collapseManualArea();
      collapseRiskArea();
      clearProgress();
      resetManualHeightLock();

      const rb = $("riskBox");
      if (rb) rb.innerHTML = "";

      if ($("pdfName")) $("pdfName").textContent = "";

      const wrap = $("inputWrap");
      if (wrap) {
        wrap.classList.remove("pdf-overlay-on");
        wrap.classList.remove("has-content");
      }
      if ($("inputOverlay")) $("inputOverlay").innerHTML = "";

      // reset manual terms
      manualTerms = [];
      const termInput2 = $("manualTerms") || $("nameList");
      if (termInput2) termInput2.value = "";

      lastUploadedFile = null;
      lastFileKind = "";
      lastProbe = null;
      lastPdfOriginalText = "";
      setStage3Ui("none");

      window.__export_snapshot = null;

      window.dispatchEvent(new Event("safe:updated"));
    };
  }

  const btnCopy = $("btnCopy");
  if (btnCopy) {
    btnCopy.onclick = async () => {
      const t = window.I18N && window.I18N[currentLang];
      try {
        await navigator.clipboard.writeText(lastOutputPlain || "");
        if (t) {
          const old = btnCopy.textContent;
          btnCopy.textContent = t.btnCopied || old;
          setTimeout(() => { btnCopy.textContent = t.btnCopy || old; }, 900);
        }
      } catch (e) {}
    };
  }

  const up = $("btnUp");
  const down = $("btnDown");
  if (up) up.onclick = () => {
    const n = Number($("upCount")?.textContent || "0") + 1;
    if ($("upCount")) $("upCount").textContent = String(n);
  };
  if (down) down.onclick = () => {
    const n = Number($("downCount")?.textContent || "0") + 1;
    if ($("downCount")) $("downCount").textContent = String(n);
  };

  // Auto-filter on typing (debounced)
  let autoTimer = null;
  const AUTO_DELAY = 220;

  const ta = $("inputText");
  if (ta) {
    ta.addEventListener("input", () => {
      updateInputWatermarkVisibility();

      if (lastRunMeta.fromPdf) renderInputOverlayForPdf(ta.value || "");

      const v = String(ta.value || "");
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (v.trim()) applyRules(v);
        else {
          renderOutput("");
          const rb = $("riskBox");
          if (rb) rb.innerHTML = "";
          window.dispatchEvent(new Event("safe:updated"));
        }
      }, AUTO_DELAY);
    });

    ta.addEventListener("scroll", () => {
      const overlay = $("inputOverlay");
      if (overlay) {
        overlay.scrollTop = ta.scrollTop;
        overlay.scrollLeft = ta.scrollLeft;
      }
    });
  }

  const btnExportText = $("btnExportText");
  if (btnExportText) {
    btnExportText.onclick = () => {
      const out = String(lastOutputPlain || "").trim();
      if (!out) return;

      const blob = new Blob([out], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `safe_text_${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 500);
    };
  }

  const btnExportRasterPdf = $("btnExportRasterPdf");
  if (btnExportRasterPdf) {
    btnExportRasterPdf.onclick = async () => {
      // show area + progress under slot
      expandRiskArea();
      requestAnimationFrame(syncManualToRiskHeight);

      const t = (window.I18N && window.I18N[currentLang]) ? window.I18N[currentLang] : {};

      try {
        const f = lastUploadedFile;

        if (!f) { setProgressText(t.progressNoFile || "No file detected. Please upload a PDF first.", true); return; }
        if (lastFileKind !== "pdf") { setProgressText(t.progressNotPdf || "This is not a PDF file.", true); return; }
        if (!lastProbe) { setProgressText(t.progressNotReadable || "PDF not readable (Mode B). Use Manual.", true); return; }
        if (!lastProbe.hasTextLayer) { setProgressText(t.progressNotReadable || "PDF not readable (Mode B). Use Manual.", true); return; }

        if (!window.RasterExport || !window.RasterExport.exportRasterSecurePdfFromReadablePdf) {
          setProgressText(t.progressExportMissing || "Export module not loaded", true);
          return;
        }

        const snap = window.__export_snapshot || {};
        const enabledKeys = Array.isArray(snap.enabledKeys) ? snap.enabledKeys : effectiveEnabledKeys();
        const lang = snap.lang || currentLang;
        const manualTermsSafe = Array.isArray(snap.manualTerms) ? snap.manualTerms : [];

        setProgressText([
          (t.progressWorking || "Working…"),
          `lang=${lang}`,
          `moneyMode=M1`,
          `enabledKeys=${enabledKeys.length}`,
          `manualTerms=${manualTermsSafe.length}`
        ], false);

        await window.RasterExport.exportRasterSecurePdfFromReadablePdf({
          file: f,
          lang,
          enabledKeys,
          moneyMode: "m1",
          dpi: 600,
          filename: `raster_secure_${Date.now()}.pdf`,
          manualTerms: manualTermsSafe
        });

        setProgressText(t.progressDone || "Done ✅ Download started.", false);
        requestAnimationFrame(syncManualToRiskHeight);
      } catch (e) {
        const msg = (e && (e.message || String(e))) || "Unknown error";
        const t2 = (window.I18N && window.I18N[currentLang]) ? window.I18N[currentLang] : {};
        setProgressText(`${t2.progressFailed || "Export failed:"}\n${msg}`, true);
        requestAnimationFrame(syncManualToRiskHeight);
      }
    };
  }

  const btnManual = $("btnManualRedact");
  if (btnManual) {
    btnManual.onclick = async () => {
      const f = lastUploadedFile;
      if (!f) return;
      if (!window.RedactUI || !window.RedactUI.start) return;

      await window.RedactUI.start({
        file: f,
        fileKind: lastFileKind,
        lang: currentLang
      });
    };
  }

  bindPdfUI();
}

/* ================= boot ================= */
initEnabled();
setText();
bind();
updateInputWatermarkVisibility();
