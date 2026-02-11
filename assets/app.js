let currentLang = "zh";
const enabled = new Set();

function $(id){ return document.getElementById(id); }

function initEnabled(){
  enabled.clear();
  Object.values(DETECTION_ITEMS).flat().forEach(i=>{
    if(i.defaultOn) enabled.add(i.key);
  });
}

function setText(){
  const t = I18N[currentLang];
  $("ui-slogan").textContent = t.slogan;
  $("ui-in-title").textContent = t.inTitle;
  $("ui-in-sub").textContent = t.inSub;
  $("inputText").placeholder = t.placeholder;
  $("ui-panel-title").textContent = t.panelTitle;
  $("ui-panel-pill").textContent = t.panelPill;
  $("ui-panel-hint").textContent = t.panelHint;
  $("ui-l1-title").textContent = t.l1Title;
  $("ui-l1-note").textContent = t.l1Note;
  $("ui-l2-title").textContent = t.l2Title;
  $("ui-l2-note").textContent = t.l2Note;
  $("ui-l3-title").textContent = t.l3Title;
  $("ui-l3-note").textContent = t.l3Note;
  $("btnGenerate").textContent = t.btnGenerate;
  $("btnCopy").textContent = t.btnCopy;
  $("btnExample").textContent = t.btnExample;
  $("btnClear").textContent = t.btnClear;
  $("ui-out-title").textContent = t.outTitle;
  $("ui-out-sub").textContent = t.outSub;
  $("ui-hit-pill").textContent = t.hitPill;
  $("ui-risk-one").textContent = t.riskOne;
  $("ui-risk-two").textContent = t.riskTwo;
  $("ui-fb-q").textContent = t.fbQ;
  $("ui-foot").textContent = t.foot;
}

function applyRules(text){
  let out = text;
  let hits = 0;
  for(const k of enabled){
    const r = RULES_BY_KEY[k];
    if(!r) continue;
    out = out.replace(r.pattern, ()=>{
      hits++;
      return r.replace;
    });
  }
  $("hitCount").textContent = hits;
  return out;
}

function bind(){
  document.querySelectorAll(".lang button").forEach(b=>{
    b.onclick=()=>{
      document.querySelectorAll(".lang button").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      currentLang=b.dataset.lang;
      setText();
    };
  });

  $("btnGenerate").onclick=()=>{
    $("outputText").textContent = applyRules($("inputText").value||"");
  };
  $("btnClear").onclick=()=>{
    $("inputText").value="";
    $("outputText").textContent="";
    $("hitCount").textContent="0";
  };
  $("btnCopy").onclick=()=>{
    navigator.clipboard.writeText($("outputText").textContent||"");
  };
}

initEnabled();
setText();
bind();

