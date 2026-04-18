(function () {
  "use strict";

  function runTextMasking({
    text,
    lang = "zh",
    enabledKeys = [],
    manualTerms = [],
    moneyMode = "on"
  }) {
    try {
      const mc = window.__MATCHER_CORE__;
      if (!mc || typeof mc.matchDocument !== "function") {
        console.warn("matcher-core not ready");
        return null;
      }

      const cleanText = String(text || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n?/g, "\n");

      if (!cleanText.trim()) {
        return {
          ok: true,
          hits: [],
          summary: { total: 0 }
        };
      }

      const result = mc.matchDocument({
        lang,
        text: cleanText,
        enabledKeys,
        manualTerms,
        moneyMode,
        fromPdf: false
      });

      return result;
    } catch (e) {
      console.error("runTextMasking error:", e);
      return null;
    }
  }

  function applyMask(text, hits) {
    if (!text || !Array.isArray(hits)) return text;

    let result = text;
    const sorted = [...hits].sort((a, b) => b.start - a.start);

    for (const h of sorted) {
      const a = h.start;
      const b = h.end;
      if (a >= 0 && b > a && b <= result.length) {
        result = result.slice(0, a) + "███" + result.slice(b);
      }
    }

    return result;
  }

  // 👇 暴露给全局（非常关键）
  window.maskText = function (text, options = {}) {
    const res = runTextMasking({
      text,
      ...options
    });

    if (!res) return null;

    return {
      raw: res,
      maskedText: applyMask(text, res.hits || [])
    };
  };

})();
