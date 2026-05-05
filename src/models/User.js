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
        const { email, fullName, avatar, googleId, facebookId } = data;
        
        // Check if email already exists
        if (email) {
            const existing = await this.findByEmail(email);
            if (existing) {
                // Link social ID to existing account
                const updateData = {};
                if (googleId) updateData.google_id = googleId;
                if (facebookId) updateData.facebook_id = facebookId;
                await this.update(existing.id, updateData);
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
            role: 'user'
        });

        return this.findById(id);
    }
}

module.exports = new User();
