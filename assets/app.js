// =========================
// assets/app.js (FULL)
// ✅ Personal build (2026-02-19b)
// ✅ Control Panel refactor (2026-02-19c):
// - New unified Control Panel (manual/risk) with paired panes
// - No details nesting; default collapsed; no auto-open on output
// - btnClear hard clears + forces both panels collapsed
// =========================

console.log("[APP] loaded v20260219c-personal-auto-controlpanel");

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
      TERM: "【遮盖】" // ✅ neutral placeholder for manual terms
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

// heuristic boundaries for Latin terms (EN/DE)
function makeLatinTermRegex(term){
  const n = escapeRegExp(term);
  return new RegExp(`\\b${n}\\b`, "gi");
}

// CJK terms: no \b. Use loose punctuation/space boundaries to reduce false hits.
function makeCjkTermRegex(term){
  const n = escapeRegExp(term);
  // boundary: start or non-CJK before; end or non-CJK after
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

/* mark hits in original input (keeps original chars) */
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

  // ✅ highlight manual terms too
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

    if (key === "money") {
      // money always ON
      s = s.replace(r.pattern, (m) => `${S1}${m}${S2}`);
      continue;
    }

    s = s.replace(r.pattern, (m) => `${S1}${m}${S2}`);
  }

  const esc = escapeHTML(s);
  return esc
    .replaceAll(S1, `<span class="hit">`)
    .replaceAll(S2, `</span>`);
}

