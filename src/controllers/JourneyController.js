const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');
const Destination = require('../models/Destination');

class JourneyController {
    async index(req, res) {
        try {
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            if (!req.session.user) {
                return res.redirect('/auth/login?error=Vui lòng đăng nhập để xem hành trình của bạn');
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
                    session.duration || '1d',
                    interests
                );
            } else if (journey) {
                journeyWithStops = await Journey.getWithStops(journey.id);
            } else {
                return res.redirect('/onboarding');
            }

            const month = new Date().getMonth() + 1;
            let seasonName = 'Miệt vườn giữa Phố';
            if (month >= 11 || month <= 3) seasonName = 'Du xuân Bình Lợi';
            
            const allDestinations = await Destination.getActive();
            
            res.render('journey/story_mode', {
                title: 'Hành trình của tôi',
                journey: journeyWithStops,
                seasonName: seasonName,
                allDestinations: allDestinations
            });
        } catch (error) {
            console.error("Journey index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    async suggestions(req, res) {
        try {
            const uuid = req.cookies.session_uuid;
            const session = await UserSession.findByUuid(uuid);
            if (!session || !session.mood) return res.redirect('/onboarding');

            const mood = session.mood || 'all';
            const suggestions = [
                {
                    id: 'opt1',
                    name: 'Hành trình "Khám phá bản địa"',
                    desc: 'Tập trung vào các làng nghề truyền thống và văn hóa đặc trưng.',
                    tags: ['Văn hóa', 'Làng nghề'],
                    duration: '4-5 tiếng',
                    km: 8.5,
                    stops: await Destination.getForJourney(mood, ['craft'], [])
                },
                {
                    id: 'opt2',
                    name: 'Hành trình "Chữa lành & Xanh"',
                    desc: 'Sự kết hợp hoàn hảo giữa không gian xanh và sự tĩnh lặng của thiên nhiên.',
                    tags: ['Sinh thái', 'Thiên nhiên'],
                    duration: '6 tiếng',
                    km: 12.2,
                    stops: await Destination.getForJourney(mood, ['nature'], [])
                },
                {
                    id: 'opt3',
                    name: 'Hành trình "Tâm linh & Nguồn cội"',
                    desc: 'Dành cho những ai tìm kiếm sự bình an tại các ngôi chùa cổ kính.',
                    tags: ['Tâm linh', 'Lịch sử'],
                    duration: '5 tiếng',
                    km: 6.8,
                    stops: await Destination.getForJourney(mood, ['temple'], [])
                }
            ];

            res.render('journey/suggestions', {
                title: 'Đề xuất hành trình',
                suggestions: suggestions,
                session: session
            });
        } catch (error) {
            console.error("Suggestions error:", error);
            res.redirect('/onboarding');
        }
    }

    async confirm(req, res) {
        try {
            const { journeyData } = req.body;
            if (!journeyData) return res.redirect('/onboarding');
            const data = JSON.parse(journeyData);
            const uuid = req.cookies.session_uuid;
            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.redirect('/onboarding');

            await Journey.createFromSuggestion(session.id, data);
            res.redirect('/hanh-trinh-cua-toi');
        } catch (error) {
            console.error("Confirm error:", error);
            res.redirect('/onboarding');
        }
    }

    async preset(req, res) {
        try {
            const { theme } = req.params;
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.redirect('/onboarding');

            await Journey.createPreset(session.id, theme);
            res.redirect('/hanh-trinh-cua-toi');
        } catch (error) {
            console.error("Journey preset error:", error);
            res.redirect('/');
        }
    }
}

module.exports = new JourneyController();
