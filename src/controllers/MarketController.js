const Destination = require('../models/Destination');

class MarketController {
    async index(req, res) {
        try {
            // Mock OCOP products
            const products = [
                { id: 1, name: 'Mai Vàng Bình Lợi (Bonsai)', price: 2500000, image: '/images/product-mai.png', rating: 4.8, sold: 156 },
                { id: 2, name: 'Nhang Thảo Mộc Bình Lợi', price: 45000, image: '/images/product-incense.png', rating: 4.9, sold: 1204 },
                { id: 3, name: 'Mật Ong Hoa Tràm Tự Nhiên', price: 350000, image: '/images/product-honey.png', rating: 4.7, sold: 432 },
                { id: 4, name: 'Bưởi Da Xanh Loại 1', price: 65000, image: '/images/product-grapefruit.png', rating: 4.6, sold: 867 },
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
