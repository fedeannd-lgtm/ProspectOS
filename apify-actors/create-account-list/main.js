import { Actor } from 'apify';

const SALES_NAV_BASE = 'https://www.linkedin.com';
const BATCH_SIZE = 50;
const DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getCookieValue(cookies, name) {
  const c = cookies.find((c) => c.name === name);
  return c?.value ?? null;
}

function buildCookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

function extractCsrfToken(jsessionId) {
  if (!jsessionId) return '';
  const clean = jsessionId.replace(/^"|"$/g, '');
  return clean.startsWith('ajax:') ? clean : `ajax:${clean}`;
}

Actor.main(async () => {
  const input = await Actor.getInput();
  const { cookie, companyIds, listName } = input;

  if (!cookie || !Array.isArray(cookie)) throw new Error('Input "cookie" must be an array of cookie objects');
  if (!companyIds?.length) throw new Error('Input "companyIds" must be a non-empty array');
  if (!listName) throw new Error('Input "listName" is required');

  console.log(`Creating list "${listName}" with ${companyIds.length} companies`);

  const liAt = getCookieValue(cookie, 'li_at');
  const jsessionId = getCookieValue(cookie, 'JSESSIONID');

  if (!liAt) throw new Error('Cookie "li_at" not found');
  if (!jsessionId) throw new Error('Cookie "JSESSIONID" not found');

  const csrfToken = extractCsrfToken(jsessionId);
  const cookieHeader = buildCookieHeader(cookie);

  console.log('CSRF token:', csrfToken ? `${csrfToken.slice(0, 15)}...` : '(empty)');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
    'Cookie': cookieHeader,
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.linkedin.com/sales/lists/company',
    'Origin': 'https://www.linkedin.com',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
  };

  // ── 1. Create the list (try multiple body formats) ────────────────────────────
  const createAttempts = [
    { url: `${SALES_NAV_BASE}/sales-api/salesApiLists`, body: { name: listName, listType: 'ACCOUNT' } },
    { url: `${SALES_NAV_BASE}/sales-api/salesApiLists`, body: { name: listName, type: 'ACCOUNT' } },
    { url: `${SALES_NAV_BASE}/sales-api/salesApiAccountLists`, body: { name: listName } },
  ];

  let listId = null;
  let lastStatus, lastBody;

  for (const attempt of createAttempts) {
    console.log(`POST ${attempt.url}`, JSON.stringify(attempt.body));
    const res = await fetch(attempt.url, { method: 'POST', headers, body: JSON.stringify(attempt.body) });
    const body = await res.text();
    console.log(`→ ${res.status}`, body.slice(0, 400));
    lastStatus = res.status;
    lastBody = body;

    if (res.status === 401 || res.status === 403) {
      throw new Error(`Authentication failed (${res.status}) — cookie may be expired. Refresh it in ProspectOS Settings.`);
    }

    if (res.ok) {
      try {
        const parsed = JSON.parse(body);
        let rawId = parsed.id ?? parsed.listId ?? parsed.entityUrn ?? '';
        if (typeof rawId === 'string' && rawId.includes(':')) rawId = rawId.split(':').pop();
        if (rawId && String(rawId) !== 'undefined') {
          listId = String(rawId);
          console.log('List created, ID:', listId);
          break;
        }
      } catch {
        console.warn('Could not parse list ID from successful response, trying next format');
      }
    }
  }

  if (!listId) {
    throw new Error(`Could not create list. Last response: ${lastStatus} — ${lastBody?.slice(0, 300)}`);
  }

  // ── 2. Add companies in batches ───────────────────────────────────────────────
  console.log(`Adding ${companyIds.length} companies in batches of ${BATCH_SIZE}...`);
  let added = 0;
  let failed = 0;

  for (let i = 0; i < companyIds.length; i += BATCH_SIZE) {
    const batch = companyIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    const addRes = await fetch(`${SALES_NAV_BASE}/sales-api/salesApiLists/${listId}/listMembers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        elements: batch.map((id) => ({ type: 'ACCOUNT', account: { id: String(id) } })),
      }),
    });

    const addBody = await addRes.text();
    console.log(`Batch ${batchNum}: ${addRes.status}`, addBody.slice(0, 150));

    if (addRes.ok) {
      added += batch.length;
    } else {
      failed += batch.length;
      console.warn(`Batch ${batchNum} failed: ${addBody.slice(0, 200)}`);
    }

    if (i + BATCH_SIZE < companyIds.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`Done — added: ${added}, failed: ${failed}`);

  const result = { listId, listName, companiesAdded: added, companiesFailed: failed };
  await Actor.pushData(result);
  console.log('Output:', result);
});
