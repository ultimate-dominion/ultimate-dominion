import { bodyGradHueShift, fillCircle, fillEllipse } from './helpers.js';
import { renderAscii } from './ascii-renderer.js';
import { drawCleanCreature, direRatSkeleton } from './skeleton.js';

// ==========================================================================
// Battle Scene Prototype
// Monster on the right, weapon attacks from the left
// ==========================================================================

const canvas = document.getElementById('battle');
const ctx = canvas.getContext('2d');
const cleanHelpers = { bodyGradHueShift, fillCircle, fillEllipse };

// -- Battle state --
const MONSTER_MAX_HP = 9;
let monsterHp = MONSTER_MAX_HP;
let animating = false;

// Active animations
const animations = [];

// -- Monster rendering state --
let monsterOffsetX = 0;   // recoil offset
let monsterFlash = 0;     // 0-1, white flash on hit
let monsterShake = 0;     // shake intensity

// -- Resize --
function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

// -- Weapon definitions --
const WEAPONS = {
  sword: {
    name: 'Warhammer',
    damage: [2, 4],
    speed: 600,       // ms for full animation
    draw(ctx, x, y, w, h, progress) {
      // Heavy warhammer head flying from left
      const headW = w * 0.06;
      const headH = w * 0.03;
      const handleLen = w * 0.08;
      // Rotation on approach
      const rot = progress * Math.PI * 2.5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      // Handle
      ctx.strokeStyle = 'rgb(140,100,60)';
      ctx.lineWidth = w * 0.008;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-handleLen, 0);
      ctx.stroke();
      // Head
      ctx.fillStyle = 'rgb(160,160,170)';
      ctx.fillRect(-headW / 2, -headH, headW, headH * 2);
      // Edge highlight
      ctx.fillStyle = 'rgb(200,200,210)';
      ctx.fillRect(-headW / 2, -headH, headW * 0.3, headH * 2);
      ctx.restore();
    },
  },
  bow: {
    name: 'Darkwood Bow',
    damage: [1, 3],
    speed: 400,
    draw(ctx, x, y, w, h, progress) {
      // Arrow projectile
      const arrowLen = w * 0.07;
      ctx.save();
      ctx.translate(x, y);
      // Shaft
      ctx.strokeStyle = 'rgb(160,130,80)';
      ctx.lineWidth = w * 0.004;
      ctx.beginPath();
      ctx.moveTo(-arrowLen, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = 'rgb(180,180,190)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-w * 0.015, -w * 0.008);
      ctx.lineTo(-w * 0.015, w * 0.008);
      ctx.closePath();
      ctx.fill();
      // Fletching
      ctx.fillStyle = 'rgb(140,60,50)';
      ctx.beginPath();
      ctx.moveTo(-arrowLen, 0);
      ctx.lineTo(-arrowLen + w * 0.012, -w * 0.006);
      ctx.lineTo(-arrowLen + w * 0.012, w * 0.006);
      ctx.closePath();
      ctx.fill();
      // Motion trail
      ctx.strokeStyle = `rgba(200,180,140,${0.3 * (1 - progress)})`;
      ctx.lineWidth = w * 0.002;
      ctx.beginPath();
      ctx.moveTo(-arrowLen, 0);
      ctx.lineTo(-arrowLen - w * 0.15, 0);
      ctx.stroke();
      ctx.restore();
    },
  },
  spell: {
    name: 'Fire Bolt',
    damage: [2, 5],
    speed: 500,
    draw(ctx, x, y, w, h, progress) {
      // Glowing fire bolt
      const pulseR = w * 0.015 + Math.sin(progress * 20) * w * 0.003;
      // Outer glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, pulseR * 3);
      grd.addColorStop(0, 'rgba(255,120,20,0.6)');
      grd.addColorStop(0.5, 'rgba(255,60,10,0.2)');
      grd.addColorStop(1, 'rgba(255,30,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, pulseR * 3, 0, Math.PI * 2);
      ctx.fill();
      // Core
      ctx.fillStyle = 'rgb(255,220,120)';
      ctx.beginPath();
      ctx.arc(x, y, pulseR, 0, Math.PI * 2);
      ctx.fill();
      // Trail particles
      for (let i = 0; i < 5; i++) {
        const tx = x - w * 0.01 * (i + 1) + (Math.random() - 0.5) * w * 0.01;
        const ty = y + (Math.random() - 0.5) * w * 0.015;
        const tr = pulseR * (0.6 - i * 0.1);
        ctx.fillStyle = `rgba(255,${100 - i * 15},${20 - i * 4},${0.5 - i * 0.1})`;
        ctx.beginPath();
        ctx.arc(tx, ty, Math.max(1, tr), 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
};

// -- Impact effect --
function drawImpact(ctx, x, y, w, progress) {
  if (progress > 1) return;
  const alpha = 1 - progress;
  const radius = w * 0.04 * (0.5 + progress * 1.5);
  // Radial burst
  ctx.save();
  ctx.globalAlpha = alpha * 0.7;
  const grd = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grd.addColorStop(0, 'rgb(255,230,180)');
  grd.addColorStop(0.4, 'rgb(255,160,60)');
  grd.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  // Spark lines
  ctx.strokeStyle = `rgba(255,200,100,${alpha * 0.8})`;
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + progress * 0.5;
    const len = radius * (0.8 + progress * 0.6);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 0.3, y + Math.sin(angle) * radius * 0.3);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

// -- Attack animation --
function startAttack(weaponKey) {
  if (monsterHp <= 0) return;
  const weapon = WEAPONS[weaponKey];
  const damage = weapon.damage[0] + Math.floor(Math.random() * (weapon.damage[1] - weapon.damage[0] + 1));

  animations.push({
    type: 'attack',
    weapon: weaponKey,
    startTime: performance.now(),
    duration: weapon.speed,
    damage,
  });

  // Disable buttons during animation
  setButtonsDisabled(true);
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll('.attack-btn').forEach(b => b.disabled = disabled);
}

function addLog(msg, cls = 'hit') {
  const log = document.getElementById('log');
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = msg;
  log.prepend(div);
  // Keep max 20
  while (log.children.length > 20) log.removeChild(log.lastChild);
}

function showDamageFloat(damage, x, y) {
  const el = document.createElement('div');
  el.className = 'damage-float';
  el.textContent = `-${damage}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.querySelector('.scene').appendChild(el);
  // Animate up and fade
  let t = 0;
  const startY = y;
  function tick() {
    t += 16;
    const progress = t / 800;
    el.style.top = `${startY - progress * 60}px`;
    el.style.opacity = `${1 - progress}`;
    if (progress < 1) requestAnimationFrame(tick);
    else el.remove();
  }
  requestAnimationFrame(tick);
}

function updateHpBar() {
  const pct = Math.max(0, monsterHp / MONSTER_MAX_HP * 100);
  document.getElementById('hp-fill').style.width = `${pct}%`;
  document.getElementById('hp-text').textContent = `${Math.max(0, monsterHp)} / ${MONSTER_MAX_HP}`;
  if (monsterHp <= 0) {
    document.getElementById('monster-name').textContent = 'Dire Rat (defeated)';
    document.getElementById('monster-name').style.color = '#804040';
  }
}

// -- Main render loop --
function renderFrame(timestamp) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  // Process animations
  let activeAttack = null;
  for (let i = animations.length - 1; i >= 0; i--) {
    const anim = animations[i];
    const elapsed = timestamp - anim.startTime;
    const progress = elapsed / anim.duration;

    if (anim.type === 'attack') {
      if (progress < 1) {
        activeAttack = { ...anim, progress };
      } else if (!anim.impacted) {
        // Impact moment
        anim.impacted = true;
        monsterHp = Math.max(0, monsterHp - anim.damage);
        updateHpBar();
        monsterOffsetX = w * 0.03;
        monsterFlash = 1;
        monsterShake = 1;
        addLog(`${WEAPONS[anim.weapon].name} hits Dire Rat for ${anim.damage} damage!`);
        showDamageFloat(anim.damage, w * 0.65, h * 0.3);
        // Start impact animation
        animations.push({
          type: 'impact',
          startTime: timestamp,
          duration: 400,
          x: w * 0.55,
          y: h * 0.45,
        });
        // Start recoil recovery
        animations.push({
          type: 'recoil',
          startTime: timestamp,
          duration: 500,
        });
      }
      if (progress > 1.2) {
        animations.splice(i, 1);
        setButtonsDisabled(monsterHp <= 0);
      }
    } else if (anim.type === 'recoil') {
      const rProgress = elapsed / anim.duration;
      if (rProgress < 1) {
        // Ease out recoil
        monsterOffsetX = w * 0.03 * (1 - easeOutCubic(rProgress));
        monsterShake = (1 - rProgress) * 0.5;
        monsterFlash = Math.max(0, 1 - rProgress * 3);
      } else {
        monsterOffsetX = 0;
        monsterShake = 0;
        monsterFlash = 0;
        animations.splice(i, 1);
      }
    } else if (anim.type === 'impact') {
      if (elapsed > anim.duration) {
        animations.splice(i, 1);
      }
    }
  }

  // -- Render monster on right half via ASCII --
  ctx.save();
  // Apply recoil + shake
  const shakeX = monsterShake * (Math.random() - 0.5) * w * 0.01;
  const shakeY = monsterShake * (Math.random() - 0.5) * h * 0.01;
  ctx.translate(monsterOffsetX + shakeX, shakeY);

  // Monster area: right 60% of canvas (give weapon room to fly in)
  const monsterX = w * 0.35;
  const monsterW = w * 0.65;
  const monsterH = h;

  renderAscii(ctx, (tctx, tw, th) => {
    drawCleanCreature(tctx, direRatSkeleton, tw, th, cleanHelpers);
  }, monsterX, 0, monsterW, monsterH, {
    elapsed: monsterHp <= 0 ? 0 : timestamp,
    cellSize: 5,
    gridWidth: 14,
    gridHeight: 8,
  });

  // White flash overlay on hit
  if (monsterFlash > 0) {
    ctx.save();
    ctx.globalAlpha = monsterFlash * 0.3;
    ctx.fillStyle = '#fff';
    ctx.fillRect(monsterX, 0, monsterW, monsterH);
    ctx.restore();
  }

  // Defeated overlay
  if (monsterHp <= 0) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000';
    ctx.fillRect(monsterX, 0, monsterW, monsterH);
    ctx.restore();
  }

  ctx.restore();

  // -- Render weapon projectile --
  if (activeAttack) {
    const weapon = WEAPONS[activeAttack.weapon];
    const p = activeAttack.progress;
    // Fly from left edge to monster center
    const startX = w * 0.05;
    const endX = w * 0.55;
    const startY = h * 0.45;
    const endY = h * 0.50;
    // Ease-in curve for acceleration feel
    const t = easeInQuad(p);
    const projX = startX + (endX - startX) * t;
    const projY = startY + (endY - startY) * t;
    weapon.draw(ctx, projX, projY, w, h, p);
  }

  // -- Render impact effects --
  for (const anim of animations) {
    if (anim.type === 'impact') {
      const p = (timestamp - anim.startTime) / anim.duration;
      drawImpact(ctx, anim.x + monsterOffsetX, anim.y, w, p);
    }
  }

  // -- Left side: subtle vignette suggesting player presence --
  const vigGrd = ctx.createLinearGradient(0, 0, w * 0.3, 0);
  vigGrd.addColorStop(0, 'rgba(10,10,8,0.7)');
  vigGrd.addColorStop(1, 'rgba(10,10,8,0)');
  ctx.fillStyle = vigGrd;
  ctx.fillRect(0, 0, w * 0.3, h);

  requestAnimationFrame(renderFrame);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInQuad(t) { return t * t; }

// -- Wire up buttons --
document.querySelectorAll('.attack-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    startAttack(btn.dataset.weapon);
  });
});

// -- Start --
requestAnimationFrame(renderFrame);
