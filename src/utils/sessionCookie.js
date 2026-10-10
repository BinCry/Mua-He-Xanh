const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function setSessionUuidCookie(res, uuid) {
    res.cookie('session_uuid', uuid, {
        maxAge: SESSION_COOKIE_MAX_AGE,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
}

module.exports = { setSessionUuidCookie };
