// =========================
// assets/matcher-core.js
// MINIMAL SAFE EXTRACTION (Phase 1)
// - Pure matching core only
// - No DOM / UI / export side effects
// - Does NOT replace or remove existing engine/export logic
// - Can run in parallel with current system for verification
// =========================

console.log("[matcher-core.js] loaded v20260306-phase1-minimal");

(function initMatcherCore(global) {
  "use strict";

  const NS = "__MATCHER_CORE__";

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function asSet(v) {
    if (v instanceof Set) return v;
    return new Set(asArray(v));
  }

  function safeString(v) {
    return typeof v === "string" ? v : (v == null ? "" : String(v));
  }

  function cloneRect(rect) {
    if (!rect || typeof rect !== "object") return null;
    return {
      x: Number(rect.x || 0),
      y: Number(rect.y || 0),
      w: Number(rect.w || rect.width || 0),
      h: Number(rect.h || rect.height || 0)
    };
  }

  function normalizeDocument(doc) {
    const text = safeString(doc && doc.text);
    const rawPages = asArray(doc && doc.pages);

    const pages = rawPages.map((page, pageIndex) => {
      const items = asArray(page && page.items).map((item, itemIndex) => ({
        str: safeString(item && item.str),
        start: Number.isFinite(item && item.start) ? Number(item.start) : -1,
        end: Number.isFinite(item && item.end) ? Number(item.end) : -1,
        rect: cloneRect(item && item.rect),
        pageIndex,
        itemIndex
      }));

      return {
        pageIndex,
        items
      };
    });

    return {
      text,
      pages,
      meta: Object.assign({}, doc && doc.meta)
    };
  }

  function getPlaceholderForKey(pack, key) {
    const placeholders = (pack && pack.placeholders) || {};
    return safeString(placeholders[key] || `[${key}]`);
  }

  function getRiskLevel(policy, key) {
    const groups = (policy && policy.riskGroups) || {};
    for (const level of Object.keys(groups)) {
      if (asArray(groups[level]).includes(key)) return level;
    }
    return "unknown";
  }

  function getPriority(pack, policy, key, rule) {
    if (rule && Number.isFinite(rule.priority)) return Number(rule.priority);

    const packPriority = pack && pack.priority && pack.priority[key];
    if (Number.isFinite(packPriority)) return Number(packPriority);

    const defaultPriority = policy && policy.defaultPriority && policy.defaultPriority[key];
    if (Number.isFinite(defaultPriority)) return Number(defaultPriority);

    return 0;
  }

  function isRuleEnabled(enabledKeys, key, rule, policy) {
    const baseAlwaysOn = asArray(policy && policy.baseAlwaysOn);
    if (baseAlwaysOn.includes(key)) return true;
    if (rule && rule.alwaysOn === true) return true;
    return enabledKeys.has(key);
  }

  function normalizeRegex(regex) {
    if (regex instanceof RegExp) {
      const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
      return new RegExp(regex.source, flags);
    }
    return null;
  }

  function buildMatchers(opts) {
    const pack = opts && opts.pack;
    const policy = opts && opts.policy;
    const enabledKeys = asSet(opts && opts.enabledKeys);
    const manualTerms = asArray(opts && opts.manualTerms);

    const rules = asArray(pack && pack.rules);
    const matchers = [];

    for (const rule of rules) {
      if (!rule || !rule.key) continue;
      if (!isRuleEnabled(enabledKeys, rule.key, rule, policy)) continue;

      const regex = normalizeRegex(rule.regex);
      if (!regex) continue;

      matchers.push({
        type: "rule",
        key: safeString(rule.key),
        ruleId: safeString(rule.id || `${rule.key}.main`),
        priority: getPriority(pack, policy, rule.key, rule),
        placeholder: safeString(rule.placeholder || getPlaceholderForKey(pack, rule.key)),
        regex,
        guard: typeof rule.guard === "function" ? rule.guard : null
      });
    }

    for (let i = 0; i < manualTerms.length; i += 1) {
      const item = manualTerms[i];
      const term = typeof item === "string" ? item : safeString(item && item.term);
      if (!term) continue;

      const key = safeString((item && item.key) || "manual");
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      matchers.push({
        type: "manual",
        key,
        ruleId: safeString((item && item.id) || `manual.${i + 1}`),
        priority: 100000,
        placeholder: safeString((item && item.placeholder) || getPlaceholderForKey(pack, key) || "[Manual]"),
        regex: new RegExp(escaped, "g"),
        guard: null
      });
    }

    return matchers;
  }

  function makeHitId(index) {
    return `hit_${String(index).padStart(6, "0")}`;
  }

  function ruleAllowsMatch(matcher, ctx) {
    if (!matcher.guard) return true;
    try {
      return matcher.guard(ctx) !== false;
    } catch (err) {
      console.warn("[matcher-core] guard failed:", matcher.ruleId, err);
      return false;
    }
  }

  function collectRawHits(text, matchers, pack, policy) {
    const rawHits = [];

    for (const matcher of matchers) {
      matcher.regex.lastIndex = 0;
      let m;

      while ((m = matcher.regex.exec(text))) {
        const matchedText = safeString(m[0]);
        const start = Number(m.index);
        const end = start + matchedText.length;

        if (!matchedText || end <= start) {
          if (matcher.regex.lastIndex === m.index) matcher.regex.lastIndex += 1;
          continue;
        }

        const ctx = { text, match: m, matchedText, start, end, matcher, pack, policy };
        if (!ruleAllowsMatch(matcher, ctx)) {
          if (matcher.regex.lastIndex === m.index) matcher.regex.lastIndex += 1;
          continue;
        }

        rawHits.push({
          key: matcher.key,
          ruleId: matcher.ruleId,
          source: matcher.type,
          priority: matcher.priority,
          riskLevel: getRiskLevel(policy, matcher.key),
          placeholder: matcher.placeholder,
          matchedText,
          replacement: matcher.placeholder,
          start,
          end,
          page: null,
          rects: [],
          meta: {}
        });

        if (matcher.regex.lastIndex === m.index) matcher.regex.lastIndex += 1;
      }
    }

    return rawHits;
  }

  function rangesOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
  }

  function choosePreferredHit(a, b) {
    if (a.source === "manual" && b.source !== "manual") return a;
    if (b.source === "manual" && a.source !== "manual") return b;

    if (a.priority !== b.priority) return a.priority > b.priority ? a : b;

    const aLen = a.end - a.start;
    const bLen = b.end - b.start;
    if (aLen !== bLen) return aLen > bLen ? a : b;

    if (a.start !== b.start) return a.start < b.start ? a : b;
    return a;
  }

  function resolveHitConflicts(rawHits) {
    const ordered = rawHits.slice().sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return a.end - b.end;
      return b.priority - a.priority;
    });

    const kept = [];

    for (const hit of ordered) {
      let rejected = false;

      for (let i = 0; i < kept.length; i += 1) {
        const existing = kept[i];
        if (!rangesOverlap(hit, existing)) continue;

        const preferred = choosePreferredHit(existing, hit);
        if (preferred === existing) {
          rejected = true;
          break;
        }

        kept[i] = hit;
        rejected = true;
        break;
      }

      if (!rejected) kept.push(hit);
    }

    return kept.sort((a, b) => {
      if ((a.page ?? Infinity) !== (b.page ?? Infinity)) return (a.page ?? Infinity) - (b.page ?? Infinity);
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return a.end - b.end;
      return b.priority - a.priority;
    });
  }

  function mapHitsToRects(doc, hits) {
    if (!doc.pages.length || !hits.length) return hits;

    const items = [];
    for (const page of doc.pages) {
      for (const item of page.items) {
        if (!item || item.start < 0 || item.end < 0) continue;
        items.push(item);
      }
    }

    if (!items.length) return hits;

    for (const hit of hits) {
      const rects = [];
      const pages = new Set();

      for (const item of items) {
        if (item.end <= hit.start) continue;
        if (item.start >= hit.end) break;
        if (item.start < hit.end && item.end > hit.start) {
          if (item.rect) rects.push(item.rect);
          pages.add(item.pageIndex);
        }
      }

      hit.rects = rects;
      if (pages.size === 1) hit.page = [...pages][0];
      else if (pages.size > 1) hit.page = Math.min(...pages);
    }

    return hits;
  }

  function applyHitsToText(text, hits) {
    const ordered = hits.slice().sort((a, b) => a.start - b.start);
    let out = "";
    let cursor = 0;

    for (const hit of ordered) {
      if (hit.start < cursor) continue;
      out += text.slice(cursor, hit.start);
      out += safeString(hit.replacement);
      cursor = hit.end;
    }

    out += text.slice(cursor);
    return out;
  }

  function summarizeHits(hits) {
    const byKey = {};
    for (const hit of hits) {
      byKey[hit.key] = (byKey[hit.key] || 0) + 1;
    }

    return {
      total: hits.length,
      byKey
    };
  }

  function matchDocument(opts) {
    const doc = normalizeDocument((opts && opts.doc) || {});
    const pack = (opts && opts.pack) || {};
    const policy = (opts && opts.policy) || {};
    const matchers = buildMatchers(opts);

    const rawHits = collectRawHits(doc.text, matchers, pack, policy);
    const stableHits = resolveHitConflicts(rawHits).map((hit, index) => ({
      id: makeHitId(index + 1),
      ...hit
    }));

    mapHitsToRects(doc, stableHits);

    const textMasked = applyHitsToText(doc.text, stableHits);
    const summary = summarizeHits(stableHits);

    return {
      hits: stableHits,
      byKey: summary.byKey,
      textMasked,
      summary,
      debug: {
        matcherCount: matchers.length,
        rawHitCount: rawHits.length,
        finalHitCount: stableHits.length
      }
    };
  }

  global[NS] = {
    version: "20260306-phase1-minimal",
    normalizeDocument,
    buildMatchers,
    matchDocument,
    applyHitsToText
  };
})(typeof window !== "undefined" ? window : globalThis);
