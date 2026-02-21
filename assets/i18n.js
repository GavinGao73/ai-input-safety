// =========================
// assets/i18n.js (FULL)
// =========================
const I18N = {
  zh: {
    inTitle: "在 AI 读取之前，先通过 Filter。",
    outTitle: "过滤后文本，可直接粘贴给 AI。",

    placeholder: "例如：简历、邮件、咨询材料、报告摘要……",
    inputWatermark:
      "AI 系统可以解析文档中的隐藏文本结构。\n本工具仅在本地运行，不上传、不保存内容。",

    btnUpload: "上传文件",

    btnGenerate: "过滤",
    btnCopy: "复制",
    btnCopied: "✔ 已复制",
    btnClear: "清空",

    // toggle titles
    riskTitle: "风险评分",
    // ✅ 更通用：Mode A=手工词条；Mode B=人工处理（框选）
    manualTitle: "手工处理",

    // feedback removed (kept for compatibility if referenced elsewhere)
    fbQ: "有帮助吗？",

    learn: "了解更多",
    privacy: "隐私原则",
    scope: "MVP 范围",

    foot: "过滤和修改仅为建议，不构成法律承诺",

    // Mobile tabs
    tabIn: "输入",
    tabOut: "输出",

    // Output action (PDF)
    btnRedactPdf: "红删PDF",

    // Manual terms card (Mode A)
    manualHint: "支持逗号/换行分隔；只遮盖 PDF 原文里真实出现的内容。",
    manualPlaceholder: "例如：张三, 李四, Bei.de Tech GmbH",

    // ✅ Mode B: manual visual redaction pane
    manualRedactTitle: "人工涂抹",
    manualRedactNote:
      "当前文件无法读取文字层（图片或扫描版 PDF）。请点击下方按钮进入框选遮盖模式。",
    btnManualRedact: "人工处理",

    // ✅ rail titles + text (cover Mode A + Mode B)
    manualRailTitle: "使用说明",
    manualRailText:
      "若 PDF 可读（Mode A）：\n- 在此输入需要额外遮盖的关键词（逗号或换行分隔）。\n- 只会遮盖：① 你上传的 PDF 原文里真实出现的词；② 你在输入框里粘贴的文本里出现的词。\n\n若 PDF 不可读/图片（Mode B）：\n- 点击「人工处理」进入框选遮盖。\n- 可多次框选，支持清空本页/全部，导出红删 PDF。",

    exportTitle: "生成进程",

    // progress messages
    progressWorking: "处理中…",
    progressDone: "完成 ✅ 已开始下载。",
    progressNoFile: "未检测到文件，请先上传 PDF。",
    progressNotPdf: "当前不是 PDF 文件。",
    progressNotReadable: "PDF 不可读（Mode B），请使用人工处理。",
    progressExportMissing: "导出模块未加载",
    progressFailed: "导出失败："
  },

  en: {
    inTitle: "Filter before AI reads.",
    outTitle: "Filtered text — ready to paste into AI.",

    placeholder: "e.g. resume, email, report summary…",
    inputWatermark:
      "AI systems can extract hidden text-layer data.\nAll processing runs locally. Nothing is stored or transmitted.",

    btnUpload: "Choose file",

    btnGenerate: "Filter",
    btnCopy: "Copy",
    btnCopied: "✔ Copied",
    btnClear: "Clear",

    riskTitle: "Risk score",
    // ✅ more general
    manualTitle: "Manual",

    fbQ: "Helpful?",

    learn: "Learn",
    privacy: "Privacy",
    scope: "Scope",

    foot: "Filtering and edits are suggestions only. No legal commitment.",

    tabIn: "Input",
    tabOut: "Output",

    btnRedactPdf: "Redact PDF",

    // Manual terms card (Mode A)
    manualHint: "Separate by commas/new lines. Only masks terms that actually appear in the PDF text.",
    manualPlaceholder: "e.g. Alice, Bob, Bei.de Tech GmbH",

    // ✅ Mode B: manual visual redaction pane
    manualRedactTitle: "Manual redaction",
    manualRedactNote:
      "This file has no readable text layer (image or scanned PDF). Click the button below to mark areas with rectangles.",
    btnManualRedact: "Manual",

    // ✅ rail titles + text (Mode A + Mode B)
    manualRailTitle: "How it works",
    manualRailText:
      "If the PDF is readable (Mode A):\n- Enter extra terms to mask (comma/new-line separated).\n- Only masks: ① terms that actually appear in the uploaded PDF text; ② terms that appear in your pasted input.\n\nIf the PDF is not readable / image (Mode B):\n- Click “Manual” to mark areas with rectangles.\n- You can add multiple boxes, clear page/all, and export a redacted raster PDF.",

    exportTitle: "Progress",

    progressWorking: "Working…",
    progressDone: "Done ✅ Download started.",
    progressNoFile: "No file detected. Please upload a PDF first.",
    progressNotPdf: "This is not a PDF file.",
    progressNotReadable: "PDF not readable (Mode B). Use Manual.",
    progressExportMissing: "Export module not loaded",
    progressFailed: "Export failed:"
  },

  de: {
    inTitle: "Filter, bevor KI liest.",
    outTitle: "Gefilterter Text — direkt in KI einfügen.",

    placeholder: "z.B. Lebenslauf, E-Mail, Bericht…",
    inputWatermark:
      "KI-Systeme lesen auch verborgene Textlayer-Daten.\nVerarbeitung erfolgt ausschließlich lokal. Keine Speicherung.",

    btnUpload: "Datei auswählen",

    btnGenerate: "Filtern",
    btnCopy: "Kopieren",
    btnCopied: "✔ Kopiert",
    btnClear: "Leeren",

    riskTitle: "Risikowert",
    // ✅ more general
    manualTitle: "Manuell",

    fbQ: "Hilfreich?",

    learn: "Info",
    privacy: "Datenschutz",
    scope: "Umfang",

    foot: "Filterung und Änderungen sind nur Vorschläge. Keine rechtliche Zusage.",

    tabIn: "Eingabe",
    tabOut: "Ausgabe",

    btnRedactPdf: "PDF schwärzen",

    // Manual terms card (Mode A)
    manualHint: "Trennung per Komma/Zeilenumbruch. Es wird nur maskiert, was im PDF-Text wirklich vorkommt.",
    manualPlaceholder: "z.B. Max Mustermann, Erika, Bei.de Tech GmbH",

    // ✅ Mode B: manual visual redaction pane
    manualRedactTitle: "Manuelle Schwärzung",
    manualRedactNote:
      "Diese Datei hat keinen lesbaren Textlayer (Bild oder Scan-PDF). Klicke unten, um Bereiche per Rechteck zu markieren.",
    btnManualRedact: "Manuell",

    // ✅ rail titles + text (Mode A + Mode B)
    manualRailTitle: "So funktioniert’s",
    manualRailText:
      "Wenn das PDF lesbar ist (Mode A):\n- Zusätzliche Begriffe zum Maskieren eingeben (Komma/Zeilenumbruch).\n- Maskiert wird nur: ① was im hochgeladenen PDF-Text wirklich vorkommt; ② was in deinem eingefügten Text vorkommt.\n\nWenn das PDF nicht lesbar ist / Bild (Mode B):\n- „Manuell“ klicken und Bereiche per Rechteck markieren.\n- Mehrfach markieren, Seite/Alles löschen und als Raster-PDF exportieren.",

    exportTitle: "Fortschritt",

    progressWorking: "Wird verarbeitet…",
    progressDone: "Fertig ✅ Download gestartet.",
    progressNoFile: "Keine Datei erkannt. Bitte zuerst ein PDF hochladen.",
    progressNotPdf: "Keine PDF-Datei.",
    progressNotReadable: "PDF nicht lesbar (Mode B). Bitte Manuell verwenden.",
    progressExportMissing: "Export-Modul nicht geladen",
    progressFailed: "Export fehlgeschlagen:"
  }
};

window.I18N = I18N;
