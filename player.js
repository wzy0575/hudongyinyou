/**
 * Branchie Web Player + Multi-series Hub
 */

function parseTimeSpan(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  return parseFloat(str) * 1000 || 0;
}

let videoBaseUrl = (typeof window !== 'undefined' && window.__VIDEO_BASE_URL__) || '';

/** Resolve asset path relative to current page (/game vs /game/) */
function assetUrl(relativePath) {
  const path = relativePath.replace(/^\.\//, '');
  return new URL(path, new URL('./', window.location.href).href).href;
}

function ossConfigCandidates() {
  const urls = [];
  if (window.__VIDEO_BASE_URL__) return urls; // already have base
  // 部署在 /game/ 下的固定路径（最可靠）
  if (location.pathname.startsWith('/game')) {
    urls.push('/game/data/oss.json');
  }
  urls.push(assetUrl('data/oss.json'));
  return urls;
}

async function loadOssConfig() {
  if (videoBaseUrl) return videoBaseUrl;
  if (window.__VIDEO_BASE_URL__) {
    videoBaseUrl = window.__VIDEO_BASE_URL__.trim();
    return videoBaseUrl;
  }
  for (const url of ossConfigCandidates()) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const cfg = await res.json();
      videoBaseUrl = (cfg.videoBaseUrl || '').trim();
      if (videoBaseUrl) return videoBaseUrl;
    } catch {
      // try next
    }
  }
  console.warn('[Branchie] OSS config not loaded, videos may fail');
  return '';
}

async function ensureOssConfig() {
  if (!videoBaseUrl) await loadOssConfig();
}

