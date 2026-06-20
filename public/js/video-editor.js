/**
 * Studio Hướng Dẫn Hành Trình Cảm Giác
 * Client-side Canvas & Web Audio Video Renderer Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // Canvas & Audio elements
    const canvas = document.getElementById('videoCanvas');
    const ctx = canvas.getContext('2d');
    const audioEl = document.getElementById('soundscapeAudio');
    
    // Config controls
    const durationRadios = document.getElementsByName('video_duration');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('media-files');
    const thumbnailsContainer = document.getElementById('thumbnails-container');
    const soundCards = document.querySelectorAll('.sound-card');
    const filterButtons = document.querySelectorAll('.filter-preset');
    const textHookInput = document.getElementById('text-hook');
    const textImmersionInput = document.getElementById('text-immersion');
    const textHighlightInput = document.getElementById('text-highlight');
    const textOutroInput = document.getElementById('text-outro');
    
    // Playback & Export UI
    const playBtn = document.getElementById('playBtn');
    const playProgress = document.getElementById('playProgress');
    const playerTimeLabel = document.getElementById('player-time');
    const exportBtn = document.getElementById('exportBtn');
    const exportStatusPanel = document.getElementById('export-status-panel');
    const exportStatusText = document.getElementById('export-status-text');
    const exportProgressBar = document.getElementById('exportProgress');
    
    // State variables
    let videoDuration = 15; // default 15s
    let loadedImages = []; // Array of { img: Image, file: File }
    let selectedAudioUrl = '';
    let currentFilter = 'none';
    let isPlaying = false;
    let isExporting = false;
    
    // Animation loop timer
    let renderInterval = null;
    let startTime = 0;
    let elapsedPlayTime = 0; // ms

    // Web Audio setup for export
    let audioContext = null;
    let audioSource = null;
    let audioDestination = null;
    
    // Initialize soundscape
    const activeSoundCard = document.querySelector('.sound-card.active');
    if (activeSoundCard) {
        selectedAudioUrl = activeSoundCard.getAttribute('data-audio-url');
        audioEl.src = selectedAudioUrl;
    }

    // --- TEMPLATE DURATION SELECTOR ---
    Array.from(durationRadios).forEach(radio => {
        radio.addEventListener('change', (e) => {
            videoDuration = parseInt(e.target.value);
            updateDurationUI();
        });
    });

    // Also support clicking card wrapper
    const templateCards = document.querySelectorAll('.template-card');
    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            templateCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            const radio = card.querySelector('input[type="radio"]');
            radio.checked = true;
            videoDuration = parseInt(radio.value);
            updateDurationUI();
        });
    });

    function updateDurationUI() {
        playerTimeLabel.innerText = `00:00 / 00:${String(videoDuration).padStart(2, '0')}`;
        
        // Update timeline slots text
        const slots = document.querySelectorAll('#timeline-slots > div');
        if (videoDuration === 30) {
            // 30s has 5 segments in theory, let's adjust visually
            document.getElementById('timeline-slots').innerHTML = `
                <div class="col">
                    <div class="border border-secondary rounded-3 p-2 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase" style="font-size: 0.6rem;">HOOK</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 60px; font-size: 0.8rem;">Ảnh 1</div>
                        <div class="x-small text-white-50 mt-1" style="font-size: 0.6rem;">0s - 6s</div>
                    </div>
                </div>
                <div class="col">
                    <div class="border border-secondary rounded-3 p-2 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase" style="font-size: 0.6rem;">IMMERSION</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 60px; font-size: 0.8rem;">Ảnh 2</div>
                        <div class="x-small text-white-50 mt-1" style="font-size: 0.6rem;">6s - 12s</div>
                    </div>
                </div>
                <div class="col">
                    <div class="border border-secondary rounded-3 p-2 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase" style="font-size: 0.6rem;">DETAIL</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 60px; font-size: 0.8rem;">Ảnh 3</div>
                        <div class="x-small text-white-50 mt-1" style="font-size: 0.6rem;">12s - 18s</div>
                    </div>
                </div>
                <div class="col">
                    <div class="border border-secondary rounded-3 p-2 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase" style="font-size: 0.6rem;">HIGHLIGHT</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 60px; font-size: 0.8rem;">Ảnh 4</div>
                        <div class="x-small text-white-50 mt-1" style="font-size: 0.6rem;">18s - 24s</div>
                    </div>
                </div>
                <div class="col">
                    <div class="border border-secondary rounded-3 p-2 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase" style="font-size: 0.6rem;">OUTRO</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 60px; font-size: 0.8rem;">Ảnh 5</div>
                        <div class="x-small text-white-50 mt-1" style="font-size: 0.6rem;">24s - 30s</div>
                    </div>
                </div>
            `;
        } else {
            const step = videoDuration / 4;
            document.getElementById('timeline-slots').innerHTML = `
                <div class="col-3">
                    <div class="border border-secondary rounded-3 p-3 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase">HOOK</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 80px;">Ảnh 1</div>
                        <div class="small text-white-50 mt-2 font-size-xs">0s - ${step}s</div>
                    </div>
                </div>
                <div class="col-3">
                    <div class="border border-secondary rounded-3 p-3 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase">IMMERSION</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 80px;">Ảnh 2</div>
                        <div class="small text-white-50 mt-2 font-size-xs">${step}s - ${step*2}s</div>
                    </div>
                </div>
                <div class="col-3">
                    <div class="border border-secondary rounded-3 p-3 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase">HIGHLIGHT</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 80px;">Ảnh 3</div>
                        <div class="small text-white-50 mt-2 font-size-xs">${step*2}s - ${step*3}s</div>
                    </div>
                </div>
                <div class="col-3">
                    <div class="border border-secondary rounded-3 p-3 bg-dark bg-opacity-50">
                        <div class="x-small text-muted fw-bold text-uppercase">OUTRO</div>
                        <div class="timeline-slot-thumb mt-2 border border-secondary rounded bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center text-muted" style="height: 80px;">Ảnh 4</div>
                        <div class="small text-white-50 mt-2 font-size-xs">${step*3}s - ${videoDuration}s</div>
                    </div>
                </div>
            `;
        }
        
        // Re-draw initial state on timeline change
        drawFrameAt(0);
        updateTimelineThumbs();
    }

    // --- UPLOAD FILES & DRAG-DROP ---
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-primary');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-primary');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-primary');
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    function handleFiles(files) {
        if (!files || files.length === 0) return;
        
        const count = Math.min(files.length, 5 - loadedImages.length);
        if (count <= 0) {
            alert('Đã tải tối đa 5 ảnh!');
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
        thumbnailsContainer.classList.remove('d-none');
        renderThumbnails();
        updateTimelineThumbs();
        
        if (loadedImages.length >= 3) {
            exportBtn.removeAttribute('disabled');
        } else {
            exportBtn.setAttribute('disabled', 'true');
        }
        
        // Draw the first image as static placeholder
        drawFrameAt(0);
    }

    function renderThumbnails() {
        thumbnailsContainer.innerHTML = '';
        loadedImages.forEach((item, index) => {
            const col = document.createElement('div');
            col.className = 'col-2 position-relative';
            col.innerHTML = `
                <div class="ratio ratio-1x1 border border-secondary rounded overflow-hidden">
                    <img src="${item.img.src}" class="w-100 h-100 object-fit-cover">
                </div>
                <button type="button" class="btn btn-danger btn-xs position-absolute top-0 end-0 p-0 rounded-circle d-flex align-items-center justify-content-center" 
                        style="width:18px; height:18px; font-size:10px; margin-top:-5px; margin-right:2px;" onclick="removeImage(${index})">
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
            thumbnailsContainer.classList.add('d-none');
            // Clear canvas
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    function updateTimelineThumbs() {
        const thumbs = document.querySelectorAll('.timeline-slot-thumb');
        thumbs.forEach((thumb, index) => {
            if (loadedImages[index]) {
                thumb.innerHTML = `<img src="${loadedImages[index].img.src}" class="w-100 h-100 object-fit-cover rounded">`;
                thumb.classList.remove('text-muted');
            } else {
                thumb.innerHTML = 'Trống';
                thumb.classList.add('text-muted');
            }
        });
    }

    // --- SOUNDSCAPE SELECTOR ---
    soundCards.forEach(card => {
        card.addEventListener('click', () => {
            soundCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            const radio = card.querySelector('input[type="radio"]');
            radio.checked = true;
            
            selectedAudioUrl = card.getAttribute('data-audio-url');
            audioEl.src = selectedAudioUrl;
            
            if (isPlaying) {
                audioEl.play().catch(e => console.error(e));
            }
        });
    });

    // --- COLOR FILTER SELECTOR ---
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            
            // Redraw frame instantly if paused
            if (!isPlaying) {
                drawFrameAt(elapsedPlayTime);
            }
        });
    });

    // --- RENDER ENGINE CORE ---

    // Object-fit Cover calculation for canvas drawing
    function drawImageCover(ctx, img, x, y, w, h) {
        const imgRatio = img.width / img.height;
        const canvasRatio = w / h;
        let sx, sy, sWidth, sHeight;

        if (imgRatio > canvasRatio) {
            sHeight = img.height;
            sWidth = img.height * canvasRatio;
            sx = (img.width - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = img.width;
            sHeight = img.width / canvasRatio;
            sx = 0;
            sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
    }

    // Main drawing routine at specific timestamp (in ms)
    function drawFrameAt(timestampMs) {
        if (loadedImages.length === 0) {
            ctx.fillStyle = '#0f0f0f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Draw empty guide
            ctx.fillStyle = '#ffffff';
            ctx.font = '28px Outfit, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Hãy tải 3-5 bức ảnh để bắt đầu', canvas.width / 2, canvas.height / 2);
            return;
        }

        const totalSec = timestampMs / 1000;
        
        // 1. Calculate which image and text to show based on duration and slots count
        const segmentsCount = (videoDuration === 30) ? 5 : 4;
        const segmentDuration = videoDuration / segmentsCount;
        
        let activeIdx = Math.floor(totalSec / segmentDuration);
        activeIdx = Math.min(activeIdx, segmentsCount - 1);
        activeIdx = Math.max(activeIdx, 0);

        // Fallback image index if we have fewer loaded images than segments
        let imgIdx = activeIdx % loadedImages.length;
        const currentImageItem = loadedImages[imgIdx];

        // 2. Draw Image under color filter
        ctx.save();
        if (currentFilter === 'warm') {
            ctx.filter = 'sepia(0.3) saturate(1.4) contrast(1.1) brightness(0.95)';
        } else if (currentFilter === 'cool') {
            ctx.filter = 'hue-rotate(15deg) saturate(1.15) contrast(0.95)';
        } else if (currentFilter === 'vintage') {
            ctx.filter = 'sepia(0.55) contrast(0.9) brightness(1.02)';
        } else if (currentFilter === 'grayscale') {
            ctx.filter = 'grayscale(1) contrast(1.25)';
        } else {
            ctx.filter = 'none';
        }
        
        if (currentImageItem && currentImageItem.img) {
            drawImageCover(ctx, currentImageItem.img, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        // 3. Draw Overlay Gradients (Instagram Style - Darkened bottom and top)
        const topGrad = ctx.createLinearGradient(0, 0, 0, 180);
        topGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, canvas.width, 180);

        const bottomGrad = ctx.createLinearGradient(0, canvas.height - 280, 0, canvas.height);
        bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
        bottomGrad.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.fillStyle = bottomGrad;
        ctx.fillRect(0, canvas.height - 280, canvas.width, 280);

        // 4. Draw Header/Branding
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Outfit, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('BÌNH LỢI HEALING', 40, 60);

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '16px Outfit, sans-serif';
        ctx.fillText('Hành Trình Cảm Giác', 40, 85);

        // 5. Draw dynamic text overlay
        let subText = '';
        if (activeIdx === 0) subText = textHookInput.value;
        else if (activeIdx === 1) subText = textImmersionInput.value;
        else if (activeIdx === 2) subText = textHighlightInput.value;
        else if (activeIdx === 3) {
            subText = (videoDuration === 30) ? 'Chạm vào không gian thanh tịnh.' : textOutroInput.value;
        } else if (activeIdx === 4) subText = textOutroInput.value;

        // Calculate text transition opacity (fade in/out during first/last 0.5s of segment)
        const progressInSeg = totalSec % segmentDuration;
        let opacity = 1.0;
        if (progressInSeg < 0.5) {
            opacity = progressInSeg / 0.5; // Fade in
        } else if (segmentDuration - progressInSeg < 0.5) {
            opacity = (segmentDuration - progressInSeg) / 0.5; // Fade out
        }
        
        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Wrap text
        ctx.font = 'bold 36px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;

        const words = subText.split(' ');
        let line = '';
        const lines = [];
        const maxWidth = canvas.width - 100;
        
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = ctx.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        let yStart = canvas.height - 180 - ((lines.length - 1) * 45);
        lines.forEach((l, idx) => {
            // Draw a subtle translucent black background box for premium readability
            const metrics = ctx.measureText(l);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(canvas.width/2 - metrics.width/2 - 15, yStart + (idx * 45) - 34, metrics.width + 30, 48);
            
            ctx.fillStyle = '#ffffff';
            ctx.fillText(l.trim(), canvas.width / 2, yStart + (idx * 45));
        });
        
        ctx.restore();
    }

    // --- PLAYBACK CONTROLS ---
    playBtn.addEventListener('click', () => {
        if (loadedImages.length === 0) {
            alert('Hãy tải ảnh lên trước!');
            return;
        }
        
        if (isPlaying) {
            pauseVideo();
        } else {
            playVideo();
        }
    });

    function playVideo() {
        if (isExporting) return;
        
        isPlaying = true;
        playBtn.innerHTML = '<i class="bi bi-pause-fill fs-3"></i>';
        
        if (elapsedPlayTime >= videoDuration * 1000) {
            elapsedPlayTime = 0;
        }
        
        startTime = performance.now() - elapsedPlayTime;
        audioEl.currentTime = elapsedPlayTime / 1000;
        audioEl.play().catch(e => console.error("Audio playback error:", e));

        renderInterval = requestAnimationFrame(tick);
    }

    function pauseVideo() {
        isPlaying = false;
        playBtn.innerHTML = '<i class="bi bi-play-fill fs-3"></i>';
        audioEl.pause();
        if (renderInterval) {
            cancelAnimationFrame(renderInterval);
        }
    }

    function tick(now) {
        if (!isPlaying) return;

        elapsedPlayTime = now - startTime;
        
        // Loop check
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
        const pct = (elapsedPlayTime / (videoDuration * 1000)) * 100;
        playProgress.style.width = `${pct}%`;

        const curMin = Math.floor(elapsedPlayTime / 60000);
        const curSec = Math.floor((elapsedPlayTime % 60000) / 1000);
        playerTimeLabel.innerText = `${String(curMin).padStart(2, '0')}:${String(curSec).padStart(2, '0')} / 00:${String(videoDuration).padStart(2, '0')}`;
    }

    // --- EXPORT VIDEO (MediaRecorder API) ---
    exportBtn.addEventListener('click', async () => {
        if (loadedImages.length < 3) {
            alert('Vui lòng chọn ít nhất 3 ảnh!');
            return;
        }
        
        pauseVideo();
        isExporting = true;
        exportBtn.setAttribute('disabled', 'true');
        exportStatusPanel.classList.remove('d-none');
        
        try {
            // Setup Web Audio nodes for capturing clean soundscape audio
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                audioSource = audioContext.createMediaElementSource(audioEl);
                audioDestination = audioContext.createMediaStreamDestination();
                
                // Connect to destination (recording) and also to context destination (hearing preview)
                audioSource.connect(audioDestination);
                audioSource.connect(audioContext.destination);
            }
            
            // Prepare mixed stream
            const canvasStream = canvas.captureStream(30); // 30fps video track
            const audioTrackStream = audioDestination.stream;
            
            const combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                ...audioTrackStream.getAudioTracks()
            ]);
            
            // Initialize MediaRecorder
            let options = { mimeType: 'video/webm;codecs=vp9' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm;codecs=vp8' };
            }
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = { mimeType: 'video/webm' };
            }
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options = {}; // browser default
            }

            const recorder = new MediaRecorder(combinedStream, options);
            const chunks = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                
                // Download file
                const a = document.createElement('a');
                a.href = url;
                a.download = `hanh_trinh_cam_giac_${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Reset UI
                isExporting = false;
                exportBtn.removeAttribute('disabled');
                exportStatusPanel.classList.add('d-none');
                showToast('Kết xuất video hoàn tất! Tệp tin đã tải về máy của bạn.', 'success');
            };
            
            // Start recording
            recorder.start();
            
            // Run play-record loop
            audioEl.currentTime = 0;
            audioEl.play().catch(e => console.error(e));
            
            const exportStartTime = performance.now();
            
            const exportTimer = setInterval(() => {
                const elapsed = performance.now() - exportStartTime;
                const pct = Math.min((elapsed / (videoDuration * 1000)) * 100, 100);
                
                exportProgressBar.style.width = `${pct}%`;
                exportStatusText.innerText = `Đang mã hóa video... (${Math.round(pct)}%)`;
                
                // Draw frames in real-time
                drawFrameAt(elapsed);
                
                if (elapsed >= videoDuration * 1000) {
                    clearInterval(exportTimer);
                    recorder.stop();
                    audioEl.pause();
                }
            }, 1000 / 30); // 30fps interval
            
        } catch (err) {
            console.error("Export video failed:", err);
            alert("Rất tiếc, trình duyệt của bạn không hỗ trợ ghi hình. Vui lòng cập nhật Safari/Chrome mới nhất.");
            isExporting = false;
            exportBtn.removeAttribute('disabled');
            exportStatusPanel.classList.add('d-none');
        }
    });

    // Draw initial empty frame
    drawFrameAt(0);
});
