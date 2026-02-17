(() => {
      "use strict";

      const WORLD = { width: 1000, height: 1600 };
      const HALF_Y = WORLD.height / 2;
      const FRICTION = 0.995;
      const MAX_PUCK_SPEED = 28;
      const WIN_SCORE = 7;
      const GOAL_WIDTH = 300;
      const GOAL_LEFT = (WORLD.width - GOAL_WIDTH) / 2;
      const GOAL_RIGHT = GOAL_LEFT + GOAL_WIDTH;
      const WALL_MARGIN = 8;
      const CENTER_GAP = 20;
      const GOAL_FREEZE_DURATION = 0.33;
      const TRAIL_MAX_POINTS = 18;

      const PADDLE_RADIUS = 58;
      const PUCK_RADIUS = 24;
      const HUMAN_PADDLE_SPEED = 22;
      const PADDLE_SMOOTHING = 0.28;
      const DEAD_PUCK_THRESHOLD = 0.5;
      const DEAD_PUCK_TIME = 1.2;
      const JOYSTICK_MAX_OFFSET = 34;
      const JOYSTICK_MOVE_SPEED = 16;
      const ALWAYS_SHOW_JOYSTICK_IN_2P = true;
      const SHOW_BOTTOM_JOYSTICK_IN_AI = true;
      const JOYSTICK_ARENA_SIDE_GUTTER = 72;
      const JOYSTICK_ARENA_VERTICAL_GUTTER = 190;
      const AI_TOP_EXPANSION = 14;

      const AI_LEVELS = {
        easy: {
          maxSpeed: 9.6,
          reactionMs: 300,
          error: 76,
          aggression: 0.22,
          offenseChance: 0.16,
          predict: true,
          steer: 0.28,
          defendY: 0.225,
          challengeY: 0.295,
          homeTrack: 0.34,
          shotSpread: 58,
          shotBias: 0.4
        },
        medium: {
          maxSpeed: 14.0,
          reactionMs: 145,
          error: 26,
          aggression: 0.58,
          offenseChance: 0.47,
          predict: true,
          steer: 0.34,
          defendY: 0.232,
          challengeY: 0.32,
          homeTrack: 0.52,
          shotSpread: 30,
          shotBias: 0.58
        },
        hard: {
          maxSpeed: 17.2,
          reactionMs: 85,
          error: 12,
          aggression: 0.78,
          offenseChance: 0.7,
          predict: true,
          steer: 0.36,
          defendY: 0.235,
          challengeY: 0.33,
          homeTrack: 0.6,
          shotSpread: 22,
          shotBias: 0.7
        },
        insane: {
          maxSpeed: 21.4,
          reactionMs: 35,
          error: 5,
          aggression: 0.97,
          offenseChance: 0.92,
          predict: true,
          steer: 0.5,
          defendY: 0.245,
          challengeY: 0.35,
          homeTrack: 0.76,
          shotSpread: 10,
          shotBias: 0.95
        }
      };

      const canvas = document.getElementById("gameCanvas");
      const ctx = canvas.getContext("2d");

      const scoreValue = document.getElementById("scoreValue");
      const scoreNames = document.getElementById("scoreNames");
      const pauseBtn = document.getElementById("pauseBtn");
      const touchHint = document.getElementById("touchHint");
      const goalFlash = document.getElementById("goalFlash");

      const pauseOverlay = document.getElementById("pauseOverlay");
      const winOverlay = document.getElementById("winOverlay");
      const winnerText = document.getElementById("winnerText");
      const finalScoreText = document.getElementById("finalScoreText");
      const confettiLayer = document.getElementById("confettiLayer");
      const joystickLayer = document.getElementById("joystickLayer");
      const joyTop = document.getElementById("joyTop");
      const joyBottom = document.getElementById("joyBottom");

      const resumeBtn = document.getElementById("resumeBtn");
      const pauseMenuBtn = document.getElementById("pauseMenuBtn");
      const rematchBtn = document.getElementById("rematchBtn");
      const winMenuBtn = document.getElementById("winMenuBtn");
      const pauseSensitivityRange = document.getElementById("pauseSensitivityRange");
      const pauseSensitivityValue = document.getElementById("pauseSensitivityValue");
      const pauseSensitivityDesc = document.getElementById("pauseSensitivityDesc");

      const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const anyCoarsePointer = window.matchMedia("(any-pointer: coarse)").matches;
      const maxTouch = Math.max(navigator.maxTouchPoints || 0, navigator.msMaxTouchPoints || 0);
      const hasTouchSupport = ("ontouchstart" in window) || (maxTouch > 0);
      const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Mobi/i.test(navigator.userAgent || "");
      const isTouchLikeDevice = isCoarsePointer || anyCoarsePointer || hasTouchSupport || mobileUserAgent;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      let gamePhase = "playing";
      let gameMode = "ai";
      let aiDifficulty = "medium";
      let userSensitivity = 50;
      let roundFreeze = 0;
      let pendingRound = null;
      let flashAlpha = 0;
      let deadPuckTimer = 0;

      let lastTime = 0;
      let aiReactionTimer = 0;
      let lastAiChoice = { x: WORLD.width / 2, y: WORLD.height * 0.22 };

      const keys = new Set();
      const activeTouches = new Map();
      const joystickPointers = new Map();
      const joystickState = {
        top: { active: false, pointerId: null, x: 0, y: 0, deadZone: 0.12 },
        bottom: { active: false, pointerId: null, x: 0, y: 0, deadZone: 0.12 }
      };

      const particles = [];
      const confettiNodes = [];

      const scores = {
        top: 0,
        bottom: 0
      };

      const paddles = {
        top: {
          x: WORLD.width / 2,
          y: WORLD.height * 0.22,
          tx: WORLD.width / 2,
          ty: WORLD.height * 0.22,
          vx: 0,
          vy: 0,
          radius: PADDLE_RADIUS,
          color: "#ff4d6d",
          ring: "rgba(255, 210, 220, 0.85)",
          maxSpeed: HUMAN_PADDLE_SPEED
        },
        bottom: {
          x: WORLD.width / 2,
          y: WORLD.height * 0.78,
          tx: WORLD.width / 2,
          ty: WORLD.height * 0.78,
          vx: 0,
          vy: 0,
          radius: PADDLE_RADIUS,
          color: "#00f5ff",
          ring: "rgba(210, 255, 255, 0.85)",
          maxSpeed: HUMAN_PADDLE_SPEED
        }
      };

      const puck = {
        x: WORLD.width / 2,
        y: WORLD.height / 2,
        vx: 0,
        vy: 0,
        radius: PUCK_RADIUS,
        trail: []
      };

      let audioCtx = null;
      let masterGain = null;

      function ensureAudio() {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          masterGain = audioCtx.createGain();
          masterGain.gain.value = 0.32;
          masterGain.connect(audioCtx.destination);
        }
        if (audioCtx.state === "suspended") {
          audioCtx.resume().catch(() => {});
        }
      }

      function playTone({ freq = 440, endFreq = null, type = "sine", duration = 0.08, volume = 0.25, when = 0 }) {
        if (!audioCtx || !masterGain) {
          return;
        }
        const t = audioCtx.currentTime + when;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (endFreq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), t + duration);
        }
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(volume, t + duration * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(t);
        osc.stop(t + duration + 0.02);
      }

      function sfxPaddleHit() {
        playTone({
          freq: 760,
          endFreq: 220,
          type: "triangle",
          duration: 0.09,
          volume: 0.22
        });
      }

      function sfxWallHit() {
        playTone({
          freq: 230,
          endFreq: 130,
          type: "triangle",
          duration: 0.05,
          volume: 0.12
        });
      }

      function sfxGoal() {
        const notes = [480, 620, 790];
        notes.forEach((note, i) => {
          playTone({
            freq: note,
            endFreq: note * 1.02,
            type: "sine",
            duration: 0.13,
            volume: 0.18,
            when: i * 0.08
          });
        });
      }

      function resizeCanvas() {
        let availableW = window.innerWidth;
        let availableH = window.innerHeight;

        // Reserve visual room when joystick UI is active.
        if (isJoystickMode()) {
          availableW = Math.max(260, availableW - JOYSTICK_ARENA_SIDE_GUTTER);
          availableH = Math.max(360, availableH - JOYSTICK_ARENA_VERTICAL_GUTTER);
        }

        const scale = Math.min(availableW / WORLD.width, availableH / WORLD.height);
        const cssW = Math.floor(WORLD.width * scale);
        const cssH = Math.floor(WORLD.height * scale);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        canvas.width = Math.floor(WORLD.width * dpr);
        canvas.height = Math.floor(WORLD.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }

      function random(min, max) {
        return Math.random() * (max - min) + min;
      }

      function pointFromClient(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((clientX - rect.left) / rect.width) * WORLD.width,
          y: ((clientY - rect.top) / rect.height) * WORLD.height
        };
      }

      function clampTargetToHalf(side, x, y, radius = PADDLE_RADIUS) {
        const minX = radius + WALL_MARGIN;
        const maxX = WORLD.width - radius - WALL_MARGIN;
        const minY = side === "top" ? radius + WALL_MARGIN : HALF_Y + CENTER_GAP + radius;
        const maxY = side === "top"
          ? getTopMaxYForMode(radius)
          : WORLD.height - radius - WALL_MARGIN;
        return {
          x: clamp(x, minX, maxX),
          y: clamp(y, minY, maxY)
        };
      }

      function getTopMaxYForMode(radius = PADDLE_RADIUS) {
        const normalTopLimit = HALF_Y - CENTER_GAP - radius;
        if (gameMode !== "ai") {
          return normalTopLimit;
        }

        // Slightly expand AI side only, but keep it safely near (not past) midfield.
        const expandedTopLimit = normalTopLimit + AI_TOP_EXPANSION;
        const nearCenterCap = HALF_Y - radius - 8;
        return clamp(Math.min(expandedTopLimit, nearCenterCap), normalTopLimit, nearCenterCap);
      }

      function setPaddleTarget(side, x, y) {
        const bounded = clampTargetToHalf(side, x, y, paddles[side].radius);
        paddles[side].tx = bounded.x;
        paddles[side].ty = bounded.y;
      }

      function resetPaddles() {
        const topStart = { x: WORLD.width / 2, y: WORLD.height * 0.22 };
        const bottomStart = { x: WORLD.width / 2, y: WORLD.height * 0.78 };

        paddles.top.x = topStart.x;
        paddles.top.y = topStart.y;
        paddles.top.tx = topStart.x;
        paddles.top.ty = topStart.y;
        paddles.top.vx = 0;
        paddles.top.vy = 0;

        paddles.bottom.x = bottomStart.x;
        paddles.bottom.y = bottomStart.y;
        paddles.bottom.tx = bottomStart.x;
        paddles.bottom.ty = bottomStart.y;
        paddles.bottom.vx = 0;
        paddles.bottom.vy = 0;
      }

      function resetPuck(serveDir = Math.random() > 0.5 ? 1 : -1) {
        puck.x = WORLD.width / 2;
        puck.y = WORLD.height / 2;
        const base = 8;
        const ang = random(-0.35, 0.35);
        puck.vx = Math.sin(ang) * base;
        puck.vy = Math.cos(ang) * base * serveDir;
        puck.trail.length = 0;
        deadPuckTimer = 0;
      }

      function updateScoreboard() {
        scoreValue.textContent = `${scores.top} : ${scores.bottom}`;
        if (gameMode === "ai") {
          scoreNames.textContent = "AI (Top) vs You (Bottom)";
        } else {
          scoreNames.textContent = "Player 2 (Top) vs Player 1 (Bottom)";
        }
      }

      function showOverlay(overlayEl, show) {
        overlayEl.classList.toggle("show", show);
      }

      function sanitizeMode(value) {
        return value === "two" ? "two" : "ai";
      }

      function sanitizeDifficulty(value) {
        return AI_LEVELS[value] ? value : "medium";
      }

      function sanitizeSensitivity(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          return 50;
        }
        return clamp(Math.round(numeric), 0, 100);
      }

      function loadGameConfig() {
        const params = new URLSearchParams(window.location.search);
        let saved = null;
        try {
          saved = JSON.parse(localStorage.getItem("neon-air-hockey-config") || "null");
        } catch {
          saved = null;
        }

        gameMode = sanitizeMode(params.get("mode") || (saved && saved.mode) || "ai");
        aiDifficulty = sanitizeDifficulty(params.get("difficulty") || (saved && saved.difficulty) || "medium");
        userSensitivity = sanitizeSensitivity(params.get("sensitivity") || (saved && saved.sensitivity) || 50);
      }

      function saveGameConfig() {
        localStorage.setItem("neon-air-hockey-config", JSON.stringify({
          mode: gameMode,
          difficulty: aiDifficulty,
          sensitivity: userSensitivity
        }));
      }

      function getUserSensitivityScale() {
        // 0 => slower control, 50 => default-ish, 100 => very responsive.
        return 0.45 + (userSensitivity / 100) * 1.1;
      }

      function getSensitivityLabel(value) {
        if (value <= 15) {
          return "Sangat lambat";
        }
        if (value <= 35) {
          return "Lambat";
        }
        if (value <= 60) {
          return "Normal seimbang";
        }
        if (value <= 80) {
          return "Cepat";
        }
        return "Sangat cepat";
      }

      function updatePauseSensitivityUI() {
        if (!pauseSensitivityRange || !pauseSensitivityValue || !pauseSensitivityDesc) {
          return;
        }
        pauseSensitivityRange.value = String(userSensitivity);
        pauseSensitivityValue.textContent = String(userSensitivity);
        pauseSensitivityDesc.textContent = getSensitivityLabel(userSensitivity);
      }

      function setSensitivityFromPauseInput(value) {
        userSensitivity = sanitizeSensitivity(value);
        updatePauseSensitivityUI();
        saveGameConfig();
      }

      function isJoystickMode() {
        return shouldUseJoystickForSide("top") || shouldUseJoystickForSide("bottom");
      }

      function shouldUseJoystickForSide(side) {
        if (gameMode === "two") {
          return (ALWAYS_SHOW_JOYSTICK_IN_2P || isTouchLikeDevice) && (side === "top" || side === "bottom");
        }
        if (gameMode === "ai") {
          return side === "bottom" && SHOW_BOTTOM_JOYSTICK_IN_AI;
        }
        return false;
      }

      function setTouchHintVisibility(show) {
        if (!isTouchLikeDevice || !show) {
          touchHint.classList.add("hidden");
          return;
        }
        if (shouldUseJoystickForSide("top") && shouldUseJoystickForSide("bottom")) {
          touchHint.textContent = "Mode 2P mobile: pakai joystick P2 (atas kiri) dan P1 (bawah kanan).";
        } else if (shouldUseJoystickForSide("bottom")) {
          touchHint.textContent = "Mode AI: pakai joystick P1 (bawah kanan).";
        } else {
          touchHint.textContent = "Touch control: drag paddle di area kamu.";
        }
        touchHint.classList.remove("hidden");
      }

      function updateJoystickVisibility() {
        if (!joystickLayer) {
          return;
        }
        const show = isJoystickMode() && gamePhase === "playing";
        joystickLayer.classList.toggle("show", show);

        if (joyTop) {
          joyTop.style.display = show && shouldUseJoystickForSide("top") ? "block" : "none";
        }
        if (joyBottom) {
          joyBottom.style.display = show && shouldUseJoystickForSide("bottom") ? "block" : "none";
        }

        if (!show || !shouldUseJoystickForSide("top")) {
          releaseJoystick("top");
        }
        if (!show || !shouldUseJoystickForSide("bottom")) {
          releaseJoystick("bottom");
        }
      }

      function clearTouchAssignments() {
        activeTouches.clear();
      }

      function countAssignmentsFor(side) {
        let count = 0;
        for (const value of activeTouches.values()) {
          if (value === side) {
            count += 1;
          }
        }
        return count;
      }

      function resetJoystickStick(side) {
        const joystickEl = side === "top" ? joyTop : joyBottom;
        if (!joystickEl) {
          return;
        }
        const stick = joystickEl.querySelector(".joyStick");
        if (!stick) {
          return;
        }
        stick.style.transform = "translate(-50%, -50%)";
      }

      function releaseJoystick(side) {
        const state = joystickState[side];
        state.active = false;
        state.pointerId = null;
        state.x = 0;
        state.y = 0;
        resetJoystickStick(side);
      }

      function resetJoysticks() {
        releaseJoystick("top");
        releaseJoystick("bottom");
        joystickPointers.clear();
      }

      function updateJoystickFromPointer(side, clientX, clientY) {
        const joystickEl = side === "top" ? joyTop : joyBottom;
        const state = joystickState[side];
        if (!joystickEl || !state) {
          return;
        }

        const rect = joystickEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = clientX - cx;
        let dy = clientY - cy;

        const distance = Math.hypot(dx, dy);
        if (distance > JOYSTICK_MAX_OFFSET && distance > 0.001) {
          const ratio = JOYSTICK_MAX_OFFSET / distance;
          dx *= ratio;
          dy *= ratio;
        }

        state.x = dx / JOYSTICK_MAX_OFFSET;
        state.y = dy / JOYSTICK_MAX_OFFSET;

        const stick = joystickEl.querySelector(".joyStick");
        if (stick) {
          stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
      }

      function bindJoystick(joystickEl, side) {
        if (!joystickEl) {
          return;
        }
        joystickEl.addEventListener("pointerdown", (event) => {
          if (!shouldUseJoystickForSide(side) || gamePhase !== "playing") {
            return;
          }
          ensureAudio();
          event.preventDefault();
          const state = joystickState[side];
          if (state.active) {
            return;
          }
          state.active = true;
          state.pointerId = event.pointerId;
          joystickPointers.set(event.pointerId, side);
          joystickEl.setPointerCapture(event.pointerId);
          updateJoystickFromPointer(side, event.clientX, event.clientY);
        });

        // Touch fallback for browsers/devices with inconsistent pointer events.
        joystickEl.addEventListener("touchstart", (event) => {
          if (!shouldUseJoystickForSide(side) || gamePhase !== "playing") {
            return;
          }
          event.preventDefault();
          ensureAudio();
          const state = joystickState[side];
          if (state.active) {
            return;
          }
          const touch = event.changedTouches[0];
          if (!touch) {
            return;
          }
          state.active = true;
          state.pointerId = `t-${touch.identifier}`;
          updateJoystickFromPointer(side, touch.clientX, touch.clientY);
        }, { passive: false });

        joystickEl.addEventListener("touchmove", (event) => {
          const state = joystickState[side];
          if (!state.active || typeof state.pointerId !== "string" || !state.pointerId.startsWith("t-")) {
            return;
          }
          event.preventDefault();
          const touchId = Number(state.pointerId.slice(2));
          for (const touch of event.changedTouches) {
            if (touch.identifier === touchId) {
              updateJoystickFromPointer(side, touch.clientX, touch.clientY);
              break;
            }
          }
        }, { passive: false });

        const touchRelease = (event) => {
          const state = joystickState[side];
          if (!state.active || typeof state.pointerId !== "string" || !state.pointerId.startsWith("t-")) {
            return;
          }
          const touchId = Number(state.pointerId.slice(2));
          for (const touch of event.changedTouches) {
            if (touch.identifier === touchId) {
              releaseJoystick(side);
              break;
            }
          }
        };

        joystickEl.addEventListener("touchend", touchRelease, { passive: false });
        joystickEl.addEventListener("touchcancel", touchRelease, { passive: false });
      }

      function handleJoystickPointerMove(event) {
        const side = joystickPointers.get(event.pointerId);
        if (!side) {
          return;
        }
        event.preventDefault();
        updateJoystickFromPointer(side, event.clientX, event.clientY);
      }

      function handleJoystickPointerEnd(event) {
        const side = joystickPointers.get(event.pointerId);
        if (!side) {
          return;
        }
        joystickPointers.delete(event.pointerId);
        releaseJoystick(side);
      }

      function applyJoystickMovement(dtScale) {
        if (!isJoystickMode() || gamePhase !== "playing") {
          return;
        }
        const userScale = getUserSensitivityScale();
        for (const side of ["top", "bottom"]) {
          if (!shouldUseJoystickForSide(side)) {
            continue;
          }
          const state = joystickState[side];
          const magnitude = Math.hypot(state.x, state.y);
          if (!state.active || magnitude < state.deadZone) {
            continue;
          }
          const strength = (magnitude - state.deadZone) / (1 - state.deadZone);
          const nx = state.x / magnitude;
          const ny = state.y / magnitude;
          const step = JOYSTICK_MOVE_SPEED * userScale * strength * dtScale;
          setPaddleTarget(side, paddles[side].tx + nx * step, paddles[side].ty + ny * step);
        }
      }

      function handleTouchStart(event) {
        event.preventDefault();
        if (gamePhase !== "playing" || shouldUseJoystickForSide("bottom")) {
          return;
        }
        ensureAudio();

        for (const touch of event.changedTouches) {
          const p = pointFromClient(touch.clientX, touch.clientY);
          let side = "bottom";

          if (gameMode === "two") {
            side = p.y < HALF_Y ? "top" : "bottom";
            if (countAssignmentsFor(side) >= 1) {
              continue;
            }
          } else if (countAssignmentsFor("bottom") >= 1) {
            continue;
          }

          activeTouches.set(touch.identifier, side);
          setPaddleTarget(side, p.x, p.y);
        }
      }

      function handleTouchMove(event) {
        event.preventDefault();
        if (gamePhase !== "playing" || shouldUseJoystickForSide("bottom")) {
          return;
        }
        for (const touch of event.changedTouches) {
          const side = activeTouches.get(touch.identifier);
          if (!side) {
            continue;
          }
          const p = pointFromClient(touch.clientX, touch.clientY);
          setPaddleTarget(side, p.x, p.y);
        }
      }

      function handleTouchEnd(event) {
        event.preventDefault();
        for (const touch of event.changedTouches) {
          activeTouches.delete(touch.identifier);
        }
      }
      function handleMouseMove(event) {
        if (gamePhase !== "playing" || isTouchLikeDevice || isJoystickMode()) {
          return;
        }
        const p = pointFromClient(event.clientX, event.clientY);
        if (gameMode === "ai") {
          setPaddleTarget("bottom", p.x, p.y);
        } else {
          // Mouse fallback: pointer controls whichever half it currently occupies.
          const side = p.y < HALF_Y ? "top" : "bottom";
          setPaddleTarget(side, p.x, p.y);
        }
      }

      function runDesktopTwoPlayerKeyboard(dtScale) {
        if (gameMode !== "two" || isTouchLikeDevice) {
          return;
        }

        const step = 15 * getUserSensitivityScale() * dtScale;

        const topDX = (keys.has("d") || keys.has("D") ? 1 : 0) - (keys.has("a") || keys.has("A") ? 1 : 0);
        const topDY = (keys.has("s") || keys.has("S") ? 1 : 0) - (keys.has("w") || keys.has("W") ? 1 : 0);
        if (topDX || topDY) {
          setPaddleTarget("top", paddles.top.tx + topDX * step, paddles.top.ty + topDY * step);
        }

        const bottomDX = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
        const bottomDY = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
        if (bottomDX || bottomDY) {
          setPaddleTarget("bottom", paddles.bottom.tx + bottomDX * step, paddles.bottom.ty + bottomDY * step);
        }
      }

      function startGame() {
        ensureAudio();
        saveGameConfig();
        scores.top = 0;
        scores.bottom = 0;
        resetPaddles();
        resetPuck(Math.random() > 0.5 ? 1 : -1);
        roundFreeze = 0;
        pendingRound = null;
        particles.length = 0;
        clearTouchAssignments();
        resetJoysticks();
        aiReactionTimer = 0;
        showOverlay(pauseOverlay, false);
        showOverlay(winOverlay, false);
        updateScoreboard();
        hideConfetti();
        gamePhase = "playing";
        updatePauseSensitivityUI();
        setTouchHintVisibility(true);
        updateJoystickVisibility();
      }

      function backToMenu() {
        const query = new URLSearchParams({
          mode: gameMode,
          difficulty: aiDifficulty,
          sensitivity: String(userSensitivity)
        }).toString();
        window.location.href = `index.html?${query}`;
      }

      function pauseGame() {
        if (gamePhase !== "playing") {
          return;
        }
        gamePhase = "paused";
        updatePauseSensitivityUI();
        showOverlay(pauseOverlay, true);
        setTouchHintVisibility(false);
        updateJoystickVisibility();
      }

      function resumeGame() {
        if (gamePhase !== "paused") {
          return;
        }
        showOverlay(pauseOverlay, false);
        gamePhase = "playing";
        setTouchHintVisibility(true);
        updateJoystickVisibility();
      }

      function declareWinner(side) {
        gamePhase = "win";
        showOverlay(winOverlay, true);
        setTouchHintVisibility(false);
        updateJoystickVisibility();

        const winnerLabel = gameMode === "ai"
          ? (side === "bottom" ? "YOU WIN" : "AI WINS")
          : (side === "bottom" ? "PLAYER 1 WINS" : "PLAYER 2 WINS");

        winnerText.textContent = winnerLabel;
        winnerText.style.color = side === "bottom" ? "#8ffcff" : "#ff9eb1";
        winnerText.style.textShadow = side === "bottom"
          ? "0 0 12px rgba(0,245,255,0.8), 0 0 22px rgba(0,245,255,0.45)"
          : "0 0 12px rgba(255,77,109,0.8), 0 0 22px rgba(255,77,109,0.45)";
        finalScoreText.textContent = `Final Score: ${scores.top} : ${scores.bottom}`;
        spawnConfetti(80);
      }

      function onGoal(scoringSide) {
        if (gamePhase !== "playing") {
          return;
        }

        if (scoringSide === "top") {
          scores.top += 1;
        } else {
          scores.bottom += 1;
        }
        updateScoreboard();
        sfxGoal();

        const color = scoringSide === "top" ? paddles.top.color : paddles.bottom.color;
        spawnGoalSparks(puck.x, puck.y, color);
        flashAlpha = 0.75;

        roundFreeze = GOAL_FREEZE_DURATION;
        gamePhase = "goalFreeze";
        setTouchHintVisibility(false);
        updateJoystickVisibility();

        const winner = scores.top >= WIN_SCORE ? "top" : (scores.bottom >= WIN_SCORE ? "bottom" : null);
        pendingRound = {
          winner,
          serveDir: scoringSide === "top" ? 1 : -1
        };
      }

      function processAfterGoalFreeze() {
        if (!pendingRound) {
          return;
        }
        const next = pendingRound;
        pendingRound = null;

        if (next.winner) {
          declareWinner(next.winner);
          return;
        }

        resetPaddles();
        resetPuck(next.serveDir);
        gamePhase = "playing";
        setTouchHintVisibility(true);
        updateJoystickVisibility();
      }

      function updatePaddleMotion(side, dtScale) {
        const paddle = paddles[side];
        const blend = 1 - Math.pow(1 - PADDLE_SMOOTHING, dtScale);

        let dx = (paddle.tx - paddle.x) * blend;
        let dy = (paddle.ty - paddle.y) * blend;
        const len = Math.hypot(dx, dy);
        const maxStep = paddle.maxSpeed * dtScale;
        if (len > maxStep && len > 0.0001) {
          const ratio = maxStep / len;
          dx *= ratio;
          dy *= ratio;
        }

        paddle.x += dx;
        paddle.y += dy;
        paddle.vx = dx / Math.max(0.001, dtScale);
        paddle.vy = dy / Math.max(0.001, dtScale);
      }

      function predictPuckXAtY(targetY) {
        let simX = puck.x;
        let simY = puck.y;
        let simVx = puck.vx;
        let simVy = puck.vy;
        const radius = puck.radius;
        const step = 1;

        for (let i = 0; i < 240; i += 1) {
          simX += simVx * step;
          simY += simVy * step;

          if (simX - radius <= WALL_MARGIN) {
            simX = WALL_MARGIN + radius;
            simVx = Math.abs(simVx);
          } else if (simX + radius >= WORLD.width - WALL_MARGIN) {
            simX = WORLD.width - WALL_MARGIN - radius;
            simVx = -Math.abs(simVx);
          }

          if ((simVy < 0 && simY - radius <= targetY) || (simVy > 0 && simY + radius >= targetY)) {
            return clamp(simX, PADDLE_RADIUS + WALL_MARGIN, WORLD.width - PADDLE_RADIUS - WALL_MARGIN);
          }

          // Rough friction approximation in prediction.
          simVx *= FRICTION;
          simVy *= FRICTION;
        }
        return WORLD.width / 2;
      }

      function predictPuckStateAtY(targetY) {
        let simX = puck.x;
        let simY = puck.y;
        let simVx = puck.vx;
        let simVy = puck.vy;
        const radius = puck.radius;

        for (let i = 0; i < 300; i += 1) {
          simX += simVx;
          simY += simVy;

          if (simX - radius <= WALL_MARGIN) {
            simX = WALL_MARGIN + radius;
            simVx = Math.abs(simVx);
          } else if (simX + radius >= WORLD.width - WALL_MARGIN) {
            simX = WORLD.width - WALL_MARGIN - radius;
            simVx = -Math.abs(simVx);
          }

          if ((simVy < 0 && simY - radius <= targetY) || (simVy > 0 && simY + radius >= targetY)) {
            return {
              x: clamp(simX, PADDLE_RADIUS + WALL_MARGIN, WORLD.width - PADDLE_RADIUS - WALL_MARGIN),
              y: simY,
              vx: simVx,
              vy: simVy,
              eta: i + 1
            };
          }

          simVx *= FRICTION;
          simVy *= FRICTION;

          if (Math.hypot(simVx, simVy) < 0.2) {
            break;
          }
        }

        return {
          x: clamp(simX, PADDLE_RADIUS + WALL_MARGIN, WORLD.width - PADDLE_RADIUS - WALL_MARGIN),
          y: simY,
          vx: simVx,
          vy: simVy,
          eta: 300
        };
      }

      function getAiShotLane(level) {
        const lanePad = 28;
        const leftLane = GOAL_LEFT + lanePad;
        const rightLane = GOAL_RIGHT - lanePad;
        const playerOnRight = paddles.bottom.x > WORLD.width / 2;
        const preferred = playerOnRight ? leftLane : rightLane;
        return clamp(
          preferred + random(-level.shotSpread, level.shotSpread),
          GOAL_LEFT + 18,
          GOAL_RIGHT - 18
        );
      }

      function updateAi(dtMs) {
        if (gameMode !== "ai" || gamePhase !== "playing") {
          return;
        }

        const level = AI_LEVELS[aiDifficulty];
        paddles.top.maxSpeed = level.maxSpeed;
        aiReactionTimer += dtMs;

        const puckSpeed = Math.hypot(puck.vx, puck.vy);
        const puckHeadingTop = puck.vy < -0.2;
        const puckHeadingBottom = puck.vy > 0.2;
        const homeX = clamp(
          WORLD.width / 2 + (puck.x - WORLD.width / 2) * level.homeTrack,
          92,
          WORLD.width - 92
        );
        const aiMaxY = getTopMaxYForMode(paddles.top.radius);
        const defendY = clamp(
          WORLD.height * level.defendY,
          paddles.top.radius + WALL_MARGIN,
          aiMaxY - 14
        );
        const challengeY = clamp(
          WORLD.height * level.challengeY,
          paddles.top.radius + WALL_MARGIN,
          aiMaxY - 10
        );
        const centerReadyY = clamp(
          defendY + (aiMaxY - defendY) * (0.34 + level.aggression * 0.14),
          defendY + 8,
          aiMaxY - 16
        );

        if (aiReactionTimer >= level.reactionMs) {
          aiReactionTimer = 0;

          let targetX = homeX;
          let targetY = defendY;
          const puckInTopHalf = puck.y < HALF_Y + 70;

          if (puckHeadingTop || puckInTopHalf) {
            const centerBias = clamp((puck.y - (HALF_Y - 120)) / 180, 0, 1);
            const interceptBase = challengeY + clamp(-puck.vy * 2.2, -40, 45);
            const interceptY = clamp(
              interceptBase + centerBias * (aiMaxY - interceptBase),
              WORLD.height * 0.17,
              aiMaxY - 14
            );
            const prediction = level.predict
              ? predictPuckStateAtY(interceptY)
              : { x: puck.x, eta: 300 };

            targetX = prediction.x + random(-level.error, level.error);
            targetY = interceptY;

            const closeControlChance = level.offenseChance * (puckInTopHalf ? 1 : 0.5);
            const canAttack = Math.random() < closeControlChance && puck.y < HALF_Y + 25 && puckSpeed < 18;
            if (canAttack) {
              const shotLane = getAiShotLane(level);
              const shotShift = clamp((shotLane - puck.x) * level.shotBias, -72, 72);
              targetX = clamp(
                puck.x + shotShift + random(-level.error * 0.35, level.error * 0.35),
                84,
                WORLD.width - 84
              );
              targetY = clamp(
                puck.y - (puck.radius + paddles.top.radius - 8),
                WORLD.height * 0.18,
                aiMaxY
              );
            }
          } else if (puckHeadingBottom) {
            targetX = homeX + random(-level.error * 0.3, level.error * 0.3);
            targetY = defendY + random(-8, 9);

            const pressureChance = level.offenseChance * 0.5;
            if (puck.y < HALF_Y + 130 && Math.random() < pressureChance) {
              targetX = clamp(puck.x + puck.vx * 2.9, 88, WORLD.width - 88);
              targetY = challengeY - 30;
            }
          } else {
            targetX = homeX;
            targetY = defendY;
          }

          // When puck hovers near midfield, hold a lower defensive posture.
          if (puck.y > HALF_Y - 120 && puck.y < HALF_Y + 180) {
            targetY = Math.max(targetY, centerReadyY);
          }

          // Emergency block near goal line.
          if (puckHeadingTop && puck.y < WORLD.height * 0.24) {
            const emergency = level.predict
              ? predictPuckStateAtY(WALL_MARGIN + puck.radius + paddles.top.radius + 18)
              : { x: puck.x };
            targetX = emergency.x + random(-level.error * 0.25, level.error * 0.25);
            targetY = WORLD.height * 0.165;
          }

          lastAiChoice.x = clamp(
            targetX,
            paddles.top.radius + WALL_MARGIN,
            WORLD.width - paddles.top.radius - WALL_MARGIN
          );
          lastAiChoice.y = clamp(
            targetY,
            paddles.top.radius + WALL_MARGIN,
            aiMaxY
          );
        }

        // Smooth steering removes robotic snapping while keeping reactions fast.
        const steerBlend = 1 - Math.pow(1 - level.steer, dtMs / (1000 / 60));
        const smoothX = paddles.top.tx + (lastAiChoice.x - paddles.top.tx) * steerBlend;
        const smoothY = paddles.top.ty + (lastAiChoice.y - paddles.top.ty) * steerBlend;
        setPaddleTarget("top", smoothX, smoothY);
      }

      function handlePaddleCollision(side) {
        const paddle = paddles[side];
        const dx = puck.x - paddle.x;
        const dy = puck.y - paddle.y;
        const minDist = puck.radius + paddle.radius;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minDist * minDist) {
          return;
        }

        const dist = Math.sqrt(distSq) || 0.0001;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist + 0.5;

        puck.x += nx * overlap;
        puck.y += ny * overlap;

        const relVelAlongNormal = (puck.vx - paddle.vx) * nx + (puck.vy - paddle.vy) * ny;
        if (relVelAlongNormal < 0) {
          puck.vx -= 2 * relVelAlongNormal * nx;
          puck.vy -= 2 * relVelAlongNormal * ny;
        }

        // Paddle velocity influences puck response.
        puck.vx += paddle.vx * 0.55;
        puck.vy += paddle.vy * 0.55;

        let speed = Math.hypot(puck.vx, puck.vy);
        speed = Math.min(speed * 1.03 + 0.4, MAX_PUCK_SPEED);
        const ang = Math.atan2(puck.vy, puck.vx);
        puck.vx = Math.cos(ang) * speed;
        puck.vy = Math.sin(ang) * speed;

        sfxPaddleHit();
      }

      function handleWallPhysics() {
        let bounced = false;

        if (puck.x - puck.radius <= WALL_MARGIN) {
          puck.x = WALL_MARGIN + puck.radius;
          puck.vx = Math.abs(puck.vx);
          bounced = true;
        } else if (puck.x + puck.radius >= WORLD.width - WALL_MARGIN) {
          puck.x = WORLD.width - WALL_MARGIN - puck.radius;
          puck.vx = -Math.abs(puck.vx);
          bounced = true;
        }

        if (puck.y - puck.radius <= WALL_MARGIN) {
          if (puck.x > GOAL_LEFT && puck.x < GOAL_RIGHT) {
            onGoal("bottom");
          } else {
            puck.y = WALL_MARGIN + puck.radius;
            puck.vy = Math.abs(puck.vy);
            bounced = true;
          }
        } else if (puck.y + puck.radius >= WORLD.height - WALL_MARGIN) {
          if (puck.x > GOAL_LEFT && puck.x < GOAL_RIGHT) {
            onGoal("top");
          } else {
            puck.y = WORLD.height - WALL_MARGIN - puck.radius;
            puck.vy = -Math.abs(puck.vy);
            bounced = true;
          }
        }

        if (bounced) {
          sfxWallHit();
        }
      }

      function applyDeadPuckNudge(dtSec) {
        const speed = Math.hypot(puck.vx, puck.vy);
        if (speed < DEAD_PUCK_THRESHOLD) {
          deadPuckTimer += dtSec;
        } else {
          deadPuckTimer = 0;
        }

        if (deadPuckTimer > DEAD_PUCK_TIME) {
          deadPuckTimer = 0;
          const angle = random(0, Math.PI * 2);
          const nudge = random(3.8, 5.3);
          puck.vx += Math.cos(angle) * nudge;
          puck.vy += Math.sin(angle) * nudge;
        }
      }

      function pushTrailPoint() {
        puck.trail.push({ x: puck.x, y: puck.y });
        while (puck.trail.length > TRAIL_MAX_POINTS) {
          puck.trail.shift();
        }
      }

      function spawnGoalSparks(x, y, color) {
        const count = Math.floor(random(20, 36));
        for (let i = 0; i < count; i += 1) {
          const angle = random(0, Math.PI * 2);
          const speed = random(3.5, 11.5);
          particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: random(0.24, 0.5),
            maxLife: random(0.24, 0.5),
            size: random(2, 4.5),
            color
          });
        }
      }

      function updateParticles(dtScale, dtSec) {
        for (let i = particles.length - 1; i >= 0; i -= 1) {
          const p = particles[i];
          p.life -= dtSec;
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
          p.x += p.vx * dtScale;
          p.y += p.vy * dtScale;
          p.vx *= 0.98;
          p.vy *= 0.98;
        }
      }

      function update(dtMs) {
        const dtSec = dtMs / 1000;
        const dtScale = dtMs / (1000 / 60);

        updateParticles(dtScale, dtSec);
        flashAlpha = Math.max(0, flashAlpha - dtSec * 2.9);
        goalFlash.style.opacity = `${flashAlpha}`;

        if (gamePhase === "paused" || gamePhase === "menu" || gamePhase === "win") {
          return;
        }

        if (gamePhase === "goalFreeze") {
          roundFreeze -= dtSec;
          if (roundFreeze <= 0) {
            processAfterGoalFreeze();
          }
          return;
        }

        runDesktopTwoPlayerKeyboard(dtScale);
        applyJoystickMovement(dtScale);
        updateAi(dtMs);

        const userScale = getUserSensitivityScale();
        paddles.bottom.maxSpeed = HUMAN_PADDLE_SPEED * userScale;
        if (gameMode === "two") {
          paddles.top.maxSpeed = HUMAN_PADDLE_SPEED * userScale;
        }

        updatePaddleMotion("top", dtScale);
        updatePaddleMotion("bottom", dtScale);

        puck.x += puck.vx * dtScale;
        puck.y += puck.vy * dtScale;

        const frictionScale = Math.pow(FRICTION, dtScale);
        puck.vx *= frictionScale;
        puck.vy *= frictionScale;

        handlePaddleCollision("top");
        handlePaddleCollision("bottom");
        handleWallPhysics();

        let speed = Math.hypot(puck.vx, puck.vy);
        if (speed > MAX_PUCK_SPEED) {
          const ratio = MAX_PUCK_SPEED / speed;
          puck.vx *= ratio;
          puck.vy *= ratio;
          speed = MAX_PUCK_SPEED;
        }

        applyDeadPuckNudge(dtSec);
        pushTrailPoint();
      }

      function drawGrid(timeMs) {
        const t = timeMs * 0.00006;
        const spacing = 72;
        const offsetX = (t * 200) % spacing;
        const offsetY = (t * 140) % spacing;

        ctx.save();
        ctx.fillStyle = "#030712";
        ctx.fillRect(0, 0, WORLD.width, WORLD.height);

        ctx.strokeStyle = "rgba(0, 245, 255, 0.10)";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(0, 245, 255, 0.4)";

        for (let x = -spacing + offsetX; x < WORLD.width + spacing; x += spacing) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, WORLD.height);
          ctx.stroke();
        }
        for (let y = -spacing + offsetY; y < WORLD.height + spacing; y += spacing) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(WORLD.width, y);
          ctx.stroke();
        }
        ctx.restore();
      }
      function drawRink() {
        ctx.save();

        ctx.strokeStyle = "rgba(173, 237, 255, 0.24)";
        ctx.lineWidth = 2;
        ctx.setLineDash([16, 16]);
        ctx.beginPath();
        ctx.moveTo(0, HALF_Y);
        ctx.lineTo(WORLD.width, HALF_Y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = "rgba(173, 237, 255, 0.24)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(WORLD.width / 2, HALF_Y, 90, 0, Math.PI * 2);
        ctx.stroke();

        // Top goal outline.
        ctx.strokeStyle = "rgba(255, 77, 109, 0.9)";
        ctx.lineWidth = 4;
        ctx.shadowBlur = 16;
        ctx.shadowColor = "rgba(255,77,109,0.75)";
        ctx.strokeRect(GOAL_LEFT, 0, GOAL_WIDTH, 42);

        // Bottom goal outline.
        ctx.strokeStyle = "rgba(0, 245, 255, 0.9)";
        ctx.shadowBlur = 16;
        ctx.shadowColor = "rgba(0,245,255,0.75)";
        ctx.strokeRect(GOAL_LEFT, WORLD.height - 42, GOAL_WIDTH, 42);

        // Outer border.
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(190, 246, 255, 0.22)";
        ctx.shadowBlur = 0;
        ctx.strokeRect(1.5, 1.5, WORLD.width - 3, WORLD.height - 3);
        ctx.restore();
      }

      function drawPaddle(paddle) {
        ctx.save();

        const grad = ctx.createRadialGradient(
          paddle.x - paddle.radius * 0.28,
          paddle.y - paddle.radius * 0.28,
          paddle.radius * 0.2,
          paddle.x,
          paddle.y,
          paddle.radius
        );
        grad.addColorStop(0, "rgba(255,255,255,0.95)");
        grad.addColorStop(0.2, paddle.color);
        grad.addColorStop(1, "rgba(0, 0, 0, 0.65)");

        ctx.fillStyle = grad;
        ctx.shadowBlur = 18;
        ctx.shadowColor = paddle.color;
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddle.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner handle ring.
        ctx.lineWidth = 4;
        ctx.strokeStyle = paddle.ring;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(paddle.x, paddle.y, paddle.radius * 0.45, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      function drawPuck() {
        // Trail
        for (let i = 0; i < puck.trail.length; i += 1) {
          const point = puck.trail[i];
          const alpha = (i + 1) / puck.trail.length * 0.34;
          const radius = puck.radius * (0.38 + (i / puck.trail.length) * 0.62);
          ctx.beginPath();
          ctx.fillStyle = `rgba(0, 245, 255, ${alpha})`;
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.save();
        const grad = ctx.createRadialGradient(
          puck.x - puck.radius * 0.3,
          puck.y - puck.radius * 0.3,
          puck.radius * 0.3,
          puck.x,
          puck.y,
          puck.radius
        );
        grad.addColorStop(0, "rgba(225, 255, 255, 0.95)");
        grad.addColorStop(0.45, "rgba(0, 245, 255, 0.95)");
        grad.addColorStop(1, "rgba(0, 170, 190, 0.9)");
        ctx.fillStyle = grad;
        ctx.shadowBlur = 22;
        ctx.shadowColor = "rgba(0, 245, 255, 0.95)";
        ctx.beginPath();
        ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawParticles() {
        for (const p of particles) {
          const lifeRatio = p.life / p.maxLife;
          ctx.save();
          ctx.globalAlpha = lifeRatio;
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 12;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      function render(timeMs) {
        drawGrid(timeMs);
        drawRink();
        drawPaddle(paddles.top);
        drawPaddle(paddles.bottom);
        drawPuck();
        drawParticles();
      }

      function loop(timeMs) {
        if (!lastTime) {
          lastTime = timeMs;
        }
        const dt = Math.min(34, timeMs - lastTime);
        lastTime = timeMs;

        update(dt);
        render(timeMs);
        requestAnimationFrame(loop);
      }

      function spawnConfetti(count) {
        hideConfetti();
        const colors = ["#00f5ff", "#ff4d6d", "#ffe066", "#6ef9a0", "#f6f7ff"];
        for (let i = 0; i < count; i += 1) {
          const piece = document.createElement("span");
          piece.className = "confetti";
          piece.style.left = `${random(0, 100)}%`;
          piece.style.background = colors[Math.floor(random(0, colors.length))];
          piece.style.animationDuration = `${random(2.8, 5.4)}s`;
          piece.style.animationDelay = `${random(0, 0.65)}s`;
          piece.style.setProperty("--x-drift", `${random(-160, 160)}px`);
          piece.style.setProperty("--rot", `${random(320, 1080)}deg`);
          confettiLayer.appendChild(piece);
          confettiNodes.push(piece);
        }
      }

      function hideConfetti() {
        for (const node of confettiNodes) {
          node.remove();
        }
        confettiNodes.length = 0;
      }

      function bindEvents() {
        window.addEventListener("resize", resizeCanvas);

        canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
        canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
        canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
        canvas.addEventListener("touchcancel", handleTouchEnd, { passive: false });
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mousedown", () => ensureAudio());

        bindJoystick(joyTop, "top");
        bindJoystick(joyBottom, "bottom");
        window.addEventListener("pointermove", handleJoystickPointerMove, { passive: false });
        window.addEventListener("pointerup", handleJoystickPointerEnd, { passive: false });
        window.addEventListener("pointercancel", handleJoystickPointerEnd, { passive: false });

        document.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            if (gamePhase === "playing" || gamePhase === "paused") {
              event.preventDefault();
              if (gamePhase === "playing") {
                pauseGame();
              } else {
                resumeGame();
              }
            }
            return;
          }
          keys.add(event.key);
        });

        document.addEventListener("keyup", (event) => {
          keys.delete(event.key);
        });

        pauseBtn.addEventListener("click", () => {
          ensureAudio();
          if (gamePhase === "playing") {
            pauseGame();
          } else if (gamePhase === "paused") {
            resumeGame();
          }
        });

        resumeBtn.addEventListener("click", resumeGame);
        pauseMenuBtn.addEventListener("click", backToMenu);
        winMenuBtn.addEventListener("click", backToMenu);
        rematchBtn.addEventListener("click", () => {
          showOverlay(winOverlay, false);
          startGame();
        });

        if (pauseSensitivityRange) {
          pauseSensitivityRange.addEventListener("input", () => {
            setSensitivityFromPauseInput(pauseSensitivityRange.value);
          });
          pauseSensitivityRange.addEventListener("change", () => {
            setSensitivityFromPauseInput(pauseSensitivityRange.value);
          });
        }

        // Unlock audio on first explicit interaction.
        ["touchstart", "mousedown", "keydown"].forEach((ev) => {
          window.addEventListener(ev, ensureAudio, { once: true, passive: true });
        });
      }

      function init() {
        loadGameConfig();
        resizeCanvas();
        bindEvents();
        gameMode = sanitizeMode(gameMode);
        aiDifficulty = sanitizeDifficulty(aiDifficulty);
        userSensitivity = sanitizeSensitivity(userSensitivity);
        updatePauseSensitivityUI();
        updateScoreboard();
        startGame();
        requestAnimationFrame(loop);
      }

      init();
    })();
