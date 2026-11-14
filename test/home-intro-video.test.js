const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('homepage intro video uses the static asset and restores the poster carousel until the next page reload', () => {
    const home = fs.readFileSync('src/views/home/index.ejs', 'utf8');

    assert.match(home, /<source src="\/videos\/thuc-giac-tap-dac-biet\.mp4" type="video\/mp4">/);
    assert.doesNotMatch(home, /drive\.usercontent\.google\.com/);
    assert.match(home, /<video id="heroIntroVideoPlayer"[^>]*muted playsinline preload="metadata"/);
    assert.match(home, /\.hero-intro-video\s*{[\s\S]*?aspect-ratio: 2\.72 \/ 1/);
    assert.match(home, /\.hero-intro-video__player\s*{[\s\S]*?object-fit: cover/);
    assert.match(home, /id="heroIntroSound"/);
    assert.match(home, /bi-volume-mute-fill/);
    assert.match(home, /id="heroIntroPlayPause"/);
    assert.match(home, /id="heroIntroProgress"/);
    assert.match(home, /introVideo\.addEventListener\('timeupdate', updateProgressControl\)/);
    assert.match(home, /progressControl\?\.addEventListener\('input'/);
    assert.match(home, /id="heroIntroSkip"/);
    assert.doesNotMatch(home, /localStorage/);
    assert.match(home, /hasReturnedToCarousel = false/);
    assert.match(home, /introVideo\.addEventListener\('ended'/);
    assert.match(home, /introVideoShell\.hidden = true/);
    assert.match(home, /heroCarousel\.hidden = false/);
    assert.match(home, /introVideo\.addEventListener\('error'/);
});
