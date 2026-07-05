(async () => {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));

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
  const mode = hashParams.get('_mode');
  const jobId = hashParams.get('_job');
  const cb = hashParams.get('_cb');

  if (mode === 'people_scrape' && jobId && cb) {
    await runPeopleScrape(jobId, decodeURIComponent(cb));
    return;
  }

  // ── Mode: company_scrape ─────────────────────────────────────────────────────
  if (mode === 'company_scrape' && jobId && cb) {
    await runCompanyScrape(jobId, decodeURIComponent(cb));
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

// ── People Scrape ────────────────────────────────────────────────────────────

async function runPeopleScrape(jobId, callbackUrl) {
  const overlay = createOverlay();
  const { setStatus, setProgress } = overlay;

  try {
    let page = 1;
    let totalScraped = 0;
    const MAX_PAGES = 40; // 25 results/page × 40 = 1000 max

    while (page <= MAX_PAGES) {
      setStatus(`Leyendo página ${page}…`);

      // Wait for results to load
      await waitForSelector('[data-x-search-result]', 15000);

      const people = scrapePeopleFromPage();
      setProgress(`Página ${page}: ${people.length} personas encontradas (total: ${totalScraped + people.length})`);

      if (people.length === 0) break;

      // Send batch
      const done = !hasNextPage() || page >= MAX_PAGES;
      await fetch(`${callbackUrl}?jobId=${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: people, done }),
      });

      totalScraped += people.length;

      if (done) break;

      // Go to next page
      const nextBtn = findNextButton();
      if (!nextBtn) break;
      nextBtn.click();
      page++;
      await new Promise(r => setTimeout(r, 3000)); // wait for page load
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

function scrapePeopleFromPage() {
  const results = [];

  // Sales Nav search result cards — try multiple selectors
  const cards = document.querySelectorAll(
    '[data-x-search-result], .search-results__result-item, li.artdeco-list__item'
  );

  cards.forEach((card) => {
    try {
      // Profile URL + name
      const nameLink = card.querySelector(
        'a[href*="/sales/lead/"], a[href*="linkedin.com/in/"]'
      );
      const profileUrl = nameLink?.href || '';
      const fullName = nameLink?.textContent?.trim() || '';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Job title
      const titleEl = card.querySelector(
        '[data-anonymize="job-title"], .result-lockup__highlight-keyword, .artdeco-entity-lockup__subtitle span'
      );
      const jobTitle = titleEl?.textContent?.trim() || '';

      // Company
      const companyEl = card.querySelector(
        '[data-anonymize="company-name"], a[href*="/sales/company/"]'
      );
      const companyName = companyEl?.textContent?.trim() || '';

      // Location
      const locationEl = card.querySelector(
        '[data-anonymize="location"], .result-lockup__misc-item:first-child'
      );
      const location = locationEl?.textContent?.trim() || '';

      // Premium badge
      const premium = !!card.querySelector(
        '.premium-icon, [data-test-icon="linkedin-bug-color-medium"], .artdeco-entity-lockup__degree-connection--premium'
      );

      // Connection degree
      let connectionType = 0;
      const degreeEl = card.querySelector(
        '.dist-value, [data-anonymize="connection-degree"]'
      );
      const degreeText = degreeEl?.textContent?.trim() || '';
      if (degreeText.includes('1') || degreeText.includes('1er') || degreeText.toLowerCase().includes('1st')) connectionType = 1;
      else if (degreeText.includes('2') || degreeText.includes('2do') || degreeText.toLowerCase().includes('2nd')) connectionType = 2;
      else if (degreeText.includes('3') || degreeText.includes('3er') || degreeText.toLowerCase().includes('3rd')) connectionType = 3;

      // Highlights
      const highlightEls = card.querySelectorAll('.result-highlights__highlight, [data-test-highlight]');
      const highlights = Array.from(highlightEls).map(el => ({ name: el.textContent?.trim() || '' }));

      if (!profileUrl && !fullName) return; // skip empty cards

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

async function runCompanyScrape(jobId, callbackUrl) {
  const overlay = createOverlay();
  const { setStatus, setProgress } = overlay;

  try {
    let page = 1;
    let totalScraped = 0;
    const MAX_PAGES = 10; // ~50 companies max (5 per page approx)

    while (page <= MAX_PAGES) {
      setStatus(`Leyendo página ${page}…`);
      await waitForSelector('[data-x-search-result], .search-results__result-item', 15000);

      const companies = scrapeCompaniesFromPage();
      setProgress(`Página ${page}: ${companies.length} empresas (total: ${totalScraped + companies.length})`);

      if (companies.length === 0) break;

      const done = !hasNextPage() || page >= MAX_PAGES;
      await fetch(`${callbackUrl}?jobId=${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: companies, done }),
      });

      totalScraped += companies.length;
      if (done) break;

      const nextBtn = findNextButton();
      if (!nextBtn) break;
      nextBtn.click();
      page++;
      await new Promise(r => setTimeout(r, 3000));
    }

    setStatus(`✅ Listo — ${totalScraped} empresas enviadas a ProspectOS`);
    setProgress('Podés cerrar esta pestaña.');
    setTimeout(() => window.close(), 3000);

  } catch (err) {
    setStatus('❌ Error: ' + err.message);
    setProgress('Cerrá esta pestaña y volvé a intentar desde ProspectOS.');
    console.error('[ProspectOS]', err);
  }
}

function scrapeCompaniesFromPage() {
  const results = [];
  const cards = document.querySelectorAll(
    '[data-x-search-result], .search-results__result-item, li.artdeco-list__item'
  );

  cards.forEach((card) => {
    try {
      const companyLink = card.querySelector('a[href*="/sales/company/"]');
      const companyName = companyLink?.textContent?.trim() || '';
      const href = companyLink?.href || '';

      // Extract Sales Nav company ID from URL: /sales/company/12345678/
      const idMatch = href.match(/\/sales\/company\/([^/?]+)/);
      const id = idMatch?.[1] || '';

      // Website — sometimes visible in card subtitle
      const websiteEl = card.querySelector('[data-anonymize="company-url"], .company-url');
      const website = websiteEl?.textContent?.trim() || '';

      if (!companyName && !id) return;
      results.push({ companyName, id, website });
    } catch (e) {
      console.warn('[ProspectOS] Error scraping company card:', e);
    }
  });

  return results;
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

async function waitForSelector(selector, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (document.querySelector(selector)) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Timeout esperando selector: ${selector}`);
}

function hasNextPage() {
  return !!findNextButton();
}

function findNextButton() {
  // Try multiple selectors for the "Next" pagination button
  const selectors = [
    'button[aria-label="Next"]',
    'button[aria-label="Siguiente"]',
    '.artdeco-pagination__button--next:not([disabled])',
    'button.search-results__pagination-next-btn:not([disabled])',
  ];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && !btn.disabled) return btn;
  }
  return null;
}
