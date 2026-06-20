const db = require('../core/database');

class Workshop {
    static async getAll(limit = 20) {
        const [rows] = await db.query(`
            SELECT w.*, d.name as destination_name, d.slug as destination_slug
            FROM workshops w
            LEFT JOIN destinations d ON w.destination_id = d.id
            WHERE w.is_active = TRUE
            ORDER BY w.sort_order ASC, w.created_at DESC
            LIMIT ?
        `, [limit]);
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.query(`
            SELECT w.*, d.name as destination_name, d.slug as destination_slug, d.lat, d.lng
            FROM workshops w
            LEFT JOIN destinations d ON w.destination_id = d.id
            WHERE w.id = ?
        `, [id]);
        return rows[0];
    }

    static async getByType(type) {
        const [rows] = await db.query(`
            SELECT w.*, d.name as destination_name
            FROM workshops w
            LEFT JOIN destinations d ON w.destination_id = d.id
            WHERE w.type = ? AND w.is_active = TRUE
            ORDER BY w.sort_order ASC
        `, [type]);
        return rows;
    }

    static async getByDestination(destinationId) {
        const [rows] = await db.query(`
            SELECT * FROM workshops WHERE destination_id = ? AND is_active = TRUE
        `, [destinationId]);
        return rows;
    }

    static async getBookings(workshopId, date = null) {
        let query = 'SELECT * FROM workshop_bookings WHERE workshop_id = ?';
        const params = [workshopId];
        if (date) {
            query += ' AND booking_date = ?';
            params.push(date);
        }
        query += ' ORDER BY created_at DESC';
        const [rows] = await db.query(query, params);
        return rows;
    }

    static async getBookedParticipants(workshopId, date) {
        const [rows] = await db.query(
            "SELECT SUM(num_people) as total FROM workshop_bookings WHERE workshop_id = ? AND booking_date = ? AND status != 'cancelled'",
            [workshopId, date]
        );
        return parseInt(rows[0]?.total || 0, 10);
    }

    static async getBookingsByUser(userId) {
        const [rows] = await db.query(`
            SELECT wb.*, w.title as workshop_title, w.image as workshop_image, w.type as workshop_type,
                   d.name as destination_name
            FROM workshop_bookings wb
            JOIN workshops w ON wb.workshop_id = w.id
            LEFT JOIN destinations d ON w.destination_id = d.id
            WHERE wb.user_id = ?
            ORDER BY wb.booking_date DESC
        `, [userId]);
        return rows;
    }

    static async createBooking(data) {
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        const qrTicket = `BLH-WS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        await db.query(`
            INSERT INTO workshop_bookings (id, workshop_id, user_id, booking_date, booking_time, num_people, total_price, qr_ticket, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, data.workshop_id, data.user_id, data.booking_date, data.booking_time, data.num_people, data.total_price, qrTicket, data.note || null]);
        
        return { id, qr_ticket: qrTicket };
    }

    static async addReview(bookingId, rating, review) {
        await db.query(
            'UPDATE workshop_bookings SET rating = ?, review = ?, status = "completed" WHERE id = ?',
            [rating, review, bookingId]
        );
    }

    static async getStats(workshopId) {
        const [rows] = await db.query(`
            SELECT 
                COUNT(*) as total_bookings,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                AVG(rating) as avg_rating,
                SUM(num_people) as total_participants
            FROM workshop_bookings WHERE workshop_id = ?
        `, [workshopId]);
        return rows[0];
    }
}

module.exports = Workshop;
