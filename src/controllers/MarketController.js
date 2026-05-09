const Destination = require('../models/Destination');

class MarketController {
    async index(req, res) {
        try {
            // Mock OCOP products
            const products = [
                { id: 1, name: 'Mai Vàng Bình Lợi (Chậu)', price: 1500000, image: '/images/product-mai.jpg', rating: 4.8, sold: 120 },
                { id: 2, name: 'Trà Sen Tháp Mười', price: 120000, image: '/images/product-tra.jpg', rating: 4.9, sold: 450 },
                { id: 3, name: 'Mật Ong Hoa Nhãn', price: 250000, image: '/images/product-matong.jpg', rating: 4.7, sold: 89 },
                { id: 4, name: 'Bánh Tráng Thủ Công', price: 35000, image: '/images/product-banhtrang.jpg', rating: 4.6, sold: 1200 },
            ];

            res.render('market/index', {
                title: 'Chợ OCOP Bình Lợi',
                products: products
            });
        } catch (error) {
            console.error("Market index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new MarketController();
