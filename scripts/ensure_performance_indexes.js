/* Creates only indexes proven to match the current aggregate queries. */
const db = require('../src/core/database');

const statements = [
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_page_view_created_at_idx
     ON analytics (created_at DESC)
     WHERE event = 'page_view' OR event IS NULL`,
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS analytics_session_start_created_session_idx
     ON analytics (created_at DESC, session_id)
     WHERE event = 'session_start'`
];

async function main() {
    for (const statement of statements) {
        await db.pgPool.query(statement);
    }
    const explain = await db.pgPool.query(
        "EXPLAIN (FORMAT TEXT) SELECT COUNT(*) FROM analytics WHERE event = 'page_view' OR event IS NULL"
    );
    console.log(explain.rows.map(row => row['QUERY PLAN']).join('\n'));
}

main()
    .catch(error => {
        console.error('Performance index migration failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.pgPool.end().catch(() => {});
    });
