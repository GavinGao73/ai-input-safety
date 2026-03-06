  // ======================================================
  // Phase 2-A: matcher-core first, regex fallback
  // - readable PDF export prefers unified matcher core
  // - if core missing / throws / bad payload -> fallback to legacy regex path
  // ======================================================

  function getMatcherCore() {
    try {
      const mc = window.__MATCHER_CORE__;
      if (
        mc &&
        typeof mc === "object" &&
        typeof mc.matchDocument === "function"
      ) {
        return mc;
      }
    } catch (_) {}
    return null;
  }

  function buildPageTextAndRangesFromItems(textContentOrItems) {
    const items =
      Array.isArray(textContentOrItems) ? textContentOrItems :
      (textContentOrItems && Array.isArray(textContentOrItems.items)) ? textContentOrItems.items :
      [];

    function isWs(ch) {
      return ch === " " || ch === "\n" || ch === "\t" || ch === "\r";
    }

    function shouldInsertSpace(prevChar, nextChar) {
      if (!prevChar || !nextChar) return false;
      if (isWs(prevChar) || isWs(nextChar)) return false;
      const a = /[A-Za-z0-9]/.test(prevChar);
      const b = /[A-Za-z0-9]/.test(nextChar);
      return a && b;
    }

    let pageText = "";
    const itemRanges = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const s = String((it && it.str) || "");
      if (!s) continue;

      const prevChar = pageText.length ? pageText[pageText.length - 1] : "";
      const nextChar = s[0];

      if (pageText && shouldInsertSpace(prevChar, nextChar) && !it.hasEOL) {
        pageText += " ";
      }

      const start = pageText.length;
      pageText += s;
      const end = pageText.length;

      itemRanges.push({ idx: i, start, end });

      if (it && it.hasEOL) pageText += "\n";
    }

    return { items, pageText, itemRanges };
  }

  function normalizeCoreHit(hit) {
    if (!hit || typeof hit !== "object") return null;

    const key =
      typeof hit.key === "string" ? hit.key :
      typeof hit.ruleKey === "string" ? hit.ruleKey :
      typeof hit.type === "string" ? hit.type :
      "";

    const aRaw =
      Number.isFinite(hit.a) ? hit.a :
      Number.isFinite(hit.start) ? hit.start :
      Number.isFinite(hit.from) ? hit.from :
      Number.isFinite(hit.index) ? hit.index :
      null;

    const bRaw =
      Number.isFinite(hit.b) ? hit.b :
      Number.isFinite(hit.end) ? hit.end :
      Number.isFinite(hit.to) ? hit.to :
      (
        Number.isFinite(aRaw) && Number.isFinite(hit.len)
          ? aRaw + Number(hit.len)
          : null
      );

    if (!key) return null;
    if (!Number.isFinite(aRaw) || !Number.isFinite(bRaw)) return null;
    if (bRaw <= aRaw) return null;

    return {
      key,
      a: Math.max(0, Number(aRaw)),
      b: Math.max(0, Number(bRaw)),
      preferSub: hit.preferSub || null
    };
  }

  function collectCoreHitsForPage({ lang, pageText, enabledKeys, moneyMode, manualTerms }) {
    const mc = getMatcherCore();
    if (!mc) return null;

    const attempts = [
      () => mc.matchDocument({
        lang,
        text: pageText,
        enabledKeys,
        moneyMode,
        manualTerms,
        fromPdf: true
      }),
      () => mc.matchDocument({
        lang,
        doc: pageText,
        enabledKeys,
        moneyMode,
        manualTerms,
        fromPdf: true
      }),
      () => mc.matchDocument({
        lang,
        document: pageText,
        enabledKeys,
        moneyMode,
        manualTerms,
        fromPdf: true
      })
    ];

    let res = null;
    let lastErr = null;

    for (const run of attempts) {
      try {
        res = run();
        if (res && typeof res.then === "function") {
          // current matcher-core is sync, but keep this explicit:
          throw new Error("matcher-core-async-not-supported-here");
        }
        if (res) break;
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
      Array.isArray(res.rawHits) ? res.rawHits :
      Array.isArray(res.finalHits) ? res.finalHits :
      [];

    const spans = rawHits
      .map(normalizeCoreHit)
      .filter(Boolean)
      .sort((x, y) => (x.a - y.a) || (x.b - y.b));

    return {
      ok: true,
      spans,
      debug: res && res.debug ? res.debug : null,
      summary: res && res.summary ? res.summary : null
    };
  }

  function textItemsToRectsFromSpans(pdfjsLib, viewport, textContentOrItems, spans, lang) {
    const Util = pdfjsLib.Util;
    const tuning = getLangTuning(lang);

    const { items, itemRanges } = buildPageTextAndRangesFromItems(textContentOrItems);
    if (!items.length || !Array.isArray(spans) || !spans.length) return [];

    const MAX_MATCH_LEN = Object.assign({}, (tuning && tuning.maxMatchLen) || {});

    function keyGroupForBBox(key) {
      const isLongValueKey =
        key === "account" || key === "phone" || key === "email" || key === "bank";

      const isAddressKey =
        key === "address_de_street" || key === "address_de_postal" ||
        key === "address_de_street_partial" || key === "address_de_extra_partial" || key === "address_de_inline_street" ||
        key === "address_en_inline_street" || key === "address_en_extra_block" || key === "address_en_extra" ||
        key === "address_cn";

      if (key === "money" || key === "money_label") return "money";
      if (key === "manual_term") return "manual_term";
      if (isLongValueKey) return "longValue";
      if (isAddressKey) return "address";
      return "default";
    }

    function bboxForItem(it, key) {
      const tx = Util.transform(viewport.transform, it.transform || [1, 0, 0, 1, 0, 0]);

      const x = Number(tx[4] || 0);
      const y = Number(tx[5] || 0);

      const sx = Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) || 1;
      const sy = Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) || sx;

      let fontH = sy * 1.0;
      if (!Number.isFinite(fontH) || fontH <= 0) {
        fontH =
          Math.hypot(Number(tx[2] || 0), Number(tx[3] || 0)) ||
          Math.hypot(Number(tx[0] || 0), Number(tx[1] || 0)) ||
          10;
      }
      fontH = clamp(fontH * 1.12, 6, 110);

      const s = String(it.str || "");

      let w = 0;
      try {
        const iw = Number(it.width || 0);
        if (Number.isFinite(iw) && iw > 0) w = iw * sx;
      } catch (_) {}

      if (!Number.isFinite(w) || w <= 0) w = Math.max(8, s.length * fontH * 0.88);

      const est = Math.max(10, s.length * fontH * 0.90);

      const group = keyGroupForBBox(key);
      const bboxCfg = (tuning && tuning.bbox) || {};
      const cfg = bboxCfg[group] || bboxCfg.default || {
        maxByPage: 0.30,
        maxByEst: 1.45,
        wHardCapEstRatio: 2.2,
        wSoftCapEstMul: 1.15
      };

      const hardRatio = Number(cfg.wHardCapEstRatio || 2.2);
      const softMul = Number(cfg.wSoftCapEstMul || 1.15);
      if (w > est * hardRatio) w = est * softMul;

      const maxByPage = viewport.width * Number(cfg.maxByPage || 0.30);
      const maxByEst = est * Number(cfg.maxByEst || 1.45);
      w = clamp(w, 1, Math.min(maxByPage, maxByEst));

      const isLongValueKey = group === "longValue";
      const minW = isLongValueKey ? (est * 0.95) : (est * 0.85);
      w = Math.max(w, Math.min(minW, viewport.width * (isLongValueKey ? 0.40 : 0.20)));

      let rx = clamp(x, 0, viewport.width);
      let ry = clamp(y - fontH, 0, viewport.height);
      let rw = clamp(w, 1, viewport.width - rx);
      let rh = clamp(fontH, 6, viewport.height - ry);

      return { x: rx, y: ry, w: rw, h: rh };
    }

    function shrinkByLabel(key, s, ls, le) {
      if (key === "manual_term") return { ls, le };
      if (le <= ls) return { ls, le };

      const sub = s.slice(ls, le);
      const labels = (tuning && tuning.shrinkLabels) || {};

      function makeLabelPrefixRe(words) {
        if (!Array.isArray(words) || !words.length) return null;
        const parts = words
          .map((w) => String(w || "").trim())
          .filter(Boolean)
          .map(escapeRegExp);
        if (!parts.length) return null;
        try {
          return new RegExp(`^(?:${parts.join("|")})\\s*[:：]?\\s*`, "i");
        } catch (_) {
          return null;
        }
      }

      const weakTrim = (ch) => {
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") return true;
        return ":：,，;；()（）[]【】<>《》\"'“”‘’".includes(ch);
      };

      if (key === "phone") {
        const re = makeLabelPrefixRe(labels.phone);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "account") {
        const re = makeLabelPrefixRe(labels.account);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "email") {
        const re = makeLabelPrefixRe(labels.email);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (
        key === "address_de_street" || key === "address_de_postal" ||
        key === "address_de_street_partial" || key === "address_de_extra_partial" || key === "address_de_inline_street" ||
        key === "address_en_inline_street" || key === "address_en_extra_block" || key === "address_en_extra" ||
        key === "address_cn"
      ) {
        const re = makeLabelPrefixRe(labels.address);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;

      } else if (key === "bank") {
        const re = makeLabelPrefixRe(labels.bank);
        const mm = re ? sub.match(re) : null;
        if (mm && mm[0]) ls += mm[0].length;
      }

      while (ls < le && weakTrim(s[ls])) ls++;
      while (le > ls && weakTrim(s[le - 1])) le--;

      return { ls, le };
    }

    function getPadForKey(key) {
      const pad = (tuning && tuning.pad) || {};
      return pad[key] || pad._default || { pxW: 0.005, pyH: 0.045, minX: 0.55, minY: 0.75 };
    }

    const merged = [];
    for (const sp of spans) {
      if (!sp || !sp.key) continue;
      const maxLen = MAX_MATCH_LEN[sp.key] || 120;
      if ((sp.b - sp.a) > maxLen) continue;

      const last = merged[merged.length - 1];
      if (last && last.key === sp.key && sp.a <= last.b) {
        last.b = Math.max(last.b, sp.b);
      } else {
        merged.push({ a: sp.a, b: sp.b, key: sp.key, preferSub: sp.preferSub || null });
      }
    }

    const rects = [];

    for (const sp of merged) {
      const A = sp.a;
      const B = sp.b;
      const key = sp.key;
      const preferSub = sp.preferSub;

      for (const r of itemRanges) {
        const a0 = Math.max(A, r.start);
        const b0 = Math.min(B, r.end);
        if (b0 <= a0) continue;

        const it = items[r.idx];
        const s = String(it.str || "");
        if (!s) continue;

        let ls = a0 - r.start;
        let le = b0 - r.start;

        if (preferSub) {
          const fullLen = Math.max(0, B - A);
          if (fullLen > 0) {
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
          }
        } else {
          const shr = shrinkByLabel(key, s, ls, le);
          ls = shr.ls;
          le = shr.le;
          if (le <= ls) continue;
        }

        if (le - ls <= 0) continue;

        const bb = bboxForItem(it, key);
        const len = Math.max(1, s.length);

        const x1 = bb.x + bb.w * (ls / len);
        const x2 = bb.x + bb.w * (le / len);

        const pcfg = getPadForKey(key);
        const padX = Math.max(Number(pcfg.minX || 0), bb.w * Number(pcfg.pxW || 0));
        const padY = Math.max(Number(pcfg.minY || 0), bb.h * Number(pcfg.pyH || 0));

        let rx = x1 - padX;
        let ry = bb.y - padY;
        let rw = (x2 - x1) + padX * 2;
        let rh = bb.h + padY * 2;

        rx = clamp(rx, 0, viewport.width);
        ry = clamp(ry, 0, viewport.height);
        rw = clamp(rw, 1, viewport.width - rx);
        rh = clamp(rh, 6, viewport.height - ry);

        if (key === "person_name" || key === "person_name_keep_title" || key === "account_holder_name_keep_title") {
          const maxW = Math.min(viewport.width * 0.22, bb.w * 0.55);
          if (rw > maxW) continue;
        }

        if (key === "company") {
          const maxW = Math.min(viewport.width * 0.18, bb.w * 0.45);
          if (rw > maxW) continue;
        }

        if (key === "manual_term") {
          const maxW = Math.min(viewport.width * 0.28, bb.w * 0.70);
          if (rw > maxW) continue;
        }

        if (rw > viewport.width * 0.92) continue;
        if (rh > viewport.height * 0.35) continue;
        if (rw > viewport.width * 0.85 && rh > viewport.height * 0.20) continue;

        rects.push({ x: rx, y: ry, w: rw, h: rh, key });
      }
    }

    if (!rects.length) return [];

    rects.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const out = [];

    for (const r of rects) {
      if (!Number.isFinite(r.x + r.y + r.w + r.h)) continue;

      const last = out[out.length - 1];
      if (!last) {
        out.push({ x: r.x, y: r.y, w: r.w, h: r.h, key: r.key });
        continue;
      }

      const sameKey = r.key === last.key;
      const rTop = r.y;
      const rBot = r.y + r.h;
      const lTop = last.y;
      const lBot = last.y + last.h;

      const overlap = Math.max(0, Math.min(lBot, rBot) - Math.max(lTop, rTop));
      const minH = Math.max(1, Math.min(last.h, r.h));
      const sameLine = (overlap / minH) > 0.88;

      const heightRatio = Math.min(last.h, r.h) / Math.max(last.h, r.h);
      const similarHeight = heightRatio > 0.80;

      const gap = r.x - (last.x + last.w);
      const near = gap >= -1 && gap <= 2;

      if (sameKey && sameLine && similarHeight && near) {
        const nx = Math.min(last.x, r.x);
        const ny = Math.min(last.y, r.y);
        const nr = Math.max(last.x + last.w, r.x + r.w);
        const nb = Math.max(last.y + last.h, r.y + r.h);

        last.x = nx;
        last.y = ny;
        last.w = nr - nx;
        last.h = nb - ny;
      } else {
        out.push({ x: r.x, y: r.y, w: r.w, h: r.h, key: r.key });
      }
    }

    return out.map(({ x, y, w, h }) => ({ x, y, w, h }));
  }

  function tryMatcherCoreRectsForPage({ pdfjsLib, viewport, itemsOrTextContent, lang, enabledKeys, moneyMode, manualTerms }) {
    const mc = getMatcherCore();
    if (!mc) return null;

    const built = buildPageTextAndRangesFromItems(itemsOrTextContent);
    const pageText = String(built.pageText || "");
    if (!pageText.trim()) {
      return { ok: true, rects: [], source: "matcher-core", hitCount: 0 };
    }

    const coreRes = collectCoreHitsForPage({
      lang,
      pageText,
      enabledKeys,
      moneyMode,
      manualTerms
    });

    if (!coreRes || !coreRes.ok) return null;

    const rects = textItemsToRectsFromSpans(
      pdfjsLib,
      viewport,
      itemsOrTextContent,
      coreRes.spans || [],
      lang
    );

    return {
      ok: true,
      rects,
      source: "matcher-core",
      hitCount: Array.isArray(coreRes.spans) ? coreRes.spans.length : 0,
      debug: coreRes.debug || null,
      summary: coreRes.summary || null
    };
  }
