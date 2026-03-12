// =========================
// assets/matcher-core.js
// v20260308-matchresult-v2-slim-page-only
//
// PURE MATCH CORE
// - text hits
// - masked text
// - byKey summary
// - page assignment
// - NO authoritative rect geometry
//
// BOUNDARY
// - matcher-core: hit generation / conflict resolution / text masking / page mapping
// - raster-core: hit -> rect mapping
// - raster-export: render/export pipeline
// =========================

(function () {
  "use strict";

  const NS = "__MATCHER_CORE__";
  const VERSION = "v20260309-matchresult-v3-stable-conflict";

  function normLang(l) {
    const s = String(l || "").toLowerCase();
    return s === "zh" || s === "en" || s === "de" ? s : "";
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function asSet(v) {
    return v instanceof Set ? v : new Set(asArray(v));
  }

  function safeString(v) {
    return typeof v === "string" ? v : (v == null ? "" : String(v));
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
    return pack && pack.rules && typeof pack.rules === "object" ? pack.rules : {};
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

  function inferCategoryFromKey(key) {
    const k = safeString(key);

    if (
      [
        "phone",
        "email",
        "url",
        "address_cn",
        "address_de_street",
        "address_de_street_partial",
        "address_de_inline_street",
        "address_de_extra_partial",
        "address_en_inline_street",
        "address_en_extra_block",
        "address_en_extra",
        "handle",
        "handle_label",
        "person_name",
        "person_name_keep_title"
      ].includes(k)
    ) return "contact";

    if (
      [
        "dob",
        "place_of_birth",
        "passport",
        "driver_license",
        "ssn",
        "ein",
        "national_id",
        "tax_id",
        "insurance_id",
        "insurance_id2",
        "intl_itin",
        "intl_nino",
        "intl_nhs",
        "intl_sin",
        "intl_tfn",
        "intl_abn",
        "secret",
        "api_key_token",
        "bearer_token",
        "security_answer",
        "otp",
        "pin",
        "2fa"
      ].includes(k)
    ) return "identity";

    if (
      [
        "account",
        "bank",
        "bank_routing_ids",
        "card_expiry",
        "card_expiry_de",
        "card_security",
        "card_security_de",
        "money",
        "money_label",
        "ref",
        "ref_label_tail",
        "ref_generic_tail",
        "legal_ref_tail",
        "company"
      ].includes(k)
    ) return "business";

    if (
      [
        "ip_label",
        "ip_address",
        "mac_label",
        "mac_address",
        "imei",
        "imei2",
        "uuid",
        "uuid2",
        "device_fingerprint",
        "wallet_id",
        "tx_hash",
        "crypto_wallet"
      ].includes(k)
    ) return "tracking";

    if (k === "manual_term") return "manual";

    return "other";
  }

    function isWholeValueHitKey(key) {
    return [
      "ref_label_tail",
      "ref_generic_tail",
      "legal_ref_tail",

      "ref_inline_zh",

      "account",
      "account_cn_inline",
      "bank",
      "bank_routing_ids",

      "wallet_id",
      "tx_hash",
      "crypto_wallet",

      "uuid",
      "uuid2",
      "imei",
      "imei2",
      "mac_address",
      "ip_address",

      "phone",
      "email",

      "dob",
      "place_of_birth",
      "passport",
      "passport_inline_zh",
      "driver_license",
      "license_plate",
      "license_plate_inline_zh",
      "id_card",
      "id_card_inline_zh",
      "tax_id_zh",

      "secret",
      "secret_inline_zh",
      "security_answer",
      "api_key_token",
      "api_key_token_zh",
      "device_fingerprint",

      "money",
      "money_label",
      "money_cn_inline_label",
      "money_label_currency_zh"
    ].includes(safeString(key));
  }

  function standardizeHit(hit, lang, pack) {
    const h = hit && typeof hit === "object" ? hit : {};
    const key = safeString(h.key);
    const category = inferCategoryFromKey(key);
    const masked = safeString(h.replacement || "");
    const matchedText = safeString(h.matchedText || "");

    return {
      id: safeString(h.id),
      key,
      type: category === "business" ? "business" : "pii",
      category,
      page: Number.isFinite(h.page) ? h.page : null,
      start: Number(h.start) || 0,
      end: Number(h.end) || 0,
      text: matchedText,
      masked,
      confidence: 1,
      rule: {
        lang: normLang(lang) || "unknown",
        pack: pack && pack.lang ? `engine.${pack.lang}` : "engine.unknown",
        ruleId: safeString(h.ruleId || key)
      },
      meta: {
        label: "",
        matchMode: safeString(h && h.meta && h.meta.mode),
        source: safeString(h.source || ""),
        tag: safeString(h && h.meta && h.meta.tag),
        manualTerm: safeString(h && h.meta && h.meta.manualTerm),
        fullMatch: safeString(h && h.meta && h.meta.fullMatch)
      },
      rects: []
    };
  }

  function effectiveEnabledSet(enabledKeys, pack, policy) {
    const out = new Set();
    const user = asSet(enabledKeys);
    user.forEach((k) => out.add(k));

    const alwaysOn = getAlwaysOnSet(pack, policy);
    alwaysOn.forEach((k) => out.add(k));

    out.add("company");
    return out;
  }

  function normalizeDocument(input) {
    const d = input && typeof input === "object" ? input : {};
    const text = safeString(d.text);

    const rawPages = asArray(d.pages);
    const pages = rawPages.map((page, idx) => {
      const pageNumber = Number(page && page.pageNumber) || idx + 1;
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

    let mergedText = text;
    if (!mergedText && pages.length) {
      mergedText = pages.map((p) => safeString(p.text)).filter(Boolean).join("\n\n");
    }

    return {
      text: mergedText,
      pages,
      meta: d && typeof d.meta === "object" ? d.meta : {}
    };
  }

  function buildManualMatchers(manualTerms) {
    const out = [];
    const seen = new Set();

    for (const raw of asArray(manualTerms)) {
      const term = safeString(raw).trim();
      if (!term || term.length > 80) continue;

      const k = term.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);

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
    matchers.push(...buildManualMatchers(manualTerms));

    for (let i = 0; i < priority.length; i += 1) {
      const key = safeString(priority[i]);
      if (!key) continue;

      if (key === "money") {
        if (moneyMode === "off") continue;
      } else if (!enabled.has(key)) {
        continue;
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

    if (key === "manual_term") {
      const g2 = groups[2] != null ? String(groups[2]) : "";
      const g1 = groups[1] != null ? String(groups[1]) : "";
      const term = g2 || g1 || full;
      const pos = full.indexOf(term);
      if (pos >= 0) return { offsetStart: pos, offsetEnd: pos + term.length };
      return { offsetStart: 0, offsetEnd: full.length };
    }

    if (mode === "prefix") {
      const label = groups[1] != null ? String(groups[1]) : "";
      const val = groups[2] != null ? String(groups[2]) : "";

      if (label || val) {
        if (isWholeValueHitKey(key)) {
          return { offsetStart: label.length, offsetEnd: full.length };
        }
        return { offsetStart: label.length, offsetEnd: label.length + val.length };
      }
    }

    if (mode === "prefix_keep_tail") {
      const label = groups[1] != null ? String(groups[1]) : "";
      const toMask = groups[2] != null ? String(groups[2]) : "";

      if (label || toMask) {
        if (isWholeValueHitKey(key)) {
          return { offsetStart: label.length, offsetEnd: full.length };
        }
        return { offsetStart: label.length, offsetEnd: label.length + toMask.length };
      }
    }

    if (mode === "phone") {
      const label = groups[1] != null ? String(groups[1]) : "";
      const a = groups[2] != null ? String(groups[2]) : "";
      const b = groups[3] != null ? String(groups[3]) : "";
      const c = groups[4] != null ? String(groups[4]) : "";
      const best = a || b || c || full;

      if (isWholeValueHitKey(key) && label) {
        return { offsetStart: label.length, offsetEnd: full.length };
      }

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

    if (isWholeValueHitKey(key)) {
      return { offsetStart: 0, offsetEnd: full.length };
    }

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

    let docInput = {};
    if (opts && opts.doc && typeof opts.doc === "object") docInput = opts.doc;
    else if (opts && opts.document && typeof opts.document === "object") docInput = opts.document;
    else if (opts && Array.isArray(opts.pages)) docInput = { pages: opts.pages };
    else if (opts && typeof opts.text === "string") docInput = { text: opts.text };

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
    if (a.key === "email" && (b.key === "domain" || b.key === "url")) return a;
    if (b.key === "email" && (a.key === "domain" || a.key === "url")) return b;

    if (a.source === "manual" && b.source !== "manual") return a;
    if (b.source === "manual" && a.source !== "manual") return b;

    if (a.orderIndex !== b.orderIndex) {
      return a.orderIndex < b.orderIndex ? a : b;
    }

    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenA < lenB ? a : b;
    if (a.start !== b.start) return a.start < b.start ? a : b;
    return a;
  }

  function hitPreferenceCompare(a, b) {
    const winner = choosePreferred(a, b);
    if (winner === a && winner !== b) return -1;
    if (winner === b && winner !== a) return 1;

    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return a.end - b.end;
    return 0;
  }

  function resolveConflicts(rawHits) {
    const preferred = rawHits.slice().sort(hitPreferenceCompare);
    const kept = [];

    for (const hit of preferred) {
      let overlaps = false;

      for (let i = 0; i < kept.length; i += 1) {
        if (rangesOverlap(hit, kept[i])) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) kept.push(hit);
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

  function buildPageTextFromItems(items) {
    return asArray(items)
      .map((it) => safeString(it && it.str))
      .filter(Boolean)
      .join(" ");
  }

  function assignPagesFromDoc(doc, hits) {
  const d = normalizeDocument(doc);
  const pages = Array.isArray(d.pages) ? d.pages : [];
  const fullText = safeString(d.text);

  if (!pages.length) {
    return hits.map((h) => ({ ...h, page: null, rects: [] }));
  }

  function getPageText(p) {
    let pageText = safeString(p && p.text);
    if (!pageText) pageText = buildPageTextFromItems(p && p.items);
    return pageText;
  }

  function buildSegmentsFromFullText() {
    const segments = [];
    let searchFrom = 0;

    for (let i = 0; i < pages.length; i += 1) {
      const p = pages[i];
      const pageNumber = Number(p && p.pageNumber) || i + 1;
      const pageText = getPageText(p);

      if (!pageText) {
        segments.push({
          pageNumber,
          start: searchFrom,
          end: searchFrom,
          textLength: 0
        });
        continue;
      }

      const foundAt = fullText.indexOf(pageText, searchFrom);

      if (foundAt >= 0) {
        const start = foundAt;
        const end = start + pageText.length;

        segments.push({
          pageNumber,
          start,
          end,
          textLength: pageText.length
        });

        searchFrom = end;
      } else {
        return null;
      }
    }

    return segments;
  }

  function buildSegmentsBySequentialFallback() {
    const segments = [];
    let cursor = 0;

    for (let i = 0; i < pages.length; i += 1) {
      const p = pages[i];
      const pageNumber = Number(p && p.pageNumber) || i + 1;
      const pageText = getPageText(p);

      const start = cursor;
      const end = start + pageText.length;

      segments.push({
        pageNumber,
        start,
        end,
        textLength: pageText.length
      });

      cursor = end;
      if (i < pages.length - 1) cursor += 2;
    }

    return segments;
  }

  const segments =
    fullText && fullText.length
      ? (buildSegmentsFromFullText() || buildSegmentsBySequentialFallback())
      : buildSegmentsBySequentialFallback();

  return hits.map((h) => {
    const hs = Number(h.start) || 0;
    const he = Number(h.end) || 0;

    let page = null;

    for (const seg of segments) {
      if (hs < seg.end && he > seg.start) {
        page = seg.pageNumber;
        break;
      }

      if (hs === he && seg.textLength === 0 && hs === seg.start) {
        page = seg.pageNumber;
        break;
      }
    }

    if (page == null && segments.length) {
      for (const seg of segments) {
        if (hs >= seg.start && hs <= seg.end) {
          page = seg.pageNumber;
          break;
        }
      }
    }

    return {
      ...h,
      page,
      rects: []
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

  function summarizeHits(hits, textMasked) {
    const byKey = {};
    const categoryCounts = {};

    for (const h of hits) {
      const key = safeString(h.key);
      const cat = safeString(h.category || inferCategoryFromKey(key));

      if (key) byKey[key] = (byKey[key] || 0) + 1;
      if (cat) categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    return {
      hitCount: hits.length,
      categoryCounts,
      maskedLength: safeString(textMasked).length,
      total: hits.length,
      byKey
    };
  }

  function matchDocument(opts) {
    const lang = normLang(opts && opts.lang) || "zh";
    const pack = (opts && opts.pack) || getPack(lang);
    const policy = (opts && opts.policy) || getPolicy();

    let docInput = {};
    if (opts && opts.doc && typeof opts.doc === "object") docInput = opts.doc;
    else if (opts && opts.document && typeof opts.document === "object") docInput = opts.document;
    else if (opts && Array.isArray(opts.pages)) docInput = { pages: opts.pages };
    else if (opts && typeof opts.text === "string") docInput = { text: opts.text };

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
    const pagedHits = assignPagesFromDoc(doc, stableHits);
    const protocolHits = pagedHits.map((h) => standardizeHit(h, lang, pack));
    const textMasked = applyHitsToText(doc.text, pagedHits);
    const summary = summarizeHits(protocolHits, textMasked);

    return {
      version: "match-result-v1",
      source: "matcher-core",
      lang: normLang(lang) || "unknown",
      input: {
        textKind: doc.pages && doc.pages.length ? "page-text" : "plain",
        textLength: safeString(doc.text).length
      },
      summary,
      hits: protocolHits,
      textMasked,
      byKey: summary.byKey,
      debug: {
        version: VERSION,
        lang,
        rawHitCount: rawHits.length,
        finalHitCount: protocolHits.length,
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
    match: matchDocument,
    applyHitsToText
  };
})();
