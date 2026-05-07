const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');

class JourneyController {
    async index(req, res) {
        try {
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            // --- STRATEGY REQUIREMENT: Authentication check ---
            if (!req.session.user) {
                return res.redirect('/auth/login?error=Vui lòng đăng nhập để bắt đầu hành trình của bạn');
            }

            const session = await UserSession.findByUuid(uuid);
            if (!session || !session.mood) return res.redirect('/onboarding');

            const journey = await Journey.getActiveBySession(session.id);
            let journeyWithStops;

            if (!journey && session.mood) {
                const interests = session.interests ? JSON.parse(session.interests) : [];
                journeyWithStops = await Journey.createPersonalized(
                    session.id,
                    session.mood,
                    session.duration || 'morning',
                    interests
                );
            } else if (journey) {
                journeyWithStops = await Journey.getWithStops(journey.id);
            } else {
                return res.redirect('/onboarding');
            }

            // Determine current season
            const month = new Date().getMonth() + 1;
            let seasonName = 'Miệt vườn giữa Phố';
            if (month >= 11 || month <= 3) seasonName = 'Du xuân Bình Lợi';
            else if (month >= 7 && month <= 10) seasonName = 'Lễ hội mùa Thu';

            res.render('journey/story_mode', {
                title: 'Hành trình của tôi',
                journey: journeyWithStops,
                seasonName: seasonName
            });
        } catch (error) {
            console.error("Journey index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    /** Show suggestions after onboarding */
    async suggestions(req, res) {
        try {
            const uuid = req.cookies.session_uuid;
            const session = await UserSession.findByUuid(uuid);
            if (!session || !session.mood) return res.redirect('/onboarding');

            const mood = session.mood;
            const duration = session.duration || '1d';
            
            // Mocking 3 suggestion options based on mood
            const suggestions = [
                {
                    id: 'opt1',
                    name: 'Hành trình "Sâu sắc bản địa"',
                    desc: 'Tập trung vào các làng nghề truyền thống và trải nghiệm văn hóa địa phương đặc sắc nhất.',
                    tags: ['Văn hóa', 'Làng nghề'],
                    duration: '4-5 tiếng',
                    km: 12,
                    stops: await Journey.getRandomStops(mood, 3)
                },
                {
                    id: 'opt2',
                    name: 'Hành trình "Chữa lành sinh thái"',
                    desc: 'Sự kết hợp hoàn hảo giữa không gian xanh của vườn lan và sự tĩnh lặng của các ngôi chùa cổ.',
                    tags: ['Sinh thái', 'Tâm linh'],
                    duration: '6 tiếng',
                    km: 15,
                    stops: await Journey.getRandomStops('peace', 4)
                },
                {
                    id: 'opt3',
                    name: 'Hành trình "Khám phá trọn vẹn"',
                    desc: 'Dành cho những ai muốn đi hết các điểm nổi bật của Bình Lợi chỉ trong một ngày.',
                    tags: ['Tổng hợp', 'Gia đình'],
                    duration: '8 tiếng',
                    km: 22,
                    stops: await Journey.getRandomStops('all', 5)
                }
            ];

            res.render('journey/suggestions', {
                title: 'Đề xuất hành trình',
                suggestions: suggestions
            });
        } catch (error) {
            console.error("Suggestions error:", error);
            res.redirect('/onboarding');
        }
    }

    /** Confirm chosen suggestion */
    async confirm(req, res) {
        try {
            const { journeyData } = req.body;
            const data = JSON.parse(journeyData);
            const uuid = req.cookies.session_uuid;
            const session = await UserSession.findByUuid(uuid);
            
            if (!session) return res.redirect('/onboarding');

            // Create the real journey in DB from the suggestion
            await Journey.createFromSuggestion(session.id, data);
            
            res.redirect('/hanh-trinh-cua-toi');
        } catch (error) {
            console.error("Confirm error:", error);
            res.redirect('/onboarding');
        }
    }

    /** Create preset journey */
    async preset(req, res) {
        // ... existing preset logic
    }
}

module.exports = new JourneyController();
