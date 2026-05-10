const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const calculatedBaseUrl = process.env.NODE_ENV === 'production' 
    ? (process.env.BASE_URL || 'https://binh-loi-healing.onrender.com') 
    : `http://localhost:${process.env.PORT || 3000}`;

const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    baseUrl: calculatedBaseUrl,
    
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        name: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: process.env.DB_SSL === 'true'
    },

    auth: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl: calculatedBaseUrl + '/auth/google/callback'
        },
        facebook: {
            appId: process.env.FACEBOOK_APP_ID,
            appSecret: process.env.FACEBOOK_APP_SECRET,
            callbackUrl: calculatedBaseUrl + '/auth/facebook/callback'
        },
        sessionSecret: process.env.SESSION_SECRET || 'binh_loi_healing_default_secret'
    }
};

// Check for critical missing keys
const missingKeys = [];
if (!config.db.host) missingKeys.push('DB_HOST');
if (!config.auth.google.clientId || config.auth.google.clientId.includes('ID_Cua_Ban')) missingKeys.push('GOOGLE_CLIENT_ID');

if (missingKeys.length > 0 && config.nodeEnv === 'production') {
    console.error(`\x1b[31m[CRITICAL] Missing environment variables: ${missingKeys.join(', ')}\x1b[0m`);
}

module.exports = config;
