import { Actor } from 'apify';

const SALES_NAV_BASE = 'https://www.linkedin.com';
const BATCH_SIZE = 50;
const DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Extract a cookie value by name from the cookie array
function getCookieValue(cookies, name) {
  const c = cookies.find((c) => c.name === name);
  return c?.value ?? null;
}

// Build the Cookie header string from the full array
function buildCookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

// JSESSIONID value IS the CSRF token (LinkedIn uses it directly)
function extractCsrfToken(jsessionId) {
  if (!jsessionId) return '';
  // Strip surrounding quotes if present, then ensure it starts with "ajax:"
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

  if (!liAt) throw new Error('Cookie "li_at" not found — make sure the cookie array includes li_at');
  if (!jsessionId) throw new Error('Cookie "JSESSIONID" not found — make sure the cookie array includes JSESSIONID');

  const csrfToken = extractCsrfToken(jsessionId);
  const cookieHeader = buildCookieHeader(cookie);

  console.log('CSRF token:', csrfToken ? `${csrfToken.slice(0, 15)}...` : '(empty)');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cookie': cookieHeader,
    'csrf-token': csrfToken,
    'x-restli-protocol-version': '2.0.0',
    'x-requested-with': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://www.linkedin.com/sales/lists/company',
    'Origin': 'https://www.linkedin.com',
  };

  // ── 1. Create the list ────────────────────────────────────────────────────────
  console.log('Creating account list via Sales Nav API...');
  const createRes = await fetch(`${SALES_NAV_BASE}/sales-api/salesApiLists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: listName, listType: 'ACCOUNT' }),
  });

  const createBody = await createRes.text();
  console.log('Create list response:', createRes.status, createBody.slice(0, 300));

  if (createRes.status === 401 || createRes.status === 403) {
    throw new Error(`Authentication failed (${createRes.status}) — cookie may be expired. Refresh it in ProspectOS Settings.`);
  }
  if (!createRes.ok) {
    throw new Error(`Failed to create list: HTTP ${createRes.status} — ${createBody.slice(0, 200)}`);
  }

  let listId;
  try {
    const parsed = JSON.parse(createBody);
    let rawId = parsed.id ?? parsed.listId ?? parsed.entityUrn ?? '';
    if (typeof rawId === 'string' && rawId.includes(':')) {
      rawId = rawId.split(':').pop();
    }
    listId = String(rawId);
  } catch {
    throw new Error(`Could not parse list ID from response: ${createBody.slice(0, 200)}`);
  }

  if (!listId || listId === 'undefined') {
    throw new Error(`List ID missing from response: ${createBody.slice(0, 200)}`);
  }
  console.log('List created, ID:', listId);

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
    console.log(`Batch ${batchNum}: HTTP ${addRes.status}`, addBody.slice(0, 150));

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
