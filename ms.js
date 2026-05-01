(function() {
  // ───── letterbox scaling ─────
  const canvasEl = document.getElementById('canvas');
  const CW = 1728, CH = 1117;
  function fit() {
    const s = Math.max(window.innerWidth / CW, window.innerHeight / CH);
    canvasEl.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  fit();
  window.addEventListener('resize', fit);

  // ───── wrap every char in [data-scatter] into a <span class="ch"> ─────
  function splitChars() {
    const isHangul = (ch) => /[\uAC00-\uD7AF\u3130-\u318F]/.test(ch);
    const isLatinOrNum = (ch) => /[A-Za-z0-9]/.test(ch);

    const nodes = document.querySelectorAll('[data-scatter]');
    nodes.forEach((el) => {
      // skip font-mixing on faded/ghosted elements (they need uniform grey fill)
      const noMix = el.hasAttribute('data-nomix');
      const text = el.textContent;
      el.textContent = '';
      let i = 0;
      for (const ch of text) {
        if (ch === '\n') {
          el.appendChild(document.createElement('br'));
          continue;
        }
        const span = document.createElement('span');
        span.className = 'ch';
        // per-character font variant — only for real glyphs
        if (!noMix) {
          if (isHangul(ch)) {
            span.classList.add('v-kr');
          } else if (isLatinOrNum(ch)) {
            span.classList.add('v-en');
          }
        }
        // character-level displacement & rotation seeds
        const ang = Math.random() * Math.PI * 2;
        const dist = 220 + Math.random() * 380; // px
        const tx = Math.cos(ang) * dist;
        const ty = Math.sin(ang) * dist;
        const rot = (Math.random() - 0.5) * 50; // ±25deg
        span.style.setProperty('--tx', tx.toFixed(1) + 'px');
        span.style.setProperty('--ty', ty.toFixed(1) + 'px');
        span.style.setProperty('--rot', rot.toFixed(1) + 'deg');
        span.style.setProperty('--i', i);
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        el.appendChild(span);
        i++;
      }
    });
  }
  splitChars();

  // ───── re-seed random offsets on every re-entry ─────
  function reseed(slide) {
    slide.querySelectorAll('.ch').forEach((span) => {
      const ang = Math.random() * Math.PI * 2;
      const dist = 220 + Math.random() * 380;
      span.style.setProperty('--tx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      span.style.setProperty('--ty', (Math.sin(ang) * dist).toFixed(1) + 'px');
      span.style.setProperty('--rot', ((Math.random() - 0.5) * 50).toFixed(1) + 'deg');
    });
  }

  // ───── slide controller ─────
  const slides = Array.from(document.querySelectorAll('.slide'));
  const counterEl = document.getElementById('counter');
  const barEl = document.getElementById('bar');

  const HOLD_MS   = 5000;   // 5s visible per slide
  const FADE_MS   = 900;    // fade/scatter duration
  const CYCLE_MS  = HOLD_MS + FADE_MS;

  // Slide modes:
  //   'wait'  — do not auto-advance; respond only to gestures
  //   'auto'  — auto-advance on the timed loop
  //   'halt'  — stop; also gesture-controlled
  const MODE = ['wait', 'auto', 'auto', 'auto', 'auto', 'auto', 'wait', 'wait'];
  const LABELS = ['01', '02', '03', '04', '05', '06', '06', '07'];
  const TOTAL = slides.length;

  let idx = 0;
  let timer = null;
  let tickTimer = null;
  let holdStart = performance.now();
  let paused = false;
  let pauseStart = 0;
  let transitioning = false;

  function mode() { return MODE[idx]; }
  function isAutoMode() { return mode() === 'auto'; }

  function updateCounter() {
    if (idx === 7) {
      counterEl.textContent = 'MACRO';
    } else {
      counterEl.textContent = LABELS[idx] + ' / 06';
    }
  }

  function show(i) {
    idx = i;
    slides.forEach((s, k) => {
      s.classList.remove('is-active', 'is-exiting');
      if (k === i) {
        reseed(s);
        void s.offsetWidth;
        s.classList.add('is-active');
      }
    });
    updateCounter();
    holdStart = performance.now();
    // progress bar: full for wait/halt (no countdown), resets to 0 for auto
    if (!isAutoMode()) barEl.style.width = '0%';
    // refresh HUD label for new slide mode
    if (typeof setDetected === 'function') {
      setDetected(body.classList.contains('is-detected'));
    }
  }

  function goTo(n) {
    if (n < 0 || n >= TOTAL || transitioning) return;
    transitioning = true;
    if (timer) clearTimeout(timer);
    show(n);
    setTimeout(() => {
      transitioning = false;
      startLoop();
    }, FADE_MS);
  }

  function skip() {
    if (transitioning) return;
    if (idx < 6) {
      goTo(idx + 1);
    } else if (idx === 6) { // only redirect on the final entry slide
      window.location.href = "Wavefunction_Collapse.html";
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
      skip();
    }
  });

  // mouse click fallback: click anywhere on canvas to skip
  canvasEl.addEventListener('click', skip);

  function next() {
    if (paused) return;
    if (!isAutoMode()) return;
    goTo((idx + 1) % TOTAL);
  }

  function startLoop() {
    if (timer) clearTimeout(timer);
    const step = () => {
      if (!paused && isAutoMode()) next();
      timer = setTimeout(step, CYCLE_MS);
    };
    timer = setTimeout(step, CYCLE_MS);
  }

  function setPaused(on) {
    if (on === paused) return;
    paused = on;
    document.body.classList.toggle('is-paused', on);
    if (on) {
      pauseStart = performance.now();
    } else {
      // shift holdStart forward by pause duration so progress resumes
      const pausedFor = performance.now() - pauseStart;
      holdStart += pausedFor;
    }
  }

  // ───── progress bar ─────
  function tick() {
    if (paused) return;
    if (!isAutoMode()) return;
    const elapsed = performance.now() - holdStart;
    const pct = Math.min(100, (elapsed / CYCLE_MS) * 100);
    barEl.style.width = pct + '%';
  }
  tickTimer = setInterval(tick, 60);

  // ───── hand tracking (hidden) — V-sign advances the slide ─────
  const body = document.body;
  const hud = document.getElementById('hud');
  const hudLabel = document.getElementById('hudLabel');
  let lastDetectedAt = 0;
  const DETECT_HOLD_MS = 250;

  function fingerExtended(lm, tip, pip, mcp) {
    const wrist = lm[0];
    const dTip = Math.hypot(lm[tip].x - wrist.x, lm[tip].y - wrist.y);
    const dPip = Math.hypot(lm[pip].x - wrist.x, lm[pip].y - wrist.y);
    const dMcp = Math.hypot(lm[mcp].x - wrist.x, lm[mcp].y - wrist.y);
    return dTip > dPip && dPip > dMcp * 0.85;
  }
  function isVSign(lm) {
    const index  = fingerExtended(lm, 8,  6,  5);
    const middle = fingerExtended(lm, 12, 10, 9);
    const ring   = fingerExtended(lm, 16, 14, 13);
    const pinky  = fingerExtended(lm, 20, 18, 17);
    if (!(index && middle)) return false;
    if (ring || pinky) return false;
    const spread = Math.hypot(lm[8].x - lm[12].x, lm[8].y - lm[12].y);
    const hand   = Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) || 1e-6;
    return (spread / hand) > 0.35;
  }
  function isFist(lm) {
    // All four non-thumb fingers folded (tip closer to wrist than PIP).
    const index  = fingerExtended(lm, 8,  6,  5);
    const middle = fingerExtended(lm, 12, 10, 9);
    const ring   = fingerExtended(lm, 16, 14, 13);
    const pinky  = fingerExtended(lm, 20, 18, 17);
    if (index || middle || ring || pinky) return false;
    // Also check that fingertips are close to the palm (within ~hand-width).
    const hand = Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) || 1e-6;
    const tipsToWrist = [8,12,16,20].map(i =>
      Math.hypot(lm[i].x - lm[0].x, lm[i].y - lm[0].y)
    );
    const avg = tipsToWrist.reduce((a,b)=>a+b,0) / 4;
    return (avg / hand) < 1.6;
  }

  // One-finger (index only) — accept for intro start
  function isOneFinger(lm) {
    const index  = fingerExtended(lm, 8,  6,  5);
    const middle = fingerExtended(lm, 12, 10, 9);
    const ring   = fingerExtended(lm, 16, 14, 13);
    const pinky  = fingerExtended(lm, 20, 18, 17);
    return index && !middle && !ring && !pinky;
  }

  // Thumbs up / down — four fingers folded, thumb extended, direction from thumb vector
  function thumbDir(lm) {
    // returns 'up' | 'down' | null
    const index  = fingerExtended(lm, 8,  6,  5);
    const middle = fingerExtended(lm, 12, 10, 9);
    const ring   = fingerExtended(lm, 16, 14, 13);
    const pinky  = fingerExtended(lm, 20, 18, 17);
    if (index || middle || ring || pinky) return null;

    // thumb extended check — tip (4) farther from wrist (0) than MCP (2)
    const wrist = lm[0], thumbTip = lm[4], thumbMcp = lm[2];
    const dTip = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
    const dMcp = Math.hypot(thumbMcp.x - wrist.x, thumbMcp.y - wrist.y);
    if (dTip < dMcp * 1.15) return null; // thumb not extended

    // Vertical direction: MediaPipe y grows downward.
    // Up = thumb tip significantly above wrist (smaller y).
    const dy = thumbTip.y - wrist.y;
    const dx = Math.abs(thumbTip.x - wrist.x);
    const hand = Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) || 1e-6;

    // require the thumb to be more vertical than horizontal
    if (Math.abs(dy) < dx * 0.8) return null;
    if (Math.abs(dy) / hand < 0.3) return null;
    return dy < 0 ? 'up' : 'down';
  }

  function isOpenPalm(lm) {
    // Four fingers extended (thumb can be anything)
    const index  = fingerExtended(lm, 8,  6,  5);
    const middle = fingerExtended(lm, 12, 10, 9);
    const ring   = fingerExtended(lm, 16, 14, 13);
    const pinky  = fingerExtended(lm, 20, 18, 17);
    return index && middle && ring && pinky;
  }
  function setDetected(on) {
    body.classList.toggle('is-detected', on);
    hud.classList.toggle('is-detected', on);
    if (paused) {
      hudLabel.textContent = 'CAM_01 · PAUSED (FIST)';
      return;
    }
    if (idx === 0) {
      hudLabel.textContent = on ? 'CAM_01 · START DETECTED' : 'CAM_01 · SHOW 1 OR 2 FINGERS';
      return;
    }
    if (idx === 4 || idx === 5) {
      hudLabel.textContent = 'CAM_01 · THUMB UP: NEXT   ·   OPEN HAND: RESTART';
      return;
    }
    if (idx === 6) {
      hudLabel.textContent = 'CAM_01 · THUMB UP / OPEN HAND: RESTART';
      return;
    }
    hudLabel.textContent = on ? 'CAM_01 · GESTURE DETECTED' : 'CAM_01 · AWAITING GESTURE';
  }

  let hands, camera;
  let lastFistAt = 0;
  let lastThumbUpAt = 0;
  let lastOpenPalmAt = 0;
  let lastStartAt = 0;
  const FIST_HOLD_MS   = 350;
  const GESTURE_COOLDOWN_MS = 1500; // prevent repeated fire of start/thumb
  const START_HOLD_MS = 1000;

  let oneHoldStart = 0;
  let vHoldStart = 0;

  function fireThumbUp() {
    const now = performance.now();
    if (now - lastThumbUpAt < GESTURE_COOLDOWN_MS) return;
    lastThumbUpAt = now;
    // on 4 interventions slide (idx 5): go to entry slide
    if (idx === 5 && !transitioning) goTo(6);
    // on entry slide (idx 6): redirect to interaction modules
    if (idx === 6 && !transitioning) {
      window.location.href = "Wavefunction_Collapse.html";
    }
    // on macro (idx 7): thumb up restarts to beginning
    if (idx === 7 && !transitioning) goTo(0);
  }
  function fireOpenPalm(){
    const now = performance.now();
    if (now - lastOpenPalmAt < GESTURE_COOLDOWN_MS) return;
    lastOpenPalmAt = now;
    // from halt slide: go back to intro
    if (idx === 4 && !transitioning) goTo(0);
    // from 4 interventions (idx 5): go back to previous
    if (idx === 5 && !transitioning) goTo(4);
    // from final intro (idx 6): go back to intro
    if (idx === 6 && !transitioning) goTo(0);
    // from macro (idx 7): go back to intro
    if (idx === 7 && !transitioning) goTo(0);
  }

  function onResults(results) {
    let v = false, fist = false, one = false, thumb = null, palm = false;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
      for (const lm of results.multiHandLandmarks) {
        if (isFist(lm)) { fist = true; continue; }
        if (isOpenPalm(lm)) { palm = true; continue; }
        const td = thumbDir(lm);
        if (td) { thumb = td; continue; }
        if (isVSign(lm)) v = true;
        else if (isOneFinger(lm)) one = true;
      }
    }
    const now = performance.now();
    if (v || one) lastDetectedAt = now;
    if (fist) lastFistAt = now;

    // Trigger state-dependent gestures
    if (idx === 0 && !transitioning) {
      if (now - lastStartAt > GESTURE_COOLDOWN_MS) {
        if (v) { // 2 fingers -> MACRO branch
          oneHoldStart = 0; // reset other
          if (vHoldStart === 0) vHoldStart = now;
          if (now - vHoldStart > START_HOLD_MS) {
            lastStartAt = now;
            vHoldStart = 0;
            goTo(7);
          }
        } else if (one) { // 1 finger -> MICRO branch
          vHoldStart = 0; // reset other
          if (oneHoldStart === 0) oneHoldStart = now;
          if (now - oneHoldStart > START_HOLD_MS) {
            lastStartAt = now;
            oneHoldStart = 0;
            goTo(1);
          }
        } else {
          oneHoldStart = 0;
          vHoldStart = 0;
        }
      }
    }
    if (thumb === 'up')   fireThumbUp();
    if (palm) fireOpenPalm();

    // Fist-pause is only meaningful during auto-play
    setPaused(isAutoMode() && (now - lastFistAt < FIST_HOLD_MS));
    setDetected(now - lastDetectedAt < DETECT_HOLD_MS);
  }
  async function startTracking() {
    try {
      hands = new Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      const video = document.getElementById('cam');
      camera = new Camera(video, { onFrame: async () => { await hands.send({ image: video }); }, width: 320, height: 240 });
      await camera.start();
      localStorage.setItem('camEnabled', 'true');
    } catch (err) {
      hudLabel.textContent = 'CAM_01 · UNAVAILABLE';
    }
  }
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

  // Boot
  show(0);
  startLoop();
})();
