let currentLang = "zh";
const enabled = new Set();
let moneyMode = "off"; // off | m1 | m2

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

  for (const key of PRIORITY) {
    if (key !== "money" && !enabled.has(key)) continue;

    const r = RULES_BY_KEY[key];
    if (!r || !r.pattern) continue;

    if (key === "money") {
      if (moneyMode === "off") continue;

      out = out.replace(r.pattern, (m, cur1, amt1, sym, amt2, amt3, unit) => {
        hits++;

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
        hits++;
        return String(prefix || "") + placeholder(tag);
      });
      continue;
    }

    if (r.mode === "phone") {
      out = out.replace(r.pattern, (m, prefix, num, intl) => {
        hits++;
        if (prefix) return String(prefix) + placeholder(tag);
        return placeholder(tag);
      });
      continue;
    }

    out = out.replace(r.pattern, () => {
      hits++;
      return placeholder(tag);
    });
  }

  $("hitCount").textContent = String(hits);

  // ✅ Share metrics (must be BEFORE return)
  window.__safe_hits = hits;
  window.__safe_moneyMode = moneyMode;

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
      // just regenerate; applyRules will update __safe_* globals
      if (($("inputText").value || "").trim()) {
        $("outputText").textContent = applyRules($("inputText").value || "");
      }
    });

    moneyMode = mm.value || "off";
    // keep global in sync even before first generate
    window.__safe_moneyMode = moneyMode;
  }

  $("btnGenerate").onclick = () => {
    $("outputText").textContent = applyRules($("inputText").value || "");
  };

  $("btnClear").onclick = () => {
    $("inputText").value = "";
    $("outputText").textContent = "";
    $("hitCount").textContent = "0";
    window.__safe_hits = 0;
  };

  $("btnCopy").onclick = () => {
    navigator.clipboard.writeText($("outputText").textContent || "");
  };

  bindPdfUI();
}

initEnabled();
setText();
bind();
