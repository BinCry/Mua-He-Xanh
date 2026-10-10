/**
 * BÌNH LỢI - CORE JS
 * Quản lý Session, AJAX và các tương tác UI
 */

const App = {
    config: window.APP_CONFIG || {},
    
    init() {
        console.log('☘️ Bình Lợi initialized');
        this.initSession();
        this.initHero();
    },

    // ─── SESSION MANAGEMENT ──────────────────────────────────────────
    
    initSession() {
        this.sessionUuid = null;
        const apiUrl = this.config.apiUrl || '/api';
        fetch(`${apiUrl}/session`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: '{}'
        })
            .then(response => {
                if (!response.ok) throw new Error(`Session bootstrap failed (${response.status})`);
                return response.json();
            })
            .then(payload => {
                this.sessionUuid = payload?.data?.uuid || null;
            })
            .catch(err => console.error('Session sync failed', err));
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
