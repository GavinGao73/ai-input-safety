let currentLang = "zh";
window.currentLang = currentLang;

const enabled = new Set();
let moneyMode = "off"; // off | m1 | m2

// --- Risk scoring meta (local only) ---
let lastRunMeta = {
  fromPdf: false,
  inputLen: 0,
  enabledCount: 0,
  moneyMode: "off",
  lang: "zh"
};

function $(id) { return document.getElementById(id); }

// ---- Local i18n fallback (do NOT depend on assets/i18n.js completeness) ----
function uiText(lang) {
  const zh = {
    inTitle: "在 AI 读取之前，先通过 Filter。",
    outTitle: "过滤后文本，可直接粘贴给 AI。",
    placeholder: "粘贴准备上传给 AI 的文字或文件内容…",
    inputWatermark:
      "AI 系统可以解析文档中的隐藏文本结构。\n本工具仅在本地运行，不上传、不保存内容。",
    moneyLabel: "金额：",
    moneyOff: "关闭",
    moneyM1: "M1",
    moneyM2: "M2",
    btnGenerate: "过滤输入内容",
    btnClear: "清空",
    btnCopy: "复制",
    btnCopied: "✔ 已复制",
    fbQ: "有帮助吗？",
    foot: "本工具仅提供风险提示，不构成法律建议。",
    riskTitle: "风险评分",
    learn: "了解更多",
    privacy: "隐私原则",
    scope: "MVP 范围",
    fileNone: "未选择文件",
    achieveTitle: "过滤成就",
    achieveSub: "不含原文，仅展示处理统计与隐私承诺",
    achievePlaceholder: "生成过滤结果后，这里会显示成就卡片预览。",
    btnDownload: "下载"
  };

  const en = {
    inTitle: "Filter before AI reads.",
    outTitle: "Filtered text — paste to AI directly.",
    placeholder: "Paste what you plan to upload or send to AI…",
    inputWatermark:
      "AI systems can extract hidden text-layer data.\nAll processing runs locally. Nothing is stored or transmitted.",
    moneyLabel: "Money:",
    moneyOff: "Off",
    moneyM1: "M1",
    moneyM2: "M2",
    btnGenerate: "Filter input",
    btnClear: "Clear",
    btnCopy: "Copy",
    btnCopied: "✔ Copied",
    fbQ: "Helpful?",
    foot: "Risk hints only. Not legal advice.",
    riskTitle: "Risk score",
    learn: "Learn more",
    privacy: "Privacy",
    scope: "MVP scope",
    fileNone: "No file selected",
    achieveTitle: "Filter achievement",
    achieveSub: "No original text — stats & privacy pledge only",
    achievePlaceholder: "After you filter, an achievement card preview will appear here.",
    btnDownload: "Download"
  };

  const de = {
    inTitle: "Filter, bevor KI liest.",
    outTitle: "Gefilterter Text — direkt in KI einfügen.",
    placeholder: "Text einfügen, den du an KI senden willst…",
    inputWatermark:
      "KI-Systeme lesen auch verborgene Textlayer-Daten.\nVerarbeitung erfolgt ausschließlich lokal. Keine Speicherung.",
    moneyLabel: "Betrag:",
    moneyOff: "Aus",
    moneyM1: "M1",
    moneyM2: "M2",
    btnGenerate: "Eingabe filtern",
    btnClear: "Leeren",
    btnCopy: "Kopieren",
    btnCopied: "✔ Kopiert",
    fbQ: "Hilfreich?",
    foot: "Nur Risikohinweise. Keine Rechtsberatung.",
    riskTitle: "Risikowert",
    learn: "Mehr erfahren",
    privacy: "Datenschutz",
    scope: "MVP-Umfang",
    fileNone: "Keine Datei gewählt",
    achieveTitle: "Filter-Erfolg",
    achieveSub: "Kein Originaltext — nur Statistik & Versprechen",
    achievePlaceholder: "Nach dem Filtern erscheint hier eine Vorschau der Erfolgskarte.",
    btnDownload: "Download"
  };

  return (lang === "de") ? de : (lang === "en") ? en : zh;
}

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
      MONEY: "【金额】"
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
      MONEY: "[Betrag]"
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
      MONEY: "[Amount]"
    }
  };
  return (map[currentLang] && map[currentLang][key]) || `[${key}]`;
}

// ---- Money range mapping (M2) ----
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

// ---- init enabled ----
function initEnabled() {
  enabled.clear();
  Object.values(DETECTION_ITEMS).flat().forEach(i => {
    if (i.defaultOn) enabled.add(i.key);
  });
}

