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
  // tolerate "2 000. 00", "2.000,00", "15000.00"
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

// ---- init + i18n text ----
function initEnabled() {
  enabled.clear();
  Object.values(DETECTION_ITEMS).flat().forEach(i => {
    if (i.defaultOn) enabled.add(i.key);
  });
}

/* ==================== Risk scoring (A) v1 ==================== */
const RISK_WEIGHTS = {
  // L1 high
  bank: 28,
  account: 26,
  email: 14,
  phone: 16,

  // L2 medium
  address_de_street: 18,
  handle: 10,

  // L3 low
  ref: 6,
  title: 4,
  number: 2,

  // money handled separately
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
    meta: (m) => `命中 ${m.hits}｜启用 ${m.enabledCount}｜金额 ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜PDF" : ""}`
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
    meta: (m) => `Treffer ${m.hits}｜Aktiv ${m.enabledCount}｜Betrag ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜PDF" : ""}`
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
    meta: (m) => `Hits ${m.hits}｜Enabled ${m.enabledCount}｜Money ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜PDF" : ""}`
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
    const capped = Math.min(c, 12); // cap per key to avoid score explosion
    score += w * capped;
  }

  // money mode add-on (sensitivity)
  if (meta.moneyMode === "m1") score += 10;
  if (meta.moneyMode === "m2") score += 14;

  // doc-length heuristic
  if (meta.inputLen >= 1500) score += 6;
  if (meta.inputLen >= 4000) score += 8;

  // PDF heuristic
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

  // 不强依赖 CSS（无 CSS 也能正常显示）
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

  $("ui-slogan").textContent = t.slogan;
  $("ui-in-title").textContent = t.inTitle;
  $("ui-in-sub").textContent = t.inSub;
  $("inputText").placeholder = t.placeholder;

  $("ui-panel-title").textContent = t.panelTitle;
  $("ui-panel-pill").textContent = t.panelPill;
  $("ui-panel-hint").textContent = t.panelHint;

  $("ui-l1-title").textContent = t.l1Title;
  $("ui-l1-note").textContent = t.l1Note;
  $("ui-l2-title").textContent = t.l2Title;
  $("ui-l2-note").textContent = t.l2Note;
  $("ui-l3-title").textContent = t.l3Title;
  $("ui-l3-note").textContent = t.l3Note;

  $("btnGenerate").textContent = t.btnGenerate;
  $("btnCopy").textContent = t.btnCopy;
  $("btnExample").textContent = t.btnExample;
  $("btnClear").textContent = t.btnClear;

  $("ui-out-title").textContent = t.outTitle;
  $("ui-out-sub").textContent = t.outSub;
  $("ui-hit-pill").textContent = t.hitPill;

  $("ui-risk-one").textContent = t.riskOne;
  $("ui-risk-two").textContent = t.riskTwo;

  $("ui-fb-q").textContent = t.fbQ;
  $("ui-foot").textContent = t.foot;

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

  // PDF hint (if present)
  const pdfHint = $("pdfHint");
  if (pdfHint) {
    pdfHint.textContent =
      currentLang === "zh"
        ? "PDF（文字型）可拖拽到这里，或点击选择文件"
        : currentLang === "de"
          ? "Text-PDF hierher ziehen oder Datei auswählen"
          : "Drag a text-based PDF here or choose a file";
  }

  // Share UI (if present)
  const st = $("ui-share-title");
  const ss = $("ui-share-sub");
  const smt = $("ui-share-modal-title");
  const sn = $("ui-share-note");
  if (st && ss && smt && sn) {
    if (currentLang === "zh") {
      st.textContent = "分享安全卡片";
      ss.textContent = "不包含你的原文，仅分享安全处理成果";
      smt.textContent = "分享预览";
      sn.textContent = "注意：卡片不包含你的原文内容，只显示处理统计与隐私承诺。";
    } else if (currentLang === "de") {
      st.textContent = "Share-Sicherheitskarte";
      ss.textContent = "Kein Originaltext – nur Ergebnis & Versprechen";
      smt.textContent = "Vorschau";
      sn.textContent = "Hinweis: Die Karte enthält keinen Originaltext, nur Statistik & Datenschutzversprechen.";
    } else {
      st.textContent = "Share Safety Card";
      ss.textContent = "No original text — only outcome & promise";
      smt.textContent = "Preview";
      sn.textContent = "Note: the card contains no original text, only stats & privacy promise.";
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

        // m2
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

  $("hitCount").textContent = String(hits);

  // ✅ Share metrics + expose report (must be BEFORE return)
  window.__safe_hits = hits;
  window.__safe_moneyMode = moneyMode;

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

  return out;
}

/* ============ PDF helpers ============ */
async function handlePdf(file) {
  const pdfHint = $("pdfHint");
  const inputEl = $("inputText");

  if (!file) return;

  if (file.type !== "application/pdf") {
    if (pdfHint) {
      pdfHint.textContent =
        currentLang === "zh" ? "请选择 PDF 文件" :
        currentLang === "de" ? "Bitte eine PDF-Datei wählen" :
        "Please choose a PDF file";
    }
    return;
  }

  if (pdfHint) {
    pdfHint.textContent =
      currentLang === "zh" ? "正在本地解析 PDF 文本…" :
      currentLang === "de" ? "PDF-Text wird lokal extrahiert…" :
      "Extracting PDF text locally…";
  }

  try {
    if (!window.extractTextFromPdfFile) {
      if (pdfHint) {
        pdfHint.textContent =
          currentLang === "zh" ? "PDF 模块未加载：请确认已添加 assets/pdf.js 并在 index.html 引入" :
          currentLang === "de" ? "PDF-Modul nicht geladen: bitte assets/pdf.js einbinden" :
          "PDF module not loaded: please include assets/pdf.js";
      }
      return;
    }

    const text = await window.extractTextFromPdfFile(file);

    if (!text || !text.trim()) {
      if (pdfHint) {
        pdfHint.textContent =
          currentLang === "zh" ? "未提取到文本：该 PDF 可能是扫描件（无文字层）" :
          currentLang === "de" ? "Kein Text gefunden: evtl. Scan-PDF (ohne Textlayer)" :
          "No text extracted: this PDF may be a scan (no text layer)";
      }
      return;
    }

    // ✅ mark source
    lastRunMeta.fromPdf = true;

    inputEl.value = text;

    const btn = $("btnGenerate");
    if (btn) btn.click();

    if (pdfHint) {
      pdfHint.textContent =
        currentLang === "zh" ? "已提取文本并生成安全版本（右侧已更新）" :
        currentLang === "de" ? "Text extrahiert & sichere Version erstellt (rechts aktualisiert)" :
        "Text extracted & safe copy generated (updated on the right)";
    }
  } catch (e) {
    if (pdfHint) {
      pdfHint.textContent =
        currentLang === "zh" ? "解析失败：请换一个文字型 PDF" :
        currentLang === "de" ? "Fehler: bitte eine textbasierte PDF versuchen" :
        "Failed: try a text-based PDF";
    }
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

      lastRunMeta.lang = currentLang;
      setText();

      if (($("inputText").value || "").trim()) {
        $("outputText").textContent = applyRules($("inputText").value || "");
      }
    };
  });

  const mm = $("moneyMode");
  if (mm) {
    mm.addEventListener("change", () => {
      moneyMode = mm.value || "off";
      // regenerate; applyRules will update __safe_* globals + riskBox
      if (($("inputText").value || "").trim()) {
        $("outputText").textContent = applyRules($("inputText").value || "");
      } else {
        window.__safe_moneyMode = moneyMode;
      }
    });

    moneyMode = mm.value || "off";
    window.__safe_moneyMode = moneyMode;
  }

  $("btnGenerate").onclick = () => {
    // manual input: treat as not-from-pdf unless last was pdf upload
    // (we keep lastRunMeta.fromPdf as-is; clear will reset it)
    $("outputText").textContent = applyRules($("inputText").value || "");
  };

  $("btnClear").onclick = () => {
    $("inputText").value = "";
    $("outputText").textContent = "";
    $("hitCount").textContent = "0";
    window.__safe_hits = 0;

    // ✅ reset pdf marker
    lastRunMeta.fromPdf = false;

    // clear risk box UI if present (avoid stale score)
    const rb = $("riskBox");
    if (rb) rb.innerHTML = "";
  };

  $("btnCopy").onclick = () => {
    navigator.clipboard.writeText($("outputText").textContent || "");
  };

  bindPdfUI();
}

initEnabled();
setText();
bind();
