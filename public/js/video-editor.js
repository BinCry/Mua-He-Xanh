/**
 * CapCut Studio Pro Video Engine - Binh Loi Healing
 * Client-side Canvas, Multi-track Timeline, Web Audio & Transitions
 */

document.addEventListener('DOMContentLoaded', () => {
    // Canvas & Audio elements
    const canvas = document.getElementById('videoCanvas');
    const ctx = canvas.getContext('2d');
    const audioEl = document.getElementById('soundscapeAudio');
    
    // Config elements
    const fileInput = document.getElementById('media-files');
    const dropzone = document.getElementById('dropzone');
    const thumbnailsWrapper = document.getElementById('thumbnails-wrapper');
    const thumbnailsContainer = document.getElementById('thumbnails-container');
    const mediaCountBadge = document.getElementById('media-count-badge');
    const soundCards = document.querySelectorAll('.capcut-audio-card');
    const filterCards = document.querySelectorAll('.capcut-filter-card');
    const effectCards = document.querySelectorAll('.capcut-effect-card');
    const templateOptions = document.querySelectorAll('.capcut-template-option');
    
    // Subtitle Inputs
    const textHookInput = document.getElementById('text-hook');
    const textImmersionInput = document.getElementById('text-immersion');
    const textHighlightInput = document.getElementById('text-highlight');
    const textOutroInput = document.getElementById('text-outro');
    
    // Monitor Controls
    const playBtn = document.getElementById('playBtn');
    const playOverlayBtn = document.getElementById('playOverlayBtn');
    const monitorPlayToggle = document.getElementById('monitorPlayToggle');
    const playerTimeLabel = document.getElementById('player-time');
    const headerTimeIndicator = document.getElementById('header-time-indicator');
    const btnOpenExportModal = document.getElementById('btnOpenExportModal');
    const startExportProcessBtn = document.getElementById('startExportProcessBtn');
    const exportStatusPanel = document.getElementById('export-status-panel');
    const exportStatusText = document.getElementById('export-status-text');
    const exportProgressBar = document.getElementById('exportProgress');
    
    // Timeline Elements
    const timelinePlayhead = document.getElementById('timelinePlayhead');
    const videoTrackSlots = document.getElementById('videoTrackSlots');
    const timelineClipIndicator = document.getElementById('timeline-clip-indicator');
    const timelineDurationLabel = document.getElementById('timeline-duration-label');
    const timelineAudioName = document.getElementById('timeline-audio-name');

    // State
    let videoDuration = 15; // 15s default
    let loadedImages = []; // Array of { img: Image, file: File }
    let selectedAudioUrl = '';
    let currentFilter = 'none';
    let currentEffect = 'kenburns';
    let isPlaying = false;
    let isExporting = false;
    let isMuted = false;
    
    let renderInterval = null;
    let startTime = 0;
    let elapsedPlayTime = 0; // ms

    // Web Audio setup
    let audioContext = null;
    let audioSource = null;
    let audioDestination = null;

    // Initialize Default Soundscape
    const activeAudioCard = document.querySelector('.capcut-audio-card.active');
    if (activeAudioCard) {
        selectedAudioUrl = activeAudioCard.getAttribute('data-audio-url');
        audioEl.src = selectedAudioUrl;
        const soundTitle = activeAudioCard.querySelector('.fw-bold')?.innerText || 'Tĩnh lặng';
        if (timelineAudioName) timelineAudioName.innerText = `Nhạc nền: ${soundTitle}`;
    }

    // --- CAPCUT TAB SWITCHER ---
    window.switchCapcutTab = function(tabName) {
        document.querySelectorAll('.capcut-rail-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });
        document.querySelectorAll('.capcut-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `cpane-${tabName}`);
        });
    };

    // --- TEMPLATE & DURATION SELECTOR ---
    templateOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            templateOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            
            const radio = opt.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            
            videoDuration = parseInt(opt.getAttribute('data-duration') || '15', 10);
            updateDurationUI();
        });
    });

    function updateDurationUI() {
        const durStr = `00:${String(videoDuration).padStart(2, '0')}`;
        playerTimeLabel.innerText = `00:00 / ${durStr}`;
        if (headerTimeIndicator) headerTimeIndicator.innerText = `00:00 / ${durStr}`;
        if (timelineDurationLabel) timelineDurationLabel.innerText = `${videoDuration}s`;
        
        // Update Time Ruler
        const timeRuler = document.getElementById('timeRuler');
        if (timeRuler) {
            const step = videoDuration / 5;
            let rulerHtml = '';
            for (let i = 0; i <= 5; i++) {
                const s = Math.round(i * step);
                rulerHtml += `<span>00:${String(s).padStart(2, '0')}</span>`;
            }
            timeRuler.innerHTML = rulerHtml;
        }

        renderTimelineTracks();
        drawFrameAt(0);
    }

    // --- MEDIA UPLOAD & DRAG DROP ---
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#00f0ff';
            dropzone.style.background = 'rgba(0, 240, 255, 0.1)';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'rgba(0, 240, 255, 0.35)';
            dropzone.style.background = '#1a1b20';
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'rgba(0, 240, 255, 0.35)';
            dropzone.style.background = '#1a1b20';
            handleFiles(e.dataTransfer.files);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }

    function handleFiles(files) {
        if (!files || files.length === 0) return;
        
        const count = Math.min(files.length, 10 - loadedImages.length);
        if (count <= 0) {
            alert('Bạn có thể chọn tối đa 10 ảnh!');
            return;
        }

        let loadedCount = 0;
        for (let i = 0; i < count; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    loadedImages.push({ img, file });
                    loadedCount++;
                    if (loadedCount === count) {
                        onImagesLoaded();
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    function onImagesLoaded() {
        if (thumbnailsWrapper) thumbnailsWrapper.classList.remove('d-none');
        if (mediaCountBadge) mediaCountBadge.innerText = `${loadedImages.length} / 5 ảnh`;
        if (timelineClipIndicator) timelineClipIndicator.innerText = `${loadedImages.length} clip`;
        
        renderThumbnails();
        renderTimelineTracks();
        
        if (loadedImages.length >= 3) {
            btnOpenExportModal.removeAttribute('disabled');
        } else {
            btnOpenExportModal.setAttribute('disabled', 'true');
        }
        
        drawFrameAt(0);
    }

    function renderThumbnails() {
        if (!thumbnailsContainer) return;
        thumbnailsContainer.innerHTML = '';
        loadedImages.forEach((item, index) => {
            const col = document.createElement('div');
            col.className = 'col-3 position-relative';
            col.innerHTML = `
                <div class="ratio ratio-1x1 rounded-3 overflow-hidden border border-secondary" style="background:#0e0f12;">
                    <img src="${item.img.src}" class="w-100 h-100 object-fit-cover">
                </div>
                <button type="button" class="btn btn-danger btn-xs position-absolute top-0 end-0 p-0 rounded-circle d-flex align-items-center justify-content-center shadow" 
                        style="width:20px; height:20px; font-size:11px; margin-top:-6px; margin-right:-2px; z-index:10;" onclick="removeImage(${index})">
                    <i class="bi bi-x"></i>
                </button>
            `;
            thumbnailsContainer.appendChild(col);
        });
    }

    window.removeImage = function(index) {
        loadedImages.splice(index, 1);
        onImagesLoaded();
        if (loadedImages.length === 0) {
            if (thumbnailsWrapper) thumbnailsWrapper.classList.add('d-none');
            ctx.fillStyle = '#0e0f12';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    window.clearAllLoadedImages = function() {
        loadedImages = [];
        onImagesLoaded();
        if (thumbnailsWrapper) thumbnailsWrapper.classList.add('d-none');
        ctx.fillStyle = '#0e0f12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    // --- TIMELINE TRACKS RENDERING ---
    function renderTimelineTracks() {
        if (!videoTrackSlots) return;
        
        const segmentsCount = (videoDuration === 30) ? 5 : 4;
        const segDuration = (videoDuration / segmentsCount).toFixed(1);
        
        let html = '';
        for (let i = 0; i < segmentsCount; i++) {
            const hasImg = loadedImages[i % (loadedImages.length || 1)];
            const imgSrc = hasImg ? hasImg.img.src : '';
            
            html += `
                <div class="capcut-timeline-clip-thumb flex-grow-1 position-relative ${hasImg && loadedImages.length > 0 ? 'has-img' : ''}" style="min-width: 60px;">
                    ${hasImg && loadedImages.length > 0 ? `<img src="${imgSrc}" class="w-100 h-100 object-fit-cover opacity-75">` : `<span class="text-white-50 x-small">Phân đoạn ${i+1}</span>`}
                    <span class="position-absolute bottom-0 end-0 px-1 py-0.5 rounded text-white x-small fw-bold" style="background: rgba(0,0,0,0.7); font-size: 0.6rem;">${segDuration}s</span>
                </div>
            `;
            if (i < segmentsCount - 1) {
                html += `<div class="text-cyan x-small opacity-75 flex-shrink-0" style="font-size: 0.65rem;" title="Chuyển cảnh CapCut">⧗</div>`;
            }
        }
        videoTrackSlots.innerHTML = html;
    }

    // --- AUDIO SOUNDSCAPE SELECTION ---
    soundCards.forEach(card => {
        card.addEventListener('click', () => {
            soundCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            const radio = card.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            
            selectedAudioUrl = card.getAttribute('data-audio-url');
            audioEl.src = selectedAudioUrl;
            
            const soundTitle = card.querySelector('.fw-bold')?.innerText || 'Tĩnh lặng';
            if (timelineAudioName) timelineAudioName.innerText = `Nhạc nền: ${soundTitle}`;
            
            if (isPlaying) {
                audioEl.play().catch(e => console.error(e));
            }
        });
    });

    // --- EFFECTS & FILTERS ---
    effectCards.forEach(card => {
        card.addEventListener('click', () => {
            effectCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentEffect = card.getAttribute('data-effect') || 'kenburns';
            if (!isPlaying) drawFrameAt(elapsedPlayTime);
        });
    });

    filterCards.forEach(card => {
        card.addEventListener('click', () => {
            filterCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentFilter = card.getAttribute('data-filter') || 'none';
            if (!isPlaying) drawFrameAt(elapsedPlayTime);
        });
    });

    // --- CANVAS RENDER ENGINE WITH CAPCUT MOTION ---
    function drawImageCover(ctx, img, x, y, w, h, scaleFactor = 1.0, panX = 0) {
        const imgRatio = img.width / img.height;
        const canvasRatio = w / h;
        let sx, sy, sWidth, sHeight;

        if (imgRatio > canvasRatio) {
            sHeight = img.height;
            sWidth = img.height * canvasRatio;
            sx = (img.width - sWidth) / 2 + panX;
            sy = 0;
        } else {
            sWidth = img.width;
            sHeight = img.width / canvasRatio;
            sx = panX;
            sy = (img.height - sHeight) / 2;
        }

        // Apply scale factor (Ken Burns)
        const dw = w * scaleFactor;
        const dh = h * scaleFactor;
        const dx = x - (dw - w) / 2;
        const dy = y - (dh - h) / 2;

        ctx.drawImage(img, Math.max(0, sx), Math.max(0, sy), sWidth, sHeight, dx, dy, dw, dh);
    }

    function drawFrameAt(timestampMs) {
        if (loadedImages.length === 0) {
            ctx.fillStyle = '#0e0f12';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw CapCut Placeholder Guide
            ctx.fillStyle = '#212328';
            ctx.fillRect(40, 200, canvas.width - 80, canvas.height - 400);
            
            ctx.fillStyle = '#00f0ff';
            ctx.font = 'bold 32px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('✂️ CapCut Studio Pro', canvas.width / 2, canvas.height / 2 - 30);
            
            ctx.fillStyle = '#8b929e';
            ctx.font = '20px sans-serif';
            ctx.fillText('Thêm từ 3 - 5 ảnh để dựng video', canvas.width / 2, canvas.height / 2 + 15);
            return;
        }

        const totalSec = timestampMs / 1000;
        const segmentsCount = (videoDuration === 30) ? 5 : 4;
        const segmentDuration = videoDuration / segmentsCount;
        
        let activeIdx = Math.floor(totalSec / segmentDuration);
        activeIdx = Math.min(activeIdx, segmentsCount - 1);
        activeIdx = Math.max(activeIdx, 0);

        const imgIdx = activeIdx % loadedImages.length;
        const currentImageItem = loadedImages[imgIdx];
        const progressInSeg = (totalSec % segmentDuration) / segmentDuration; // 0.0 to 1.0

        // 1. Calculate Motion Effect (Ken Burns or Pan)
        let scale = 1.0;
        let panX = 0;
        if (currentEffect === 'kenburns') {
            scale = 1.0 + (progressInSeg * 0.1); // Smooth 10% zoom in
        } else if (currentEffect === 'pan') {
            panX = (progressInSeg - 0.5) * 40; // Pan horizontally
        }

        // 2. Render Image with Filter
        ctx.save();
        if (currentFilter === 'warm') {
            ctx.filter = 'sepia(0.35) saturate(1.4) contrast(1.1) brightness(0.98)';
        } else if (currentFilter === 'cool') {
            ctx.filter = 'hue-rotate(15deg) saturate(1.2) contrast(1.05)';
        } else if (currentFilter === 'vintage') {
            ctx.filter = 'sepia(0.55) contrast(0.95) brightness(1.02)';
        } else if (currentFilter === 'grayscale') {
            ctx.filter = 'grayscale(1) contrast(1.25)';
        } else {
            ctx.filter = 'none';
        }

        if (currentImageItem && currentImageItem.img) {
            drawImageCover(ctx, currentImageItem.img, 0, 0, canvas.width, canvas.height, scale, panX);
        }
        ctx.restore();

        // 3. Flash White Transition if selected
        if (currentEffect === 'flash' && progressInSeg < 0.12) {
            ctx.fillStyle = `rgba(255, 255, 255, ${1.0 - (progressInSeg / 0.12)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 4. Dark Vignette Overlays
        const topGrad = ctx.createLinearGradient(0, 0, 0, 160);
        topGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, canvas.width, 160);

        const bottomGrad = ctx.createLinearGradient(0, canvas.height - 260, 0, canvas.height);
        bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
        bottomGrad.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = bottomGrad;
        ctx.fillRect(0, canvas.height - 260, canvas.width, 260);

        // 5. Header / Brand Mark
        ctx.fillStyle = '#00f0ff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('BÌNH LỢI HEALING 🌿', 35, 50);

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '14px sans-serif';
        ctx.fillText('Chạm sắc bản nguyên', 35, 75);

        // 6. Subtitles with Transition Fade
        let subText = '';
        if (activeIdx === 0) subText = textHookInput?.value || 'Lạc vào miền xanh Bình Lợi...';
        else if (activeIdx === 1) subText = textImmersionInput?.value || 'Hương mai thoang thoảng bờ kênh thanh mát.';
        else if (activeIdx === 2) subText = textHighlightInput?.value || 'Chữa lành từ những điều mộc mạc nhất.';
        else if (activeIdx === 3) {
            subText = (videoDuration === 30) ? 'Không gian tĩnh lặng miệt vườn.' : (textOutroInput?.value || 'Nghe Bình Lợi theo cách của bạn.');
        } else if (activeIdx === 4) subText = textOutroInput?.value || 'Nghe Bình Lợi theo cách của bạn.';

        let opacity = 1.0;
        const segSec = totalSec % segmentDuration;
        if (segSec < 0.4) opacity = segSec / 0.4;
        else if (segmentDuration - segSec < 0.4) opacity = (segmentDuration - segSec) / 0.4;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
        
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 12;

        const words = subText.split(' ');
        let line = '';
        const lines = [];
        const maxWidth = canvas.width - 80;
        
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        let yStart = canvas.height - 150 - ((lines.length - 1) * 42);
        lines.forEach((l, idx) => {
            const metrics = ctx.measureText(l);
            // CapCut Subtitle Backdrop Pill
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.fillRect(canvas.width/2 - metrics.width/2 - 14, yStart + (idx * 42) - 30, metrics.width + 28, 42);
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(l.trim(), canvas.width / 2, yStart + (idx * 42));
        });

        ctx.restore();
    }

    // --- PLAYBACK CONTROLS ---
    window.togglePlay = function() {
        if (loadedImages.length === 0) {
            alert('Vui lòng thêm ít nhất 1 ảnh để xem trước!');
            return;
        }
        if (isPlaying) pauseVideo();
        else playVideo();
    };

    if (playBtn) playBtn.addEventListener('click', window.togglePlay);

    window.rewindVideo = function() {
        elapsedPlayTime = 0;
        drawFrameAt(0);
        updateProgressUI();
        if (isPlaying) {
            startTime = performance.now();
            audioEl.currentTime = 0;
        }
    };

    window.toggleMute = function() {
        isMuted = !isMuted;
        audioEl.muted = isMuted;
        const icon = document.getElementById('volIcon');
        if (icon) {
            icon.className = isMuted ? 'bi bi-volume-mute-fill fs-5 text-danger' : 'bi bi-volume-up-fill fs-5';
        }
    };

    function playVideo() {
        if (isExporting) return;
        isPlaying = true;
        
        if (playOverlayBtn) playOverlayBtn.style.display = 'none';
        if (monitorPlayToggle) monitorPlayToggle.innerHTML = '<i class="bi bi-pause-circle-fill fs-4 text-cyan"></i>';
        
        if (elapsedPlayTime >= videoDuration * 1000) {
            elapsedPlayTime = 0;
        }
        
        startTime = performance.now() - elapsedPlayTime;
        audioEl.currentTime = elapsedPlayTime / 1000;
        audioEl.play().catch(e => console.error(e));

        renderInterval = requestAnimationFrame(tick);
    }

    function pauseVideo() {
        isPlaying = false;
        if (playOverlayBtn) playOverlayBtn.style.display = 'block';
        if (monitorPlayToggle) monitorPlayToggle.innerHTML = '<i class="bi bi-play-circle-fill fs-4 text-cyan"></i>';
        
        audioEl.pause();
        if (renderInterval) cancelAnimationFrame(renderInterval);
    }

    function tick(now) {
        if (!isPlaying) return;

        elapsedPlayTime = now - startTime;
        
        if (elapsedPlayTime >= videoDuration * 1000) {
            elapsedPlayTime = videoDuration * 1000;
            drawFrameAt(elapsedPlayTime);
            updateProgressUI();
            pauseVideo();
            return;
        }

        drawFrameAt(elapsedPlayTime);
        updateProgressUI();
        
        renderInterval = requestAnimationFrame(tick);
    }

    function updateProgressUI() {
        const pct = Math.min((elapsedPlayTime / (videoDuration * 1000)) * 100, 100);
        if (timelinePlayhead) timelinePlayhead.style.left = `${pct}%`;

        const curMin = Math.floor(elapsedPlayTime / 60000);
        const curSec = Math.floor((elapsedPlayTime % 60000) / 1000);
        const durStr = `00:${String(videoDuration).padStart(2, '0')}`;
        const timeStr = `${String(curMin).padStart(2, '0')}:${String(curSec).padStart(2, '0')} / ${durStr}`;
        
        if (playerTimeLabel) playerTimeLabel.innerText = timeStr;
        if (headerTimeIndicator) headerTimeIndicator.innerText = timeStr;
    }

    // --- CAPCUT EXPORT PIPELINE ---
    const exportModalEl = document.getElementById('capcutExportModal');
    let exportModal = null;
    if (exportModalEl && typeof bootstrap !== 'undefined') {
        exportModal = bootstrap.Modal.getOrCreateInstance(exportModalEl);
    }

    if (btnOpenExportModal) {
        btnOpenExportModal.addEventListener('click', () => {
            if (loadedImages.length < 3) {
                alert('Vui lòng chọn ít nhất 3 ảnh để xuất video!');
                return;
            }
            if (exportModal) exportModal.show();
        });
    }

    if (startExportProcessBtn) {
        startExportProcessBtn.addEventListener('click', async () => {
            if (loadedImages.length < 3) return;
            
            pauseVideo();
            isExporting = true;
            startExportProcessBtn.setAttribute('disabled', 'true');
            if (exportStatusPanel) exportStatusPanel.classList.remove('d-none');
            
            try {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    audioSource = audioContext.createMediaElementSource(audioEl);
                    audioDestination = audioContext.createMediaStreamDestination();
                    audioSource.connect(audioDestination);
                    audioSource.connect(audioContext.destination);
                }
                
                const canvasStream = canvas.captureStream(30);
                const audioTrackStream = audioDestination.stream;
                
                const combinedStream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioTrackStream.getAudioTracks()
                ]);
                
                let options = { mimeType: 'video/webm;codecs=vp9' };
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: 'video/webm;codecs=vp8' };
                }
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: 'video/webm' };
                }
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = {};
                }

                const recorder = new MediaRecorder(combinedStream, options);
                const chunks = [];
                
                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                };
                
                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `capcut_binh_loi_healing_${Date.now()}.webm`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    isExporting = false;
                    startExportProcessBtn.removeAttribute('disabled');
                    if (exportStatusPanel) exportStatusPanel.classList.add('d-none');
                    if (exportModal) exportModal.hide();
                    
                    if (typeof showToast === 'function') {
                        showToast('Xuất video thành công! Tệp tin đã được lưu về máy của bạn.', 'success');
                    } else {
                        alert('Xuất video thành công! Tệp tin đã được lưu về máy của bạn.');
                    }
                };
                
                recorder.start();
                audioEl.currentTime = 0;
                audioEl.play().catch(e => console.error(e));
                
                const exportStartTime = performance.now();
                const exportTimer = setInterval(() => {
                    const elapsed = performance.now() - exportStartTime;
                    const pct = Math.min((elapsed / (videoDuration * 1000)) * 100, 100);
                    
                    if (exportProgressBar) exportProgressBar.style.width = `${pct}%`;
                    if (exportStatusText) exportStatusText.innerText = `Đang mã hóa video... (${Math.round(pct)}%)`;
                    
                    drawFrameAt(elapsed);
                    
                    if (elapsed >= videoDuration * 1000) {
                        clearInterval(exportTimer);
                        recorder.stop();
                        audioEl.pause();
                    }
                }, 1000 / 30);
                
            } catch (err) {
                console.error("Export video error:", err);
                alert("Lỗi xuất video: " + err.message);
                isExporting = false;
                startExportProcessBtn.removeAttribute('disabled');
                if (exportStatusPanel) exportStatusPanel.classList.add('d-none');
            }
        });
    }

    // Initial Setup
    updateDurationUI();
    drawFrameAt(0);
});
