let currentLang = "zh";
window.currentLang = currentLang;

const enabled = new Set();
let moneyMode = "off"; // off | m1 | m2

// keep last filtered plain text for copy
let lastOutputPlain = "";

// --- Risk scoring meta (local only) ---
let lastRunMeta = {
  fromPdf: false,
  inputLen: 0,
  enabledCount: 0,
  moneyMode: "off",
  lang: "zh"
};

function $(id) { return document.getElementById(id); }

function escapeHTML(s){
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

/* ============ output rendering (highlight placeholders) ============ */
function renderOutput(outPlain){
  lastOutputPlain = String(outPlain || "");
  const host = $("outputText");
  if (!host) return;

  const html = escapeHTML(lastOutputPlain)
    // highlight placeholders 【...】 or [...]
    .replace(/(【[^【】]{1,24}】|\[[^\[\]]{1,24}\])/g, `<span class="hl">$1</span>`);

  host.innerHTML = html;
}

/* ============ Money range mapping (M2) ============ */
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

/* ============ init enabled ============ */
function initEnabled() {
  enabled.clear();
  Object.values(DETECTION_ITEMS).flat().forEach(i => {
    if (i.defaultOn) enabled.add(i.key);
  });
}

/* ==================== Risk scoring v1 ==================== */
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
    adviceLow: "可以继续使用；合同/报价类建议开启金额保护。",
    adviceMid: "建议检查 Top 项；必要时加严遮盖。",
    adviceHigh: "不建议直接发送：请删除签名落款/账号信息，并加严遮盖后再试。",
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
    adviceMid: "Top-Risiken prüfen; ggf. stärker maskieren.",
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
    adviceMid: "Review top risks; consider stronger masking.",
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

function setText() {
  const t = I18N[currentLang];

  window.currentLang = currentLang;

  if ($("ui-in-title")) $("ui-in-title").textContent = t.inTitle;
  if ($("ui-out-title")) $("ui-out-title").textContent = t.outTitle;

  if ($("inputText")) $("inputText").placeholder = t.placeholder;
  if ($("ui-input-watermark")) $("ui-input-watermark").textContent = t.inputWatermark;

  // fold titles
  if ($("ui-risk-title")) $("ui-risk-title").textContent = t.riskTitle || "风险评分";
  if ($("ui-share-title")) $("ui-share-title").textContent = t.shareTitle;
  if ($("ui-share-sub")) $("ui-share-sub").textContent = t.shareSub;
  if ($("ui-achv-placeholder")) $("ui-achv-placeholder").textContent = t.achvPlaceholder;

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
  if ($("btnCopy")) $("btnCopy").textContent = t.btnCopy;
  if ($("btnClear")) $("btnClear").textContent = t.btnClear;
  if ($("btnShareDownload")) $("btnShareDownload").textContent = t.btnDownload;

  // feedback
  if ($("ui-fb-q")) $("ui-fb-q").textContent = t.fbQ;

  // links
  if ($("linkLearn")) $("linkLearn").textContent = t.learn;
  if ($("linkPrivacy")) $("linkPrivacy").textContent = t.privacy;
  if ($("linkScope")) $("linkScope").textContent = t.scope;

  // footnote (left bottom fixed)
  if ($("ui-foot")) $("ui-foot").textContent = t.foot;
}

/* ============ rule application ============ */
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

  // Share metrics (local-only globals used by share.js)
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

  // render output + risk
  renderOutput(out);
  renderRiskBox(report, {
    hits,
    enabledCount: enabled.size,
    moneyMode,
    fromPdf: lastRunMeta.fromPdf,
    inputLen: lastRunMeta.inputLen
  });

  // auto expand risk + achv when there is output
  const hasOut = String(out || "").trim().length > 0;
  const rd = $("riskDetails");
  const ad = $("achvDetails");
  if (rd) rd.open = hasOut;
  if (ad) ad.open = hasOut;

  // auto refresh achievement card
  window.dispatchEvent(new Event("safe:updated"));

  return out;
}

/* ============ PDF helpers (default: write into input + generate output) ============ */
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

    // ✅ 默认写入输入框，便于对比
    const ta = $("inputText");
    if (ta) ta.value = text;

    // ✅ 同步生成输出 + 风险 + 成就
    applyRules(text);

  } catch (e) {
    // minimal UI: keep quiet
  }
}

function bindPdfUI() {
  const pdfInput = $("pdfFile");

  if (pdfInput) {
    pdfInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f && $("pdfName")) $("pdfName").textContent = f.name || "";
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

      const inTxt = ($("inputText").value || "").trim();
      if (inTxt) {
        lastRunMeta.fromPdf = false;
        applyRules(inTxt);
      } else {
        window.dispatchEvent(new Event("safe:updated"));
      }
    };
  });

  const mm = $("moneyMode");
  if (mm) {
    mm.addEventListener("change", () => {
      moneyMode = mm.value || "off";
      const inTxt = ($("inputText").value || "").trim();
      if (inTxt) {
        lastRunMeta.fromPdf = false;
        applyRules(inTxt);
      } else {
        window.__safe_moneyMode = moneyMode;
        window.dispatchEvent(new Event("safe:updated"));
      }
    });

    moneyMode = mm.value || "off";
    window.__safe_moneyMode = moneyMode;
  }

  $("btnGenerate").onclick = () => {
    lastRunMeta.fromPdf = false;
    applyRules($("inputText").value || "");
  };

  // ✅ 清空移动到右侧：清空输入+输出+风险+成就
  $("btnClear").onclick = () => {
    if ($("inputText")) $("inputText").value = "";
    renderOutput("");

    window.__safe_hits = 0;
    window.__safe_breakdown = {};
    window.__safe_score = 0;
    window.__safe_level = "low";
    window.__safe_report = null;

    lastRunMeta.fromPdf = false;

    const rb = $("riskBox");
    if (rb) rb.innerHTML = "";

    const rd = $("riskDetails");
    const ad = $("achvDetails");
    if (rd) rd.open = false;
    if (ad) ad.open = false;

    if ($("pdfName")) $("pdfName").textContent = "";

    window.dispatchEvent(new Event("safe:updated"));
  };

  $("btnCopy").onclick = async () => {
    const t = I18N[currentLang];
    try {
      await navigator.clipboard.writeText(lastOutputPlain || "");
      const btn = $("btnCopy");
      if (btn) {
        const old = btn.textContent;
        btn.textContent = t.btnCopied || old;
        setTimeout(() => { btn.textContent = t.btnCopy || old; }, 900);
      }
    } catch (e) {}
  };

  // feedback counters (local)
  const up = $("btnUp");
  const down = $("btnDown");
  if (up) up.onclick = () => {
    const n = Number($("upCount").textContent || "0") + 1;
    $("upCount").textContent = String(n);
  };
  if (down) down.onclick = () => {
    const n = Number($("downCount").textContent || "0") + 1;
    $("downCount").textContent = String(n);
  };

  bindPdfUI();

  // watermark should disappear when there is content
  const ta = $("inputText");
  if (ta) {
    ta.addEventListener("input", () => {
      // just trigger reflow; watermark is overlay, it doesn't block typing
      // (no-op, but keeps behavior explicit)
    });
  }
}

initEnabled();
setText();
bind();
