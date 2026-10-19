/* ==========================================================================
   Nguyễn Lê Hoàng Duy — Personal Showcase Portfolio V9 (script.js)
   Key V9 Upgrades:
     1. Fixed clipped circular buttons ("phần ô tròn bị khuất ở 2 mặt luôn") on both
        the Contact 3D Flip Card and the Passion 3D Flip Popup using CSS Grid
        auto-sizing (`grid-area: 1 / 1`) so both faces fit their full content!
     2. Ultra-smooth Mobile Passion Popup opening (removed live-WebGL backdrop-filter
        blur bottleneck & paused background canvas redraws while modal is open).
     3. Declared and auto-started external audio file `soundbg.mp3` right on page enter
        (with automatic first-touch unlock fallback for mobile browser policies).
     4. Added subtle ~60ms delay to `.membrane-card` border highlight & glow on touch
        to keep scrolling and touch interactions silky smooth.
   ========================================================================== */

(function () {
  'use strict';

  const state = {
    theme: 'night',
    deviceMode: 'pc',
    pointerNormX: 0,
    pointerNormY: 0,
    scrollRatio: 0,
    scrollVelocity: 0,
    waveSwayPhase: 0,
    waveSwayIntensity: 0,
    touchSwayX: 0,
    touchSwayY: 0,
    currentSwayX: 0,
    currentSwayY: 0,
    currentBobY: 0,
    introOpened: false,
    popupOpen: false,
    audioPlaying: true,
    bgAudio: null,
    activeCompassNode: 0,
    activePassionPiece: 0,
    passionFlipSteps: 0,
    contactCardFlipDeg: 0
  };

  // Single master uncapped requestAnimationFrame loop
  const frameTasks = [];

  function startMasterUncappedLoop() {
    let lastTime = performance.now();
    function tick(now) {
      const dt = Math.min(2.4, Math.max(0.1, (now - lastTime) / 16.6667));
      lastTime = now;

      if (!document.hidden) {
        for (let i = 0; i < frameTasks.length; i++) {
          frameTasks[i](dt, now);
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ==========================================================================
  // 1. AUTO-PLAY BACKGROUND MUSIC ("soundbg.mp3" — Instant Load Auto-Play)
  // ==========================================================================
  function initBackgroundMusicFile() {
    let audioEl = document.getElementById('bg-music');
    if (!audioEl) {
      audioEl = new Audio('soundbg.mp3');
      audioEl.preload = 'auto';
      audioEl.autoplay = true;
    }
    audioEl.loop = true;
    audioEl.muted = false;
    audioEl.volume = 0.75;
    state.bgAudio = audioEl;
    state.audioPlaying = true; // Music is ON by default as soon as page loads

    const label = document.getElementById('audio-btn-label');
    let hasUnmutedPlaySucceeded = false;

    function syncAudioLabel() {
      if (!label) return;
      label.textContent = state.audioPlaying ? 'Đang phát' : 'Nhạc nền';
    }

    // Only valid user-activation events on `document` (no duplicate `window` listeners, no `wheel` spam)
    const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'pointerup', 'click', 'keydown'];

    function removeUnlockListeners() {
      UNLOCK_EVENTS.forEach((evt) => {
        document.removeEventListener(evt, unlockOnUserGesture, true);
      });
    }

    function tryStartAudio() {
      if (!state.audioPlaying || !audioEl) return;

      // CRITICAL: If audioEl.paused is already false (native autoplay or an active play() request
      // is already starting/playing), do NOT call audioEl.play() again on top of it!
      if (!audioEl.paused && !audioEl.muted) {
        return;
      }

      audioEl.muted = false;
      audioEl.volume = 0.75;

      try {
        const playPromise = audioEl.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise
            .then(() => {
              if (!audioEl.paused && !audioEl.muted) {
                hasUnmutedPlaySucceeded = true;
                syncAudioLabel();
                removeUnlockListeners();
              }
            })
            .catch(() => {
              // Browser set audioEl.paused = true on rejection; next ready/gesture event will retry cleanly
            });
        } else if (!audioEl.paused) {
          hasUnmutedPlaySucceeded = true;
          syncAudioLabel();
          removeUnlockListeners();
        }
      } catch (err) {
        // Ignore synchronous errors on legacy browsers
      }
    }

    function unlockOnUserGesture(e) {
      // Do not intercept #audio-toggle-btn; its own click listener handles it directly
      if (e && e.target && e.target.closest && e.target.closest('#audio-toggle-btn')) {
        return;
      }
      if (!state.audioPlaying) {
        removeUnlockListeners();
        return;
      }
      tryStartAudio();
    }

    UNLOCK_EVENTS.forEach((evt) => {
      document.addEventListener(evt, unlockOnUserGesture, { capture: true, passive: true });
    });

    audioEl.addEventListener('playing', () => {
      if (!audioEl.paused && !audioEl.muted) {
        hasUnmutedPlaySucceeded = true;
        state.audioPlaying = true;
        syncAudioLabel();
        removeUnlockListeners();
      }
    });

    // Trigger on load milestones ONLY if native autoplay hasn't already set audioEl.paused = false
    syncAudioLabel();
    tryStartAudio();
    audioEl.addEventListener('canplay', tryStartAudio, { once: true });
    audioEl.addEventListener('canplaythrough', tryStartAudio, { once: true });
    window.addEventListener('load', tryStartAudio, { once: true });

    // Header Toggle Button (#audio-toggle-btn)
    const audioBtn = document.getElementById('audio-toggle-btn');
    if (audioBtn) {
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!audioEl) return;

        // Only pause if sound is genuinely playing out loud right now
        if (state.audioPlaying && hasUnmutedPlaySucceeded && !audioEl.paused && !audioEl.muted) {
          state.audioPlaying = false;
          hasUnmutedPlaySucceeded = false;
          audioEl.pause();
          removeUnlockListeners();
          syncAudioLabel();
        } else {
          // If sound was not playing yet (or was paused), play immediately on this single click!
          state.audioPlaying = true;
          audioEl.muted = false;
          audioEl.volume = 0.75;
          syncAudioLabel();
          const p = audioEl.play();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              hasUnmutedPlaySucceeded = true;
              syncAudioLabel();
              removeUnlockListeners();
            }).catch(() => {});
          } else {
            hasUnmutedPlaySucceeded = !audioEl.paused;
          }
        }
      });
    }
  }

  // ==========================================================================
  // 2. OPENING INTRO PORTAL ANIMATION
  // ==========================================================================
  function initIntroPortal() {
    const overlay = document.getElementById('intro-portal-overlay');
    const enterBtn = document.getElementById('enter-ocean-btn');
    if (!overlay) return;

    function openPortal() {
      if (state.audioPlaying && state.bgAudio && state.bgAudio.paused) {
        state.bgAudio.muted = false;
        state.bgAudio.play().catch(() => {});
      }
      if (state.introOpened) return;
      state.introOpened = true;
      overlay.classList.add('is-opened');
    }

    if (enterBtn) enterBtn.addEventListener('click', openPortal);
    overlay.addEventListener('click', openPortal);
    overlay.addEventListener('touchend', openPortal, { passive: true });
    setTimeout(openPortal, 950);
  }

  // ==========================================================================
  // 3. AUTOMATIC DEVICE DETECTION (PC vs. MOBILE) & THEME SWITCHER
  // ==========================================================================
  function detectAndApplyDevice() {
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isNarrow = window.innerWidth <= 820;
    state.deviceMode = (isMobileUA || isNarrow) ? 'mobile' : 'pc';
    document.body.setAttribute('data-device-mode', state.deviceMode);
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.body.setAttribute('data-theme', theme);

    const themeBtnLabel = document.getElementById('theme-btn-label');
    const iconNight = document.getElementById('theme-icon-night');
    const iconDay = document.getElementById('theme-icon-day');

    if (theme === 'day') {
      if (themeBtnLabel) themeBtnLabel.textContent = 'Hoàng Hôn';
      if (iconNight) iconNight.classList.add('hidden');
      if (iconDay) iconDay.classList.remove('hidden');
    } else {
      if (themeBtnLabel) themeBtnLabel.textContent = 'Đêm Sao';
      if (iconNight) iconNight.classList.remove('hidden');
      if (iconDay) iconDay.classList.add('hidden');
    }
  }

  // ==========================================================================
  // 4. INTERACTIVE TYPOGRAPHY
  // ==========================================================================
  function initInteractiveTypography() {
    const wordContainers = document.querySelectorAll('[data-interactive-words="true"]');
    wordContainers.forEach((container) => {
      const text = container.textContent.trim();
      if (!text) return;
      const words = text.split(/\s+/);
      container.innerHTML = words
        .map((w) => `<span class="interactive-word">${w}</span>`)
        .join(' ');
    });

    let lastTouchedWord = null;
    function highlightWordAtPoint(x, y) {
      const el = document.elementFromPoint(x, y);
      if (!el) return;
      const word = el.closest('.interactive-word');
      if (word !== lastTouchedWord) {
        if (lastTouchedWord) lastTouchedWord.classList.remove('is-touched-word');
        if (word) {
          word.classList.add('is-touched-word');
          lastTouchedWord = word;
          setTimeout(() => {
            word.classList.remove('is-touched-word');
          }, 520);
        } else {
          lastTouchedWord = null;
        }
      }
    }

    window.addEventListener('touchmove', (e) => {
      if (state.popupOpen) return;
      if (e.touches && e.touches[0]) {
        highlightWordAtPoint(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
  }

  // ==========================================================================
  // 5. CRISP ANTI-ALIASED 3D OCEAN & SKY SCENE (#three-ocean-canvas)
  // ==========================================================================
  function initThreeOceanBackground() {
    const canvas = document.getElementById('three-ocean-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.5, 500);
    camera.position.set(0, 14, 42);
    camera.lookAt(0, 0, -12);

    scene.add(new THREE.AmbientLight(0x5aa3e8, 0.95));
    const dirLight = new THREE.DirectionalLight(0x9ee3cd, 1.35);
    dirLight.position.set(20, 38, -8);
    scene.add(dirLight);

    const oceanGeo = new THREE.PlaneGeometry(220, 135, 36, 22);
    oceanGeo.rotateX(-Math.PI / 2);

    const posAttr = oceanGeo.attributes.position;
    const basePositions = new Float32Array(posAttr.array.length);
    basePositions.set(posAttr.array);

    const oceanMat = new THREE.MeshPhongMaterial({
      color: 0x0c2d52,
      emissive: 0x051529,
      specular: 0x72ccb1,
      shininess: 45,
      transparent: true,
      opacity: 0.88
    });

    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.set(0, -4.2, -15);
    scene.add(oceanMesh);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x72ccb1,
      wireframe: true,
      transparent: true,
      opacity: 0.14
    });
    const wireMesh = new THREE.Mesh(oceanGeo, wireMat);
    wireMesh.position.set(0, -4.14, -15);
    scene.add(wireMesh);

    const starCanvas = document.createElement('canvas');
    starCanvas.width = 32;
    starCanvas.height = 32;
    const sCtx = starCanvas.getContext('2d');
    const sGrad = sCtx.createRadialGradient(16, 16, 1, 16, 16, 15);
    sGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    sGrad.addColorStop(0.4, 'rgba(158, 227, 205, 0.85)');
    sGrad.addColorStop(1, 'rgba(158, 227, 205, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 32, 32);
    const starTexture = new THREE.CanvasTexture(starCanvas);

    const starCount = 95;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 210;
      starPositions[i * 3 + 1] = Math.random() * 75 + 2;
      starPositions[i * 3 + 2] = -Math.random() * 115 + 10;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMat = new THREE.PointsMaterial({
      color: 0xeefcf8,
      map: starTexture,
      size: 2.2,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const starPoints = new THREE.Points(starGeo, starMat);
    scene.add(starPoints);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });

    let clockTime = 0;
    let lastAppliedTheme = '';
    const waypointCamX = [0, -2.5, 2.5, -1.6, 1.8];

    frameTasks.push((dt) => {
      // Pause background 3D ocean redraw while mobile popup is open so popup opens & flips at locked 60/120fps
      if (state.popupOpen) return;

      clockTime += 0.0032 * dt;

      const arr = posAttr.array;
      for (let i = 0; i < arr.length; i += 3) {
        const bx = basePositions[i];
        const bz = basePositions[i + 2];
        arr[i + 1] =
          Math.sin(bx * 0.065 + clockTime + bz * 0.03) * 1.2 +
          Math.cos(bz * 0.085 - clockTime * 0.8) * 0.85;
      }
      posAttr.needsUpdate = true;

      if (lastAppliedTheme !== state.theme) {
        lastAppliedTheme = state.theme;
        if (state.theme === 'day') {
          oceanMat.color.setHex(0x226b80);
          oceanMat.emissive.setHex(0x123c52);
          wireMat.color.setHex(0xf6bd60);
          starMat.opacity = 0.35;
        } else {
          oceanMat.color.setHex(0x0c2d52);
          oceanMat.emissive.setHex(0x051529);
          wireMat.color.setHex(0x72ccb1);
          starMat.opacity = 0.9;
        }
      }

      const nodeOffset = waypointCamX[state.activeCompassNode] || 0;
      const targetCamX = nodeOffset + state.pointerNormX * 1.8;
      camera.position.x += (targetCamX - camera.position.x) * 0.028 * dt;

      renderer.render(scene, camera);
    });
  }

  // ==========================================================================
  // 6. HIGH-DPI FULL-WEB WATER WAVES (#harmonic-wave-canvas)
  // ==========================================================================
  function initFullWebWaterWaves() {
    const canvas = document.getElementById('harmonic-wave-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w = window.innerWidth;
    let h = window.innerHeight;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let phase = 0;

    const waveBands = [
      { yRatio: 0.20, a1: 13, f1: 0.0042, a2: 5, f2: 0.009, speed: 0.48, fillNight: 'rgba(24, 67, 115, 0.11)', fillDay: 'rgba(34, 92, 156, 0.07)', crest: 'rgba(114, 204, 177, 0.24)' },
      { yRatio: 0.44, a1: 15, f1: 0.0048, a2: 6, f2: 0.011, speed: -0.58, fillNight: 'rgba(34, 92, 156, 0.13)', fillDay: 'rgba(54, 133, 113, 0.09)', crest: 'rgba(158, 227, 205, 0.28)' },
      { yRatio: 0.68, a1: 14, f1: 0.0055, a2: 5, f2: 0.013, speed: 0.68, fillNight: 'rgba(24, 67, 115, 0.18)', fillDay: 'rgba(34, 92, 156, 0.12)', crest: 'rgba(90, 163, 232, 0.32)' },
      { yRatio: 0.84, a1: 11, f1: 0.0070, a2: 4, f2: 0.016, speed: -0.82, fillNight: 'rgba(54, 133, 113, 0.25)', fillDay: 'rgba(54, 133, 113, 0.18)', crest: 'rgba(158, 227, 205, 0.42)' },
      { yRatio: 0.93, a1: 8,  f1: 0.0088, a2: 3, f2: 0.020, speed: 0.96, fillNight: 'rgba(76, 169, 143, 0.32)', fillDay: 'rgba(76, 169, 143, 0.22)', crest: 'rgba(220, 252, 245, 0.52)' }
    ];

    frameTasks.push((dt) => {
      if (state.popupOpen) return;

      const scrollBoost = 1 + Math.min(2.2, Math.abs(state.scrollVelocity) * 0.045);
      phase += 0.0044 * dt * scrollBoost;
      ctx.clearRect(0, 0, w, h);

      const isDay = state.theme === 'day';
      const step = w < 640 ? 12 : 10;
      const scrollParallax = state.scrollRatio * 34;

      for (let idx = 0; idx < waveBands.length; idx++) {
        const hm = waveBands[idx];
        const baseY = h * hm.yRatio - scrollParallax * (0.28 + idx * 0.12);

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + step; x += step) {
          const y = baseY +
            Math.sin(x * hm.f1 + phase * hm.speed + idx) * hm.a1 +
            Math.cos(x * hm.f2 - phase * hm.speed * 0.8) * hm.a2;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = isDay ? hm.fillDay : hm.fillNight;
        ctx.fill();

        ctx.beginPath();
        for (let x = 0; x <= w + step; x += step) {
          const y = baseY +
            Math.sin(x * hm.f1 + phase * hm.speed + idx) * hm.a1 +
            Math.cos(x * hm.f2 - phase * hm.speed * 0.8) * hm.a2;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = hm.crest;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  // ==========================================================================
  // 7. HIGH-CLARITY 3D PISCES CONSTELLATION (#hero-sculpture-canvas)
  // ==========================================================================
  const COMPASS_NODES = [
    {
      title: 'Bản Thân & Chòm Sao Song Ngư',
      desc: 'Sinh 09/03/2010 • Học sinh trường THPT Trung Phú',
      target: '#about-section',
      colorHex: 0x225c9c,
      ringHex: 0x72ccb1,
      targetRotY: 0.45,
      targetRotX: 0.18
    },
    {
      title: '5 Mảnh Ghép Đam Mê',
      desc: 'Nhiếp ảnh • Nghệ thuật • Công nghệ • Âm nhạc • Khám phá',
      target: '#passions-section',
      colorHex: 0x368571,
      ringHex: 0x9ee3cd,
      targetRotY: 1.75,
      targetRotX: -0.22
    },
    {
      title: 'Hải Đồ Kỹ Năng',
      desc: 'Tin học 90% • Tiếng Anh 80% • Thuyết trình 75% • Nhóm 70%',
      target: '#skills-section',
      colorHex: 0x3478c2,
      ringHex: 0x5aa3e8,
      targetRotY: 3.05,
      targetRotX: 0.28
    },
    {
      title: 'Ước Mơ Vươn Ra Biển Lớn',
      desc: 'Tự lập tài chính & tạo nguồn thu nhập thụ động bền vững',
      target: '#dreams-section',
      colorHex: 0x286656,
      ringHex: 0xf6bd60,
      targetRotY: 4.35,
      targetRotX: -0.18
    },
    {
      title: 'Kết Nối Cùng Hoàng Duy',
      desc: 'Trò chuyện qua Zalo Cá Nhân hoặc Hộp Thư Email',
      target: '#contact-section',
      colorHex: 0x184373,
      ringHex: 0x72ccb1,
      targetRotY: 5.65,
      targetRotX: 0.22
    }
  ];

  function initHero3DSculpture() {
    const canvas = document.getElementById('hero-sculpture-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      return;
    }

    function updateSize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const w = rect.width || 320;
      const h = rect.height || 224;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.25));
      renderer.setSize(w, h);
      return { w, h };
    }

    const { w, h } = updateSize();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 50);
    camera.position.set(0, 0, 6.8);

    const group = new THREE.Group();
    group.rotation.y = -Math.PI * 1.35;
    group.rotation.x = -0.55;
    scene.add(group);

    const coreGeo = new THREE.IcosahedronGeometry(1.26, 0);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x225c9c,
      emissive: 0x0d2f4f,
      specular: 0xdffcf6,
      shininess: 95,
      flatShading: true
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    const cageGeo = new THREE.IcosahedronGeometry(1.34, 0);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0xbef5e5,
      wireframe: true,
      transparent: true,
      opacity: 0.62
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    group.add(cageMesh);

    const ringGeo = new THREE.TorusGeometry(2.06, 0.042, 18, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x72ccb1,
      transparent: true,
      opacity: 0.88
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    group.add(ringMesh);

    const beaconMeshes = [];
    const beaconData = [];
    const starColors = [0x5aa3e8, 0x72ccb1, 0x9ee3cd, 0xf6bd60, 0x4ca98f];
    const linePoints = [];

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const r = 2.16;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle * 1.5) * 0.65;
      const pz = Math.sin(angle) * r;
      linePoints.push(new THREE.Vector3(px, py, pz));

      const sGeo = new THREE.OctahedronGeometry(0.24, 0);
      const sMat = new THREE.MeshPhongMaterial({
        color: starColors[i],
        emissive: starColors[i],
        emissiveIntensity: 0.35,
        shininess: 80,
        flatShading: true
      });
      const sMesh = new THREE.Mesh(sGeo, sMat);
      sMesh.position.set(px, py, pz);
      sMesh.userData = { nodeIndex: i };
      group.add(sMesh);
      beaconMeshes.push(sMesh);
      beaconData.push({ mesh: sMesh });
    }
    linePoints.push(linePoints[0].clone());

    const constellationLineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const constellationLineMat = new THREE.LineBasicMaterial({
      color: 0xbef5e5,
      transparent: true,
      opacity: 0.55
    });
    const constellationLine = new THREE.Line(constellationLineGeo, constellationLineMat);
    group.add(constellationLine);

    const light1 = new THREE.DirectionalLight(0xeefcf8, 1.55);
    light1.position.set(4, 6, 7);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(0x5aa3e8, 0.75);
    light2.position.set(-5, -4, 4);
    scene.add(light2);
    scene.add(new THREE.AmbientLight(0xffffff, 0.72));

    const titleEl = document.getElementById('compass-3d-title');
    const descEl = document.getElementById('compass-3d-desc');
    const jumpBtn = document.getElementById('compass-3d-jump-btn');
    const nodeBtns = document.querySelectorAll('.compass-node-btn[data-node-index]');

    let pulseScale = 1.08;
    let manualRotY = 0;
    let manualRotX = 0;
    let isSpinning3D = true;

    function wakeUp3DSpin(extraSpinRadians) {
      if (extraSpinRadians) {
        group.rotation.y -= extraSpinRadians;
      }
      isSpinning3D = true;
    }

    function selectCompassNode(idx, withSpin) {
      const cleanIdx = ((idx % COMPASS_NODES.length) + COMPASS_NODES.length) % COMPASS_NODES.length;
      state.activeCompassNode = cleanIdx;
      const info = COMPASS_NODES[cleanIdx];

      if (titleEl) titleEl.textContent = info.title;
      if (descEl) descEl.textContent = info.desc;
      if (jumpBtn) jumpBtn.setAttribute('data-target', info.target);

      nodeBtns.forEach((btn) => {
        const bIdx = parseInt(btn.getAttribute('data-node-index') || '0', 10);
        btn.classList.toggle('is-active', bIdx === cleanIdx);
      });

      coreMat.color.setHex(info.colorHex);
      ringMat.color.setHex(info.ringHex);
      pulseScale = 1.15;

      beaconData.forEach((b, bIdx) => {
        b.mesh.scale.setScalar(bIdx === cleanIdx ? 1.48 : 0.92);
      });

      if (withSpin) {
        manualRotY = 0;
        manualRotX = 0;
        wakeUp3DSpin(0.85);
      } else {
        isSpinning3D = true;
      }
    }

    nodeBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-node-index') || '0', 10);
        selectCompassNode(idx, true);
      });
    });

    if (jumpBtn) {
      jumpBtn.addEventListener('click', () => {
        const targetSel = jumpBtn.getAttribute('data-target') || '#about-section';
        const targetEl = document.querySelector(targetSel);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2();
    let isDragging3D = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let totalDragDist = 0;

    canvas.addEventListener('pointerdown', (e) => {
      isDragging3D = true;
      totalDragDist = 0;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      isSpinning3D = true;
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging3D) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      totalDragDist += Math.hypot(dx, dy);
      manualRotY += dx * 0.009;
      manualRotX += dy * 0.009;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      isSpinning3D = true;
    }, { passive: true });

    window.addEventListener('pointerup', (e) => {
      if (!isDragging3D) return;
      isDragging3D = false;
      if (totalDragDist < 10) {
        const rect = canvas.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouseVec, camera);
          const hits = raycaster.intersectObjects(beaconMeshes);
          if (hits.length > 0 && hits[0].object.userData.nodeIndex !== undefined) {
            selectCompassNode(hits[0].object.userData.nodeIndex, true);
          } else {
            selectCompassNode(state.activeCompassNode + 1, true);
          }
        }
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      const dims = updateSize();
      camera.aspect = dims.w / dims.h;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }, { passive: true });

    selectCompassNode(0, false);

    frameTasks.push((dt) => {
      if (!isSpinning3D && !isDragging3D) return;

      const activeNode = COMPASS_NODES[state.activeCompassNode] || COMPASS_NODES[0];
      const desiredY = activeNode.targetRotY + manualRotY;
      const desiredX = activeNode.targetRotX + manualRotX;

      const diffY = desiredY - group.rotation.y;
      const diffX = desiredX - group.rotation.x;
      const diffScale = 1 - pulseScale;

      group.rotation.y += diffY * 0.075 * dt;
      group.rotation.x += diffX * 0.075 * dt;
      pulseScale += diffScale * 0.09 * dt;

      coreMesh.scale.setScalar(pulseScale);
      cageMesh.scale.setScalar(pulseScale * 1.05);

      renderer.render(scene, camera);

      if (
        !isDragging3D &&
        Math.abs(diffY) < 0.0015 &&
        Math.abs(diffX) < 0.0015 &&
        Math.abs(diffScale) < 0.0015
      ) {
        group.rotation.y = desiredY;
        group.rotation.x = desiredX;
        pulseScale = 1;
        coreMesh.scale.setScalar(1);
        cageMesh.scale.setScalar(1.05);
        renderer.render(scene, camera);
        isSpinning3D = false;
      }
    });
  }

  // ==========================================================================
  // 8. HIGH-DPI PROCEDURAL OCEAN HORIZON ARTWORK (#nature-art-canvas)
  // ==========================================================================
  function initProceduralNatureArt() {
    const canvas = document.getElementById('nature-art-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w = 560;
    let h = 210;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width || 560;
      h = rect.height || 210;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    let isVisible = true;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { isVisible = e.isIntersecting; });
    }, { threshold: 0.05 });
    obs.observe(canvas);

    let t = 0;
    frameTasks.push((dt) => {
      if (!isVisible || state.popupOpen) return;
      t += 0.0038 * dt;

      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      if (state.theme === 'day') {
        bgGrad.addColorStop(0, '#184e77');
        bgGrad.addColorStop(0.55, '#368571');
        bgGrad.addColorStop(1, '#f6bd60');
      } else {
        bgGrad.addColorStop(0, '#041022');
        bgGrad.addColorStop(0.55, '#143c63');
        bgGrad.addColorStop(1, '#286656');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      for (let band = 0; band < 2; band++) {
        ctx.beginPath();
        const baseY = h * (0.3 + band * 0.16);
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= w; x += 10) {
          const y = baseY + Math.sin(x * 0.014 + t + band * 1.4) * 14;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = band === 0 ? 'rgba(158, 227, 205, 0.38)' : 'rgba(90, 163, 232, 0.30)';
        ctx.lineWidth = 11 - band * 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      const layers = [
        { yRatio: 0.64, amp: 11, freq: 0.012, speed: 0.55, color: 'rgba(24, 67, 115, 0.80)' },
        { yRatio: 0.78, amp: 8, freq: 0.018, speed: -0.75, color: 'rgba(76, 169, 143, 0.75)' }
      ];

      layers.forEach((l, idx) => {
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 10; x += 10) {
          const y = h * l.yRatio + Math.sin(x * l.freq + t * l.speed + idx) * l.amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = l.color;
        ctx.fill();
      });
    });
  }

  // ==========================================================================
  // 9. ROUNDED 5-PIECE JIGSAW PUZZLE + TRUE 2-FACED 3D FLIP CARD (Mobile Popup & PC)
  //    - Uses CSS Grid auto-height (`grid-area: 1 / 1`) so circular buttons are NEVER clipped!
  //    - Opens on mobile via requestAnimationFrame with background canvas paused for 0 lag!
  // ==========================================================================
  const PASSION_PIECES = [
    {
      badge: '01 / 05',
      subtitle: 'Góc nhìn qua ống kính',
      title: 'Nhiếp Ảnh & Khoảnh Khắc',
      desc: 'Yêu cảm giác nâng máy ảnh lên và bắt trọn từng khoảnh khắc bình dị: một vệt nắng hoàng hôn trên mặt biển, những đám mây trôi hay nụ cười tự nhiên của mọi người xung quanh.',
      points: [
        'Săn ánh sáng bình minh & hoàng hôn trên mặt biển',
        'Lưu giữ kỷ niệm tuổi học trò tại THPT Trung Phú',
        'Kể chuyện bằng bố cục, chiều sâu và sắc màu tự nhiên'
      ],
      svgInner: '<path stroke-linecap="round" stroke-linejoin="round" d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" fill="rgba(114,204,177,0.28)" />'
    },
    {
      badge: '02 / 05',
      subtitle: 'Cảm hứng cái đẹp & thị giác',
      title: 'Tình Yêu Nghệ Thuật',
      desc: 'Bất cứ điều gì liên quan đến nghệ thuật đều cuốn hút mình — từ màu sắc hội họa, thiết kế thị giác, điện ảnh cho tới những không gian mang đậm chất thơ của biển cả và thiên nhiên.',
      points: [
        'Say mê vẻ đẹp của ánh sáng, màu sắc và bố cục hài hòa',
        'Yêu hội họa, thiết kế không gian và nghệ thuật thị giác',
        'Tìm kiếm nét tinh tế trong từng chi tiết đời thường'
      ],
      svgInner: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.62-.23-1.2-.62-1.63-.37-.41-.58-.95-.58-1.52 0-1.38 1.12-2.5 2.5-2.5H16c3.31 0 6-2.69 6-6 0-4.96-4.48-8.85-10-8.85z" fill="rgba(114,204,177,0.22)" /><circle cx="7.5" cy="10.5" r="1.3" fill="#9ee3cd" /><circle cx="12" cy="7.5" r="1.3" fill="#5aa3e8" /><circle cx="16.5" cy="10.5" r="1.3" fill="#f6bd60" />'
    },
    {
      badge: '03 / 05',
      subtitle: 'Tư duy khám phá tương lai',
      title: 'Tò Mò Về Công Nghệ',
      desc: 'Luôn đặt câu hỏi “Tại sao nó hoạt động được như vậy?” trước các phần mềm, đồ họa 3D và thiết bị thông minh. Thích tự mình tìm tòi, thử nghiệm những công cụ số mới mẻ.',
      points: [
        'Làm chủ kỹ năng Tin học & ứng dụng phần mềm sáng tạo',
        'Yêu thích tìm hiểu đồ họa tương tác và công nghệ mới',
        'Biến công nghệ thành đòn bẩy học tập và làm việc thông minh'
      ],
      svgInner: '<rect x="4" y="4" width="16" height="16" rx="3" fill="rgba(90,163,232,0.22)" /><rect x="9" y="9" width="6" height="6" rx="1" /><path stroke-linecap="round" d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />'
    },
    {
      badge: '04 / 05',
      subtitle: 'Giai điệu nuôi dưỡng tâm hồn',
      title: 'Đam Mê Âm Nhạc',
      desc: 'Âm nhạc là nơi mình gửi gắm tâm trạng và tái tạo năng lượng. Một giai điệu nhẹ nhàng bên tiếng sóng vỗ luôn giúp mình tập trung học tập và nảy ra nhiều ý tưởng mới.',
      points: [
        'Thưởng thức những giai điệu Acoustic, Piano & Ambient êm dịu',
        'Dùng âm nhạc để cân bằng cảm xúc và khơi nguồn sáng tạo',
        'Kết nối bạn bè đồng điệu qua những bản nhạc yêu thích'
      ],
      svgInner: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" fill="rgba(114,204,177,0.3)" /><circle cx="18" cy="16" r="3" fill="rgba(90,163,232,0.3)" />'
    },
    {
      badge: '05 / 05',
      subtitle: 'Bước chân vươn ra biển lớn',
      title: 'Thích Đi Khám Phá Thế Giới',
      desc: 'Ước mong được đặt chân tới những vùng biển xanh thẳm, những miền đất mới trong và ngoài nước để tận mắt chiêm ngưỡng thiên nhiên kỳ vĩ và văn hóa nhân loại.',
      points: [
        'Rèn luyện ngoại ngữ để tự tin bước ra thế giới rộng lớn',
        'Khám phá vẻ đẹp đại dương, rừng xanh và văn hóa bản địa',
        'Mở rộng thế giới quan qua từng chuyến đi thực tế'
      ],
      svgInner: '<circle cx="12" cy="12" r="10" fill="rgba(114,204,177,0.2)" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />'
    }
  ];

  function initPassionJigsawPuzzle() {
    const svgGroups = document.querySelectorAll('.jigsaw-piece-group');
    const pcFlipper = document.getElementById('pc-passion-flipper');
    const mobilePopup = document.getElementById('passion-mobile-popup');
    const mobileFlipper = document.getElementById('mobile-passion-flipper');
    const closeBtns = document.querySelectorAll('.close-passion-popup-btn');

    function normIdx(i) {
      const n = PASSION_PIECES.length;
      return ((i % n) + n) % n;
    }

    function fillFaceElement(faceEl, pieceData) {
      if (!faceEl || !pieceData) return;
      const badge = faceEl.querySelector('.p-face-badge');
      const svg = faceEl.querySelector('.p-face-svg');
      const sub = faceEl.querySelector('.p-face-subtitle');
      const title = faceEl.querySelector('.p-face-title');
      const desc = faceEl.querySelector('.p-face-desc');
      const pt1 = faceEl.querySelector('.p-face-pt1');
      const pt2 = faceEl.querySelector('.p-face-pt2');
      const pt3 = faceEl.querySelector('.p-face-pt3');

      if (badge) badge.textContent = pieceData.badge;
      if (svg) svg.innerHTML = pieceData.svgInner;
      if (sub) sub.textContent = pieceData.subtitle;
      if (title) title.textContent = pieceData.title;
      if (desc) desc.textContent = pieceData.desc;
      if (pt1) pt1.textContent = pieceData.points[0];
      if (pt2) pt2.textContent = pieceData.points[1];
      if (pt3) pt3.textContent = pieceData.points[2];
    }

    function getFlipperFaces(flipper) {
      if (!flipper) return { visible: null, hidden: null };
      const front = flipper.querySelector('.passion-face-front');
      const back = flipper.querySelector('.passion-face-back');
      const isEven = ((state.passionFlipSteps % 2) + 2) % 2 === 0;
      return isEven ? { visible: front, hidden: back } : { visible: back, hidden: front };
    }

    function syncSvgSelection(cleanIdx, animateSpring) {
      svgGroups.forEach((grp) => {
        const gIdx = parseInt(grp.getAttribute('data-piece-index') || '0', 10);
        const isCurrent = gIdx === cleanIdx;
        grp.classList.toggle('is-selected', isCurrent);
        grp.classList.remove('just-picked');
        if (isCurrent && animateSpring) {
          grp.classList.add('just-picked');
        }
      });
    }

    function openMobilePopup() {
      if (!mobilePopup) return;
      state.popupOpen = true;
      requestAnimationFrame(() => {
        mobilePopup.classList.add('is-open');
      });
    }

    function closeMobilePopup() {
      if (!mobilePopup) return;
      mobilePopup.classList.remove('is-open');
      setTimeout(() => {
        state.popupOpen = false;
      }, 240);
    }

    function flipToPassionPiece(targetIndex, userTriggered, direction) {
      const cleanIdx = normIdx(targetIndex);
      const data = PASSION_PIECES[cleanIdx];
      const wasPopupOpen = mobilePopup && mobilePopup.classList.contains('is-open');
      const isMobileView = state.deviceMode === 'mobile' || window.innerWidth <= 820;

      // When opening the popup on mobile, don't run simultaneous SVG spring animation
      syncSvgSelection(cleanIdx, userTriggered && (!isMobileView || wasPopupOpen));

      if (!userTriggered || (isMobileView && !wasPopupOpen)) {
        state.activePassionPiece = cleanIdx;
        [pcFlipper, mobileFlipper].forEach((flipper) => {
          const { visible, hidden } = getFlipperFaces(flipper);
          fillFaceElement(visible, data);
          fillFaceElement(hidden, PASSION_PIECES[normIdx(cleanIdx + 1)]);
          if (flipper) {
            flipper.style.setProperty('--drag-deg', '0deg');
          }
        });
        if (userTriggered && isMobileView) {
          openMobilePopup();
        }
        return;
      }

      if (cleanIdx === state.activePassionPiece) {
        [pcFlipper, mobileFlipper].forEach((flipper) => {
          if (flipper) flipper.style.setProperty('--drag-deg', '0deg');
        });
        return;
      }

      const stepDir = direction >= 0 ? 1 : -1;

      [pcFlipper, mobileFlipper].forEach((flipper) => {
        const { hidden } = getFlipperFaces(flipper);
        fillFaceElement(hidden, data);
      });

      state.activePassionPiece = cleanIdx;
      state.passionFlipSteps += stepDir;
      const newDeg = state.passionFlipSteps * -180;

      [pcFlipper, mobileFlipper].forEach((flipper) => {
        if (!flipper) return;
        flipper.classList.remove('is-dragging');
        flipper.style.setProperty('--drag-deg', '0deg');
        flipper.style.setProperty('--flip-deg', `${newDeg}deg`);
      });
    }

    function bindContinuousDragFlip(flipper) {
      if (!flipper) return;
      let dragging = false;
      let startX = 0;
      let currentX = 0;
      let preloadedDir = 0;

      flipper.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        dragging = true;
        startX = e.clientX;
        currentX = e.clientX;
        preloadedDir = 0;
        flipper.classList.add('is-dragging');
      });

      window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        currentX = e.clientX;
        const dx = currentX - startX;

        const wantDir = dx < 0 ? 1 : -1;
        if (wantDir !== preloadedDir) {
          preloadedDir = wantDir;
          const previewPiece = PASSION_PIECES[normIdx(state.activePassionPiece + wantDir)];
          const { hidden } = getFlipperFaces(flipper);
          fillFaceElement(hidden, previewPiece);
        }

        const dragDeg = Math.max(-180, Math.min(180, dx * 0.55));
        flipper.style.setProperty('--drag-deg', `${dragDeg.toFixed(1)}deg`);
      }, { passive: true });

      window.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        flipper.classList.remove('is-dragging');
        const dx = currentX - startX;

        if (dx < -30) {
          flipToPassionPiece(state.activePassionPiece + 1, true, 1);
        } else if (dx > 30) {
          flipToPassionPiece(state.activePassionPiece - 1, true, -1);
        } else {
          flipper.style.setProperty('--drag-deg', '0deg');
        }
      }, { passive: true });
    }

    bindContinuousDragFlip(pcFlipper);
    bindContinuousDragFlip(mobileFlipper);

    document.querySelectorAll('.passion-prev-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        flipToPassionPiece(state.activePassionPiece - 1, true, -1);
      });
    });

    document.querySelectorAll('.passion-next-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        flipToPassionPiece(state.activePassionPiece + 1, true, 1);
      });
    });

    svgGroups.forEach((grp) => {
      const idx = parseInt(grp.getAttribute('data-piece-index') || '0', 10);
      grp.addEventListener('click', () => {
        const dir = idx >= state.activePassionPiece ? 1 : -1;
        flipToPassionPiece(idx, true, dir);
      });
      grp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const dir = idx >= state.activePassionPiece ? 1 : -1;
          flipToPassionPiece(idx, true, dir);
        }
      });
    });

    closeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMobilePopup();
      });
    });

    if (mobilePopup) {
      mobilePopup.addEventListener('click', (e) => {
        if (e.target === mobilePopup) closeMobilePopup();
      });
    }

    flipToPassionPiece(0, false, 1);
  }

  // ==========================================================================
  // 10. POINTER LIGHT AURA + SCROLL-WAVE SWAY ("Mỗi lần kéo trang lắc lư như sóng nước")
  // ==========================================================================
  function initPointerGlowAndWaterWaveSway() {
    let pointerTimeout = null;

    function updatePointerLocator(clientX, clientY, isTouchActive) {
      const normX = (clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const normY = (clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      state.pointerNormX = normX;
      state.pointerNormY = normY;

      document.documentElement.style.setProperty('--cursor-x', `${clientX.toFixed(0)}px`);
      document.documentElement.style.setProperty('--cursor-y', `${clientY.toFixed(0)}px`);
      document.documentElement.style.setProperty('--cursor-opacity', '1');

      if (isTouchActive) {
        state.touchSwayX = normX * 2.2;
        state.touchSwayY = -normY * 1.8;
        state.waveSwayIntensity = Math.min(1.4, state.waveSwayIntensity + 0.18);
      } else {
        state.touchSwayX = normX * 1.1;
        state.touchSwayY = -normY * 0.9;
      }

      if (pointerTimeout) clearTimeout(pointerTimeout);
      pointerTimeout = setTimeout(() => {
        state.touchSwayX = 0;
        state.touchSwayY = 0;
      }, 260);
    }

    window.addEventListener('pointermove', (e) => {
      if (state.popupOpen) return;
      updatePointerLocator(e.clientX, e.clientY, e.pointerType === 'touch');
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
      if (state.popupOpen) return;
      updatePointerLocator(e.clientX, e.clientY, true);
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (state.popupOpen) return;
      if (e.touches && e.touches[0]) {
        updatePointerLocator(e.touches[0].clientX, e.touches[0].clientY, true);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (state.popupOpen) return;
      if (e.touches && e.touches[0]) {
        updatePointerLocator(e.touches[0].clientX, e.touches[0].clientY, true);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      state.touchSwayX = 0;
      state.touchSwayY = 0;
    }, { passive: true });

    const horizonBar = document.getElementById('scroll-horizon-bar');
    let lastScrollY = window.scrollY || 0;

    window.addEventListener('scroll', () => {
      const currentY = window.scrollY || document.documentElement.scrollTop || 0;
      const deltaY = currentY - lastScrollY;
      lastScrollY = currentY;

      state.scrollVelocity = Math.max(-28, Math.min(28, deltaY));
      state.waveSwayIntensity = Math.min(1.6, state.waveSwayIntensity + Math.abs(deltaY) * 0.025);

      const docHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      state.scrollRatio = Math.min(1, Math.max(0, currentY / docHeight));
      if (horizonBar) {
        horizonBar.style.width = `${(state.scrollRatio * 100).toFixed(1)}%`;
      }
    }, { passive: true });

    frameTasks.push((dt) => {
      if (state.popupOpen) return;

      state.waveSwayPhase += 0.11 * dt;
      state.scrollVelocity *= Math.pow(0.86, dt);
      state.waveSwayIntensity *= Math.pow(0.92, dt);

      if (Math.abs(state.scrollVelocity) < 0.05) state.scrollVelocity = 0;
      if (state.waveSwayIntensity < 0.005) state.waveSwayIntensity = 0;

      const waveOscX = Math.sin(state.waveSwayPhase) * state.waveSwayIntensity * 2.0;
      const waveOscY = Math.cos(state.waveSwayPhase * 0.85) * state.waveSwayIntensity * 1.6;
      const targetBobY = Math.sin(state.waveSwayPhase * 1.15) * state.waveSwayIntensity * 5.5 + (state.scrollVelocity * -0.18);

      const desiredSwayRY = state.touchSwayX + waveOscX;
      const desiredSwayRX = state.touchSwayY + waveOscY + (state.scrollVelocity * 0.08);

      state.currentSwayX += (desiredSwayRY - state.currentSwayX) * 0.14 * dt;
      state.currentSwayY += (desiredSwayRX - state.currentSwayY) * 0.14 * dt;
      state.currentBobY += (targetBobY - state.currentBobY) * 0.15 * dt;

      if (
        Math.abs(state.currentSwayX) < 0.01 &&
        Math.abs(state.currentSwayY) < 0.01 &&
        Math.abs(state.currentBobY) < 0.05 &&
        state.waveSwayIntensity === 0 &&
        state.touchSwayX === 0 &&
        state.touchSwayY === 0
      ) {
        state.currentSwayX = 0;
        state.currentSwayY = 0;
        state.currentBobY = 0;
      }

      document.documentElement.style.setProperty('--wave-sway-ry', `${state.currentSwayX.toFixed(2)}deg`);
      document.documentElement.style.setProperty('--wave-sway-rx', `${state.currentSwayY.toFixed(2)}deg`);
      document.documentElement.style.setProperty('--wave-bob-y', `${state.currentBobY.toFixed(1)}px`);
    });
  }

  // ==========================================================================
  // 11. SNUG 100% WATER SKILL BARS + NATURAL RANDOM FLOATING WHITE STAR DOTS
  // ==========================================================================
  function initSnugWaterSkillBars() {
    const skillCards = document.querySelectorAll('.skill-card');

    document.querySelectorAll('.skill-water-fill').forEach((fillEl) => {
      fillEl.innerHTML = '';
      const dotCount = 14;
      for (let i = 0; i < dotCount; i++) {
        const dot = document.createElement('span');
        dot.className = 'water-star-dot';
        const size = (2.0 + Math.random() * 2.4).toFixed(1);
        const left = (4 + (i / dotCount) * 88 + (Math.random() * 5 - 2.5)).toFixed(1);
        const top = (14 + Math.random() * 70).toFixed(1);
        const dx1 = ((Math.random() - 0.5) * 18).toFixed(1);
        const dy1 = ((Math.random() - 0.5) * 8).toFixed(1);
        const dx2 = ((Math.random() - 0.5) * 18).toFixed(1);
        const dy2 = ((Math.random() - 0.5) * 8).toFixed(1);
        const dur = (5.0 + Math.random() * 4.5).toFixed(2);
        const delay = (-Math.random() * 9.0).toFixed(2);

        dot.style.width = `${size}px`;
        dot.style.height = `${size}px`;
        dot.style.left = `${left}%`;
        dot.style.top = `${top}%`;
        dot.style.setProperty('--dx1', `${dx1}px`);
        dot.style.setProperty('--dy1', `${dy1}px`);
        dot.style.setProperty('--dx2', `${dx2}px`);
        dot.style.setProperty('--dy2', `${dy2}px`);
        dot.style.setProperty('--star-dur', `${dur}s`);
        dot.style.setProperty('--star-delay', `${delay}s`);
        fillEl.appendChild(dot);
      }
    });

    function animateCounter(counterEl, targetVal) {
      if (!counterEl) return;
      const startTime = performance.now();
      const duration = 1100;

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const cur = Math.round(targetVal * eased);
        counterEl.textContent = `${cur}%`;
        if (progress < 1) {
          requestAnimationFrame(step);
        }
      }
      requestAnimationFrame(step);
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const card = entry.target;
        const fillEl = card.querySelector('.skill-water-fill');
        const counterEl = card.querySelector('.skill-percent-counter');
        const target = parseInt(card.getAttribute('data-skill-target') || '80', 10);
        if (!fillEl) return;

        if (entry.isIntersecting) {
          fillEl.style.width = `${target}%`;
          animateCounter(counterEl, target);
        } else {
          fillEl.style.width = '0%';
          if (counterEl) counterEl.textContent = '0%';
        }
      });
    }, { threshold: 0.15 });

    skillCards.forEach((card) => observer.observe(card));
  }

  // ==========================================================================
  // 12. SINGLE 2-SIDED 3D FLIP CONTACT CARD (Front: Zalo, Back: Email)
  // ==========================================================================
  function initSingleTwoSidedContactCard() {
    const flipInner = document.getElementById('contact-flip-card-inner');
    const flipTriggers = document.querySelectorAll('.flip-card-trigger-btn');
    const actionLinks = document.querySelectorAll('.contact-action-link');

    if (!flipInner) return;

    function flipToAngle(deg) {
      state.contactCardFlipDeg = deg;
      flipInner.style.setProperty('--flip-deg', `${deg}deg`);
      flipInner.style.setProperty('--drag-deg', '0deg');
    }

    flipTriggers.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        flipToAngle(state.contactCardFlipDeg + 180);
      });
    });

    actionLinks.forEach((link) => {
      link.addEventListener('pointerdown', (e) => e.stopPropagation());
      link.addEventListener('click', (e) => e.stopPropagation());
    });

    let dragging = false;
    let startX = 0;
    let currentX = 0;

    flipInner.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.contact-action-link') || e.target.closest('.flip-card-trigger-btn')) return;
      dragging = true;
      startX = e.clientX;
      currentX = e.clientX;
      flipInner.classList.add('is-dragging');
    });

    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      currentX = e.clientX;
      const dx = currentX - startX;
      const dragDeg = Math.max(-180, Math.min(180, dx * 0.55));
      flipInner.style.setProperty('--drag-deg', `${dragDeg.toFixed(1)}deg`);
    }, { passive: true });

    window.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      flipInner.classList.remove('is-dragging');
      const dx = currentX - startX;

      if (dx > 30) {
        flipToAngle(state.contactCardFlipDeg + 180);
      } else if (dx < -30) {
        flipToAngle(state.contactCardFlipDeg - 180);
      } else {
        flipInner.style.setProperty('--drag-deg', '0deg');
      }
    }, { passive: true });
  }

  // ==========================================================================
  // 13. TACTILE 3D TOUCH & HOVER EFFECT ON ALL CARDS (With subtle ~55ms delay
  //     on border glow when touching so scrolling stays ultra-fast!)
  // ==========================================================================
  function initMembranePressAndReveal() {
    let activeCard = null;
    let activeRect = null;
    let activeMaxAngle = 10;
    let pressGlowTimer = null;

    function releaseActiveCard() {
      if (pressGlowTimer) {
        clearTimeout(pressGlowTimer);
        pressGlowTimer = null;
      }
      if (!activeCard) return;
      activeCard.classList.remove('is-pressing');
      activeCard.style.setProperty('--rx', '0deg');
      activeCard.style.setProperty('--ry', '0deg');
      activeCard.style.setProperty('--sink-scale', '1');
      activeCard.style.setProperty('--lift-y', '0px');
      activeCard.style.setProperty('--press-opacity', '0');
      activeCard = null;
      activeRect = null;
    }

    function updateActiveCardTilt(clientX, clientY, immediateGlow) {
      if (!activeCard || !activeRect || !activeRect.width || !activeRect.height) return;

      const relX = Math.max(0, Math.min(1, (clientX - activeRect.left) / activeRect.width));
      const relY = Math.max(0, Math.min(1, (clientY - activeRect.top) / activeRect.height));
      const nx = relX * 2 - 1;
      const ny = relY * 2 - 1;

      const rx = (-ny * activeMaxAngle).toFixed(2);
      const ry = (nx * activeMaxAngle).toFixed(2);
      const isSubcard = activeCard.classList.contains('membrane-subcard');
      const scaleVal = isSubcard ? '1.016' : '1.005';
      const liftVal = isSubcard ? '-2.5px' : '-1.5px';
      const creaseAngle = Math.round(Math.atan2(ny, nx) * (180 / Math.PI) + 90);

      activeCard.style.setProperty('--rx', `${rx}deg`);
      activeCard.style.setProperty('--ry', `${ry}deg`);
      activeCard.style.setProperty('--sink-scale', scaleVal);
      activeCard.style.setProperty('--lift-y', liftVal);
      activeCard.style.setProperty('--press-x', `${(relX * 100).toFixed(1)}%`);
      activeCard.style.setProperty('--press-y', `${(relY * 100).toFixed(1)}%`);
      activeCard.style.setProperty('--crease-angle', `${creaseAngle}deg`);

      if (immediateGlow) {
        activeCard.classList.add('is-pressing');
        activeCard.style.setProperty('--press-opacity', '1');
      } else if (!activeCard.classList.contains('is-pressing') && !pressGlowTimer) {
        const cardRef = activeCard;
        pressGlowTimer = setTimeout(() => {
          pressGlowTimer = null;
          if (activeCard === cardRef) {
            cardRef.classList.add('is-pressing');
            cardRef.style.setProperty('--press-opacity', '1');
          }
        }, 55);
      }
    }

    function bindCardAtEvent(target, clientX, clientY, isTouch) {
      const card = target.closest('.membrane-card');
      if (!card) {
        if (activeCard) releaseActiveCard();
        return;
      }
      if (activeCard !== card) {
        if (activeCard) releaseActiveCard();
        activeCard = card;
        activeMaxAngle = parseFloat(card.getAttribute('data-max-tilt') || '10');
        activeRect = card.getBoundingClientRect();
      }
      updateActiveCardTilt(clientX, clientY, !isTouch);
    }

    document.addEventListener('pointerdown', (e) => {
      bindCardAtEvent(e.target, e.clientX, e.clientY, e.pointerType === 'touch');
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        if (activeCard && activeRect) {
          updateActiveCardTilt(e.clientX, e.clientY, false);
        }
        return;
      }
      bindCardAtEvent(e.target, e.clientX, e.clientY, false);
    }, { passive: true });

    document.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        bindCardAtEvent(e.target, e.touches[0].clientX, e.touches[0].clientY, true);
      }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (activeCard && activeRect && e.touches && e.touches[0]) {
        updateActiveCardTilt(e.touches[0].clientX, e.touches[0].clientY, false);
      }
    }, { passive: true });

    window.addEventListener('pointerup', releaseActiveCard, { passive: true });
    window.addEventListener('pointercancel', releaseActiveCard, { passive: true });
    window.addEventListener('touchend', releaseActiveCard, { passive: true });

    const revealItems = document.querySelectorAll('.reveal-item');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -10px 0px' });

    revealItems.forEach((item) => revealObserver.observe(item));
  }

  function initUIActions() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = state.theme === 'night' ? 'day' : 'night';
        applyTheme(next);
      });
    }
  }

  function initApp() {
    detectAndApplyDevice();
    window.addEventListener('resize', detectAndApplyDevice, { passive: true });
    applyTheme('night');
    initBackgroundMusicFile();
    initIntroPortal();
    initInteractiveTypography();
    initThreeOceanBackground();
    initFullWebWaterWaves();
    initHero3DSculpture();
    initProceduralNatureArt();
    initPassionJigsawPuzzle();
    initPointerGlowAndWaterWaveSway();
    initSnugWaterSkillBars();
    initSingleTwoSidedContactCard();
    initMembranePressAndReveal();
    initUIActions();
    startMasterUncappedLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
