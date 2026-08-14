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

            const currentUser = req.user || req.session?.user || null;

            res.render('chat/index', {
                title: 'Trò chuyện cùng Bình Lợi',
                dest: dest,
                user: currentUser
            });
        } catch (error) {
            console.error("Chat index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new ChatController();