/* ==================== Risk scoring (A) v1 ==================== */
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
  money: 0
};

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function riskI18n(lang) {
  const zh = {
    low: "低风险",
    mid: "中风险",
    high: "高风险",
    top: "主要风险来源",
    advice: "建议",
    adviceLow: "可以使用；如为报价/合同类内容，可开启金额保护。",
    adviceMid: "请检查 Top 项；必要时加强金额/地址/账号遮盖。",
    adviceHigh: "不建议直接发送：请删签名落款/账号信息，并加严遮盖后再试。",
    meta: (m) => `命中 ${m.hits}｜金额 ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜文件" : ""}`
  };
  const de = {
    low: "Niedrig",
    mid: "Mittel",
    high: "Hoch",
    top: "Top-Risiken",
    advice: "Empfehlung",
    adviceLow: "Kann verwendet werden. Für Angebote/Verträge ggf. Betragsschutz aktivieren.",
    adviceMid: "Top-Risiken prüfen; ggf. Betrag/Adresse/Konto stärker maskieren.",
    adviceHigh: "Nicht direkt senden: Signatur/Kontodaten entfernen und mehr Maskierung aktivieren.",
    meta: (m) => `Treffer ${m.hits}｜Betrag ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜Datei" : ""}`
  };
  const en = {
    low: "Low",
    mid: "Medium",
    high: "High",
    top: "Top risk sources",
    advice: "Advice",
    adviceLow: "Ok to use. For quotes/contracts, consider money protection.",
    adviceMid: "Review top risks; consider stronger money/address/account masking.",
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
      money: "金额"
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
      money: "Betrag"
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
      money: "Money"
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
  const fold = $("riskFold");
  if (!box || !fold) return;

  const tt = riskI18n(currentLang);
  const levelText = report.level === "high" ? tt.high : report.level === "mid" ? tt.mid : tt.low;

  const topHtml = (report.top && report.top.length)
    ? report.top.map(x => {
      return `<div class="riskitem">
        <span class="rk">${labelForKey(x.k)}</span>
        <span class="rv">${x.c}</span>
      </div>`;
    }).join("")
    : `<div class="tiny muted">-</div>`;

  const advice =
    report.level === "high" ? tt.adviceHigh :
    report.level === "mid" ? tt.adviceMid :
    tt.adviceLow;

  box.innerHTML = `
    <div class="riskhead">
      <div class="riskleft">
        <div class="riskmeta">${tt.meta(meta)}</div>
      </div>

      <div class="riskscore">
        <div class="n">${report.score}</div>
        <div class="l">${levelText}</div>
      </div>
    </div>

    <div class="risksec">
      <div class="risklabel">${tt.top}</div>
      <div class="risklist">${topHtml}</div>
    </div>

    <div class="risksec">
      <div class="risklabel">${tt.advice}</div>
      <div class="riskadvice">${advice}</div>
    </div>
  `;

  // risk fold stays collapsed by default; only open when user chooses
}

function setText() {
  const t = uiText(currentLang);

  window.currentLang = currentLang;

  // headings
  if ($("ui-in-title")) $("ui-in-title").textContent = t.inTitle;
  if ($("ui-out-title")) $("ui-out-title").textContent = t.outTitle;

  // input
  if ($("inputText")) $("inputText").placeholder = t.placeholder;
  if ($("ui-input-watermark")) $("ui-input-watermark").textContent = t.inputWatermark;

  // money
  const label = $("ui-money-label");
  const sel = $("moneyMode");
  if (label) label.textContent = t.moneyLabel;
  if (sel && sel.options && sel.options.length >= 3) {
    sel.options[0].text = t.moneyOff;
    sel.options[1].text = t.moneyM1;
    sel.options[2].text = t.moneyM2;
  }

  // buttons
  if ($("btnGenerate")) $("btnGenerate").textContent = t.btnGenerate;
  if ($("btnClear")) $("btnClear").textContent = t.btnClear;
  if ($("btnCopy")) $("btnCopy").textContent = t.btnCopy;

  // feedback
  if ($("ui-fb-q")) $("ui-fb-q").textContent = t.fbQ;

  // risk title (summary)
  if ($("ui-risk-title")) $("ui-risk-title").textContent = t.riskTitle;

  // achievement (summary + sub + placeholder + download)
  if ($("ui-ach-title")) $("ui-ach-title").textContent = t.achieveTitle;
  if ($("ui-ach-sub")) $("ui-ach-sub").textContent = t.achieveSub;
  if ($("achPlaceholder")) $("achPlaceholder").textContent = t.achievePlaceholder;
  if ($("btnShareDownload")) $("btnShareDownload").textContent = t.btnDownload;

  // links
  if ($("linkLearn")) $("linkLearn").textContent = t.learn;
  if ($("linkPrivacy")) $("linkPrivacy").textContent = t.privacy;
  if ($("linkScope")) $("linkScope").textContent = t.scope;

  // footer
  if ($("ui-foot")) $("ui-foot").textContent = t.foot;

  // filename default
  const fn = $("fileName");
  if (fn && !fn.textContent) fn.textContent = t.fileNone;
}

// ---- rule application ----
function applyRules(text) {
  let out = String(text || "");
  let hits = 0;
  const hitsByKey = {};

  const PRIORITY = [
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

  for (const key of PRIORITY) {
    if (key !== "money" && !enabled.has(key)) continue;

    const r = RULES_BY_KEY[key];
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

    const tag = r.tag;

    if (r.mode === "prefix") {
      out = out.replace(r.pattern, (m, prefix) => {
        addHit(key);
        return String(prefix || "") + placeholder(tag);
      });
      continue;
    }

    if (r.mode === "phone") {
      out = out.replace(r.pattern, (m, prefix) => {
        addHit(key);
        if (prefix) return String(prefix) + placeholder(tag);
        return placeholder(tag);
      });
      continue;
    }

    out = out.replace(r.pattern, () => {
      addHit(key);
      return placeholder(tag);
    });
  }

  // --- Risk meta
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

  // ✅ Share metrics (local-only globals used by share.js)
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

  renderRiskBox(report, {
    hits,
    enabledCount: enabled.size,
    moneyMode,
    fromPdf: lastRunMeta.fromPdf,
    inputLen: lastRunMeta.inputLen
  });

  // ✅ 你要的“自动刷新成就卡片”触发
  window.dispatchEvent(new Event("safe:updated"));

  return out;
}

/* ============ PDF helpers (text-layer probe) ============ */
async function handlePdf(file) {
  if (!file) return;

  const fn = $("fileName");
  if (fn) fn.textContent = file.name || uiText(currentLang).fileNone;

  if (file.type !== "application/pdf") return;

  try {
    if (!window.probePdfTextLayer) return;

    const probe = await window.probePdfTextLayer(file);
    lastRunMeta.fromPdf = true;

    if (!probe || !probe.hasTextLayer) return;

    const text = String(probe.text || "").trim();
    if (!text) return;

    // ✅ 用户现在希望：选择 PDF 后，输入框也有内容
    const input = $("inputText");
    if (input) input.value = text;

    // 同时生成过滤结果
    const out = applyRules(text);
    const outEl = $("outputText");
    if (outEl) outEl.textContent = out;

  } catch (e) {
    // keep quiet in minimal UI
  }
}

function bindPdfUI() {
  const pdfInput = $("pdfFile");
  const filebar = document.querySelector(".filebar");

  if (pdfInput) {
    pdfInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      handlePdf(f);
      // reset so same file can be chosen again
      e.target.value = "";
    });
  }

  if (filebar) {
    filebar.addEventListener("dragover", (e) => { e.preventDefault(); filebar.classList.add("dragover"); });
    filebar.addEventListener("dragleave", () => filebar.classList.remove("dragover"));
    filebar.addEventListener("drop", (e) => {
      e.preventDefault();
      filebar.classList.remove("dragover");
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handlePdf(f);
    });
  }
}

