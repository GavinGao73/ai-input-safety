// assets/app.js
// ✅ Personal build (2026-02-19)
// Goals (personal):
// - NO auto person-name detection.
// - Money protection always ON (fixed M1).
// - Manual Terms: user inputs ANY terms; only mask if term appears in PDF original text (when from PDF).
// - Output masking uses BLACK BAR only (█), no label placeholders.

console.log("[APP] loaded v20260219-personal");

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

// ================= Manual terms (user-provided) =================
// "manualTerms" masks anything user typed, IF it exists in PDF original text (when from PDF).
let manualTerms = []; // array of strings
function normalizeTerm(s){
  return String(s || "").trim();
}
function setManualTermsFromText(raw){
  const s = String(raw || "");

  // split by newlines and common separators
  const parts = s
    .split(/[\n\r,，;；、]+/g)
    .map(normalizeTerm)
    .filter(Boolean);

  // de-dup while keeping order (case-insensitive for latin)
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const key = /[\u4E00-\u9FFF]/.test(p) ? p : p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  manualTerms = out.slice(0, 24); // hard cap (local perf)
}

// Only apply manual term if:
// - not from PDF: allow (user typed raw text, they control it)
// - from PDF: term must appear in lastPdfOriginalText
function termAppearsInPdfOriginal(term){
  const t = normalizeTerm(term);
  if (!t) return false;
  const pdf = String(lastPdfOriginalText || "");
  if (!pdf) return false;

  const hasCjk = /[\u4E00-\u9FFF]/.test(t);
  if (hasCjk) return pdf.indexOf(t) !== -1;

  // latin: case-insensitive contains
  return pdf.toLowerCase().indexOf(t.toLowerCase()) !== -1;
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
// Personal: keep strategy simple. (We can choose to always include company.)
function effectiveEnabledKeys() {
  const MUST_INCLUDE = ["company"];
  const base = new Set(Array.from(enabled || []));
  for (const k of MUST_INCLUDE) base.add(k);
  return Array.from(base);
}

/* ================= BLACK BAR masking ================= */
function redactBarFromText(txt){
  // Keep it readable but safe: length-based black bar with cap.
  const s = String(txt || "");
  const n = Math.max(4, Math.min(18, s.length)); // 4..18
  return "█".repeat(n);
}

/* ================= output render ================= */
function renderOutput(outPlain){
  lastOutputPlain = String(outPlain || "");
  const host = $("outputText");
  if (!host) return;

  // highlight black bars (>=4 chars)
  const html = escapeHTML(lastOutputPlain)
    .replace(/█{4,}/g, (m) => `<span class="hl">${m}</span>`);

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

/* ================= Manual term masking ================= */
function escapeRegExp(s){
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeTermRegex(term){
  const t = escapeRegExp(term);
  const hasCjk = /[\u4E00-\u9FFF]/.test(term);
  // CJK: exact match; Latin: case-insensitive
  return new RegExp(t, hasCjk ? "g" : "gi");
}

function applyManualTermsMask(out, addHit){
  if (!manualTerms || !manualTerms.length) return out;

  let s = String(out || "");
  for (const term of manualTerms) {
    const t = normalizeTerm(term);
    if (!t) continue;

    // when PDF: only mask if it exists in original PDF extracted text
    if (lastRunMeta.fromPdf) {
      if (!termAppearsInPdfOriginal(t)) continue;
    }

    const re = makeTermRegex(t);
    s = s.replace(re, (m) => {
      if (typeof addHit === "function") addHit("manual_term");
      return redactBarFromText(m);
    });
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

  // highlight manual terms too (only if appears in PDF original, to match actual masking behavior)
  if (manualTerms && manualTerms.length) {
    for (const term of manualTerms) {
      const t = normalizeTerm(term);
      if (!t) continue;
      if (lastRunMeta.fromPdf && !termAppearsInPdfOriginal(t)) continue;

      const re = makeTermRegex(t);
      s = s.replace(re, (m) => `${S1}${m}${S2}`);
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
      manual_term: "手工遮盖词"
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
      manual_term: "Manuelle Begriffe"
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
      manual_term: "Manual terms"
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

  // Mobile tabs
  if ($("ui-tab-in")) $("ui-tab-in").textContent = t.tabIn || "";
  if ($("ui-tab-out")) $("ui-tab-out").textContent = t.tabOut || "";

  // Panel labels
  const riskEl = $("ui-risk-title");
  if (riskEl) {
    const isLabel = (riskEl.tagName && riskEl.tagName.toUpperCase() === "LABEL") || riskEl.hasAttribute("for");
    riskEl.textContent = isLabel ? (t.panelRisk || t.riskTitle) : (t.riskTitle || "");
  }

  const achvEl = $("ui-share-title");
  if (achvEl) {
    const isLabel = (achvEl.tagName && achvEl.tagName.toUpperCase() === "LABEL") || achvEl.hasAttribute("for");
    achvEl.textContent = isLabel ? (t.panelAchv || t.shareTitle) : (t.shareTitle || "");
  }

  if ($("ui-panel-close")) $("ui-panel-close").textContent = t.panelClose || "";

  if ($("ui-share-sub")) $("ui-share-sub").textContent = t.shareSub;
  if ($("ui-achv-placeholder")) $("ui-achv-placeholder").textContent = t.achvPlaceholder;

  // Money selector removed (in case old HTML still contains it)
  const sel = $("moneyMode");
  if (sel) sel.style.display = "none";
  if ($("ui-money-label")) $("ui-money-label").textContent = "";

  if ($("btnGenerate")) $("btnGenerate").textContent = t.btnGenerate;
  if ($("btnCopy")) $("btnCopy").textContent = t.btnCopy;
  if ($("btnClear")) $("btnClear").textContent = t.btnClear;
  if ($("btnShareDownload")) $("btnShareDownload").textContent = t.btnDownload;

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

  // 1) manual terms first (highest priority)
  out = applyManualTermsMask(out, addHit);

  // 2) built-in rules
  if (rules) {
    for (const key of PRIORITY) {
      if (key !== "money" && !enabledSet.has(key)) continue;

      const r = rules[key];
      if (!r || !r.pattern) continue;

      if (key === "money") {
        // fixed M1
        out = out.replace(r.pattern, (m) => {
          addHit("money");
          return redactBarFromText(m);
        });
        continue;
      }

      out = out.replace(r.pattern, (m) => {
        addHit(key);
        return redactBarFromText(m);
      });
    }
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

  const hasOut = String(out || "").trim().length > 0;
  const rd = $("riskDetails");
  const ad = $("achvDetails");
  if (rd) rd.open = hasOut;
  if (ad) ad.open = hasOut;

  updateInputWatermarkVisibility();
  const ta = $("inputText");
  if (ta) renderInputOverlayForPdf(ta.value || "");

  // snapshot for other modules
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

  // Image defaults to manual mode
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

  // Manual terms input (HTML must provide id="manualTerms" OR fallback to id="nameList")
  const termInput = $("manualTerms") || $("nameList");
  if (termInput) {
    termInput.addEventListener("input", () => {
      setManualTermsFromText(termInput.value || "");
      const inTxt = (($("inputText") && $("inputText").value) || "").trim();
      if (inTxt) applyRules(inTxt);
      else window.dispatchEvent(new Event("safe:updated"));
      renderInputOverlayForPdf(($("inputText") && $("inputText").value) || "");
    });
    setManualTermsFromText(termInput.value || "");
  }

  const btnGenerate = $("btnGenerate");
if (btnGenerate) {
  btnGenerate.onclick = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); } // ✅ prevent <summary> toggling
    lastRunMeta.fromPdf = false;
    const wrap = $("inputWrap");
    if (wrap) wrap.classList.remove("pdf-overlay-on");
    if ($("inputOverlay")) $("inputOverlay").innerHTML = "";
    applyRules(($("inputText") && $("inputText").value) || "");
  };
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

      const rb = $("riskBox");
      if (rb) rb.innerHTML = "";

      const rd = $("riskDetails");
      const ad = $("achvDetails");
      if (rd) rd.open = false;
      if (ad) ad.open = false;

      if ($("pdfName")) $("pdfName").textContent = "";

      const wrap = $("inputWrap");
      if (wrap) {
        wrap.classList.remove("pdf-overlay-on");
        wrap.classList.remove("has-content");
      }
      if ($("inputOverlay")) $("inputOverlay").innerHTML = "";

      // reset manual terms
      manualTerms = [];
      const termInput = $("manualTerms") || $("nameList");
      if (termInput) termInput.value = "";

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
    const n = Number($("upCount").textContent || "0") + 1;
    $("upCount").textContent = String(n);
  };
  if (down) down.onclick = () => {
    const n = Number($("downCount").textContent || "0") + 1;
    $("downCount").textContent = String(n);
  };

  const ta = $("inputText");
  if (ta) {
    ta.addEventListener("input", () => {
      updateInputWatermarkVisibility();
      if (lastRunMeta.fromPdf) renderInputOverlayForPdf(ta.value || "");
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
      const rb = $("riskBox");
      const rd = $("riskDetails");
      if (rd) rd.open = true;

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

        // NOTE: For PDF raster-redaction to also mask manualTerms,
        // RasterExport must accept & apply snap.manualTerms. We'll wire that in raster-export.js next.
        say(`Working…\nlang=${escapeHTML(lang)}\nmoneyMode=M1\nenabledKeys=${enabledKeys.length}`);

        await window.RasterExport.exportRasterSecurePdfFromReadablePdf({
          file: f,
          lang,
          enabledKeys,
          moneyMode: "m1",
          dpi: 600,
          filename: `raster_secure_${Date.now()}.pdf`,
          manualTerms: Array.isArray(snap.manualTerms) ? snap.manualTerms : []
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
bind();
updateInputWatermarkVisibility();
