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

    riskTitle: "风险评分",

    fbQ: "有帮助吗？",

    learn: "了解更多",
    privacy: "隐私原则",
    scope: "MVP 范围",

    foot: "过滤和修改仅为建议，不构成法律承诺",

    // ✅ Mobile tabs
    tabIn: "输入",
    tabOut: "输出",

    // ✅ Output action (PDF)
    btnRedactPdf: "红删PDF",

    // ✅ Manual terms card
    manualTitle: "手工输入",
    manualHint: "支持逗号/换行分隔；只遮盖 PDF 原文里真实出现的内容。",
    manualPlaceholder: "例如：张三, 李四, Bei.de Tech GmbH"
  },

  en: {
    inTitle: "Filter before AI reads.",
    outTitle: "Filtered text — ready to paste into AI.",

    placeholder: "e.g. resume, email, report summary…",
    inputWatermark:
      "AI systems can extract hidden text-layer data.\nAll processing runs locally. Nothing is stored or transmitted.",

    btnUpload: "Upload",

    btnGenerate: "Filter",
    btnCopy: "Copy",
    btnCopied: "✔ Copied",
    btnClear: "Clear",

    riskTitle: "Risk score",

    fbQ: "Helpful?",

    learn: "Learn",
    privacy: "Privacy",
    scope: "Scope",

    foot: "Filtering and edits are suggestions only. No legal commitment.",

    tabIn: "Input",
    tabOut: "Output",

    btnRedactPdf: "PDF",

    manualTitle: "Manual input",
    manualHint: "Separate by commas/new lines. Only masks terms that actually appear in the PDF text.",
    manualPlaceholder: "e.g. Alice, Bob, Bei.de Tech GmbH"
  },

  de: {
    inTitle: "Filter, bevor KI liest.",
    outTitle: "Gefilterter Text — direkt in KI einfügen.",

    placeholder: "z.B. Lebenslauf, E-Mail, Bericht…",
    inputWatermark:
      "KI-Systeme lesen auch verborgene Textlayer-Daten.\nVerarbeitung erfolgt ausschließlich lokal. Keine Speicherung.",

    btnUpload: "Upload",

    btnGenerate: "Filtern",
    btnCopy: "Kopieren",
    btnCopied: "✔ Kopiert",
    btnClear: "Leeren",

    riskTitle: "Risikowert",

    fbQ: "Hilfreich?",

    learn: "Info",
    privacy: "Datenschutz",
    scope: "Umfang",

    foot: "Filterung und Änderungen sind nur Vorschläge. Keine rechtliche Zusage.",

    tabIn: "Eingabe",
    tabOut: "Ausgabe",

    btnRedactPdf: "PDF",

    manualTitle: "Manuelle Eingabe",
    manualHint: "Trennung per Komma/Zeilenumbruch. Es wird nur maskiert, was im PDF-Text wirklich vorkommt.",
    manualPlaceholder: "z.B. Max Mustermann, Erika, Bei.de Tech GmbH"
  }
};

window.I18N = I18N;
