// assets/share.js
// Auto share card generator (NO original text). Generates preview only after filtering.
// Trigger: window event "safe:updated" (dispatched by app.js after applyRules()).

(function () {
  function $(id){ return document.getElementById(id); }

  function getLang(){
    return window.currentLang || "zh";
  }

  function t(){
    const lang = getLang();
    const dict = {
      zh: {
        shareTitle: "过滤成就",
        shareSub: "不含原文，仅展示处理结果与隐私承诺",
        badge: "本地生成 · 不上传 · 不保存",
        line1: "AI Input Filter",
        line2: "在 AI 读取之前，先通过 Filter。",
        statHits: "已遮盖",
        statUnit: "项",
        statMoney: "金额保护",
        mOff: "关闭",
        m1: "精确",
        m2: "区间",
        placeholder: "生成后显示预览"
      },
      de: {
        shareTitle: "Filter-Ergebnis",
        shareSub: "Kein Originaltext — nur Ergebnis & Zusage",
        badge: "Lokal · kein Upload · keine Speicherung",
        line1: "AI Input Filter",
        line2: "Filter, bevor KI liest.",
        statHits: "Maskiert",
        statUnit: "Treffer",
        statMoney: "Betrag",
        mOff: "Aus",
        m1: "Genau",
        m2: "Bereich",
        placeholder: "Vorschau nach dem Filtern"
      },
      en: {
        shareTitle: "Filter Result",
        shareSub: "No original text — stats & privacy pledge only",
        badge: "Local · no upload · no storage",
        line1: "AI Input Filter",
        line2: "Filter before AI reads.",
        statHits: "Masked",
        statUnit: "items",
        statMoney: "Money",
        mOff: "Off",
        m1: "Exact",
        m2: "Range",
        placeholder: "Preview appears after filtering"
      }
    };
    return dict[lang] || dict.zh;
  }

  function getMetrics(){
    const hits = Number(window.__safe_hits || 0);
    const moneyMode = String(window.__safe_moneyMode || "off");
    return { hits, moneyMode };
  }

  function formatMoneyMode(m){
    const L = t();
    if (m === "m1") return L.m1;
    if (m === "m2") return L.m2;
    return L.mOff;
  }

  // ========= Logo assets (Filter) =========
  const LOGO_ICON_SRC = "./assets/logo-filter-icon.png";
  const LOGO_FULL_SRC = "./assets/logo-filter-full.png";

  const _imgCache = new Map();
  function loadImg(src){
    if (_imgCache.has(src)) return _imgCache.get(src);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    _imgCache.set(src, p);
    return p;
  }

  function roundRect(ctx, x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function drawImageContain(ctx, img, x, y, w, h){
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;

    const r = Math.min(w / iw, h / ih);
    const nw = iw * r;
    const nh = ih * r;
    const nx = x + (w - nw) / 2;
    const ny = y + (h - nh) / 2;
    ctx.drawImage(img, nx, ny, nw, nh);
  }

  function nowStamp(){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  async function drawCard(){
    const w = 1080, h = 1350;
    const L = t();
    const { hits, moneyMode } = getMetrics();

    const [logoIcon, logoFull] = await Promise.all([
      loadImg(LOGO_ICON_SRC),
      loadImg(LOGO_FULL_SRC)
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    // Background
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0, "rgba(12,16,24,1)");
    g.addColorStop(0.5, "rgba(18,22,34,1)");
    g.addColorStop(1, "rgba(10,14,20,1)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // Soft blobs
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.filter = "blur(40px)";
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.beginPath(); ctx.arc(w*0.20, h*0.18, Math.min(w,h)*0.18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.beginPath(); ctx.arc(w*0.85, h*0.30, Math.min(w,h)*0.22, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.arc(w*0.70, h*0.85, Math.min(w,h)*0.26, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.filter = "none";

    const pad = 84;

    // Main panel
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "rgba(255,255,255,.06)";
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.lineWidth = 2;
    roundRect(ctx, pad, pad, w-pad*2, h-pad*2, 34);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    // Top icon frame
    const iconSize = 112;
    const iconX = pad + 56;
    const iconY = pad + 56;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 2;
    roundRect(ctx, iconX, iconY, iconSize, iconSize, 30);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    if (logoIcon) {
      ctx.save();
      ctx.globalAlpha = 0.98;
      drawImageContain(ctx, logoIcon, iconX, iconY, iconSize, iconSize);
      ctx.restore();
    }

    // Title + subtitle
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = "900 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(L.line1, pad + 56 + iconSize + 26, pad + 110);

    ctx.fillStyle = "rgba(255,255,255,.72)";
    ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(L.line2, pad + 56 + iconSize + 26, pad + 160);
    ctx.restore();

    // Badge
    const badgeText = L.badge;
    ctx.save();
    ctx.font = "650 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const padX = 22;
    const bw = ctx.measureText(badgeText).width + padX*2;
    const bh = 54;

    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, pad + 56, pad + 210, bw, bh, 22);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.textBaseline = "middle";
    ctx.fillText(badgeText, pad + 56 + padX, pad + 210 + bh/2);
    ctx.restore();

    // Stats cards
    const statX = pad + 56;
    const statY = pad + 320;
    const gap = 18;
    const cardW = (w - pad*2 - 56*2 - gap) / 2;
    const cardH = 220;

    function statCard(x, y, title, value){
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,.08)";
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, cardW, cardH, 26);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.font = "650 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(title, x + 26, y + 54);

      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.font = "900 82px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(value, x + 26, y + 150);
      ctx.restore();
    }

    statCard(statX, statY, `${L.statHits}`, `${hits} ${L.statUnit}`);
    statCard(statX + cardW + gap, statY, `${L.statMoney}`, formatMoneyMode(moneyMode));

    // Watermark icon
    if (logoIcon) {
      const midSize = 280;
      const midX = w/2 - midSize/2;
      const midY = statY + cardH + 80;
      ctx.save();
      ctx.globalAlpha = 0.10;
      drawImageContain(ctx, logoIcon, midX, midY, midSize, midSize);
      ctx.restore();
    }

    // Bottom pledge
    const bottomY = h - pad - 70;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.60)";
    ctx.font = "650 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(L.badge, pad + 56, bottomY);

    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.font = "500 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(nowStamp(), pad + 56, bottomY + 40);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillText("gavingao73.github.io/ai-input-safety", w - pad - 56, bottomY + 40);
    ctx.restore();

    // Small full logo
    if (logoFull) {
      const fullW = 320, fullH = 86;
      const fx = w - pad - 56 - fullW;
      const fy = bottomY - 18 - fullH;
      ctx.save();
      ctx.globalAlpha = 0.82;
      drawImageContain(ctx, logoFull, fx, fy, fullW, fullH);
      ctx.restore();
    }

    return canvas;
  }

  function canvasToPngDataUrl(canvas){
    return canvas.toDataURL("image/png", 1.0);
  }

  function downloadDataUrl(dataUrl, filename){
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  let lastDataUrl = "";
  let isBusy = false;

  function setPanelTexts(){
    const L = t();
    if ($("ui-share-title")) $("ui-share-title").textContent = L.shareTitle;
    if ($("ui-share-sub")) $("ui-share-sub").textContent = L.shareSub;
    if ($("sharePlaceholder")) $("sharePlaceholder").textContent = L.placeholder;
  }

  function setPreviewState(hasImg){
    const img = $("shareAutoImg");
    const ph = $("sharePlaceholder");
    if (img) {
      if (hasImg) {
        img.style.opacity = "1";
        img.style.transform = "translateY(0)";
      } else {
        img.style.opacity = "0";
        img.style.transform = "translateY(2px)";
      }
    }
    if (ph) ph.style.display = hasImg ? "none" : "flex";
  }

  async function refreshCard(){
    if (isBusy) return;

    const outText = String(($("outputText") && $("outputText").textContent) || "").trim();
    const img = $("shareAutoImg");

    // ✅ 没有输出：保持占位，不生成（但“过滤成就”仍可折叠存在）
    if (!outText) {
      lastDataUrl = "";
      if (img) img.removeAttribute("src");
      setPreviewState(false);
      return;
    }

    // ✅ 有输出：生成并展示
    isBusy = true;
    try{
      const canvas = await drawCard();
      lastDataUrl = canvasToPngDataUrl(canvas);
      if (img) img.src = lastDataUrl;
      setPreviewState(true);

      // ✅ 确保同步生成时自动展开
      const details = $("shareDetails");
      if (details) details.open = true;

    } finally{
      isBusy = false;
    }
  }

  function bind(){
    const btn = $("btnShareDownload");
    if (btn) {
      btn.onclick = async () => {
        if (!lastDataUrl) await refreshCard();
        if (!lastDataUrl) return;
        const file = `ai-input-filter_card_${nowStamp()}.png`;
        downloadDataUrl(lastDataUrl, file);
      };
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    loadImg(LOGO_ICON_SRC);
    loadImg(LOGO_FULL_SRC);

    setPanelTexts();
    bind();

    // 初始：无图占位
    setPreviewState(false);

    window.addEventListener("safe:updated", () => {
      setPanelTexts();
      refreshCard();
    });
  });

})();
