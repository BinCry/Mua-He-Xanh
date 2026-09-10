const fs = require('fs');
const path = require('path');
const db = require('../src/core/database');

async function exportAllData() {
    console.log('--- BẮT ĐẦU XUẤT TOÀN BỘ SỐ LIỆU JSON & CSV ---');
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }

    try {
        // 1. Row counts
        const tables = [
            'users', 'destinations', 'reviews', 'review_comments', 'check_ins',
            'journeys', 'journey_stops', 'analytics', 'user_sessions', 'workshops',
            'workshop_bookings', 'festivals', 'festival_bookings', 'rewards',
            'soundscapes', 'messages', 'video_templates', 'studio_projects', 'hero_posters'
        ];

        const rowCounts = {};
        for (const tbl of tables) {
            try {
                const [res] = await db.query(`SELECT COUNT(*) as cnt FROM ${tbl}`);
                rowCounts[tbl] = parseInt(res[0]?.cnt || 0, 10);
            } catch (e) {
                rowCounts[tbl] = 0;
            }
        }

        // 2. Users
        const [usersRole] = await db.query('SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC');
        const [allUsers] = await db.query(`
            SELECT id, email, full_name, phone, role, total_points, avatar, created_at
            FROM users 
            ORDER BY created_at DESC
        `);

        // 3. Analytics
        const [analyticsEvents] = await db.query('SELECT event, COUNT(*) as count FROM analytics GROUP BY event ORDER BY count DESC');
        const [dailyAnalytics] = await db.query(`
            SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as day, COUNT(*) as total_events,
                   COUNT(DISTINCT session_id) as unique_sessions,
                   COUNT(DISTINCT ip_address) as unique_ips
            FROM analytics 
            GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
            ORDER BY day DESC
            LIMIT 45
        `);
        const [topPages] = await db.query(`
            SELECT page_url, COUNT(*) as views 
            FROM analytics 
            WHERE page_url IS NOT NULL 
              AND page_url NOT LIKE '/@%' 
              AND page_url NOT LIKE '%bak%' 
              AND page_url NOT LIKE '%.env%'
              AND page_url NOT LIKE '%terraform%'
            GROUP BY page_url 
            ORDER BY views DESC 
            LIMIT 30
        `);

        // 4. Destinations
        const [destinations] = await db.query(`
            SELECT d.id, d.name, d.slug, d.type, d.cost, d.open_hours, d.points, d.is_active,
                   COUNT(DISTINCT c.id) as checkin_count,
                   COUNT(DISTINCT r.id) as review_count,
                   AVG(r.rating) as avg_rating
            FROM destinations d
            LEFT JOIN check_ins c ON c.destination_id = d.id
            LEFT JOIN reviews r ON r.destination_id = d.id
            GROUP BY d.id, d.name, d.slug, d.type, d.cost, d.open_hours, d.points, d.is_active
            ORDER BY checkin_count DESC, d.name ASC
        `);

        // 5. Reviews
        const [allReviews] = await db.query(`
            SELECT r.id, r.user_id, u.full_name as author_name, u.email as author_email,
                   d.name as destination_name, r.rating, r.content,
                   r.likes_count, r.comments_count, r.created_at
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN destinations d ON r.destination_id = d.id
            ORDER BY r.created_at DESC
        `);

        // 6. Check-ins
        const [allCheckins] = await db.query(`
            SELECT c.id, c.session_id, u.full_name as user_name, d.name as destination_name,
                   c.checkin_method, c.distance_meter, c.points_earned, c.created_at
            FROM check_ins c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN destinations d ON c.destination_id = d.id
            ORDER BY c.created_at DESC
            LIMIT 250
        `);

        // 7. Journeys
        const [allJourneys] = await db.query(`
            SELECT id, session_id, mood, duration, interests, total_km, total_minutes, status, created_at
            FROM journeys
            ORDER BY created_at DESC
            LIMIT 200
        `);

        // 8. Workshops
        const [allWorkshops] = await db.query(`
            SELECT w.id, w.title, d.name as dest_name, w.type, w.price, w.duration,
                   w.max_participants, w.is_active, COUNT(b.id) as total_bookings
            FROM workshops w
            LEFT JOIN destinations d ON w.destination_id = d.id
            LEFT JOIN workshop_bookings b ON b.workshop_id = w.id
            GROUP BY w.id, w.title, d.name, w.type, w.price, w.duration, w.max_participants, w.is_active
            ORDER BY total_bookings DESC, w.title ASC
        `);

        // 9. Studio Templates
        const [studioTemplates] = await db.query(`
            SELECT id, template_id, title, category, badge, aspect_ratio, duration, slots_count, audio_title, is_published
            FROM video_templates
            ORDER BY id ASC
        `);

        // Summary JSON
        const summary = {
            export_time: new Date().toISOString(),
            website_name: 'Bình Lợi Healing - Du Lịch Sinh Thái Nông Nghiệp & Chữa Lành',
            database_engine: 'PostgreSQL (Supabase)',
            row_counts: rowCounts,
            traffic_kpi: {
                total_analytics_records: rowCounts.analytics,
                total_user_sessions: rowCounts.user_sessions,
                events_breakdown: analyticsEvents,
                daily_last_45_days: dailyAnalytics,
                top_pages: topPages
            },
            users_kpi: {
                total_users: rowCounts.users,
                by_role: usersRole
            },
            destinations_kpi: {
                total_destinations: rowCounts.destinations,
                destinations: destinations
            },
            reviews_community_kpi: {
                total_reviews: rowCounts.reviews,
                total_comments: rowCounts.review_comments,
                reviews: allReviews
            },
            checkins_kpi: {
                total_checkins: rowCounts.check_ins,
                checkins: allCheckins
            },
            journeys_kpi: {
                total_journeys: rowCounts.journeys,
                journeys: allJourneys
            },
            workshops_kpi: {
                total_workshops: rowCounts.workshops,
                total_bookings: rowCounts.workshop_bookings,
                workshops: allWorkshops
            },
            studio_kpi: {
                total_templates: rowCounts.video_templates,
                templates: studioTemplates
            }
        };

        fs.writeFileSync(path.join(exportDir, 'website_summary_kpi.json'), JSON.stringify(summary, null, 2), 'utf8');
        fs.writeFileSync(path.join(exportDir, 'destinations.json'), JSON.stringify(destinations, null, 2), 'utf8');
        fs.writeFileSync(path.join(exportDir, 'reviews.json'), JSON.stringify(allReviews, null, 2), 'utf8');
        fs.writeFileSync(path.join(exportDir, 'analytics_daily.json'), JSON.stringify(dailyAnalytics, null, 2), 'utf8');
        fs.writeFileSync(path.join(exportDir, 'workshops.json'), JSON.stringify(allWorkshops, null, 2), 'utf8');
        fs.writeFileSync(path.join(exportDir, 'studio_templates.json'), JSON.stringify(studioTemplates, null, 2), 'utf8');
        fs.writeFileSync(path.join(exportDir, 'users.json'), JSON.stringify(allUsers, null, 2), 'utf8');

        // CSVs
        const destHeaders = ['id', 'name', 'slug', 'type', 'cost', 'points', 'checkin_count', 'review_count', 'avg_rating'];
        const destCsv = [
            destHeaders.join(','),
            ...destinations.map(d => [
                d.id,
                `"${(d.name || '').replace(/"/g, '""')}"`,
                `"${d.slug || ''}"`,
                `"${d.type || ''}"`,
                `"${(d.cost || '').replace(/"/g, '""')}"`,
                d.points || 0,
                d.checkin_count || 0,
                d.review_count || 0,
                d.avg_rating ? parseFloat(d.avg_rating).toFixed(1) : 'N/A'
            ].join(','))
        ].join('\n');
        fs.writeFileSync(path.join(exportDir, 'destinations.csv'), destCsv, 'utf8');

        const dailyHeaders = ['day', 'total_events', 'unique_sessions', 'unique_ips'];
        const dailyCsv = [
            dailyHeaders.join(','),
            ...dailyAnalytics.map(r => [
                r.day,
                r.total_events,
                r.unique_sessions,
                r.unique_ips
            ].join(','))
        ].join('\n');
        fs.writeFileSync(path.join(exportDir, 'analytics_daily.csv'), dailyCsv, 'utf8');

        // Copy all to public/exports for direct HTTP downloads
        const publicExports = path.join(__dirname, '../public/exports');
        if (!fs.existsSync(publicExports)) {
            fs.mkdirSync(publicExports, { recursive: true });
        }
        ['website_summary_kpi.json', 'destinations.json', 'reviews.json', 'analytics_daily.json', 'workshops.json', 'studio_templates.json', 'users.json', 'destinations.csv', 'analytics_daily.csv'].forEach(f => {
            fs.copyFileSync(path.join(exportDir, f), path.join(publicExports, f));
        });

        console.log('✅ Đã xuất thành công toàn bộ JSON & CSV vào cả /exports và /public/exports!');
        process.exit(0);
    } catch (e) {
        console.error('Lỗi xuất file:', e);
        process.exit(1);
    }
}

exportAllData();
