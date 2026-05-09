const fs = require('fs');
const path = require('path');
const googleTTS = require('google-tts-api');
const axios = require('axios');
const db = require('../src/core/Database');

const mediaDir = path.join(__dirname, '../public/media');

// Đảm bảo thư mục media tồn tại
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
}

async function downloadAudio(text, filename) {
    try {
        console.log(`Generating audio for: ${filename}`);
        const url = googleTTS.getAudioUrl(text, {
            lang: 'vi',
            slow: false,
            host: 'https://translate.google.com',
        });
        
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        const filepath = path.join(mediaDir, filename);
        const writer = fs.createWriteStream(filepath);
        
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(`/media/${filename}`));
            writer.on('error', reject);
        });
    } catch (err) {
        console.error(`Failed to generate audio for ${filename}:`, err.message);
        return null;
    }
}

async function run() {
    try {
        const [destinations] = await db.query("SELECT id, name, story FROM destinations WHERE story IS NOT NULL AND story != ''");
        
        console.log(`Found ${destinations.length} destinations with stories. Starting AI Audio generation...`);
        
        for (const dest of destinations) {
            // Rút gọn text nếu quá dài (Google TTS giới hạn 200 ký tự cho 1 request thường,
            // nhưng thư viện có thể hỗ trợ tách. Ta lấy 150 ký tự đầu làm demo)
            let text = dest.story;
            if (text.length > 180) {
                text = text.substring(0, 180) + "...";
            }
            
            const filename = `audio_dest_${dest.id}.mp3`;
            const audioUrl = await downloadAudio(text, filename);
            
            if (audioUrl) {
                await db.query("UPDATE destinations SET audio_url = ? WHERE id = ?", [audioUrl, dest.id]);
                console.log(`✅ Success: ${dest.name} -> ${audioUrl}`);
            }
        }
        
        console.log("🎉 AI Audio generation completed!");
        process.exit(0);
    } catch (error) {
        console.error("Fatal Error:", error);
        process.exit(1);
    }
}

run();
