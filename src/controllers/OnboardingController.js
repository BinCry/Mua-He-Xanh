class OnboardingController {
    static index(req, res) {
        res.render('onboarding/wizard', {
            title: 'Khởi tạo hành trình'
        });
    }
}

module.exports = new OnboardingController();
