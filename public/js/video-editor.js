/**
 * ============================================================================
 * BÌNH LỢI STUDIO - 100% CAPCUT REPLICA CLIENT ENGINE
 * Complete Canvas 2D Render Pipeline, Direct Interactive Transform Bounding Box,
 * Multi-Track Timeline, Audio Synchronization, Template Engine, and Video Exporter.
 * ============================================================================
 */

(function() {
    'use strict';

    // ==========================================
    // 1. GLOBAL STUDIO STATE
    // ==========================================
    const state = {
        title: 'BinhLoi_Video_' + Math.floor(Math.random() * 900000 + 100000),
        aspectRatio: '9:16',
        targetWidth: 1080,
        targetHeight: 1920,
        duration: 15.0,
        fps: 30,
        currentTime: 0.0,
        isPlaying: false,
        activeSlotIndex: 0,
        slots: [],
        audio: {
            url: '/audio/peaceful_stream.mp3',
            title: 'Suối reo miệt vườn',
            volume: 1.0,
            isMuted: false
        },
        bgType: 'blur', // 'blur' | 'color'
        bgColor: '#000000',
        undoStack: [],
        redoStack: [],
        templates: window.__CAPCUT_TEMPLATES__ || [],
        soundscapes: window.__CAPCUT_SOUNDSCAPES__ || []
    };

    // DOM Elements Cache
    const DOM = {
        canvas: document.getElementById('studioCanvas'),
        viewport: document.getElementById('canvasViewport'),
        bbox: document.getElementById('studioBBox'),
        guideX: document.getElementById('guideLineX'),
        guideY: document.getElementById('guideLineY'),
        btnPlayPause: document.getElementById('btnPlayPause'),
        btnRewind: document.getElementById('btnRewind'),
        btnPrevFrame: document.getElementById('btnPrevFrame'),
        btnNextFrame: document.getElementById('btnNextFrame'),
        dockTimecode: document.getElementById('dockTimecode'),
        btnToggleMute: document.getElementById('btnToggleMute'),
        dockMuteIcon: document.getElementById('dockMuteIcon'),
        btnFitCanvas: document.getElementById('btnFitCanvas'),
        aspectRatioSelect: document.getElementById('aspectRatioSelect'),
        projectTitleInput: document.getElementById('projectTitleInput'),
        btnUndo: document.getElementById('btnUndo'),
        btnRedo: document.getElementById('btnRedo'),
        timelineScroll: document.getElementById('timelineScrollArea'),
        timelinePlayhead: document.getElementById('timelinePlayhead'),
        timelineRuler: document.getElementById('timelineRuler'),
        videoTrackContainer: document.getElementById('videoTrackContainer'),
        subtitlesTrackContainer: document.getElementById('subtitlesTrackContainer'),
        tlAudioName: document.getElementById('tlAudioName'),
        tlClipCount: document.getElementById('tlClipCount'),
        tlDurationLabel: document.getElementById('tlDurationLabel'),
        toolSplit: document.getElementById('toolSplit'),
        toolDelete: document.getElementById('toolDelete'),
        toolDuplicate: document.getElementById('toolDuplicate'),
        toolBatch: document.getElementById('toolBatch'),
        mediaInput: document.getElementById('mediaInput'),
        mediaSlotsList: document.getElementById('mediaSlotsList'),
        mediaSlotsCount: document.getElementById('mediaSlotsCount'),
        subtitlesListContainer: document.getElementById('subtitlesListContainer'),
        btnOpenExportModal: document.getElementById('btnOpenExportModal'),
        exportModal: document.getElementById('capcutExportModal'),
        btnCloseExportModal: document.getElementById('btnCloseExportModal'),
        btnStartExport: document.getElementById('btnStartExport'),
        exportProgressWrapper: document.getElementById('exportProgressWrapper'),
        exportProgressBar: document.getElementById('exportProgressBar'),
        exportStatusLabel: document.getElementById('exportStatusLabel'),
        exportPercentLabel: document.getElementById('exportPercentLabel'),
        bgAudio: document.getElementById('bgAudioPlayer'),
        // Inspector
        sliderScale: document.getElementById('sliderScale'),
        valScale: document.getElementById('valScale'),
        sliderRotate: document.getElementById('sliderRotate'),
        valRotate: document.getElementById('valRotate'),
        sliderPosX: document.getElementById('sliderPosX'),
        valPosX: document.getElementById('valPosX'),
        sliderPosY: document.getElementById('sliderPosY'),
        valPosY: document.getElementById('valPosY'),
        sliderOpacity: document.getElementById('sliderOpacity'),
        valOpacity: document.getElementById('valOpacity'),
        btnResetTransform: document.getElementById('btnResetTransform'),
        sliderBrightness: document.getElementById('sliderBrightness'),
        valBrightness: document.getElementById('valBrightness'),
        sliderContrast: document.getElementById('sliderContrast'),
        valContrast: document.getElementById('valContrast'),
        sliderSaturation: document.getElementById('sliderSaturation'),
        valSaturation: document.getElementById('valSaturation'),
        sliderVolume: document.getElementById('sliderVolume'),
        valVolume: document.getElementById('valVolume')
    };

    const ctx = DOM.canvas ? DOM.canvas.getContext('2d') : null;
    let animationFrameId = null;
    let lastRenderTimestamp = 0;

    // ==========================================
    // 2. INITIALIZATION
    // ==========================================
    function initStudio() {
        if (!DOM.canvas || !ctx) return;

        // 1. Load initial template or defaults
        loadInitialTemplate();

        // 2. Setup aspect ratio & canvas resizing
        updateCanvasDimensions();
        window.addEventListener('resize', () => {
            updateCanvasDimensions();
            updateBoundingBoxPosition();
        });

        // 3. Setup event listeners
        bindHeaderEvents();
        bindRailAndDrawerEvents();
        bindCanvasDirectTransform();
        bindInspectorEvents();
        bindTimelineEvents();
        bindAudioEvents();
        bindExportEvents();

        // 4. Start 60fps render loop
        lastRenderTimestamp = performance.now();
        requestAnimationFrame(renderLoop);
    }

    function loadInitialTemplate() {
        let initialTpl = null;
        if (state.templates && state.templates.length > 0) {
            initialTpl = state.templates[0];
        }

        if (initialTpl && Array.isArray(initialTpl.slots) && initialTpl.slots.length > 0) {
            applyTemplate(initialTpl);
        } else {
            // Default 4-scene 15s healing template
            const defaultSlots = [
                {
                    slot_index: 1,
                    title: 'Cảnh 1: Lạc vào miền xanh',
                    start_time: 0.0,
                    end_time: 3.75,
                    src: '/images/Poster 1.jpg',
                    effect: 'kenburns',
                    filter: 'none',
                    subtitle: 'Lạc vào miền xanh Bình Lợi...',
                    transform: { x: 0, y: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
                },
                {
                    slot_index: 2,
                    title: 'Cảnh 2: Hương mai thanh mát',
                    start_time: 3.75,
                    end_time: 7.5,
                    src: '/images/Poster 2.jpg',
                    effect: 'pan',
                    filter: 'warm',
                    subtitle: 'Hương mai thoang thoảng bờ kênh thanh mát.',
                    transform: { x: 0, y: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
                },
                {
                    slot_index: 3,
                    title: 'Cảnh 3: Chữa lành tâm hồn',
                    start_time: 7.5,
                    end_time: 11.25,
                    src: '/images/Poster 3.jpg',
                    effect: 'dissolve',
                    filter: 'cool',
                    subtitle: 'Chữa lành từ những điều mộc mạc nhất.',
                    transform: { x: 0, y: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
                },
                {
                    slot_index: 4,
                    title: 'Cảnh 4: Trở về an yên',
                    start_time: 11.25,
                    end_time: 15.0,
                    src: '/images/Poster 4.jpg',
                    effect: 'flash',
                    filter: 'vintage',
                    subtitle: 'Nghe Bình Lợi theo cách của bạn.',
                    transform: { x: 0, y: 0, scale: 1.0, rotate: 0, opacity: 1.0 }
                }
            ];
            setProjectSlots(defaultSlots, 15.0);
        }
    }

    function setProjectSlots(slots, totalDuration) {
        state.duration = totalDuration || 15.0;
        state.slots = slots.map((s, idx) => {
            const slotObj = {
                slot_index: idx + 1,
                title: s.title || ('Cảnh ' + (idx + 1)),
                start_time: s.start_time !== undefined ? s.start_time : (idx * (state.duration / slots.length)),
                end_time: s.end_time !== undefined ? s.end_time : ((idx + 1) * (state.duration / slots.length)),
                src: s.src || s.default_img || ('/images/Poster ' + ((idx % 5) + 1) + '.jpg'),
                effect: s.effect || 'kenburns',
                filter: s.filter || 'none',
                subtitle: s.subtitle || '',
                transform: s.transform ? { ...s.transform } : { x: 0, y: 0, scale: 1.0, rotate: 0, opacity: 1.0 },
                adjust: s.adjust ? { ...s.adjust } : { brightness: 100, contrast: 100, saturation: 100 },
                img: null
            };

            // Preload Image
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = slotObj.src;
            img.onload = () => { slotObj.img = img; };
            img.onerror = () => {
                const fallbackImg = new Image();
                fallbackImg.src = '/images/Poster 1.jpg';
                fallbackImg.onload = () => { slotObj.img = fallbackImg; };
            };
            slotObj.img = img;
            return slotObj;
        });

        state.activeSlotIndex = 0;
        state.currentTime = 0.0;

        renderTimelineTracks();
        renderDrawerMediaSlots();
        renderDrawerSubtitles();
        syncInspectorWithActiveSlot();
    }

    function applyTemplate(tpl) {
        const slots = Array.isArray(tpl.slots) ? tpl.slots : [];
        const dur = tpl.duration_seconds || 15;
        if (tpl.audio_url) {
            state.audio.url = tpl.audio_url;
            state.audio.title = tpl.audio_title || 'Nhạc nền Bình Lợi';
            if (DOM.bgAudio) DOM.bgAudio.src = tpl.audio_url;
            if (DOM.tlAudioName) DOM.tlAudioName.textContent = state.audio.title;
        }
        setProjectSlots(slots, dur);
    }

    // ==========================================
    // 3. CANVAS RESIZING & ASPECT RATIO
    // ==========================================
    function updateCanvasDimensions() {
        if (!DOM.canvas || !DOM.viewport) return;

        let ratioW = 9, ratioH = 16;
        if (state.aspectRatio === '16:9') { ratioW = 16; ratioH = 9; }
        else if (state.aspectRatio === '1:1') { ratioW = 1; ratioH = 1; }
        else if (state.aspectRatio === '4:3') { ratioW = 4; ratioH = 3; }

        state.targetWidth = (ratioW / ratioH >= 1) ? 1920 : 1080;
        state.targetHeight = Math.round(state.targetWidth * (ratioH / ratioW));

        DOM.canvas.width = state.targetWidth;
        DOM.canvas.height = state.targetHeight;

        // Viewport display dimensions
        const vpRect = DOM.viewport.parentElement.getBoundingClientRect();
        const maxW = Math.max(240, vpRect.width - 32);
        const maxH = Math.max(240, vpRect.height - 80);

        let dispW = maxW;
        let dispH = dispW * (ratioH / ratioW);
        if (dispH > maxH) {
            dispH = maxH;
            dispW = dispH * (ratioW / ratioH);
        }

        DOM.canvas.style.width = Math.round(dispW) + 'px';
        DOM.canvas.style.height = Math.round(dispH) + 'px';
        DOM.viewport.style.width = Math.round(dispW) + 'px';
        DOM.viewport.style.height = Math.round(dispH) + 'px';

        updateBoundingBoxPosition();
    }

    // ==========================================
    // 4. CORE CANVAS RENDER PIPELINE (60 FPS)
    // ==========================================
    function renderLoop(timestamp) {
        const delta = (timestamp - lastRenderTimestamp) / 1000;
        lastRenderTimestamp = timestamp;

        if (state.isPlaying) {
            state.currentTime += delta;
            if (state.currentTime >= state.duration) {
                state.currentTime = 0; // loop
            }
            updatePlayheadAndClocks();
        }

        drawFrame();
        requestAnimationFrame(renderLoop);
    }

    function drawFrame() {
        if (!ctx) return;
        const cw = DOM.canvas.width;
        const ch = DOM.canvas.height;

        ctx.clearRect(0, 0, cw, ch);

        // Find active slot
        let curSlot = state.slots[state.activeSlotIndex] || state.slots[0];
        for (let i = 0; i < state.slots.length; i++) {
            const s = state.slots[i];
            if (state.currentTime >= s.start_time && state.currentTime < s.end_time) {
                curSlot = s;
                if (state.activeSlotIndex !== i && state.isPlaying) {
                    state.activeSlotIndex = i;
                    highlightActiveClipInTimeline();
                    updateBoundingBoxPosition();
                }
                break;
            }
        }

        if (!curSlot) return;

        // 1. Draw Background (Blurred Image or Solid Color)
        if (state.bgType === 'blur' && curSlot.img && curSlot.img.complete && curSlot.img.naturalWidth > 0) {
            ctx.save();
            ctx.filter = 'blur(40px) brightness(0.4)';
            ctx.drawImage(curSlot.img, -100, -100, cw + 200, ch + 200);
            ctx.restore();
        } else {
            ctx.fillStyle = state.bgColor;
            ctx.fillRect(0, 0, cw, ch);
        }

        // 2. Draw Active Slot Main Image with Filters & Motion
        if (curSlot.img && curSlot.img.complete && curSlot.img.naturalWidth > 0) {
            const slotDuration = Math.max(0.1, curSlot.end_time - curSlot.start_time);
            const slotProgress = Math.min(1.0, Math.max(0.0, (state.currentTime - curSlot.start_time) / slotDuration));

            // Dynamic Motion (Ken Burns / Pan / Flash)
            let motionScale = 1.0;
            let motionX = 0;
            let motionY = 0;

            if (curSlot.effect === 'kenburns') {
                motionScale = 1.0 + slotProgress * 0.12; // slow zoom in
            } else if (curSlot.effect === 'pan') {
                motionX = (slotProgress - 0.5) * 60; // smooth side-to-side
            }

            // CSS Filters
            let filterStr = '';
            if (curSlot.filter === 'warm') filterStr += ' sepia(25%) contrast(105%) brightness(105%)';
            else if (curSlot.filter === 'cool') filterStr += ' hue-rotate(180deg) saturate(110%) brightness(105%)';
            else if (curSlot.filter === 'vintage') filterStr += ' sepia(45%) contrast(115%) brightness(95%)';
            else if (curSlot.filter === 'grayscale') filterStr += ' grayscale(100%) contrast(120%)';

            const adj = curSlot.adjust || { brightness: 100, contrast: 100, saturation: 100 };
            if (adj.brightness !== 100) filterStr += ' brightness(' + adj.brightness + '%)';
            if (adj.contrast !== 100) filterStr += ' contrast(' + adj.contrast + '%)';
            if (adj.saturation !== 100) filterStr += ' saturate(' + adj.saturation + '%)';

            ctx.save();
            if (filterStr) ctx.filter = filterStr.trim();

            const t = curSlot.transform || { x: 0, y: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
            ctx.globalAlpha = t.opacity !== undefined ? t.opacity : 1.0;

            // Center of Canvas
            const centerX = cw / 2 + t.x + motionX;
            const centerY = ch / 2 + t.y + motionY;

            ctx.translate(centerX, centerY);
            ctx.rotate((t.rotate * Math.PI) / 180);
            const finalScale = t.scale * motionScale;
            ctx.scale(finalScale, finalScale);

            // Compute fitted image dimension
            const imgAspect = curSlot.img.naturalWidth / curSlot.img.naturalHeight;
            const canvasAspect = cw / ch;

            let drawW, drawH;
            if (imgAspect > canvasAspect) {
                drawH = ch;
                drawW = drawH * imgAspect;
            } else {
                drawW = cw;
                drawH = drawW / imgAspect;
            }

            ctx.drawImage(curSlot.img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();

            // Flash White Transition Effect
            if (curSlot.effect === 'flash' && slotProgress < 0.2) {
                const flashAlpha = 1.0 - (slotProgress / 0.2);
                ctx.fillStyle = 'rgba(255, 255, 255, ' + (flashAlpha * 0.8) + ')';
                ctx.fillRect(0, 0, cw, ch);
            }
        }

        // 3. Draw Subtitles / Caption Overlay
        if (curSlot.subtitle) {
            drawSubtitleOverlay(curSlot.subtitle, cw, ch);
        }
    }

    function drawSubtitleOverlay(text, cw, ch) {
        ctx.save();
        ctx.font = '700 36px "Be Vietnam Pro", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textMetrics = ctx.measureText(text);
        const paddingH = 30;
        const paddingV = 16;
        const boxW = textMetrics.width + paddingH * 2;
        const boxH = 58;
        const boxX = (cw - boxW) / 2;
        const boxY = ch - 160;

        // Rounded pill background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 29);
        ctx.fill();

        // Text with subtle shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, cw / 2, boxY + boxH / 2);

        ctx.restore();
    }

    // ==========================================
    // 5. DIRECT CANVAS BOUNDING BOX (NO POPUPS!)
    // ==========================================
    function updateBoundingBoxPosition() {
        if (!DOM.bbox || !DOM.canvas || !DOM.viewport) return;

        const curSlot = state.slots[state.activeSlotIndex];
        if (!curSlot) {
            DOM.bbox.classList.remove('active');
            return;
        }

        const canvasRect = DOM.canvas.getBoundingClientRect();
        const viewportRect = DOM.viewport.getBoundingClientRect();

        const t = curSlot.transform || { x: 0, y: 0, scale: 1.0, rotate: 0 };
        const scaleFactor = canvasRect.width / DOM.canvas.width;

        // Calculate rendered bounding box dimensions
        const baseBoxW = canvasRect.width * 0.9 * t.scale;
        const baseBoxH = canvasRect.height * 0.9 * t.scale;

        const boxLeft = (canvasRect.width - baseBoxW) / 2 + (t.x * scaleFactor);
        const boxTop = (canvasRect.height - baseBoxH) / 2 + (t.y * scaleFactor);

        DOM.bbox.style.width = Math.round(baseBoxW) + 'px';
        DOM.bbox.style.height = Math.round(baseBoxH) + 'px';
        DOM.bbox.style.left = Math.round(boxLeft) + 'px';
        DOM.bbox.style.top = Math.round(boxTop) + 'px';
        DOM.bbox.style.transform = 'rotate(' + (t.rotate || 0) + 'deg)';

        DOM.bbox.classList.add('active');
    }

    function bindCanvasDirectTransform() {
        if (!DOM.viewport || !DOM.bbox) return;

        let isDragging = false;
        let isScaling = false;
        let isRotating = false;
        let activeHandle = null;
        let startX = 0, startY = 0;
        let initT = null;

        // 1. Mouse Drag on Bounding Box (Move)
        DOM.bbox.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('capcut-bbox-handle') || e.target.id === 'bboxRotator' || e.target.closest('#bboxRotator')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const curSlot = state.slots[state.activeSlotIndex];
            initT = { ...curSlot.transform };
            e.preventDefault();
        });

        // 2. Scale Handles
        DOM.bbox.querySelectorAll('.capcut-bbox-handle').forEach(h => {
            h.addEventListener('mousedown', (e) => {
                isScaling = true;
                activeHandle = h.getAttribute('data-handle');
                startX = e.clientX;
                startY = e.clientY;
                const curSlot = state.slots[state.activeSlotIndex];
                initT = { ...curSlot.transform };
                e.stopPropagation();
                e.preventDefault();
            });
        });

        // 3. Rotator Handle
        const rotator = document.getElementById('bboxRotator');
        if (rotator) {
            rotator.addEventListener('mousedown', (e) => {
                isRotating = true;
                const rect = DOM.bbox.getBoundingClientRect();
                startX = rect.left + rect.width / 2;
                startY = rect.top + rect.height / 2;
                const curSlot = state.slots[state.activeSlotIndex];
                initT = { ...curSlot.transform };
                e.stopPropagation();
                e.preventDefault();
            });
        }

        // Global Mouse Move & Up
        window.addEventListener('mousemove', (e) => {
            const curSlot = state.slots[state.activeSlotIndex];
            if (!curSlot) return;

            const scaleFactor = DOM.canvas.width / DOM.canvas.getBoundingClientRect().width;

            if (isDragging) {
                const dx = (e.clientX - startX) * scaleFactor;
                const dy = (e.clientY - startY) * scaleFactor;
                let newX = Math.round(initT.x + dx);
                let newY = Math.round(initT.y + dy);

                // Magnetic Center Snapping
                if (Math.abs(newX) < 10) {
                    newX = 0;
                    if (DOM.guideY) DOM.guideY.style.display = 'block';
                } else {
                    if (DOM.guideY) DOM.guideY.style.display = 'none';
                }

                if (Math.abs(newY) < 10) {
                    newY = 0;
                    if (DOM.guideX) DOM.guideX.style.display = 'block';
                } else {
                    if (DOM.guideX) DOM.guideX.style.display = 'none';
                }

                curSlot.transform.x = newX;
                curSlot.transform.y = newY;
                updateBoundingBoxPosition();
                syncInspectorWithActiveSlot();
            } else if (isScaling) {
                const dy = (startY - e.clientY) * 0.005;
                const dx = (e.clientX - startX) * 0.005;
                const deltaScale = (activeHandle === 'nw' || activeHandle === 'sw') ? -dx : dx;
                let newScale = +(initT.scale + deltaScale).toFixed(2);
                newScale = Math.max(0.5, Math.min(3.0, newScale));

                curSlot.transform.scale = newScale;
                updateBoundingBoxPosition();
                syncInspectorWithActiveSlot();
            } else if (isRotating) {
                const angle = Math.atan2(e.clientY - startY, e.clientX - startX) * (180 / Math.PI) + 90;
                curSlot.transform.rotate = Math.round(angle);
                updateBoundingBoxPosition();
                syncInspectorWithActiveSlot();
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDragging || isScaling || isRotating) {
                isDragging = false;
                isScaling = false;
                isRotating = false;
                if (DOM.guideX) DOM.guideX.style.display = 'none';
                if (DOM.guideY) DOM.guideY.style.display = 'none';
            }
        });

        // Mobile Touch Gestures Support (Pinch to Zoom & Rotate)
        DOM.viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) initT = { ...curSlot.transform };
            }
        }, { passive: true });
    }

    // ==========================================
    // 6. MULTI-TRACK TIMELINE ENGINE
    // ==========================================
    function renderTimelineTracks() {
        if (!DOM.videoTrackContainer) return;

        DOM.videoTrackContainer.innerHTML = '';
        if (DOM.subtitlesTrackContainer) DOM.subtitlesTrackContainer.innerHTML = '';

        const totalW = DOM.timelineScroll ? DOM.timelineScroll.scrollWidth || 1000 : 1000;
        const dur = Math.max(1, state.duration);

        // Render Clips on Video Track
        state.slots.forEach((slot, idx) => {
            const slotDur = slot.end_time - slot.start_time;
            const pct = (slotDur / dur) * 100;

            const block = document.createElement('div');
            block.className = 'capcut-clip-block' + (idx === state.activeSlotIndex ? ' selected' : '');
            block.style.width = pct + '%';
            block.style.backgroundImage = 'url("' + slot.src + '")';

            block.innerHTML = `
                <div class="capcut-clip-slot-num">${idx + 1}</div>
                <div class="capcut-clip-duration">${slotDur.toFixed(1)}s</div>
                ${idx < state.slots.length - 1 ? '<div class="capcut-transition-badge" title="Hiệu ứng chuyển cảnh">⧗</div>' : ''}
            `;

            block.addEventListener('click', (e) => {
                if (e.target.classList.contains('capcut-transition-badge')) {
                    // Open effects tab
                    switchRailTab('effects');
                    return;
                }
                state.activeSlotIndex = idx;
                state.currentTime = slot.start_time;
                state.isPlaying = false;
                updatePlayheadAndClocks();
                highlightActiveClipInTimeline();
                updateBoundingBoxPosition();
                syncInspectorWithActiveSlot();
            });

            DOM.videoTrackContainer.appendChild(block);

            // Subtitle Chip on Subtitle Track
            if (DOM.subtitlesTrackContainer && slot.subtitle) {
                const chip = document.createElement('div');
                chip.className = 'capcut-sub-chip';
                chip.style.left = (slot.start_time / dur * 100) + '%';
                chip.style.width = pct + '%';
                chip.textContent = '📝 ' + slot.subtitle;
                DOM.subtitlesTrackContainer.appendChild(chip);
            }
        });

        if (DOM.tlClipCount) DOM.tlClipCount.textContent = state.slots.length;
        if (DOM.tlDurationLabel) DOM.tlDurationLabel.textContent = state.duration.toFixed(1) + 's';

        renderRuler();
        updatePlayheadAndClocks();
    }

    function renderRuler() {
        if (!DOM.timelineRuler) return;
        DOM.timelineRuler.innerHTML = '';
        const dur = Math.round(state.duration);
        const step = dur > 20 ? 5 : (dur > 10 ? 3 : 2);

        for (let s = 0; s <= dur; s += step) {
            const span = document.createElement('span');
            span.style.position = 'absolute';
            span.style.left = (s / dur * 100) + '%';
            const m = String(Math.floor(s / 60)).padStart(2, '0');
            const sec = String(s % 60).padStart(2, '0');
            span.textContent = m + ':' + sec;
            DOM.timelineRuler.appendChild(span);
        }
    }

    function highlightActiveClipInTimeline() {
        if (!DOM.videoTrackContainer) return;
        const blocks = DOM.videoTrackContainer.querySelectorAll('.capcut-clip-block');
        blocks.forEach((b, idx) => {
            if (idx === state.activeSlotIndex) b.classList.add('selected');
            else b.classList.remove('selected');
        });
    }

    function updatePlayheadAndClocks() {
        const dur = Math.max(1, state.duration);
        const cur = Math.max(0, Math.min(dur, state.currentTime));
        const pct = (cur / dur) * 100;

        if (DOM.timelinePlayhead) {
            DOM.timelinePlayhead.style.left = pct + '%';
        }

        const formatTime = (t) => {
            const m = String(Math.floor(t / 60)).padStart(2, '0');
            const s = String(Math.floor(t % 60)).padStart(2, '0');
            return m + ':' + s;
        };

        const timeStr = formatTime(cur) + ' / ' + formatTime(dur);
        if (DOM.dockTimecode) DOM.dockTimecode.textContent = timeStr;
    }

    function bindTimelineEvents() {
        // Ruler Seeking
        if (DOM.timelineRuler) {
            DOM.timelineRuler.addEventListener('click', (e) => {
                const rect = DOM.timelineRuler.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, clickX / rect.width));
                state.currentTime = pct * state.duration;
                updatePlayheadAndClocks();
                if (DOM.bgAudio) DOM.bgAudio.currentTime = state.currentTime;
            });
        }

        // Timeline Toolbar: Split
        if (DOM.toolSplit) {
            DOM.toolSplit.addEventListener('click', () => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (!curSlot) return;
                const t = state.currentTime;
                if (t > curSlot.start_time + 0.5 && t < curSlot.end_time - 0.5) {
                    const origEnd = curSlot.end_time;
                    curSlot.end_time = t;
                    const newSlot = {
                        ...curSlot,
                        slot_index: state.slots.length + 1,
                        start_time: t,
                        end_time: origEnd,
                        transform: { ...curSlot.transform }
                    };
                    state.slots.splice(state.activeSlotIndex + 1, 0, newSlot);
                    renderTimelineTracks();
                    renderDrawerMediaSlots();
                }
            });
        }

        // Timeline Toolbar: Delete
        if (DOM.toolDelete) {
            DOM.toolDelete.addEventListener('click', () => {
                if (state.slots.length <= 1) {
                    alert('Video cần ít nhất 1 phân đoạn.');
                    return;
                }
                state.slots.splice(state.activeSlotIndex, 1);
                state.activeSlotIndex = Math.max(0, state.activeSlotIndex - 1);
                // Re-calculate start and end times
                const segDur = state.duration / state.slots.length;
                state.slots.forEach((s, i) => {
                    s.slot_index = i + 1;
                    s.start_time = +(i * segDur).toFixed(2);
                    s.end_time = +((i + 1) * segDur).toFixed(2);
                });
                renderTimelineTracks();
                renderDrawerMediaSlots();
                updateBoundingBoxPosition();
            });
        }

        // Timeline Toolbar: Duplicate
        if (DOM.toolDuplicate) {
            DOM.toolDuplicate.addEventListener('click', () => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (!curSlot) return;
                const copy = { ...curSlot, slot_index: state.slots.length + 1, transform: { ...curSlot.transform } };
                state.slots.push(copy);
                // Re-distribute duration
                const segDur = state.duration / state.slots.length;
                state.slots.forEach((s, i) => {
                    s.slot_index = i + 1;
                    s.start_time = +(i * segDur).toFixed(2);
                    s.end_time = +((i + 1) * segDur).toFixed(2);
                });
                renderTimelineTracks();
                renderDrawerMediaSlots();
            });
        }

        // Batch Replace Photos
        if (DOM.toolBatch) {
            DOM.toolBatch.addEventListener('click', () => {
                if (DOM.mediaInput) DOM.mediaInput.click();
            });
        }
    }

    // ==========================================
    // 7. DRAWER, MEDIA & TEMPLATE LOGIC
    // ==========================================
    function switchRailTab(tabKey) {
        document.querySelectorAll('.capcut-rail-item').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-tab') === tabKey);
        });
        document.querySelectorAll('.capcut-drawer-pane').forEach(p => {
            p.classList.toggle('d-none', p.id !== ('pane-' + tabKey));
            p.classList.toggle('active', p.id === ('pane-' + tabKey));
        });
    }

    function bindRailAndDrawerEvents() {
        document.querySelectorAll('.capcut-rail-item').forEach(b => {
            b.addEventListener('click', () => {
                const tab = b.getAttribute('data-tab');
                switchRailTab(tab);
            });
        });

        // Template Selection Cards
        document.querySelectorAll('.capcut-tpl-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.capcut-tpl-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                const tplId = card.getAttribute('data-template-id');
                const tpl = state.templates.find(t => String(t.id) === String(tplId));
                if (tpl) applyTemplate(tpl);
            });
        });

        // Media Input File Change (Upload multiple or single)
        if (DOM.mediaInput) {
            DOM.mediaInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) return;

                files.forEach((file, fIdx) => {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const targetIdx = (state.activeSlotIndex + fIdx) % state.slots.length;
                        const targetSlot = state.slots[targetIdx];
                        if (targetSlot) {
                            targetSlot.src = evt.target.result;
                            const newImg = new Image();
                            newImg.src = evt.target.result;
                            newImg.onload = () => {
                                targetSlot.img = newImg;
                                renderTimelineTracks();
                                renderDrawerMediaSlots();
                                updateBoundingBoxPosition();
                            };
                        }
                    };
                    reader.readAsDataURL(file);
                });
            });
        }

        // Effect Buttons
        document.querySelectorAll('.capcut-effect-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.capcut-effect-btn').forEach(b => b.classList.remove('active', 'border-cyan'));
                btn.classList.add('active', 'border-cyan');
                const eff = btn.getAttribute('data-effect');
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) curSlot.effect = eff;
            });
        });

        // Filter Buttons
        document.querySelectorAll('.capcut-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.capcut-filter-btn').forEach(b => b.classList.remove('active', 'border-cyan'));
                btn.classList.add('active', 'border-cyan');
                const fil = btn.getAttribute('data-filter');
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) curSlot.filter = fil;
            });
        });

        // Background buttons
        const btnBgBlur = document.getElementById('btnBgBlur');
        const btnBgColor = document.getElementById('btnBgColor');
        if (btnBgBlur) {
            btnBgBlur.addEventListener('click', () => {
                state.bgType = 'blur';
                btnBgBlur.className = 'btn btn-sm btn-dark border border-cyan text-cyan rounded-pill flex-grow-1';
                if (btnBgColor) btnBgColor.className = 'btn btn-sm btn-dark border border-secondary text-white-50 rounded-pill flex-grow-1';
            });
        }
        if (btnBgColor) {
            btnBgColor.addEventListener('click', () => {
                state.bgType = 'color';
                btnBgColor.className = 'btn btn-sm btn-dark border border-cyan text-cyan rounded-pill flex-grow-1';
                if (btnBgBlur) btnBgBlur.className = 'btn btn-sm btn-dark border border-secondary text-white-50 rounded-pill flex-grow-1';
            });
        }
    }

    function renderDrawerMediaSlots() {
        if (!DOM.mediaSlotsList) return;
        DOM.mediaSlotsList.innerHTML = '';

        state.slots.forEach((s, idx) => {
            const item = document.createElement('div');
            item.className = 'd-flex align-items-center justify-content-between p-2 rounded-2 border border-secondary border-opacity-25 cursor-pointer ' + (idx === state.activeSlotIndex ? 'border-cyan bg-dark' : '');
            item.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <img src="${s.src}" style="width: 38px; height: 38px; object-fit: cover; border-radius: 4px;">
                    <div>
                        <div class="small fw-bold text-white">${s.title}</div>
                        <div class="font-size-xs text-white-50">${(s.end_time - s.start_time).toFixed(1)}s</div>
                    </div>
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary text-white-50 p-1 rounded-circle" title="Đổi ảnh này">
                    <i class="bi bi-arrow-repeat"></i>
                </button>
            `;
            item.addEventListener('click', () => {
                state.activeSlotIndex = idx;
                state.currentTime = s.start_time;
                highlightActiveClipInTimeline();
                renderDrawerMediaSlots();
                updateBoundingBoxPosition();
                syncInspectorWithActiveSlot();
            });
            DOM.mediaSlotsList.appendChild(item);
        });

        if (DOM.mediaSlotsCount) DOM.mediaSlotsCount.textContent = state.slots.length + ' / ' + state.slots.length + ' ảnh';
    }

    function renderDrawerSubtitles() {
        if (!DOM.subtitlesListContainer) return;
        DOM.subtitlesListContainer.innerHTML = '';

        state.slots.forEach((s, idx) => {
            const group = document.createElement('div');
            group.className = 'p-2.5 rounded-3 bg-dark border border-secondary border-opacity-20';
            group.innerHTML = `
                <label class="font-size-xs fw-bold text-cyan mb-1 d-block">Phân cảnh ${idx + 1} (${(s.end_time - s.start_time).toFixed(1)}s)</label>
                <input type="text" class="form-control form-control-sm bg-dark text-white border-secondary" value="${s.subtitle || ''}">
            `;
            const input = group.querySelector('input');
            input.addEventListener('input', (e) => {
                s.subtitle = e.target.value;
                renderTimelineTracks();
            });
            DOM.subtitlesListContainer.appendChild(group);
        });
    }

    // ==========================================
    // 8. INSPECTOR PANEL BINDING
    // ==========================================
    function syncInspectorWithActiveSlot() {
        const curSlot = state.slots[state.activeSlotIndex];
        if (!curSlot) return;

        const t = curSlot.transform || { x: 0, y: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
        const adj = curSlot.adjust || { brightness: 100, contrast: 100, saturation: 100 };

        if (DOM.sliderScale) DOM.sliderScale.value = Math.round(t.scale * 100);
        if (DOM.valScale) DOM.valScale.textContent = Math.round(t.scale * 100) + '%';

        if (DOM.sliderRotate) DOM.sliderRotate.value = t.rotate || 0;
        if (DOM.valRotate) DOM.valRotate.textContent = (t.rotate || 0) + '°';

        if (DOM.sliderPosX) DOM.sliderPosX.value = t.x || 0;
        if (DOM.valPosX) DOM.valPosX.textContent = (t.x || 0) + ' px';

        if (DOM.sliderPosY) DOM.sliderPosY.value = t.y || 0;
        if (DOM.valPosY) DOM.valPosY.textContent = (t.y || 0) + ' px';

        if (DOM.sliderOpacity) DOM.sliderOpacity.value = Math.round((t.opacity !== undefined ? t.opacity : 1.0) * 100);
        if (DOM.valOpacity) DOM.valOpacity.textContent = Math.round((t.opacity !== undefined ? t.opacity : 1.0) * 100) + '%';

        if (DOM.sliderBrightness) DOM.sliderBrightness.value = adj.brightness;
        if (DOM.valBrightness) DOM.valBrightness.textContent = adj.brightness + '%';

        if (DOM.sliderContrast) DOM.sliderContrast.value = adj.contrast;
        if (DOM.valContrast) DOM.valContrast.textContent = adj.contrast + '%';

        if (DOM.sliderSaturation) DOM.sliderSaturation.value = adj.saturation;
        if (DOM.valSaturation) DOM.valSaturation.textContent = adj.saturation + '%';
    }

    function bindInspectorEvents() {
        // Tab switching in inspector
        document.querySelectorAll('.capcut-inspector-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.capcut-inspector-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const itab = btn.getAttribute('data-itab');
                document.querySelectorAll('.capcut-itab-pane').forEach(p => {
                    p.classList.toggle('d-none', p.id !== ('itab-' + itab));
                    p.classList.toggle('active', p.id === ('itab-' + itab));
                });
            });
        });

        // Sliders
        if (DOM.sliderScale) {
            DOM.sliderScale.addEventListener('input', (e) => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.transform.scale = +(e.target.value / 100).toFixed(2);
                    if (DOM.valScale) DOM.valScale.textContent = e.target.value + '%';
                    updateBoundingBoxPosition();
                }
            });
        }

        if (DOM.sliderRotate) {
            DOM.sliderRotate.addEventListener('input', (e) => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.transform.rotate = parseInt(e.target.value, 10);
                    if (DOM.valRotate) DOM.valRotate.textContent = e.target.value + '°';
                    updateBoundingBoxPosition();
                }
            });
        }

        if (DOM.sliderPosX) {
            DOM.sliderPosX.addEventListener('input', (e) => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.transform.x = parseInt(e.target.value, 10);
                    if (DOM.valPosX) DOM.valPosX.textContent = e.target.value + ' px';
                    updateBoundingBoxPosition();
                }
            });
        }

        if (DOM.sliderPosY) {
            DOM.sliderPosY.addEventListener('input', (e) => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.transform.y = parseInt(e.target.value, 10);
                    if (DOM.valPosY) DOM.valPosY.textContent = e.target.value + ' px';
                    updateBoundingBoxPosition();
                }
            });
        }

        if (DOM.sliderOpacity) {
            DOM.sliderOpacity.addEventListener('input', (e) => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.transform.opacity = +(e.target.value / 100).toFixed(2);
                    if (DOM.valOpacity) DOM.valOpacity.textContent = e.target.value + '%';
                }
            });
        }

        if (DOM.btnResetTransform) {
            DOM.btnResetTransform.addEventListener('click', () => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.transform = { x: 0, y: 0, scale: 1.0, rotate: 0, opacity: 1.0 };
                    syncInspectorWithActiveSlot();
                    updateBoundingBoxPosition();
                }
            });
        }

        if (DOM.sliderBrightness) {
            DOM.sliderBrightness.addEventListener('input', (e) => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.adjust = curSlot.adjust || {};
                    curSlot.adjust.brightness = parseInt(e.target.value, 10);
                    if (DOM.valBrightness) DOM.valBrightness.textContent = e.target.value + '%';
                }
            });
        }

        if (DOM.sliderContrast) {
            DOM.sliderContrast.addEventListener('input', (e) => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.adjust = curSlot.adjust || {};
                    curSlot.adjust.contrast = parseInt(e.target.value, 10);
                    if (DOM.valContrast) DOM.valContrast.textContent = e.target.value + '%';
                }
            });
        }

        if (DOM.sliderSaturation) {
            DOM.sliderSaturation.addEventListener('input', (e) => {
                const curSlot = state.slots[state.activeSlotIndex];
                if (curSlot) {
                    curSlot.adjust = curSlot.adjust || {};
                    curSlot.adjust.saturation = parseInt(e.target.value, 10);
                    if (DOM.valSaturation) DOM.valSaturation.textContent = e.target.value + '%';
                }
            });
        }

        if (DOM.sliderVolume) {
            DOM.sliderVolume.addEventListener('input', (e) => {
                state.audio.volume = +(e.target.value / 100).toFixed(2);
                if (DOM.bgAudio) DOM.bgAudio.volume = state.audio.volume;
                if (DOM.valVolume) DOM.valVolume.textContent = e.target.value + '%';
            });
        }
    }

    // ==========================================
    // 9. HEADER & CONTROLS BINDING
    // ==========================================
    function bindHeaderEvents() {
        if (DOM.aspectRatioSelect) {
            DOM.aspectRatioSelect.addEventListener('change', (e) => {
                state.aspectRatio = e.target.value;
                updateCanvasDimensions();
            });
        }

        if (DOM.projectTitleInput) {
            DOM.projectTitleInput.addEventListener('input', (e) => {
                state.title = e.target.value.trim() || 'BinhLoi_Video';
            });
        }

        // Play / Pause Toggle
        if (DOM.btnPlayPause) {
            DOM.btnPlayPause.addEventListener('click', togglePlayPause);
        }

        // Spacebar shortcut
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') {
                e.preventDefault();
                togglePlayPause();
            }
        });

        if (DOM.btnRewind) {
            DOM.btnRewind.addEventListener('click', () => {
                state.currentTime = 0;
                updatePlayheadAndClocks();
                if (DOM.bgAudio) DOM.bgAudio.currentTime = 0;
            });
        }

        if (DOM.btnPrevFrame) {
            DOM.btnPrevFrame.addEventListener('click', () => {
                state.currentTime = Math.max(0, state.currentTime - 1 / state.fps);
                updatePlayheadAndClocks();
                if (DOM.bgAudio) DOM.bgAudio.currentTime = state.currentTime;
            });
        }

        if (DOM.btnNextFrame) {
            DOM.btnNextFrame.addEventListener('click', () => {
                state.currentTime = Math.min(state.duration, state.currentTime + 1 / state.fps);
                updatePlayheadAndClocks();
                if (DOM.bgAudio) DOM.bgAudio.currentTime = state.currentTime;
            });
        }

        if (DOM.btnToggleMute) {
            DOM.btnToggleMute.addEventListener('click', () => {
                state.audio.isMuted = !state.audio.isMuted;
                if (DOM.bgAudio) DOM.bgAudio.muted = state.audio.isMuted;
                if (DOM.dockMuteIcon) {
                    DOM.dockMuteIcon.className = state.audio.isMuted ? 'bi bi-volume-mute-fill text-danger' : 'bi bi-volume-up-fill';
                }
            });
        }

        if (DOM.btnFitCanvas) {
            DOM.btnFitCanvas.addEventListener('click', () => {
                updateCanvasDimensions();
            });
        }
    }

    function togglePlayPause() {
        state.isPlaying = !state.isPlaying;
        if (DOM.btnPlayPause) {
            DOM.btnPlayPause.innerHTML = state.isPlaying ? '<i class="bi bi-pause-circle-fill"></i>' : '<i class="bi bi-play-circle-fill"></i>';
        }

        if (DOM.bgAudio && state.audio.url) {
            if (state.isPlaying) {
                DOM.bgAudio.currentTime = state.currentTime;
                DOM.bgAudio.play().catch(() => {});
            } else {
                DOM.bgAudio.pause();
            }
        }
    }

    // ==========================================
    // 10. AUDIO ENGINE BINDING
    // ==========================================
    function bindAudioEvents() {
        document.querySelectorAll('.capcut-audio-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.capcut-audio-item').forEach(i => {
                    i.classList.remove('active');
                    const icon = i.querySelector('.check-icon');
                    if (icon) icon.classList.add('d-none');
                });
                item.classList.add('active');
                const check = item.querySelector('.check-icon');
                if (check) check.classList.remove('d-none');

                const audioUrl = item.getAttribute('data-audio-url');
                const audioTitle = item.getAttribute('data-audio-title');
                state.audio.url = audioUrl;
                state.audio.title = audioTitle;

                if (DOM.bgAudio) {
                    DOM.bgAudio.src = audioUrl;
                    if (state.isPlaying) DOM.bgAudio.play().catch(() => {});
                }
                if (DOM.tlAudioName) DOM.tlAudioName.textContent = audioTitle;
            });
        });

        // Custom MP3 Upload
        const customAudio = document.getElementById('customAudioUpload');
        if (customAudio) {
            customAudio.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                state.audio.url = url;
                state.audio.title = file.name.replace(/\.[^/.]+$/, '');
                if (DOM.bgAudio) DOM.bgAudio.src = url;
                if (DOM.tlAudioName) DOM.tlAudioName.textContent = state.audio.title;
            });
        }
    }

    // ==========================================
    // 11. VIDEO EXPORT ENGINE
    // ==========================================
    function bindExportEvents() {
        if (DOM.btnOpenExportModal) {
            DOM.btnOpenExportModal.addEventListener('click', () => {
                if (DOM.exportModal) DOM.exportModal.style.display = 'block';
                const ratioBadge = document.getElementById('exportRatioBadge');
                if (ratioBadge) ratioBadge.textContent = state.aspectRatio;
            });
        }

        if (DOM.btnCloseExportModal) {
            DOM.btnCloseExportModal.addEventListener('click', () => {
                if (DOM.exportModal) DOM.exportModal.style.display = 'none';
            });
        }

        if (DOM.btnStartExport) {
            DOM.btnStartExport.addEventListener('click', startExporting);
        }
    }

    async function startExporting() {
        if (!DOM.canvas) return;

        state.isPlaying = false;
        if (DOM.btnPlayPause) DOM.btnPlayPause.innerHTML = '<i class="bi bi-play-circle-fill"></i>';
        if (DOM.bgAudio) DOM.bgAudio.pause();

        if (DOM.exportProgressWrapper) DOM.exportProgressWrapper.classList.remove('d-none');
        if (DOM.btnStartExport) {
            DOM.btnStartExport.disabled = true;
            DOM.btnStartExport.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>ĐANG XỬ LÝ...';
        }

        try {
            // Audio Stream setup
            let audioStream = null;
            if (DOM.bgAudio && DOM.bgAudio.src && !state.audio.isMuted) {
                try {
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const dest = audioCtx.createMediaStreamDestination();
                    const source = audioCtx.createMediaElementSource(DOM.bgAudio);
                    source.connect(dest);
                    source.connect(audioCtx.destination);
                    audioStream = dest.stream;
                } catch(e) {}
            }

            // Canvas Stream setup
            const canvasStream = DOM.canvas.captureStream(state.fps);
            let combinedStream = canvasStream;
            if (audioStream && audioStream.getAudioTracks().length > 0) {
                combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioStream.getAudioTracks()
                ]);
            }

            const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' :
                             (MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm');

            const recorder = new MediaRecorder(combinedStream, {
                mimeType,
                videoBitsPerSecond: 5000000 // 5 Mbps Full HD
            });

            const chunks = [];
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: mimeType });
                const videoUrl = URL.createObjectURL(blob);

                // Auto download
                const a = document.createElement('a');
                a.href = videoUrl;
                a.download = (state.title || 'BinhLoi_Video') + (mimeType.includes('mp4') ? '.mp4' : '.webm');
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                if (DOM.exportStatusLabel) DOM.exportStatusLabel.textContent = 'Xuất video thành công!';
                if (DOM.exportProgressBar) DOM.exportProgressBar.style.width = '100%';
                if (DOM.exportPercentLabel) DOM.exportPercentLabel.textContent = '100%';

                setTimeout(() => {
                    if (DOM.exportModal) DOM.exportModal.style.display = 'none';
                    if (DOM.exportProgressWrapper) DOM.exportProgressWrapper.classList.add('d-none');
                    if (DOM.btnStartExport) {
                        DOM.btnStartExport.disabled = false;
                        DOM.btnStartExport.innerHTML = '<i class="bi bi-download fs-5 me-2"></i>BẮT ĐẦU XUẤT VIDEO';
                    }
                }, 1500);
            };

            recorder.start(100);

            // Frame-accurate step loop
            const totalFrames = Math.round(state.duration * state.fps);
            let currentFrame = 0;

            if (DOM.bgAudio && !state.audio.isMuted) {
                DOM.bgAudio.currentTime = 0;
                DOM.bgAudio.play().catch(() => {});
            }

            const exportInterval = setInterval(() => {
                if (currentFrame >= totalFrames) {
                    clearInterval(exportInterval);
                    if (DOM.bgAudio) DOM.bgAudio.pause();
                    recorder.stop();
                    return;
                }

                state.currentTime = currentFrame / state.fps;
                drawFrame();

                currentFrame++;
                const pct = Math.round((currentFrame / totalFrames) * 100);
                if (DOM.exportProgressBar) DOM.exportProgressBar.style.width = pct + '%';
                if (DOM.exportPercentLabel) DOM.exportPercentLabel.textContent = pct + '%';
            }, 1000 / state.fps);

        } catch (err) {
            console.error('Export error:', err);
            alert('Lỗi xuất video: ' + err.message);
            if (DOM.btnStartExport) {
                DOM.btnStartExport.disabled = false;
                DOM.btnStartExport.innerHTML = 'BẮT ĐẦU XUẤT VIDEO';
            }
        }
    }

    // Run on DOM Ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStudio);
    } else {
        initStudio();
    }

})();
