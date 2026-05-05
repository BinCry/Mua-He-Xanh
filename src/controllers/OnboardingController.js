class OnboardingController {
    static index(req, res) {
        res.render('onboarding/vibe_tiktok', {
            title: 'Khám phá Vibe'
        });
    }
}

module.exports = new OnboardingController();