function resolveVideoPath(baseUrl, relativePath) {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const clean = relativePath.replace(/^\.\//, '');
  if (videoBaseUrl) {
    const base = videoBaseUrl.endsWith('/') ? videoBaseUrl : `${videoBaseUrl}/`;
    return new URL(clean, base).href;
  }
  return new URL(clean, baseUrl).href;
}

async function loadConfig(configFile) {
  const baseUrl = new URL('./', window.location.href);
  const res = await fetch(assetUrl(configFile));
  if (!res.ok) throw new Error(`无法加载配置: ${configFile}`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'text/xml');

  const activities = {};
  doc.querySelectorAll('activity').forEach(el => {
    const id = el.getAttribute('id');
    activities[id] = {
      id,
      video: resolveVideoPath(baseUrl, el.getAttribute('video')),
      idleVideo: el.getAttribute('idle-video')
        ? resolveVideoPath(baseUrl, el.getAttribute('idle-video'))
        : null,
      isStart: el.getAttribute('start') === 'true',
      isEnd: el.getAttribute('end') === 'true',
      isLoop: el.getAttribute('loop') === 'true',
      timeStart: parseTimeSpan(el.getAttribute('time-start')),
      timeEnd: el.hasAttribute('time-end') ? parseTimeSpan(el.getAttribute('time-end')) : null,
      score: parseInt(el.getAttribute('score') || '0', 10),
    };
  });

  const transitions = [];
  doc.querySelectorAll('transition').forEach(el => {
    const from = el.getAttribute('from');
    const to = el.getAttribute('to');
    if (!activities[from] || !activities[to]) return;
    transitions.push({
      from, to,
      caption: el.getAttribute('caption') || '',
      priority: parseInt(el.getAttribute('priority') || '0', 10),
      waitSignal: el.getAttribute('wait-signal') !== 'false',
      condition: el.getAttribute('if') || 'true',
    });
  });

  const startActivity = Object.values(activities).find(a => a.isStart);
  if (!startActivity) throw new Error('配置中未找到 start="true" 的入口场景');

  return { activities, transitions, startId: startActivity.id, configFile };
}

class BranchiePlayer {
  constructor(videoEl, choicesEl, progressEl, statusEl, progressBarEl, progressThumbEl) {
    this.video = videoEl;
    this.choicesEl = choicesEl;
    this.progressEl = progressEl;
    this.progressBarEl = progressBarEl;
    this.progressThumbEl = progressThumbEl;
    this.statusEl = statusEl;
    this.config = null;
    this.currentId = null;
    this.isIdleMode = false;
    this.isSeeking = false;
    this.busy = false;

    this.video.addEventListener('ended', () => this.onVideoEnded());
    this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.video.addEventListener('loadedmetadata', () => this.onMetadata());
    this.video.addEventListener('error', () => {
      this.showStatus(`视频加载失败: ${this.video.src}`);
    });

    if (this.progressBarEl) this.bindProgressBar();
  }

  getPlaybackRange() {
    const act = this.config?.activities[this.currentId];
    if (!act) {
      return { start: 0, end: this.video.duration || 0 };
    }
    const start = act.timeStart / 1000;
    const end = act.timeEnd != null
      ? act.timeEnd / 1000
      : (this.video.duration || 0);
    return { start, end: Math.max(start, end) };
  }

  seekByRatio(ratio) {
    const { start, end } = this.getPlaybackRange();
    const range = end - start;
    if (range <= 0) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    this.video.currentTime = start + clamped * range;
    this.updateProgress(true);
  }

  bindProgressBar() {
    const bar = this.progressBarEl;

    const seekFromEvent = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const track = bar.querySelector('.progress-track') || bar;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      this.seekByRatio((clientX - rect.left) / rect.width);
    };

    const onDown = (e) => {
      if (!this.config || !this.video.src) return;
      this.isSeeking = true;
      bar.classList.add('seeking');
      if (!this.video.paused && !this.isIdleMode) this.video.pause();
      seekFromEvent(e);
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!this.isSeeking) return;
      seekFromEvent(e);
      e.preventDefault();
    };

    const onUp = () => {
      if (!this.isSeeking) return;
      this.isSeeking = false;
      bar.classList.remove('seeking');

      const { start, end } = this.getPlaybackRange();
      const atEnd = this.video.currentTime >= end - 0.15;

      if (atEnd && !this.isIdleMode) {
        this.onVideoEnded();
        return;
      }

      if (!this.choicesEl.classList.contains('hidden')) return;
      this.video.play().catch(() => {});
    };

    bar.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    bar.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  async start(configFile) {
    await ensureOssConfig();
    this.hideStatus();
    this.clearChoices();
    this.config = await loadConfig(configFile);
    this.currentId = this.config.startId;
    this.isIdleMode = false;
    await this.enterActivity(this.currentId);
  }

  async enterActivity(id) {
    const act = this.config.activities[id];
    if (!act) return;
    this.currentId = id;
    this.isIdleMode = false;
    this.clearChoices();
    this.hideStatus();
    this.video.loop = act.isLoop;
    this.video.src = act.video;
    this.video.load();
    await this.playFrom(act.timeStart);
  }

  async playFrom(ms) {
    return new Promise(resolve => {
      const start = () => {
        this.video.currentTime = ms / 1000;
        this.video.play().catch(() => {
          this.showStatus('点击屏幕开始播放');
          const resume = () => {
            this.video.play();
            this.hideStatus();
            document.removeEventListener('click', resume);
          };
          document.addEventListener('click', resume, { once: true });
        });
        resolve();
      };
      if (this.video.readyState >= 1) start();
      else this.video.addEventListener('loadedmetadata', start, { once: true });
    });
  }

  onMetadata() { this.updateProgress(); }

  onTimeUpdate() {
    if (this.isSeeking) return;
    this.updateProgress();
    const act = this.config?.activities[this.currentId];
    if (!act || act.timeEnd == null || this.isIdleMode) return;
    if (this.video.currentTime * 1000 >= act.timeEnd) this.onVideoEnded();
  }

  updateProgress(force) {
    if (this.isSeeking && !force) return;
    const { start, end } = this.getPlaybackRange();
    const range = end - start;
    const pct = range > 0
      ? Math.min(100, Math.max(0, ((this.video.currentTime - start) / range) * 100))
      : 0;
    this.progressEl.style.width = `${pct}%`;
    if (this.progressThumbEl) this.progressThumbEl.style.left = `${pct}%`;
  }

  async onVideoEnded() {
    if (this.busy || !this.config) return;
    this.busy = true;
    const act = this.config.activities[this.currentId];

    if (act.isEnd) {
      this.showChoices([{ caption: '重新体验', to: this.config.startId, _replay: true }]);
      this.busy = false;
      return;
    }

    const outgoing = this.config.transitions
      .filter(t => t.from === this.currentId)
      .sort((a, b) => a.priority - b.priority);
    const waitOnes = outgoing.filter(t => t.waitSignal);
    const autoOnes = outgoing.filter(t => !t.waitSignal);

    if (waitOnes.length === 0 && autoOnes.length === 1) {
      await this.fireTransition(autoOnes[0]);
      this.busy = false;
      return;
    }

    if (waitOnes.length > 0) {
      if (act.idleVideo) {
        this.isIdleMode = true;
        this.video.loop = true;
        this.video.src = act.idleVideo;
        this.video.load();
        this.video.play().catch(() => {});
      } else {
        this.video.pause();
      }
      this.showChoices(waitOnes);
    } else if (autoOnes.length > 0) {
      await this.fireTransition(autoOnes[0]);
    }
    this.busy = false;
  }

  showChoices(transitions) {
    this.choicesEl.innerHTML = '';
    this.choicesEl.classList.remove('hidden');
    transitions.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = t.caption;
      btn.addEventListener('click', async () => {
        this.clearChoices();
        if (t._replay) await this.start(this.config.configFile);
        else await this.fireTransition(t);
      });
      this.choicesEl.appendChild(btn);
    });
  }

  clearChoices() {
    this.choicesEl.innerHTML = '';
    this.choicesEl.classList.add('hidden');
  }

  async fireTransition(trans) {
    this.isIdleMode = false;
    this.clearChoices();
    await this.enterActivity(trans.to);
  }

  showStatus(msg) {
    this.statusEl.textContent = msg;
    this.statusEl.classList.remove('hidden');
  }

  hideStatus() { this.statusEl.classList.add('hidden'); }

  stop() {
    this.video.pause();
    this.video.src = '';
    this.config = null;
    this.clearChoices();
    this.hideStatus();
  }
}

