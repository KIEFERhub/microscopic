(function() {
  const CANVAS_W = 1920, CANVAS_H = 1080;

  // ───── letterbox scale ─────
  const canvas = document.getElementById('canvas');
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.max(vw / CANVAS_W, vh / CANVAS_H);
    canvas.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ───── elements ─────
  const cloudLayer     = document.getElementById('cloudLayer');
  const particlesLayer = document.getElementById('particlesLayer');
  const barrierEl      = document.getElementById('barrier');
  const hud            = document.getElementById('hud');
  const hudLabel       = document.getElementById('hudLabel');
  const camBtn         = document.getElementById('camBtn');
  const pageCounter    = document.getElementById('pageCounter');
  const screens        = Array.from(document.querySelectorAll('.screen'));
  
  const statV1 = document.getElementById('statV1'); // Collisions
  const statV2 = document.getElementById('statV2'); // Tunnels
  const statIndex = document.getElementById('statIndex'); // Probability

  // Stats
  let totalCollisions = 0;
  let totalTunnels = 0;
  let displayCollisions = 0, displayTunnels = 0, displayProb = 0;

  // ───── particle system ─────
  const PARTICLE_COUNT = 80;
  const particles = [];
  const TUNNEL_CHANCE = 0.25; // 25% chance to tunnel

  function rand(a, b) { return a + Math.random() * (b - a); }

  function createParticle() {
    const el = document.createElement('div');
    el.className = 'particle';
    cloudLayer.appendChild(el);
    const p = {
      el,
      x: rand(0, CANVAS_W),
      y: rand(0, CANVAS_H),
      vx: rand(1.5, 3.5) * (Math.random() > 0.5 ? 1 : -1),
      vy: rand(-0.5, 0.5),
      lastBarrierId: -1 // to avoid multi-counting
    };
    particles.push(p);
    return p;
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) createParticle();

  // ───── barrier state ─────
  let barrier = { x: CANVAS_W / 2, y: CANVAS_H / 2, w: 24, h: 400, active: false };

  function updateBarrierUI() {
    barrierEl.style.transform = `translate(${barrier.x - barrier.w/2}px, ${barrier.y - barrier.h/2}px)`;
    barrierEl.classList.toggle('is-active', barrier.active);
  }

  // ───── Page Switching Logic ─────
  let switchTimer = null;
  let targetFingerCount = -1;
  const SWITCH_HOLD_MS = 1500;
  const PAGES = ["", "Wavefunction_Collapse.html", "Quantum_Entanglement.html", "Uncertainty_Principle.html", "Quantum_Tunneling.html"];

  function updatePageSwitch(lm, now) {
    if (pinchInfo(lm).ratio < 0.65) {
      targetFingerCount = -1;
      return;
    }
    let extended = 0;
    if (fingerExtended(lm, 8, 6, 5)) extended++;
    if (fingerExtended(lm, 12, 10, 9)) extended++;
    if (fingerExtended(lm, 16, 14, 13)) extended++;
    if (fingerExtended(lm, 20, 18, 17)) extended++;

    // QT is page 4. Switch if different.
    if (extended > 0 && extended !== 4) {
      if (extended === targetFingerCount) {
        const elapsed = now - switchTimer;
        const progress = Math.min(100, (elapsed / SWITCH_HOLD_MS) * 100).toFixed(0);
        hudLabel.textContent = `CAM · SWITCHING TO PAGE ${extended} (${progress}%)`;
        if (elapsed > SWITCH_HOLD_MS) window.location.href = PAGES[extended];
      } else {
        targetFingerCount = extended;
        switchTimer = now;
      }
    } else {
      targetFingerCount = -1;
    }
  }

  // ───── animation ─────
  let lastT = performance.now();
  function animate(now) {
    const dt = Math.min(64, now - lastT);
    const dtFactor = dt / 16.66;
    lastT = now;

    for (const p of particles) {
      p.x += p.vx * dtFactor;
      p.y += p.vy * dtFactor;

      // Screen wrap
      if (p.x < -10) p.x = CANVAS_W + 10;
      if (p.x > CANVAS_W + 10) p.x = -10;
      if (p.y < -10) p.y = CANVAS_H + 10;
      if (p.y > CANVAS_H + 10) p.y = -10;

      // Collision logic
      if (barrier.active) {
        const bx1 = barrier.x - barrier.w/2;
        const bx2 = barrier.x + barrier.w/2;
        const by1 = barrier.y - barrier.h/2;
        const by2 = barrier.y + barrier.h/2;

        if (p.y > by1 && p.y < by2) {
          // If entering the barrier zone
          const wasOutside = (p.x - p.vx * dtFactor < bx1) || (p.x - p.vx * dtFactor > bx2);
          const isInside = p.x >= bx1 && p.x <= bx2;

          if (wasOutside && isInside) {
            // Roll for tunnel
            if (Math.random() < TUNNEL_CHANCE) {
              totalTunnels++;
              spawnBurst(p.x, p.y);
            } else {
              totalCollisions++;
              p.vx *= -1;
              p.x += p.vx * dtFactor * 2; // push out
            }
          }
        }
      }

      p.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }

    // Stats smoothing
    displayCollisions = displayCollisions * 0.9 + totalCollisions * 0.1;
    displayTunnels    = displayTunnels * 0.9 + totalTunnels * 0.1;
    const realProb = totalCollisions + totalTunnels > 0 ? (totalTunnels / (totalCollisions + totalTunnels)) * 100 : 0;
    displayProb = displayProb * 0.95 + realProb * 0.05;

    if(statV1) statV1.textContent = Math.floor(displayCollisions);
    if(statV2) statV2.textContent = Math.floor(displayTunnels);
    if(statIndex) statIndex.textContent = displayProb.toFixed(1) + '%';

    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  function spawnBurst(x, y) {
    const el = document.createElement('div');
    el.className = 'tunnel-burst';
    el.style.left = x + 'px'; el.style.top = y + 'px';
    particlesLayer.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  // ───── screen navigation ─────
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
      window.location.href = "01_Hello_World.html";
    }
  });

  // Boot
  showScreen(0);

  // ───── hand tracking ─────
  let hands = null, camera = null;
  function setDetected(on) {
    hud.classList.toggle('is-detected', on);
    if(!barrier.active) hudLabel.textContent = on ? 'CAM · PINCH TO MOVE BARRIER' : 'CAM · AWAITING GESTURE';
  }

  function fingerExtended(lm, tip, pip) {
    const w = lm[0];
    return Math.hypot(lm[tip].x - w.x, lm[tip].y - w.y) > Math.hypot(lm[pip].x - w.x, lm[pip].y - w.y) * 1.05;
  }
  function isOpenPalm(lm) {
    const thumb  = isThumbExtended(lm);
    const index  = fingerExtended(lm, 8,  6);
    const middle = fingerExtended(lm, 12, 10);
    const ring   = fingerExtended(lm, 16, 14);
    const pinky  = fingerExtended(lm, 20, 18);
    return thumb && index && middle && ring && pinky;
  }
  function isThumbExtended(lm) {
    const w = lm[0], tip = lm[4], mcp = lm[2];
    const dTip = Math.hypot(tip.x - w.x, tip.y - w.y);
    const dMcp = Math.hypot(mcp.x - w.x, mcp.y - w.y);
    return dTip > dMcp * 1.15;
  }
  function isThumbsUp(lm) {
    const fingers = [8, 12, 16, 20].some(f => fingerExtended(lm, f, f-2));
    if (fingers) return false;
    const dy = lm[4].y - lm[0].y;
    const dx = Math.abs(lm[4].x - lm[0].x);
    return dy < -0.15 && dx < 0.2;
  }
  function pinchInfo(lm) {
    const hand = Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) || 1e-6;
    const d = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
    const mid = { x: (lm[4].x + lm[8].x) / 2, y: (lm[4].y + lm[8].y) / 2 };
    return { ratio: d / hand, mid };
  }

  let lastThumbAt = 0;
  let thumbUpStart = 0;
  const THUMB_HOLD_MS = 1000;
  const THUMB_COOLDOWN_MS = 1500;

  let openPalmStart = 0;
  const PALM_HOLD_MS = 3000;
  function onResults(results) {
    const now = performance.now();
    if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
      if (barrier.active) { barrier.active = false; updateBarrierUI(); }
      setDetected(false);
      return;
    }
    const lm = results.multiHandLandmarks[0];
    setDetected(true);

    // Open Palm: Return Home (Prioritize over page switching)
    if (isOpenPalm(lm)) {
      if (openPalmStart === 0) openPalmStart = now;
      if (now - openPalmStart > PALM_HOLD_MS) {
        window.location.href = "01_Hello_World.html";
        return;
      }
    } else {
      openPalmStart = 0;
    }

    // Page Switching Check
    updatePageSwitch(lm, now);
    if (targetFingerCount !== -1) return;

    if (isThumbsUp(lm)) {
      if (thumbUpStart === 0) thumbUpStart = now;
      if (now - thumbUpStart > THUMB_HOLD_MS && now - lastThumbAt > THUMB_COOLDOWN_MS) {
        lastThumbAt = now;
        thumbUpStart = 0;
        showScreen(screenIdx + 1);
      }
      if (barrier.active) { barrier.active = false; updateBarrierUI(); }
      return;
    } else {
      thumbUpStart = 0;
    }

    const info = pinchInfo(lm);
    if (info.ratio < 0.4) {
      barrier.active = true;
      barrier.x = (1 - info.mid.x) * CANVAS_W;
      barrier.y = info.mid.y * CANVAS_H;
      hudLabel.textContent = 'CAM · BARRIER ACTIVE';
      updateBarrierUI();
    } else {
      if (barrier.active) { barrier.active = false; updateBarrierUI(); }
    }
  }

  async function startTracking() {
    try {
      if (!window.Hands || !window.Camera) { setTimeout(startTracking, 500); return; }
      hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      const video = document.getElementById('cam');
      camera = new Camera(video, { onFrame: async () => { await hands.send({ image: video }); }, width: 320, height: 240 });
      await camera.start();
      camBtn.classList.add('hidden');
      localStorage.setItem('camEnabled', 'true');
    } catch (err) { hudLabel.textContent = 'CAM · UNAVAILABLE'; }
  }
  camBtn.addEventListener('click', startTracking);

  // Mouse fallback
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const s = rect.width / CANVAS_W;
    barrier.active = true;
    barrier.x = (e.clientX - rect.left) / s;
    barrier.y = (e.clientY - rect.top) / s;
    updateBarrierUI();
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!barrier.active) return;
    const rect = canvas.getBoundingClientRect();
    const s = rect.width / CANVAS_W;
    barrier.x = (e.clientX - rect.left) / s;
    barrier.y = (e.clientY - rect.top) / s;
    updateBarrierUI();
  });
  window.addEventListener('mouseup', () => { barrier.active = false; updateBarrierUI(); });

  // Auto-start if permission already granted or previously enabled
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
})();
