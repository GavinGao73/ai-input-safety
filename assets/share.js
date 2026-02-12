// assets/share.js
// Share card generator (no user text included).
// v2: Auto-generate + auto-preview + single download button (no modal, no size options)

(function () {
  function $(id){ return document.getElementById(id); }

  function getLang(){
    return window.currentLang || "zh";
  }

  function t(){
    const lang = getLang();
    const dict = {
      zh: {
        shareTitle: "安全卡片",
        shareSub: "不包含原文，仅展示处理结果与隐私承诺",
        badge: "本地生成 · 不上传 · 不保存",
        line1: "AI Input Filter",
        line2: "在 AI 读取之前，先通过 Filter。",
        statHits: "已遮盖",
        statUnit: "项",
        statMoney: "金额保护",
        mOff: "关闭",
        m1: "精确遮盖",
        m2: "区间遮盖"
      },
      de: {
        shareTitle: "Sicherheitskarte",
        shareSub: "Kein Originaltext – nur Ergebnis & Versprechen",
        badge: "Lokal · kein Upload · keine Speicherung",
        line1: "AI Input Filter",
        line2: "Filter, bevor KI liest.",
        statHits: "Maskiert",
        statUnit: "Treffer",
        statMoney: "Betragsschutz",
        mOff: "Aus",
        m1: "Genau",
        m2: "Bereich"
      },
      en: {
        shareTitle: "Safety Card",
        shareSub: "No original text — only outcome & promise",
        badge: "Local · no upload · no storage",
        line1: "AI Input Filter",
        line2: "Filter before AI reads.",
        statHits: "Masked",
        statUnit: "items",
        statMoney: "Money mode",
        mOff: "Off",
        m1: "Exact",
        m2: "Range"
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

  function nowStamp(){
    const d = new Date();
    const pad = (n)=> String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
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

  function drawBadge(ctx, x, y, text){
    ctx.save();
    ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const padX = 20, padY = 12;
    const w = ctx.measureText(text).width + padX*2;
    const h = 48;

    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + padX, y + h/2);
    ctx.restore();
    return { w, h };
  }

  function drawIconFrame(ctx, cx, cy, size){
    const x = cx - size/2;
    const y = cy - size/2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, size, size, Math.round(size * 0.28));
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
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

  async function drawCard(){
    // single size (story-like, good for sharing)
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

    // Background gradient
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

    // Top brand row
    const brandY = pad + 70;
    const iconSize = 104;
    const iconCx = pad + 76;
    const iconCy = brandY;

    drawIconFrame(ctx, iconCx, iconCy, iconSize);

    if (logoIcon) {
      ctx.save();
      ctx.globalAlpha = 0.98;
      drawImageContain(ctx, logoIcon, iconCx - iconSize/2, iconCy - iconSize/2, iconSize, iconSize);
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = "900 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(L.line1, pad + 190, brandY + 16);

    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = "500 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(L.line2, pad + 190, brandY + 60);
    ctx.restore();

    // Badge
    drawBadge(ctx, pad + 56, brandY + 98, L.badge);

    // Stats cards
    const statX = pad + 56;
    const statY = brandY + 190;
    const gap = 18;
    const cardW = (w - pad*2 - 56*2 - gap) / 2;
    const cardH = 210;

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
      ctx.fillText(value, x + 26, y + 140);

      ctx.restore();
    }

    // watermark icon
    if (logoIcon) {
      const midSize = 260;
      const midX = w/2 - midSize/2;
      const midY = statY + cardH/2 - midSize/2 + 10;
      ctx.save();
      ctx.globalAlpha = 0.10;
      drawImageContain(ctx, logoIcon, midX, midY, midSize, midSize);
      ctx.restore();
    }

    statCard(statX, statY, `${L.statHits}`, `${hits} ${L.statUnit}`);
    statCard(statX + cardW + gap, statY, `${L.statMoney}`, formatMoneyMode(moneyMode));

    // Bottom
    const bottomY = h - pad - 70;

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.60)";
    ctx.font = "600 26px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(L.badge, pad + 56, bottomY);

    ctx.fillStyle = "rgba(255,255,255,.45)";
    ctx.font = "500 22px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(nowStamp(), pad + 56, bottomY + 40);

    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillText("gavingao73.github.io/ai-input-safety", w - pad - 56, bottomY + 40);
    ctx.restore();

    // small full logo (brand)
    if (logoFull) {
      const fullW = 260;
      const fullH = 70;
      const fx = w - pad - 56 - fullW;
      const fy = bottomY - 10 - fullH;

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

  // cache latest card to avoid regenerating on download click
  let _lastDataUrl = "";
  let _lastLang = "";
  let _lastHits = null;
  let _lastMoney = null;

  async function updateShareAuto(force){
    const { hits, moneyMode } = getMetrics();
    const lang = getLang();

    const shouldSkip =
      !force &&
      _lastDataUrl &&
      _lastLang === lang &&
      _lastHits === hits &&
      _lastMoney === moneyMode;

    if (shouldSkip) return;

    const imgEl = $("shareAutoImg");
    if (!imgEl) return;

    const canvas = await drawCard();
    const dataUrl = canvasToPngDataUrl(canvas);

    _lastDataUrl = dataUrl;
    _lastLang = lang;
    _lastHits = hits;
    _lastMoney = moneyMode;

    imgEl.src = dataUrl;
  }

  function bind(){
    const downloadBtn = $("btnShareDownload");
    if (downloadBtn) {
      downloadBtn.onclick = async () => {
        await updateShareAuto(true);
        const file = `ai-input-filter_card_${nowStamp()}.png`;
        if (_lastDataUrl) downloadDataUrl(_lastDataUrl, file);
      };
    }
  }

  window.updateShareAuto = updateShareAuto;

  window.addEventListener("DOMContentLoaded", () => {
    // warm preload
    loadImg(LOGO_ICON_SRC);
    loadImg(LOGO_FULL_SRC);

    bind();
    updateShareAuto(true);
  });

})();
