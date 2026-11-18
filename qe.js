(function() {
  // ───── letterbox scaling ─────
  const canvasEl = document.getElementById('canvas');
  const CW = 1920, CH = 1080;
  function fit() {
    const sx = window.innerWidth / CW;
    const sy = window.innerHeight / CH;
    const s = Math.max(sx, sy);
    canvasEl.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  fit();
  window.addEventListener('resize', fit);

  // ───── decorative molecule circles ─────
  const molData = [
    {x:364.5, y:708.5}, {x:76.5, y:122.5}, {x:36.5, y:14.5},
    {x:780.5, y:564.5}, {x:1229.5, y:641.5}, {x:342.5, y:426.5},
    {x:817.5, y:948.5}, {x:498.5, y:1015.5}, {x:1370.5, y:835.5},
    {x:1460.5, y:411.5}, {x:955.5, y:353.5}, {x:1131.5, y:216.5},
    {x:498.5, y:216.5}, {x:174.5, y:740.5}, {x:401.5, y:1022.5},
    {x:1533.5, y:875.5}, {x:1685.5, y:568.5}, {x:1633.5, y:-0.5}
  ];
  for(let i=0; i<30; i++) {
    molData.push({x: 100 + Math.random()*1528, y: 100 + Math.random()*917});
  }

  const molLayer = document.getElementById('molLayer');
  const molEls = [];
  molData.forEach((m, i) => {
    const el = document.createElement('div');
    el.className = 'mol';
    el.style.width = el.style.height = '48px';
    el.style.left = (m.x - 24) + 'px';
    el.style.top  = (m.y - 24) + 'px';
    el.style.animationDelay = (i * 0.3) + 's';
    el.style.animation = `mol-float ${6 + Math.random() * 4}s ease-in-out infinite`;
    molLayer.appendChild(el);
    molEls.push({ el, isEntangled: false });
  });

  // ───── entanglement simulation ─────
  const pairsLayer = document.getElementById('pairsLayer');
  let totalEntanglements = 0;
  let totalDist = 0;
  const statEntEl = document.getElementById('statEnt');
  const statDistEl = document.getElementById('statDist');

  let activeEntanglements = [];

  function startEntanglement(x, y) {
    if (activeEntanglements.length > 0) return;

    const canvasRect = canvasEl.getBoundingClientRect();
    const scaleX = CW / canvasRect.width;
    const scaleY = CH / canvasRect.height;
    
    let closestMol = null;
    let minD = Infinity;
    
    for (const m of molEls) {
      if (m.isEntangled) continue;
      const r = m.el.getBoundingClientRect();
      const mx = (r.left + r.width/2 - canvasRect.left) * scaleX;
      const my = (r.top + r.height/2 - canvasRect.top) * scaleY;
      const d = Math.hypot(mx - x, my - y);
      if (d < minD) {
        minD = d;
        closestMol = m;
      }
    }
    
    if (!closestMol) return;
    
    const available = molEls.filter(m => !m.isEntangled && m !== closestMol);
    if (available.length === 0) return;
    
    const numToConnect = Math.min(available.length, Math.floor(Math.random() * 4) + 1);
    available.sort(() => Math.random() - 0.5);
    const targetMols = available.slice(0, numToConnect);
    
    const group = [closestMol, ...targetMols];
    group.forEach(m => {
      m.isEntangled = true;
      m.el.classList.add('is-entangled');
    });
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ent-line');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    pairsLayer.appendChild(svg);
    
    const lines = [];
    targetMols.forEach(target => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      svg.appendChild(line);
      lines.push({ source: closestMol, target: target, line: line });
    });
    
    const r1 = closestMol.el.getBoundingClientRect();
    const cx1 = (r1.left + r1.width/2 - canvasRect.left) * scaleX;
    const cy1 = (r1.top + r1.height/2 - canvasRect.top) * scaleY;
    
    const burst = document.createElement('div');
    burst.className = 'burst';
    burst.style.left = cx1 + 'px'; 
    burst.style.top = cy1 + 'px';
    pairsLayer.appendChild(burst);
    setTimeout(() => burst.remove(), 800);
    
    let sumDist = 0;
    
    const updateLines = () => {
      const curRect = canvasEl.getBoundingClientRect();
      const sX = CW / curRect.width;
      const sY = CH / curRect.height;
      
      lines.forEach(l => {
        const rS = l.source.el.getBoundingClientRect();
        const rT = l.target.el.getBoundingClientRect();
        const cxS = (rS.left + rS.width/2 - curRect.left) * sX;
        const cyS = (rS.top + rS.height/2 - curRect.top) * sY;
        const cxT = (rT.left + rT.width/2 - curRect.left) * sX;
        const cyT = (rT.top + rT.height/2 - curRect.top) * sY;
        
        l.line.setAttribute('x1', cxS); l.line.setAttribute('y1', cyS);
        l.line.setAttribute('x2', cxT); l.line.setAttribute('y2', cyT);
      });
    };
    
    updateLines();
    const lineUpdater = setInterval(updateLines, 30);
    
    targetMols.forEach(target => {
      const rT = target.el.getBoundingClientRect();
      const cxT = (rT.left + rT.width/2 - canvasRect.left) * scaleX;
      const cyT = (rT.top + rT.height/2 - canvasRect.top) * scaleY;
      sumDist += Math.hypot(cx1 - cxT, cy1 - cyT);
    });
    
    totalEntanglements++;
    totalDist += (sumDist / targetMols.length);
    statEntEl.textContent = totalEntanglements;
    statDistEl.textContent = Math.round(totalDist / totalEntanglements) + 'px';
    
    activeEntanglements.push({
      group,
      svg,
      lineUpdater
    });
  }

  function stopEntanglement() {
    activeEntanglements.forEach(ent => {
      clearInterval(ent.lineUpdater);
      ent.svg.style.transition = 'opacity 0.4s ease';
      ent.svg.style.opacity = '0';
      
      ent.group.forEach(m => {
        m.el.classList.remove('is-entangled');
        m.isEntangled = false;
      });
      
      setTimeout(() => ent.svg.remove(), 400);
    });
    activeEntanglements = [];
  }

  // ───── screen navigation ─────
  const SCREENS = ['desc', 'stats', 'main'];
  const SCREEN_LABELS = {
    desc:  '01 / 03 · MAIN',
    stats: '02 / 03 · STATS',
    main:  '03 / 03 · DESCRIPTION',
  };
  let screenIdx = 0;
  const pageCounter = document.getElementById('pageCounter');

  function showScreen(idx) {
    screenIdx = (idx + SCREENS.length) % SCREENS.length;
    const name = SCREENS[screenIdx];
    
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('is-active');
      s.style.display = 'none';
    });
    
    const target = document.querySelector(`[data-screen="${name}"]`);
    if (target) {
      target.style.display = 'block';
      requestAnimationFrame(() => target.classList.add('is-active'));
    }
    
    pageCounter.textContent = SCREEN_LABELS[name];
  }

  function nextScreen() {
    showScreen(screenIdx + 1);
  }

  // ───── keyboard ─────
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextScreen(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); showScreen(screenIdx - 1); }
    if (e.key === 'e' || e.key === 'E') {
      startEntanglement(300 + Math.random() * 1100, 200 + Math.random() * 600);
    }
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'e' || e.key === 'E') {
      stopEntanglement();
    }
  });

  // ───── click to create pair ─────
  canvasEl.addEventListener('mousedown', e => {
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = CW / rect.width;
    const scaleY = CH / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    startEntanglement(x, y);
  });
  window.addEventListener('mouseup', () => {
    stopEntanglement();
  });
  window.addEventListener('mouseleave', () => {
    stopEntanglement();
  });

  // ───── hand tracking ─────
  const body = document.body;
  const hud = document.getElementById('hud');
  const hudLabel = document.getElementById('hudLabel');
  const camBtn = document.getElementById('camBtn');
  let lastDetectedAt = 0;
  const DETECT_HOLD_MS = 250;

  function fingerExtended(lm, tip, pip, mcp) {
    const wrist = lm[0];
    const dTip = Math.hypot(lm[tip].x - wrist.x, lm[tip].y - wrist.y);
    const dPip = Math.hypot(lm[pip].x - wrist.x, lm[pip].y - wrist.y);
    const dMcp = Math.hypot(lm[mcp].x - wrist.x, lm[mcp].y - wrist.y);
    return dTip > dPip && dPip > dMcp * 0.85;
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

  function isPinch(lm) {
    const thumbTip = lm[4], indexTip = lm[8];
    const dist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    const hand = Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) || 1e-6;
    return (dist / hand) < 0.65;
  }

  function thumbDir(lm) {
    const index  = fingerExtended(lm, 8,  6,  5);
    const middle = fingerExtended(lm, 12, 10, 9);
    const ring   = fingerExtended(lm, 16, 14, 13);
    const pinky  = fingerExtended(lm, 20, 18, 17);
    if (index || middle || ring || pinky) return null;

    const wrist = lm[0], thumbTip = lm[4], thumbMcp = lm[2];
    const dTip = Math.hypot(thumbTip.x - wrist.x, thumbTip.y - wrist.y);
    const dMcp = Math.hypot(thumbMcp.x - wrist.x, thumbMcp.y - wrist.y);
    if (dTip < dMcp * 1.15) return null;

    const dy = thumbTip.y - wrist.y;
    const dx = Math.abs(thumbTip.x - wrist.x);
    const hand = Math.hypot(lm[5].x - lm[17].x, lm[5].y - lm[17].y) || 1e-6;
    if (Math.abs(dy) < dx * 0.9) return null;
    if (Math.abs(dy) / hand < 0.4) return null;
    return dy < 0 ? 'up' : 'down';
  }

  let lastThumbAt = 0;
  let thumbUpStart = 0;
  let thumbDownStart = 0;
  const THUMB_HOLD_MS = 1000;
  let wasPinching = false;
  const COOLDOWN = 1500;

  let openPalmStart = 0;
  const PALM_HOLD_MS = 3000;

  // ───── Page Switching Logic ─────
  let switchTimer = null;
  let targetFingerCount = -1;
  const SWITCH_HOLD_MS = 1500;
  const PAGES = ["", "Wavefunction_Collapse.html", "Quantum_Entanglement.html", "Uncertainty_Principle.html", "Quantum_Tunneling.html"];

  function updatePageSwitch(lm, now) {
    if (isPinch(lm)) {
      targetFingerCount = -1;
      return;
    }
    let extended = 0;
    if (fingerExtended(lm, 8, 6, 5)) extended++;
    if (fingerExtended(lm, 12, 10, 9)) extended++;
    if (fingerExtended(lm, 16, 14, 13)) extended++;
    if (fingerExtended(lm, 20, 18, 17)) extended++;

    // QE is page 2. Switch if different.
    if (extended > 0 && extended !== 2) {
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

  function setDetected(on) {
    body.classList.toggle('is-detected', on);
    hud.classList.toggle('is-detected', on);
    hudLabel.textContent = on ? 'CAM · GESTURE DETECTED' : 'CAM · AWAITING GESTURE';
  }

  function onResults(results) {
    const now = performance.now();
    let pinch = false, thumb = null;
    let pinchX = 0, pinchY = 0;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length) {
      for (const lm of results.multiHandLandmarks) {
        const td = thumbDir(lm);
        if (td) { thumb = td; continue; }
        if (isPinch(lm)) {
          pinch = true;
          pinchX = (1 - lm[8].x) * CW; // mirror
          pinchY = lm[8].y * CH;
        }
      }
      setDetected(true);
      
      // Open Palm: Return Home (Prioritize over page switching)
      if (isOpenPalm(results.multiHandLandmarks[0])) {
        if (openPalmStart === 0) openPalmStart = now;
        if (now - openPalmStart > PALM_HOLD_MS) {
          window.location.href = "index.html";
          return;
        }
      } else {
        openPalmStart = 0;
      }

      // Page Switching Check
      updatePageSwitch(results.multiHandLandmarks[0], now);
      if (targetFingerCount !== -1) return;
    }
    
    if (pinch || thumb) lastDetectedAt = now;

    if (thumb === 'up') {
      if (thumbUpStart === 0) thumbUpStart = now;
      if (now - thumbUpStart > THUMB_HOLD_MS && now - lastThumbAt > COOLDOWN) {
        lastThumbAt = now;
        thumbUpStart = 0;
        nextScreen();
      }
    } else {
      thumbUpStart = 0;
    }

    if (thumb === 'down') {
      if (thumbDownStart === 0) thumbDownStart = now;
      if (now - thumbDownStart > THUMB_HOLD_MS && now - lastThumbAt > COOLDOWN) {
        lastThumbAt = now;
        thumbDownStart = 0;
        showScreen(screenIdx - 1);
      }
    } else {
      thumbDownStart = 0;
    }

    if (pinch && !wasPinching) {
      wasPinching = true;
      startEntanglement(pinchX, pinchY);
    } else if (!pinch && wasPinching) {
      wasPinching = false;
      stopEntanglement();
    }

    setDetected(now - lastDetectedAt < DETECT_HOLD_MS);
  }

  let hands, camera;
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
    }
  }

  camBtn.addEventListener('click', () => {
    startTracking();
  });

  // Auto-start if permission already granted or previously enabled
  (async () => {
    if (localStorage.getItem('camEnabled') === 'true') {
      startTracking();
      return;
    }
    try {
      const status = await navigator.permissions?.query({ name: 'camera' }).catch(() => null);
      if (status && status.state === 'granted') {
        startTracking();
      }
    } catch (_) {}
  })();

  // Keyboard fallback
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') {
      nextScreen();
    }
    if (e.code === 'Escape' || e.code === 'Backspace') {
      window.location.href = "index.html";
    }
  });

  // Boot
  showScreen(0);
})();
