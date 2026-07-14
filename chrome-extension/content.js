(async () => {
  console.log('[ProspectOS] content.js loaded', window.location.href);

  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));

  console.log('[ProspectOS] hash:', window.location.hash);

  // ── Mode: company profile visit (phase 2 of company scrape) ─────────────────
  const profileVisitState = (() => {
    try { return JSON.parse(sessionStorage.getItem('prospectOS_company_visit') || 'null'); }
    catch { return null; }
  })();
  if (profileVisitState && !window.location.pathname.startsWith('/sales/search/')) {
    await runCompanyProfileVisit(profileVisitState);
    return;
  }

  // ── Mode: count results ──────────────────────────────────────────────────────
  if (window.location.pathname.startsWith('/sales/search/people')) {
    const pos = hashParams.get('_pos');
    const cb = hashParams.get('_cb');
    const urlIndex = parseInt(hashParams.get('_url') || '1', 10);

    if (pos && cb) {
      const [repName, industry] = pos.split('|').map(decodeURIComponent);

      function findResultCount() {
        const text = document.body.innerText;
        const patterns = [
          /\b([\d,.]+)\s+resultados?\b/i,
          /\b([\d,.]+)\s+results?\b/i,
        ];
        for (const re of patterns) {
          const m = text.match(re);
          if (m) {
            const num = parseInt(m[1].replace(/[,.\s]/g, ''), 10);
            if (num > 0) return num;
          }
        }
        return null;
      }

      const badge = document.createElement('div');
      badge.style.cssText = `
        position:fixed;bottom:20px;right:20px;
        background:rgba(0,0,0,0.80);color:#fff;border-radius:8px;
        padding:10px 16px;font-size:13px;font-weight:500;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        z-index:999999;pointer-events:none;
      `;
      badge.textContent = '⏳ ProspectOS: leyendo resultados…';
      document.body.appendChild(badge);

      let count = null;
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        count = findResultCount();
        if (count !== null) break;
        await new Promise(r => setTimeout(r, 600));
      }

      if (count === null) {
        badge.textContent = '⚠️ ProspectOS: no se encontró el conteo';
        setTimeout(() => badge.remove(), 3000);
        return;
      }

      badge.textContent = `⚡ ProspectOS: enviando ${count.toLocaleString()} resultados…`;

      try {
        await fetch(decodeURIComponent(cb), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repName, industry, count, urlIndex }),
        });
        badge.style.background = 'rgba(22,163,74,0.92)';
        badge.textContent = `✅ ProspectOS: ${count.toLocaleString()} resultados guardados`;
      } catch {
        badge.textContent = '⚠️ ProspectOS: error enviando conteo';
      }

      setTimeout(() => badge.remove(), 3000);
      return;
    }
  }

  // ── Mode: people_scrape ──────────────────────────────────────────────────────
  // Params are appended to the existing Sales Nav hash (e.g. #query=(...)&_mode=people_scrape&_job=xxx)
  const mode = hashParams.get('_mode');
  const jobId = hashParams.get('_job');
  const scrapeCb = hashParams.get('_cb');

  const decodedCb = scrapeCb ? decodeURIComponent(scrapeCb) : scrapeCb;
  const maxResults = parseInt(hashParams.get('_max') || '500', 10);
  console.log('[ProspectOS] scrape params:', { mode, jobId, maxResults, decodedCb });

  if (mode === 'people_scrape' && jobId && scrapeCb) {
    await runPeopleScrape(jobId, decodedCb, maxResults);
    return;
  }

  if (mode === 'company_scrape' && jobId && scrapeCb) {
    await runCompanyScrape(jobId, decodedCb, maxResults);
    return;
  }

  // ── Mode: create account list ────────────────────────────────────────────────
  if (!params.has('prospectOS')) return;
  if (params.get('prospectOS') !== 'create') return;

  const campaignId = params.get('campaignId');
  const listName = decodeURIComponent(escape(atob(params.get('listName') || '')));
  const companyIds = JSON.parse(atob(params.get('companyIds') || 'W10='));
  const callback = params.get('callback');

  if (!campaignId || !listName || !companyIds.length || !callback) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.85);z-index:999999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;gap:16px;
  `;
  const title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:600;';
  title.textContent = '⚡ ProspectOS';
  const status = document.createElement('div');
  status.style.cssText = 'font-size:14px;opacity:0.8;';
  status.textContent = 'Iniciando…';
  const progress = document.createElement('div');
  progress.style.cssText = 'font-size:12px;opacity:0.6;font-family:monospace;';
  overlay.append(title, status, progress);
  document.body.appendChild(overlay);

  function setStatus(msg) { status.textContent = msg; }
  function setProgress(msg) { progress.textContent = msg; }

  try {
    const jsessionRaw = document.cookie.split(';')
      .map(c => c.trim().split('='))
      .find(([k]) => k === 'JSESSIONID')?.[1]?.replace(/"/g, '') || '';
    const csrfToken = jsessionRaw.startsWith('ajax:') ? jsessionRaw : `ajax:${jsessionRaw}`;

    if (!csrfToken || csrfToken === 'ajax:') {
      throw new Error('No se encontró el CSRF token. Asegurate de estar logueado en LinkedIn.');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      'csrf-token': csrfToken,
      'x-restli-protocol-version': '2.0.0',
      'x-requested-with': 'XMLHttpRequest',
      'x-li-lang': 'es_AR',
      'x-li-track': JSON.stringify({
        clientVersion: '1.13.9787',
        mpVersion: '1.13.9787',
        osName: 'web',
        timezoneOffset: -3,
        timezone: 'America/Argentina/Buenos_Aires',
        deviceFormFactor: 'DESKTOP',
        mpName: 'sales-navigator-web',
        displayDensity: 1,
        displayWidth: 1920,
        displayHeight: 1080,
      }),
      'x-li-page-instance': 'urn:li:page:sales_navigator_lists;' + Math.random().toString(36).slice(2),
    };

    setStatus('Obteniendo info del usuario…');
    let ownerUrn = null;
    try {
      const meRes = await fetch('/sales-api/salesApiUsers/(memberUrn:CURRENT_MEMBER)', {
        credentials: 'include', headers,
      });
      if (meRes.ok) {
        const me = await meRes.json();
        ownerUrn = me.entityUrn ?? me.objectUrn ?? me.memberUrn ?? null;
      }
    } catch (e) {
      console.log('[ProspectOS] Could not fetch member info:', e.message);
    }

    setStatus(`Creando lista "${listName}"…`);

    const createBodies = [
      { name: listName, listType: 'ACCOUNT', role: 'OWNER' },
      { name: listName, listType: 'ACCOUNT' },
    ];

    let listId = null;
    let lastStatus, lastBody;

    for (const body of createBodies) {
      const createRes = await fetch('/sales-api/salesApiLists', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
      });

      const responseText = await createRes.text();
      lastStatus = createRes.status;
      lastBody = responseText;

      if (createRes.status === 401 || createRes.status === 403) {
        throw new Error('Sesión expirada — volvé a loguearte en LinkedIn.');
      }

      if (createRes.ok) {
        try {
          const created = JSON.parse(responseText);
          let rawId = created.id ?? created.listId ?? created.entityUrn ?? '';
          if (typeof rawId === 'string' && rawId.includes(':')) rawId = rawId.split(':').pop();
          if (rawId && String(rawId) !== 'undefined') {
            listId = String(rawId);
            break;
          }
        } catch {
          console.warn('[ProspectOS] Could not parse list ID, trying next format');
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    if (!listId) {
      const altRes = await fetch('/sales-api/salesApiAccountLists', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ name: listName }),
      });
      const altText = await altRes.text();
      lastStatus = altRes.status;
      lastBody = altText;

      if (altRes.ok) {
        try {
          const created = JSON.parse(altText);
          let rawId = created.id ?? created.listId ?? created.entityUrn ?? '';
          if (typeof rawId === 'string' && rawId.includes(':')) rawId = rawId.split(':').pop();
          if (rawId && String(rawId) !== 'undefined') listId = String(rawId);
        } catch {}
      }
    }

    if (!listId) throw new Error(`No se pudo crear la lista (${lastStatus}): ${lastBody?.slice(0, 150)}`);

    let ok = 0;
    let fail = 0;

    for (let i = 0; i < companyIds.length; i++) {
      const id = companyIds[i];
      setStatus(`Agregando empresas… (${i + 1}/${companyIds.length})`);
      setProgress(`ID: ${id}`);

      const r = await fetch('/sales-api/salesApiListEntities?action=edit', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          entity: `urn:li:fs_salesCompany:${id}`,
          addToLists: [listId],
          removeFromLists: [],
        }),
      });

      if (r.ok) { ok++; } else { fail++; }
      await new Promise(r => setTimeout(r, 250));
    }

    setStatus(`✅ Listo — ${ok}/${companyIds.length} empresas agregadas. Volviendo a ProspectOS…`);
    setProgress('');
    await new Promise(r => setTimeout(r, 1500));

    const url = new URL(callback);
    url.searchParams.set('listId', listId);
    url.searchParams.set('listName', listName);
    url.searchParams.set('campaignId', campaignId);
    url.searchParams.set('added', String(ok));
    url.searchParams.set('failed', String(fail));
    window.location.href = url.toString();

  } catch (err) {
    setStatus('❌ Error: ' + err.message);
    setProgress('Cerrá esta pestaña y volvé a intentar desde ProspectOS.');
    console.error('[ProspectOS]', err);
  }
})();

// ── Pending Job Check ────────────────────────────────────────────────────────

async function checkAndRunPendingJob() {
  // Get ProspectOS base URL from storage (set once by user), fallback to localhost
  let baseUrl = 'http://localhost:3000';
  try {
    const stored = await chrome.storage.local.get('prospectosUrl');
    if (stored.prospectosUrl) baseUrl = stored.prospectosUrl;
  } catch {}

  console.log('[ProspectOS] checking for pending job at', baseUrl);

  let job = null;
  try {
    const res = await fetch(`${baseUrl}/api/extension/pending-job`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.jobId) job = { jobId: data.jobId, callbackUrl: `${baseUrl}/api/extension/results` };
    }
  } catch (e) {
    console.log('[ProspectOS] no pending job found:', e.message);
    return;
  }

  if (!job) {
    console.log('[ProspectOS] no pending job');
    return;
  }

  console.log('[ProspectOS] found pending job:', job.jobId);
  await runPeopleScrape(job.jobId, job.callbackUrl);
}

// ── People Scrape ────────────────────────────────────────────────────────────

async function runPeopleScrape(jobId, callbackUrl, maxResults = 500) {
  const overlay = createOverlay();
  const { setStatus, setProgress } = overlay;

  try {
    // Give Sales Nav's SPA time to initialize and load the search results
    setStatus('Esperando que Sales Nav cargue los resultados…');
    setProgress('Esto puede tardar hasta 30 segundos en una pestaña nueva.');
    await new Promise(r => setTimeout(r, 5000));

    let page = 1;
    let totalScraped = 0;
    const MAX_PAGES = 40; // 25 results/page × 40 = 1000 max
    const globalSeen = new Set(); // dedup across all pages

    while (page <= MAX_PAGES) {
      setStatus(`Leyendo página ${page}…`);
      setProgress('Buscando resultados en el DOM…');

      // Wait for profile links — try both URL formats Sales Nav has used
      // On timeout, wait 20s and retry once before giving up (handles Sales Nav throttling)
      let loaded = false;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await waitForSelector('a[href*="/sales/lead/"], a[href*="/sales/people/"]', 150000);
          loaded = true;
          break;
        } catch (_) {
          if (attempt === 1) {
            setProgress(`Sales Nav está lento en página ${page}, esperando 20s antes de reintentar…`);
            await new Promise(r => setTimeout(r, 20000));
          }
        }
      }
      if (!loaded) {
        setStatus(`⚠️ Timeout en página ${page} — cerrando job con ${totalScraped} personas scrapeadas.`);
        setProgress('Podés cerrar esta pestaña.');
        await fetch(`${callbackUrl}?jobId=${jobId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [], done: true }),
        }).catch(() => {});
        setTimeout(() => window.close(), 4000);
        return;
      }

      // Scrape while scrolling to handle Sales Nav's virtual scroll
      const people = await scrapeWhileScrolling(globalSeen);
      setProgress(`Página ${page}: ${people.length} personas nuevas (total: ${totalScraped + people.length})`);

      if (people.length === 0) break;

      // Send batch
      const reachedMax = totalScraped + people.length >= maxResults;
      const done = reachedMax || !hasNextPage() || page >= MAX_PAGES;
      const fetchUrl = `${callbackUrl}?jobId=${jobId}`;
      console.log('[ProspectOS] posting to:', fetchUrl);
      try {
        const res = await fetch(fetchUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: people, done }),
        });
        console.log('[ProspectOS] response status:', res.status);
      } catch (fetchErr) {
        throw new Error(`Fetch falló → ${fetchUrl}\n${fetchErr.message}`);
      }

      totalScraped += people.length;

      if (done) break;

      // Go to next page
      const nextBtn = findNextButton();
      if (!nextBtn) break;
      nextBtn.click();
      page++;
      // Progressive delay: more breathing room on later pages to avoid Sales Nav throttling
      const pageDelay = page > 20 ? 10000 : page > 15 ? 6000 : 3000;
      await new Promise(r => setTimeout(r, pageDelay));
    }

    setStatus(`✅ Listo — ${totalScraped} personas enviadas a ProspectOS`);
    setProgress('Podés cerrar esta pestaña.');
    setTimeout(() => window.close(), 3000);

  } catch (err) {
    setStatus('❌ Error: ' + err.message);
    setProgress('Cerrá esta pestaña y volvé a intentar desde ProspectOS.');
    console.error('[ProspectOS]', err);
  }
}

