/* Shared live counters for Community cards on the home page and /reviews. */
(function () {
    var lastErrorRefreshAt = 0;
    var streamReady = false;
    function validId(value) {
        return /^[a-zA-Z0-9-]{1,100}$/.test(String(value || ''));
    }

    function apply(change) {
        if (!change || !validId(change.reviewId)) return;
        document.querySelectorAll('[data-review-id]').forEach(function (card) {
            if (card.dataset.reviewId !== String(change.reviewId)) return;
            card.querySelectorAll('[data-engagement-count="likes"]').forEach(function (node) {
                node.textContent = String(Math.max(0, Number.parseInt(change.likes, 10) || 0));
            });
            card.querySelectorAll('[data-engagement-count="comments"]').forEach(function (node) {
                node.textContent = String(Math.max(0, Number.parseInt(change.comments, 10) || 0));
            });
        });
    }

    function ids() {
        return [...new Set([...document.querySelectorAll('[data-review-id]')]
            .map(function (card) { return card.dataset.reviewId; })
            .filter(validId))];
    }

    async function refresh() {
        var reviewIds = ids();
        if (!reviewIds.length) return;
        try {
            var response = await fetch('/api/reviews/engagement?ids=' + encodeURIComponent(reviewIds.join(',')), {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            var payload = await response.json();
            if (response.ok && payload.success && Array.isArray(payload.data)) payload.data.forEach(apply);
        } catch (_) {
            // Server-sent events reconnect automatically; retain the last
            // committed values when a temporary network failure occurs.
        }
    }

    function connect() {
        if (!ids().length || !window.EventSource) return;
        var stream = new EventSource('/api/reviews/engagement/stream');
        stream.addEventListener('open', function () {
            streamReady = true;
        });
        stream.addEventListener('engagement', function (event) {
            try { apply(JSON.parse(event.data)); } catch (_) { /* ignore malformed event */ }
        });
        stream.addEventListener('error', function () {
            streamReady = false;
            // EventSource handles reconnect. Refresh prevents a missed event
            // from leaving a restored tab stale.
            if (Date.now() - lastErrorRefreshAt < 5000) return;
            lastErrorRefreshAt = Date.now();
            void refresh();
        });
    }

    window.BinhLoiCommunityEngagement = {
        apply: apply,
        refresh: refresh,
        isLive: function () { return streamReady; }
    };
    connect();
    void refresh();
    window.addEventListener('pageshow', function () { void refresh(); });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) void refresh();
    });
})();
