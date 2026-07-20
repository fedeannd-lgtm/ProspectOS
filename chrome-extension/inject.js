// Injects interceptor.js into the page's MAIN world before LinkedIn's JS runs
function injectInterceptor() {
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('interceptor.js');
  const parent = document.head || document.documentElement;
  if (parent) {
    parent.insertBefore(s, parent.firstChild);
  }
}

if (document.documentElement) {
  injectInterceptor();
} else {
  document.addEventListener('DOMContentLoaded', injectInterceptor, { once: true });
}
