const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const db = require('../core/database');

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

// --- GOOGLE OAUTH STRATEGY ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'Bấm vào Google Cloud Console để lấy ID',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'Secret_cua_ban',
    callbackURL: "/auth/google/callback"
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

          // Create new user
          const newUser = {
              google_id: profile.id,
              full_name: profile.displayName,
              email: email,
              avatar: profile.photos[0]?.value,
              role: 'user',
              points: 0
          };
          
          const [result] = await db.query(
              'INSERT INTO users (google_id, full_name, email, avatar, role, points) VALUES (?, ?, ?, ?, ?, ?)',
              [newUser.google_id, newUser.full_name, newUser.email, newUser.avatar, newUser.role, newUser.points]
          );
          
          newUser.id = result.insertId;
          return cb(null, newUser);

      } catch (err) {
          return cb(err, null);
      }
  }
));

// --- FACEBOOK OAUTH STRATEGY ---
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID || 'ID_Cua_Ban',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'Secret_Cua_Ban',
    callbackURL: "/auth/facebook/callback",
    profileFields: ['id', 'displayName', 'photos', 'email']
  },
  async function(accessToken, refreshToken, profile, cb) {
      try {
          // Check if user exists based on facebook_id
          const [existingUsers] = await db.query('SELECT * FROM users WHERE facebook_id = ?', [profile.id]);
          
          if (existingUsers.length > 0) {
              return cb(null, existingUsers[0]);
          }

          const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null;
          
          const newUser = {
              facebook_id: profile.id,
              full_name: profile.displayName,
              email: email,
              avatar: profile.photos ? profile.photos[0].value : null,
              role: 'user',
              points: 0
          };
          
          const [result] = await db.query(
              'INSERT INTO users (facebook_id, full_name, email, avatar, role, points) VALUES (?, ?, ?, ?, ?, ?)',
              [newUser.facebook_id, newUser.full_name, newUser.email, newUser.avatar, newUser.role, newUser.points]
          );
          
          newUser.id = result.insertId;
          return cb(null, newUser);

      } catch (err) {
          return cb(err, null);
      }
  }
));

module.exports = passport;
