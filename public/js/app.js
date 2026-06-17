/**
 * BÌNH LỢI HEALING - CORE JS
 * Quản lý Session, AJAX và các tương tác UI
 */

const App = {
    config: window.APP_CONFIG || {},
    
    init() {
        console.log('☘️ Bình Lợi Healing initialized');
        this.initSession();
        this.initHero();
    },

    // ─── SESSION MANAGEMENT ──────────────────────────────────────────
    
    initSession() {
        let uuid = this.getCookie('bl_session_uuid');
        if (!uuid) {
            uuid = this.generateUuid();
            this.setCookie('bl_session_uuid', uuid, 7);
            
            // Sync with server
            axios.post(`${this.config.apiUrl}/session`, { uuid })
                .catch(err => console.error('Session sync failed', err));
        }
        this.sessionUuid = uuid;
    },

    generateUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict";
    },

    getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },

    // ─── UI COMPONENTS ───────────────────────────────────────────────
    
    initHero() {
        const slides = document.querySelectorAll('.hero-slide');
        if (slides.length <= 1) return;
        
        let current = 0;
        setInterval(() => {
            slides[current].classList.remove('active');
            current = (current + 1) % slides.length;
            slides[current].classList.add('active');
        }, 5000);
    },

    // ─── ANIMATIONS ──────────────────────────────────────────────────
    
    showPoints(points) {
        const div = document.createElement('div');
        div.className = 'points-fly';
        div.innerText = `+${points} ✨`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 1500);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
