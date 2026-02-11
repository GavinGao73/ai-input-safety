// assets/share.js
// Share card generator (no user text included). Creates a premium-looking image + badge.
// Sizes: 1080x1350 (4:5), 1080x1080, 1200x628.
// Outputs: PNG data URL, downloadable. Uses Web Share API when available.

(function () {
  function $(id){ return document.getElementById(id); }

  function getLang(){
    // from app.js global variable
    return window.currentLang || "zh";
  }

  function t(){
    const lang = getLang();
    const dict = {
      zh: {
        shareTitle: "分享安全卡片",
        shareSub: "不包含你的原文，仅分享安全处理成果",
        modalTitle: "分享预览",
        note: "注意：卡片不包含你的原文内容，只显示处理统计与隐私承诺。",
        copyText: "我刚用 Safe Before Send 本地清洗了一段敏感信息：已遮盖 {hits} 项。推荐你也在发送前做一次风险控制。",
        badge: "本地生成 · 不上传 · 不保存",
        line1: "Safe Before Send",
        line2: "在发送前，先做一次信息风控",
        statHits: "已遮盖",
        statUnit: "项",
        statMoney: "金额保护",
        mOff: "关闭",
        m1: "精确遮盖",
        m2: "区间遮盖"
      },
      de: {
        shareTitle: "Share-Sicherheitskarte",
        shareSub: "Kein Originaltext – nur Ergebnis & Versprechen",
        modalTitle: "Vorschau",
        note: "Hinweis: Die Karte enthält keinen Originaltext, nur Statistik & Datenschutzversprechen.",
        copyText: "Ich habe gerade mit Safe Before Send lokal sensible Infos bereinigt: {hits} Treffer maskiert. Empfehlung: vor dem Senden kurz prüfen.",
        badge: "Lokal · kein Upload · keine Speicherung",
        line1: "Safe Before Send",
        line2: "Vor dem Senden: Risiko reduzieren",
        statHits: "Maskiert",
        statUnit: "Treffer",
        statMoney: "Betragsschutz",
        mOff: "Aus",
        m1: "Genau",
        m2: "Bereich"
      },
      en: {
        shareTitle: "Share Safety Card",
        shareSub: "No original text — only outcome & promise",
        modalTitle: "Preview",
        note: "Note: the card contains no original text, only stats & privacy promise.",
        copyText: "I just used Safe Before Send locally: {hits} sensitive items masked. Recommend doing a quick safety pass before sending.",
        badge: "Local · no upload · no storage",
        line1: "Safe Before Send",
        line2: "Before you send: reduce leakage risk",
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
    // app.js will set these globals
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

  function sizes(kind){
    if (kind === "wide") return { w: 1200, h: 628 };
    if (kind === "square") return { w: 1080, h: 1080 };
    return { w: 1080, h: 1350 }; // story default
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

  function drawBadge(ctx, x, y, text){
    // badge pill with subtle glow
    ctx.save();
    ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    const padX = 22, padY = 14;
    const w = ctx.measureText(text).width + padX*2;
    const h = 54;
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + padX, y + h/2);
    ctx.restore();
    return { w, h };
  }

  function drawLogoMark(ctx, x, y){
    // Minimal lock mark (vector-like) for branding
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.92;

    // outer circle
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0,0,46,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // lock body
    ctx.fillStyle = "rgba(255,255,255,.92)";
    roundRect(ctx, -18, -4, 36, 30, 10);
    ctx.fill();

    // shackle
    ctx.strokeStyle = "rgba(255,255,255,.92)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -10, 16, Math.PI*1.1, Math.PI*1.9);
    ctx.stroke();

    // keyhole
    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.beginPath();
    ctx.arc(0, 10, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.fillRect(-2, 10, 4, 10);

    ctx.restore();
  }

  function drawCard(kind){
    const { w, h } = sizes(kind);
    const L = t();
    const { hits, moneyMode } = getMetrics();

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    // Background gradient (premium look)
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

    const pad = (kind === "wide") ? 70 : 84;

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
    const brandX = pad + 56;
    const brandY = pad + 70;

    drawLogoMark(ctx, pad + 76, brandY);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.font = (kind === "wide") ? "800 46px system-ui, -apple-system, Segoe UI, Roboto, Arial"
                                 : "900 54px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(L.line1, brandX + 90, brandY + 16);

    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = (kind === "wide") ? "500 26px system-ui, -apple-system, Segoe UI, Roboto, Arial"
                                 : "500 28px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText(L.line2, brandX + 90, brandY + 60);
    ctx.restore();

    // Badge
    const badgeText = L.badge;
    const b = drawBadge(ctx, pad + 56, brandY + 98, badgeText);

    // Stats section
    const statX = pad + 56;
    const statY = brandY + 190;

    // Two stat cards
    const cardGap = 18;
    const cardW = (w - pad*2 - 56*2 - cardGap) / 2;
    const cardH = (kind === "wide") ? 190 : 210;

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
      ctx.font = (kind === "wide") ? "900 74px system-ui, -apple-system, Segoe UI, Roboto, Arial"
                                   : "900 82px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(value, x + 26, y + 140);

      ctx.restore();
    }

    statCard(statX, statY, `${L.statHits}`, `${hits} ${L.statUnit}`);
    statCard(statX + cardW + cardGap, statY, `${L.statMoney}`, formatMoneyMode(moneyMode));

    // Bottom: privacy pledge + date + URL
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

    // Corner watermark badge (small)
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.font = "800 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.textAlign = "right";
    ctx.fillText("SAFE • LOCAL", w - pad - 40, pad + 52);
    ctx.restore();

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

  async function shareSystem(dataUrl){
    // Web Share API with files (mobile)
    try{
      if (!navigator.share) return false;

      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "safe-before-send.png", { type: "image/png" });

      // Some browsers require canShare
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        return false;
      }

      await navigator.share({
        files: [file],
        title: "Safe Before Send",
        text: t().copyText.replace("{hits}", String(getMetrics().hits))
      });
      return true;
    }catch(e){
      return false;
    }
  }

  function openModal(){
    const m = $("shareModal");
    if (!m) return;
    m.setAttribute("aria-hidden", "false");
  }
  function closeModal(){
    const m = $("shareModal");
    if (!m) return;
    m.setAttribute("aria-hidden", "true");
  }

  function setModalI18n(){
    const L = t();
    if ($("ui-share-title")) $("ui-share-title").textContent = L.shareTitle;
    if ($("ui-share-sub")) $("ui-share-sub").textContent = L.shareSub;
    if ($("ui-share-modal-title")) $("ui-share-modal-title").textContent = L.modalTitle;
    if ($("ui-share-note")) $("ui-share-note").textContent = L.note;
  }

  function getShareKind(){
    const sel = $("shareSize");
    return (sel && sel.value) ? sel.value : "story";
  }

  function makeCard(){
    setModalI18n();
    const kind = getShareKind();
    const canvas = drawCard(kind);
    const dataUrl = canvasToPngDataUrl(canvas);
    const img = $("sharePreviewImg");
    if (img) img.src = dataUrl;
    return { kind, dataUrl };
  }

  function copyShareText(){
    const txt = t().copyText.replace("{hits}", String(getMetrics().hits));
    navigator.clipboard.writeText(txt);
  }

  function bind(){
    const previewBtn = $("btnSharePreview");
    const downloadBtn = $("btnShareDownload");
    const downloadBtn2 = $("btnShareDownload2");
    const closeBtn = $("btnShareClose");
    const mask = $("shareMask");
    const sysBtn = $("btnShareSystem");
    const copyBtn = $("btnShareCopyText");

    if (previewBtn) previewBtn.onclick = () => {
      const { dataUrl } = makeCard();
      openModal();
    };

    if (downloadBtn) downloadBtn.onclick = () => {
      const { kind, dataUrl } = makeCard();
      const file = `safe-before-send_${kind}_${nowStamp()}.png`;
      downloadDataUrl(dataUrl, file);
    };

    if (downloadBtn2) downloadBtn2.onclick = () => {
      const { kind, dataUrl } = makeCard();
      const file = `safe-before-send_${kind}_${nowStamp()}.png`;
      downloadDataUrl(dataUrl, file);
    };

    if (copyBtn) copyBtn.onclick = () => copyShareText();

    if (sysBtn) sysBtn.onclick = async () => {
      const { dataUrl } = makeCard();
      const ok = await shareSystem(dataUrl);
      if (!ok) {
        // fallback: download
        const file = `safe-before-send_${getShareKind()}_${nowStamp()}.png`;
        downloadDataUrl(dataUrl, file);
      }
    };

    if (closeBtn) closeBtn.onclick = () => closeModal();
    if (mask) mask.onclick = () => closeModal();

    // Update i18n when language changes (app.js triggers regeneration anyway)
    setModalI18n();
  }

  // wait for DOM + app.js
  window.addEventListener("DOMContentLoaded", () => {
    bind();
  });

})();
