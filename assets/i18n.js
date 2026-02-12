const I18N = {
  zh: {
    // headings
    inTitle: "在 AI 读取之前，先通过 Filter。",
    outTitle: "过滤后文本，可直接粘贴给 AI。",

    // input
    placeholder: "粘贴准备上传给 AI 的文字或文件内容…",
    inputWatermark:
      "提示：不要粘贴完整身份证号/银行卡号/签名落款。\n尽量删除姓名+地址+账号的组合信息。\n本工具仅在本地运行，不上传、不保存。",

    // controls
    moneyLabel: "金额：",
    moneyOff: "关闭",
    moneyM1: "精确",
    moneyM2: "区间",
    btnGenerate: "过滤输入内容",
    btnClear: "清空",

    // output
    btnCopy: "复制",
    btnCopied: "✔ 已复制",

    // feedback
    fbQ: "有帮助吗？",

    // share
    shareTitle: "安全卡片",
    shareSub: "不含原文，仅展示处理结果与隐私承诺",
    btnDownload: "下载",

    // footer / links
    learn: "了解更多",
    privacy: "隐私原则",
    scope: "MVP 范围",
    foot: "本工具仅提供风险提示，不构成法律建议。"
  },

  en: {
    inTitle: "Filter before AI reads.",
    outTitle: "Filtered text — paste directly into AI.",

    placeholder: "Paste text you plan to send to AI…",
    inputWatermark:
      "Tip: avoid pasting full IDs, bank numbers, signatures.\nRemove combinations like name+address+account.\nRuns locally — no upload, no storage.",

    moneyLabel: "Money:",
    moneyOff: "Off",
    moneyM1: "Exact",
    moneyM2: "Range",
    btnGenerate: "Run Filter",
    btnClear: "Clear",

    btnCopy: "Copy",
    btnCopied: "✔ Copied",

    fbQ: "Helpful?",

    shareTitle: "Safety Card",
    shareSub: "No original text — stats & privacy pledge only",
    btnDownload: "Download",

    learn: "Learn",
    privacy: "Privacy",
    scope: "MVP",
    foot: "Risk hints only. Not legal advice."
  },

  de: {
    inTitle: "Filter, bevor KI liest.",
    outTitle: "Gefilterter Text — direkt in KI einfügen.",

    placeholder: "Text einfügen, den du an KI senden willst…",
    inputWatermark:
      "Tipp: keine vollständigen Ausweise/Kontonummern/Signaturen.\nKombis wie Name+Adresse+Konto vermeiden.\nLäuft lokal — kein Upload, keine Speicherung.",

    moneyLabel: "Betrag:",
    moneyOff: "Aus",
    moneyM1: "Genau",
    moneyM2: "Bereich",
    btnGenerate: "Filter anwenden",
    btnClear: "Leeren",

    btnCopy: "Kopieren",
    btnCopied: "✔ Kopiert",

    fbQ: "Hilfreich?",

    shareTitle: "Sicherheitskarte",
    shareSub: "Kein Originaltext — nur Statistik & Versprechen",
    btnDownload: "Download",

    learn: "Mehr",
    privacy: "Datenschutz",
    scope: "MVP",
    foot: "Nur Risikohinweise. Keine Rechtsberatung."
  }
};

window.I18N = I18N;