// ── Hub UI ──
const viewHub = document.getElementById('view-hub');
const viewSeries = document.getElementById('view-series');
const viewPlayer = document.getElementById('view-player');
const siteNav = document.getElementById('site-nav');

const videoEl = document.getElementById('video');
const choicesEl = document.getElementById('choices');
const progressEl = document.getElementById('progress');
const progressBarEl = document.getElementById('progress-bar');
const progressThumbEl = document.getElementById('progress-thumb');
const statusEl = document.getElementById('status');
const btnReplay = document.getElementById('btn-replay');
const btnBackSeries = document.getElementById('btn-back-series');
const btnBackPlayer = document.getElementById('btn-back-player');

const player = new BranchiePlayer(
  videoEl, choicesEl, progressEl, statusEl, progressBarEl, progressThumbEl
);

let catalog = null;
let currentSeries = null;
let currentEpisode = null;

function showView(name) {
  viewHub.classList.toggle('hidden', name !== 'hub');
  viewSeries.classList.toggle('hidden', name !== 'series');
  viewPlayer.classList.toggle('hidden', name !== 'player');
  if (siteNav) siteNav.classList.toggle('hidden', name === 'player');
}

function renderHub() {
  const grid = document.getElementById('series-grid');
  grid.innerHTML = catalog.series.map(s => `
    <button class="series-card${s.available ? '' : ' coming-soon'}"
            data-series="${s.id}" type="button">
      <img src="${s.cover}" alt="${s.title}" loading="lazy">
      <div class="series-card-overlay">
        <span class="series-card-status${s.available ? '' : ' muted'}">${s.status}</span>
        <h3>${s.title}</h3>
        <p>${s.subtitle}</p>
        <div class="series-card-tags">${s.tags.map(t => `<span>${t}</span>`).join('')}</div>
      </div>
    </button>`).join('');

  grid.querySelectorAll('.series-card:not(.coming-soon)').forEach(card => {
    card.addEventListener('click', () => openSeries(card.dataset.series));
  });
}

