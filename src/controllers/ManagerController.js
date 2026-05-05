const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const UserSession = require('../models/UserSession');

class ManagerController {
    async index(req, res) {
        try {
            const user = req.session.user;
            let destId = user.managed_destination_id;
            
            // Admin can override destId via query
            if (user.role === 'admin' && req.query.dest_id) {
                destId = req.query.dest_id;
            }

            if (!destId) {
                if (user.role === 'admin') {
                    const allDests = await Destination.findAll();
                    return res.render('manager/admin_list', { title: 'Quản trị hệ thống', allDests });
                }
                return res.redirect('/auth/login?error=Bạn không có quyền quản lý địa điểm nào');
            }

            const dest = await Destination.findById(destId);
            if (!dest) return res.status(404).send("Địa điểm không tồn tại");

            // Get stats
            const [checkinStats] = await UserSession.db.query(
                "SELECT COUNT(*) as total FROM check_ins WHERE destination_id = ?",
                [dest.id]
            );

            // Get recent messages
            const [messages] = await UserSession.db.query(
                `SELECT m.*, s.uuid as sender_uuid 
                 FROM messages m 
                 LEFT JOIN user_sessions s ON m.sender_id = s.id 
                 WHERE m.destination_id = ? 
                 ORDER BY m.created_at DESC LIMIT 10`,
                [dest.id]
            );

            res.render('manager/index', {
                title: 'Quản lý: ' + dest.name,
                dest,
                stats: {
                    checkins: checkinStats[0].total
                },
                messages
            });
        } catch (error) {
            console.error("Manager index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    async updateDestination(req, res) {
        try {
            const user = req.session.user;
            const { story, open_hours, cost } = req.body;
            
            await Destination.update(user.managed_destination_id, {
                story,
                open_hours,
                cost
            });

            res.redirect('/manager?success=Đã cập nhật thông tin địa điểm');
        } catch (error) {
            res.redirect('/manager?error=' + error.message);
        }
    }
}

module.exports = new ManagerController();
