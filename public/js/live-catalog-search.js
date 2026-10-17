/*
 * Progressive enhancement for the public catalogues. Forms remain ordinary
 * GET searches when JavaScript is unavailable, while typing refreshes only
 * the catalogue result region after a short debounce.
 */
(() => {
    const form = document.querySelector('[data-live-catalog-search]');
    if (!form || !window.fetch || !window.DOMParser) return;

    const input = form.querySelector('input[name="q"]');
    if (!input) return;

    let timer;
    let controller;

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

    const refreshResults = async () => {
        const url = createUrl();
        const resultRegion = document.querySelector('[data-catalog-results]');
        if (!resultRegion) return;

        if (controller) controller.abort();
        const requestController = new AbortController();
        controller = requestController;
        input.setAttribute('aria-busy', 'true');

        try {
            const response = await fetch(url, {
                credentials: 'same-origin',
                cache: 'no-store',
                signal: requestController.signal,
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (!response.ok) throw new Error(`Catalogue request failed: ${response.status}`);

            const documentResponse = new DOMParser().parseFromString(await response.text(), 'text/html');
            const nextRegion = documentResponse.querySelector('[data-catalog-results]');
            if (!nextRegion) throw new Error('Catalogue response did not contain a result region');

            resultRegion.replaceWith(nextRegion);
            window.history.replaceState({}, '', `${url.pathname}${url.search}`);
        } catch (error) {
            // Superseded requests are an expected part of type-ahead search.
            if (error.name !== 'AbortError') console.warn('Live catalogue search failed; submit the form to retry.', error);
        } finally {
            if (controller === requestController) input.removeAttribute('aria-busy');
        }
    };

    input.addEventListener('input', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(refreshResults, 300);
    });
    form.addEventListener('submit', () => window.clearTimeout(timer));
})();