function findScrollContainer() {
  // Walk up from a result card to find the real scrollable ancestor
  const link = queryAllDocs('a[href*="/sales/lead/"], a[href*="/sales/people/"]')[0];
  if (!link) return null;
  let el = link.parentElement;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (/auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 10) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

async function scrapeWhileScrolling(globalSeen) {
  const results = [];
  let stableRounds = 0;
  let lastCount = 0;

  const container = findScrollContainer();
  console.log('[ProspectOS] scroll container:', container?.tagName, container?.className?.slice(0, 60));

  function scrollDown(px) {
    if (container) {
      container.scrollBy(0, px);
    } else {
      window.scrollBy(0, px);
    }
  }

  function scrollToTop() {
    if (container) {
      container.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }

  function collectVisible() {
    queryAllDocs('a[href*="/sales/lead/"], a[href*="/sales/people/"]').forEach((nameLink) => {
      try {
        const profileUrl = nameLink.href || '';
        if (!profileUrl || globalSeen.has(profileUrl)) return;
        globalSeen.add(profileUrl);

        // Try data-anonymize="person-name" first; fallback to link text stripping status badges
        const nameEl = nameLink.querySelector('[data-anonymize="person-name"]') || nameLink;
        const fullName = (nameEl.textContent?.trim() || '')
          .replace(/\s+(está disponible|is available|is reachable|open to work|abierto? a trabajar)$/i, '')
          .trim();
        const nameParts = fullName.split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const card = nameLink.closest('li') || nameLink.parentElement;

        const titleEl = card?.querySelector('[data-anonymize="job-title"], .artdeco-entity-lockup__subtitle span, .result-lockup__highlight-keyword');
        const companyEl = card?.querySelector('[data-anonymize="company-name"], a[href*="/sales/company/"]');
        const locationEl = card?.querySelector('[data-anonymize="location"], .artdeco-entity-lockup__caption span, .result-lockup__misc-item');
        const premium = deepHasPremium(card);

        const cardText = card?.textContent || '';

        let connectionType = 0;
        if (/\b1(st|er|°)\b/i.test(cardText)) connectionType = 1;
        else if (/\b2(nd|do|°)\b/i.test(cardText)) connectionType = 2;
        else if (/\b3(rd|er|°)\b/i.test(cardText)) connectionType = 3;

        // Parse tenure duration → start month (1-12)
        let startedRoleMonths = null;
        const tenureYM = cardText.match(/(\d+)\s+años?\s+(\d+)\s+meses?\s+en el cargo/i);
        const tenureY  = cardText.match(/(\d+)\s+años?\s+en el cargo/i);
        const tenureM  = cardText.match(/(\d+)\s+meses?\s+en el cargo/i);
        let totalMonths = null;
        if (tenureYM)      totalMonths = parseInt(tenureYM[1]) * 12 + parseInt(tenureYM[2]);
        else if (tenureY)  totalMonths = parseInt(tenureY[1]) * 12;
        else if (tenureM)  totalMonths = parseInt(tenureM[1]);
        if (totalMonths !== null) {
          const now = new Date();
          startedRoleMonths = new Date(now.getFullYear(), now.getMonth() - totalMonths).getMonth() + 1;
        }

        // Highlights — extract from card text via regex (CSS selectors don't match current Sales Nav DOM)
        const highlightPatterns = [
          /\d+\s+contactos?\s+en\s+común/gi,
          /Antiguo\s+compañero\s+de\s+trabajo(?:\s+\(\d+\))?/gi,
          /Ha\s+publicado\s+recientemente/gi,
          /Sigue\s+a\s+tu\s+empresa/gi,
          /Ha\s+visto\s+tu\s+perfil\s+recientemente/gi,
          /Experiencias?\s+en\s+común(?:\s+\(\d+\))?/gi,
          /Contactos?\s+de\s+contactos?(?:\s+\(\d+\))?/gi,
          /Cambio\s+de\s+empleo/gi,
        ];
        const highlightTexts = [];
        for (const pattern of highlightPatterns) {
          const match = cardText.match(pattern);
          if (match) highlightTexts.push(...match.map(m => m.trim()));
        }
        const highlights = [...new Set(highlightTexts)].map(name => ({ name }));


        results.push({
          firstName, lastName, fullName,
          jobTitle: titleEl?.textContent?.trim() || '',
          companyName: companyEl?.textContent?.trim() || '',
          location: locationEl?.textContent?.trim() || '',
          premium,
          connectionType: connectionType || undefined,
          profileUrl,
          startedRoleMonths,
          highlights: highlights.length ? highlights : undefined,
        });
      } catch (e) {
        console.warn('[ProspectOS] Error scraping card:', e);
      }
    });
  }

  // Scroll & collect until no new people appear for 5 consecutive steps
  while (stableRounds < 5) {
    collectVisible();
    const newCount = results.length;
    if (newCount === lastCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      lastCount = newCount;
    }
    scrollDown(350);
    await new Promise(r => setTimeout(r, 500));
  }

  scrollToTop();
  await new Promise(r => setTimeout(r, 700));
  return results;
}

function scrapePeopleFromPage(seen = new Set()) {
  const results = [];

  // Find all profile links — the stable anchor in Sales Nav DOM.
  // Walk up to the containing <li> to get the full card context.
  const profileLinks = queryAllDocs('a[href*="/sales/lead/"], a[href*="/sales/people/"]');

  profileLinks.forEach((nameLink) => {
    try {
      const profileUrl = nameLink.href || '';
      if (seen.has(profileUrl)) return;
      seen.add(profileUrl);

      const fullName = nameLink.textContent?.trim() || '';
      const nameParts = fullName.split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Walk up to the closest <li> which is the card root
      const card = nameLink.closest('li') || nameLink.parentElement;

      // Job title — Sales Nav uses data-anonymize="job-title" or aria-label on spans
      const titleEl = card?.querySelector(
        '[data-anonymize="job-title"], .artdeco-entity-lockup__subtitle span, .result-lockup__highlight-keyword'
      );
      const jobTitle = titleEl?.textContent?.trim() || '';

      // Company
      const companyEl = card?.querySelector(
        '[data-anonymize="company-name"], a[href*="/sales/company/"]'
      );
      const companyName = companyEl?.textContent?.trim() || '';

      // Location — often third line in the lockup
      const locationEl = card?.querySelector(
        '[data-anonymize="location"], .artdeco-entity-lockup__caption span, .result-lockup__misc-item'
      );
      const location = locationEl?.textContent?.trim() || '';

      // Premium badge
      const premium = deepHasPremium(card);

      // Connection degree — look for "1st", "2nd", "3rd" / "1er", "2do", "3er"
      let connectionType = 0;
      const cardText = card?.textContent || '';
      if (/\b1(st|er|°)\b/i.test(cardText)) connectionType = 1;
      else if (/\b2(nd|do|°)\b/i.test(cardText)) connectionType = 2;
      else if (/\b3(rd|er|°)\b/i.test(cardText)) connectionType = 3;

      // Highlights
      const highlightEls = card?.querySelectorAll('.result-highlights__highlight, [data-test-highlight]') || [];
      const highlights = Array.from(highlightEls).map(el => ({ name: el.textContent?.trim() || '' }));

      console.log('[ProspectOS] scraped:', { fullName, jobTitle, companyName, profileUrl });

      results.push({
        firstName,
        lastName,
        fullName,
        jobTitle,
        companyName,
        location,
        premium,
        connectionType: connectionType || undefined,
        profileUrl,
        highlights: highlights.length ? highlights : undefined,
      });
    } catch (e) {
      console.warn('[ProspectOS] Error scraping card:', e);
    }
  });

  return results;
}

// ── Company Scrape ───────────────────────────────────────────────────────────

async function runCompanyScrape(jobId, callbackUrl, maxResults = 50) {
  const overlay = createOverlay();
  const { setStatus, setProgress } = overlay;

  try {
    setStatus('Esperando que Sales Nav cargue…');
    await new Promise(r => setTimeout(r, 4000));

    // ── Phase 1: scroll + paginate through search results ────────────────────
    const allCompanies = [];
    const globalSeen = new Set();
    let page = 1;
    const MAX_PAGES = Math.ceil(maxResults / 25) + 2;

    while (page <= MAX_PAGES && allCompanies.length < maxResults) {
      setStatus(`Leyendo página ${page}…`);
      await waitForSelector('a[href*="/sales/company/"]', 30000);

      const pageCompanies = await scrapeCompaniesWhileScrolling(globalSeen);
      allCompanies.push(...pageCompanies);
      setProgress(`Página ${page}: ${pageCompanies.length} empresas (total: ${allCompanies.length})`);

      if (pageCompanies.length === 0) break;
      if (allCompanies.length >= maxResults) break;

      const nextBtn = findNextButton();
      if (!nextBtn) break;
      nextBtn.click();
      page++;
      await new Promise(r => setTimeout(r, 3000));
    }

    if (allCompanies.length === 0) {
      await fetch(`${callbackUrl}?jobId=${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [], done: true }),
      });
      setStatus('No se encontraron empresas.');
      setTimeout(() => window.close(), 3000);
      return;
    }

    const companies = allCompanies.slice(0, maxResults);

    // ── Phase 2: visit each company profile — interceptor.js captures website ──
    setStatus(`${companies.length} empresas encontradas. Extrayendo websites…`);
    await new Promise(r => setTimeout(r, 500));

    sessionStorage.setItem('prospectOS_company_visit', JSON.stringify({
      jobId,
      callbackUrl,
      companies,
      currentIndex: 0,
    }));

    window.location.href = `https://www.linkedin.com/sales/company/${companies[0].id}`;

  } catch (err) {
    setStatus('❌ Error: ' + err.message);
    setProgress('Cerrá esta pestaña y volvé a intentar desde ProspectOS.');
    console.error('[ProspectOS]', err);
  }
}

function findCompanyScrollContainer() {
  const link = document.querySelector('a[href*="/sales/company/"]');
  if (!link) return null;
  let el = link.parentElement;
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    if (/auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 10) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

async function scrapeCompaniesWhileScrolling(globalSeen) {
  const results = [];
  let stableRounds = 0;
  let lastCount = 0;

  const container = findCompanyScrollContainer();

  function scrollDown(px) {
    if (container) container.scrollBy(0, px);
    else window.scrollBy(0, px);
  }

  function scrollToTop() {
    if (container) container.scrollTo(0, 0);
    else window.scrollTo(0, 0);
  }

  function collectVisible() {
    const allLinks = document.querySelectorAll('a[href*="/sales/company/"]');
    console.log('[ProspectOS] company links total:', allLinks.length);
    allLinks.forEach((link) => {
      try {
        const href = link.href || '';
        if (href.includes('aiqSection') || href.includes('anchor=aiq')) return;

        const idMatch = href.match(/\/sales\/company\/([^/?#]+)/);
        const id = idMatch?.[1] || '';
        if (!id || globalSeen.has(id)) return;

        const card = link.closest('li') || link.closest('[data-x-search-result]');
        if (!card) { console.log('[ProspectOS] no card for id:', id, href); return; }

        const nameEl = card.querySelector('[data-anonymize="company-name"]');
        const companyName = nameEl?.textContent?.trim() || link.textContent?.trim() || '';
        console.log('[ProspectOS] candidate id:', id, 'name:', companyName || '(empty)', 'href:', href.slice(0, 80));

        if (!companyName) return;

        globalSeen.add(id);
        results.push({ companyName, id, website: '' });
      } catch (e) {
        console.warn('[ProspectOS] Error scraping company card:', e);
      }
    });
  }

  while (stableRounds < 5) {
    collectVisible();
    const newCount = results.length;
    if (newCount === lastCount) stableRounds++;
    else { stableRounds = 0; lastCount = newCount; }
    scrollDown(350);
    await new Promise(r => setTimeout(r, 500));
  }

  scrollToTop();
  await new Promise(r => setTimeout(r, 500));
  return results;
}

function deepHasPremium(root) {
  if (!root) return false;
  const PREMIUM_SELECTOR = '.premium-icon, [data-test-icon="linkedin-bug-color-medium"], [aria-label*="Premium"], [aria-label*="premium"], li-icon[type*="premium"], li-icon[type*="linkedin-bug"]';
  if (root.querySelector(PREMIUM_SELECTOR)) return true;
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot && el.shadowRoot.querySelector(PREMIUM_SELECTOR)) return true;
  }
  return false;
}

function extractWebsiteFromDOM() {
  const SKIP = /linkedin\.com|google\.com|bing\.com|microsoft\.com|twitter\.com|facebook\.com|instagram\.com|youtube\.com|t\.co\//i;

  // Strategy 1: deep shadow DOM traversal — finds <a> inside shadow roots
  function collectLinks(root, links = []) {
    root.querySelectorAll('a[href]').forEach(a => links.push(a));
    root.querySelectorAll('*').forEach(el => {
      if (el.shadowRoot) collectLinks(el.shadowRoot, links);
    });
    return links;
  }

  const links = collectLinks(document);
  console.log('[ProspectOS] shadow DOM total links:', links.length);

  for (const link of links) {
    const href = link.href || link.getAttribute('href') || '';
    if (!href.startsWith('http')) continue;
    if (SKIP.test(href)) continue;

    const text = (link.textContent || '').trim().toLowerCase();
    const ariaLabel = (link.getAttribute('aria-label') || '').toLowerCase();
    const title = (link.getAttribute('title') || '').toLowerCase();
    const parentAria = (link.closest('[aria-label]')?.getAttribute('aria-label') || '').toLowerCase();

    if (text.includes('sitio web') || text.includes('website') ||
        ariaLabel.includes('sitio') || ariaLabel.includes('website') ||
        title.includes('sitio') || title.includes('website') ||
        parentAria.includes('sitio') || parentAria.includes('website')) {
      console.log('[ProspectOS] strategy 1 → website:', href);
      return href;
    }
  }

  // Strategy 2: scan document.body.innerText for URLs near "sitio web" / "website"
  // LinkedIn shows the URL as visible text in the company info section
  try {
    const fullText = document.body.innerText || '';
    const siteIdx = fullText.search(/ir al sitio web|go to website|website\s*[:：]/i);
    if (siteIdx >= 0) {
      const chunk = fullText.slice(Math.max(0, siteIdx - 20), siteIdx + 300);
      const urlMatch = chunk.match(/https?:\/\/(?!(?:www\.)?linkedin\.com)[^\s\n,;)>]+/);
      if (urlMatch) {
        const url = urlMatch[0].replace(/[.,;)>]+$/, '');
        console.log('[ProspectOS] strategy 2 (innerText) → website:', url);
        return url;
      }
    }
  } catch (e) {}

  return '';
}

async function runCompanyProfileVisit(state) {
  const { jobId, callbackUrl, companies, currentIndex } = state;
  const overlay = createOverlay();
  const { setStatus, setProgress } = overlay;

  try {
    const company = companies[currentIndex];
    setStatus(`Capturando website (${currentIndex + 1}/${companies.length})…`);
    setProgress(company.companyName);

    const numericId = company.id.match(/(\d+)$/)?.[1] || company.id;
    const storageKey = `__pos_w_${numericId}`;
    const deadline = Date.now() + 8000;
    let website = '';
    while (Date.now() < deadline) {
      // 1. Try interceptor sessionStorage (world: MAIN)
      website = sessionStorage.getItem(storageKey) || '';
      // 2. Fallback: deep shadow DOM traversal
      if (!website) website = extractWebsiteFromDOM();
      if (website) break;
      if (/no hemos podido encontrar|page not found/i.test(document.body?.innerText || '')) break;
      await new Promise(r => setTimeout(r, 600));
    }

    sessionStorage.removeItem(storageKey);
    companies[currentIndex].website = website;
    console.log('[ProspectOS]', company.companyName, '→', website || '(no website)');

    const nextIndex = currentIndex + 1;

    if (nextIndex < companies.length) {
      sessionStorage.setItem('prospectOS_company_visit', JSON.stringify({
        ...state,
        companies,
        currentIndex: nextIndex,
      }));
      window.location.href = `https://www.linkedin.com/sales/company/${companies[nextIndex].id}`;
    } else {
      sessionStorage.removeItem('prospectOS_company_visit');
      setStatus(`Enviando ${companies.length} empresas a ProspectOS…`);
      setProgress('');

      await fetch(`${callbackUrl}?jobId=${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: companies, done: true }),
      });

      const withWebsite = companies.filter(c => c.website).length;
      setStatus(`✅ Listo — ${companies.length} empresas enviadas (${withWebsite} con website)`);
      setProgress('Podés cerrar esta pestaña.');
      setTimeout(() => window.close(), 4000);
    }

  } catch (err) {
    sessionStorage.removeItem('prospectOS_company_visit');
    setStatus('❌ Error: ' + err.message);
    setProgress('Cerrá esta pestaña y volvé a intentar desde ProspectOS.');
    console.error('[ProspectOS]', err);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.88);z-index:999999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;gap:16px;
  `;
  const title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:600;';
  title.textContent = '⚡ ProspectOS — Scraping en curso';
  const statusEl = document.createElement('div');
  statusEl.style.cssText = 'font-size:14px;opacity:0.85;';
  statusEl.textContent = 'Iniciando…';
  const progressEl = document.createElement('div');
  progressEl.style.cssText = 'font-size:12px;opacity:0.6;font-family:monospace;max-width:500px;text-align:center;';
  overlay.append(title, statusEl, progressEl);
  document.body.appendChild(overlay);
  return {
    setStatus: (msg) => { statusEl.textContent = msg; },
    setProgress: (msg) => { progressEl.textContent = msg; },
  };
}

// Returns all accessible documents: main frame + same-origin iframes
function getAllDocs() {
  const docs = [document];
  document.querySelectorAll('iframe').forEach(iframe => {
    try { if (iframe.contentDocument) docs.push(iframe.contentDocument); } catch (e) {}
  });
  return docs;
}

function queryAllDocs(selector) {
  const results = [];
  getAllDocs().forEach(doc => {
    try { results.push(...doc.querySelectorAll(selector)); } catch (e) {}
  });
  return results;
}

async function waitForSelector(selector, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (queryAllDocs(selector).length > 0) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Timeout esperando selector: ${selector}`);
}

function hasNextPage() {
  return !!findNextButton();
}

function findNextButton() {
  const selectors = [
    'button[aria-label="Next"]',
    'button[aria-label="Siguiente"]',
    '.artdeco-pagination__button--next:not([disabled])',
    'button.search-results__pagination-next-btn:not([disabled])',
  ];
  for (const sel of selectors) {
    const results = queryAllDocs(sel);
    const btn = results.find(b => !b.disabled);
    if (btn) return btn;
  }
  return null;
}
