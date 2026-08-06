const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const calculatedBaseUrl = process.env.NODE_ENV === 'production' 
    ? (process.env.BASE_URL || 'https://binh-loi-healing.vercel.app') 
    : `http://localhost:${process.env.PORT || 3000}`;

const config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    baseUrl: calculatedBaseUrl,
    
    db: {
        type: 'postgres',
        url: process.env.DATABASE_URL
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
    },
    
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET
    }
};

module.exports = config;