function bind() {
  document.querySelectorAll(".lang button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".lang button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentLang = b.dataset.lang;
      window.currentLang = currentLang;

      lastRunMeta.lang = currentLang;
      setText();

      const inTxt = ($("inputText").value || "").trim();
      if (inTxt) {
        lastRunMeta.fromPdf = false;
        const out = applyRules(inTxt);
        if ($("outputText")) $("outputText").textContent = out;
      } else {
        window.dispatchEvent(new Event("safe:updated"));
      }
    };
  });

  const mm = $("moneyMode");
  if (mm) {
    mm.addEventListener("change", () => {
      moneyMode = mm.value || "off";
      const inTxt = ($("inputText").value || "").trim();
      if (inTxt) {
        lastRunMeta.fromPdf = false;
        const out = applyRules(inTxt);
        if ($("outputText")) $("outputText").textContent = out;
      } else {
        window.__safe_moneyMode = moneyMode;
        window.dispatchEvent(new Event("safe:updated"));
      }
    });

    moneyMode = mm.value || "off";
    window.__safe_moneyMode = moneyMode;
  }

  const gen = $("btnGenerate");
  if (gen) gen.onclick = () => {
    lastRunMeta.fromPdf = false;
    const out = applyRules($("inputText").value || "");
    if ($("outputText")) $("outputText").textContent = out;
  };

  const clr = $("btnClear");
  if (clr) clr.onclick = () => {
    if ($("inputText")) $("inputText").value = "";
    if ($("outputText")) $("outputText").textContent = "";

    window.__safe_hits = 0;
    window.__safe_breakdown = {};
    window.__safe_score = 0;
    window.__safe_level = "low";
    window.__safe_report = null;

    lastRunMeta.fromPdf = false;

    const rb = $("riskBox");
    if (rb) rb.innerHTML = "";

    window.dispatchEvent(new Event("safe:updated"));
  };

  const copy = $("btnCopy");
  if (copy) copy.onclick = async () => {
    const t = uiText(currentLang);
    try {
      await navigator.clipboard.writeText(($("outputText") && $("outputText").textContent) || "");
      const old = copy.textContent;
      copy.textContent = t.btnCopied || old;
      setTimeout(() => { copy.textContent = t.btnCopy || old; }, 900);
    } catch (e) {}
  };

  // feedback (minimal local counters)
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

  bindPdfUI();
}

initEnabled();
setText();
bind();
