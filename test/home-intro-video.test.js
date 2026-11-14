const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('homepage intro video streams from Drive and restores the poster carousel until the next page reload', () => {
    const home = fs.readFileSync('src/views/home/index.ejs', 'utf8');

    assert.match(home, /drive\.usercontent\.google\.com\/download\?id=13q2u8jMa_Bx3nzJh9DwLEvtTI-OE0kmx/);
    assert.match(home, /<video id="heroIntroVideoPlayer"[^>]*muted playsinline preload="metadata"/);
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
