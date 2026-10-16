const { EventEmitter } = require('events');

// PostgreSQL remains the source of truth. This process-local fan-out only
// informs open pages that they should display the committed counters now.
const events = new EventEmitter();
events.setMaxListeners(0);

function normalize(payload) {
    return {
        reviewId: String(payload.reviewId || ''),
        likes: Math.max(0, Number.parseInt(payload.likes, 10) || 0),
        comments: Math.max(0, Number.parseInt(payload.comments, 10) || 0)
    };
}

function publish(payload) {
    const change = normalize(payload);
    if (change.reviewId) events.emit('change', change);
}

function subscribe(res) {
    const send = (message) => {
        if (res.writableEnded || res.destroyed) return;
        res.write(message);
        if (typeof res.flush === 'function') res.flush();
    };
    const listener = (change) => send(`event: engagement\ndata: ${JSON.stringify(change)}\n\n`);
    const heartbeat = setInterval(() => send(': keep-alive\n\n'), 25000);
    events.on('change', listener);
    return () => {
        clearInterval(heartbeat);
        events.off('change', listener);
    };
}

module.exports = { publish, subscribe };
