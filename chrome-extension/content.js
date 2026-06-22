(async () => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('prospectOS')) return;

  const action = params.get('prospectOS');
  if (action !== 'create') return;

  const campaignId = params.get('campaignId');
  const listName = atob(params.get('listName') || '');
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
  status.textContent = 'Creando lista en Sales Navigator…';
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
      'csrf-token': csrfToken,
      'x-restli-protocol-version': '2.0.0',
      'x-requested-with': 'XMLHttpRequest',
    };

    // ── 1. Crear lista ──────────────────────────────────────────────────────────
    setStatus(`Creando lista "${listName}"…`);
    const createRes = await fetch('/sales-api/salesApiLists', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ name: listName, listType: 'ACCOUNT' }),
    });

    if (createRes.status === 401 || createRes.status === 403) {
      throw new Error('Sesión expirada — volvé a loguearte en LinkedIn.');
    }
    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`No se pudo crear la lista (${createRes.status}): ${body.slice(0, 100)}`);
    }

    const created = await createRes.json();
    let rawId = created.id ?? created.listId ?? created.entityUrn ?? '';
    if (typeof rawId === 'string' && rawId.includes(':')) rawId = rawId.split(':').pop();
    const listId = String(rawId);

    if (!listId || listId === 'undefined') {
      throw new Error('Lista creada pero no se pudo extraer el ID. Respuesta: ' + JSON.stringify(created).slice(0, 100));
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
