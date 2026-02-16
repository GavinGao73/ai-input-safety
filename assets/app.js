// assets/app.js
// ✅ This round (single goal):
// - Ensure RasterExport enabledKeys includes company + person_name,
//   so company/person rules actually participate in PDF redaction.
// - Keep everything else the same (no UI rewiring).

let currentLang = "zh";
window.currentLang = currentLang;

const enabled = new Set();
let moneyMode = "off"; // off | m1 | m2

let lastOutputPlain = "";

// ================= Stage 3 state (minimal glue) =================
let lastUploadedFile = null;       // File object (pdf or image)
let lastFileKind = "";             // "pdf" | "image" | ""
let lastProbe = null;              // { hasTextLayer, text }
let lastPdfOriginalText = "";      // extracted text for readable PDF
let lastStage3Mode = "none";       // "A" | "B" | "none"

function show(el, yes){
  if (!el) return;
  el.style.display = yes ? "" : "none";
}

// --- Risk scoring meta (local only) ---
let lastRunMeta = {
  fromPdf: false,
  inputLen: 0,
  enabledCount: 0,
  moneyMode: "off",
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

/* ================= ENABLED KEYS FOR EXPORT (THIS ROUND) ================= */
// Make export reflect product strategy: include company/person_name.
// (Even if the UI forgets to enable them.)
function effectiveEnabledKeys() {
  const MUST_INCLUDE = ["company", "person_name"];
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
      PERSON: "【姓名】"
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
      PERSON: "[Name]"
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
      PERSON: "[Name]"
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

  // we use sentinel tokens, then escape, then convert to spans
  const S1 = "⟦HIT⟧";
  const S2 = "⟦/HIT⟧";

  // ✅ SINGLE SOURCE OF TRUTH for enabled keys (auto-link with raster export)
  // Prefer snapshot created by applyRules(); fallback to current enabled Set.
  const snap = window.__export_snapshot || null;
  const enabledKeysArr = (snap && Array.isArray(snap.enabledKeys))
    ? snap.enabledKeys
    : Array.from(enabled || []);

  const enabledSet = new Set(enabledKeysArr);

  const PRIORITY = [
    "person_name",
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

  for (const key of PRIORITY) {
    // money is controlled by moneyMode, others by enabledSet
    if (key !== "money" && !enabledSet.has(key)) continue;

    const r = RULES_BY_KEY[key];
    if (!r || !r.pattern) continue;

    if (key === "money") {
      if (moneyMode === "off") continue;
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


/* ================= Money M2 ================= */
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
  Object.values(DETECTION_ITEMS).flat().forEach(i => {
    if (i.defaultOn) enabled.add(i.key);
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
  person_name: 10
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function riskI18n(lang) {
  const zh = {
    low: "低风险",
    mid: "中风险",
    high: "高风险",
    top: "主要风险来源",
    advice: "建议",
    adviceLow: "可以继续使用；合同/报价类建议开启金额保护。",
    adviceMid: "建议检查 Top 项；必要时加严遮盖。",
    adviceHigh: "不建议直接发送：请删除签名落款/账号信息，并加严遮盖后再试。",
    meta: (m) => `命中 ${m.hits}｜金额 ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜文件" : ""}`
  };
  const de = {
    low: "Niedrig",
    mid: "Mittel",
    high: "Hoch",
    top: "Top-Risiken",
    advice: "Empfehlung",
    adviceLow: "Kann verwendet werden. Für Angebote/Verträge Betragsschutz aktivieren.",
    adviceMid: "Top-Risiken prüfen; ggf. stärker maskieren.",
    adviceHigh: "Nicht direkt senden: Signatur/Kontodaten entfernen und mehr Maskierung aktivieren.",
    meta: (m) => `Treffer ${m.hits}｜Betrag ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜Datei" : ""}`
  };
  const en = {
    low: "Low",
    mid: "Medium",
    high: "High",
    top: "Top risk sources",
    advice: "Advice",
    adviceLow: "Ok to use. For quotes/contracts, enable money protection.",
    adviceMid: "Review top risks; consider stronger masking.",
    adviceHigh: "Do not send as-is: remove signature/account details and mask more.",
    meta: (m) => `Hits ${m.hits}｜Money ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜File" : ""}`
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
      person_name: "姓名"
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
      person_name: "Name"
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
      person_name: "Name"
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

  if (meta.moneyMode === "m1") score += 10;
  if (meta.moneyMode === "m2") score += 14;

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
    de: { btnExportText: "Text", btnExportPdf: "Raster-PDF", btnManual: "Manuell" },
    en: { btnExportText: "Export text", btnExportPdf: "Raster PDF", btnManual: "Manual" }
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

  if (btnText) btnText.textContent = stage3Text("btnExportText");
  if (btnPdf)  btnPdf.textContent  = stage3Text("btnExportPdf");
  if (btnMan)  btnMan.textContent  = stage3Text("btnManual");
}

/* ================= UI text ================= */
function setText() {
  const t = I18N[currentLang];
  window.currentLang = currentLang;

  if ($("ui-in-title")) $("ui-in-title").textContent = t.inTitle;
  if ($("ui-out-title")) $("ui-out-title").textContent = t.outTitle;

  if ($("inputText")) $("inputText").placeholder = t.placeholder;
  if ($("ui-input-watermark")) $("ui-input-watermark").textContent = t.inputWatermark;

  if ($("ui-upload-btn")) $("ui-upload-btn").textContent = t.btnUpload;

  if ($("ui-risk-title")) $("ui-risk-title").textContent = t.riskTitle;
  if ($("ui-share-title")) $("ui-share-title").textContent = t.shareTitle;
  if ($("ui-share-sub")) $("ui-share-sub").textContent = t.shareSub;
  if ($("ui-achv-placeholder")) $("ui-achv-placeholder").textContent = t.achvPlaceholder;

  const label = $("ui-money-label");
  const sel = $("moneyMode");
  if (label) label.textContent = t.moneyLabel;
  if (sel && sel.options && sel.options.length >= 3) {
    sel.options[0].text = t.moneyOff;
    sel.options[1].text = t.moneyM1;
    sel.options[2].text = t.moneyM2;
  }

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
    "person_name",
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
  if (!rules) {
    lastRunMeta.inputLen = out.length;
    lastRunMeta.enabledCount = enabled.size;
    lastRunMeta.moneyMode = moneyMode;
    lastRunMeta.lang = currentLang;

    renderOutput(out);
    const report = computeRiskReport({}, {
      hits: 0,
      enabledCount: enabled.size,
      moneyMode,
      fromPdf: lastRunMeta.fromPdf,
      inputLen: out.length
    });
    renderRiskBox(report, {
      hits: 0,
      enabledCount: enabled.size,
      moneyMode,
      fromPdf: lastRunMeta.fromPdf,
      inputLen: out.length
    });

    updateInputWatermarkVisibility();
    const ta = $("inputText");
    if (ta) renderInputOverlayForPdf(ta.value || "");

    // IMPORTANT: snapshot for export
    window.__export_snapshot = {
      enabledKeys: effectiveEnabledKeys(),
      moneyMode: (typeof moneyMode === "string" ? moneyMode : "off"),
      lang: currentLang,
      fromPdf: !!lastRunMeta.fromPdf
    };

    window.dispatchEvent(new Event("safe:updated"));
    return out;
  }

    // ✅ OUTPUT uses the same enabled set as overlay + raster export
  const snap2 = window.__export_snapshot || null;
  const enabledKeysArr2 = (snap2 && Array.isArray(snap2.enabledKeys))
    ? snap2.enabledKeys
    : effectiveEnabledKeys();
  const enabledSet2 = new Set(enabledKeysArr2);

  for (const key of PRIORITY) {
    if (key !== "money" && !enabledSet2.has(key)) continue;

    const r = rules[key];
    if (!r || !r.pattern) continue;

    if (key === "money") {
      if (moneyMode === "off") continue;

      out = out.replace(r.pattern, (m, cur1, amt1, sym, amt2, amt3, unit) => {
        addHit("money");

        if (moneyMode === "m1") return placeholder("MONEY");

        const currencyRaw = cur1 || sym || unit || "";
        const amountRaw = amt1 || amt2 || amt3 || "";
        const currency = formatCurrencyForM2(currencyRaw);
        const num = normalizeAmountToNumber(amountRaw);
        const range = moneyRangeLabel(currencyRaw, num);

        if (currentLang === "zh") return (currency ? currency : "") + "【" + range + "】";
        return (currency ? currency : "") + "[" + range + "]";
      });

      continue;
    }

    out = out.replace(r.pattern, () => {
      addHit(key);
      return placeholder(r.tag);
    });
  }

  lastRunMeta.inputLen = (String(text || "")).length;
  lastRunMeta.enabledCount = enabled.size;
  lastRunMeta.moneyMode = moneyMode;
  lastRunMeta.lang = currentLang;

  const report = computeRiskReport(hitsByKey, {
    hits,
    enabledCount: lastRunMeta.enabledCount,
    moneyMode: lastRunMeta.moneyMode,
    fromPdf: lastRunMeta.fromPdf,
    inputLen: lastRunMeta.inputLen
  });

  window.__safe_hits = hits;
  window.__safe_moneyMode = moneyMode;
  window.__safe_breakdown = hitsByKey;
  window.__safe_score = report.score;
  window.__safe_level = report.level;
  window.__safe_report = {
    hits,
    hitsByKey,
    score: report.score,
    level: report.level,
    moneyMode,
    enabledCount: enabled.size,
    fromPdf: lastRunMeta.fromPdf
  };

  renderOutput(out);
  renderRiskBox(report, {
    hits,
    enabledCount: enabled.size,
    moneyMode,
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

  // IMPORTANT: snapshot for export
  window.__export_snapshot = {
    enabledKeys: effectiveEnabledKeys(),
    moneyMode: (typeof moneyMode === "string" ? moneyMode : "off"),
    lang: currentLang,
    fromPdf: !!lastRunMeta.fromPdf
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
  document.querySelectorAll(".lang button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".lang button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentLang = b.dataset.lang;
      window.currentLang = currentLang;

      setText();

      const ta = $("inputText");
      const inTxt = (ta && ta.value) ? String(ta.value).trim() : "";

      if (inTxt) {
        applyRules(inTxt);
      } else {
        window.dispatchEvent(new Event("safe:updated"));
      }

      if (ta) renderInputOverlayForPdf(ta.value || "");
    };
  });

  const mm = $("moneyMode");
  if (mm) {
    mm.addEventListener("change", () => {
      moneyMode = mm.value || "off";
      const inTxt = ($("inputText").value || "").trim();
      if (inTxt) {
        applyRules(inTxt);
      } else {
        window.__safe_moneyMode = moneyMode;
        window.dispatchEvent(new Event("safe:updated"));
      }
      renderInputOverlayForPdf($("inputText").value || "");
    });

    moneyMode = mm.value || "off";
    window.__safe_moneyMode = moneyMode;
  }

  $("btnGenerate").onclick = () => {
    lastRunMeta.fromPdf = false;
    const wrap = $("inputWrap");
    if (wrap) wrap.classList.remove("pdf-overlay-on");
    if ($("inputOverlay")) $("inputOverlay").innerHTML = "";
    applyRules($("inputText").value || "");
  };

  $("btnClear").onclick = () => {
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

    lastUploadedFile = null;
    lastFileKind = "";
    lastProbe = null;
    lastPdfOriginalText = "";
    setStage3Ui("none");

    window.__export_snapshot = null;

    window.dispatchEvent(new Event("safe:updated"));
  };

  $("btnCopy").onclick = async () => {
    const t = I18N[currentLang];
    try {
      await navigator.clipboard.writeText(lastOutputPlain || "");
      const btn = $("btnCopy");
      if (btn) {
        const old = btn.textContent;
        btn.textContent = t.btnCopied || old;
        setTimeout(() => { btn.textContent = t.btnCopy || old; }, 900);
      }
    } catch (e) {}
  };

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
        if (!lastProbe) { say(`<span style="color:#ffb4b4;">No PDF probe result (probePdfTextLayer missing or failed)</span>`); return; }
        if (!lastProbe.hasTextLayer) { say(`<span style="color:#ffb4b4;">PDF not readable (Mode B). Use Manual.</span>`); return; }

        if (!window.RasterExport) { say(`<span style="color:#ffb4b4;">RasterExport not loaded</span>`); return; }
        if (!window.RasterExport.exportRasterSecurePdfFromReadablePdf) {
          say(`<span style="color:#ffb4b4;">RasterExport API missing (exportRasterSecurePdfFromReadablePdf)</span>`);
          return;
        }

        const snap = window.__export_snapshot || {};
        const enabledKeys = Array.isArray(snap.enabledKeys) ? snap.enabledKeys : effectiveEnabledKeys();
        const mm = (typeof snap.moneyMode === "string") ? snap.moneyMode : (typeof moneyMode === "string" ? moneyMode : "off");
        const lang = snap.lang || currentLang;

        say(`Working…\nlang=${escapeHTML(lang)}\nmoneyMode=${escapeHTML(mm)}\nenabledKeys=${enabledKeys.length}`);

        await window.RasterExport.exportRasterSecurePdfFromReadablePdf({
          file: f,
          lang,
          enabledKeys,
          moneyMode: mm,
          dpi: 600,
          filename: `raster_secure_${Date.now()}.pdf`
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

