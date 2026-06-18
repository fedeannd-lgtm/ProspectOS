const { Actor } = require('apify');
const { chromium } = require('playwright');

Actor.main(async () => {
  const input = await Actor.getInput();
  const { cookie, companyIds, listName } = input;

  console.log(`Creating list "${listName}" with ${companyIds.length} companies`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  await context.addCookies(
    cookie.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.linkedin.com',
      path: c.path || '/',
      secure: c.secure !== false,
      httpOnly: c.httpOnly || false,
      sameSite: c.sameSite || 'Lax',
    }))
  );

  const page = await context.newPage();

  // ── 1. Navigate to Sales Navigator ─────────────────────────────────────────
  console.log('Loading Sales Navigator...');
  await page.goto('https://www.linkedin.com/sales/home', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
    throw new Error('Not authenticated — cookie may be expired');
  }

  // ── 2. Try creating list via internal API ───────────────────────────────────
  const csrfToken = await page.evaluate(() => {
    for (const part of document.cookie.split(';')) {
      const [k, v] = part.trim().split('=');
      if (k === 'JSESSIONID') {
        const clean = v.replace(/"/g, '');
        return clean.startsWith('ajax:') ? clean : `ajax:${clean}`;
      }
    }
    return '';
  });

  console.log('CSRF token found:', !!csrfToken);

  let listId = null;

  if (csrfToken) {
    const createRes = await page.evaluate(
      async ({ name, csrf }) => {
        const r = await fetch('/sales-api/salesApiLists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'csrf-token': csrf,
            'x-restli-protocol-version': '2.0.0',
            'x-requested-with': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({ name, listType: 'ACCOUNT' }),
        });
        return { status: r.status, body: await r.text() };
      },
      { name: listName, csrf: csrfToken }
    );

    console.log('Create list API response:', createRes.status, createRes.body.slice(0, 200));

    if (createRes.status >= 200 && createRes.status < 300) {
      try {
        const parsed = JSON.parse(createRes.body);
        let rawId = parsed.id ?? parsed.listId ?? parsed.entityUrn ?? '';
        if (typeof rawId === 'string' && rawId.includes(':')) {
          rawId = rawId.split(':').pop();
        }
        listId = String(rawId);
        console.log('List created via API, id:', listId);
      } catch {
        console.warn('Could not parse list id from API response, falling back to UI');
      }
    }
  }

  // ── 3. Fallback: create list via UI ────────────────────────────────────────
  if (!listId) {
    console.log('Falling back to UI automation for list creation...');
    await page.goto('https://www.linkedin.com/sales/lists/company', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Click "Create account list" button (text may vary by language)
    const createBtn = page.locator('button:has-text("Create account list"), button:has-text("New list"), button:has-text("Create list")').first();
    await createBtn.click();
    await page.waitForTimeout(1000);

    // Fill the list name
    const nameInput = page.locator('input[placeholder*="list"], input[aria-label*="list"], input[name*="name"]').first();
    await nameInput.fill(listName);
    await page.waitForTimeout(500);

    // Submit
    const submitBtn = page.locator('button:has-text("Create"), button[type="submit"]').last();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    // Extract listId from URL after redirect
    const newUrl = page.url();
    const match = newUrl.match(/\/lists\/(?:company|account)\/(\d+)/);
    if (!match) throw new Error(`Could not extract list ID from URL: ${newUrl}`);
    listId = match[1];
    console.log('List created via UI, id:', listId);
  }

  // ── 4. Add companies ────────────────────────────────────────────────────────
  console.log(`Adding ${companyIds.length} companies to list ${listId}...`);

  // Try bulk API first
  const BATCH_SIZE = 50;
  let apiWorked = false;

  for (let i = 0; i < companyIds.length; i += BATCH_SIZE) {
    const batch = companyIds.slice(i, i + BATCH_SIZE);

    const addRes = await page.evaluate(
      async ({ lid, ids, csrf }) => {
        const r = await fetch(`/sales-api/salesApiLists/${lid}/listMembers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'csrf-token': csrf,
            'x-restli-protocol-version': '2.0.0',
            'x-requested-with': 'XMLHttpRequest',
          },
          credentials: 'include',
          body: JSON.stringify({
            elements: ids.map((id) => ({ type: 'ACCOUNT', account: { id: String(id) } })),
          }),
        });
        return { status: r.status, body: await r.text() };
      },
      { lid: listId, ids: batch, csrf: csrfToken }
    );

    console.log(`Batch ${Math.ceil((i + 1) / BATCH_SIZE)} API response:`, addRes.status);

    if (addRes.status >= 200 && addRes.status < 300) {
      apiWorked = true;
    } else if (i === 0) {
      // API failed on first batch — fall back to UI per-company
      console.warn('Bulk API failed, switching to per-company UI automation');
      break;
    }

    if (i + BATCH_SIZE < companyIds.length) {
      await page.waitForTimeout(1500);
    }
  }

  // ── 5. Fallback: add companies one-by-one via UI ───────────────────────────
  if (!apiWorked) {
    console.log('Adding companies via UI (one by one)...');
    let added = 0;

    for (const companyId of companyIds) {
      try {
        await page.goto(`https://www.linkedin.com/sales/company/${companyId}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        await page.waitForTimeout(2000);

        // Open "Save to list" menu
        const saveBtn = page.locator('[data-control-name*="save"], button:has-text("Save"), [aria-label*="Save to list"]').first();
        await saveBtn.click({ timeout: 5000 });
        await page.waitForTimeout(1000);

        // Select our list from dropdown
        const listOption = page.locator(`[data-id="${listId}"], li:has-text("${listName}")`).first();
        await listOption.click({ timeout: 5000 });
        await page.waitForTimeout(1000);

        added++;
        console.log(`Added company ${companyId} (${added}/${companyIds.length})`);
        await page.waitForTimeout(3000 + Math.random() * 2000);
      } catch (err) {
        console.warn(`Could not add company ${companyId}: ${err.message}`);
      }
    }

    console.log(`Added ${added} companies via UI`);
  }

  // ── 6. Output ───────────────────────────────────────────────────────────────
  const result = { listId, listName, companiesCount: companyIds.length };
  console.log('Done:', result);
  await Actor.pushData(result);

  await browser.close();
});
