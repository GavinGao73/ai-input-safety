let currentLang = "zh";
const enabled = new Set();

function $(id) { return document.getElementById(id); }

// Multilingual placeholders (same-language replacement)
function placeholder(key) {
  const map = {
    zh: {
      PHONE: "【电话】",
      MONEY: "【金额】",
      EMAIL: "【邮箱】",
      ACCOUNT: "【账号】",
      ADDRESS: "【地址】",
      URL: "【链接】",
      HANDLE: "【账号名】",
      REF: "【编号】",
      TITLE: "【称谓】",
      NUMBER: "【数字】"
    },
    de: {
      PHONE: "[Telefon]",
      MONEY: "[Betrag]",
      EMAIL: "[E-Mail]",
      ACCOUNT: "[Konto]",
      ADDRESS: "[Adresse]",
      URL: "[Link]",
      HANDLE: "[Handle]",
      REF: "[Referenz]",
      TITLE: "[Anrede]",
      NUMBER: "[Zahl]"
    },
    en: {
      PHONE: "[Phone]",
      MONEY: "[Amount]",
      EMAIL: "[Email]",
      ACCOUNT: "[Account]",
      ADDRESS: "[Address]",
      URL: "[Link]",
      HANDLE: "[Handle]",
      REF: "[Ref]",
      TITLE: "[Title]",
      NUMBER: "[Number]"
    }
  };

  return (map[currentLang] && map[currentLang][key]) || `[${key}]`;
}

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
}

function applyRules(text) {
  let out = String(text || "");
  let hits = 0;

  // ✅ Fixed priority: protect whole tokens first, then structure
  const PRIORITY = [
    "email",
    "bank",
    "account",
    "phone",
    "address_de_street",
    "url",
    "handle",
    "ref",
    "title",
    "number"
  ];

  for (const key of PRIORITY) {
    if (!enabled.has(key)) continue;

    const r = RULES_BY_KEY[key];
    if (!r || !r.pattern) continue;

    const tag = r.tag;

    if (r.mode === "prefix") {
      // keep prefix like "银行账号：" and replace the number
      out = out.replace(r.pattern, (m, prefix) => {
        hits++;
        return String(prefix || "") + placeholder(tag);
      });
      continue;
    }

    if (r.mode === "phone") {
      // pattern has either:
      //  (prefix)(number)   OR   (+internationalNumber)
      out = out.replace(r.pattern, (m, prefix, num, intl) => {
        hits++;
        if (prefix) return String(prefix) + placeholder(tag);
        return placeholder(tag);
      });
      continue;
    }

    // default: replace whole match
    out = out.replace(r.pattern, () => {
      hits++;
      return placeholder(tag);
    });
  }

  $("hitCount").textContent = String(hits);
  return out;
}

/* =========================
   PDF (v2.1) helpers
========================= */
async function handlePdf(file) {
  const pdfHint = $("pdfHint");
  const inputEl = $("inputText");

  if (!file) return;

  if (file.type !== "application/pdf") {
    if (pdfHint) {
      pdfHint.textContent =
        currentLang === "zh"
          ? "请选择 PDF 文件"
          : currentLang === "de"
            ? "Bitte eine PDF-Datei wählen"
            : "Please choose a PDF file";
    }
    return;
  }

  if (pdfHint) {
    pdfHint.textContent =
      currentLang === "zh"
        ? "正在本地解析 PDF 文本…"
        : currentLang === "de"
          ? "PDF-Text wird lokal extrahiert…"
          : "Extracting PDF text locally…";
  }

  try {
    if (!window.extractTextFromPdfFile) {
      if (pdfHint) {
        pdfHint.textContent =
          currentLang === "zh"
            ? "PDF 模块未加载：请确认已添加 assets/pdf.js 并在 index.html 引入"
            : currentLang === "de"
              ? "PDF-Modul nicht geladen: bitte assets/pdf.js einbinden"
              : "PDF module not loaded: please include assets/pdf.js";
      }
      return;
    }

    const text = await window.extractTextFromPdfFile(file);

    if (!text || !text.trim()) {
      if (pdfHint) {
        pdfHint.textContent =
          currentLang === "zh"
            ? "未提取到文本：该 PDF 可能是扫描件（无文字层）"
            : currentLang === "de"
              ? "Kein Text gefunden: evtl. Scan-PDF (ohne Textlayer)"
              : "No text extracted: this PDF may be a scan (no text layer)";
      }
      return;
    }

    inputEl.value = text;

    // Optional: auto-generate once so user feels immediate effect
    const btn = $("btnGenerate");
    if (btn) btn.click();

    if (pdfHint) {
      pdfHint.textContent =
        currentLang === "zh"
          ? "已提取文本并生成安全版本（右侧已更新）"
          : currentLang === "de"
            ? "Text extrahiert & sichere Version erstellt (rechts aktualisiert)"
            : "Text extracted & safe copy generated (updated on the right)";
    }
  } catch (e) {
    if (pdfHint) {
      pdfHint.textContent =
        currentLang === "zh"
          ? "解析失败：请换一个文字型 PDF"
          : currentLang === "de"
            ? "Fehler: bitte eine textbasierte PDF versuchen"
            : "Failed: try a text-based PDF";
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
    filebar.addEventListener("dragover", (e) => {
      e.preventDefault();
      filebar.classList.add("dragover");
    });

    filebar.addEventListener("dragleave", () => {
      filebar.classList.remove("dragover");
    });

    filebar.addEventListener("drop", (e) => {
      e.preventDefault();
      filebar.classList.remove("dragover");
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      handlePdf(f);
    });
  }
}

function bind() {
  // Language switch
  document.querySelectorAll(".lang button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".lang button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      currentLang = b.dataset.lang;
      setText();

      // Re-generate output in new language so placeholders switch language too
      const cur = $("outputText").textContent || "";
      if (cur && $("inputText").value) {
        $("outputText").textContent = applyRules($("inputText").value || "");
      }
    };
  });

  // Generate
  $("btnGenerate").onclick = () => {
    $("outputText").textContent = applyRules($("inputText").value || "");
  };

  // Clear
  $("btnClear").onclick = () => {
    $("inputText").value = "";
    $("outputText").textContent = "";
    $("hitCount").textContent = "0";

    const pdfHint = $("pdfHint");
    if (pdfHint) {
      pdfHint.textContent =
        currentLang === "zh"
          ? "PDF（文字型）可拖拽到这里，或点击选择文件"
          : currentLang === "de"
            ? "Text-PDF hierher ziehen oder Datei auswählen"
            : "Drag a text-based PDF here or choose a file";
    }
  };

  // Copy
  $("btnCopy").onclick = () => {
    navigator.clipboard.writeText($("outputText").textContent || "");
  };

  // PDF bindings
  bindPdfUI();
}

// init
initEnabled();
setText();
bind();
