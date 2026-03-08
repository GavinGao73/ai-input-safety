// =========================
// assets/matcher-core.js
// PHASE 1 — MINIMAL SAFE MATCH CORE
//
// GOAL
// - Extract matching into a pure core module
// - Reuse current pack/policy structures WITHOUT changing existing engine/export logic
// - NO DOM / NO UI / NO export / NO file handling side effects
//
// IMPORTANT
// - Compatible with current project reality:
//   - pack.rules is an OBJECT MAP, not an array
//   - pack.priority is an ORDER ARRAY
//   - pack.alwaysOn + policy.baseAlwaysOn both matter
//   - pdf.js pagesItems currently contain only:
//       { pageNumber, items:[ { str, transform, width, height } ] }
//   - NO stable text start/end mapping exists yet between pretty text and PDF items
//
// CURRENT PHASE LIMIT
// - text hits: YES
// - masked text: YES
// - byKey summary: YES
// - rect mapping: NOT authoritative yet (returns empty rects for now)
// - this file is for parallel verification first
// =========================

(function () {
  "use strict";

  const NS = "__MATCHER_CORE__";
  const VERSION = "v20260306-phase1-compatible";

  function normLang(l) {
    const s = String(l || "").toLowerCase();
    return s === "zh" || s === "en" || s === "de" ? s : "";
  }

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

  function cloneSimple(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (_) {
      return {};
    }
  }

  function escapeRegExp(s) {
    return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function makeLatinExactRegex(term) {
    const t = safeString(term).trim();
    if (!t) return null;
    try {
      return new RegExp(`\\b${escapeRegExp(t)}\\b`, "giu");
    } catch (_) {
      return null;
    }
  }

  function makeCjkLooseRegex(term) {
    const t = safeString(term).trim();
    if (!t) return null;
    try {
      return new RegExp(`(^|[^\\u4E00-\\u9FFF])(${escapeRegExp(t)})(?=$|[^\\u4E00-\\u9FFF])`, "gu");
    } catch (_) {
      return null;
    }
  }

  function normalizeRegex(re) {
    if (!(re instanceof RegExp)) return null;
    const flags = re.flags.includes("g") ? re.flags : (re.flags + "g");
    try {
      return new RegExp(re.source, flags);
    } catch (_) {
      return null;
    }
  }

  function getPolicy() {
    return window.__ENGINE_POLICY__ || {};
  }

  function getPacks() {
    return window.__ENGINE_LANG_PACKS__ || {};
  }

  function getPack(lang) {
    const L = normLang(lang) || "zh";
    const PACKS = getPacks();
    return PACKS[L] || PACKS.zh || null;
  }

  function getPriority(pack, policy) {
    if (pack && Array.isArray(pack.priority) && pack.priority.length) {
      return pack.priority.slice(0);
    }
    if (policy && Array.isArray(policy.defaultPriority) && policy.defaultPriority.length) {
      return policy.defaultPriority.slice(0);
    }
    return [];
  }

  function getAlwaysOnSet(pack, policy) {
    const s = new Set();

    const base = Array.isArray(policy && policy.baseAlwaysOn) ? policy.baseAlwaysOn : [];
    for (const k of base) s.add(k);

    const extra = pack && pack.alwaysOn;
    if (Array.isArray(extra)) {
      for (const k of extra) s.add(k);
    } else if (extra && typeof extra.forEach === "function") {
      try {
        extra.forEach((k) => s.add(k));
      } catch (_) {}
    }

    return s;
  }

  function getRules(pack) {
    return (pack && pack.rules && typeof pack.rules === "object") ? pack.rules : {};
  }

  function getPlaceholder(pack, tagOrKey) {
    const key = safeString(tagOrKey || "").toUpperCase();
    const table = pack && pack.placeholders ? pack.placeholders : null;
    if (table && table[key]) return table[key];

    const fallback = {
      PHONE: "[Phone]",
      EMAIL: "[Email]",
      URL: "[URL]",
      SECRET: "[Secret]",
      ACCOUNT: "[Account]",
      ADDRESS: "[Address]",
      HANDLE: "[Handle]",
      REF: "[Ref]",
      TITLE: "[Title]",
      NUMBER: "[Number]",
      MONEY: "[Amount]",
      COMPANY: "[Company]",
      TERM: "[REDACTED]",
      NAME: "[Name]"
    };

    return fallback[key] || `[${key || "REDACTED"}]`;
  }

  function getRiskLevel(policy, key) {
    const risk = policy && policy.risk;
    const groups = risk && risk.groups && typeof risk.groups === "object" ? risk.groups : null;
    if (!groups) return "unknown";

    for (const level of Object.keys(groups)) {
      const arr = Array.isArray(groups[level]) ? groups[level] : [];
      if (arr.includes(key)) return level;
    }
    return "unknown";
  }

  function effectiveEnabledSet(enabledKeys, pack, policy) {
    const out = new Set();
    const user = asSet(enabledKeys);
    user.forEach((k) => out.add(k));

    const alwaysOn = getAlwaysOnSet(pack, policy);
    alwaysOn.forEach((k) => out.add(k));

    // keep current product behavior compatibility
    out.add("company");

    return out;
  }

  function normalizeDocument(input) {
  const d = input && typeof input === "object" ? input : {};

  // 兼容三种入口：
  // 1) { text: "..." }
  // 2) { document: {...} } -> 外层已经拆掉的话也没关系
  // 3) { pages: [{ pageNumber, text, items }] }
  const text = safeString(d.text);

  const rawPages = asArray(d.pages);
  const pages = rawPages.map((page, idx) => {
    const pageNumber = Number(page && page.pageNumber) || (idx + 1);

    const pageText = safeString(page && page.text);

    const items = asArray(page && page.items).map((it) => ({
      str: safeString(it && it.str),
      transform: Array.isArray(it && it.transform) ? it.transform.slice(0, 6) : [],
      width: Number(it && it.width) || 0,
      height: Number(it && it.height) || 0,
      hasEOL: !!(it && it.hasEOL)
    }));

    return {
      pageNumber,
      text: pageText,
      items
    };
  });

  // 如果顶层 text 为空，但 pages 里有 text，就拼起来
  let mergedText = text;
  if (!mergedText && pages.length) {
    mergedText = pages
      .map((p) => safeString(p.text))
      .filter(Boolean)
      .join("\n\n");
  }

  return {
    text: mergedText,
    pages,
    meta: cloneSimple(d.meta || {})
  };
}
  function buildManualMatchers(manualTerms) {
    const out = [];
    const seen = new Set();

    for (const raw of asArray(manualTerms)) {
      const term = safeString(raw).trim();
      if (!term) continue;

      const k = term.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);

      if (term.length > 80) continue;

      const hasCjk = /[\u4E00-\u9FFF]/.test(term);
      const re0 = hasCjk ? makeCjkLooseRegex(term) : makeLatinExactRegex(term);
      const re = normalizeRegex(re0);
      if (!re) continue;

      out.push({
        key: "manual_term",
        ruleKey: "manual_term",
        rule: null,
        re,
        mode: "manual",
        tag: "TERM",
        placeholder: null,
        orderIndex: -100000,
        source: "manual",
        manualTerm: term
      });
    }

    return out;
  }

  function buildRuleMatchers(opts) {
    const lang = normLang(opts && opts.lang) || "zh";
    const pack = (opts && opts.pack) || getPack(lang);
    const policy = (opts && opts.policy) || getPolicy();
    const rules = getRules(pack);
    const priority = getPriority(pack, policy);
    const enabled = effectiveEnabledSet(opts && opts.enabledKeys, pack, policy);
    const moneyMode = safeString(opts && opts.moneyMode).toLowerCase() || "m1";
    const manualTerms = asArray(opts && opts.manualTerms);

    const matchers = [];

    // manual terms first
    matchers.push(...buildManualMatchers(manualTerms));

    for (let i = 0; i < priority.length; i += 1) {
      const key = safeString(priority[i]);
      if (!key) continue;

      if (key === "money") {
        if (moneyMode === "off") continue;
      } else {
        if (!enabled.has(key)) continue;
      }

      const rule = rules[key];
      if (!rule || !rule.pattern) continue;

      const re = normalizeRegex(rule.pattern);
      if (!re) continue;

      matchers.push({
        key,
        ruleKey: key,
        rule,
        re,
        mode: safeString(rule.mode || ""),
        tag: safeString(rule.tag || key).toUpperCase(),
        placeholder: getPlaceholder(pack, safeString(rule.tag || key).toUpperCase()),
        orderIndex: i,
        source: "rule",
        manualTerm: ""
      });
    }

    return matchers;
  }

  function execRegexAll(re, text) {
    const hits = [];
    if (!(re instanceof RegExp)) return hits;

    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const full = safeString(m[0]);
      if (!full) {
        if (re.lastIndex === m.index) re.lastIndex += 1;
        continue;
      }

      hits.push({
        index: Number(m.index) || 0,
        full,
        groups: m
      });

      if (re.lastIndex === m.index) re.lastIndex += 1;
    }

    return hits;
  }

  function chooseValueSubrange(matcher, hit) {
    const full = safeString(hit && hit.full);
    const groups = hit && hit.groups ? hit.groups : [];
    const key = matcher && matcher.key ? matcher.key : "";
    const mode = matcher && matcher.mode ? matcher.mode : "";

    if (!full) return { offsetStart: 0, offsetEnd: 0 };

    // manual term:
    if (key === "manual_term") {
      const g2 = groups[2] != null ? String(groups[2]) : "";
      const g1 = groups[1] != null ? String(groups[1]) : "";
      const term = g2 || g1 || full;
      const pos = full.indexOf(term);
      if (pos >= 0) return { offsetStart: pos, offsetEnd: pos + term.length };
      return { offsetStart: 0, offsetEnd: full.length };
    }

    // prefix-like modes: keep label, mask value
    if (mode === "prefix") {
      const label = groups[1] != null ? String(groups[1]) : "";
      const val = groups[2] != null ? String(groups[2]) : "";
      if (label || val) {
        return {
          offsetStart: label.length,
          offsetEnd: label.length + val.length
        };
      }
    }

    if (mode === "prefix_keep_tail") {
      const label = groups[1] != null ? String(groups[1]) : "";
      const toMask = groups[2] != null ? String(groups[2]) : "";
      if (label || toMask) {
        return {
          offsetStart: label.length,
          offsetEnd: label.length + toMask.length
        };
      }
    }

    if (mode === "phone") {
      const label = groups[1] != null ? String(groups[1]) : "";
      const a = groups[2] != null ? String(groups[2]) : "";
      const b = groups[3] != null ? String(groups[3]) : "";
      const c = groups[4] != null ? String(groups[4]) : "";
      const best = a || b || c || full;
      const pos = full.indexOf(best);
      if (pos >= 0) return { offsetStart: pos, offsetEnd: pos + best.length };
      if (label) return { offsetStart: label.length, offsetEnd: full.length };
    }

    if (mode === "company") {
      const named = groups && groups.groups ? groups.groups : null;
      const name = named && named.name ? String(named.name) : "";
      if (name) {
        const pos = full.indexOf(name);
        if (pos >= 0) return { offsetStart: pos, offsetEnd: pos + name.length };
      }
    }

    // default: whole match
    return { offsetStart: 0, offsetEnd: full.length };
  }

  function applyPhoneGuardIfNeeded(pack, policy, matcher, groups, full) {
    if (!(matcher && matcher.key === "phone")) return true;

    const label = groups[1] != null ? String(groups[1]) : "";
    const a = groups[2] != null ? String(groups[2]) : "";
    const b = groups[3] != null ? String(groups[3]) : "";
    const c = groups[4] != null ? String(groups[4]) : "";
    const value = a || b || c || full;

    if (pack && typeof pack.phoneGuard === "function") {
      try {
        return !!pack.phoneGuard({ label, value, match: full });
      } catch (_) {
        return true;
      }
    }

    if (policy && typeof policy.phoneGuardDefault === "function") {
      try {
        return !!policy.phoneGuardDefault({ label, value, match: full });
      } catch (_) {
        return true;
      }
    }

    return true;
  }

function collectRawHits(opts) {
  const lang = normLang(opts && opts.lang) || "zh";
  const pack = (opts && opts.pack) || getPack(lang);
  const policy = (opts && opts.policy) || getPolicy();

  // ✅ 兼容 doc / document / text 三种调用方式
  let docInput = {};
  if (opts && opts.doc && typeof opts.doc === "object") {
    docInput = opts.doc;
  } else if (opts && opts.document && typeof opts.document === "object") {
    docInput = opts.document;
  } else if (opts && typeof opts.text === "string") {
    docInput = { text: opts.text };
  }

  const doc = normalizeDocument(docInput);
  const text = safeString(doc.text);

  const matchers = buildRuleMatchers({
    lang,
    pack,
    policy,
    enabledKeys: opts && opts.enabledKeys,
    moneyMode: opts && opts.moneyMode,
    manualTerms: opts && opts.manualTerms
  });

  const rawHits = [];

  for (const matcher of matchers) {
    const list = execRegexAll(matcher.re, text);

    for (const h of list) {
      const full = safeString(h.full);
      const groups = h.groups || [];

      if (!applyPhoneGuardIfNeeded(pack, policy, matcher, groups, full)) continue;

      const sub = chooseValueSubrange(matcher, h);
      const a = Number(h.index) + Number(sub.offsetStart || 0);
      const b = Number(h.index) + Number(sub.offsetEnd || 0);

      if (!(b > a)) continue;

      const matchedText = text.slice(a, b);
      if (!matchedText) continue;

      rawHits.push({
        id: "",
        key: matcher.key,
        ruleId: matcher.ruleKey,
        source: matcher.source,
        orderIndex: matcher.orderIndex,
        priority: matcher.orderIndex,
        riskLevel: getRiskLevel(policy, matcher.key),
        placeholder: matcher.key === "manual_term" ? getPlaceholder(pack, "TERM") : matcher.placeholder,
        matchedText,
        replacement: matcher.key === "manual_term" ? getPlaceholder(pack, "TERM") : matcher.placeholder,
        start: a,
        end: b,
        page: null,
        rects: [],
        meta: {
          mode: matcher.mode || "",
          tag: matcher.tag || "",
          manualTerm: matcher.manualTerm || "",
          fullMatch: full
        }
      });
    }
  }

  return rawHits;
}
  function rangesOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
  }

  function choosePreferred(a, b) {
    // FIX: email 优先级高于 domain/url，避免 example.com 被重复命中
    if (a.key === "email" && (b.key === "domain" || b.key === "url")) return a;
    if (b.key === "email" && (a.key === "domain" || a.key === "url")) return b;

    // manual term always wins
    if (a.source === "manual" && b.source !== "manual") return a;
    if (b.source === "manual" && a.source !== "manual") return b;

    // lower orderIndex = earlier in priority list = higher precedence
    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex < b.orderIndex ? a : b;
    }

    // shorter span preferred when conflict remains (more precise)
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenA < lenB ? a : b;

    // earlier start wins for stability
    if (a.start !== b.start) return a.start < b.start ? a : b;

    return a;
  }

  function resolveConflicts(rawHits) {
    const ordered = rawHits.slice().sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return a.end - b.end;
      return a.orderIndex - b.orderIndex;
    });

    const kept = [];

    for (const hit of ordered) {
      let blocked = false;

      for (let i = 0; i < kept.length; i += 1) {
        const prev = kept[i];
        if (!rangesOverlap(hit, prev)) continue;

        const winner = choosePreferred(prev, hit);
        if (winner === prev) {
          blocked = true;
          break;
        } else {
          kept[i] = hit;
          blocked = true;
          break;
        }
      }

      if (!blocked) kept.push(hit);
    }

    return kept.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return a.end - b.end;
      return a.orderIndex - b.orderIndex;
    });
  }

  function assignIds(hits) {
    return hits.map((h, i) => ({
      ...h,
      id: `hit_${String(i + 1).padStart(6, "0")}`
    }));
  }

  function mergeRects(rects) {

    if (!Array.isArray(rects) || rects.length <= 1) {
      return rects || [];
    }

    const sorted = rects.slice().sort((a, b) => {
      if (Math.abs(a.y - b.y) > 2) return a.y - b.y;
      return a.x - b.x;
    });

    const merged = [];

    for (const r of sorted) {

      if (!merged.length) {
        merged.push({ ...r });
        continue;
      }

      const last = merged[merged.length - 1];

      const sameLine = Math.abs(last.y - r.y) < 3;
      const close = r.x <= (last.x + last.w + 4);

      if (sameLine && close) {

        const newRight = Math.max(last.x + last.w, r.x + r.w);
        last.w = newRight - last.x;
        last.h = Math.max(last.h, r.h);

      } else {

        merged.push({ ...r });

      }

    }

    return merged;
  }

  // PHASE 1:
  // current pdf.js data does not carry reliable text offsets/rect alignment.
  // keep rect mapping empty for now to avoid fake precision.
  function mapHitsToPdfRects(doc, hits) {

  const d = normalizeDocument(doc);
  const pages = Array.isArray(d.pages) ? d.pages : [];

  if (!pages.length) return hits;

  // -----------------------------
  // Build char stream → item map
  // -----------------------------

  const charMap = [];
  let stream = "";

  for (const page of pages) {

    const items = Array.isArray(page.items) ? page.items : [];

    for (let i = 0; i < items.length; i++) {

      const it = items[i];
      const str = safeString(it.str);

      if (!str) continue;

      for (let c = 0; c < str.length; c++) {

        charMap.push({
          pageNumber: page.pageNumber,
          itemIndex: i,
          charIndex: stream.length
        });

        stream += str[c];
      }

      // preserve spaces between items
      stream += " ";
      charMap.push({
        pageNumber: page.pageNumber,
        itemIndex: i,
        charIndex: stream.length - 1
      });

    }

    stream += "\n";
  }

  // -----------------------------
  // Map hits
  // -----------------------------

  return hits.map((h) => {

    const start = Number(h.start);
    const end = Number(h.end);

    if (!(end > start)) {
      return { ...h, page: null, rects: [] };
    }

    const itemsHit = new Map();

    for (let i = start; i < end && i < charMap.length; i++) {

      const m = charMap[i];
      if (!m) continue;

      const key = m.pageNumber + "_" + m.itemIndex;
      itemsHit.set(key, m);
    }

    if (!itemsHit.size) {
      return { ...h, page: null, rects: [] };
    }

    const rects = [];

    itemsHit.forEach((m) => {

      const page = pages.find(p => p.pageNumber === m.pageNumber);
      if (!page) return;

      const item = page.items[m.itemIndex];
      if (!item) return;

      const tr = Array.isArray(item.transform) ? item.transform : [];

      rects.push({
        x: Number(tr[4]) || 0,
        y: Number(tr[5]) || 0,
        w: Number(item.width) || 0,
        h: Number(item.height) || 0
      });

    });

    const pageNumber = rects.length ? charMap[start]?.pageNumber : null;

    return {
      ...h,
      page: pageNumber,
      rects: mergeRects(rects)
    };

  });

}
  
  function applyHitsToText(text, hits) {
    const src = safeString(text);
    const ordered = hits.slice().sort((a, b) => a.start - b.start);

    let out = "";
    let cursor = 0;

    for (const h of ordered) {
      if (h.start < cursor) continue;
      out += src.slice(cursor, h.start);
      out += safeString(h.replacement);
      cursor = h.end;
    }

    out += src.slice(cursor);
    return out;
  }

  function summarizeHits(hits) {
    const byKey = {};
    for (const h of hits) {
      byKey[h.key] = (byKey[h.key] || 0) + 1;
    }

    return {
      total: hits.length,
      byKey
    };
  }

  function matchDocument(opts) {
  const lang = normLang(opts && opts.lang) || "zh";
  const pack = (opts && opts.pack) || getPack(lang);
  const policy = (opts && opts.policy) || getPolicy();

  // ✅ 兼容三种入口：
  // - matchDocument({ doc: {...} })
  // - matchDocument({ document: {...} })
  // - matchDocument({ text: "..." })
  let docInput = {};
  if (opts && opts.doc && typeof opts.doc === "object") {
    docInput = opts.doc;
  } else if (opts && opts.document && typeof opts.document === "object") {
    docInput = opts.document;
  } else if (opts && typeof opts.text === "string") {
    docInput = { text: opts.text };
  }

  const doc = normalizeDocument(docInput);

  const rawHits = collectRawHits({
    lang,
    pack,
    policy,
    doc,
    enabledKeys: opts && opts.enabledKeys,
    moneyMode: opts && opts.moneyMode,
    manualTerms: opts && opts.manualTerms
  });

  const stableHits = assignIds(resolveConflicts(rawHits));
  const hits = mapHitsToPdfRects(doc, stableHits);
  const textMasked = applyHitsToText(doc.text, hits);
  const summary = summarizeHits(hits);

  return {
    hits,
    byKey: summary.byKey,
    textMasked,
    summary,
    debug: {
      version: VERSION,
      lang,
      rawHitCount: rawHits.length,
      finalHitCount: hits.length,
      hasPdfPages: Array.isArray(doc.pages) && doc.pages.length > 0
    }
  };
}
  
  window[NS] = {
    version: VERSION,
    normLang,
    normalizeDocument,
    buildRuleMatchers,
    collectRawHits,
    matchDocument,
    applyHitsToText
  };
})();
