const UserSession = require('../models/UserSession');
const Destination = require('../models/Destination');

class ChatController {
    async index(req, res) {
        try {
            const { destinationId } = req.query;
            let dest = null;
            if (destinationId) {
                dest = await Destination.findById(destinationId);
            }

            res.render('chat/index', {
                title: 'Trò chuyện cùng Bình Lợi',
                dest: dest,
                user: req.user
            });
        } catch (error) {
            console.error("Chat index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new ChatController();
