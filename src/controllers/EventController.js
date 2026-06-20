const db = require('../core/database');

class EventController {
    async show(req, res) {
        try {
            const [events] = await db.query('SELECT * FROM events WHERE id = ? LIMIT 1', [req.params.id]);
            if (events.length === 0) {
                return res.status(404).send('Sự kiện không tồn tại');
            }
            
            res.render('events/show', {
                title: events[0].title,
                event: events[0]
            });
        } catch (error) {
            console.error("Event show error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new EventController();
