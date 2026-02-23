// =========================
// assets/engine.js (from app.js)
// =========================

console.log("[engine.js] loaded v20260222a1");

// ✅ Language is owned by UI / i18n.js.
// ✅ engine.js must NEVER overwrite window.currentLang
function getLang() {
  const l = String(window.currentLang || "").toLowerCase();
  return (l === "en" || l === "de" || l === "zh") ? l : "zh";
}

const enabled = new Set();

// ✅ Money protection always ON (M1). No UI selector.
let moneyMode = "m1";
window.__safe_moneyMode = moneyMode;

let lastOutputPlain = "";

// ================= Stage 3 state =================
let lastUploadedFile = null;       // File object (pdf or image)
let lastFileKind = "";             // "pdf" | "image" | ""
let lastProbe = null;              // { hasTextLayer, text }
let lastPdfOriginalText = "";      // extracted text for readable PDF
let lastStage3Mode = "none";       // "A" | "B" | "none"

// store manual redaction session/result (Mode B export via main button)
let __manualRedactSession = null;
let __manualRedactResult = null;

// ================= Manual terms =================
let manualTerms = [];

function normalizeTerm(s){
  return String(s || "").trim();
}

/**
 * - split by comma/newline/;、 etc
 * - dedup case-insensitive
 * - cap 24
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

function isSmallScreen(){
  try {
    return !!(window.matchMedia && window.matchMedia("(max-width: 560px)").matches);
  } catch (_) {
    return false;
  }
}

// --- Risk scoring meta ---
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

// ================= RULES SAFE ACCESS =================
function getRulesSafe() {
  // New build: RULES_BY_LANG + RULES_COMMON
  if (window.RULES_BY_LANG && window.RULES_COMMON) {
    const lang = getLang();
    const spec = window.RULES_BY_LANG[lang] || {};
    const merged = Object.assign({}, window.RULES_COMMON, spec);
    return (merged && typeof merged === "object") ? merged : null;
  }

  // Old build: RULES_BY_KEY
  const r = window.RULES_BY_KEY;
  return (r && typeof r === "object") ? r : null;
}

// ================= ENABLED KEYS FOR EXPORT =================
function effectiveEnabledKeys() {
  const MUST_INCLUDE = ["company"]; // keep as-is (your build choice)
  const base = new Set(Array.from(enabled || []));
  for (const k of MUST_INCLUDE) base.add(k);
  return Array.from(base);
}

// ================= placeholders =================
function placeholder(key) {
  const map = {
    zh: {
      PHONE: "【电话】",
      EMAIL: "【邮箱】",
      URL: "【网址】",
      SECRET: "【敏感】",
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
      URL: "[URL]",
      SECRET: "[Geheim]",
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
      URL: "[URL]",
      SECRET: "[Secret]",
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

  const lang = getLang();
  return (map[lang] && map[lang][key]) || `[${key}]`;
}

// ================= output render =================
function renderOutput(outPlain){
  lastOutputPlain = String(outPlain || "");
  const host = $("outputText");
  if (!host) return;

  const html = escapeHTML(lastOutputPlain)
    .replace(/(【[^【】]{1,36}】|\[[^\[\]]{1,36}\])/g, `<span class="hl">$1</span>`);

  host.innerHTML = html;
}

// ================= input watermark hide =================
function updateInputWatermarkVisibility(){
  const ta = $("inputText");
  const wrap = $("inputWrap");
  if (!ta || !wrap) return;
  const has = String(ta.value || "").trim().length > 0;
  wrap.classList.toggle("has-content", has);
}

// ================= Manual terms masking =================
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

// ================= PDF overlay highlight =================
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

  // ✅ Always-on for zh-stable build (UI fixed, but coverage must be stable)
  // ✅ include label-driven keys so they always work in zh build
  const ALWAYS_ON = new Set([
    "secret",
    "url",
    "email",
    "phone",
    "account",
    "bank",
    "company",
    "handle_label",
    "ref_label",
    "address_cn"
  ]);

  const PRIORITY = [
    "secret",
    "account",
    "bank",
    "email",
    "url",
    "phone",
    "company",
    "handle_label",
    "ref_label",
    "address_cn",
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
    if (key !== "money" && !enabledSet.has(key) && !ALWAYS_ON.has(key)) continue;

    const r = window.RULES_BY_KEY && window.RULES_BY_KEY[key];
    if (!r || !r.pattern) continue;

    // ✅ prefix highlight: keep label, highlight ONLY value group
    if (r.mode === "prefix") {
      s = s.replace(r.pattern, (m, p1, p2) => {
        const label = p1 || "";
        const val = p2 || "";
        return `${label}${S1}${val}${S2}`;
      });
      continue;
    }

    // ✅ address_cn_partial highlight: highlight only the "road+no" segment when present; else whole value
    if (r.mode === "address_cn_partial") {
      s = s.replace(r.pattern, (m, p1, p2) => {
        const label = p1 || "";
        const val = p2 || "";
        const reRoadNo = /([\u4E00-\u9FFF]{1,20}(?:路|街|道|大道|巷|弄))\s*(\d{1,6}\s*号)/g;
        if (reRoadNo.test(val)) {
          const markedVal = val.replace(reRoadNo, (mm, a, b) => `${a}${S1}${b}${S2}`);
          return `${label}${markedVal}`;
        }
        return `${label}${S1}${val}${S2}`;
      });
      continue;
    }

    // ✅ phone highlight: keep label if captured; skip if digits look like account/card (>=16)
    if (r.mode === "phone") {
      s = s.replace(r.pattern, (m, p1, p2, p3, p4) => {
        const label = p1 || "";
        const value = (p2 || p3 || p4 || m);
        const digits = String(value).replace(/\D+/g, "");
        if (digits.length >= 16) return m;

        if (label) return `${label}${S1}${m.slice(label.length)}${S2}`;
        return `${S1}${m}${S2}`;
      });
      continue;
    }

    // ✅ company highlight: highlight only the identifiable part, keep FULL legal suffix visible
    if (r.mode === "company") {
      s = s.replace(r.pattern, (...args) => {
        const m = String(args[0] || "");

        // preserve trailing punctuation (readability)
        const punctMatch = m.match(/[。．.，,;；!！?？)）】\]\s]+$/u);
        const punct = punctMatch ? punctMatch[0] : "";
        const coreStr = punct ? m.slice(0, -punct.length) : m;

        // ✅ extract FULL legal suffix only from the end (CN)
        const sufMatch = coreStr.match(/(集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司)$/u);
        if (sufMatch) {
          const suffix = sufMatch[1];
          const head = coreStr.slice(0, coreStr.length - suffix.length);
          return `${S1}${head}${S2}${suffix}${punct}`;
        }

        // --- DE/EN fallback: keep legal form visible, highlight name ---
        const groups = args[args.length - 1];
        if (groups && typeof groups === "object" && groups.legal) {
          return `${S1}${groups.name || ""}${S2}${groups.legal || ""}${punct}`;
        }

        // fallback: highlight whole match
        return `${S1}${m}${S2}`;
      });
      continue;
    }

    // default highlight: whole match
    s = s.replace(r.pattern, (m) => `${S1}${m}${S2}`);
  }

  const esc = escapeHTML(s);
  return esc
    .replaceAll(S1, `<span class="hit">`)
    .replaceAll(S2, `</span>`);
}

// ================= init enabled =================
function initEnabled() {
  enabled.clear();
  Object.values(window.DETECTION_ITEMS || {}).flat().forEach(i => {
    if (i && i.defaultOn) enabled.add(i.key);
  });
}

// ================= Risk scoring =================
const RISK_WEIGHTS = {
  bank: 28,
  account: 26,
  email: 14,
  url: 10,
  secret: 30,
  phone: 16,
  address_de_street: 18,
  address_cn: 18,
  handle_label: 10,
  ref_label: 6,
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
      url: "网址/链接",
      secret: "密码/验证码",
      phone: "电话",
      address_de_street: "地址（街道门牌）",
      address_cn: "地址（路号）",
      handle_label: "账号名/登录/IM",
      ref_label: "编号（申请/订单/参考）",
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
      url: "URL/Link",
      secret: "Passwort/Code",
      phone: "Telefon",
      address_de_street: "Adresse (Straße/Nr.)",
      address_cn: "Adresse (Straße/Nr.)",
      handle_label: "Handle/Account",
      ref_label: "Referenz",
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
      url: "URL/Link",
      secret: "Password/OTP",
      phone: "Phone",
      address_de_street: "Address (street/no.)",
      address_cn: "Address (street/no.)",
      handle_label: "Handle/Account",
      ref_label: "Reference",
      handle: "Handle/Account",
      ref: "Reference",
      title: "Title",
      number: "Numbers",
      money: "Money",
      company: "Company",
      manual_term: "Extra (manual)"
    }
  };
  const m = map[getLang()] || map.zh;
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

  const t = riskI18n(getLang());
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

// ================= rule application =================
function applyRules(text) {
  let out = String(text || "");
  let hits = 0;
  const hitsByKey = {};

  const PRIORITY = [
    "secret",
    "account",
    "bank",
    "email",
    "url",
    "phone",
    "company",
    "handle_label",
    "ref_label",
    "address_cn",
    "money",
    "address_de_street",
    "handle",
    "ref",
    "title",
    "number"
  ];

  // ✅ Always-on keys for zh-stable build (UI fixed, but coverage must be stable)
  // ✅ include label-driven keys so they always work in zh build
  const ALWAYS_ON = new Set([
    "secret",
    "url",
    "email",
    "phone",
    "account",
    "bank",
    "company",
    "handle_label",
    "ref_label",
    "address_cn"
  ]);

  function addHit(key) {
    hits++;
    hitsByKey[key] = (hitsByKey[key] || 0) + 1;
  }

  function protectPlaceholders(s){
    const map = [];
    const re = /(【[^【】]{1,36}】|\[[^\[\]]{1,36}\])/g;
    const t = String(s || "").replace(re, (m) => {
      const id = map.length;
      map.push(m);
      return `\uE000${id}\uE001`; // sentinel
    });
    return { t, map };
  }

  function restorePlaceholders(s, map){
    let t = String(s || "");
    for (let i = 0; i < (map || []).length; i++) {
      const token = new RegExp(`\\uE000${i}\\uE001`, "g");
      t = t.replace(token, map[i]);
    }
    return t;
  }

  const rules = getRulesSafe();

  const enabledKeysArr = effectiveEnabledKeys();
  const enabledSet = new Set(enabledKeysArr);

  lastRunMeta.inputLen = (String(text || "")).length;
  lastRunMeta.enabledCount = enabledSet.size;
  lastRunMeta.moneyMode = "m1";
  lastRunMeta.lang = getLang();

  if (!rules) {
    out = applyManualTermsMask(out, () => addHit("manual_term"));
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
      lang: getLang(),
      fromPdf: !!lastRunMeta.fromPdf,
      manualTerms: manualTerms.slice(0)
    };

    requestAnimationFrame(() => {
      if (lastUploadedFile) {
        expandManualArea();
        expandRiskArea();
        syncManualRiskHeights();
      }
    });

    window.dispatchEvent(new Event("safe:updated"));
    return out;
  }

  // manual first
  out = applyManualTermsMask(out, () => addHit("manual_term"));

  // ✅ protect already-inserted placeholders against "串味" / second-pass matching
  const p0 = protectPlaceholders(out);
  out = p0.t;

  for (const key of PRIORITY) {
    if (key !== "money" && !enabledSet.has(key) && !ALWAYS_ON.has(key)) continue;

    const r = rules[key];
    if (!r || !r.pattern) continue;

    // ✅ money: keep steady mode (M1) — always mask whole amount
    if (key === "money") {
      out = out.replace(r.pattern, () => {
        addHit("money");
        return placeholder("MONEY");
      });
      continue;
    }

    // ✅ mode-aware replacement:
    out = out.replace(r.pattern, (...args) => {
      const match = args[0] || "";

      // 1) prefix: (label)(value)
      if (r.mode === "prefix") {
        const label = args[1] || "";
        addHit(key);
        return `${label}${placeholder(r.tag)}`;
      }

      // ✅ CN address partial: keep label + value; only mask "号" portion when possible
      if (r.mode === "address_cn_partial") {
        const label = args[1] || "";
        const val = args[2] || "";
        const reRoadNo = /([\u4E00-\u9FFF]{1,20}(?:路|街|道|大道|巷|弄))\s*(\d{1,6}\s*号)/g;

        if (reRoadNo.test(val)) {
          addHit(key);
          const v2 = val.replace(reRoadNo, (m2, a, b) => `${a}${placeholder("ADDRESS")}`);
          return `${label}${v2}`;
        }

        // no road/no pattern -> keep as-is (do not change unrelated content)
        return match;
      }

      // 2) phone: keep label if possible; guard card/account digits (>=16)
      if (r.mode === "phone") {
        const label = args[1] || "";
        const vA = args[2] || "";
        const vB = args[3] || "";
        const vC = args[4] || "";
        const value = vA || vB || vC || match;

        const digits = String(value).replace(/\D+/g, "");
        if (digits.length >= 16) {
          // do not replace; let account/bank handle it
          return match;
        }

        addHit(key);
        if (label) return `${label}${placeholder(r.tag)}`;
        return placeholder(r.tag);
      }

      // 3) company: ✅ keep FULL legal suffix (CN), tolerate masking geo/industry
      if (r.mode === "company") {
        const raw = String(match || "");

        // preserve trailing punctuation
        const punctMatch = raw.match(/[。．.，,;；!！?？)）】\]\s]+$/u);
        const punct = punctMatch ? punctMatch[0] : "";
        const coreStr = punct ? raw.slice(0, -punct.length) : raw;

        // CN: keep FULL legal suffix (must be完整保留)
        const sufMatch = coreStr.match(/(集团有限公司|股份有限公司|有限责任公司|有限公司|集团|公司)$/u);

        addHit(key);

        if (sufMatch) {
          return `${placeholder(r.tag)}${sufMatch[1]}${punct}`;
        }

        // DE/EN: if named groups exist, keep legal form
        const groups = args[args.length - 1];
        if (groups && typeof groups === "object" && groups.legal) {
          return `${placeholder(r.tag)}${groups.legal}${punct}`;
        }

        // unknown shape -> mask whole
        return placeholder(r.tag);
      }

      // default: mask whole match
      addHit(key);
      return placeholder(r.tag);
    });
  }

  // ✅ restore placeholders after all rules
  out = restorePlaceholders(out, p0.map);

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
    lang: getLang(),
    fromPdf: !!lastRunMeta.fromPdf,
    manualTerms: manualTerms.slice(0)
  };

  requestAnimationFrame(() => {
    if (lastUploadedFile) {
      expandManualArea();
      expandRiskArea();
      syncManualRiskHeights();
    }
  });

  window.dispatchEvent(new Event("safe:updated"));
  return out;
}

/* =========================
   ✅ STABILITY PATCHES (no behavior change)
   - ensure window.$ exists (for console debug and other scripts)
   - avoid hard crash if some UI helpers are loaded elsewhere but missing due to order
   ========================= */
try {
  if (typeof window.$ !== "function") window.$ = $;
} catch (_) {}

try {
  if (typeof window.expandManualArea !== "function") window.expandManualArea = function(){};
  if (typeof window.expandRiskArea !== "function") window.expandRiskArea = function(){};
  if (typeof window.syncManualRiskHeights !== "function") window.syncManualRiskHeights = function(){};
  // If they exist globally under window, prefer those
  if (typeof expandManualArea !== "function") var expandManualArea = window.expandManualArea;
  if (typeof expandRiskArea !== "function") var expandRiskArea = window.expandRiskArea;
  if (typeof syncManualRiskHeights !== "function") var syncManualRiskHeights = window.syncManualRiskHeights;
} catch (_) {}
