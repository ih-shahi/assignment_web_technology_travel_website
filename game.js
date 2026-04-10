(function () {
  'use strict';

  /* ===========================
     MODE & CONFIGURATION
     =========================== */

  const mode = document.body.dataset.mode || '404';

  const CONFIG = {
    '404': {
      playerSpeed: 5,
      enemyBaseSpeed: 1.4,
      spawnInterval: 1600,
      maxEnemies: 20,
      speedRamp: 0.01,       // speed increase per 1 points
      spawnRamp: 1,          // ms faster spawn per 1 points
      playerGlow: '#00e5ff',
      enemyGlow: '#ff6d00',
    },
    '500': {
      playerSpeed: 6,
      enemyBaseSpeed: 2.2,
      spawnInterval: 900,
      maxEnemies: 12,
      speedRamp: 0.035,
      spawnRamp: 10,
      playerGlow: '#00e5ff',
      enemyGlow: '#ff1744',
    }
  };

  const cfg = CONFIG[mode];

  /* ===========================
     CANVAS SETUP
     =========================== */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ===========================
     DOM REFS
     =========================== */

  const scoreEl       = document.getElementById('score-display');
  const highScoreEl   = document.getElementById('high-score-display');
  const startScreen   = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('game-over');
  const pauseScreen   = document.getElementById('pause-screen');
  const finalScoreEl  = document.getElementById('final-score');
  const finalBestEl   = document.getElementById('final-best');

  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('pause-btn').addEventListener('click', togglePause);
  document.getElementById('resume-btn').addEventListener('click', togglePause);

  /* ===========================
     GAME STATE
     =========================== */

  let player, enemies, stars, particles;
  let score, highScore, scoreTimer;
  let running, paused, gameOver;
  let spawnTimer, spawnInterval;
  let lastFrame, shakeTimer;
  let keys = {};

  const LS_KEY = `skyescape_best_${mode}`;
  highScore = parseInt(localStorage.getItem(LS_KEY)) || 0;
  highScoreEl.textContent = highScore;

  /* ===========================
     PLAYER
     =========================== */

  function createPlayer() {
    return {
      x: canvas.width / 2,
      y: canvas.height - 90,
      w: 36,
      h: 48,
      speed: cfg.playerSpeed,
      trail: [],
    };
  }

  function drawPlayer(p) {
    const cx = p.x;
    const cy = p.y;
    const w = p.w;
    const h = p.h;

    // Exhaust trail
    for (let i = 0; i < p.trail.length; i++) {
      const t = p.trail[i];
      const alpha = t.life / t.maxLife;
      ctx.fillStyle = `rgba(0, 229, 255, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3 * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.shadowColor = cfg.playerGlow;
    ctx.shadowBlur = 25;

    // Body
    ctx.fillStyle = cfg.playerGlow;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);              // nose
    ctx.lineTo(cx + w * 0.15, cy - h * 0.2);
    ctx.lineTo(cx + w * 0.15, cy + h * 0.3);
    ctx.lineTo(cx + w * 0.08, cy + h / 2);   // tail right
    ctx.lineTo(cx - w * 0.08, cy + h / 2);   // tail left
    ctx.lineTo(cx - w * 0.15, cy + h * 0.3);
    ctx.lineTo(cx - w * 0.15, cy - h * 0.2);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.fillStyle = cfg.playerGlow;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, cy);
    ctx.lineTo(cx - w / 2, cy + h * 0.2);
    ctx.lineTo(cx - w * 0.15, cy + h * 0.15);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + w * 0.15, cy);
    ctx.lineTo(cx + w / 2, cy + h * 0.2);
    ctx.lineTo(cx + w * 0.15, cy + h * 0.15);
    ctx.closePath();
    ctx.fill();

    // Tail fins
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.08, cy + h * 0.35);
    ctx.lineTo(cx - w * 0.3, cy + h / 2);
    ctx.lineTo(cx - w * 0.08, cy + h * 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + w * 0.08, cy + h * 0.35);
    ctx.lineTo(cx + w * 0.3, cy + h / 2);
    ctx.lineTo(cx + w * 0.08, cy + h * 0.45);
    ctx.closePath();
    ctx.fill();

    // Cockpit glow
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy - h * 0.18, w * 0.06, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function updatePlayer(dt) {
    const moveAmt = player.speed * dt * 60;

    if (keys['ArrowLeft'] || keys['a']) player.x -= moveAmt;
    if (keys['ArrowRight'] || keys['d']) player.x += moveAmt;

    if (touchTarget !== null) {
      const diff = touchTarget - player.x;
      const step = Math.min(Math.abs(diff), moveAmt * 1.2);
      player.x += Math.sign(diff) * step;
    }

    const half = player.w / 2 + 4;
    player.x = Math.max(half, Math.min(canvas.width - half, player.x));
    player.y = canvas.height - 90;

    // Trail particles
    if (running && !gameOver) {
      player.trail.push({
        x: player.x + (Math.random() - 0.5) * 6,
        y: player.y + player.h / 2 + 4,
        life: 1,
        maxLife: 1,
      });
    }
    player.trail = player.trail.filter(t => {
      t.y += 1.5;
      t.life -= 0.04;
      return t.life > 0;
    });
  }

  /* ===========================
     ENEMIES
     =========================== */

  function spawnEnemy() {
    if (enemies.length >= cfg.maxEnemies) return;
    const margin = 40;
    enemies.push({
      x: margin + Math.random() * (canvas.width - margin * 2),
      y: -40,
      w: 28,
      h: 38,
      baseSpeed: cfg.enemyBaseSpeed + Math.random() * 0.8,
      scale: 0.35,
      angle: (Math.random() - 0.5) * 0.4,
    });
  }

  function drawEnemy(e) {
    const s = e.scale;
    const cx = e.x;
    const cy = e.y;
    const w = e.w * s;
    const h = e.h * s;

    ctx.save();
    ctx.shadowColor = cfg.enemyGlow;
    ctx.shadowBlur = 18 * s;
    ctx.fillStyle = cfg.enemyGlow;

    // Body (pointing down)
    ctx.beginPath();
    ctx.moveTo(cx, cy + h / 2);                // nose (bottom)
    ctx.lineTo(cx + w * 0.15, cy + h * 0.2);
    ctx.lineTo(cx + w * 0.15, cy - h * 0.3);
    ctx.lineTo(cx + w * 0.08, cy - h / 2);
    ctx.lineTo(cx - w * 0.08, cy - h / 2);
    ctx.lineTo(cx - w * 0.15, cy - h * 0.3);
    ctx.lineTo(cx - w * 0.15, cy + h * 0.2);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, cy);
    ctx.lineTo(cx - w / 2, cy - h * 0.18);
    ctx.lineTo(cx - w * 0.15, cy - h * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + w * 0.15, cy);
    ctx.lineTo(cx + w / 2, cy - h * 0.18);
    ctx.lineTo(cx + w * 0.15, cy - h * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function updateEnemies(dt) {
    const speedBonus = Math.floor(score / 10) * cfg.speedRamp;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += (e.baseSpeed + speedBonus) * dt * 60;
      e.x += Math.sin(e.angle) * 0.5;
      e.scale = 0.35 + (e.y / canvas.height) * 1.15;
      e.scale = Math.min(e.scale, 1.6);

      // Off screen
      if (e.y - e.h * e.scale > canvas.height + 60) {
        enemies.splice(i, 1);
        continue;
      }

      // Collision check
      if (checkCollision(player, e)) {
        endGame();
        return;
      }

      // Near miss → shake
      if (!gameOver) {
        const dx = Math.abs(e.x - player.x);
        const dy = Math.abs(e.y - player.y);
        const ew = e.w * e.scale;
        const eh = e.h * e.scale;
        if (dx < ew * 0.9 && dy < eh * 0.9 && dx > ew * 0.3) {
          triggerShake();
        }
      }
    }
  }

  /* ===========================
     COLLISION DETECTION
     =========================== */

  function checkCollision(p, e) {
    const pw = p.w * 0.5;
    const ph = p.h * 0.5;
    const ew = e.w * e.scale * 0.45;
    const eh = e.h * e.scale * 0.45;

    return (
      p.x - pw < e.x + ew &&
      p.x + pw > e.x - ew &&
      p.y - ph < e.y + eh &&
      p.y + ph > e.y - eh
    );
  }

  /* ===========================
     STARS (BACKGROUND)
     =========================== */

  function createStars() {
    stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.6 + 0.15,
        alpha: Math.random() * 0.6 + 0.2,
      });
    }
  }

  function drawStars(dt) {
    for (const s of stars) {
      s.y += s.speed * dt * 60;
      if (s.y > canvas.height + 4) {
        s.y = -4;
        s.x = Math.random() * canvas.width;
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ===========================
     EXPLOSION PARTICLES
     =========================== */

  function createExplosion(x, y) {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      const hue = mode === '500' ? (Math.random() * 40) : (180 + Math.random() * 40);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.01 + Math.random() * 0.02,
        r: Math.random() * 4 + 1,
        color: `hsl(${hue}, 100%, 60%)`,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.life -= p.decay * dt * 60;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ===========================
     SCREEN SHAKE
     =========================== */

  function triggerShake() {
    if (shakeTimer > 0) return;
    shakeTimer = 0.3;
    canvas.parentElement.classList.add('shake');
    setTimeout(() => canvas.parentElement.classList.remove('shake'), 300);
  }

  /* ===========================
     INPUT – KEYBOARD
     =========================== */

  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'Escape' && running && !gameOver) togglePause();
    if (e.key === ' ' && gameOver) startGame();
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  /* ===========================
     INPUT – TOUCH
     =========================== */

  let touchTarget = null;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchTarget = e.touches[0].clientX;
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    touchTarget = e.touches[0].clientX;
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    touchTarget = null;
  });

  // Mouse fallback for desktop testing
  let mouseDown = false;
  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    touchTarget = e.clientX;
  });
  canvas.addEventListener('mousemove', (e) => {
    if (mouseDown) touchTarget = e.clientX;
  });
  canvas.addEventListener('mouseup', () => {
    mouseDown = false;
    touchTarget = null;
  });

  /* ===========================
     SCORE & HIGHSCORE
     =========================== */

  function tickScore() {
    if (!running || paused || gameOver) return;
    score++;
    scoreEl.textContent = score;
    scoreTimer = setTimeout(tickScore, 1000);
  }

  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(LS_KEY, highScore);
    }
    highScoreEl.textContent = highScore;
  }

  /* ===========================
     GAME LIFECYCLE
     =========================== */

  function startGame() {
    resize();
    player = createPlayer();
    enemies = [];
    particles = [];
    score = 0;
    scoreEl.textContent = 0;
    running = true;
    paused = false;
    gameOver = false;
    shakeTimer = 0;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');

    createStars();
    clearTimeout(scoreTimer);
    clearInterval(spawnTimer);

    spawnInterval = cfg.spawnInterval;
    scheduleSpawn();
    tickScore();

    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  function scheduleSpawn() {
    clearInterval(spawnTimer);
    const interval = Math.max(300, spawnInterval - Math.floor(score / 10) * cfg.spawnRamp);
    spawnTimer = setInterval(spawnEnemy, interval);
  }

  function endGame() {
    gameOver = true;
    running = false;
    clearTimeout(scoreTimer);
    clearInterval(spawnTimer);

    createExplosion(player.x, player.y);
    saveHighScore();

    finalScoreEl.textContent = score;
    finalBestEl.textContent = highScore;

    setTimeout(() => {
      gameOverScreen.classList.remove('hidden');
    }, 600);
  }

  function togglePause() {
    if (gameOver) return;
    paused = !paused;
    if (paused) {
      pauseScreen.classList.remove('hidden');
      clearInterval(spawnTimer);
    } else {
      pauseScreen.classList.add('hidden');
      lastFrame = performance.now();
      scheduleSpawn();
      requestAnimationFrame(loop);
    }
  }

  /* ===========================
     MAIN GAME LOOP
     =========================== */

  function loop(now) {
    if (paused) return;

    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Stars
    drawStars(dt);

    if (!gameOver) {
      updatePlayer(dt);
      updateEnemies(dt);
    }

    // Draw enemies
    for (const e of enemies) drawEnemy(e);

    // Draw player (if alive or just died for explosion frame)
    if (!gameOver) drawPlayer(player);

    // Particles
    updateParticles(dt);
    drawParticles();

    if (shakeTimer > 0) shakeTimer -= dt;

    // Re-schedule spawner as difficulty increases
    if (!gameOver && score % 10 === 0 && score > 0) {
      scheduleSpawn();
    }

    if (running || particles.length > 0) {
      requestAnimationFrame(loop);
    }
  }

  /* ===========================
     INITIAL RENDER (stars on start screen)
     =========================== */

  createStars();
  (function idleLoop() {
    if (running) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars(0.016);
    requestAnimationFrame(idleLoop);
  })();

})();
