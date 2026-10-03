/**
 * BÌNH LỢI STUDIO — MODERN LIGHT THEME VIDEO EDITOR CLIENT ENGINE
 * Hỗ trợ tạo video ngắn chuyên nghiệp cho Bình Lợi Studio với Mẫu Video, Multi-Track Timeline & Audio
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- CANVAS & CONTEXT SETUP ---
    const canvas = document.getElementById('videoCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const audioEl = document.getElementById('soundscapeAudio');
    const previewAudioEl = document.getElementById('previewAudioElement');
    const canvasWrapper = document.getElementById('canvasWrapper');

    if (audioEl) audioEl.loop = true;

    // --- DOM REFERENCES ---
    const fileInput = document.getElementById('media-files');
    const dropzone = document.getElementById('dropzone');
    const presetPhotosGrid = document.getElementById('presetPhotosGrid');
    const btnLoadAllPresetPhotos = document.getElementById('btnLoadAllPresetPhotos');
    const myUploadedMediaWrapper = document.getElementById('myUploadedMediaWrapper');
    const myUploadedMediaGrid = document.getElementById('myUploadedMediaGrid');
    const templateCardsContainer = document.getElementById('templateCardsContainer');

    // Subtitle Inputs
    const textHookInput = document.getElementById('text-hook');
    const textImmersionInput = document.getElementById('text-immersion');
    const textHighlightInput = document.getElementById('text-highlight');
    const textOutroInput = document.getElementById('text-outro');
    const btnAddNewText = document.getElementById('btnAddNewText');

    // Audio Inputs & Cards
    const soundCards = document.querySelectorAll('.bl-audio-card');
    const userAudioFileInput = document.getElementById('userAudioFile');
    const userAudioBadgeWrapper = document.getElementById('userAudioBadgeWrapper');
    const userAudioTitle = document.getElementById('userAudioTitle');
    const btnPreviewUserAudio = document.getElementById('btnPreviewUserAudio');
    const btnSelectUserAudio = document.getElementById('btnSelectUserAudio');

    // Effect, Filter, Ratio, Transition & Speed Cards
    const effectCards = document.querySelectorAll('.bl-effect-card');
    const filterCards = document.querySelectorAll('.bl-filter-card');
    const transitionCards = document.querySelectorAll('.bl-transition-card');
    const ratioCards = document.querySelectorAll('.bl-ratio-card');
    const speedButtons = document.querySelectorAll('.bl-speed-btn');
    const transDurationSlider = document.getElementById('transDurationSlider');
    const transDurationVal = document.getElementById('transDurationVal');

    // Monitor Controls
    const playOverlayBtn = document.getElementById('playOverlayBtn');
    const monitorPlayToggle = document.getElementById('monitorPlayToggle');
    const btnHeaderPlay = document.getElementById('btnHeaderPlay');
    const btnTimelinePlayIcon = document.getElementById('btnTimelinePlayIcon');
    const playerTimeLabel = document.getElementById('player-time');
    const projectTitleInput = document.getElementById('projectTitleInput');
    const saveStatusIndicator = document.getElementById('saveStatusIndicator');
    const btnSaveProject = document.getElementById('btnSaveProject');
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');

    // Properties Panel
    const propPanelDefault = document.getElementById('propPanelDefault');
    const propPanelText = document.getElementById('propPanelText');
    const propPanelClip = document.getElementById('propPanelClip');
    const propPanelTitle = document.getElementById('propPanelTitle');
    const propPanelBadge = document.getElementById('propPanelBadge');
    const propTextInput = document.getElementById('propTextInput');
    const propFontFamily = document.getElementById('propFontFamily');
    const propFontSize = document.getElementById('propFontSize');
    const propTextColor = document.getElementById('propTextColor');
    const propTextAnimation = document.getElementById('propTextAnimation');
    const btnPropBold = document.getElementById('btnPropBold');
    const btnPropItalic = document.getElementById('btnPropItalic');
    const btnPropUnderline = document.getElementById('btnPropUnderline');
    const btnAlignCenter = document.getElementById('btnAlignCenter');
    const clipDurationSlider = document.getElementById('clipDurationSlider');
    const clipDurationLabel = document.getElementById('clipDurationLabel');
    const clipScaleSlider = document.getElementById('clipScaleSlider');
    const clipScaleLabel = document.getElementById('clipScaleLabel');
    const clipBrightnessSlider = document.getElementById('clipBrightnessSlider');
    const clipBrightnessLabel = document.getElementById('clipBrightnessLabel');
    const propClipName = document.getElementById('propClipName');
    const btnDeleteSelectedClip = document.getElementById('btnDeleteSelectedClip');

    // Overview Labels
    const overviewRatioLabel = document.getElementById('overviewRatioLabel');
    const overviewDurationLabel = document.getElementById('overviewDurationLabel');
    const overviewClipsCount = document.getElementById('overviewClipsCount');

    // Timeline Elements
    const timelineContainer = document.getElementById('timelineContainer');
    const timeRuler = document.getElementById('timeRuler');
    const timelinePlayhead = document.getElementById('timelinePlayhead');
    const videoTrackSlots = document.getElementById('videoTrackSlots');
    const textTrackSlots = document.getElementById('textTrackSlots');
    const audioTrackSlot = document.getElementById('audioTrackSlot');
    const timelineClipsBadge = document.getElementById('timelineClipsBadge');
    const timelineDurationBadge = document.getElementById('timelineDurationBadge');
    const btnTimelineZoomIn = document.getElementById('btnTimelineZoomIn');
    const btnTimelineZoomOut = document.getElementById('btnTimelineZoomOut');
    const btnTimelineSplit = document.getElementById('btnTimelineSplit');
    const btnTimelineDelete = document.getElementById('btnTimelineDelete');

    // Export Modal & Controls
    const btnOpenExportModal = document.getElementById('btnOpenExportModal');
    const startExportProcessBtn = document.getElementById('startExportProcessBtn');
    const exportStatusPanel = document.getElementById('exportStatusPanel');
    const exportStatusText = document.getElementById('exportStatusText');
    const exportPercentText = document.getElementById('exportPercentText');
    const exportProgressBar = document.getElementById('exportProgressBar');
    const exportSuccessPanel = document.getElementById('exportSuccessPanel');
    const exportTriggerWrapper = document.getElementById('exportTriggerWrapper');
    const btnDownloadAgain = document.getElementById('btnDownloadAgain');
    const exportFileNameInput = document.getElementById('exportFileName');

    // Template Applied Modal Controls
    const tplAppliedTitle = document.getElementById('tplAppliedTitle');
    const tplAppliedDesc = document.getElementById('tplAppliedDesc');
    const tplAppliedBadges = document.getElementById('tplAppliedBadges');
    const btnUseTemplateSamplePhotos = document.getElementById('btnUseTemplateSamplePhotos');
    const btnUploadOwnPhotosForTemplate = document.getElementById('btnUploadOwnPhotosForTemplate');

    // --- CURATED BÌNH LỢI PRESET PHOTOS ---
    const BINH_LOI_PRESET_PHOTOS = [
        { id: 'p1', title: 'Làng Mai Vàng', desc: 'Thủ phủ mai vàng Nam Bộ', url: '/images/Poster 1.jpg' },
        { id: 'p2', title: 'Vườn Mai Trổ Bông', desc: 'Sắc vàng rực rỡ đón xuân', url: '/images/Poster 2.jpg' },
        { id: 'p3', title: 'Đường Làng Miệt Vườn', desc: 'Bình yên bên bóng dừa xanh', url: '/images/Poster 3.jpg' },
        { id: 'p4', title: 'Bờ Kênh Sông Nước', desc: 'Hoàng hôn thanh mát hữu tình', url: '/images/Poster 4.jpg' },
        { id: 'p5', title: 'Đình Bình Trường', desc: 'Di tích văn hóa trăm năm', url: '/images/Poster 5.jpg' },
        { id: 'p6', title: 'Cùng Yên Lan Tỏa', desc: 'Hành trình chữa lành tâm hồn', url: '/images/cung-yen-lan-toa.jpg' }
    ];

    // --- MẪU VIDEO BÌNH LỢI STUDIO ---
    const BINH_LOI_TEMPLATES = [
        {
            id: 'tpl-healing',
            title: 'Chữa Lành Tâm Hồn',
            category: 'healing',
            tag: 'Hot Nhất',
            tagColor: 'bg-danger',
            desc: 'Khoảnh khắc bình yên, hoàng hôn miệt vườn và làng hoa mai',
            audioUrl: '/media/audio_dest_0b57e070-85fa-4edd-8abe-c42cf75c15e5.mp3',
            audioName: 'Bình Lợi - Chữa Lành Tâm Hồn',
            requiredClips: 4,
            clipDuration: 3.75,
            totalDuration: 15,
            transition: 'crossdissolve',
            filter: 'warm',
            subtitles: {
                hook: 'Rời xa khói bụi thành phố, về Bình Lợi thôi 🌿',
                immersion: 'Bình yên lắng đọng trong từng nhịp thở',
                highlight: 'Chữa lành từ những điều mộc mạc và chân thành nhất',
                outro: 'Hẹn một ngày gần nhất tại Bình Lợi nhé!'
            },
            samplePhotos: ['p1', 'p2', 'p3', 'p4'],
            cover: '/images/Poster 1.jpg'
        },
        {
            id: 'tpl-sen-koi',
            title: 'Làng Sen & Trải Nghiệm Cá Koi',
            category: 'vlog',
            tag: 'Thịnh Hành',
            tagColor: 'bg-success',
            desc: 'Vlog năng động, ngắm hồ sen thơm ngát và cho cá Koi ăn',
            audioUrl: '/media/audio_dest_102f207d-e6d5-40f9-acff-f7eada6eb0ab.mp3',
            audioName: 'Vlog Khám Phá Làng Sen Bình Lợi',
            requiredClips: 5,
            clipDuration: 3.0,
            totalDuration: 15,
            transition: 'slidedown',
            filter: 'vibrant',
            subtitles: {
                hook: '1 ngày trải nghiệm miệt vườn giữa lòng Sài Gòn 🛶',
                immersion: 'Hương sen thanh khiết và đàn cá Koi tung tăng',
                highlight: 'Tự tay chèo xuồng, câu cá, thưởng thức trà sen',
                outro: 'Trải nghiệm đáng thử nhất mùa này!'
            },
            samplePhotos: ['p2', 'p3', 'p4', 'p5', 'p6'],
            cover: '/images/Poster 2.jpg'
        },
        {
            id: 'tpl-sunset',
            title: 'Chill Đồng Quê Hoàng Hôn',
            category: 'chill',
            tag: 'Lofi Chill',
            tagColor: 'bg-primary',
            desc: 'Nhạc Lofi nhẹ nhàng, hoàng hôn buông lơi bên bờ kênh mát rượi',
            audioUrl: '/media/audio_dest_737a0c5c-8cdb-4691-b373-c923d88472f2.mp3',
            audioName: 'Chill Đồng Quê Hoàng Hôn',
            requiredClips: 4,
            clipDuration: 3.75,
            totalDuration: 15,
            transition: 'zoomin',
            filter: 'vintage',
            subtitles: {
                hook: 'Chiều hoàng hôn tuyệt đẹp bên dòng sông xanh 🌅',
                immersion: 'Gió đồng lồng lộng xua tan mọi âu lo',
                highlight: 'Bình từ tâm – Lợi từ tầm 🍃',
                outro: 'Lưu lại để cùng người thương ghé thăm!'
            },
            samplePhotos: ['p4', 'p3', 'p1', 'p5'],
            cover: '/images/Poster 4.jpg'
        },
        {
            id: 'tpl-mai-vang',
            title: 'Vương Quốc Mai Vàng',
            category: 'langmai',
            tag: 'Đặc Sản',
            tagColor: 'bg-warning text-dark',
            desc: 'Thủ phủ Mai Vàng lớn nhất TP.HCM với ngàn sắc hoa rực rỡ',
            audioUrl: '/media/audio_dest_0b57e070-85fa-4edd-8abe-c42cf75c15e5.mp3',
            audioName: 'Bình Lợi - Chữa Lành Tâm Hồn',
            requiredClips: 4,
            clipDuration: 3.75,
            totalDuration: 15,
            transition: 'crossdissolve',
            filter: 'warm',
            subtitles: {
                hook: 'Lạc lối tại vương quốc Mai Vàng Bình Lợi 🌼',
                immersion: 'Những gốc mai cổ thụ hàng chục năm tuổi',
                highlight: 'Tấm lòng nồng hậu của người nông dân làng nghề',
                outro: 'Bình Lợi - Giữ hồn quê giữa nhịp sống mới'
            },
            samplePhotos: ['p1', 'p2', 'p5', 'p6'],
            cover: '/images/Poster 3.jpg'
        },
        {
            id: 'tpl-food',
            title: 'Món Ngon Miệt Vườn',
            category: 'food',
            tag: 'Ẩm Thực',
            tagColor: 'bg-danger',
            desc: 'Thưởng thức ẩm thực Nam Bộ dân dã đậm đà tình quê',
            audioUrl: '/media/audio_dest_102f207d-e6d5-40f9-acff-f7eada6eb0ab.mp3',
            audioName: 'Vlog Khám Phá Làng Sen Bình Lợi',
            requiredClips: 4,
            clipDuration: 3.75,
            totalDuration: 15,
            transition: 'slidedown',
            filter: 'natural',
            subtitles: {
                hook: 'Về Bình Lợi ăn gì cho đúng điệu? 🍲',
                immersion: 'Rau vườn tươi non, cá lóc đồng nướng trui',
                highlight: 'Hương vị quê nhà mộc mạc khó quên',
                outro: 'Lên lịch cuối tuần cùng hội bạn ngay thôi!'
            },
            samplePhotos: ['p3', 'p4', 'p6', 'p1'],
            cover: '/images/cung-yen-lan-toa.jpg'
        }
    ];

    // --- STUDIO CORE STATE (Clean & Empty by default) ---
    let clips = []; // Clean: no clips by default
    let userUploadedItems = []; // Clean: no user uploads by default
    let videoDuration = 15; // 15s default
    let playbackSpeed = 1.0;
    let selectedRatio = '9:16';
    let currentFilter = 'natural';
    let currentEffect = 'kenburns';
    let currentTransition = 'crossdissolve';
    let transitionDuration = 0.5;
    let activeTemplateId = null;

    const STUDIO_RATIOS = {
        '9:16': { aspectRatio: '9 / 16', width: 540, height: 960, label: '9:16 Dọc' },
        '16:9': { aspectRatio: '16 / 9', width: 960, height: 540, label: '16:9 Ngang' },
        '1:1': { aspectRatio: '1 / 1', width: 720, height: 720, label: '1:1 Vuông' },
        '4:5': { aspectRatio: '4 / 5', width: 576, height: 720, label: '4:5 Dọc ngắn' }
    };

    // Audio State (Empty by default)
    let selectedAudioUrl = '';
    let selectedAudioName = '';
    let isMuted = false;
    let masterVolume = 0.8;

    // Studio Brand Logo (Preloaded for watermark)
    const studioLogoImg = new Image();
    studioLogoImg.crossOrigin = 'anonymous';
    studioLogoImg.src = '/images/logo.png';

    // Text Properties
    let activeText = {
        font: 'Inter, sans-serif',
        size: 32,
        color: '#FFFFFF',
        isBold: true,
        isItalic: false,
        isUnderline: false,
        align: 'center',
        x: 270,
        y: 840,
        animation: 'none'
    };

    let selectedClipIndex = -1;
    let isTextSelected = false;

    // Playback Engine State
    let isPlaying = false;
    let startTime = 0;
    let elapsedPlayTime = 0; // ms
    let renderFrameId = null;

    // Undo / Redo History
    let historyStack = [];
    let historyPointer = -1;
    const MAX_HISTORY = 20;

    // Web Audio Context for export
    let audioContext = null;
    let audioSource = null;
    let audioDestination = null;

    // Dragging text on canvas
    let isDraggingText = false;
    let dragStartX = 0;
    let dragStartY = 0;

    // Timeline Zoom
    let timelineZoom = 1.0;

    // --- SNAPSHOT & HISTORY HELPERS ---
    function captureState() {
        return JSON.stringify({
            clips: clips.map(c => ({
                id: c.id,
                src: c.src,
                name: c.name,
                durationSec: c.durationSec,
                scale: c.scale || 1.0,
                brightness: c.brightness || 100
            })),
            videoDuration,
            playbackSpeed,
            selectedRatio,
            currentFilter,
            currentEffect,
            currentTransition,
            transitionDuration,
            activeText: { ...activeText },
            subtitles: {
                hook: textHookInput ? textHookInput.value : '',
                immersion: textImmersionInput ? textImmersionInput.value : '',
                highlight: textHighlightInput ? textHighlightInput.value : '',
                outro: textOutroInput ? textOutroInput.value : ''
            },
            selectedAudioUrl,
            selectedAudioName,
            activeTemplateId
        });
    }

    function pushUndoState() {
        const state = captureState();
        if (historyPointer < historyStack.length - 1) {
            historyStack = historyStack.slice(0, historyPointer + 1);
        }
        historyStack.push(state);
        if (historyStack.length > MAX_HISTORY) historyStack.shift();
        historyPointer = historyStack.length - 1;
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        if (btnUndo) btnUndo.disabled = historyPointer <= 0;
        if (btnRedo) btnRedo.disabled = historyPointer >= historyStack.length - 1;
    }

    window.undoStudio = function() {
        if (historyPointer > 0) {
            historyPointer--;
            applyState(historyStack[historyPointer]);
            updateUndoRedoButtons();
        }
    };

    window.redoStudio = function() {
        if (historyPointer < historyStack.length - 1) {
            historyPointer++;
            applyState(historyStack[historyPointer]);
            updateUndoRedoButtons();
        }
    };

    if (btnUndo) btnUndo.addEventListener('click', window.undoStudio);
    if (btnRedo) btnRedo.addEventListener('click', window.redoStudio);

    function applyState(stateJson) {
        if (!stateJson) return;
        const s = JSON.parse(stateJson);
        videoDuration = s.videoDuration || 15;
        playbackSpeed = s.playbackSpeed || 1.0;
        selectedRatio = normalizeStudioRatio(s.selectedRatio);
        applyRatioToCanvas(selectedRatio);
        currentFilter = s.currentFilter || 'natural';
        currentEffect = s.currentEffect || 'kenburns';
        currentTransition = s.currentTransition || 'crossdissolve';
        transitionDuration = s.transitionDuration || 0.5;
        selectedAudioUrl = s.selectedAudioUrl || '';
        selectedAudioName = s.selectedAudioName || '';
        activeTemplateId = s.activeTemplateId || null;

        if (audioEl) {
            if (selectedAudioUrl) {
                if (audioEl.src !== selectedAudioUrl) audioEl.src = selectedAudioUrl;
            } else {
                audioEl.pause();
                audioEl.src = '';
            }
        }

        if (s.activeText) activeText = { ...s.activeText };
        if (s.subtitles) {
            if (textHookInput) textHookInput.value = s.subtitles.hook || '';
            if (textImmersionInput) textImmersionInput.value = s.subtitles.immersion || '';
            if (textHighlightInput) textHighlightInput.value = s.subtitles.highlight || '';
            if (textOutroInput) textOutroInput.value = s.subtitles.outro || '';
        }

        if (Array.isArray(s.clips)) {
            clips = s.clips.map(item => {
                const img = new Image();
                img.src = item.src;
                return {
                    id: item.id,
                    img,
                    src: item.src,
                    name: item.name,
                    durationSec: item.durationSec || 3.75,
                    scale: item.scale || 1.0,
                    brightness: item.brightness || 100
                };
            });
        }

        recalculateClipDurations();
        renderTimeline();
        updateUIFromState();
        drawFrameAt(elapsedPlayTime);
    }

    function updateUIFromState() {
        ratioCards.forEach(c => c.classList.toggle('active', c.getAttribute('data-ratio') === selectedRatio));
        filterCards.forEach(c => c.classList.toggle('active', c.getAttribute('data-filter') === currentFilter));
        effectCards.forEach(c => c.classList.toggle('active', c.getAttribute('data-effect') === currentEffect));
        transitionCards.forEach(c => {
            const isMatch = c.getAttribute('data-trans') === currentTransition;
            c.classList.toggle('active', isMatch);
            const icon = c.querySelector('.check-icon');
            if (icon) icon.classList.toggle('d-none', !isMatch);
        });
        speedButtons.forEach(b => b.classList.toggle('active', Math.abs(parseFloat(b.getAttribute('data-speed')) - playbackSpeed) < 0.05));

        soundCards.forEach(c => {
            const cardUrl = c.getAttribute('data-audio-url');
            c.classList.toggle('active', Boolean(selectedAudioUrl && cardUrl && cardUrl === selectedAudioUrl));
        });

        const slider = document.getElementById('studioSpeedSlider');
        const sliderVal = document.getElementById('sliderSpeedVal');
        const badge = document.getElementById('currentSpeedBadge');
        if (slider) slider.value = playbackSpeed;
        if (sliderVal) sliderVal.innerText = `${playbackSpeed.toFixed(2)}x`;
        if (badge) {
            let label = `${playbackSpeed.toFixed(1)}x`;
            if (playbackSpeed === 0.5) label += ' Chậm';
            else if (playbackSpeed === 1.0) label += ' Chuẩn';
            else if (playbackSpeed === 1.5) label += ' Nhanh';
            else if (playbackSpeed === 2.0) label += ' Siêu tốc';
            badge.innerText = label;
        }

        syncPropertiesPanel();
    }

    function normalizeStudioRatio(ratio) {
        return Object.prototype.hasOwnProperty.call(STUDIO_RATIOS, ratio) ? ratio : '9:16';
    }

    function applyRatioToCanvas(ratio) {
        const config = STUDIO_RATIOS[normalizeStudioRatio(ratio)];
        const monitor = document.getElementById('monitorFrame');

        if (monitor) monitor.style.aspectRatio = config.aspectRatio;
        canvas.width = config.width;
        canvas.height = config.height;
        activeText.x = canvas.width / 2;
        activeText.y = canvas.height - 120;
        if (overviewRatioLabel) overviewRatioLabel.innerText = config.label;
    }

    // --- INITIALIZE TEMPLATES TAB (MẪU VIDEO BÌNH LỢI) ---
    window.renderTemplatesList = function(category = 'all') {
        if (!templateCardsContainer) return;
        templateCardsContainer.innerHTML = '';

        const filtered = (category === 'all') 
            ? BINH_LOI_TEMPLATES 
            : BINH_LOI_TEMPLATES.filter(t => t.category === category);

        filtered.forEach(tpl => {
            const card = document.createElement('div');
            card.className = `bl-template-card p-0 position-relative shadow-2xs mb-3 ${activeTemplateId === tpl.id ? 'border-danger' : ''}`;
            card.innerHTML = `
                <div class="bl-template-cover position-relative" style="height: 125px;">
                    <img src="${tpl.cover}" class="w-100 h-100 object-fit-cover" alt="${tpl.title}" onerror="this.src='/images/brand-logo.png'">
                    <div class="position-absolute top-2 start-2">
                        <span class="badge ${tpl.tagColor} text-white font-size-xs fw-bold shadow-sm">${tpl.tag}</span>
                    </div>
                    <div class="position-absolute top-2 end-2">
                        <span class="badge bg-dark bg-opacity-75 text-white font-size-xs fw-semibold">
                            <i class="bi bi-clock me-1"></i>${tpl.totalDuration}s
                        </span>
                    </div>
                </div>
                <div class="p-3 bg-white">
                    <div class="fw-bold text-dark fs-6 mb-1">${tpl.title}</div>
                    <div class="text-muted x-small mb-2.5 lh-sm">${tpl.desc}</div>
                    <div class="d-flex align-items-center gap-2 mb-3">
                        <span class="badge bg-light text-secondary border font-size-xs">
                            <i class="bi bi-images text-danger me-1"></i>${tpl.requiredClips} Ảnh
                        </span>
                        <span class="badge bg-light text-success border font-size-xs text-truncate" style="max-width: 170px;" title="${tpl.audioName}">
                            <i class="bi bi-music-note me-1"></i>${tpl.audioName}
                        </span>
                    </div>
                    <button type="button" class="btn btn-sm btn-danger bl-template-use-btn w-100 rounded-pill py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-2xs" onclick="applyStudioTemplate('${tpl.id}')">
                        <i class="bi bi-stars fs-6"></i>
                        <span>Sử dụng mẫu này</span>
                    </button>
                </div>
            `;
            templateCardsContainer.appendChild(card);
        });
    };

    window.filterTemplates = function(category) {
        document.querySelectorAll('#templateFilterChips .bl-chip-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('onclick').includes(category));
        });
        renderTemplatesList(category);
    };

    window.applyStudioTemplate = function(tplId) {
        const tpl = BINH_LOI_TEMPLATES.find(t => t.id === tplId);
        if (!tpl) return;

        pushUndoState();
        activeTemplateId = tpl.id;

        // 1. Áp dụng Nhạc nền
        selectedAudioUrl = tpl.audioUrl;
        selectedAudioName = tpl.audioName;
        if (audioEl) {
            audioEl.src = tpl.audioUrl;
            audioEl.currentTime = 0;
        }

        // 2. Áp dụng Kịch bản chữ
        if (textHookInput) textHookInput.value = tpl.subtitles.hook;
        if (textImmersionInput) textImmersionInput.value = tpl.subtitles.immersion;
        if (textHighlightInput) textHighlightInput.value = tpl.subtitles.highlight;
        if (textOutroInput) textOutroInput.value = tpl.subtitles.outro;

        // 3. Áp dụng Chuyển cảnh & Bộ lọc
        currentTransition = tpl.transition;
        currentFilter = tpl.filter;
        videoDuration = tpl.totalDuration;

        updateUIFromState();
        renderTimeline();
        drawFrameAt(0);

        // 4. Mở Modal thông báo & Lựa chọn ảnh nhanh
        if (tplAppliedTitle) tplAppliedTitle.innerText = tpl.title;
        if (tplAppliedDesc) tplAppliedDesc.innerText = tpl.desc;
        if (tplAppliedBadges) {
            tplAppliedBadges.innerHTML = `
                <span class="badge bg-danger text-white">${tpl.requiredClips} Ảnh</span>
                <span class="badge bg-secondary text-white">${tpl.totalDuration} Giây</span>
                <span class="badge bg-success text-white">Nhạc: ${tpl.audioName}</span>
            `;
        }

        // Gắn sự kiện cho nút Dùng ảnh mẫu có sẵn
        if (btnUseTemplateSamplePhotos) {
            btnUseTemplateSamplePhotos.onclick = () => {
                loadTemplateSamplePhotos(tpl.id);
                const modalEl = document.getElementById('blTemplateAppliedModal');
                if (modalEl && window.bootstrap) {
                    const inst = bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                }
            };
        }

        // Gắn sự kiện cho nút Tải ảnh riêng của bạn
        if (btnUploadOwnPhotosForTemplate) {
            btnUploadOwnPhotosForTemplate.onclick = () => {
                const modalEl = document.getElementById('blTemplateAppliedModal');
                if (modalEl && window.bootstrap) {
                    const inst = bootstrap.Modal.getInstance(modalEl);
                    if (inst) inst.hide();
                }
                switchStudioTab('media');
                switchMediaSubTab('my');
                if (fileInput) fileInput.click();
            };
        }

        // Mở Modal
        const modalEl = document.getElementById('blTemplateAppliedModal');
        if (modalEl && window.bootstrap) {
            const modalInstance = new bootstrap.Modal(modalEl);
            modalInstance.show();
        } else {
            showStudioToast(`Đã áp dụng mẫu: ${tpl.title}! Hãy chọn ảnh để hoàn tất video.`, 'success');
        }
    };

    window.loadTemplateSamplePhotos = function(tplId) {
        const tpl = BINH_LOI_TEMPLATES.find(t => t.id === tplId);
        if (!tpl) return;

        pushUndoState();
        clips = []; // Xóa clip cũ

        const photoIds = tpl.samplePhotos || ['p1', 'p2', 'p3', 'p4'];
        let loadedCount = 0;

        photoIds.forEach(pId => {
            const found = BINH_LOI_PRESET_PHOTOS.find(p => p.id === pId);
            if (!found) return;

            const img = new Image();
            img.onload = () => {
                clips.push({
                    id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    img,
                    src: found.url,
                    name: found.title,
                    durationSec: tpl.clipDuration || 3.75,
                    scale: 1.0,
                    brightness: 100
                });
                loadedCount++;
                if (loadedCount >= photoIds.length) {
                    recalculateClipDurations();
                    renderTimeline();
                    drawFrameAt(0);
                    showStudioToast(`Đã nạp ${clips.length} ảnh mẫu cho mẫu "${tpl.title}"! Bấm Xem trước để thưởng thức.`, 'success');
                }
            };
            img.src = found.url;
        });
    };

    // --- PRESET PHOTOS INITIALIZATION ---
    function initPresetPhotos() {
        if (!presetPhotosGrid) return;
        presetPhotosGrid.innerHTML = '';
        BINH_LOI_PRESET_PHOTOS.forEach(photo => {
            const col = document.createElement('div');
            col.className = 'col-6 position-relative';
            col.innerHTML = `
                <div class="bl-preset-thumb-card rounded-3 border overflow-hidden position-relative group cursor-pointer shadow-2xs" style="height: 105px;" onclick="addPresetPhotoToTimeline('${photo.id}')">
                    <img src="${photo.url}" class="w-100 h-100 object-fit-cover" alt="${photo.title}" onerror="this.src='/images/brand-logo.png'">
                    <div class="position-absolute bottom-0 start-0 end-0 p-2 text-white" style="background: linear-gradient(transparent, rgba(0,0,0,0.85));">
                        <div class="fw-bold x-small text-truncate" style="font-size: 0.74rem;">${photo.title}</div>
                    </div>
                    <div class="position-absolute top-2 end-2">
                        <span class="badge bg-danger rounded-pill px-2 py-0.5 font-size-xs fw-bold shadow-sm">
                            <i class="bi bi-plus-lg"></i> Thêm
                        </span>
                    </div>
                </div>
            `;
            presetPhotosGrid.appendChild(col);
        });
    }

    window.addPresetPhotoToTimeline = function(presetId) {
        const found = BINH_LOI_PRESET_PHOTOS.find(p => p.id === presetId);
        if (!found) return;

        pushUndoState();
        const img = new Image();
        img.onload = () => {
            clips.push({
                id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                img,
                src: found.url,
                name: found.title,
                durationSec: 3.75,
                scale: 1.0,
                brightness: 100
            });
            recalculateClipDurations();
            renderTimeline();
            drawFrameAt(elapsedPlayTime);
            showStudioToast(`Đã thêm ảnh: ${found.title}`, 'success');
        };
        img.src = found.url;
    };

    if (btnLoadAllPresetPhotos) {
        btnLoadAllPresetPhotos.addEventListener('click', () => {
            pushUndoState();
            let count = 0;
            BINH_LOI_PRESET_PHOTOS.forEach(photo => {
                const img = new Image();
                img.onload = () => {
                    clips.push({
                        id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        img,
                        src: photo.url,
                        name: photo.title,
                        durationSec: 3.0,
                        scale: 1.0,
                        brightness: 100
                    });
                    count++;
                    if (count >= BINH_LOI_PRESET_PHOTOS.length) {
                        recalculateClipDurations();
                        renderTimeline();
                        drawFrameAt(0);
                        showStudioToast(`Đã thêm toàn bộ ${clips.length} ảnh mẫu Bình Lợi!`, 'success');
                    }
                };
                img.src = photo.url;
            });
        });
    }

    // --- USER MEDIA UPLOAD ---
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleMediaFiles(e.target.files);
        });
    }

    if (dropzone) {
        ['dragenter', 'dragover'].forEach(name => {
            dropzone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('border-danger');
            });
        });
        ['dragleave', 'drop'].forEach(name => {
            dropzone.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('border-danger');
            });
        });
        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            if (dt && dt.files && dt.files.length > 0) {
                handleMediaFiles(dt.files);
            }
        });
    }

    function handleMediaFiles(files) {
        if (!files || files.length === 0) return;
        pushUndoState();
        Array.from(files).forEach(file => {
            const isVideo = file.type.startsWith('video');
            const isImage = file.type.startsWith('image');
            if (!isImage && !isVideo) return;

            const url = URL.createObjectURL(file);
            userUploadedItems.push({
                id: 'my_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                name: file.name,
                url,
                type: isVideo ? 'video' : 'image'
            });

            if (isImage) {
                const img = new Image();
                img.onload = () => {
                    clips.push({
                        id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        img,
                        src: url,
                        name: file.name,
                        durationSec: 3.75,
                        scale: 1.0,
                        brightness: 100
                    });
                    recalculateClipDurations();
                    renderTimeline();
                    renderMyUploadedMedia();
                    drawFrameAt(elapsedPlayTime);
                };
                img.src = url;
            }
        });

        renderMyUploadedMedia();
        showStudioToast('Đã tải lên tệp của bạn!', 'success');
    }

    function renderMyUploadedMedia() {
        if (!myUploadedMediaWrapper || !myUploadedMediaGrid) return;
        if (userUploadedItems.length === 0) {
            myUploadedMediaWrapper.classList.add('d-none');
            return;
        }
        myUploadedMediaWrapper.classList.remove('d-none');
        myUploadedMediaGrid.innerHTML = '';
        userUploadedItems.forEach(item => {
            const col = document.createElement('div');
            col.className = 'col-6';
            col.innerHTML = `
                <div class="rounded-3 border overflow-hidden position-relative shadow-2xs cursor-pointer" style="height: 100px;" onclick="addUploadItemToTimeline('${item.id}')">
                    <img src="${item.url}" class="w-100 h-100 object-fit-cover" alt="${item.name}">
                    <div class="position-absolute bottom-0 start-0 end-0 p-1.5 text-white bg-dark bg-opacity-75">
                        <div class="x-small text-truncate">${item.name}</div>
                    </div>
                </div>
            `;
            myUploadedMediaGrid.appendChild(col);
        });
    }

    window.addUploadItemToTimeline = function(itemId) {
        const item = userUploadedItems.find(i => i.id === itemId);
        if (!item) return;
        pushUndoState();
        const img = new Image();
        img.onload = () => {
            clips.push({
                id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                img,
                src: item.url,
                name: item.name,
                durationSec: 3.75,
                scale: 1.0,
                brightness: 100
            });
            recalculateClipDurations();
            renderTimeline();
            drawFrameAt(elapsedPlayTime);
        };
        img.src = item.url;
    };

    window.clearAllLoadedImages = function() {
        pushUndoState();
        userUploadedItems = [];
        renderMyUploadedMedia();
        showStudioToast('Đã xóa danh sách tệp tải lên.', 'info');
    };

    // --- DURATION CALCULATION ---
    function recalculateClipDurations() {
        if (clips.length === 0) {
            videoDuration = 15;
        } else {
            let total = 0;
            clips.forEach(c => total += (c.durationSec || 3.75));
            videoDuration = Math.max(5, Math.round(total));
        }

        if (overviewDurationLabel) overviewDurationLabel.innerText = `${videoDuration} Giây`;
        if (overviewClipsCount) overviewClipsCount.innerText = `${clips.length} Clips`;
        if (timelineClipsBadge) timelineClipsBadge.innerText = `${clips.length} clips`;

        updateProgressUI();
    }

    // --- TIMELINE RENDERING ---
    function renderTimeline() {
        // 1. Video Track
        if (videoTrackSlots) {
            if (clips.length === 0) {
                videoTrackSlots.innerHTML = `
                    <div class="bl-empty-track-hint d-flex align-items-center justify-content-center w-100 h-100 text-muted x-small cursor-pointer py-2" onclick="switchStudioTab('media')">
                        <i class="bi bi-images text-danger"></i>
                        <span>Chưa có clip nào (Chọn Mẫu Video hoặc bấm tab <strong>Ảnh/Video</strong> để thêm)</span>
                    </div>
                `;
            } else {
                videoTrackSlots.innerHTML = '';
                clips.forEach((clip, idx) => {
                    const item = document.createElement('div');
                    item.className = `bl-timeline-clip-item d-flex align-items-center justify-content-between p-1.5 ${selectedClipIndex === idx ? 'active' : ''}`;
                    item.title = clip.name;
                    item.style.flex = `${clip.durationSec || 3.75} 0 auto`;
                    item.innerHTML = `
                        <img src="${clip.src}" class="h-100 rounded-1 object-fit-cover me-1" style="width: 32px;" alt="">
                        <div class="text-truncate x-small fw-semibold text-dark flex-grow-1">${clip.name}</div>
                        <span class="badge bg-light border text-muted font-size-xs ms-1">${(clip.durationSec || 3.75).toFixed(1)}s</span>
                    `;
                    item.onclick = (e) => {
                        e.stopPropagation();
                        selectTimelineClip(idx);
                    };
                    videoTrackSlots.appendChild(item);
                });
            }
        }

        // 2. Text Track
        if (textTrackSlots) {
            const hasText = Boolean(
                (textHookInput && textHookInput.value.trim()) ||
                (textImmersionInput && textImmersionInput.value.trim()) ||
                (textHighlightInput && textHighlightInput.value.trim()) ||
                (textOutroInput && textOutroInput.value.trim())
            );

            if (!hasText) {
                textTrackSlots.innerHTML = `
                    <div class="bl-empty-track-hint d-flex align-items-center justify-content-center w-100 h-100 text-muted x-small cursor-pointer py-2" onclick="switchStudioTab('text')">
                        <i class="bi bi-fonts" style="color: #8B5CF6;"></i>
                        <span>Chưa có phụ đề (Nhập nội dung ở tab <strong>Văn bản</strong> hoặc chọn Mẫu Video)</span>
                    </div>
                `;
            } else {
                const previewText = (textHookInput && textHookInput.value) ||
                                    (textImmersionInput && textImmersionInput.value) ||
                                    (textHighlightInput && textHighlightInput.value) ||
                                    (textOutroInput && textOutroInput.value);
                textTrackSlots.innerHTML = `
                    <div class="bl-track-badge bl-badge-text flex-grow-1 text-truncate px-3 py-1 rounded-2 fw-semibold cursor-pointer d-flex align-items-center justify-content-between gap-2 shadow-2xs" onclick="selectTextTrackBadge()">
                        <div class="d-flex align-items-center gap-2 text-truncate">
                            <span aria-hidden="true">📝</span><span class="text-truncate">Phụ đề: ${previewText}</span>
                        </div>
                        <button type="button" class="btn btn-link text-danger p-0 x-small text-decoration-none fw-bold flex-shrink-0" onclick="removeSubtitles(event)" title="Gỡ tất cả phụ đề">
                            <i class="bi bi-x-circle-fill"></i> Gỡ
                        </button>
                    </div>
                `;
            }
        }

        // 3. Audio Track
        if (audioTrackSlot) {
            if (!selectedAudioUrl) {
                audioTrackSlot.innerHTML = `
                    <div class="bl-empty-track-hint d-flex align-items-center justify-content-center w-100 h-100 text-muted x-small cursor-pointer py-2" onclick="switchStudioTab('audio')">
                        <i class="bi bi-music-note-beamed text-success"></i>
                        <span>Chưa có nhạc nền (Bấm tab <strong>Âm thanh</strong> hoặc chọn Mẫu để nghe & chọn)</span>
                    </div>
                `;
            } else {
                audioTrackSlot.innerHTML = `
                    <div class="bl-track-badge bl-badge-audio flex-grow-1 text-truncate px-3 py-1 rounded-2 fw-semibold d-flex align-items-center justify-content-between shadow-2xs cursor-pointer">
                        <div class="d-flex align-items-center gap-2 text-truncate">
                            <i class="bi bi-music-note fs-6"></i>
                            <span class="text-truncate">Nhạc nền: ${selectedAudioName}</span>
                        </div>
                        <button type="button" class="btn btn-link text-danger p-0 x-small text-decoration-none fw-bold" onclick="removeAudio(event)" title="Gỡ bài nhạc này">
                            <i class="bi bi-x-circle-fill"></i> Gỡ
                        </button>
                    </div>
                `;
            }
        }

        // 4. Time ruler markings
        if (timeRuler) {
            const step = videoDuration / 5;
            let rulerHtml = '';
            for (let i = 0; i <= 5; i++) {
                const s = Math.round(i * step);
                rulerHtml += `<span>00:${String(s).padStart(2, '0')}</span>`;
            }
            timeRuler.innerHTML = rulerHtml;
        }

        updatePlayheadPosition();
    }

    function selectTimelineClip(idx) {
        selectedClipIndex = idx;
        isTextSelected = false;

        let clipStartTime = 0;
        for (let i = 0; i < idx; i++) {
            clipStartTime += (clips[i].durationSec || (videoDuration / clips.length));
        }
        elapsedPlayTime = clipStartTime * 1000;
        drawFrameAt(elapsedPlayTime);
        updateProgressUI();
        if (selectedAudioUrl && audioEl) {
            if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration) && audioEl.duration > 0) {
                audioEl.currentTime = clipStartTime % audioEl.duration;
            } else {
                try { audioEl.currentTime = clipStartTime; } catch (e) {}
            }
        }
        if (isPlaying) {
            startTime = performance.now() - (elapsedPlayTime / playbackSpeed);
        }

        renderTimeline();
        syncPropertiesPanel();
    }

    window.selectTextTrackBadge = function() {
        isTextSelected = true;
        selectedClipIndex = -1;
        renderTimeline();
        syncPropertiesPanel();
        switchStudioTab('text');
    };

    // --- TIMELINE PLAYHEAD SCRUBBING ---
    function updatePlayheadPosition() {
        if (!timelinePlayhead) return;
        const fraction = videoDuration > 0 ? (elapsedPlayTime / (videoDuration * 1000)) : 0;
        const trackWidth = timelineContainer ? (timelineContainer.clientWidth - 140) : 400;
        const leftPos = 120 + (fraction * trackWidth);
        timelinePlayhead.style.left = `${Math.max(120, leftPos)}px`;
    }

    function seekTimeline(fraction) {
        elapsedPlayTime = Math.max(0, Math.min(videoDuration * 1000, fraction * videoDuration * 1000));
        drawFrameAt(elapsedPlayTime);
        updateProgressUI();
        updatePlayheadPosition();

        if (selectedAudioUrl && audioEl) {
            const targetAudioSec = elapsedPlayTime / 1000;
            if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration) && audioEl.duration > 0) {
                audioEl.currentTime = targetAudioSec % audioEl.duration;
            } else {
                try { audioEl.currentTime = targetAudioSec; } catch (e) {}
            }
        }

        if (isPlaying) {
            startTime = performance.now() - (elapsedPlayTime / playbackSpeed);
        }
    }

    if (timeRuler) {
        timeRuler.addEventListener('click', (e) => {
            const rect = timeRuler.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const fraction = Math.max(0, Math.min(1, clickX / rect.width));
            seekTimeline(fraction);
        });
    }

    if (timelineContainer) {
        timelineContainer.addEventListener('click', (e) => {
            if (e.target.closest('.bl-timeline-clip-item') || e.target.closest('button') || e.target.closest('input')) {
                return;
            }
            const rect = timelineContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const trackStartX = 120;
            const trackWidth = rect.width - trackStartX - 20;
            if (trackWidth > 0 && clickX >= trackStartX) {
                const fraction = Math.max(0, Math.min(1, (clickX - trackStartX) / trackWidth));
                seekTimeline(fraction);
            }
        });
    }

    // --- SPLIT & DELETE CLIP ON TIMELINE ---
    if (btnTimelineSplit) {
        btnTimelineSplit.addEventListener('click', () => {
            if (clips.length === 0 || selectedClipIndex < 0) {
                showStudioToast('Chọn một clip trên timeline để cắt.', 'info');
                return;
            }
            pushUndoState();
            const target = clips[selectedClipIndex];
            const halfDur = Math.max(1.0, (target.durationSec || 3.75) / 2);
            target.durationSec = halfDur;

            const newClip = {
                id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                img: target.img,
                src: target.src,
                name: target.name + ' (phần 2)',
                durationSec: halfDur,
                scale: target.scale || 1.0,
                brightness: target.brightness || 100
            };
            clips.splice(selectedClipIndex + 1, 0, newClip);
            recalculateClipDurations();
            renderTimeline();
            drawFrameAt(elapsedPlayTime);
            showStudioToast('Đã cắt clip thành 2 đoạn!', 'success');
        });
    }

    if (btnTimelineDelete) {
        btnTimelineDelete.addEventListener('click', () => {
            if (clips.length === 0 || selectedClipIndex < 0) {
                showStudioToast('Chọn một clip trên timeline để xóa.', 'info');
                return;
            }
            pushUndoState();
            clips.splice(selectedClipIndex, 1);
            selectedClipIndex = -1;
            recalculateClipDurations();
            renderTimeline();
            drawFrameAt(elapsedPlayTime);
            showStudioToast('Đã xóa clip khỏi timeline.', 'info');
        });
    }

    if (btnDeleteSelectedClip) {
        btnDeleteSelectedClip.addEventListener('click', () => {
            if (selectedClipIndex >= 0) {
                pushUndoState();
                clips.splice(selectedClipIndex, 1);
                selectedClipIndex = -1;
                recalculateClipDurations();
                renderTimeline();
                drawFrameAt(elapsedPlayTime);
                syncPropertiesPanel();
            }
        });
    }

    // --- PROPERTIES PANEL SYNC ---
    function syncPropertiesPanel() {
        if (!propPanelDefault || !propPanelText || !propPanelClip) return;

        if (isTextSelected) {
            propPanelDefault.classList.add('d-none');
            propPanelClip.classList.add('d-none');
            propPanelText.classList.remove('d-none');
            if (propPanelTitle) propPanelTitle.innerHTML = '<i class="bi bi-fonts text-purple"></i><span>Văn bản</span>';
            if (propPanelBadge) propPanelBadge.innerText = 'Chữ';
            if (propTextInput) {
                propTextInput.value = (textHookInput && textHookInput.value) ||
                                      (textImmersionInput && textImmersionInput.value) ||
                                      (textHighlightInput && textHighlightInput.value) ||
                                      (textOutroInput && textOutroInput.value) || '';
            }
            if (propFontFamily) propFontFamily.value = activeText.font || 'Inter, sans-serif';
            if (propFontSize) propFontSize.value = activeText.size || 32;
            if (propTextColor) propTextColor.value = activeText.color || '#FFFFFF';
            if (btnPropBold) btnPropBold.classList.toggle('active', Boolean(activeText.isBold));
            if (btnPropItalic) btnPropItalic.classList.toggle('active', Boolean(activeText.isItalic));
            if (btnPropUnderline) btnPropUnderline.classList.toggle('active', Boolean(activeText.isUnderline));
            if (btnAlignCenter) btnAlignCenter.classList.toggle('active', activeText.align === 'center');
            if (propTextAnimation) propTextAnimation.value = activeText.animation || 'none';
        } else if (selectedClipIndex >= 0 && selectedClipIndex < clips.length) {
            propPanelDefault.classList.add('d-none');
            propPanelText.classList.add('d-none');
            propPanelClip.classList.remove('d-none');
            if (propPanelTitle) propPanelTitle.innerHTML = '<i class="bi bi-image text-danger"></i><span>Phân cảnh</span>';
            if (propPanelBadge) propPanelBadge.innerText = `Clip #${selectedClipIndex + 1}`;

            const clip = clips[selectedClipIndex];
            if (propClipName) propClipName.innerText = clip.name;
            if (clipDurationSlider) clipDurationSlider.value = clip.durationSec || 3.5;
            if (clipDurationLabel) clipDurationLabel.innerText = `${(clip.durationSec || 3.5).toFixed(1)}s`;
            if (clipScaleSlider) clipScaleSlider.value = Math.round((clip.scale || 1.0) * 100);
            if (clipScaleLabel) clipScaleLabel.innerText = `${Math.round((clip.scale || 1.0) * 100)}%`;
            if (clipBrightnessSlider) clipBrightnessSlider.value = clip.brightness || 100;
            if (clipBrightnessLabel) clipBrightnessLabel.innerText = `${clip.brightness || 100}%`;
        } else {
            propPanelText.classList.add('d-none');
            propPanelClip.classList.add('d-none');
            propPanelDefault.classList.remove('d-none');
            if (propPanelTitle) propPanelTitle.innerHTML = '<i class="bi bi-sliders text-danger"></i><span>Thuộc tính</span>';
            if (propPanelBadge) propPanelBadge.innerText = 'Tổng quan';
        }
    }

    // Event listeners cho panel thuộc tính chữ
    if (propTextInput) {
        propTextInput.addEventListener('input', (e) => {
            const val = e.target.value;
            if (textHookInput) textHookInput.value = val;
            drawFrameAt(elapsedPlayTime);
            renderTimeline();
        });
    }
    if (propFontFamily) {
        propFontFamily.addEventListener('change', (e) => {
            pushUndoState();
            activeText.font = e.target.value;
            drawFrameAt(elapsedPlayTime);
        });
    }
    if (propFontSize) {
        propFontSize.addEventListener('input', (e) => {
            activeText.size = parseInt(e.target.value, 10) || 32;
            drawFrameAt(elapsedPlayTime);
        });
    }
    if (propTextColor) {
        propTextColor.addEventListener('input', (e) => {
            activeText.color = e.target.value;
            drawFrameAt(elapsedPlayTime);
        });
    }
    if (btnPropBold) {
        btnPropBold.addEventListener('click', () => {
            pushUndoState();
            activeText.isBold = !activeText.isBold;
            btnPropBold.classList.toggle('active', activeText.isBold);
            drawFrameAt(elapsedPlayTime);
        });
    }
    if (btnPropItalic) {
        btnPropItalic.addEventListener('click', () => {
            pushUndoState();
            activeText.isItalic = !activeText.isItalic;
            btnPropItalic.classList.toggle('active', activeText.isItalic);
            drawFrameAt(elapsedPlayTime);
        });
    }
    if (btnPropUnderline) {
        btnPropUnderline.addEventListener('click', () => {
            pushUndoState();
            activeText.isUnderline = !activeText.isUnderline;
            btnPropUnderline.classList.toggle('active', activeText.isUnderline);
            drawFrameAt(elapsedPlayTime);
        });
    }
    if (btnAlignCenter) {
        btnAlignCenter.addEventListener('click', () => {
            pushUndoState();
            activeText.align = activeText.align === 'center' ? 'left' : 'center';
            btnAlignCenter.classList.toggle('active', activeText.align === 'center');
            drawFrameAt(elapsedPlayTime);
        });
    }
    if (propTextAnimation) {
        propTextAnimation.addEventListener('change', (e) => {
            pushUndoState();
            activeText.animation = e.target.value;
            drawFrameAt(elapsedPlayTime);
        });
    }

    if (clipDurationSlider) {
        clipDurationSlider.addEventListener('input', (e) => {
            if (selectedClipIndex >= 0 && clips[selectedClipIndex]) {
                const val = parseFloat(e.target.value);
                clips[selectedClipIndex].durationSec = val;
                if (clipDurationLabel) clipDurationLabel.innerText = `${val.toFixed(1)}s`;
                recalculateClipDurations();
                renderTimeline();
            }
        });
    }

    if (clipScaleSlider) {
        clipScaleSlider.addEventListener('input', (e) => {
            if (selectedClipIndex >= 0 && clips[selectedClipIndex]) {
                const val = parseInt(e.target.value, 10);
                clips[selectedClipIndex].scale = val / 100;
                if (clipScaleLabel) clipScaleLabel.innerText = `${val}%`;
                drawFrameAt(elapsedPlayTime);
            }
        });
    }

    if (clipBrightnessSlider) {
        clipBrightnessSlider.addEventListener('input', (e) => {
            if (selectedClipIndex >= 0 && clips[selectedClipIndex]) {
                const val = parseInt(e.target.value, 10);
                clips[selectedClipIndex].brightness = val;
                if (clipBrightnessLabel) clipBrightnessLabel.innerText = `${val}%`;
                drawFrameAt(elapsedPlayTime);
            }
        });
    }

    // --- AUDIO HANDLING ---
    window.selectAudioTrack = function(e, url, name) {
        if (e) e.stopPropagation();
        if (previewAudioEl) previewAudioEl.pause();
        document.querySelectorAll('.bl-btn-preview-audio i').forEach(i => i.className = 'bi bi-play-circle fs-5');

        if (selectedAudioUrl === url) {
            window.removeAudio();
            return;
        }

        pushUndoState();
        selectedAudioUrl = url;
        selectedAudioName = name;
        if (audioEl) {
            audioEl.src = url;
            audioEl.currentTime = 0;
            if (isPlaying) {
                audioEl.play().catch(e => console.error(e));
            }
        }

        soundCards.forEach(c => {
            const cardUrl = c.getAttribute('data-audio-url');
            c.classList.toggle('active', Boolean(cardUrl === url));
        });

        renderTimeline();
        updateUIFromState();
        showStudioToast(`Đã thêm bài nhạc: ${name}`, 'success');
    };

    window.removeAudio = function(e) {
        if (e) e.stopPropagation();
        pushUndoState();
        selectedAudioUrl = '';
        selectedAudioName = '';
        if (audioEl) {
            audioEl.pause();
            audioEl.src = '';
        }
        soundCards.forEach(c => c.classList.remove('active'));
        renderTimeline();
        updateUIFromState();
        showStudioToast('Đã gỡ bỏ bài nhạc nền.', 'info');
    };

    window.removeSubtitles = function(e) {
        if (e) e.stopPropagation();
        const subtitleInputs = [textHookInput, textImmersionInput, textHighlightInput, textOutroInput].filter(Boolean);
        if (!subtitleInputs.some(input => input.value.trim())) return;

        pushUndoState();
        subtitleInputs.forEach(input => { input.value = ''; });
        if (propTextInput) propTextInput.value = '';
        isTextSelected = false;
        renderTimeline();
        drawFrameAt(elapsedPlayTime);
        syncPropertiesPanel();
        showStudioToast('Đã gỡ bỏ tất cả phụ đề.', 'info');
    };

    window.previewAudioTrack = function(e, url) {
        e.stopPropagation();
        if (!previewAudioEl) return;

        if (!previewAudioEl.paused && previewAudioEl.src.includes(url)) {
            previewAudioEl.pause();
            const icon = e.currentTarget.querySelector('i');
            if (icon) icon.className = 'bi bi-play-circle fs-5';
        } else {
            previewAudioEl.src = url;
            previewAudioEl.play().catch(e => console.error(e));
            document.querySelectorAll('.bl-btn-preview-audio i').forEach(i => i.className = 'bi bi-play-circle fs-5');
            const icon = e.currentTarget.querySelector('i');
            if (icon) icon.className = 'bi bi-pause-circle fs-5 text-danger';

            previewAudioEl.onended = () => {
                if (icon) icon.className = 'bi bi-play-circle fs-5';
            };
        }
    };

    window.handleUserAudioUpload = function(input) {
        const file = input.files[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (userAudioBadgeWrapper) userAudioBadgeWrapper.classList.remove('d-none');
        if (userAudioTitle) userAudioTitle.innerText = file.name;

        if (btnPreviewUserAudio) {
            btnPreviewUserAudio.onclick = (e) => window.previewAudioTrack(e, url);
        }
        if (btnSelectUserAudio) {
            btnSelectUserAudio.onclick = (e) => window.selectAudioTrack(e, url, file.name);
        }

        window.selectAudioTrack(null, url, file.name);
    };

    window.changeMasterVolume = function(val) {
        masterVolume = parseFloat(val);
        if (audioEl) audioEl.volume = masterVolume;
    };

    // --- CANVAS DRAWING CORE ---
    function getCurrentSubtitleText(timestampMs) {
        const totalSec = videoDuration;
        const curSec = timestampMs / 1000;
        const seg = totalSec / 4;

        if (curSec < seg) return textHookInput ? textHookInput.value : '';
        if (curSec < seg * 2) return textImmersionInput ? textImmersionInput.value : '';
        if (curSec < seg * 3) return textHighlightInput ? textHighlightInput.value : '';
        return textOutroInput ? textOutroInput.value : '';
    }

    function drawFrameAt(timestampMs) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Nếu chưa có ảnh nào -> Vẽ Empty State Hướng Dẫn
        if (clips.length === 0) {
            if (playOverlayBtn) playOverlayBtn.classList.remove('is-visible');

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Khung viền mờ trung tâm
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 2;
            ctx.strokeRect(40, 140, canvas.width - 80, canvas.height - 280);

            // Icon Video
            ctx.fillStyle = '#DC2626';
            ctx.font = 'bold 50px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🎬', canvas.width / 2, 410);

            ctx.fillStyle = '#111827';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText('Bắt đầu tạo video ngắn', canvas.width / 2, 470);

            ctx.fillStyle = '#6B7280';
            ctx.font = '16px sans-serif';
            ctx.fillText('Chọn tab "Mẫu" ở cột bên trái để tạo 1-chạm', canvas.width / 2, 515);
            ctx.fillText('hoặc tab "Ảnh/Video" để tải ảnh của bạn', canvas.width / 2, 545);

            // Watermark Logo
            drawCanvasWatermark();
            return;
        }

        // Khi đã có clips và đang dừng -> hiển thị nút Play
        if (playOverlayBtn && !isPlaying) {
            playOverlayBtn.classList.add('is-visible');
        }

        // 2. Tính toán Clip và Hiệu ứng chuyển cảnh
        const totalDurationSec = videoDuration;
        const curSec = (timestampMs / 1000) % totalDurationSec;

        let accumulatedTime = 0;
        let currentClipIdx = 0;
        let nextClipIdx = 0;
        let segElapsedSec = 0;
        let segDuration = 3.75;

        for (let i = 0; i < clips.length; i++) {
            const cDur = clips[i].durationSec || (totalDurationSec / clips.length);
            if (curSec >= accumulatedTime && curSec < accumulatedTime + cDur) {
                currentClipIdx = i;
                nextClipIdx = (i + 1) % clips.length;
                segElapsedSec = curSec - accumulatedTime;
                segDuration = cDur;
                break;
            }
            accumulatedTime += cDur;
        }

        const curClip = clips[currentClipIdx];
        const nextClip = clips[nextClipIdx];
        const transitionWindow = transitionDuration;
        const isTransitioning = (segDuration - segElapsedSec <= transitionWindow) && (clips.length > 1);
        const transProgress = isTransitioning ? (1 - (segDuration - segElapsedSec) / transitionWindow) : 0;

        // Áp dụng bộ lọc màu
        applyCanvasFilter(ctx, currentFilter);

        // Vẽ ảnh hiện tại
        drawClipImage(ctx, curClip, segElapsedSec, segDuration, currentEffect);

        // Vẽ chuyển cảnh nếu đang trong khoảng giao thoa
        if (isTransitioning && nextClip) {
            ctx.save();
            applyTransitionEffect(ctx, nextClip, transProgress, currentTransition);
            ctx.restore();
        }

        // Khôi phục filter mặc định
        ctx.filter = 'none';

        // 3. Lớp phủ Gradient trên và dưới để chữ & logo luôn rõ ràng
        const topGrad = ctx.createLinearGradient(0, 0, 0, 160);
        topGrad.addColorStop(0, 'rgba(0,0,0,0.75)');
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, canvas.width, 160);

        const bottomGrad = ctx.createLinearGradient(0, canvas.height - 240, 0, canvas.height);
        bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
        bottomGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = bottomGrad;
        ctx.fillRect(0, canvas.height - 240, canvas.width, 240);

        // 4. Vẽ Watermark Thương hiệu Bình Lợi Studio
        drawCanvasWatermark();

        // 5. Vẽ Phụ đề (Chỉ vẽ khi có chữ)
        const subText = getCurrentSubtitleText(timestampMs);
        if (subText && subText.trim()) {
            ctx.save();

            let textAlpha = 1.0;
            if (activeText.animation === 'fade') {
                const segRem = segDuration - segElapsedSec;
                if (segElapsedSec < 0.3) textAlpha = segElapsedSec / 0.3;
                else if (segRem < 0.3) textAlpha = segRem / 0.3;
            }
            ctx.globalAlpha = Math.max(0, Math.min(1, textAlpha));

            let fontStyle = '';
            if (activeText.isBold) fontStyle += 'bold ';
            if (activeText.isItalic) fontStyle += 'italic ';
            ctx.font = `${fontStyle}${activeText.size}px ${activeText.font}`;
            ctx.textAlign = activeText.align || 'center';
            ctx.fillStyle = activeText.color || '#FFFFFF';

            const words = subText.split(' ');
            let line = '';
            const lines = [];
            const maxWidth = canvas.width - 80;
            for (let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && n > 0) {
                    lines.push(line.trim());
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line.trim());

            const lineHeight = activeText.size * 1.35;
            const startY = activeText.y - ((lines.length - 1) * lineHeight) / 2;

            lines.forEach((l, idx) => {
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 2;
                ctx.fillText(l, activeText.x, startY + (idx * lineHeight));
            });

            ctx.restore();
        }
    }

    function drawCanvasWatermark() {
        const isBlank = clips.length === 0;
        const textColor = isBlank ? '#1F2937' : '#FFFFFF';
        const subColor = isBlank ? '#4B5563' : 'rgba(255, 255, 255, 0.92)';

        // Vẽ Logo thương hiệu với khoảng cách thông thoáng
        if (studioLogoImg && studioLogoImg.complete && studioLogoImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(56, 56, 22, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(studioLogoImg, 34, 34, 44, 44);
            ctx.restore();

            ctx.fillStyle = textColor;
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('BÌNH LỢI', 92, 52);

            ctx.fillStyle = subColor;
            ctx.font = '13px sans-serif';
            ctx.fillText('Chạm sắc bản nguyên', 92, 72);
        } else {
            ctx.fillStyle = '#DC2626';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('BÌNH LỢI 🌿', 38, 52);

            ctx.fillStyle = subColor;
            ctx.font = '13px sans-serif';
            ctx.fillText('Chạm sắc bản nguyên', 38, 74);
        }
    }

    function applyCanvasFilter(context, filterName) {
        switch (filterName) {
            case 'warm':
                context.filter = 'sepia(25%) saturate(130%) brightness(105%)';
                break;
            case 'cool':
                context.filter = 'hue-rotate(190deg) saturate(95%) brightness(105%)';
                break;
            case 'vintage':
                context.filter = 'sepia(50%) contrast(110%) brightness(95%)';
                break;
            case 'vibrant':
                context.filter = 'saturate(160%) contrast(115%) brightness(105%)';
                break;
            case 'bw':
                context.filter = 'grayscale(100%) contrast(120%)';
                break;
            default:
                context.filter = 'saturate(110%) contrast(105%)';
                break;
        }
    }

    function drawClipImage(context, clip, elapsed, dur, effect) {
        if (!clip || !clip.img || !clip.img.complete) return;

        let scale = clip.scale || 1.0;
        let p = dur > 0 ? (elapsed / dur) : 0;

        if (effect === 'kenburns') {
            scale *= (1.0 + (p * 0.1)); // Zoom 10%
        } else if (effect === 'heartbeat') {
            const beat = Math.sin(p * Math.PI * 6) * 0.03;
            scale *= (1.0 + Math.max(0, beat));
        }

        const img = clip.img;
        const w = canvas.width * scale;
        const h = canvas.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;

        context.drawImage(img, x, y, w, h);
    }

    function applyTransitionEffect(context, nextClip, progress, transition) {
        if (!nextClip || !nextClip.img) return;

        switch (transition) {
            case 'fadeblack':
                if (progress < 0.5) {
                    context.fillStyle = `rgba(0,0,0,${progress * 2})`;
                    context.fillRect(0, 0, canvas.width, canvas.height);
                } else {
                    context.globalAlpha = (progress - 0.5) * 2;
                    context.drawImage(nextClip.img, 0, 0, canvas.width, canvas.height);
                }
                break;
            case 'slidedown':
                const offsetY = (1 - progress) * -canvas.height;
                context.drawImage(nextClip.img, 0, offsetY, canvas.width, canvas.height);
                break;
            case 'zoomin':
                const zoomScale = 1.3 - (progress * 0.3);
                const zw = canvas.width * zoomScale;
                const zh = canvas.height * zoomScale;
                context.globalAlpha = progress;
                context.drawImage(nextClip.img, (canvas.width - zw) / 2, (canvas.height - zh) / 2, zw, zh);
                break;
            default: // crossdissolve
                context.globalAlpha = progress;
                context.drawImage(nextClip.img, 0, 0, canvas.width, canvas.height);
                break;
        }
    }

    // --- PLAYBACK ENGINE ---
    window.togglePlayVideo = function() {
        if (clips.length === 0) {
            showStudioToast('Hãy chọn Mẫu Video hoặc thêm ảnh trước khi phát.', 'info');
            switchStudioTab('templates');
            return;
        }

        if (isPlaying) {
            pauseVideo();
        } else {
            playVideo();
        }
    };

    function playVideo() {
        isPlaying = true;
        if (playOverlayBtn) playOverlayBtn.classList.remove('is-visible');
        if (monitorPlayToggle) monitorPlayToggle.innerHTML = '<i class="bi bi-pause-circle-fill fs-3 text-danger"></i>';
        if (btnTimelinePlayIcon) btnTimelinePlayIcon.className = 'bi bi-pause-fill fs-6';
        if (btnHeaderPlay) btnHeaderPlay.innerHTML = '<i class="bi bi-pause-fill fs-5"></i> <span>Tạm dừng</span>';

        if (elapsedPlayTime >= videoDuration * 1000) {
            elapsedPlayTime = 0;
        }

        startTime = performance.now() - (elapsedPlayTime / playbackSpeed);

        // Khởi chạy âm thanh đồng bộ
        if (selectedAudioUrl && audioEl) {
            audioEl.volume = isMuted ? 0 : masterVolume;
            const targetAudioSec = elapsedPlayTime / 1000;
            if (audioEl.duration && !isNaN(audioEl.duration) && isFinite(audioEl.duration) && audioEl.duration > 0) {
                audioEl.currentTime = targetAudioSec % audioEl.duration;
            } else {
                try { audioEl.currentTime = targetAudioSec; } catch (e) {}
            }
            audioEl.play().catch(e => console.warn('Audio play auto-policy:', e));
        }

        renderFrameId = requestAnimationFrame(tick);
    }

    function pauseVideo() {
        isPlaying = false;
        if (playOverlayBtn && clips.length > 0) playOverlayBtn.classList.add('is-visible');
        if (monitorPlayToggle) monitorPlayToggle.innerHTML = '<i class="bi bi-play-circle-fill fs-3 text-danger"></i>';
        if (btnTimelinePlayIcon) btnTimelinePlayIcon.className = 'bi bi-play-fill fs-6';
        if (btnHeaderPlay) btnHeaderPlay.innerHTML = '<i class="bi bi-play-fill fs-5"></i> <span>Xem trước</span>';

        if (selectedAudioUrl && audioEl) audioEl.pause();
        if (renderFrameId) cancelAnimationFrame(renderFrameId);
    }

    function tick(now) {
        if (!isPlaying) return;

        elapsedPlayTime = (now - startTime) * playbackSpeed;

        if (elapsedPlayTime >= videoDuration * 1000) {
            elapsedPlayTime = 0;
            startTime = now;
            if (selectedAudioUrl && audioEl) audioEl.currentTime = 0;
        }

        drawFrameAt(elapsedPlayTime);
        updateProgressUI();
        updatePlayheadPosition();

        renderFrameId = requestAnimationFrame(tick);
    }

    function updateProgressUI() {
        const curSec = Math.floor(elapsedPlayTime / 1000);
        const totalSec = videoDuration;
        const curText = `00:${String(curSec).padStart(2, '0')}`;
        const totalText = `00:${String(totalSec).padStart(2, '0')}`;

        if (playerTimeLabel) playerTimeLabel.innerText = `${curText} / ${totalText}`;
        if (timelineDurationBadge) timelineDurationBadge.innerText = `${curText} / ${totalText}`;
    }

    window.rewindStartVideo = function() {
        elapsedPlayTime = 0;
        drawFrameAt(0);
        updateProgressUI();
        updatePlayheadPosition();
        if (selectedAudioUrl && audioEl) audioEl.currentTime = 0;
    };

    window.forwardEndVideo = function() {
        elapsedPlayTime = videoDuration * 1000;
        drawFrameAt(elapsedPlayTime);
        updateProgressUI();
        updatePlayheadPosition();
        pauseVideo();
    };

    window.toggleMute = function() {
        isMuted = !isMuted;
        if (audioEl) audioEl.volume = isMuted ? 0 : masterVolume;
        const icon = document.getElementById('volIcon');
        if (icon) {
            icon.className = isMuted ? 'bi bi-volume-mute-fill fs-5 text-danger' : 'bi bi-volume-up-fill fs-5';
        }
    };

    // --- TAB SWITCHING ---
    window.switchStudioTab = function(tabName) {
        document.querySelectorAll('.bl-rail-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });
        document.querySelectorAll('.bl-tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        const targetPane = document.getElementById(`spane-${tabName}`);
        if (targetPane) targetPane.classList.add('active');
    };

    window.switchMediaSubTab = function(sub) {
        document.querySelectorAll('.bl-subtab-btn').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-mediasub') === sub);
        });
        const subBinhLoi = document.getElementById('mediaSubBinhLoi');
        const subMy = document.getElementById('mediaSubMy');
        if (sub === 'binhloi') {
            if (subBinhLoi) subBinhLoi.classList.remove('d-none');
            if (subMy) subMy.classList.add('d-none');
        } else {
            if (subBinhLoi) subBinhLoi.classList.add('d-none');
            if (subMy) subMy.classList.remove('d-none');
        }
    };

    // --- OPTIONS SELECTION HELPERS ---
    window.selectStudioRatio = function(ratio) {
        pushUndoState();
        selectedRatio = normalizeStudioRatio(ratio);
        applyRatioToCanvas(selectedRatio);
        updateUIFromState();
        drawFrameAt(elapsedPlayTime);
        showStudioToast(`Đã chọn tỷ lệ: ${STUDIO_RATIOS[selectedRatio].label}`, 'info');
    };

    window.selectStudioFilter = function(filter) {
        pushUndoState();
        currentFilter = filter;
        updateUIFromState();
        drawFrameAt(elapsedPlayTime);
    };

    window.selectStudioEffect = function(effect) {
        pushUndoState();
        currentEffect = effect;
        updateUIFromState();
        drawFrameAt(elapsedPlayTime);
    };

    window.selectStudioTransition = function(trans) {
        pushUndoState();
        currentTransition = trans;
        updateUIFromState();
    };

    window.setStudioPlaybackSpeed = function(speed) {
        pushUndoState();
        playbackSpeed = parseFloat(speed);
        updateUIFromState();
        if (isPlaying) {
            startTime = performance.now() - (elapsedPlayTime / playbackSpeed);
        }
    };

    // Typography presets
    window.applyTextStylePreset = function(type) {
        pushUndoState();
        if (type === 'modern') {
            activeText.font = 'Inter, sans-serif';
            activeText.size = 32;
            activeText.color = '#FFFFFF';
            activeText.isBold = true;
        } else if (type === 'cinematic') {
            activeText.font = 'Montserrat, sans-serif';
            activeText.size = 34;
            activeText.color = '#F59E0B';
            activeText.isBold = true;
        } else if (type === 'handwrite') {
            activeText.font = "'Dancing Script', cursive";
            activeText.size = 40;
            activeText.color = '#FFFFFF';
            activeText.isBold = true;
        } else if (type === 'subtitle') {
            activeText.font = 'Arial, sans-serif';
            activeText.size = 28;
            activeText.color = '#FFFFFF';
            activeText.isBold = false;
        }
        drawFrameAt(elapsedPlayTime);
        syncPropertiesPanel();
        showStudioToast('Đã áp dụng mẫu chữ!', 'success');
    };

    // Subtitle live typing
    [textHookInput, textImmersionInput, textHighlightInput, textOutroInput].forEach(inp => {
        if (inp) {
            inp.addEventListener('input', () => {
                drawFrameAt(elapsedPlayTime);
                renderTimeline();
            });
        }
    });

    if (btnAddNewText) {
        btnAddNewText.addEventListener('click', () => {
            const subtitleInputs = [textHookInput, textImmersionInput, textHighlightInput, textOutroInput].filter(Boolean);
            const nextSubtitleInput = subtitleInputs.find(input => !input.value.trim()) || textHookInput;
            if (!nextSubtitleInput) return;

            if (!nextSubtitleInput.value.trim()) {
                pushUndoState();
                nextSubtitleInput.value = 'Phụ đề mới';
            }

            isTextSelected = true;
            selectedClipIndex = -1;
            renderTimeline();
            drawFrameAt(elapsedPlayTime);
            syncPropertiesPanel();
            nextSubtitleInput.focus();
            nextSubtitleInput.select();
            showStudioToast('Đã thêm phụ đề mới. Hãy nhập nội dung của bạn.', 'success');
        });
    }

    // --- VIDEO EXPORT ENGINE (MP4/WEBM + AUDIO) ---
    if (btnOpenExportModal) {
        btnOpenExportModal.addEventListener('click', () => {
            if (clips.length === 0) {
                showStudioToast('Vui lòng thêm ảnh hoặc chọn Mẫu trước khi xuất video!', 'info');
                return;
            }
            if (exportStatusPanel) exportStatusPanel.classList.add('d-none');
            if (exportSuccessPanel) exportSuccessPanel.classList.add('d-none');
            if (exportTriggerWrapper) exportTriggerWrapper.classList.remove('d-none');

            // Default filename with current timestamp
            const now = new Date();
            const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
            const hms = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
            if (exportFileNameInput) {
                exportFileNameInput.value = `binh_loi_studio_${ymd}_${hms}.mp4`;
            }

            const modalEl = document.getElementById('blExportModal');
            if (modalEl && window.bootstrap) {
                const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
                modal.show();
            }
        });
    }

    if (startExportProcessBtn) {
        startExportProcessBtn.addEventListener('click', () => {
            startVideoExport();
        });
    }

    async function startVideoExport() {
        if (clips.length === 0) return;
        pauseVideo();

        if (exportTriggerWrapper) exportTriggerWrapper.classList.add('d-none');
        if (exportStatusPanel) exportStatusPanel.classList.remove('d-none');
        if (exportSuccessPanel) exportSuccessPanel.classList.add('d-none');

        try {
            // Setup Web Audio MediaStream nếu có nhạc
            let combinedStream = canvas.captureStream(30);

            if (selectedAudioUrl && audioEl) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    if (!audioContext) audioContext = new AudioCtx();
                    if (audioContext.state === 'suspended') await audioContext.resume();

                    if (!audioSource) {
                        try {
                            audioSource = audioContext.createMediaElementSource(audioEl);
                            audioDestination = audioContext.createMediaStreamDestination();
                            audioSource.connect(audioDestination);
                            audioSource.connect(audioContext.destination);
                        } catch (err) {
                            console.warn('Audio stream attach warning:', err);
                        }
                    }

                    if (audioDestination && audioDestination.stream.getAudioTracks().length > 0) {
                        const audioTrack = audioDestination.stream.getAudioTracks()[0];
                        combinedStream.addTrack(audioTrack);
                    }
                }
            }

            const mime = MediaRecorder.isTypeSupported('video/mp4') 
                ? 'video/mp4' 
                : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm');

            const recorder = new MediaRecorder(combinedStream, { mimeType: mime });
            const recordedChunks = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) recordedChunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: mime });
                const downloadUrl = URL.createObjectURL(blob);
                const fileName = (exportFileNameInput && exportFileNameInput.value) || 'binh_loi_studio_video.mp4';

                // Tự động tải xuống
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                if (exportStatusPanel) exportStatusPanel.classList.add('d-none');
                if (exportSuccessPanel) exportSuccessPanel.classList.remove('d-none');
                if (btnDownloadAgain) {
                    btnDownloadAgain.onclick = () => {
                        const a2 = document.createElement('a');
                        a2.href = downloadUrl;
                        a2.download = fileName;
                        document.body.appendChild(a2);
                        a2.click();
                        document.body.removeChild(a2);
                    };
                }
                showStudioToast('Xuất video hoàn tất!', 'success');
            };

            recorder.start();

            // Render từng khung hình trong thời lượng
            const totalMs = videoDuration * 1000;
            const stepMs = 1000 / 30; // 30 FPS
            let currentMs = 0;

            if (selectedAudioUrl && audioEl) {
                audioEl.currentTime = 0;
                audioEl.play().catch(e => console.warn(e));
            }

            const exportInterval = setInterval(() => {
                currentMs += stepMs;
                drawFrameAt(currentMs);

                const percent = Math.min(100, Math.round((currentMs / totalMs) * 100));
                if (exportProgressBar) exportProgressBar.style.width = `${percent}%`;
                if (exportPercentText) exportPercentText.innerText = `${percent}%`;

                if (currentMs >= totalMs) {
                    clearInterval(exportInterval);
                    if (selectedAudioUrl && audioEl) audioEl.pause();
                    recorder.stop();
                }
            }, stepMs);

        } catch (err) {
            console.error('Export error:', err);
            if (exportStatusPanel) exportStatusPanel.classList.add('d-none');
            if (exportTriggerWrapper) exportTriggerWrapper.classList.remove('d-none');
            showStudioToast('Lỗi khi xuất video: ' + err.message, 'danger');
        }
    }

    // --- TOAST NOTIFICATIONS ---
    function showStudioToast(msg, type = 'info') {
        const existing = document.getElementById('blStudioToast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'blStudioToast';
        toast.className = `position-fixed bottom-4 start-50 translate-middle-x px-4 py-2.5 rounded-pill shadow-lg text-white font-size-sm fw-semibold z-1090 d-flex align-items-center gap-2 ${type === 'danger' ? 'bg-danger' : (type === 'success' ? 'bg-success' : 'bg-dark')}`;
        toast.style.cssText = 'bottom: 24px; z-index: 9999; animation: fadeIn 0.2s ease;';
        const icon = document.createElement('i');
        icon.className = 'bi bi-info-circle flex-shrink-0';
        icon.setAttribute('aria-hidden', 'true');
        const message = document.createElement('span');
        message.textContent = msg;
        toast.append(icon, message);
        document.body.appendChild(toast);

        setTimeout(() => {
            if (toast) toast.remove();
        }, 3000);
    }

    // --- CANVAS INTERACTIVE TEXT DRAGGING ---
    let isDraggingCanvasText = false;
    let dragTextOffsetX = 0;
    let dragTextOffsetY = 0;

    function getCanvasCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function isPointNearText(x, y) {
        const dx = Math.abs(x - activeText.x);
        const dy = Math.abs(y - activeText.y);
        return dx < (canvas.width * 0.4) && dy < 60;
    }

    canvas.addEventListener('mousedown', (e) => {
        const coords = getCanvasCoordinates(e);
        if (isPointNearText(coords.x, coords.y)) {
            isDraggingCanvasText = true;
            dragTextOffsetX = coords.x - activeText.x;
            dragTextOffsetY = coords.y - activeText.y;
            canvas.style.cursor = 'grabbing';
            isTextSelected = true;
            selectedClipIndex = -1;
            syncPropertiesPanel();
            renderTimeline();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!canvas) return;
        const coords = getCanvasCoordinates(e);
        if (isDraggingCanvasText) {
            activeText.x = Math.max(40, Math.min(canvas.width - 40, coords.x - dragTextOffsetX));
            activeText.y = Math.max(60, Math.min(canvas.height - 60, coords.y - dragTextOffsetY));
            drawFrameAt(elapsedPlayTime);
        } else {
            if (isPointNearText(coords.x, coords.y)) {
                canvas.style.cursor = 'grab';
            } else {
                canvas.style.cursor = 'default';
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingCanvasText) {
            isDraggingCanvasText = false;
            canvas.style.cursor = 'default';
            pushUndoState();
        }
    });

    // --- TIMELINE ZOOM ENGINE ---
    if (btnTimelineZoomIn) {
        btnTimelineZoomIn.addEventListener('click', () => {
            timelineZoom = Math.min(2.5, +(timelineZoom + 0.25).toFixed(2));
            applyTimelineZoom();
        });
    }
    if (btnTimelineZoomOut) {
        btnTimelineZoomOut.addEventListener('click', () => {
            timelineZoom = Math.max(0.6, +(timelineZoom - 0.25).toFixed(2));
            applyTimelineZoom();
        });
    }

    function applyTimelineZoom() {
        const tracks = [videoTrackSlots, textTrackSlots, audioTrackSlot];
        tracks.forEach(track => {
            if (track) {
                track.style.minWidth = `${100 * timelineZoom}%`;
            }
        });
        showStudioToast(`Thu phóng Timeline: ${Math.round(timelineZoom * 100)}%`, 'info');
    }

    // --- PROJECT PERSISTENCE & AUTO-SAVE ---
    function saveProjectToStorage() {
        try {
            const data = captureState();
            const title = projectTitleInput ? projectTitleInput.value.trim() : 'Video Bình Lợi';
            localStorage.setItem('binh_loi_studio_project', data);
            localStorage.setItem('binh_loi_studio_title', title);
            if (saveStatusIndicator) {
                saveStatusIndicator.innerHTML = '<i class="bi bi-check-circle-fill"></i><span>Đã lưu</span>';
                saveStatusIndicator.className = 'bl-status-saved d-flex align-items-center gap-2 text-success font-size-xs fw-semibold ms-2';
            }
        } catch (e) {
            console.warn('Storage save warning:', e);
        }
    }

    function loadProjectFromStorage() {
        try {
            const savedData = localStorage.getItem('binh_loi_studio_project');
            const savedTitle = localStorage.getItem('binh_loi_studio_title');
            if (savedTitle && projectTitleInput) {
                projectTitleInput.value = savedTitle;
            }
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (Array.isArray(parsed.clips) && parsed.clips.length > 0) {
                    applyState(savedData);
                }
            }
        } catch (e) {
            console.warn('Storage load warning:', e);
        }
    }

    if (btnSaveProject) {
        btnSaveProject.addEventListener('click', () => {
            saveProjectToStorage();
            showStudioToast('Đã lưu dự án video vào bộ nhớ trình duyệt!', 'success');
        });
    }

    if (projectTitleInput) {
        projectTitleInput.addEventListener('input', () => {
            if (saveStatusIndicator) {
                saveStatusIndicator.innerHTML = '<i class="bi bi-arrow-repeat"></i><span>Đang lưu...</span>';
                saveStatusIndicator.className = 'bl-status-saved d-flex align-items-center gap-2 text-muted font-size-xs fw-semibold ms-2';
            }
            clearTimeout(window._studioSaveTimer);
            window._studioSaveTimer = setTimeout(saveProjectToStorage, 800);
        });
    }

    // --- DESKTOP KEYBOARD SHORTCUTS ---
    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
            return;
        }

        // Space -> Toggle Play
        if (e.code === 'Space') {
            e.preventDefault();
            window.togglePlayVideo();
            return;
        }

        // Ctrl + Z -> Undo
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            window.undoStudio();
            return;
        }

        // Ctrl + Y or Ctrl + Shift + Z -> Redo
        if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
            ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault();
            window.redoStudio();
            return;
        }

        // Delete / Backspace -> Delete selected clip
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedClipIndex >= 0 && selectedClipIndex < clips.length) {
                e.preventDefault();
                pushUndoState();
                clips.splice(selectedClipIndex, 1);
                selectedClipIndex = -1;
                recalculateClipDurations();
                renderTimeline();
                drawFrameAt(elapsedPlayTime);
                syncPropertiesPanel();
                showStudioToast('Đã xóa phân cảnh khỏi Timeline', 'info');
            }
            return;
        }

        // Mũi tên Trái / Phải -> Tua lùi / tiến 1 giây
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            seekTimeline(Math.max(0, (elapsedPlayTime - 1000) / (videoDuration * 1000)));
            return;
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            seekTimeline(Math.min(1, (elapsedPlayTime + 1000) / (videoDuration * 1000)));
            return;
        }
    });

    // --- BOOTSTRAP INITIALIZATION ---
    initPresetPhotos();
    renderTemplatesList('all');
    recalculateClipDurations();
    renderTimeline();
    drawFrameAt(0);
    loadProjectFromStorage();
    pushUndoState();
});
