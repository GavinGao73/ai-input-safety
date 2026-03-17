/* =========================================================
 * assets/raster-core.js
 * Raster geometry / matching core (language-agnostic)
 * 修改记录：
 * - 增加全局垂直偏移常数 GLOBAL_VERTICAL_OFFSET = 3（像素），所有矩形整体下移
 * - 同时调整高度计算，确保高度不变
 * ======================================================= */

(function () {
  "use strict";

  const NS = "__RASTER_CORE__";
  const VERSION = "raster-core-r8-language-pack-20260315";

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function safeString(v) { return typeof v === "string" ? v : (v == null ? "" : String(v)); }

  function normLang(l) {
    const s = String(l || "").toLowerCase();
    return (s === "zh" || s === "en" || s === "de") ? s : "zh";
  }

  function escapeRegExp(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function makeLatinExactRegex(term) {
    const t = String(term || "").trim();
    if (!t) return null;
    try { return new RegExp(`\\b${escapeRegExp(t)}\\b`, "iu"); } catch (_) { return null; }
  }

  function makeCjkLooseRegex(term) {
    const t = String(term || "").trim();
    if (!t) return null;
    try { return new RegExp(`(^|[^\\u4E00-\\u9FFF])(${escapeRegExp(t)})(?=$|[^\\u4E00-\\u9FFF])`, "u"); } catch (_) { return null; }
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function getRasterLangPacks() {
    return window.__RASTER_LANG_PACKS__ || {};
  }

  // 通用默认配置（仅包含基础值，具体由语言包覆盖）
  function getDefaultRasterTuning() {
    return {
      limits: {
        maxMatchLen: {
          manual_term: 80,
          person_name: 30,
          person_name_keep_title: 30,
          account_holder_name_keep_title: 30,
          company: 50,
          email: 70,
          phone: 40,
          account: 70,
          bank: 100,
          address_de_street: 120,
          address_de_postal: 120,
          address_de_street_partial: 120,
          address_de_extra_partial: 120,
          address_de_inline_street: 120,
          address_en_inline_street: 120,
          address_en_extra_block: 120,
          address_en_extra: 120,
          address_cn: 120,
          handle: 70,
          ref: 70,
          title: 70,
          money: 50,
          money_label: 50,
          number: 50
        }
      },
      bbox: {
        default: { maxByPage: 0.24, maxByEst: 1.28, wHardCapEstRatio: 1.90, wSoftCapEstMul: 1.08 },
        longValue: { maxByPage: 0.42, maxByEst: 1.70, wHardCapEstRatio: 2.20, wSoftCapEstMul: 1.22 },
        address: { maxByPage: 0.50, maxByEst: 1.80, wHardCapEstRatio: 2.50, wSoftCapEstMul: 1.35 },
        money: { maxByPage: 0.26, maxByEst: 1.35, wHardCapEstRatio: 1.85, wSoftCapEstMul: 1.08 },
        manual_term: { maxByPage: 0.34, maxByEst: 1.55, wHardCapEstRatio: 2.10, wSoftCapEstMul: 1.20 }
      },
      pad: {
        _default: { pxW: 0.0022, pyH: 0.020, minX: 0.22, minY: 0.34 }
      },
      shrinkLabels: {},
      merge: {
        nearGapLegacy: 1.2,
        nearGapCore: 1.2,
        sameLineOverlapRatio: 0.88,
        similarHeightRatio: 0.80
      },
      itemBox: {
        fontHeightMul: 1.08,
        fontHeightMin: 6,
        fontHeightMax: 96,
        widthEstMul: 0.72,
        shortTokenCap: 1.10,
        hardCap: 1.18
      },
      rectBox: {
        fontHeightMul: 1.10,
        fontHeightMin: 6,
        fontHeightMax: 104,
        widthEstMul: 0.82
      },
      keyGroups: {
        longValueKeys: [],
        addressKeys: [],
        moneyKeys: []
      },
      wholeValueKeys: [],
      skipLabelShrinkKeys: [],
      collapseHitIdKeys: [],
      paragraphSensitiveKeys: [],
      englishInlineValueKeys: [],
      rectPolicy: {
        coverWholeItemRatio: {
          default: 0.72,
          enDefault: 0.90
        },
        padOverrides: {},
        rectBoxSpecial: {}
      }
    };
  }

  function mergeObjects(base, picked) {
    return {
      ...base,
      ...picked,
      limits: {
        ...(base.limits || {}),
        ...(picked.limits || {}),
        maxMatchLen: {
          ...(((base.limits || {}).maxMatchLen) || {}),
          ...((((picked || {}).limits || {}).maxMatchLen) || {})
        }
      },
      bbox: { ...(base.bbox || {}), ...(picked.bbox || {}) },
      pad: { ...(base.pad || {}), ...(picked.pad || {}) },
      shrinkLabels: { ...(base.shrinkLabels || {}), ...(picked.shrinkLabels || {}) },
      merge: { ...(base.merge || {}), ...(picked.merge || {}) },
      itemBox: { ...(base.itemBox || {}), ...(picked.itemBox || {}) },
      rectBox: { ...(base.rectBox || {}), ...(picked.rectBox || {}) },
      keyGroups: { ...(base.keyGroups || {}), ...(picked.keyGroups || {}) },
      wholeValueKeys: picked.wholeValueKeys !== undefined ? picked.wholeValueKeys : base.wholeValueKeys,
      skipLabelShrinkKeys: picked.skipLabelShrinkKeys !== undefined ? picked.skipLabelShrinkKeys : base.skipLabelShrinkKeys,
      collapseHitIdKeys: picked.collapseHitIdKeys !== undefined ? picked.collapseHitIdKeys : base.collapseHitIdKeys,
      paragraphSensitiveKeys: picked.paragraphSensitiveKeys !== undefined ? picked.paragraphSensitiveKeys : base.paragraphSensitiveKeys,
      englishInlineValueKeys: picked.englishInlineValueKeys !== undefined ? picked.englishInlineValueKeys : base.englishInlineValueKeys,
      rectPolicy: {
        ...(base.rectPolicy || {}),
        ...(picked.rectPolicy || {}),
        coverWholeItemRatio: {
          ...(((base.rectPolicy || {}).coverWholeItemRatio) || {}),
          ...((((picked || {}).rectPolicy || {}).coverWholeItemRatio) || {})
        },
        padOverrides: {
          ...(((base.rectPolicy || {}).padOverrides) || {}),
          ...((((picked || {}).rectPolicy || {}).padOverrides) || {})
        },
        rectBoxSpecial: {
          ...(((base.rectPolicy || {}).rectBoxSpecial) || {}),
          ...((((picked || {}).rectPolicy || {}).rectBoxSpecial) || {})
        }
      }
    };
  }

  function getLangTuning(lang) {
    const L = normLang(lang);
    const packs = getRasterLangPacks();
    const pack = packs[L] || packs.zh || {};
    const base = getDefaultRasterTuning();
    return mergeObjects(base, pack);
  }

  function getMergeCfg(tuning) {
    const m = (tuning && tuning.merge) || {};
    return {
      nearGapLegacy: Number(m.nearGapLegacy || 1.2),
      nearGapCore: Number(m.nearGapCore || 1.2),
      sameLineOverlapRatio: Number(m.sameLineOverlapRatio || 0.88),
      similarHeightRatio: Number(m.similarHeightRatio || 0.80)
    };
  }

  function getItemBoxCfg(tuning) {
    const c = (tuning && tuning.itemBox) || {};
    return {
      fontHeightMul: Number(c.fontHeightMul || 1.08),
      fontHeightMin: Number(c.fontHeightMin || 6),
      fontHeightMax: Number(c.fontHeightMax || 96),
      widthEstMul: Number(c.widthEstMul || 0.72),
      shortTokenCap: Number(c.shortTokenCap || 1.10),
      hardCap: Number(c.hardCap || 1.18)
    };
  }

  function getRectBoxCfg(tuning) {
    const c = (tuning && tuning.rectBox) || {};
    return {
      fontHeightMul: Number(c.fontHeightMul || 1.10),
      fontHeightMin: Number(c.fontHeightMin || 6),
      fontHeightMax: Number(c.fontHeightMax || 104),
      widthEstMul: Number(c.widthEstMul || 0.82)
    };
  }

  function getPriorityForLang(lang) {
    const pack = getRasterLangPacks()[normLang(lang)];
    if (pack && Array.isArray(pack.priority) && pack.priority.length) return pack.priority.slice(0);
    const pol = window.__ENGINE_POLICY__ || {};
    if (Array.isArray(pol.defaultPriority) && pol.defaultPriority.length) return pol.defaultPriority.slice(0);
    return [
      "person_name",
      "company",
      "email",
      "bank",
      "account",
      "phone",
      "money",
      "address_de_street",
      "address_de_postal",
      "handle",
      "ref",
      "title",
      "number"
    ];
  }

  function getAlwaysOnSetForLang(lang) {
    const pol = window.__ENGINE_POLICY__ || {};
    const baseArr = Array.isArray(pol.baseAlwaysOn) ? pol.baseAlwaysOn : [];
    const set = new Set(baseArr);
    const pack = getRasterLangPacks()[normLang(lang)];
    const extra = pack && pack.alwaysOn ? pack.alwaysOn : null;

    if (Array.isArray(extra)) {
      for (const k of extra) set.add(k);
    } else if (extra && typeof extra.forEach === "function") {
      try { extra.forEach((k) => set.add(k)); } catch (_) {}
    }

    return set;
  }

  function buildRuleMatchers(lang, enabledKeys, moneyMode, manualTerms) {
    const PRIORITY = getPriorityForLang(lang);
    const ALWAYS_ON = getAlwaysOnSetForLang(lang);
    const pack = getRasterLangPacks()[normLang(lang)];
    const rules = (pack && pack.rules && typeof pack.rules === "object") ? pack.rules : {};
    const matchers = [];
    const enabledSet = new Set(Array.isArray(enabledKeys) ? enabledKeys : []);

    function normalizeToRegExp(pat) {
      if (!pat) return null;
      if (pat instanceof RegExp) return pat;

      if (typeof pat === "string") {
        try { return new RegExp(pat, "u"); } catch (_) {
          try { return new RegExp(pat); } catch (__) { return null; }
        }
      }

      if (typeof pat === "object") {
        const src = typeof pat.source === "string"
          ? pat.source
          : (typeof pat.pattern === "string" ? pat.pattern : null);
        if (!src) return null;
        try { return new RegExp(src, typeof pat.flags === "string" ? pat.flags : ""); } catch (_) { return null; }
      }

      return null;
    }

    function forceGlobal(re) {
      if (!(re instanceof RegExp)) return null;
      try { return new RegExp(re.source, re.flags.includes("g") ? re.flags : (re.flags + "g")); } catch (_) { return null; }
    }

    const terms = Array.isArray(manualTerms) ? manualTerms : [];
    for (const termRaw of terms) {
      const term = String(termRaw || "").trim();
      if (!term || term.length > 80) continue;
      const re = forceGlobal(/[\u4E00-\u9FFF]/.test(term) ? makeCjkLooseRegex(term) : makeLatinExactRegex(term));
      if (re) matchers.push({ key: "manual_term", re, mode: "manual", __term: term });
    }

    for (const k of PRIORITY) {
      if (k === "money") {
        if (!moneyMode || moneyMode === "off") continue;
      } else if (!enabledSet.has(k) && !ALWAYS_ON.has(k)) {
        continue;
      }

      const r = rules[k];
      if (!r) continue;

      const raw = r.pattern != null ? r.pattern : (r.re != null ? r.re : (r.regex != null ? r.regex : null));
      const re = forceGlobal(normalizeToRegExp(raw));
      if (re) matchers.push({ key: k, re, mode: r.mode || "" });
    }

    matchers.sort((a, b) => (a.key === "manual_term" ? -1 : 0) - (b.key === "manual_term" ? -1 : 0));
    return matchers;
  }

  function getItemsArray(textContentOrItems) {
    if (Array.isArray(textContentOrItems)) return textContentOrItems;
    if (textContentOrItems && Array.isArray(textContentOrItems.items)) return textContentOrItems.items;
    return [];
  }

  function normalizePagesItems(pagesItems) {
    return asArray(pagesItems).map((p, idx) => ({
      pageNumber: Number(p && p.pageNumber) || idx + 1,
      items: asArray(p && p.items).map((it) => ({
        str: safeString(it && it.str),
        transform: Array.isArray(it && it.transform) ? it.transform.slice(0, 6) : [1, 0, 0, 1, 0, 0],
        width: Number(it && it.width) || 0,
        height: Number(it && it.height) || 0,
        hasEOL: !!(it && it.hasEOL)
      }))
    }));
  }

  function normalizeMatchResult(matchResult) {
    const mr = matchResult && typeof matchResult === "object" ? matchResult : {};
    return {
      version: safeString(mr.version || "match-result-v1"),
      source: safeString(mr.source || "matcher-core"),
      lang: normLang(mr.lang) || "zh",
      hits: asArray(mr.hits).map((h) => ({
        id: safeString(h && h.id),
        key: safeString(h && h.key),
        page: Number.isFinite(h && h.page) ? Number(h.page) : null,
        start: Number(h && h.start) || 0,
        end: Number(h && h.end) || 0,
        text: safeString(h && h.text),
        masked: safeString(h && h.masked),
        rects: asArray(h && h.rects),
        rule: h && typeof h.rule === "object" ? h.rule : {},
        meta: h && typeof h.meta === "object" ? h.meta : {}
      })),
      summary: mr && typeof mr.summary === "object" ? mr.summary : {}
    };
  }

  function makeRectId(n) {
    return `rect_${String(n).padStart(6, "0")}`;
  }

  function buildPageLocator(pages) {
    const arr = asArray(pages);
    const byPage = new Map();
    let cursor = 0;

    for (let i = 0; i < arr.length; i += 1) {
      const p = arr[i];
      const pageNumber = Number(p && p.pageNumber) || (i + 1);

      let pageText = safeString(p && p.pageText);
      if (!pageText) {
        const built = SpanEngine.buildPageTextAndRangesFromItems(p && p.itemsOrTextContent);
        pageText = safeString(built.pageText);
      }

      const start = cursor;
      const end = start + pageText.length;

      const info = {
        pageNumber,
        start,
        end,
        textLength: pageText.length,
        pageText
      };

      byPage.set(pageNumber, info);
      cursor = end;

      if (i < arr.length - 1) cursor += 2;
    }

    return { byPage };
  }

  function localizeHitToPage(hit, pageInfo) {
    if (!hit || !pageInfo) return null;

    const hs = Number(hit.start);
    const he = Number(hit.end);
    if (!Number.isFinite(hs) || !Number.isFinite(he) || he <= hs) return null;

    const localStart = Math.max(0, hs - pageInfo.start);
    const localEnd = Math.min(pageInfo.textLength, he - pageInfo.start);

    if (!(localEnd > localStart)) return null;

    return {
      id: safeString(hit.id),
      key: safeString(hit.key),
      start: localStart,
      end: localEnd,
      rects: asArray(hit.rects)
    };
  }

  function extractPageHitsFromMatchResult(matchResult, pageNumber, pageLocator) {
    const mr = normalizeMatchResult(matchResult);
    const targetPage = Number(pageNumber);
    const pageInfo = pageLocator && pageLocator.byPage ? pageLocator.byPage.get(targetPage) : null;

    return mr.hits
      .filter((h) => Number(h.page) === targetPage && Number(h.end) > Number(h.start))
      .map((h) => {
        if (pageInfo) return localizeHitToPage(h, pageInfo);
        return {
          id: safeString(h.id),
          key: safeString(h.key),
          start: Number(h.start) || 0,
          end: Number(h.end) || 0,
          rects: asArray(h.rects)
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.start - b.start) || (a.end - b.end));
  }

  const BBoxEngine = {
    keyGroup(key, lang) {
      const tuning = getLangTuning(lang);
      const groups = tuning.keyGroups || {};
      const moneyKeys = new Set(groups.moneyKeys || []);
      const longValueKeys = new Set(groups.longValueKeys || []);
      const addressKeys = new Set(groups.addressKeys || []);

      if (key === "manual_term") return "manual_term";
      if (moneyKeys.has(key)) return "money";
      if (longValueKeys.has(key)) return "longValue";
      if (addressKeys.has(key)) return "address";
      return "default";
    },

    itemBox(pdfjsLib, viewport, it, lang) {
      const tuning = getLangTuning(lang);
      const cfg = getItemBoxCfg(tuning);
      const Util = pdfjsLib.Util;

      const tr = Array.isArray(it.transform) ? it.transform : [1, 0, 0, 1, 0, 0];
      const tx = Util.transform(viewport.transform, tr);

      const x = Number(tx[4] || 0);
      const y = Number(tx[5] || 0);
      const sx = Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) || 1;
      const sy = Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) || sx;

      let fontH = sy;
      if (!Number.isFinite(fontH) || fontH <= 0) {
        fontH =
          Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) ||
          Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) ||
          10;
      }

      fontH = clamp(fontH * cfg.fontHeightMul, cfg.fontHeightMin, cfg.fontHeightMax);

      const s = String(it.str || "");
      const textLen = Math.max(1, s.length);

      let w = 0;
      try {
        const iw = Number(it.width || 0);
        if (Number.isFinite(iw) && iw > 0) w = iw * sx;
      } catch (_) {}

      const est = Math.max(8, textLen * fontH * cfg.widthEstMul);
      if (!Number.isFinite(w) || w <= 0) w = est;

      const hardCap = est * cfg.hardCap;
      if (w > hardCap) w = hardCap;
      if (textLen <= 4) w = Math.min(w, est * cfg.shortTokenCap);

      const rx = clamp(x, 0, viewport.width);
      const ry = clamp(y - fontH, 0, viewport.height);
      const rw = clamp(w, 1, viewport.width - rx);
      const rh = clamp(fontH, cfg.fontHeightMin, viewport.height - ry);

      if (!Number.isFinite(rx + ry + rw + rh) || rw <= 0 || rh <= 0) return null;
      return { x: rx, y: ry, w: rw, h: rh };
    },

    rectBox(pdfjsLib, viewport, it, key, lang) {
      const tuning = getLangTuning(lang);
      const rectCfg = getRectBoxCfg(tuning);
      const bboxCfg = (tuning && tuning.bbox) || {};
      const rectPolicy = (tuning && tuning.rectPolicy) || {};
      const rectBoxSpecial = (rectPolicy && rectPolicy.rectBoxSpecial) || {};
      const Util = pdfjsLib.Util;

      const tr = Array.isArray(it.transform) ? it.transform : [1, 0, 0, 1, 0, 0];
      const tx = Util.transform(viewport.transform, tr);

      const x = Number(tx[4] || 0);
      const y = Number(tx[5] || 0);
      const sx = Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) || 1;
      const sy = Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) || sx;

      let fontH = sy;
      if (!Number.isFinite(fontH) || fontH <= 0) {
        fontH =
          Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) ||
          Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) ||
          10;
      }

      fontH = clamp(fontH * rectCfg.fontHeightMul, rectCfg.fontHeightMin, rectCfg.fontHeightMax);

      const s = String(it.str || "");
      const textLen = Math.max(1, s.length);

      let w = 0;
      try {
        const iw = Number(it.width || 0);
        if (Number.isFinite(iw) && iw > 0) w = iw * sx;
      } catch (_) {}

      const est = Math.max(10, textLen * fontH * rectCfg.widthEstMul);
      if (!Number.isFinite(w) || w <= 0) w = est;

      const group = BBoxEngine.keyGroup(key, lang);
      const cfg = bboxCfg[group] || bboxCfg.default || {
        maxByPage: 0.30,
        maxByEst: 1.45,
        wHardCapEstRatio: 2.2,
        wSoftCapEstMul: 1.15
      };

      const hardRatio = Number(cfg.wHardCapEstRatio || 2.2);
      const softMul = Number(cfg.wSoftCapEstMul || 1.15);
      if (w > est * hardRatio) w = est * softMul;

      const k = String(key || "");

      // 特殊处理（语言包中的 rectBoxSpecial 可覆盖）
      if (rectBoxSpecial.refTailWidthRatio !== undefined && (k === "ref_label_tail" || k === "ref_inline_zh")) {
        const widthRatio = Number(rectBoxSpecial.refTailWidthRatio || 0.535);
        const minEstRatio = Number(rectBoxSpecial.refTailMinEstRatio || 0.425);
        const minPageRatio = Number(rectBoxSpecial.refTailMinPageRatio || 0.108);

        w = clamp(
          w * widthRatio,
          1,
          Math.min(
            viewport.width * Number(cfg.maxByPage || 0.30),
            est * Number(cfg.maxByEst || 1.45) * widthRatio
          )
        );

        w = Math.max(w, Math.min(est * minEstRatio, viewport.width * minPageRatio));
      } else if (rectBoxSpecial.companyInlineZhWidthRatio !== undefined && k === "company_label_inline_zh") {
        const widthRatio = Number(rectBoxSpecial.companyInlineZhWidthRatio || 1.18);
        const maxPage = Number(rectBoxSpecial.companyInlineZhMaxPage || 0.34);
        const maxEst = Number(rectBoxSpecial.companyInlineZhMaxEst || 1.70);
        const minEst = Number(rectBoxSpecial.companyInlineZhMinEst || 0.98);
        const minPage = Number(rectBoxSpecial.companyInlineZhMinPage || 0.22);

        w = clamp(
          w * widthRatio,
          1,
          Math.min(
            viewport.width * maxPage,
            est * maxEst
          )
        );

        w = Math.max(w, Math.min(est * minEst, viewport.width * minPage));
      } else {
        w = clamp(
          w,
          1,
          Math.min(
            viewport.width * Number(cfg.maxByPage || 0.30),
            est * Number(cfg.maxByEst || 1.45)
          )
        );

        const isLong = group === "longValue";
        const minW = isLong ? (est * 0.92) : (est * 0.80);
        w = Math.max(w, Math.min(minW, viewport.width * (isLong ? 0.38 : 0.18)));
      }

      const baseY = clamp(y - fontH + Math.min(4, Math.max(2, fontH * 0.16)), 0, viewport.height);
      const baseH = clamp(fontH - Math.min(4, Math.max(2, fontH * 0.14)), 4, viewport.height - baseY);

      return {
        x: clamp(x, 0, viewport.width),
        y: baseY,
        w: clamp(w + 6, 1, viewport.width - clamp(x, 0, viewport.width)),
        h: baseH
      };
    }
  };

  function buildItemBoxes(pdfjsLib, viewport, textContentOrItems, lang) {
    const items = getItemsArray(textContentOrItems);
    if (!items.length || !pdfjsLib || !pdfjsLib.Util || !viewport) return [];

    const out = [];
    for (const it of items) {
      if (!it) continue;
      const box = BBoxEngine.itemBox(pdfjsLib, viewport, it, lang);
      if (box) out.push(box);
    }
    return out;
  }

  const SpanEngine = {
    buildPageTextAndRangesFromItems(textContentOrItems) {
      const items = getItemsArray(textContentOrItems);
      if (!items.length) return { items: [], pageText: "", itemRanges: [] };

      function needSpaceBetween(line, chunk) {
        if (!line || !chunk) return false;
        const a = line[line.length - 1];
        const b = chunk[0];
        const aIsCjk = /[\u4E00-\u9FFF]/.test(a);
        const bIsCjk = /[\u4E00-\u9FFF]/.test(b);
        if (aIsCjk || bIsCjk) return false;
        if (/^[\s\)\]\}\.,;:\/]/.test(chunk)) return false;
        if (/[\s\-\(\[\{\/]$/.test(line)) return false;
        return /[A-Za-z0-9]/.test(a) && /[A-Za-z0-9]/.test(b);
      }

      const rows = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const s = String((it && it.str) || "").replace(/\s+/g, " ").trim();
        if (!s) continue;
        const tr = Array.isArray(it && it.transform) ? it.transform : [];
        rows.push({ idx: i, s, x: Number(tr[4] || 0), y: Math.round(Number(tr[5] || 0) * 2) / 2 });
      }

      if (!rows.length) return { items, pageText: "", itemRanges: [] };

      rows.sort((a, b) => (b.y - a.y) || (a.x - b.x));

      const lines = [];
      const Y_EPS = 1.2;

      for (const r of rows) {
        const last = lines[lines.length - 1];
        if (!last || Math.abs(last.y - r.y) > Y_EPS) lines.push({ y: r.y, parts: [r] });
        else last.parts.push(r);
      }

      let pageText = "";
      let prevY = null;
      const itemRanges = [];

      for (const ln of lines) {
        ln.parts.sort((a, b) => a.x - b.x);

        if (prevY !== null) {
          const gap = prevY - ln.y;
          pageText += gap > 12 ? "\n\n" : (pageText && !pageText.endsWith("\n") ? "\n" : "");
        }

        let lineText = "";
        for (const part of ln.parts) {
          const chunk = part.s;
          if (!chunk) continue;
          if (lineText && needSpaceBetween(lineText, chunk)) lineText += " ";
          const startInLine = lineText.length;
          lineText += chunk;
          itemRanges.push({
            idx: part.idx,
            start: pageText.length + startInLine,
            end: pageText.length + lineText.length
          });
        }

        pageText += lineText;
        prevY = ln.y;
      }

      return { items, pageText, itemRanges };
    },

    buildPageTextAndRangesAgainstAuthority(textContentOrItems, authoritativePageText) {
      const built = SpanEngine.buildPageTextAndRangesFromItems(textContentOrItems);
      const target = safeString(authoritativePageText)
        .replace(/\u0000/g, "")
        .replace(/\r\n?/g, "\n");

      if (!target.trim()) return built;
      if (built.pageText === target) return built;

      const itemRanges = [];
      let cursor = 0;

      for (const r of built.itemRanges) {
        const chunk = built.pageText.slice(r.start, r.end);
        if (!chunk) continue;

        let foundAt = target.indexOf(chunk, cursor);

        if (foundAt < 0) {
          const probeEnd = Math.min(target.length, cursor + Math.max(120, chunk.length * 16));
          const sub = target.slice(cursor, probeEnd);
          const pos = sub.indexOf(chunk);
          if (pos >= 0) foundAt = cursor + pos;
        }

        if (foundAt < 0) {
          return built;
        }

        itemRanges.push({
          idx: r.idx,
          start: foundAt,
          end: foundAt + chunk.length
        });

        cursor = foundAt + chunk.length;
      }

      return {
        items: built.items,
        pageText: target,
        itemRanges
      };
    },

    normalizeCoreHit(hit) {
      if (!hit || typeof hit !== "object") return null;

      const key =
        typeof hit.key === "string" ? hit.key :
        (typeof hit.ruleKey === "string" ? hit.ruleKey :
        (typeof hit.type === "string" ? hit.type : ""));

      const aRaw =
        Number.isFinite(hit.a) ? hit.a :
        (Number.isFinite(hit.start) ? hit.start :
        (Number.isFinite(hit.from) ? hit.from :
        (Number.isFinite(hit.index) ? hit.index : null)));

      const bRaw =
        Number.isFinite(hit.b) ? hit.b :
        (Number.isFinite(hit.end) ? hit.end :
        (Number.isFinite(hit.to) ? hit.to :
        (Number.isFinite(aRaw) && Number.isFinite(hit.len) ? aRaw + Number(hit.len) : null)));

      if (!key || !Number.isFinite(aRaw) || !Number.isFinite(bRaw) || bRaw <= aRaw) return null;

      return {
        key,
        a: Math.max(0, Number(aRaw)),
        b: Math.max(0, Number(bRaw)),
        preferSub: hit.preferSub || null,
        hitId: safeString(hit.id || "")
      };
    },

    collectCoreHitsForPage({ lang, pageText, pageNumber, enabledKeys, moneyMode, manualTerms }) {
      const mc = (() => {
        try {
          const x = window.__MATCHER_CORE__;
          return x && typeof x.matchDocument === "function" ? x : null;
        } catch (_) {
          return null;
        }
      })();

      if (!mc) return null;

      const rawText = String(pageText || "");
      if (!rawText.trim()) {
        return { ok: true, spans: [], debug: { reason: "empty-page-text" }, summary: { total: 0, byKey: {} } };
      }

      let prettyText = rawText;
      try {
        const pagesText = window.__pdf_pages_text || window.lastPdfPagesText || [];
        const hit = Array.isArray(pagesText)
          ? pagesText.find((p) => Number(p && p.pageNumber) === Number(pageNumber))
          : null;
        if (hit && typeof hit.text === "string" && hit.text.trim()) prettyText = hit.text;
      } catch (_) {}

      prettyText = String(prettyText || "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
      if (!prettyText) {
        return { ok: true, spans: [], debug: { reason: "pretty-text-empty-after-clean" }, summary: { total: 0, byKey: {} } };
      }

      const safeLang = normLang(lang);
      const safeEnabledKeys = Array.isArray(enabledKeys) ? enabledKeys.slice() : [];
      const safeManualTerms = Array.isArray(manualTerms)
        ? manualTerms.map((x) => String(x || "").trim()).filter(Boolean)
        : [];

      let normalized = null;
      try {
        normalized = mc.normalizeDocument
          ? mc.normalizeDocument({ pages: [{ pageNumber: Number(pageNumber) || 1, text: prettyText }], fromPdf: true })
          : null;
      } catch (_) {
        normalized = null;
      }

      const attempts = [];
      if (normalized && ((typeof normalized.text === "string" && normalized.text.trim()) || (Array.isArray(normalized.pages) && normalized.pages.length))) {
        attempts.push({
          label: "normalized-document",
          run: () => mc.matchDocument({
            lang: safeLang,
            document: normalized,
            enabledKeys: safeEnabledKeys,
            manualTerms: safeManualTerms,
            moneyMode,
            fromPdf: true
          })
        });
      }

      attempts.push({
        label: "raw-paged-document",
        run: () => mc.matchDocument({
          lang: safeLang,
          document: { pages: [{ pageNumber: Number(pageNumber) || 1, text: prettyText }], fromPdf: true },
          enabledKeys: safeEnabledKeys,
          manualTerms: safeManualTerms,
          moneyMode,
          fromPdf: true
        })
      });

      attempts.push({
        label: "plain-text",
        run: () => mc.matchDocument({
          lang: safeLang,
          text: prettyText,
          enabledKeys: safeEnabledKeys,
          manualTerms: safeManualTerms,
          moneyMode,
          fromPdf: true
        })
      });

      let res = null;
      let lastErr = null;
      let usedAttempt = "";

      for (const step of attempts) {
        try {
          const out = step.run();
          if (out && typeof out.then === "function") throw new Error("matcher-core-async-not-supported-here");
          if (!out) continue;

          const total =
            Number(out?.summary?.total) ||
            Number(out?.summary?.hitCount) ||
            (Array.isArray(out?.hits) ? out.hits.length : 0) ||
            (Array.isArray(out?.rawHits) ? out.rawHits.length : 0) ||
            (Array.isArray(out?.finalHits) ? out.finalHits.length : 0);

          if (total > 0) {
            res = out;
            usedAttempt = step.label;
            break;
          }

          if (!res) {
            res = out;
            usedAttempt = step.label;
          }
        } catch (e) {
          lastErr = e;
        }
      }

      if (!res) {
        if (lastErr) throw lastErr;
        return null;
      }

      const rawHits =
        Array.isArray(res.hits) ? res.hits :
        (Array.isArray(res.rawHits) ? res.rawHits :
        (Array.isArray(res.finalHits) ? res.finalHits : []));

      const spans = rawHits
        .map(SpanEngine.normalizeCoreHit)
        .filter(Boolean)
        .filter((sp) => sp.key && Number.isFinite(sp.a) && Number.isFinite(sp.b) && sp.b > sp.a && sp.a >= 0 && sp.b <= prettyText.length + 4)
        .sort((x, y) => (x.a - y.a) || (x.b - y.b));

      return {
        ok: true,
        spans,
        debug: Object.assign({}, (res && res.debug) ? res.debug : {}, {
          attempt: usedAttempt,
          pageNumber: Number(pageNumber) || 1,
          pageTextLength: prettyText.length
        }),
        summary: res && res.summary ? res.summary : { total: spans.length, byKey: {} }
      };
    },

    buildLegacySpans(matchers, items, lang) {
      const tuning = getLangTuning(lang);
      const MAX_MATCH_LEN = Object.assign({}, (((tuning && tuning.limits) || {}).maxMatchLen) || {});

      function isWs(ch) { return ch === " " || ch === "\n" || ch === "\t" || ch === "\r"; }
      function shouldInsertSpace(prevChar, nextChar) {
        if (!prevChar || !nextChar || isWs(prevChar) || isWs(nextChar)) return false;
        return /[A-Za-z0-9]/.test(prevChar) && /[A-Za-z0-9]/.test(nextChar);
      }
      function getAllMatchesWithGroups(re, s) {
        const out = [];
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(s)) !== null) {
          const text = String(m[0] || "");
          if (!text) {
            re.lastIndex++;
            continue;
          }
          out.push({ index: m.index, len: text.length, m });
        }
        return out;
      }

      let pageText = "";
      const itemRanges = [];

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const s = String(it.str || "");
        if (!s) continue;

        const prevChar = pageText.length ? pageText[pageText.length - 1] : "";
        const nextChar = s[0];

        if (pageText && shouldInsertSpace(prevChar, nextChar) && !it.hasEOL) pageText += " ";

        const start = pageText.length;
        pageText += s;
        itemRanges.push({ idx: i, start, end: pageText.length });

        if (it && it.hasEOL) pageText += "\n";
      }

      const matchText = pageText.replace(/\n/g, "\u0000");
      const spans = [];

      for (const mm of matchers) {
        const re0 = mm.re;
        if (!(re0 instanceof RegExp)) continue;

        let re;
        try { re = new RegExp(re0.source, re0.flags.includes("g") ? re0.flags : (re0.flags + "g")); } catch (_) { continue; }

        for (const h of getAllMatchesWithGroups(re, matchText)) {
          let a = h.index;
          let b = a + h.len;
          const key = mm.key;
          const maxLen = MAX_MATCH_LEN[key] || 120;
          const m = h.m || [];
          const full = String(m[0] || "");

          if ((b - a) > maxLen || full.indexOf("\u0000") >= 0) continue;

          if (key === "manual_term") {
            const term = (m[2] != null) ? String(m[2]) : ((m[1] != null) ? String(m[1]) : "");
            if (term) {
              const pos = full.indexOf(term);
              if (pos >= 0) {
                a = h.index + pos;
                b = a + term.length;
              }
            }
            if ((b - a) > 0 && (b - a) <= (MAX_MATCH_LEN.manual_term || 90)) {
              spans.push({ a, b, key, preferSub: null });
            }
            continue;
          }

          function findSubOffsets(subStr) {
            if (!subStr) return null;
            const sub = String(subStr);
            const pos = full.indexOf(sub);
            return pos < 0 ? null : { offsetStart: pos, offsetEnd: pos + sub.length };
          }

          let preferSub = null;

          if (key === "company") {
            const coreCN = m[2] && String(m[2]);
            const coreDE = m[5] && String(m[5]);
            const core = (coreCN && coreCN.length >= 2) ? coreCN : coreDE;
            if (core && core.length >= 2) preferSub = findSubOffsets(core);
          } else if (key === "person_name" || key === "person_name_keep_title" || key === "account_holder_name_keep_title") {
            const cand1 = (m[1] != null) ? String(m[1]) : "";
            const cand2 = (m[2] != null) ? String(m[2]) : "";
            const best = (cand1 && cand1.length >= 2) ? cand1 : ((cand2 && cand2.length >= 2) ? cand2 : full);
            preferSub = findSubOffsets(best);
          } else if (key === "account") {
            preferSub = findSubOffsets(m[2]);
          } else if (key === "phone") {
            const candidates = [m[2], m[3], m[4]].filter(Boolean).map(String);
            let best = "";
            for (const c of candidates) if (c.length > best.length) best = c;
            if (best) {
              const pos = full.indexOf(best);
              if (pos >= 0) {
                let end = pos + best.length;
                const tailHit = full.slice(end).match(/^\s*(?:\(|（)(?:WhatsApp|WeChat|Telegram|Signal)(?:\)|）)/i);
                if (tailHit && tailHit[0]) end += tailHit[0].length;
                preferSub = { offsetStart: pos, offsetEnd: end };
              }
            }
          } else if (key === "money" || key === "money_label") {
            preferSub = findSubOffsets(m[2] || m[4] || m[5]);
          }

          spans.push({ a, b, key, preferSub });
        }
      }

      if (!spans.length) return { pageText, itemRanges, spans: [] };

      spans.sort((x, y) => (x.a - y.a) || (x.b - y.b));

      const merged = [];
      function samePreferSub(p, q) {
        if (!p && !q) return true;
        if (!p || !q) return false;
        return p.offsetStart === q.offsetStart && p.offsetEnd === q.offsetEnd;
      }

      for (const sp of spans) {
        const last = merged[merged.length - 1];
        if (!last) {
          merged.push({ ...sp });
          continue;
        }

        const close = sp.key === last.key && sp.a <= last.b;
        if (close) {
          last.b = Math.max(last.b, sp.b);
          last.preferSub = last.preferSub && sp.preferSub
            ? (samePreferSub(last.preferSub, sp.preferSub) ? last.preferSub : null)
            : (last.preferSub || sp.preferSub || null);
        } else {
          merged.push({ ...sp });
        }
      }

      return { pageText, itemRanges, spans: merged };
    }
  };

  const RectEngine = {
    weakTrim(ch) {
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return true;
      return ":：,，;；()（）[]【】<>《》\"'“”‘’".includes(ch);
    },

    makeLabelPrefixRe(words) {
      if (!Array.isArray(words) || !words.length) return null;
      const parts = words.map((w) => String(w || "").trim()).filter(Boolean).map(escapeRegExp);
      if (!parts.length) return null;
      try { return new RegExp(`^(?:${parts.join("|")})\\s*[:：]?\\s*`, "i"); } catch (_) { return null; }
    },

    shrinkByLabel(key, s, ls, le, tuning) {
      if (key === "manual_term" || le <= ls) return { ls, le };

      const sub = s.slice(ls, le);
      const labels = (tuning && tuning.shrinkLabels) || {};
      const re = RectEngine.makeLabelPrefixRe(labels[key]); // 直接使用 labels[key]
      const mm = re ? sub.match(re) : null;
      if (mm && mm[0]) ls += mm[0].length;

      while (ls < le && RectEngine.weakTrim(s[ls])) ls++;
      while (le > ls && RectEngine.weakTrim(s[le - 1])) le--;

      return { ls, le };
    },

    padForKey(key, tuning) {
      const pad = (tuning && tuning.pad) || {};
      const policy = (tuning && tuning.rectPolicy) || {};
      const overrides = (policy && policy.padOverrides) || {};
      const k = String(key || "");

      return overrides[k] || pad[k] || pad._default || { pxW: 0.005, pyH: 0.045, minX: 0.55, minY: 0.75 };
    },

    shouldSkipLabelShrink(key, tuning) {
      const list = tuning.skipLabelShrinkKeys || [];
      return list.includes(String(key || ""));
    },

    isWholeValueRectKey(key, tuning) {
      const list = tuning.wholeValueKeys || [];
      return list.includes(String(key || ""));
    },

    filterAndMergeSpans(spans, tuning) {
      const MAX_MATCH_LEN = Object.assign({}, (((tuning && tuning.limits) || {}).maxMatchLen) || {});
      const merged = [];

      for (const sp of spans || []) {
        if (!sp || !sp.key) continue;
        if ((sp.b - sp.a) > (MAX_MATCH_LEN[sp.key] || 120)) continue;

        const last = merged[merged.length - 1];
        if (last && last.key === sp.key && sp.a <= last.b) {
          last.b = Math.max(last.b, sp.b);
        } else {
          merged.push({
            a: sp.a,
            b: sp.b,
            key: sp.key,
            preferSub: sp.preferSub || null,
            hitId: sp.hitId || ""
          });
        }
      }

      return merged;
    },

    shouldCollapseHitId(key, tuning) {
      const list = tuning.collapseHitIdKeys || [];
      return list.includes(String(key || ""));
    },

    collapseRectsByHitId(rects, lang) {
      if (!Array.isArray(rects) || !rects.length) return rects || [];
      const tuning = getLangTuning(lang);

      const keep = [];
      const groups = new Map();

      for (const r of rects) {
        const key = String((r && r.key) || "");
        const hitId = String((r && r.hitId) || "");

        if (!hitId || !RectEngine.shouldCollapseHitId(key, tuning)) {
          keep.push(r);
          continue;
        }

        const gid = key + "::" + hitId;
        if (!groups.has(gid)) {
          groups.set(gid, {
            x1: Number(r.x),
            y1: Number(r.y),
            x2: Number(r.x) + Number(r.w),
            y2: Number(r.y) + Number(r.h),
            key,
            hitId
          });
        } else {
          const g = groups.get(gid);
          g.x1 = Math.min(g.x1, Number(r.x));
          g.y1 = Math.min(g.y1, Number(r.y));
          g.x2 = Math.max(g.x2, Number(r.x) + Number(r.w));
          g.y2 = Math.max(g.y2, Number(r.y) + Number(r.h));
        }
      }

      const collapsed = Array.from(groups.values()).map((g) => ({
        x: g.x1,
        y: g.y1,
        w: Math.max(1, g.x2 - g.x1),
        h: Math.max(1, g.y2 - g.y1),
        key: g.key,
        hitId: g.hitId
      }));

      const all = keep.concat(collapsed);
      all.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      return all;
    },

      buildRects(pdfjsLib, viewport, items, itemRanges, spans, lang, nearGap) {
  const tuning = getLangTuning(lang);
  const rects = [];

  // ========== 从语言包读取全局垂直偏移（像素） ==========
  const globalVerticalOffset = tuning.globalVerticalOffset !== undefined ? tuning.globalVerticalOffset : 3; // 默认 3

  for (const sp of RectEngine.filterAndMergeSpans(spans, tuning)) {
    const A = sp.a;
    const B = sp.b;
    const key = sp.key;
    const preferSub = sp.preferSub;
    const hitId = safeString(sp.hitId || "");

    for (const r of itemRanges) {
      const a0 = Math.max(A, r.start);
      const b0 = Math.min(B, r.end);
      if (b0 <= a0) continue;

      const it = items[r.idx];
      const s = String(it.str || "");
      if (!s) continue;

      let ls = a0 - r.start;
      let le = b0 - r.start;

      const isEnglish = normLang(lang) === "en";
      const englishInlineValueSet = new Set(tuning.englishInlineValueKeys || []);
      const isEnglishInlineValue =
        isEnglish && englishInlineValueSet.has(String(key || ""));

      const wholeValueMode =
        RectEngine.isWholeValueRectKey(key, tuning) && !isEnglishInlineValue;

      if (wholeValueMode) {
        ls = 0;
        le = s.length;
      } else if (preferSub) {
        const subA = A + Number(preferSub.offsetStart || 0);
        const subB = A + Number(preferSub.offsetEnd || 0);
        const a1 = Math.max(subA, r.start);
        const b1 = Math.min(subB, r.end);
        if (b1 > a1) {
          ls = a1 - r.start;
          le = b1 - r.start;
        } else {
          continue;
        }
      } else {
        const skipLabelShrink =
          RectEngine.shouldSkipLabelShrink(key, tuning) && !isEnglishInlineValue;

        if (!skipLabelShrink) {
          const shr = RectEngine.shrinkByLabel(key, s, ls, le, tuning);
          ls = shr.ls;
          le = shr.le;
          if (le <= ls) continue;
        }
      }

      const bb = BBoxEngine.rectBox(pdfjsLib, viewport, it, key, lang);
      const len = Math.max(1, s.length);

      ls = clamp(ls, 0, len);
      le = clamp(le, 0, len);
      if (le <= ls) continue;

      const coveredLen = le - ls;
      const wholeByKey = wholeValueMode;
      const coverRatioCfg = (((tuning || {}).rectPolicy || {}).coverWholeItemRatio) || {};
      const coverDefault = Number(coverRatioCfg.default || 0.72);
      const coverEnglishDefault = Number(coverRatioCfg.enDefault || 0.90);

      const coverWholeItem =
        wholeByKey ||
        len <= 2 ||
        coveredLen >= len * (isEnglish ? coverEnglishDefault : coverDefault);

      const x1 = coverWholeItem ? bb.x : (bb.x + bb.w * (ls / len));
      const x2 = coverWholeItem ? (bb.x + bb.w) : (bb.x + bb.w * (le / len));

      const pcfg = RectEngine.padForKey(key, tuning);
      const padX = Math.max(Number(pcfg.minX || 0), bb.w * Number(pcfg.pxW || 0));
      const padY = Math.max(Number(pcfg.minY || 0), bb.h * Number(pcfg.pyH || 0));

      // 视觉微调：下移量固定为 2，高度削减从语言包读取
      const visualDownShift = 2;
      const visualHeightTrim = tuning.globalHeightTrim !== undefined ? tuning.globalHeightTrim : 2;

      // ====== 调试日志 ======
      console.log(`[${key}] bb.h=${bb.h.toFixed(2)}, padY=${padY.toFixed(2)}, visualHeightTrim=${visualHeightTrim}`);
      const rhRaw = bb.h + padY * 2 - visualHeightTrim;
      console.log(`rhRaw=${rhRaw.toFixed(2)}`);

      const nameLeftShift =
        (key === "person_name" ||
         key === "person_name_keep_title" ||
         key === "account_holder_name_keep_title")
        ? Math.min(4.0, Math.max(2.0, bb.w * 0.04))
        : 0;

      // 应用全局垂直偏移（从语言包读取）
      const rx = clamp(x1 - padX - nameLeftShift, 0, viewport.width);
      const ry = clamp(bb.y - padY + visualDownShift + globalVerticalOffset, 0, viewport.height);
      const rw = clamp(
        (x2 - x1) + padX * 2 + nameLeftShift,
        1,
        viewport.width - clamp(x1 - padX - nameLeftShift, 0, viewport.width)
      );
      const rh = clamp(
        bb.h + padY * 2 - visualHeightTrim,
        3,
        viewport.height - clamp(bb.y - padY + visualDownShift + globalVerticalOffset, 0, viewport.height)
      );

      // 可选的 key 特殊限制（可迁移到语言包）
      if (key === "person_name" || key === "person_name_keep_title" || key === "account_holder_name_keep_title") {
        if (rw > Math.min(viewport.width * 0.16, bb.w * 0.90)) continue;
      }
      if (key === "company") {
        if (rw > Math.min(viewport.width * 0.40, bb.w * 1.50)) continue;
      }
      if (key === "manual_term") {
        if (rw > Math.min(viewport.width * 0.45, bb.w * 1.60)) continue;
      }
      if (rw > viewport.width * 0.92 || rh > viewport.height * 0.35 || (rw > viewport.width * 0.85 && rh > viewport.height * 0.20)) continue;

      rects.push({ x: rx, y: ry, w: rw, h: rh, key, hitId });
    }
  }

  if (!rects.length) return [];

  rects.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  const out = [];
  const paragraphSensitiveSet = new Set(tuning.paragraphSensitiveKeys || []);

  function canMergeRects(a, b) {
    if (!a || !b) return false;
    if (a.key !== b.key) return false;

    const aHit = String(a.hitId || "");
    const bHit = String(b.hitId || "");

    if (aHit && bHit && aHit !== bHit) return false;

    const overlap = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const minH = Math.max(1, Math.min(a.h, b.h));
    const sameLine = (overlap / minH) > 0.80;
    const similarHeight = (Math.min(a.h, b.h) / Math.max(a.h, b.h)) > 0.72;
    const gap = b.x - (a.x + a.w);

    const k = String(a.key || "");
    const isParagraphSensitive = paragraphSensitiveSet.has(k);

    const near = isParagraphSensitive
      ? (gap <= Math.max(1.5, Math.min(a.h, b.h) * 0.12) && gap >= -1)
      : (gap <= Math.max(nearGap, Math.min(a.h, b.h) * 0.45) && gap >= -3);

    return sameLine && similarHeight && near;
  }

  function mergeTwoRects(a, b) {
    const nx = Math.min(a.x, b.x);
    const ny = Math.min(a.y, b.y);
    const nr = Math.max(a.x + a.w, b.x + b.w);
    const nb = Math.max(a.y + a.h, b.y + b.h);

    return {
      x: nx,
      y: ny,
      w: nr - nx,
      h: nb - ny,
      key: a.key,
      hitId: a.hitId || b.hitId || ""
    };
  }

  for (const r of rects) {
    if (!Number.isFinite(r.x + r.y + r.w + r.h)) continue;

    const candidate = {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      key: r.key,
      hitId: r.hitId
    };

    if (!out.length) {
      out.push(candidate);
      continue;
    }

    const last = out[out.length - 1];
    if (canMergeRects(last, candidate)) {
      out[out.length - 1] = mergeTwoRects(last, candidate);
    } else {
      out.push(candidate);
    }
  }

  let changed = true;
  while (changed && out.length > 1) {
    changed = false;
    const pass = [];

    for (const r of out) {
      const last = pass[pass.length - 1];
      if (last && canMergeRects(last, r)) {
        pass[pass.length - 1] = mergeTwoRects(last, r);
        changed = true;
      } else {
        pass.push(r);
      }
    }

    out.length = 0;
    out.push(...pass);
  }

  return RectEngine.collapseRectsByHitId(
    out.map(({ x, y, w, h, key, hitId }) => ({ x, y, w, h, key, hitId })),
    lang
  );
}

      function mergeTwoRects(a, b) {
        const nx = Math.min(a.x, b.x);
        const ny = Math.min(a.y, b.y);
        const nr = Math.max(a.x + a.w, b.x + b.w);
        const nb = Math.max(a.y + a.h, b.y + b.h);

        return {
          x: nx,
          y: ny,
          w: nr - nx,
          h: nb - ny,
          key: a.key,
          hitId: a.hitId || b.hitId || ""
        };
      }

      for (const r of rects) {
        if (!Number.isFinite(r.x + r.y + r.w + r.h)) continue;

        const candidate = {
          x: r.x,
          y: r.y,
          w: r.w,
          h: r.h,
          key: r.key,
          hitId: r.hitId
        };

        if (!out.length) {
          out.push(candidate);
          continue;
        }

        const last = out[out.length - 1];
        if (canMergeRects(last, candidate)) {
          out[out.length - 1] = mergeTwoRects(last, candidate);
        } else {
          out.push(candidate);
        }
      }

      let changed = true;
      while (changed && out.length > 1) {
        changed = false;
        const pass = [];

        for (const r of out) {
          const last = pass[pass.length - 1];
          if (last && canMergeRects(last, r)) {
            pass[pass.length - 1] = mergeTwoRects(last, r);
            changed = true;
          } else {
            pass.push(r);
          }
        }

        out.length = 0;
        out.push(...pass);
      }

      return RectEngine.collapseRectsByHitId(
        out.map(({ x, y, w, h, key, hitId }) => ({ x, y, w, h, key, hitId })),
        lang
      );
    }
  };

  function normalizeCoreHit(hit) { return SpanEngine.normalizeCoreHit(hit); }
  function buildPageTextAndRangesFromItems(textContentOrItems) { return SpanEngine.buildPageTextAndRangesFromItems(textContentOrItems); }
  function collectCoreHitsForPage(args) { return SpanEngine.collectCoreHitsForPage(args); }

  function textItemsToRectsFromSpans(pdfjsLib, viewport, textContentOrItems, spans, lang, authoritativePageText) {
    const built = authoritativePageText
      ? SpanEngine.buildPageTextAndRangesAgainstAuthority(textContentOrItems, authoritativePageText)
      : SpanEngine.buildPageTextAndRangesFromItems(textContentOrItems);

    if (!built.items.length || !Array.isArray(spans) || !spans.length) return [];

    return RectEngine.buildRects(
      pdfjsLib,
      viewport,
      built.items,
      built.itemRanges,
      spans,
      lang,
      getMergeCfg(getLangTuning(lang)).nearGapCore
    );
  }

  function buildSpansFromMatchResultForPage(matchResult, pageNumber, pageLocator) {
    const pageHits = extractPageHitsFromMatchResult(matchResult, pageNumber, pageLocator);

    return pageHits.map((h) => ({
      a: Number(h.start),
      b: Number(h.end),
      key: h.key,
      preferSub: null,
      hitId: h.id
    }));
  }

  function mapMatchResultPageToRects({ pdfjsLib, viewport, itemsOrTextContent, matchResult, pageNumber, lang, pageLocator }) {
    const pageHits = extractPageHitsFromMatchResult(matchResult, pageNumber, pageLocator);

    const spans = pageHits.map((h) => ({
      a: Number(h.start),
      b: Number(h.end),
      key: h.key,
      preferSub: null,
      hitId: h.id
    }));

    const pageInfo = pageLocator && pageLocator.byPage
      ? pageLocator.byPage.get(Number(pageNumber))
      : null;

    const authoritativePageText = safeString(pageInfo && pageInfo.pageText);

    let rects = textItemsToRectsFromSpans(
      pdfjsLib,
      viewport,
      itemsOrTextContent,
      spans,
      lang,
      authoritativePageText
    );

    const mappedHitIds = new Set(
      asArray(rects).map((r) => safeString(r && r.hitId)).filter(Boolean)
    );

    for (const h of pageHits) {
      const hitId = safeString(h.id);
      if (!hitId || mappedHitIds.has(hitId)) continue;

      const fallbackRects = asArray(h.rects)
        .map((r) => ({
          x: Number(r && r.x) || 0,
          y: Number(r && r.y) || 0,
          w: Number(r && r.w) || 0,
          h: Number(r && r.h) || 0,
          key: safeString(h.key),
          hitId
        }))
        .filter((r) => Number.isFinite(r.x + r.y + r.w + r.h) && r.w > 0 && r.h > 0);

      if (fallbackRects.length) {
        rects = rects.concat(fallbackRects);
        mappedHitIds.add(hitId);
      }
    }

    return { rects, spans };
  }

  function buildRasterRectResult({ pageEntries, matchResult, lang }) {
    const mr = normalizeMatchResult(matchResult);
    const pages = [];
    let rectSeq = 1;
    let totalRects = 0;

    const rectHitIdSet = new Set();
    const allHitIdSet = new Set(
      asArray(mr.hits).map((h) => safeString(h && h.id)).filter(Boolean)
    );

    for (const entry of asArray(pageEntries)) {
      const pageIndex = Number(entry && entry.pageIndex) || 0;
      const width = Number(entry && entry.width) || 0;
      const height = Number(entry && entry.height) || 0;
      const rectsIn = asArray(entry && entry.rects);

      const rects = rectsIn.map((r) => {
        const hitId = safeString(r && r.hitId);
        if (hitId) rectHitIdSet.add(hitId);
        totalRects += 1;

        return {
          id: makeRectId(rectSeq++),
          hitId,
          key: safeString(r && r.key),
          x: Number(r && r.x) || 0,
          y: Number(r && r.y) || 0,
          w: Number(r && r.w) || 0,
          h: Number(r && r.h) || 0,
          source: "matcher-core",
          confidence: 1,
          meta: {
            itemCount: 1,
            matchStrategy: "text-items-overlap"
          }
        };
      });

      const pageHits = mr.hits.filter((h) => Number(h.page) === pageIndex + 1);
      const pageHitIds = new Set(pageHits.map((h) => safeString(h && h.id)).filter(Boolean));
      const pageMappedHitIds = Array.from(pageHitIds).filter((id) => rectHitIdSet.has(id));

      pages.push({
        pageIndex,
        width,
        height,
        stats: {
          coreHitCount: pageHits.length,
          mappedHitCount: pageMappedHitIds.length,
          rectCount: rects.length
        },
        rects
      });
    }

    const mappedHitIds = Array.from(allHitIdSet).filter((id) => rectHitIdSet.has(id));
    const unmappedHitIds = Array.from(allHitIdSet).filter((id) => !rectHitIdSet.has(id));

    return {
      version: "raster-rect-result-v1",
      source: "matcher-core",
      lang: normLang(lang || mr.lang),
      pageCount: pages.length,
      summary: {
        coreHitCount: mr.hits.length,
        mappedHitCount: mappedHitIds.length,
        rectCount: totalRects,
        unmappedHitCount: unmappedHitIds.length
      },
      audit: {
        mappedHitIds,
        unmappedHitIds
      },
      pages
    };
  }

  function mapMatchResultToRects({ pdfjsLib, pages, matchResult, lang }) {
    const mr = normalizeMatchResult(matchResult);
    const pageArr = asArray(pages);
    const pageLocator = buildPageLocator(pageArr);
    const pageEntries = [];

    for (let i = 0; i < pageArr.length; i += 1) {
      const p = pageArr[i];
      const pageNumber = Number(p && p.pageNumber) || (i + 1);
      const viewport = p && p.viewport;
      const itemsOrTextContent = p && p.itemsOrTextContent;

      if (!viewport || !itemsOrTextContent) {
        pageEntries.push({
          pageIndex: i,
          width: Number(p && p.width) || 0,
          height: Number(p && p.height) || 0,
          rects: []
        });
        continue;
      }

      const one = mapMatchResultPageToRects({
        pdfjsLib,
        viewport,
        itemsOrTextContent,
        matchResult: mr,
        pageNumber,
        lang: normLang(lang || mr.lang),
        pageLocator
      });

      pageEntries.push({
        pageIndex: i,
        width: Number(p && p.width) || 0,
        height: Number(p && p.height) || 0,
        rects: asArray(one.rects)
      });
    }

    const result = buildRasterRectResult({
      pageEntries,
      matchResult: mr,
      lang: normLang(lang || mr.lang)
    });

    try {
      window.__RasterCoreLast = Object.assign({}, result, {
        debug: {
          pageLocator: Array.from(pageLocator.byPage.values())
        }
      });
    } catch (_) {}

    return result;
  }

  function tryMatcherCoreRectsForPage({ pdfjsLib, viewport, itemsOrTextContent, pageNumber, lang, enabledKeys, moneyMode, manualTerms }) {
    const built = SpanEngine.buildPageTextAndRangesFromItems(itemsOrTextContent);
    const pageText = String(built.pageText || "");

    if (!pageText.trim()) {
      return {
        ok: true,
        rects: [],
        spans: [],
        source: "matcher-core",
        hitCount: 0,
        debug: { reason: "empty-page-text" },
        summary: { total: 0, byKey: {} }
      };
    }

    const coreRes = SpanEngine.collectCoreHitsForPage({
      lang,
      pageText,
      pageNumber,
      enabledKeys,
      moneyMode,
      manualTerms
    });

    if (!coreRes || !coreRes.ok) return null;

    return {
      ok: true,
      rects: textItemsToRectsFromSpans(
        pdfjsLib,
        viewport,
        itemsOrTextContent,
        coreRes.spans || [],
        lang,
        pageText
      ),
      spans: Array.isArray(coreRes.spans) ? coreRes.spans : [],
      source: "matcher-core",
      hitCount: Array.isArray(coreRes.spans) ? coreRes.spans.length : 0,
      debug: coreRes.debug || null,
      summary: coreRes.summary || null
    };
  }

  function textItemsToRects(pdfjsLib, viewport, textContentOrItems, matchers, lang) {
    const items = getItemsArray(textContentOrItems);
    if (!items.length || !matchers || !matchers.length) return [];

    const legacy = SpanEngine.buildLegacySpans(matchers, items, lang);
    return RectEngine.buildRects(
      pdfjsLib,
      viewport,
      items,
      legacy.itemRanges,
      legacy.spans,
      lang,
      getMergeCfg(getLangTuning(lang)).nearGapLegacy
    );
  }

  window[NS] = {
    version: VERSION,
    clamp,
    normLang,
    getLangTuning,
    buildRuleMatchers,
    getItemsArray,
    buildItemBoxes,
    buildPageTextAndRangesFromItems,
    normalizeCoreHit,
    collectCoreHitsForPage,
    normalizePagesItems,
    buildSpansFromMatchResultForPage,
    mapMatchResultPageToRects,
    mapMatchResultToRects,
    buildRasterRectResult,
    textItemsToRectsFromSpans,
    tryMatcherCoreRectsForPage,
    textItemsToRects
  };
})();
