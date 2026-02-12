let currentLang = "zh";
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

// ---- init ----
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
    title: "风险评分",
    low: "低风险",
    mid: "中风险",
    high: "高风险",
    top: "主要风险来源",
    advice: "建议",
    adviceLow: "可直接使用；如是报价/合同建议开启金额保护。",
    adviceMid: "建议检查 Top 项；必要时开启金额保护或加严地址/账号遮盖。",
    adviceHigh: "不建议直接发送：请开启更多遮盖选项，并删除落款/签名/账号信息后再试。",
    meta: (m) => `命中 ${m.hits}｜金额 ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜文件" : ""}`
  };
  const de = {
    title: "Risikowert",
    low: "Niedrig",
    mid: "Mittel",
    high: "Hoch",
    top: "Top-Risiken",
    advice: "Empfehlung",
    adviceLow: "Kann so verwendet werden. Für Angebote/Verträge Betragsschutz aktivieren.",
    adviceMid: "Top-Risiken prüfen; ggf. Betragsschutz/Adress- oder Konto-Maskierung aktivieren.",
    adviceHigh: "Nicht direkt senden: mehr Maskierung aktivieren und Signatur/Kontodaten entfernen.",
    meta: (m) => `Treffer ${m.hits}｜Betrag ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜Datei" : ""}`
  };
  const en = {
    title: "Risk score",
    low: "Low",
    mid: "Medium",
    high: "High",
    top: "Top risk sources",
    advice: "Advice",
    adviceLow: "Safe to use. For quotes/contracts, enable money protection.",
    adviceMid: "Review top risks; consider enabling money/address/account masking.",
    adviceHigh: "Do not send as-is: enable more masking and remove signature/account details.",
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
    <div class="riskhead" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
      <div class="riskleft">
        <div class="risktitle" style="font-weight:800;font-size:13px;">${t.title}</div>
        <div class="riskmeta tiny muted" style="margin-top:4px;opacity:.8;">${t.meta(meta)}</div>
      </div>

      <div class="riskscore" style="min-width:92px;text-align:center;padding:10px 10px 8px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(10,14,20,.35);">
        <div class="n" style="font-size:24px;font-weight:900;line-height:1;">${report.score}</div>
        <div class="l" style="font-size:12px;opacity:.9;margin-top:4px;">${levelText}</div>
      </div>
    </div>

    <div class="risksec" style="margin-top:10px;">
      <div class="risklabel" style="font-size:12px;opacity:.8;margin-bottom:6px;">${t.top}</div>
      <div class="risklist" style="display:flex;flex-direction:column;gap:6px;">${topHtml}</div>
    </div>

    <div class="risksec" style="margin-top:10px;">
      <div class="risklabel" style="font-size:12px;opacity:.8;margin-bottom:6px;">${t.advice}</div>
      <div class="riskadvice" style="font-size:12px;line-height:1.5;opacity:.9;">${advice}</div>
    </div>
  `;
}
/* ==================== Risk scoring end ==================== */

function setText() {
  const t = I18N[currentLang];

  const s = $("ui-slogan"); if (s) s.textContent = t.slogan;

  const inTitle = $("ui-in-title"); if (inTitle) inTitle.textContent = t.inTitle;
  const inSub = $("ui-in-sub"); if (inSub) inSub.textContent = t.inSub || "";

  const input = $("inputText"); if (input) input.placeholder = t.placeholder;

  const btnGenerate = $("btnGenerate"); if (btnGenerate) btnGenerate.textContent = t.btnGenerate;
  const btnCopy = $("btnCopy"); if (btnCopy) btnCopy.textContent = t.btnCopy;
  const btnClear = $("btnClear"); if (btnClear) btnClear.textContent = t.btnClear;

  const outTitle = $("ui-out-title"); if (outTitle) outTitle.textContent = t.outTitle;
  const outSub = $("ui-out-sub"); if (outSub) outSub.textContent = t.outSub || "";

  const hitPill = $("ui-hit-pill"); if (hitPill) hitPill.textContent = t.hitPill;

  const fbq = $("ui-fb-q"); if (fbq) fbq.textContent = t.fbQ;
  const foot = $("ui-foot"); if (foot) foot.textContent = t.foot;

  // Money UI text (if present)
  const label = $("ui-money-label");
  const hint = $("ui-money-hint");
  const sel = $("moneyMode");
  if (label && hint && sel) {
    if (currentLang === "zh") {
      label.textContent = "金额保护：";
      hint.textContent = "报价/合同建议开启";
      sel.options[0].text = "关闭";
      sel.options[1].text = "M1 精确遮盖";
      sel.options[2].text = "M2 区间遮盖";
    } else if (currentLang === "de") {
      label.textContent = "Betragsschutz:";
      hint.textContent = "Für Angebote/Verträge empfohlen";
      sel.options[0].text = "Aus";
      sel.options[1].text = "M1 Genau verbergen";
      sel.options[2].text = "M2 Bereich verbergen";
    } else {
      label.textContent = "Money protection:";
      hint.textContent = "Recommended for quotes/contracts";
      sel.options[0].text = "Off";
      sel.options[1].text = "M1 Exact mask";
      sel.options[2].text = "M2 Range mask";
    }
  }

  // Links
  const l1 = $("linkLearn"); if (l1) l1.textContent = t.learn;
  const l2 = $("linkPrivacy"); if (l2) l2.textContent = t.privacy;
  const l3 = $("linkScope"); if (l3) l3.textContent = t.scope;

  // Share UI (optional static text, fine if not found)
  const st = $("ui-share-title");
  const ss = $("ui-share-sub");
  if (st && ss) {
    if (currentLang === "zh") {
      st.textContent = "安全卡片";
      ss.textContent = "不包含原文，仅展示处理结果与隐私承诺";
    } else if (currentLang === "de") {
      st.textContent = "Sicherheitskarte";
      ss.textContent = "Kein Originaltext – nur Ergebnis & Versprechen";
    } else {
      st.textContent = "Safety Card";
      ss.textContent = "No original text — only outcome & promise";
    }
  }
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

        if (moneyMode === "m1") {
          return placeholder("MONEY");
        }

        const currencyRaw = cur1 || sym || unit || "";
        const amountRaw = amt1 || amt2 || amt3 || "";
        const currency = formatCurrencyForM2(currencyRaw);
        const num = normalizeAmountToNumber(amountRaw);
        const range = moneyRangeLabel(currencyRaw, num);

        if (currentLang === "zh") {
          return (currency ? currency : "") + "【" + range + "】";
        }
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

  const hc = $("hitCount");
  if (hc) hc.textContent = String(hits);

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

  // ✅ 自动刷新卡片（你要求的 1 行）
  if (window.updateShareAuto) window.updateShareAuto();

  return out;
}

/* ============ PDF helpers (still supported, but no PDF hint UI) ============ */
async function handlePdf(file) {
  if (!file) return;

  if (file.type !== "application/pdf") {
    // 现在 UI 不提示，静默忽略（避免页面杂乱）
    return;
  }

  try {
    if (!window.probePdfTextLayer) {
      console.warn("PDF module not loaded: probePdfTextLayer missing");
      return;
    }

    const probe = await window.probePdfTextLayer(file);
    lastRunMeta.fromPdf = true;

    if (!probe || !probe.hasTextLayer) {
      // v1 无 OCR：不提示 UI，避免干扰（用户可以直接改用粘贴文本）
      console.warn("No text layer in PDF (scan/image). v1 no OCR.");
      return;
    }

    const text = String(probe.text || "").trim();
    if (!text) return;

    const outEl = $("outputText");
    if (outEl) outEl.textContent = applyRules(text);

  } catch (e) {
    console.warn("PDF processing failed", e);
  }
}

function bindPdfUI() {
  const pdfInput = $("pdfFile");
  const filebar = document.querySelector(".filebar");

  if (pdfInput) {
    pdfInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      handlePdf(f);
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

      const inTxt = ($("inputText") && $("inputText").value ? $("inputText").value : "").trim();
      if (inTxt) {
        lastRunMeta.fromPdf = false;
        const outEl = $("outputText");
        if (outEl) outEl.textContent = applyRules(inTxt);
      } else {
        // no input, but language changed → refresh card anyway
        if (window.updateShareAuto) window.updateShareAuto(true);
      }
    };
  });

  const mm = $("moneyMode");
  if (mm) {
    mm.addEventListener("change", () => {
      moneyMode = mm.value || "off";

      const inTxt = ($("inputText") && $("inputText").value ? $("inputText").value : "").trim();
      if (inTxt) {
        lastRunMeta.fromPdf = false;
        const outEl = $("outputText");
        if (outEl) outEl.textContent = applyRules(inTxt);
      } else {
        window.__safe_moneyMode = moneyMode;
        if (window.updateShareAuto) window.updateShareAuto(true);
      }
    });

    moneyMode = mm.value || "off";
    window.__safe_moneyMode = moneyMode;
  }

  const gen = $("btnGenerate");
  if (gen) {
    gen.onclick = () => {
      lastRunMeta.fromPdf = false;
      const outEl = $("outputText");
      const inEl = $("inputText");
      if (outEl) outEl.textContent = applyRules(inEl ? (inEl.value || "") : "");
    };
  }

  const clr = $("btnClear");
  if (clr) {
    clr.onclick = () => {
      const inEl = $("inputText");
      const outEl = $("outputText");
      if (inEl) inEl.value = "";
      if (outEl) outEl.textContent = "";

      const hc = $("hitCount");
      if (hc) hc.textContent = "0";

      window.__safe_hits = 0;
      lastRunMeta.fromPdf = false;

      const rb = $("riskBox");
      if (rb) rb.innerHTML = "";

      if (window.updateShareAuto) window.updateShareAuto(true);
    };
  }

  const cp = $("btnCopy");
  if (cp) {
    cp.onclick = () => {
      const outEl = $("outputText");
      navigator.clipboard.writeText(outEl ? (outEl.textContent || "") : "");
    };
  }

  bindPdfUI();
}

window.currentLang = currentLang;
initEnabled();
setText();
bind();
