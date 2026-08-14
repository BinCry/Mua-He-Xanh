const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('../core/database');
const config = require('./env');

// Serialization: How to save user into session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialization: How to get user from session
passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = $1', [id]);
        if (rows.length > 0) {
            done(null, rows[0]);
        } else {
            done(new Error("User not found"), null);
        }
    } catch (err) {
        done(err, null);
    }
});

// --- LOCAL OAUTH STRATEGY (supports email or phone login) ---
passport.use(new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (emailOrPhone, password, done) => {
        try {
            // Try email first, then phone
            let [rows] = await db.query("SELECT * FROM users WHERE email = $1", [emailOrPhone]);
            if (rows.length === 0) {
                // Try phone match
                [rows] = await db.query("SELECT * FROM users WHERE phone = $1", [emailOrPhone]);
            }
            if (rows.length === 0) {
                // Try phone@phone.local pattern
                [rows] = await db.query("SELECT * FROM users WHERE email = $1", [emailOrPhone + '@phone.local']);
            }
            if (rows.length === 0) return done(null, false, { message: 'Tài khoản không tồn tại.' });

            const user = rows[0];
            if (!user.password) return done(null, false, { message: 'Tài khoản này được đăng ký qua Google/Facebook.' });

            // Enforce administrative approval check
            if (user.is_active === 0) {
                return done(null, false, { message: 'Tài khoản của bạn đang chờ phê duyệt từ Ban quản trị.' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return done(null, false, { message: 'Mật khẩu không chính xác.' });

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// --- GOOGLE OAUTH STRATEGY ---
if (config.auth.google.clientId && config.auth.google.clientId !== 'MISSING_CLIENT_ID') {
    passport.use(new GoogleStrategy({
        clientID: config.auth.google.clientId,
        clientSecret: config.auth.google.clientSecret,
        callbackURL: '/auth/google/callback',
        proxy: true
      },
      async function(accessToken, refreshToken, profile, cb) {
          try {
              const [existingUsers] = await db.query('SELECT * FROM users WHERE google_id = $1', [profile.id]);
              
              if (existingUsers.length > 0) {
                  return cb(null, existingUsers[0]);
              }

              const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
              if (email) {
                  const [emailUsers] = await db.query('SELECT * FROM users WHERE email = $1', [email]);
                  if (emailUsers.length > 0) {
                      await db.query('UPDATE users SET google_id = $1, avatar = $2 WHERE id = $3', 
                          [profile.id, profile.photos[0]?.value, emailUsers[0].id]);
                      const [updatedUser] = await db.query('SELECT * FROM users WHERE id = $1', [emailUsers[0].id]);
                      return cb(null, updatedUser[0]);
                  }
              }

              const { v4: uuidv4 } = require('uuid');
              const newUser = {
                  id: uuidv4(),
                  google_id: profile.id,
                  full_name: profile.displayName,
                  email: email,
                  avatar: profile.photos[0]?.value,
                  role: 'user',
                  role_id: 3
              };
              
              await db.query(
                  'INSERT INTO users (id, google_id, full_name, email, avatar, role, role_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                  [newUser.id, newUser.google_id, newUser.full_name, newUser.email, newUser.avatar, newUser.role, newUser.role_id]
              );
              
              return cb(null, newUser);

          } catch (err) {
              return cb(err, null);
          }
      }
    ));
    console.log('✅ Google OAuth Strategy loaded');
} else {
    console.log('⚠️  Google OAuth: Chưa cấu hình Client ID - Bỏ qua');
}

// --- FACEBOOK OAUTH STRATEGY ---
if (config.auth.facebook.appId && config.auth.facebook.appId !== 'MISSING_APP_ID') {
    passport.use(new FacebookStrategy({
        clientID: config.auth.facebook.appId,
        clientSecret: config.auth.facebook.appSecret,
        callbackURL: '/auth/facebook/callback',
        profileFields: ['id', 'displayName', 'photos'],
        proxy: true
      },
      async function(accessToken, refreshToken, profile, cb) {
          try {
              const [existingUsers] = await db.query('SELECT * FROM users WHERE facebook_id = $1', [profile.id]);
              
              if (existingUsers.length > 0) {
                  return cb(null, existingUsers[0]);
              }

              const avatarUrl = (profile.photos && profile.photos.length > 0 && profile.photos[0].value) 
                  ? profile.photos[0].value 
                  : `https://graph.facebook.com/${profile.id}/picture?type=large`;

              const { v4: uuidv4 } = require('uuid');
              const newUser = {
                  id: uuidv4(),
                  facebook_id: profile.id,
                  full_name: profile.displayName || 'Người dùng Facebook',
                  email: profile.id + '@facebook.local',
                  avatar: avatarUrl,
                  role: 'user',
                  role_id: 3
              };
              
              await db.query(
                  'INSERT INTO users (id, facebook_id, full_name, email, avatar, role, role_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                  [newUser.id, newUser.facebook_id, newUser.full_name, newUser.email, newUser.avatar, newUser.role, newUser.role_id]
              );
              
              return cb(null, newUser);

          } catch (err) {
              console.error("Facebook OAuth Strategy Error:", err);
              return cb(err, null);
          }
      }
    ));
    console.log('✅ Facebook OAuth Strategy loaded');
} else {
    console.log('⚠️  Facebook OAuth: Chưa cấu hình App ID - Bỏ qua');
}

module.exports = passport;
