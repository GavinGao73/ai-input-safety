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

    moneyLabel: "金额：",
    moneyOff: "关闭",
    moneyM1: "M1",
    moneyM2: "M2",

    btnGenerate: "过滤",
    btnCopy: "复制",
    btnCopied: "✔ 已复制",
    btnClear: "清空",

    riskTitle: "风险评分",

    shareTitle: "过滤成就",

    // ✅ 你要的分行 + 右对齐（CSS 已用 white-space:pre-line 支持）
    shareSub:
      "不含原文；\n仅展示\n过滤数据\n与\n隐私声明；\n仅用于\n对作者的\n支持与鼓励。",

    achvPlaceholder: "生成后显示预览",

    btnDownload: "下载",

    fbQ: "有帮助吗？",

    learn: "了解更多",
    privacy: "隐私原则",
    scope: "MVP 范围",

    // ✅ footer 文案保持，但字号/颜色已由 CSS 统一到 links
    foot: "过滤和修改仅为建议，不构成法律承诺"
  },

  en: {
    inTitle: "Filter before AI reads.",
    outTitle: "Filtered text — ready to paste into AI.",

    placeholder: "e.g. resume, email, report summary…",
    inputWatermark:
      "AI systems can extract hidden text-layer data.\nAll processing runs locally. Nothing is stored or transmitted.",

    btnUpload: "Upload file",

    moneyLabel: "Money:",
    moneyOff: "Off",
    moneyM1: "M1",
    moneyM2: "M2",

    btnGenerate: "Filter",
    btnCopy: "Copy",
    btnCopied: "✔ Copied",
    btnClear: "Clear",

    riskTitle: "Risk score",

    shareTitle: "Filter achievement",

    // ✅ 英文不要“每词一行”，否则很怪：用 4–5 行更自然
    shareSub:
      "No original text.\nLocal-only stats\nand a privacy notice.\nFor support & encouragement\nonly.",

    achvPlaceholder: "Preview appears after filtering",

    btnDownload: "Download",

    fbQ: "Helpful?",

    learn: "Learn More",
    privacy: "Privacy",
    scope: "MVP Scope",

    foot: "Filtering and edits are suggestions only. No legal commitment."
  },

  de: {
    inTitle: "Filter, bevor KI liest.",
    outTitle: "Gefilterter Text — direkt in KI einfügen.",

    placeholder: "z.B. Lebenslauf, E-Mail, Bericht…",
    inputWatermark:
      "KI-Systeme lesen auch verborgene Textlayer-Daten.\nVerarbeitung erfolgt ausschließlich lokal. Keine Speicherung.",

    btnUpload: "Datei hochladen",

    moneyLabel: "Betrag:",
    moneyOff: "Aus",
    moneyM1: "M1",
    moneyM2: "M2",

    btnGenerate: "Filtern",
    btnCopy: "Kopieren",
    btnCopied: "✔ Kopiert",
    btnClear: "Leeren",

    riskTitle: "Risikowert",

    shareTitle: "Filter-Ergebnis",

    // ✅ 德语长词多：分行更短 + CSS 断行兜底
    shareSub:
      "Kein Originaltext.\nNur lokale Statistik\nund Datenschutzhinweis.\nNur zur Unterstützung\nund als Ermutigung.",

    achvPlaceholder: "Vorschau nach dem Filtern",

    // 你原来是 Download（短），继续保留短的
    btnDownload: "Download",

    fbQ: "Hilfreich?",

    learn: "Mehr erfahren",
    privacy: "Datenschutz",
    scope: "MVP-Umfang",

    foot: "Filterung und Änderungen sind nur Vorschläge. Keine rechtliche Zusage."
  }
};

window.I18N = I18N;
