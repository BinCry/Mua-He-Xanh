const Product = require('../models/Product');

class MarketController {
    async index(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 8;
            const category = req.query.category || null;

            // Get products from DB
            const products = await Product.findAllActive(category);
            const categories = await Product.getCategories();

            res.render('market/index', {
                title: 'Chợ OCOP Bình Lợi',
                products: products,
                categories: categories,
                selectedCategory: category
            });
        } catch (error) {
            console.error("Market index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    async detail(req, res) {
        try {
            const { id } = req.params;
            const product = await Product.findById(id);
            if (!product) return res.redirect('/market');

            res.render('market/detail', {
                title: product.name,
                product: product
            });
        } catch (error) {
            console.error("Market detail error:", error);
            res.redirect('/market');
        }
    }
}

module.exports = new MarketController();
