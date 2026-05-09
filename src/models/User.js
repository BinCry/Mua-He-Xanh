const Model = require('../core/Model');

class User extends Model {
    constructor() {
        super('users');
    }

    async findByEmail(email) {
        return this.findOne({ email });
    }

    async findByGoogleId(googleId) {
        return this.findOne({ google_id: googleId });
    }

    async findByFacebookId(facebookId) {
        return this.findOne({ facebook_id: facebookId });
    }

    async createFromSocial(data) {
        const { email, fullName, avatar, googleId, facebookId, phone, city } = data;
        
        // Check if email already exists
        if (email) {
            const existing = await this.findByEmail(email);
            if (existing) {
                // Link social ID and sync avatar to existing account
                const updateData = {};
                if (googleId) updateData.google_id = googleId;
                if (facebookId) updateData.facebook_id = facebookId;
                if (avatar) updateData.avatar = avatar; // Sync avatar
                if (phone && !existing.phone) updateData.phone = phone;
                if (city && !existing.city) updateData.city = city;
                
                if (Object.keys(updateData).length > 0) {
                    await this.update(existing.id, updateData);
                }
                return this.findById(existing.id);
            }
        }

        const id = require('uuid').v4();
        await this.create({
            id,
            email,
            full_name: fullName,
            avatar,
            google_id: googleId,
            facebook_id: facebookId,
            phone: phone || null,
            city: city || null,
            role: 'user'
        });

        return this.findById(id);
    }
}

module.exports = new User();
