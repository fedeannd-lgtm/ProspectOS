// ProspectOS — fetch/XHR interceptor, runs in MAIN world at document_start
(function () {
  console.log('[ProspectOS interceptor] loaded on', window.location.pathname);

  function extractWebsite(data) {
    if (!data || typeof data !== 'object') return '';
    const urlFields = ['website', 'companyUrl', 'websiteUrl', 'homepageUrl', 'companyWebsite', 'siteUrl'];
    const domainFields = ['primaryDomain', 'domain', 'url'];
    const allFields = [...urlFields, ...domainFields];

    function valueToUrl(f, v) {
      if (!v || typeof v !== 'string') return '';
      if (v.startsWith('http')) return v;
      // domain-only fields: wrap with https
      if (domainFields.includes(f) && /^[\w.-]+\.[a-z]{2,}/.test(v)) return `https://${v}`;
      return '';
    }

    for (const f of allFields) {
      const url = valueToUrl(f, data[f]);
      if (url) return url;
    }
    // One level deep
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const f of allFields) {
          const url = valueToUrl(f, val[f]);
          if (url) return url;
        }
      }
    }
    return '';
  }

  function tryCapture(url, data) {
    const isSalesApi = url.includes('/sales-api/') || url.includes('/voyager/api/');
    if (!isSalesApi) return;
    if (!data || typeof data !== 'object') return;

    // Log ALL sales-api responses on company profile pages so we can see the fields
    if (window.location.pathname.includes('/sales/company/')) {
      console.log('[ProspectOS interceptor] sales-api response for', url.split('?')[0], JSON.stringify(data).slice(0, 500));
    }

    function capture(obj) {
      if (!obj || typeof obj !== 'object') return;
      const website = extractWebsite(obj);
      const rawId = obj.id || obj.companyId || obj.entityUrn || '';
      // Extract numeric ID from URN like "urn:li:fs_salesCompany:40847945"
      const numMatch = String(rawId).match(/(\d+)$/);
      const id = numMatch ? numMatch[1] : String(rawId);
      if (id && website) {
        console.log('[ProspectOS interceptor] captured:', id, '→', website);
        sessionStorage.setItem(`__pos_w_${id}`, website);
      }
    }

    capture(data);
    const elements = Array.isArray(data) ? data : (data.elements || data.results || data.items || []);
    elements.forEach(el => capture(el));
  }

  // Patch fetch
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    try {
      response.clone().json().then(data => tryCapture(url, data)).catch(() => {});
    } catch (e) {}
    return response;
  };

  // Patch XHR
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._posUrl = typeof url === 'string' ? url : '';
    return origOpen.apply(this, [method, url, ...rest]);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    const url = this._posUrl || '';
    if (url.includes('/sales-api/') || url.includes('/voyager/api/')) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          tryCapture(this._posUrl, data);
        } catch (e) {}
      });
    }
    return origSend.apply(this, args);
  };
})();
