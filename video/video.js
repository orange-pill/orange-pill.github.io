// Promo page: format switch (square / vertical) and share links.
(() => {
  const video = document.getElementById('video'), player = document.getElementById('player');
  const buttons = document.querySelectorAll('.seg button');
  function setFormat(f) {
    if (player.dataset.format === f) return;
    const playing = !video.paused;
    player.dataset.format = f;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.format === f)));
    video.poster = `poster-${f}.jpg`;
    video.querySelector('source').src = `orange-pill-promo-${f}.mp4`;
    video.load();
    if (playing) video.play().catch(() => {});
  }
  buttons.forEach(b => b.addEventListener('click', () => setFormat(b.dataset.format)));
  if (matchMedia('(max-width: 600px) and (orientation: portrait)').matches) setFormat('9x16');

  const url = 'https://orange-pill.github.io/video/';
  const text = 'Why does everything cost more? 33 seconds on money, inflation and bitcoin 🟠';
  document.getElementById('share-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
  document.getElementById('share-tg').href = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
  document.getElementById('share-wa').href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
  const toast = document.getElementById('toast');
  document.getElementById('share-copy').addEventListener('click', () => {
    const done = () => { toast.textContent = 'Link copied'; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
  });
})();