function openSeries(seriesId) {
  const s = catalog.series.find(x => x.id === seriesId);
  if (!s || !s.available) return;
  currentSeries = s;

  document.getElementById('series-cover').src = s.cover;
  document.getElementById('series-status').textContent = s.status;
  document.getElementById('series-title').textContent = s.title;
  document.getElementById('series-subtitle').textContent = s.subtitle;
  document.getElementById('series-description').textContent = s.description;
  document.getElementById('series-tags').innerHTML = s.tags.map(t => `<span>${t}</span>`).join('');

  document.getElementById('episode-list').innerHTML = s.episodes.map((ep, i) => `
    <button class="episode-btn" data-config="${ep.config}" data-title="${ep.title}" type="button">
      <div class="episode-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="episode-info">
        <h4>${ep.title}</h4>
        <p>${ep.desc}</p>
      </div>
      <span class="episode-play">播放 ▶</span>
    </button>`).join('');

  document.querySelectorAll('.episode-btn').forEach(btn => {
    btn.addEventListener('click', () => startEpisode(btn.dataset.config, btn.dataset.title));
  });

  showView('series');
  history.replaceState(null, '', `?series=${seriesId}`);
}

function startEpisode(configFile, title) {
  currentEpisode = { config: configFile, title };
  document.getElementById('player-episode-title').textContent = title;
  showView('player');
  ensureOssConfig().then(() => player.start(configFile)).catch(err => {
    player.showStatus(`加载失败: ${err.message}`);
    console.error(err);
  });
  history.replaceState(null, '', `?series=${currentSeries.id}&play=${encodeURIComponent(configFile)}`);
}

function backToHub() {
  player.stop();
  currentSeries = null;
  currentEpisode = null;
  showView('hub');
  history.replaceState(null, '', '/game/');
}

function backToSeries() {
  player.stop();
  currentEpisode = null;
  if (currentSeries) openSeries(currentSeries.id);
}

async function init() {
  await loadOssConfig();
  const res = await fetch(assetUrl('data/series.json'));
  catalog = await res.json();

  document.getElementById('platform-title').textContent = catalog.platform.title;
  document.getElementById('platform-tagline').textContent = catalog.platform.tagline;
  document.getElementById('platform-desc').textContent = catalog.platform.desc;

  renderHub();
  showView('hub');

  const params = new URLSearchParams(location.search);
  const playConfig = params.get('play');
  const seriesId = params.get('series');

  if (seriesId) {
    const s = catalog.series.find(x => x.id === seriesId);
    if (s?.available) {
      openSeries(seriesId);
      if (playConfig) {
        const ep = s.episodes.find(e => e.config === playConfig);
        if (ep) startEpisode(playConfig, ep.title);
      }
    }
  } else if (playConfig) {
    const s = catalog.series.find(x => x.episodes.some(e => e.config === playConfig));
    if (s) {
      openSeries(s.id);
      const ep = s.episodes.find(e => e.config === playConfig);
      startEpisode(playConfig, ep?.title || '');
    }
  }
}

btnBackSeries.addEventListener('click', backToHub);
btnBackPlayer.addEventListener('click', backToSeries);
btnReplay.addEventListener('click', () => {
  if (player.config) player.start(player.config.configFile);
});

init().catch(console.error);
