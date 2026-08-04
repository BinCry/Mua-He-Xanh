class OnboardingController {
    async index(req, res) {
        // Require login for journey planning
        const user = req.user || req.session?.user;
        if (!user) {
            req.session.redirectUrl = '/onboarding';
            return res.redirect('/auth/login?error=auth_required');
        }

        res.render('onboarding/index', {
            title: 'Bạn đang cảm thấy thế nào?'
        });
    }
}

module.exports = new OnboardingController();
