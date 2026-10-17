/*
 * Progressive enhancement for the public catalogues. Forms remain ordinary
 * GET searches when JavaScript is unavailable, while typing submits the same
 * server-side search after a short debounce.  Keeping one rendering path
 * avoids a partial-DOM race that could leave the card region blank.
 */
(() => {
  const form = document.querySelector('[data-live-catalog-search]');
  if (!form) return;

  const input = form.querySelector('input[name="q"]');
  if (!input) return;

  let timer;
  const createUrl = () => {
    const url = new URL(form.action, window.location.origin);
    const data = new FormData(form);
    for (const [key, value] of data.entries()) {
      const normalized = String(value || '').trim();
      if (normalized) url.searchParams.set(key, normalized);
    }
    // A changed query always starts from the first catalogue page.
    url.searchParams.delete('page');
    return url;
  };

  const refreshResults = () => {
    const url = createUrl();
    const destination = `${url.pathname}${url.search}`;
    const currentLocation = `${window.location.pathname}${window.location.search}`;

    if (destination === currentLocation) {
      input.removeAttribute('aria-busy');
      return;
    }

    input.setAttribute('aria-busy', 'true');
    window.location.assign(destination);
  };

  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refreshResults, 300);
  });
  form.addEventListener('submit', () => window.clearTimeout(timer));
})();
