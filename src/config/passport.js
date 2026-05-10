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
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length > 0) {
            done(null, rows[0]);
        } else {
            done(new Error("User not found"), null);
        }
    } catch (err) {
        done(err, null);
    }
});

// --- LOCAL OAUTH STRATEGY ---
passport.use(new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
        try {
            const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
            if (rows.length === 0) return done(null, false, { message: 'Email không tồn tại.' });

            const user = rows[0];
            if (!user.password) return done(null, false, { message: 'Tài khoản này được đăng ký qua Google/Facebook.' });

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return done(null, false, { message: 'Mật khẩu không chính xác.' });

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// --- GOOGLE OAUTH STRATEGY ---
passport.use(new GoogleStrategy({
    clientID: config.auth.google.clientId || 'MISSING_CLIENT_ID',
    clientSecret: config.auth.google.clientSecret || 'MISSING_CLIENT_SECRET',
    callbackURL: config.auth.google.callbackUrl,
    proxy: true
  },
  async function(accessToken, refreshToken, profile, cb) {
      try {
          // Check if user exists based on google_id
          const [existingUsers] = await db.query('SELECT * FROM users WHERE google_id = ?', [profile.id]);
          
          if (existingUsers.length > 0) {
              return cb(null, existingUsers[0]);
          }

          // If not exists, check if email exists to link accounts
          const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
          if (email) {
              const [emailUsers] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
              if (emailUsers.length > 0) {
                  // Update existing user with google_id
                  await db.query('UPDATE users SET google_id = ?, avatar = ? WHERE id = ?', 
                      [profile.id, profile.photos[0]?.value, emailUsers[0].id]);
                  const [updatedUser] = await db.query('SELECT * FROM users WHERE id = ?', [emailUsers[0].id]);
                  return cb(null, updatedUser[0]);
              }
          }

          // Create new user with UUID
          const { v4: uuidv4 } = require('uuid');
          const newUser = {
              id: uuidv4(),
              google_id: profile.id,
              full_name: profile.displayName,
              email: email,
              avatar: profile.photos[0]?.value,
              role: 'user',
              points: 0
          };
          
          await db.query(
              'INSERT INTO users (id, google_id, full_name, email, avatar, role, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [newUser.id, newUser.google_id, newUser.full_name, newUser.email, newUser.avatar, newUser.role, newUser.points]
          );
          
          return cb(null, newUser);

      } catch (err) {
          return cb(err, null);
      }
  }
));

// --- FACEBOOK OAUTH STRATEGY ---
passport.use(new FacebookStrategy({
    clientID: config.auth.facebook.appId || 'MISSING_APP_ID',
    clientSecret: config.auth.facebook.appSecret || 'MISSING_APP_SECRET',
    callbackURL: config.auth.facebook.callbackUrl,
    profileFields: ['id', 'displayName', 'photos', 'email'],
    proxy: true
  },
  async function(accessToken, refreshToken, profile, cb) {
      try {
          // Check if user exists based on facebook_id
          const [existingUsers] = await db.query('SELECT * FROM users WHERE facebook_id = ?', [profile.id]);
          
          if (existingUsers.length > 0) {
              return cb(null, existingUsers[0]);
          }

          const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
          
          const { v4: uuidv4 } = require('uuid');
          const newUser = {
              id: uuidv4(),
              facebook_id: profile.id,
              full_name: profile.displayName,
              email: email,
              avatar: profile.photos ? profile.photos[0].value : null,
              role: 'user',
              points: 0
          };
          
          await db.query(
              'INSERT INTO users (id, facebook_id, full_name, email, avatar, role, points) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [newUser.id, newUser.facebook_id, newUser.full_name, newUser.email, newUser.avatar, newUser.role, newUser.points]
          );
          
          return cb(null, newUser);

      } catch (err) {
          return cb(err, null);
      }
  }
));

module.exports = passport;