/* ================= Money M2 helpers (kept, but we use M1 only) ================= */
function normalizeAmountToNumber(raw) {
  let s = String(raw || "").replace(/\s+/g, "");
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    const decSep = lastDot > lastComma ? "." : ",";
    const thouSep = decSep === "." ? "," : ".";
    s = s.replaceAll(thouSep, "");
    s = s.replace(decSep, ".");
  } else if (hasComma && !hasDot) {
    const idx = s.lastIndexOf(",");
    const decimals = s.length - idx - 1;
    if (decimals === 2) s = s.replace(",", ".");
    else s = s.replaceAll(",", "");
  } else {
    if (hasDot) {
      const idx = s.lastIndexOf(".");
      const decimals = s.length - idx - 1;
      if (decimals !== 2) s = s.replaceAll(".", "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function moneyRangeLabel(currency, amount) {
  const cur = String(currency || "").toUpperCase();
  const isCNY = (cur === "CNY" || cur === "RMB" || cur === "¥" || cur === "元");

  const a = amount;
  if (!Number.isFinite(a) || a <= 0) return placeholder("MONEY");

  const bands = isCNY
    ? [
        [0, 500, "<500"],
        [500, 2000, "500–2k"],
        [2000, 10000, "2k–10k"],
        [10000, 50000, "10k–50k"],
        [50000, 200000, "50k–200k"],
        [200000, Infinity, "200k+"]
      ]
    : [
        [0, 100, "<100"],
        [100, 500, "100–500"],
        [500, 1000, "500–1k"],
        [1000, 3000, "1k–3k"],
        [3000, 10000, "3k–10k"],
        [10000, 50000, "10k–50k"],
        [50000, Infinity, "50k+"]
      ];

  for (const [lo, hi, label] of bands) {
    if (a >= lo && a < hi) return label;
  }
  return placeholder("MONEY");
}

function formatCurrencyForM2(currency) {
  const c = String(currency || "").trim();
  if (!c) return "";
  if (c === "€" || c.toUpperCase() === "EUR") return "EUR";
  if (c === "$" || c.toUpperCase() === "USD") return "USD";
  if (c === "¥" || c.toUpperCase() === "CNY" || c.toUpperCase() === "RMB") return "CNY";
  return c.toUpperCase();
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
  manual_term: 10 // ✅ manual list hits count here
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

/* ================= Control Panel: open/close model ================= */
function getControlPanel() {
  return $("controlPanel");
}

function setControlPanelOpen(which){
  const cp = getControlPanel();
  if (!cp) return;

  const next = (cp.dataset.open === which) ? "" : (which || "");
  cp.dataset.open = next;

  // sync aria-expanded
  document.querySelectorAll(".cp-toggle").forEach(btn => {
    const isOn = (btn.dataset.toggle === next);
    btn.setAttribute("aria-expanded", isOn ? "true" : "false");
  });

  // sync aria-hidden (paired panes rely on CSS display, aria improves accessibility)
  document.querySelectorAll(".cp-pane").forEach(p => {
    const k = p.dataset.pane || "";
    const on = (k === next);
    p.setAttribute("aria-hidden", on ? "false" : "true");
  });
}

function collapseControlPanel(){
  setControlPanelOpen("");
}

/* ================= UI text ================= */
function setText() {
  const t = window.I18N && window.I18N[currentLang];
  if (!t) return;

  window.currentLang = currentLang;

  if ($("ui-in-title")) $("ui-in-title").textContent = t.inTitle;
  if ($("ui-out-title")) $("ui-out-title").textContent = t.outTitle;

  if ($("inputText")) $("inputText").placeholder = t.placeholder;
  if ($("ui-input-watermark")) $("ui-input-watermark").textContent = t.inputWatermark;

  if ($("ui-upload-btn")) $("ui-upload-btn").textContent = t.btnUpload;

  // Mobile tabs (legacy, m.html old) — keep safe
  if ($("ui-tab-in")) $("ui-tab-in").textContent = t.tabIn || "";
  if ($("ui-tab-out")) $("ui-tab-out").textContent = t.tabOut || "";

  // Risk title (now used inside cp-toggle span)
  const riskEl = $("ui-risk-title");
  if (riskEl) {
    riskEl.textContent = (t.riskTitle || t.panelRisk || "");
  }

  // ✅ Manual terms UI
  if ($("ui-manual-terms-title")) $("ui-manual-terms-title").textContent = t.manualTitle || "手工输入";
  if ($("ui-manual-terms-hint"))  $("ui-manual-terms-hint").textContent  = t.manualHint  || "支持逗号/换行分隔；只遮盖 PDF 原文里真实出现的内容。";
  if ($("manualTerms")) $("manualTerms").placeholder = t.manualPlaceholder || "例如：张三, 李四, Bei.de Tech GmbH";

  // ✅ Money UI removed in personal build; but keep label safely if exists
  if ($("ui-money-label")) $("ui-money-label").textContent = "";
  const sel = $("moneyMode");
  if (sel) sel.style.display = "none";

  // ✅ "Filter" button removed: if legacy exists, hide it
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
    // still apply manual terms masking
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

    window.dispatchEvent(new Event("safe:updated"));
    return out;
  }

  // 1) apply manual terms first (highest priority)
  out = applyManualTermsMask(out, addHit);

  // 2) apply built-in rules
  for (const key of PRIORITY) {
    if (key !== "money" && !enabledSet.has(key)) continue;

    const r = rules[key];
    if (!r || !r.pattern) continue;

    if (key === "money") {
      // money fixed M1
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

  // ✅ DO NOT auto-open risk panel (spec: default collapsed; user toggles)
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

  window.dispatchEvent(new Event("safe:updated"));
  return out;
}

/* ================= Stage 3 file handler (PDF + image) ================= */
async function handleFile(file) {
  if (!file) return;

  lastUploadedFile = file;
  lastProbe = null;
  lastPdfOriginalText = "";
  lastFileKind = (file.type === "application/pdf") ? "pdf" : (file.type && file.type.startsWith("image/") ? "image" : "");

  setStage3Ui("none");

  // ✅ Image defaults to manual mode
  if (lastFileKind === "image") {
    lastRunMeta.fromPdf = false;
    setStage3Ui("B");
    return;
  }

  if (lastFileKind !== "pdf") return;

  try {
    if (!window.probePdfTextLayer) {
      console.error("[handleFile] probePdfTextLayer missing");
      lastRunMeta.fromPdf = false;
      setStage3Ui("B");
      return;
    }

    const probe = await window.probePdfTextLayer(file);
    lastProbe = probe || null;

    if (!probe || !probe.hasTextLayer) {
      lastRunMeta.fromPdf = false;
      setStage3Ui("B");
      return;
    }

    lastRunMeta.fromPdf = true;
    setStage3Ui("A");

    const text = String(probe.text || "").trim();
    lastPdfOriginalText = text;

    if (!text) return;

    const ta = $("inputText");
    if (ta) {
      ta.value = text;
      ta.readOnly = false;
    }

    updateInputWatermarkVisibility();

    applyRules(text);
    renderInputOverlayForPdf(text);

    window.dispatchEvent(new Event("safe:updated"));
  } catch (e) {
    console.error("[handleFile] ERROR:", e);
    lastRunMeta.fromPdf = false;
    setStage3Ui("B");
  }
}

function bindPdfUI() {
  const pdfInput = $("pdfFile");
  if (!pdfInput) return;

  pdfInput.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f && $("pdfName")) $("pdfName").textContent = f.name || "";
    handleFile(f);
    e.target.value = "";
  });
}

/* ================= bind ================= */
function bind() {
  // ✅ Control Panel toggles (paired open/close)
  document.querySelectorAll(".cp-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const which = btn.dataset.toggle || "";
      setControlPanelOpen(which);
    });
  });

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
    };
  });

  // ✅ Manual terms input
  const termInput = $("manualTerms") || $("nameList");
  if (termInput) {
    termInput.addEventListener("input", () => {
      setManualTermsFromText(termInput.value || "");

      // ✅ keep snapshot ALWAYS in sync
      if (!window.__export_snapshot) window.__export_snapshot = {};
      window.__export_snapshot.manualTerms = manualTerms.slice(0);

      const inTxt = (($("inputText") && $("inputText").value) || "").trim();
      if (inTxt) applyRules(inTxt);
      else window.dispatchEvent(new Event("safe:updated"));
      renderInputOverlayForPdf(($("inputText") && $("inputText").value) || "");
    });

    // init
    setManualTermsFromText(termInput.value || "");
    if (!window.__export_snapshot) window.__export_snapshot = {};
    window.__export_snapshot.manualTerms = manualTerms.slice(0);
  }

  // ✅ btnGenerate removed: if legacy exists, disable/hide safely
  const btnGenerate = $("btnGenerate");
  if (btnGenerate) {
    btnGenerate.onclick = null;
    btnGenerate.style.display = "none";
  }

  const btnClear = $("btnClear");
  if (btnClear) {
    btnClear.onclick = () => {
      // 1) clear input + output
      if ($("inputText")) $("inputText").value = "";
      renderOutput("");

      // 2) reset risk rendering
      window.__safe_hits = 0;
      window.__safe_breakdown = {};
      window.__safe_score = 0;
      window.__safe_level = "low";
      window.__safe_report = null;

      const rb = $("riskBox");
      if (rb) rb.innerHTML = "";

      // 3) reset PDF overlay state
      lastRunMeta.fromPdf = false;

      if ($("pdfName")) $("pdfName").textContent = "";

      const wrap = $("inputWrap");
      if (wrap) {
        wrap.classList.remove("pdf-overlay-on");
        wrap.classList.remove("has-content");
      }
      if ($("inputOverlay")) $("inputOverlay").innerHTML = "";

      // 4) reset manual terms
      manualTerms = [];
      const termInput2 = $("manualTerms") || $("nameList");
      if (termInput2) termInput2.value = "";

      // 5) stage3 state reset
      lastUploadedFile = null;
      lastFileKind = "";
      lastProbe = null;
      lastPdfOriginalText = "";
      setStage3Ui("none");

      // 6) ✅ FORCE collapse both panels (spec)
      collapseControlPanel();

      // 7) export snapshot reset
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
    const n = Number($("upCount").textContent || "0") + 1;
    $("upCount").textContent = String(n);
  };
  if (down) down.onclick = () => {
    const n = Number($("downCount").textContent || "0") + 1;
    $("downCount").textContent = String(n);
  };

  // ✅ Auto-filter on typing (debounced)
  let autoTimer = null;
  const AUTO_DELAY = 220;

  const ta = $("inputText");
  if (ta) {
    ta.addEventListener("input", () => {
      updateInputWatermarkVisibility();

      // keep PDF overlay sync while typing
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
      // NOTE: no longer auto-open panel; just render progress into riskBox
      const rb = $("riskBox");

      const say = (html) => {
        if (rb) rb.innerHTML = `<div class="tiny" style="white-space:pre-wrap;line-height:1.6;">${html}</div>`;
      };

      say(`Redact click ✅\n${Date.now()}`);

      try {
        const f = lastUploadedFile;

        if (!f) { say(`<span style="color:#ffb4b4;">No file loaded</span>`); return; }
        if (lastFileKind !== "pdf") { say(`<span style="color:#ffb4b4;">Not a PDF file</span>`); return; }
        if (!lastProbe) { say(`<span style="color:#ffb4b4;">No PDF probe result</span>`); return; }
        if (!lastProbe.hasTextLayer) { say(`<span style="color:#ffb4b4;">PDF not readable (Mode B). Use Manual.</span>`); return; }

        if (!window.RasterExport || !window.RasterExport.exportRasterSecurePdfFromReadablePdf) {
          say(`<span style="color:#ffb4b4;">RasterExport not loaded</span>`);
          return;
        }

        const snap = window.__export_snapshot || {};
        const enabledKeys = Array.isArray(snap.enabledKeys) ? snap.enabledKeys : effectiveEnabledKeys();
        const lang = snap.lang || currentLang;
        const manualTermsSafe = Array.isArray(snap.manualTerms) ? snap.manualTerms : [];

        say(`Working…\nlang=${escapeHTML(lang)}\nmoneyMode=M1\nenabledKeys=${enabledKeys.length}\nmanualTerms=${manualTermsSafe.length}`);

        await window.RasterExport.exportRasterSecurePdfFromReadablePdf({
          file: f,
          lang,
          enabledKeys,
          moneyMode: "m1",
          dpi: 600,
          filename: `raster_secure_${Date.now()}.pdf`,
          manualTerms: manualTermsSafe
        });

        say(`Done ✅\nDownload should start.`);
      } catch (e) {
        const msg = (e && (e.message || String(e))) || "Unknown error";
        say(`<span style="color:#ffb4b4;">Export failed:</span>\n${escapeHTML(msg)}`);
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

// ✅ Default: both groups collapsed
collapseControlPanel();

bind();
updateInputWatermarkVisibility();
