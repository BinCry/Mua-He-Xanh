class OnboardingController {
    async index(req, res) {
        res.render('onboarding/index', {
            title: 'Bạn đang cảm thấy thế nào?'
        });
    }
}

module.exports = new OnboardingController();
