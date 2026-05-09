class FestivalController {
    async index(req, res) {
        try {
            // Mock Festival Data
            const festivals = [
                {
                    id: 1,
                    name: 'Hội Hoa Mai Vàng 2026',
                    date: '15/01 - 25/01/2026',
                    status: 'Upcoming',
                    image: '/images/fest-mai.jpg',
                    desc: 'Lễ hội quy mô lớn nhất miền Tây với hơn 100,000 gốc mai khoe sắc.'
                },
                {
                    id: 2,
                    name: 'Ngày Hội Sông Nước Bình Lợi',
                    date: '10/05/2026',
                    status: 'Planned',
                    image: '/images/fest-river.jpg',
                    desc: 'Đua thuyền truyền thống và lễ hội trái cây miệt vườn.'
                },
                {
                    id: 3,
                    name: 'Đêm Hội Hoa Đăng Bình Lợi',
                    date: '15/08/2026',
                    status: 'Planned',
                    image: '/images/fest-lantern.jpg',
                    desc: 'Thả hoa đăng cầu bình an và các hoạt động nghệ thuật dân gian.'
                }
            ];

            res.render('festivals/index', {
                title: 'Lễ hội & Sự kiện',
                festivals: festivals
            });
        } catch (error) {
            console.error("Festival index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new FestivalController();
