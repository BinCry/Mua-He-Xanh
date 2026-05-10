const Festival = require('../models/Festival');

class FestivalController {
    async index(req, res) {
        try {
            const festivals = await Festival.findAll();
            res.render('festivals/index', {
                title: 'Lễ hội & Sự kiện Bình Lợi',
                festivals: festivals
            });
        } catch (error) {
            console.error("Festival index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    async book(req, res) {
        try {
            const { festivalId, fullName, phone, tickets } = req.body;
            const user = req.user || req.session.user;
            
            // Logic to save booking
            await Festival.createBooking({
                id: require('uuid').v4(),
                user_id: user ? user.id : null,
                festival_id: festivalId,
                full_name: fullName,
                phone: phone,
                tickets: tickets,
                status: 'confirmed'
            });

            res.json({ success: true, message: 'Đăng ký thành công! Vé điện tử đã được gửi vào Passport của bạn.' });
        } catch (error) {
            console.error("Booking error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new FestivalController();
