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
  const hud            = document.getElementById('hud');
  const hudLabel       = document.getElementById('hudLabel');
  const camBtn         = document.getElementById('camBtn');
  const pageCounter    = document.getElementById('pageCounter');
  const screens        = Array.from(document.querySelectorAll('.screen'));
  
  const statV1 = document.getElementById('statV1');
  const statV2 = document.getElementById('statV2');
  const statIndex = document.getElementById('statIndex');

  // Stats smoothing
  let displayDp = 5, displayDx = 160, displayIdx = 232;

  // ───── probability cloud ─────
  const BUBBLE_COUNT = 45;
  const bubbles = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawnBubble(x, y, initialVelocity = null) {
    const el = document.createElement('div');
    el.className = 'bubble';
    const r = rand(100, 380);
    el.style.width  = r + 'px';
    el.style.height = r + 'px';
    el.style.opacity = rand(0.3, 0.6).toFixed(2);
    const b = {
      el, r, x, y,
      vx: initialVelocity ? initialVelocity.x : rand(-0.2, 0.2),
      vy: initialVelocity ? initialVelocity.y : rand(-0.2, 0.2),
      phase: Math.random() * Math.PI * 2,
      amp: rand(8, 20),
      freq: rand(0.0004, 0.0012),
      collapsed: false
    };
    cloudLayer.appendChild(el);
    positionBubble(b);
    return b;
  }

  function positionBubble(b) {
    b.el.style.transform = `translate(${(b.x - b.r/2).toFixed(1)}px, ${(b.y - b.r/2).toFixed(1)}px)`;
  }

  function createBubbles() {
    cloudLayer.innerHTML = '';
    bubbles.length = 0;
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      bubbles.push(spawnBubble(rand(0, CANVAS_W), rand(0, CANVAS_H)));
    }
  }

  let lastT = performance.now();
  function animateCloud(now) {
    const dt = Math.min(64, now - lastT);
    lastT = now;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.collapsed) continue;
      b.phase += b.freq * dt;
      b.x += b.vx * dt * 0.7 + Math.sin(b.phase) * 0.4;
      b.y += b.vy * dt * 0.7 + Math.cos(b.phase * 0.8) * 0.4;
      const margin = b.r;
      if (b.x < -margin) b.x = CANVAS_W + margin;
      if (b.x > CANVAS_W + margin) b.x = -margin;
      if (b.y < -margin) b.y = CANVAS_H + margin;
      if (b.y > CANVAS_H + margin) b.y = -margin;
      positionBubble(b);
    }
    requestAnimationFrame(animateCloud);
  }
  requestAnimationFrame(animateCloud);
  createBubbles();

  // ───── interaction state ─────
  let activePinchDot = null;
  let pinching = false;
  let lastPinchX = 0, lastPinchY = 0;
  let currentVelocity = 0;

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

    // UP is page 3. Switch if different.
    if (extended > 0 && extended !== 3) {
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

  // Smoothing loop for stats
  function updateStatsDisplay() {
    const targetVel = pinching ? currentVelocity : 0;
    const targetDp = targetVel * 25 + 5;
    const targetDx = Math.max(8.5, (160 / (1 + targetVel * 0.8)));
    const targetIdx = targetDp * targetDx * 0.35;
    
    displayDp  = displayDp * 0.92  + targetDp * 0.08;
    displayDx  = displayDx * 0.92  + targetDx * 0.08;
    displayIdx = displayIdx * 0.92 + targetIdx * 0.08;

    if(statV1) statV1.textContent = displayDp.toFixed(2);
    if(statV2) statV2.textContent = displayDx.toFixed(2);
    if(statIndex) statIndex.textContent = Math.floor(displayIdx);
    
    requestAnimationFrame(updateStatsDisplay);
  }
  updateStatsDisplay();

  function spawnDot(x, y) {
    const el = document.createElement('div');
    el.className = 'collapsed-dot';
    el.style.transform = `translate(${x}px, ${y}px)`;
    particlesLayer.appendChild(el);
    const burst = document.createElement('div');
    burst.className = 'burst';
    burst.style.left = x + 'px'; 
    burst.style.top = y + 'px';
    particlesLayer.appendChild(burst);
    setTimeout(() => burst.remove(), 800);
    return el;
  }

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
    best.el.style.transform = `translate(${x}px, ${y}px) scale(0.01)`;
    setTimeout(() => {
      best.el.remove();
      const idx = bubbles.indexOf(best);
      if (idx >= 0) bubbles.splice(idx, 1);
    }, 1000);
  }

  function handleInteractionMove(x, y, dt) {
    if (!pinching || !activePinchDot) return;
    const dx = x - lastPinchX;
    const dy = y - lastPinchY;
    const dist = Math.hypot(dx, dy);
    const instantaneousVel = dist / (dt || 16);
    currentVelocity = currentVelocity * 0.8 + instantaneousVel * 0.2;
    
    const blurAmount = Math.min(30, currentVelocity * 8);
    const opacity = Math.max(0.15, 1 - currentVelocity * 0.5);
    const scale = 1 + currentVelocity * 0.6; 
    
    activePinchDot.style.filter = `blur(${blurAmount}px)`;
    activePinchDot.style.opacity = opacity;
    activePinchDot.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    
    if (currentVelocity > 1.2 && Math.random() < 0.3) {
      const nb = spawnBubble(x + rand(-30, 30), y + rand(-30, 30), {
        x: dx * 0.1 + rand(-0.1, 0.1),
        y: dy * 0.1 + rand(-0.1, 0.1)
      });
      nb.el.style.transition = 'opacity 2s ease';
      bubbles.push(nb);
      if (bubbles.length > 60) {
        const old = bubbles.shift();
        if (old && old.el) old.el.remove();
      }
    }
    lastPinchX = x;
    lastPinchY = y;
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
  let lastDetectedAt = 0;
  const DETECT_HOLD_MS = 600;

  function setDetected(on) {
    hud.classList.toggle('is-detected', on);
    hudLabel.textContent = on ? 'CAM · PINCH TO OBSERVE' : 'CAM · AWAITING GESTURE';
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
  let lastMoveT = 0;

  let openPalmStart = 0;
  const PALM_HOLD_MS = 3000;
  
  function onResults(results) {
    const now = performance.now();
    const dt = now - lastMoveT;
    lastMoveT = now;
    
    if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
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
      if (pinching) releasePinch();
      return;
    } else {
      thumbUpStart = 0;
    }

    const info = pinchInfo(lm);
    const x = (1 - info.mid.x) * CANVAS_W;
    const y = info.mid.y * CANVAS_H;
    
    if (!pinching && info.ratio < 0.35) {
      startPinch(x, y);
    } else if (pinching && info.ratio > 0.55) {
      releasePinch();
    } else if (pinching) {
      handleInteractionMove(x, y, dt);
    }
  }

  function startPinch(x, y) {
    pinching = true;
    lastPinchX = x; lastPinchY = y; currentVelocity = 0;
    activePinchDot = spawnDot(x, y);
    collapseNearestBubble(x, y);
    hudLabel.textContent = 'CAM · OBSERVED · COLLAPSED';
  }
  function releasePinch() {
    if (!pinching) return;
    pinching = false;
    if (currentVelocity > 1.5) {
      for(let i=0; i<3; i++) spawnBubble(lastPinchX + rand(-20, 20), lastPinchY + rand(-20, 20));
    }
    if (activePinchDot) activePinchDot.remove();
    activePinchDot = null;
    hudLabel.textContent = 'CAM · AWAITING GESTURE';
  }

  async function startTracking() {
    try {
      if (!window.Hands || !window.Camera) {
        hudLabel.textContent = 'CAM · LOADING ASSETS...';
        setTimeout(startTracking, 500);
        return;
      }
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
      console.error(err);
    }
  }
  camBtn.addEventListener('click', startTracking);

  // Mouse fallback
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const s = rect.width / CANVAS_W;
    startPinch((e.clientX - rect.left) / s, (e.clientY - rect.top) / s);
  });
  canvas.addEventListener('mousemove', (e) => {
    if (!pinching || !activePinchDot) return;
    const rect = canvas.getBoundingClientRect();
    const s = rect.width / CANVAS_W;
    handleInteractionMove((e.clientX - rect.left) / s, (e.clientY - rect.top) / s, 16);
  });
  window.addEventListener('mouseup', releasePinch);

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
