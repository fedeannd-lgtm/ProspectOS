(async () => {
  const params = new URLSearchParams(window.location.search);

  // ── Mode: count results (triggered via _pos/_cb params in the URL hash) ────────
  if (window.location.pathname.startsWith('/sales/search/people')) {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const pos = hashParams.get('_pos');
    const cb = hashParams.get('_cb');

    if (pos && cb) {
      const [repName, industry] = pos.split('|').map(decodeURIComponent);

      function findResultCount() {
        const patterns = [/^([\d,.]+)\s+resultados?$/i, /^([\d,.]+)\s+results?$/i];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent.trim();
          for (const re of patterns) {
            const m = text.match(re);
            if (m) return parseInt(m[1].replace(/[,.\s]/g, ''), 10);
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
          body: JSON.stringify({ repName, industry, count }),
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

  // ── Mode: create account list ────────────────────────────────────────────────
  if (!params.has('prospectOS')) return;
  if (params.get('prospectOS') !== 'create') return;

  const campaignId = params.get('campaignId');
  const listName = decodeURIComponent(escape(atob(params.get('listName') || '')));
  const companyIds = JSON.parse(atob(params.get('companyIds') || 'W10='));
  const callback = params.get('callback');

  if (!campaignId || !listName || !companyIds.length || !callback) return;

  // ── Overlay ──────────────────────────────────────────────────────────────────
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
    // ── CSRF ────────────────────────────────────────────────────────────────────
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

    // ── Obtener ownerUrn ────────────────────────────────────────────────────────
    setStatus('Obteniendo info del usuario…');
    let ownerUrn = null;
    try {
      const meRes = await fetch('/sales-api/salesApiUsers/(memberUrn:CURRENT_MEMBER)', {
        credentials: 'include', headers,
      });
      if (meRes.ok) {
        const me = await meRes.json();
        ownerUrn = me.entityUrn ?? me.objectUrn ?? me.memberUrn ?? null;
        console.log('[ProspectOS] ownerUrn:', ownerUrn);
      }
    } catch (e) {
      console.log('[ProspectOS] Could not fetch member info:', e.message);
    }

    // ── 1. Crear lista (varios formatos) ────────────────────────────────────────
    setStatus(`Creando lista "${listName}"…`);

    const createBodies = [
      { name: listName, listType: 'ACCOUNT', role: 'OWNER' },
      { name: listName, listType: 'ACCOUNT' },
    ];

    let listId = null;
    let lastStatus, lastBody;

    for (const body of createBodies) {
      console.log('[ProspectOS] Trying create with body:', JSON.stringify(body));
      const createRes = await fetch('/sales-api/salesApiLists', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
      });

      const responseText = await createRes.text();
      lastStatus = createRes.status;
      lastBody = responseText;
      console.log(`[ProspectOS] → ${createRes.status}:`, responseText.slice(0, 200));

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
            console.log('[ProspectOS] List created, ID:', listId);
            break;
          }
        } catch {
          console.warn('[ProspectOS] Could not parse list ID, trying next format');
        }
      }

      await new Promise(r => setTimeout(r, 300));
    }

    // Fallback: try alternative endpoint
    if (!listId) {
      console.log('[ProspectOS] Trying alternative endpoint salesApiAccountLists…');
      const altRes = await fetch('/sales-api/salesApiAccountLists', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ name: listName }),
      });
      const altText = await altRes.text();
      console.log(`[ProspectOS] Alt endpoint → ${altRes.status}:`, altText.slice(0, 200));
      lastStatus = altRes.status;
      lastBody = altText;

      if (altRes.ok) {
        try {
          const created = JSON.parse(altText);
          let rawId = created.id ?? created.listId ?? created.entityUrn ?? '';
          if (typeof rawId === 'string' && rawId.includes(':')) rawId = rawId.split(':').pop();
          if (rawId && String(rawId) !== 'undefined') {
            listId = String(rawId);
          }
        } catch {}
      }
    }

    if (!listId) {
      throw new Error(`No se pudo crear la lista (${lastStatus}): ${lastBody?.slice(0, 150)}`);
    }

    // ── 2. Agregar empresas ─────────────────────────────────────────────────────
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

    // ── 3. Redirigir a ProspectOS ───────────────────────────────────────────────
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
