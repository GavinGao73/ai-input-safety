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

function escapeHtml(s){
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
    title: "风险评分",
    low: "低风险",
    mid: "中风险",
    high: "高风险",
    top: "主要风险来源",
    advice: "建议",
    adviceLow: "可以使用；报价/合同类内容建议开启金额保护。",
    adviceMid: "请检查 Top 项；必要时加强金额/地址/账号遮盖。",
    adviceHigh: "不建议直接发送：请删签名落款/账号信息，并加严遮盖后再试。",
    meta: (m) => `命中 ${m.hits}｜金额 ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜文件" : ""}`
  };
  const de = {
    title: "Risikowert",
    low: "Niedrig",
    mid: "Mittel",
    high: "Hoch",
    top: "Top-Risiken",
    advice: "Empfehlung",
    adviceLow: "Kann verwendet werden. Für Angebote/Verträge Betragsschutz aktivieren.",
    adviceMid: "Top-Risiken prüfen; ggf. Betrag/Adresse/Konto stärker maskieren.",
    adviceHigh: "Nicht direkt senden: Signatur/Kontodaten entfernen und mehr Maskierung aktivieren.",
    meta: (m) => `Treffer ${m.hits}｜Betrag ${String(m.moneyMode || "").toUpperCase()}${m.fromPdf ? "｜Datei" : ""}`
  };
  const en = {
    title: "Risk score",
    low: "Low",
    mid: "Medium",
    high: "High",
    top: "Top risk sources",
    advice: "Advice",
    adviceLow: "Ok to use. For quotes/contracts, enable money protection.",
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
    <div class="riskhead">
      <div class="riskleft">
        <div class="risktitle">${t.title}</div>
        <div class="riskmeta">${t.meta(meta)}</div>
      </div>

      <div class="riskscore">
        <div class="n">${report.score}</div>
        <div class="l">${levelText}</div>
      </div>
    </div>

    <div class="risksec">
      <div class="risklabel">${t.top}</div>
      <div class="risklist">${topHtml}</div>
    </div>

    <div class="risksec">
      <div class="risklabel">${t.advice}</div>
      <div class="riskadvice">${advice}</div>
    </div>
  `;
}
/* ==================== Risk scoring end ==================== */

/* ==================== Input overlay highlight ==================== */
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

function highlightInputHits(text){
  let s = String(text || "");
  if (!s) return "";

  const marks = [];
  const raw = s;

  for (const key of PRIORITY) {
    if (key !== "money" && !enabled.has(key)) continue;
    if (key === "money" && moneyMode === "off") continue;

    const r = RULES_BY_KEY[key];
    if (!r || !r.pattern) continue;

    const re = new RegExp(
      r.pattern.source,
      r.pattern.flags.includes("g") ? r.pattern.flags : (r.pattern.flags + "g")
    );

    let m;
    while ((m = re.exec(raw)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (end > start) marks.push([start, end]);
      if (m[0].length === 0) break;
    }
  }

  if (!marks.length) return escapeHtml(raw);

  marks.sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
  const merged = [];
  for (const [s0,e0] of marks){
    const last = merged[merged.length-1];
    if (!last || s0 > last[1]) merged.push([s0,e0]);
    else last[1] = Math.max(last[1], e0);
  }

  let out = "";
  let cur = 0;
  for (const [a,b] of merged){
    if (a > cur) out += escapeHtml(raw.slice(cur, a));
    out += `<span class="hit">${escapeHtml(raw.slice(a,b))}</span>`;
    cur = b;
  }
  if (cur < raw.length) out += escapeHtml(raw.slice(cur));
  return out;
}

function syncWatermark(){
  const wrap = $("textareaWrap");
  const txt = ($("inputText") && $("inputText").value) ? String($("inputText").value) : "";
  if (!wrap) return;
  if (txt.trim().length > 0) wrap.classList.add("has-input");
  else wrap.classList.remove("has-input");
}

function renderInputOverlay(){
  const ov = $("inputOverlay");
  const ta = $("inputText");
  if (!ov || !ta) return;
  ov.innerHTML = highlightInputHits(ta.value || "");
  ov.scrollTop = ta.scrollTop;
  ov.scrollLeft = ta.scrollLeft;
}
/* ==================== Input overlay end ==================== */

function setPageHeightMode() {
  // ✅ 两档页面高度：有生成内容/面板展开 => expanded
  const body = document.body;
  const outHas = String(($("outputText") && $("outputText").textContent) || "").trim().length > 0;
  const riskOpen = !!($("riskDetails") && $("riskDetails").open);
  const shareOpen = !!($("shareDetails") && $("shareDetails").open);
  if (outHas || riskOpen || shareOpen) body.classList.add("expanded");
  else body.classList.remove("expanded");
}

function setText() {
  const t = I18N[currentLang];

  if ($("ui-in-title")) $("ui-in-title").textContent = t.inTitle;
  if ($("ui-out-title")) $("ui-out-title").textContent = t.outTitle;

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

  // risk/share panel titles
  if ($("ui-risk-title")) $("ui-risk-title").textContent = t.riskPanelTitle;
  if ($("ui-share-title")) $("ui-share-title").textContent = t.shareTitle;

  // share texts
  if ($("ui-share-sub")) $("ui-share-sub").textContent = t.shareSub;
  if ($("sharePlaceholder")) $("sharePlaceholder").textContent = t.sharePlaceholder;
  if ($("btnShareDownload")) $("btnShareDownload").textContent = t.btnDownload;

  // links
  if ($("linkLearn")) $("linkLearn").textContent = t.learn;
  if ($("linkPrivacy")) $("linkPrivacy").textContent = t.privacy;
  if ($("linkScope")) $("linkScope").textContent = t.scope;

  // footer
  if ($("ui-foot")) $("ui-foot").textContent = t.foot;
}

function maskHtmlForOutput(s){
  let out = escapeHtml(String(s || ""));
  const patterns = [
    /【电话】|【邮箱】|【账号】|【地址】|【账号名】|【编号】|【称谓】|【数字】|【金额】/g,
    /\[Telefon\]|\[E-Mail\]|\[Konto\]|\[Adresse\]|\[Handle\]|\[Referenz\]|\[Anrede\]|\[Zahl\]|\[Betrag\]/g,
    /\[Phone\]|\[Email\]|\[Account\]|\[Address\]|\[Handle\]|\[Ref\]|\[Title\]|\[Number\]|\[Amount\]/g
  ];
  for (const re of patterns){
    out = out.replace(re, (m)=> `<span class="mark">${m}</span>`);
  }
  return out;
}

// ---- rule application ----
function applyRules(text) {
  let out = String(text || "");
  let hits = 0;
  const hitsByKey = {};

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

  // ✅ 自动展开风险评分
  const rd = $("riskDetails");
  if (rd) rd.open = true;

  // ✅ 自动刷新卡片
  window.dispatchEvent(new Event("safe:updated"));

  // ✅ 两档高度更新
  setPageHeightMode();

  return out;
}

/* ============ PDF helpers (text-layer probe) ============ */
async function handlePdf(file) {
  if (!file) return;
  if (file.type !== "application/pdf") return;

  try {
    if (!window.probePdfTextLayer) return;

    const probe = await window.probePdfTextLayer(file);
    lastRunMeta.fromPdf = true;

    if (!probe || !probe.hasTextLayer) return;

    const text = String(probe.text || "").trim();
    if (!text) return;

    // ✅ 1) 写入左侧输入框（用于验证水印消失 + 输入命中高亮）
    const ta = $("inputText");
    if (ta) {
      ta.value = text;
      syncWatermark();
      renderInputOverlay();
    }

    // ✅ 2) 同步生成右侧输出
    const filtered = applyRules(text);
    const outEl = $("outputText");
    if (outEl) outEl.innerHTML = maskHtmlForOutput(filtered);

    // ✅ 3) 自动展开过滤成就
    const sd = $("shareDetails");
    if (sd) sd.open = true;

    // ✅ 两档高度更新
    setPageHeightMode();

  } catch (e) {}
}

function bindPdfUI() {
  const pdfInput = $("pdfFile");
  const filebar = $("filebar") || document.querySelector(".filebar");
  const fileName = $("fileName");

  if (pdfInput) {
    pdfInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f && fileName) fileName.textContent = f.name;
      handlePdf(f);
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
      if (f && fileName) fileName.textContent = f.name;
      handlePdf(f);
    });
  }
}

function bind() {
  // lang
  document.querySelectorAll(".lang button").forEach(b => {
    b.onclick = () => {
      document.querySelectorAll(".lang button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");

      currentLang = b.dataset.lang;
      window.currentLang = currentLang;
      lastRunMeta.lang = currentLang;

      setText();

      renderInputOverlay();
      syncWatermark();

      const inTxt = ($("inputText").value || "").trim();
      if (inTxt) {
        lastRunMeta.fromPdf = false;
        const filtered = applyRules(inTxt);
        const outEl = $("outputText");
        if (outEl) outEl.innerHTML = maskHtmlForOutput(filtered);
      } else {
        window.dispatchEvent(new Event("safe:updated"));
        setPageHeightMode();
      }
    };
  });

  // money
  const mm = $("moneyMode");
  if (mm) {
    mm.addEventListener("change", () => {
      moneyMode = mm.value || "off";
      window.__safe_moneyMode = moneyMode;

      renderInputOverlay();

      const inTxt = ($("inputText").value || "").trim();
      if (inTxt) {
        lastRunMeta.fromPdf = false;
        const filtered = applyRules(inTxt);
        const outEl = $("outputText");
        if (outEl) outEl.innerHTML = maskHtmlForOutput(filtered);
      } else {
        window.dispatchEvent(new Event("safe:updated"));
        setPageHeightMode();
      }
    });

    moneyMode = mm.value || "off";
    window.__safe_moneyMode = moneyMode;
  }

  // input overlay sync
  const ta = $("inputText");
  const ov = $("inputOverlay");
  if (ta && ov) {
    ta.addEventListener("input", () => {
      renderInputOverlay();
      syncWatermark();
      setPageHeightMode();
    });
    ta.addEventListener("scroll", () => {
      ov.scrollTop = ta.scrollTop;
      ov.scrollLeft = ta.scrollLeft;
    });

    renderInputOverlay();
    syncWatermark();
  }

  // details toggle -> height mode
  const rd = $("riskDetails");
  const sd = $("shareDetails");
  if (rd) rd.addEventListener("toggle", setPageHeightMode);
  if (sd) sd.addEventListener("toggle", setPageHeightMode);

  // generate
  const gen = $("btnGenerate");
  if (gen) gen.onclick = () => {
    lastRunMeta.fromPdf = false;
    const filtered = applyRules(($("inputText").value || ""));
    const outEl = $("outputText");
    if (outEl) outEl.innerHTML = maskHtmlForOutput(filtered);

    const sd2 = $("shareDetails");
    if (sd2) sd2.open = true;

    setPageHeightMode();
  };

  // clear
  const clr = $("btnClear");
  if (clr) clr.onclick = () => {
    if ($("inputText")) $("inputText").value = "";
    if ($("outputText")) $("outputText").innerHTML = "";
    if ($("fileName")) $("fileName").textContent = "";

    window.__safe_hits = 0;
    window.__safe_breakdown = {};
    window.__safe_score = 0;
    window.__safe_level = "low";
    window.__safe_report = null;

    lastRunMeta.fromPdf = false;

    const rb = $("riskBox");
    if (rb) rb.innerHTML = "";

    const rd2 = $("riskDetails");
    if (rd2) rd2.open = false;
    const sd2 = $("shareDetails");
    if (sd2) sd2.open = false;

    renderInputOverlay();
    syncWatermark();

    window.dispatchEvent(new Event("safe:updated"));
    setPageHeightMode();
  };

  // copy
  const cpy = $("btnCopy");
  if (cpy) cpy.onclick = async () => {
    const t = I18N[currentLang];
    try {
      await navigator.clipboard.writeText(($("outputText") && $("outputText").textContent) || "");
      const btn = $("btnCopy");
      if (btn) {
        const old = btn.textContent;
        btn.textContent = t.btnCopied || old;
        setTimeout(() => { btn.textContent = t.btnCopy || old; }, 900);
      }
    } catch (e) {}
  };

  // feedback
  const up = $("btnUp");
  const down = $("btnDown");
  if (up) up.onclick = () => {
    const n = Number($("upCount").textContent || "0") + 1;
    $("upCount").textContent = String(n);
  };
  if (down) down.onclick = () => {
    const n = Number($("downCount").textContent || "0") + 1;
    $("upCount").textContent = $("upCount").textContent || "0";
    $("downCount").textContent = String(n);
  };

  bindPdfUI();
  setPageHeightMode();
}

initEnabled();
setText();
bind();
