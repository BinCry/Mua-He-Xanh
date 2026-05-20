const axios = require('axios');
const env = require('../config/env');

class SMSService {
    /**
     * Send an OTP message to a phone number.
     * Supports Twilio and SpeedSMS based on environment variables.
     * 
     * @param {string} phone - Target phone number (e.g. 0901234567)
     * @param {string} otp - The OTP code
     */
    async sendOTP(phone, otp) {
        // Normalize phone to international format if needed by the provider
        let formattedPhone = phone.trim();
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '+84' + formattedPhone.substring(1);
        }

        const message = `Binh Loi Healing Journey: Ma OTP xac thuc dang ky cua ban la ${otp}. Ma co hieu luc trong 5 phut.`;

        // 1. Try Twilio
        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

        if (twilioSid && twilioAuthToken && twilioPhone) {
            try {
                const client = require('twilio')(twilioSid, twilioAuthToken);
                await client.messages.create({
                    body: message,
                    from: twilioPhone,
                    to: formattedPhone
                });
                console.log(`[SMS] Twilio sent OTP to ${formattedPhone}`);
                return { success: true, provider: 'twilio' };
            } catch (err) {
                console.error('[SMS] Twilio error:', err.message);
            }
        }

        // 2. Try SpeedSMS (Vietnam Provider)
        const speedSmsKey = process.env.SPEEDSMS_API_KEY;
        if (speedSmsKey) {
            try {
                // SpeedSMS requires local format (e.g., 84901234567 or 0901234567)
                const localPhone = phone.trim().replace(/^\+84/, '0');
                const response = await axios.post(
                    `https://api.speedsms.vn/index.php/sms/send`,
                    {
                        to: [localPhone],
                        content: message,
                        sms_type: 2, // 2: CSKH, 4: Brandname
                        sender: ''   // Leave empty for default sender
                    },
                    {
                        headers: {
                            'Authorization': 'Basic ' + Buffer.from(speedSmsKey + ':x').toString('base64'),
                            'Content-Type': 'application/json'
                        }
                    }
                );
                if (response.data && response.data.code === 'success') {
                    console.log(`[SMS] SpeedSMS sent OTP to ${localPhone}`);
                    return { success: true, provider: 'speedsms' };
                } else {
                    console.error('[SMS] SpeedSMS failed:', response.data);
                }
            } catch (err) {
                console.error('[SMS] SpeedSMS error:', err.message);
            }
        }

        // 3. Fallback: log to console
        console.warn(`\n======================================================`);
        console.warn(`[WARNING] CHƯA CẤU HÌNH API GỬI SMS REAL (TWILIO HOẶC SPEEDSMS)`);
        console.warn(`MÃ OTP CỦA SĐT ${phone} LÀ: ${otp}`);
        console.warn(`======================================================\n`);
        return { success: false, fallback: true, otp };
    }
}

module.exports = new SMSService();
