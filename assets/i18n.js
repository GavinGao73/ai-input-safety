// =========================
// assets/i18n.js (FULL)
// ✅ UI copy polish (2026-02-21)
// - Mode B manualRedactNote: clearer, shorter, consistent wording (ZH/EN/DE)
// - Keep all keys/structure unchanged
// =========================
const I18N = {
  zh: {
    inTitle: "在 AI 读取之前，先通过 Filter。",
    outTitle: "过滤后文本，可直接粘贴给 AI。",

    placeholder: "例如：简历、邮件、咨询材料、报告摘要……",
    inputWatermark:
      "AI 系统可以解析文档中的隐藏文本结构。\n本工具仅在本地运行，不上传、不保存内容。",

    // ✅ Upload
    btnUpload: "上传文件",
    btnUploadImg: "图片",

    btnGenerate: "过滤",
    btnCopy: "复制",
    btnCopied: "✔ 已复制",
    btnClear: "清空",

    // toggle titles
    riskTitle: "风险评分",
    manualTitle: "手工处理",

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

    // ✅ Mode B: manual visual redaction pane (left)
    // ✅ no extra title (already have “手工处理”)
    manualRedactTitle: "",
    manualRedactNote:
      "检测到上传内容为图片或不可读 PDF（无文本层）。\n请先进入手工框选，覆盖需要隐藏的信息；详细步骤见下方「使用说明」。",
    btnManualRedact: "手工涂抹",

    // ✅ rail titles + separate texts
    manualRailTitle: "使用说明",

    // Mode A only
    manualRailTextA:
      "Mode A（PDF 可读）：\n" +
      "1) 在左侧「手工处理」中输入需要额外遮盖的关键词（逗号或换行分隔）。\n" +
      "2) 只会遮盖：① 你上传的 PDF 原文里真实出现的词；② 你粘贴/输入的文本里出现的词。\n" +
      "3) 完成后点击右侧「红删PDF」生成新的 PDF。\n" +
      "4) 下载后先检查确认无误，再发送给他人或给 AI。",

    // Mode B only
    manualRailTextB:
      "Mode B（扫描/图片 PDF）：\n" +
      "1) 点击左侧「手工涂抹」，进入框选遮盖。\n" +
      "2) 可多次框选；可清空本页/全部。\n" +
      "3) 框选完成后关闭涂抹界面，回到主界面。\n" +
      "4) 点击右侧「红删PDF」生成新的 PDF；下载检查无误后再发送。",

    exportTitle: "生成进程",

    // progress messages
    progressWorking: "处理中…",
    progressDone: "完成 ✅ 已开始下载。",
    progressNoFile: "未检测到文件，请先上传 PDF。",
    progressNotPdf: "当前不是 PDF 文件。",
    progressNotReadable: "PDF 不可读（Mode B），请先手工涂抹并保存框选，然后再点红删PDF。",
    progressNeedManualFirst: "请先点「手工涂抹」完成框选并关闭界面，然后再点「红删PDF」。",
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
    btnUploadImg: "Image",

    btnGenerate: "Filter",
    btnCopy: "Copy",
    btnCopied: "✔ Copied",
    btnClear: "Clear",

    riskTitle: "Risk score",
    manualTitle: "Manual",

    fbQ: "Helpful?",

    learn: "Learn",
    privacy: "Privacy",
    scope: "Scope",

    foot: "Filtering and edits are suggestions only. No legal commitment.",

    tabIn: "Input",
    tabOut: "Output",

    btnRedactPdf: "Redact PDF",

    manualHint: "Separate by commas/new lines. Only masks terms that actually appear in the PDF text.",
    manualPlaceholder: "e.g. Alice, Bob, Bei.de Tech GmbH",

    // ✅ no extra title
    manualRedactTitle: "",
    manualRedactNote:
      "Detected an image or an unreadable PDF (no text layer).\nPlease mark areas to hide first. See “How it works” below for the steps.",
    btnManualRedact: "Mark areas",

    manualRailTitle: "How it works",

    manualRailTextA:
      "Mode A (readable PDF):\n" +
      "1) Enter extra terms to mask in “Manual” (comma/new-line separated).\n" +
      "2) Only masks: ① terms that appear in the uploaded PDF text; ② terms that appear in your input.\n" +
      "3) Click “Redact PDF” to generate a new PDF.\n" +
      "4) Download and verify it before sending.",

    manualRailTextB:
      "Mode B (scanned/image PDF):\n" +
      "1) Click “Manual” to mark areas with rectangles.\n" +
      "2) You can add multiple boxes; clear page/all.\n" +
      "3) Close the marking UI to return.\n" +
      "4) Click “Redact PDF” to generate a new PDF; download and verify before sending.",

    exportTitle: "Progress",

    progressWorking: "Working…",
    progressDone: "Done ✅ Download started.",
    progressNoFile: "No file detected. Please upload a PDF first.",
    progressNotPdf: "This is not a PDF file.",
    progressNotReadable: "PDF not readable (Mode B). Please mark areas first, then click Redact PDF.",
    progressNeedManualFirst: "Please mark areas first (Manual), close it, then click Redact PDF.",
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
    btnUploadImg: "Bild",

    btnGenerate: "Filtern",
    btnCopy: "Kopieren",
    btnCopied: "✔ Kopiert",
    btnClear: "Leeren",

    riskTitle: "Risikowert",
    manualTitle: "Manuell",

    fbQ: "Hilfreich?",

    learn: "Info",
    privacy: "Datenschutz",
    scope: "Umfang",

    foot: "Filterung und Änderungen sind nur Vorschläge. Keine rechtliche Zusage.",

    tabIn: "Eingabe",
    tabOut: "Ausgabe",

    btnRedactPdf: "PDF schwärzen",

    manualHint: "Trennung per Komma/Zeilenumbruch. Es wird nur maskiert, was im PDF-Text wirklich vorkommt。",
    manualPlaceholder: "z.B. Max Mustermann, Erika, Bei.de Tech GmbH",

    // ✅ no extra title
    manualRedactTitle: "",
    manualRedactNote:
      "Bild oder nicht lesbares PDF erkannt (kein Textlayer).\nBitte zuerst Bereiche markieren. Schritte stehen unten unter „So funktioniert’s“.",
    btnManualRedact: "Bereiche markieren",

    manualRailTitle: "So funktioniert’s",

    manualRailTextA:
      "Mode A (lesbares PDF):\n" +
      "1) Zusätzliche Begriffe zum Maskieren unter „Manuell“ eingeben (Komma/Zeilenumbruch).\n" +
      "2) Maskiert wird nur: ① was im PDF-Text vorkommt; ② was in deiner Eingabe vorkommt.\n" +
      "3) „PDF schwärzen“ klicken und ein neues PDF erzeugen.\n" +
      "4) Herunterladen und prüfen, erst dann senden.",

    manualRailTextB:
      "Mode B (Scan/Bild-PDF):\n" +
      "1) „Manuell“ klicken und Bereiche per Rechteck markieren.\n" +
      "2) Mehrfach markieren; Seite/Alles löschen.\n" +
      "3) Markierungs-UI schließen und zurückkehren.\n" +
      "4) „PDF schwärzen“ klicken, herunterladen und prüfen, erst dann senden.",

    exportTitle: "Fortschritt",

    progressWorking: "Wird verarbeitet…",
    progressDone: "Fertig ✅ Download gestartet.",
    progressNoFile: "Keine Datei erkannt. Bitte zuerst ein PDF hochladen.",
    progressNotPdf: "Keine PDF-Datei.",
    progressNotReadable: "PDF nicht lesbar (Mode B). Bitte erst markieren, dann PDF schwärzen.",
    progressNeedManualFirst: "Bitte erst markieren (Manuell), schließen, dann PDF schwärzen.",
    progressExportMissing: "Export-Modul nicht geladen",
    progressFailed: "Export fehlgeschlagen:"
  }
};

window.I18N = I18N;
