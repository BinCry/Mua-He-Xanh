class FestivalController {
    async index(req, res) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            
            const festivals = [
                {
                    id: 1,
                    name: 'Hội Hoa Mai Vàng ' + year,
                    date: 'Dự kiến: Tháng 01/' + (year + 1),
                    status: 'Sắp diễn ra',
                    image: '/images/vuon-mai-1.png',
                    desc: 'Lễ hội quy mô lớn nhất miền Tây với hàng nghìn gốc mai khoe sắc rực rỡ.'
                },
                {
                    id: 2,
                    name: 'Ngày Hội Sông Nước Bình Lợi',
                    date: 'Chủ Nhật, Tuần 2 Tháng 05/' + year,
                    status: 'Đang chuẩn bị',
                    image: '/images/cau-chu-z-1.png',
                    desc: 'Đua thuyền truyền thống và lễ hội trái cây miệt vườn đặc sản.'
                },
                {
                    id: 3,
                    name: 'Đêm Hội Hoa Đăng Bình Lợi',
                    date: 'Rằm tháng 08 Âm Lịch',
                    status: 'Lên kế hoạch',
                    image: '/images/chua-phap-tang-1.png',
                    desc: 'Thả hoa đăng cầu bình an và các hoạt động nghệ thuật dân gian đặc sắc.'
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
