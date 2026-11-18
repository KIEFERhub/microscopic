// Wavefunction Collapse · 1-finger mode
// Shared probability cloud + pinch-to-observe + 👍 to cycle screens.

(() => {
  const CANVAS_W = 1728; let CANVAS_H = 1117; // 높이는 창 비율에 맞춰 fit()에서 갱신

  // ───── letterbox scale ─────
  const canvas = document.getElementById('canvas');
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / 1728, vh / 1117); // 잘리지 않게
    // 창이 세로로 더 길면 캔버스 높이를 늘려 위아래 빈 띠를 없앰
    CANVAS_H = Math.max(1117, vh / s);
    canvas.style.height = CANVAS_H + 'px';
    canvas.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ───── elements ─────
  const cloudLayer     = document.getElementById('cloudLayer');
  const particlesLayer = document.getElementById('particlesLayer');
  const hud            = document.getElementById('hud');
  const hudLabel       = document.getElementById('hudLabel');
  const camBtn         = document.getElementById('camBtn');
  const pageCounter    = document.getElementById('pageCounter');
  const screens        = Array.from(document.querySelectorAll('.screen'));
  const statObs        = document.getElementById('statObs');
  const statAvg        = document.getElementById('statAvg');

  // ───── probability cloud ─────
  const BUBBLE_COUNT = 42;
  const bubbles = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function createBubbles() {
    cloudLayer.innerHTML = '';
    bubbles.length = 0;
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'bubble';
      const r = rand(80, 340);
      el.style.width  = r + 'px';
      el.style.height = r + 'px';
      el.style.opacity = rand(0.35, 0.75).toFixed(2);
      const b = {
        el,
        x: rand(-100, CANVAS_W + 100),
        y: rand(-100, CANVAS_H + 100),
        r,
        vx: rand(-0.25, 0.25),
        vy: rand(-0.25, 0.25),
        phase: Math.random() * Math.PI * 2,
        amp: rand(6, 18),
        freq: rand(0.0005, 0.0015),
      };
      bubbles.push(b);
      cloudLayer.appendChild(el);
      positionBubble(b);
    }
  }
  function positionBubble(b) {
    b.el.style.transform = `translate(${(b.x - b.r/2).toFixed(1)}px, ${(b.y - b.r/2).toFixed(1)}px)`;
  }

  let lastT = performance.now();
  function animateCloud(now) {
    const dt = Math.min(64, now - lastT);
    lastT = now;
    for (const b of bubbles) {
      if (b.collapsed) continue;
      b.phase += b.freq * dt;
      b.x += b.vx * dt * 0.6 + Math.sin(b.phase) * 0.3;
      b.y += b.vy * dt * 0.6 + Math.cos(b.phase * 0.9) * 0.3;
      // wrap
      if (b.x < -b.r) b.x = CANVAS_W + b.r;
      if (b.x > CANVAS_W + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = CANVAS_H + b.r;
      if (b.y > CANVAS_H + b.r) b.y = -b.r;
      positionBubble(b);
    }
    requestAnimationFrame(animateCloud);
  }
  requestAnimationFrame(animateCloud);

  createBubbles();

  // ───── collapsed particle (solid dot) that follows a pinch ─────
  // One active pinch-particle at a time (per hand). We keep a small registry so
  // multiple observations can remain on-screen after release.
  let activePinchDot = null;     // currently-held dot (follows pinch pos)
  let pinchStartAt = 0;          // timestamp pinch started
  let pinchCollapseMs = 0;       // randomized collapse time for this observation

  function spawnDot(x, y) {
    const el = document.createElement('div');
    el.className = 'collapsed-dot';
    el.style.transform = `translate(${x}px, ${y}px)`;
    particlesLayer.appendChild(el);
    // burst ring
    const burst = document.createElement('div');
    burst.className = 'burst';
    burst.style.transform = `translate(${x}px, ${y}px)`;
    particlesLayer.appendChild(burst);
    setTimeout(() => burst.remove(), 800);
    return el;
  }
  function moveDot(el, x, y) {
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  // When a pinch happens, we also visually "collapse" the nearest cloud bubble
  // — it shrinks toward the pinch point and fades out, reinforcing the metaphor.
  function collapseNearestBubble(x, y) {
    let best = null, bestD = Infinity;
    for (const b of bubbles) {
      if (b.collapsed) continue;
      const dx = b.x - x, dy = b.y - y;
      const d = dx*dx + dy*dy;
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) return;
    best.collapsed = true;
    best.el.classList.add('collapsing');
    best.el.style.transform = `translate(${(x - 2).toFixed(1)}px, ${(y - 2).toFixed(1)}px) scale(0.04)`;
    // respawn later so the cloud doesn't deplete
    setTimeout(() => {
      best.el.remove();
      const idx = bubbles.indexOf(best);
      if (idx >= 0) bubbles.splice(idx, 1);
      // add a fresh bubble off-screen
      const el = document.createElement('div');
      el.className = 'bubble';
      const r = rand(80, 340);
      el.style.width = r + 'px'; el.style.height = r + 'px';
      el.style.opacity = rand(0.35, 0.75).toFixed(2);
      const nb = {
        el, r,
        x: Math.random() < 0.5 ? -r : CANVAS_W + r,
        y: rand(0, CANVAS_H),
        vx: rand(-0.25, 0.25), vy: rand(-0.25, 0.25),
        phase: Math.random() * Math.PI * 2,
        amp: rand(6, 18), freq: rand(0.0005, 0.0015),
      };
      bubbles.push(nb); cloudLayer.appendChild(el); positionBubble(nb);
    }, 1100);
  }

  // ───── stats ─────
  let totalObs = 0;
  let totalCollapseMs = 0;
  function updateStats() {
    statObs.textContent = String(totalObs).padStart(2, '0');
    if (totalObs === 0) {
      statAvg.textContent = '—';
    } else {
      const avg = totalCollapseMs / totalObs;
      statAvg.textContent = (avg / 1000).toFixed(2) + 's';
    }
  }

  // ───── screens ─────
  const SCREENS = ['desc', 'stats', 'main'];
  const SCREEN_LABELS = {
    desc:  '01 / 03 · MAIN',
    stats: '02 / 03 · STATS',
    main:  '03 / 03 · DESCRIPTION',
  };
  let screenIdx = 0;

  function showScreen(i) {
    screenIdx = (i + SCREENS.length) % SCREENS.length;
    const name = SCREENS[screenIdx];
    screens.forEach(s => s.classList.toggle('is-active', s.dataset.screen === name));
    pageCounter.textContent = SCREEN_LABELS[name];
  }
  // Keyboard fallback
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
      showScreen(screenIdx + 1);
    }
    if (e.code === 'Escape' || e.code === 'Backspace') {
      window.location.href = "index.html";
    }
  });

  // Boot
  showScreen(0);

  // ───── hand tracking ─────
  let hands, camera;
  let lastDetectedAt = 0;
  const DETECT_HOLD_MS = 600;

  function setDetected(on) {
    hud.classList.toggle('is-detected', on);
    hudLabel.textContent = on ? 'CAM · PINCH TO OBSERVE' : 'CAM · AWAITING GESTURE';
  }

  // finger-extended helper (tip farther from wrist than PIP)
  function fingerExtended(lm, tip, pip, mcp) {
    const w = lm[0];
    const dTip = Math.hypot(lm[tip].x - w.x, lm[tip].y - w.y);
    const dPip = Math.hypot(lm[pip].x - w.x, lm[pip].y - w.y);
    return dTip > dPip * 1.05;
  }
  function isOpenPalm(lm) {
    const thumb  = isThumbExtended(lm);
    const index  = fingerExtended(lm, 8,  6,  5);
    const middle = fingerExtended(lm, 12, 10, 9);
    const ring   = fingerExtended(lm, 16, 14, 13);
    const pinky  = fingerExtended(lm, 20, 18, 17);
    return thumb && index && middle && ring && pinky;
  }
  function isThumbExtended(lm) {
    const w = lm[0], tip = lm[4], mcp = lm[2];
    const dTip = Math.hypot(tip.x - w.x, tip.y - w.y);
    const dMcp = Math.hypot(mcp.x - w.x, mcp.y - w.y);
    return dTip > dMcp * 1.15;
  }
  // thumb-index pinch: distance between 4 and 8, normalized by hand size
  function pinchInfo(lm) {
    const w = lm[0];
    const hand = Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) || 1e-6;
    const d = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
    const mid = { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
    return { ratio: d / hand, mid };
  }
  // thumbs-up: fingers folded, thumb extended, pointing up
  function isThumbsUp(lm) {
    const index  = fingerExtended(lm, 8,  6,  5);
    const middle = fingerExtended(lm, 12, 10, 9);
    const ring   = fingerExtended(lm, 16, 14, 13);
    const pinky  = fingerExtended(lm, 20, 18, 17);
    if (index || middle || ring || pinky) return false;
    const w = lm[0], tip = lm[4], mcp = lm[2];
    const dTip = Math.hypot(tip.x - w.x, tip.y - w.y);
    const dMcp = Math.hypot(mcp.x - w.x, mcp.y - w.y);
    if (dTip < dMcp * 1.15) return false;
    const dy = tip.y - w.y;
    const dx = Math.abs(tip.x - w.x);
    const hand = Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) || 1e-6;
    if (Math.abs(dy) < dx * 0.9) return false;
    if (Math.abs(dy) / hand < 0.4) return false;
    return dy < 0;
  }

  // cooldown for thumbs-up nav
  let lastThumbAt = 0;
  let thumbUpStart = 0;
  const THUMB_HOLD_MS = 1000;
  const THUMB_COOLDOWN_MS = 1500;

  let openPalmStart = 0;
  const PALM_HOLD_MS = 3000;

  // pinch thresholds
  const PINCH_ON  = 0.45;   // ratio < → pinched
  const PINCH_OFF = 0.65;   // ratio > → released

  let pinching = false;

  // ───── Page Switching Logic ─────
  let switchTimer = null;
  let targetFingerCount = -1;
  const SWITCH_HOLD_MS = 1500;
  const PAGES = ["", "Wavefunction_Collapse.html", "Quantum_Entanglement.html", "Uncertainty_Principle.html", "Quantum_Tunneling.html"];

  function updatePageSwitch(lm, now) {
    if (pinchInfo(lm).ratio < PINCH_OFF) {
      targetFingerCount = -1;
      return;
    }
    // Count extended fingers: Index(8), Middle(12), Ring(16), Pinky(20)
    let extended = 0;
    if (fingerExtended(lm, 8, 6, 5)) extended++;
    if (fingerExtended(lm, 12, 10, 9)) extended++;
    if (fingerExtended(lm, 16, 14, 13)) extended++;
    if (fingerExtended(lm, 20, 18, 17)) extended++;

    // WFC is page 1. Only switch if extended is different from 1.
    if (extended > 0 && extended !== 1) {
      if (extended === targetFingerCount) {
        const elapsed = now - switchTimer;
        const progress = Math.min(100, (elapsed / SWITCH_HOLD_MS) * 100).toFixed(0);
        hudLabel.textContent = `CAM · SWITCHING TO PAGE ${extended} (${progress}%)`;
        if (elapsed > SWITCH_HOLD_MS) {
          window.location.href = PAGES[extended];
        }
      } else {
        targetFingerCount = extended;
        switchTimer = now;
      }
    } else {
      targetFingerCount = -1;
    }
  }

  function normToCanvas(mx, my) {
    // MediaPipe gives x in [0..1] of the camera image, where x=0 is LEFT of
    // the camera view. We mirror so that moving the hand right moves the dot
    // right on screen.
    return {
      x: (1 - mx) * CANVAS_W,
      y: my * CANVAS_H,
    };
  }

  function onResults(results) {
    const now = performance.now();
    if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
      // release any pinch
      if (pinching) releasePinch();
      setDetected(false);
      return;
    }

    const lm = results.multiHandLandmarks[0];
    lastDetectedAt = now;
    setDetected(true);

    // Open Palm: Return Home (Prioritize over page switching)
    if (isOpenPalm(lm)) {
      if (openPalmStart === 0) openPalmStart = now;
      if (now - openPalmStart > PALM_HOLD_MS) {
        window.location.href = "index.html";
        return;
      }
    } else {
      openPalmStart = 0;
    }

    // Page Switching Check
    updatePageSwitch(lm, now);
    if (targetFingerCount !== -1) return; // Prioritize switching UI

    // Thumbs-up: advance screen
    if (isThumbsUp(lm)) {
      if (thumbUpStart === 0) thumbUpStart = now;
      if (now - thumbUpStart > THUMB_HOLD_MS && now - lastThumbAt > THUMB_COOLDOWN_MS) {
        lastThumbAt = now;
        thumbUpStart = 0;
        showScreen(screenIdx + 1);
      }
      // if thumbs-up, do not also try to pinch
      if (pinching) releasePinch();
      return;
    } else {
      thumbUpStart = 0;
    }

    // Pinch (thumb + index) — only on main screen
    const info = pinchInfo(lm);
    const pos = normToCanvas(info.mid.x, info.mid.y);

    const wantPinch = info.ratio < PINCH_ON;
    const wantRelease = info.ratio > PINCH_OFF;

    if (!pinching && wantPinch && (SCREENS[screenIdx] === 'main' || SCREENS[screenIdx] === 'stats')) {
      startPinch(pos.x, pos.y);
    } else if (pinching && wantRelease) {
      releasePinch();
    } else if (pinching) {
      // track
      moveDot(activePinchDot, pos.x, pos.y);
    }
  }

  function startPinch(x, y) {
    pinching = true;
    pinchStartAt = performance.now();
    // random collapse time: 0.4s – 2.0s
    pinchCollapseMs = 400 + Math.random() * 1600;
    activePinchDot = spawnDot(x, y);
    collapseNearestBubble(x, y);
    totalObs += 1;
    totalCollapseMs += pinchCollapseMs;
    updateStats();
    hudLabel.textContent = 'CAM · OBSERVED · COLLAPSED';
  }
  function releasePinch() {
    if (!pinching) return;
    pinching = false;
    // no afterimage — remove the observed dot immediately
    if (activePinchDot) {
      activePinchDot.remove();
    }
    activePinchDot = null;
    hudLabel.textContent = 'CAM · AWAITING GESTURE';
  }

  // ───── camera boot ─────
  async function startTracking() {
    try {
      hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      const video = document.getElementById('cam');
      camera = new Camera(video, { onFrame: async () => { await hands.send({ image: video }); }, width: 320, height: 240 });
      await camera.start();
      camBtn.classList.add('hidden');
      localStorage.setItem('camEnabled', 'true');
    } catch (err) {
      hudLabel.textContent = 'CAM · UNAVAILABLE';
      console.warn('camera start failed', err);
    }
  }
  camBtn.addEventListener('click', startTracking);

  // auto-start if permission is already granted or previously enabled
  (async () => {
    if (localStorage.getItem('camEnabled') === 'true') {
      startTracking();
      return;
    }
    try {
      const status = await navigator.permissions?.query({ name: 'camera' }).catch(() => null);
      if (status && status.state === 'granted') startTracking();
    } catch (_) {}
  })();

  // ───── keyboard fallback (for development / no-camera) ─────
  //   N → next screen   P → prev   Click anywhere on main → fake pinch
  window.addEventListener('keydown', (e) => {
    if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') showScreen(screenIdx + 1);
    if (e.key === 'p' || e.key === 'P' || e.key === 'ArrowLeft')  showScreen(screenIdx - 1);
  });
  canvas.addEventListener('mousedown', (e) => {
    const screen = SCREENS[screenIdx];
    if (screen !== 'main' && screen !== 'stats') return;
    const rect = canvas.getBoundingClientRect();
    const s = rect.width / CANVAS_W;
    const x = (e.clientX - rect.left) / s;
    const y = (e.clientY - rect.top) / s;
    startPinch(x, y);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!pinching || !activePinchDot) return;
    const rect = canvas.getBoundingClientRect();
    const s = rect.width / CANVAS_W;
    const x = (e.clientX - rect.left) / s;
    const y = (e.clientY - rect.top) / s;
    moveDot(activePinchDot, x, y);
  });
  window.addEventListener('mouseup', releasePinch);

  // initial render
  updateStats();
})();
