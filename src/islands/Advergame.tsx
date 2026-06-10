import { createSignal, Show, onMount, onCleanup } from 'solid-js';
import { applyGameCoupon } from '@/store/cartStore';

interface Platform {
  x: number; y: number; w: number; h: number;
}

interface Coin {
  x: number; y: number; r: number; collected: boolean;
}

interface Player {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number; onGround: boolean;
}

type Phase = 'playing' | 'won' | 'lost';

const W = 500;
const H = 420;
const GRAVITY = 0.55;
const JUMP_VEL = -9;
const MOVE_SPEED = 4.5;
const WIN_SCORE = 10;
const PLAYER_W = 20;
const PLAYER_H = 32;

const PLATFORMS: Platform[] = [
  { x: 0,    y: H - 20, w: W,      h: 20 },
  { x: 50,   y: 330,    w: 100,    h: 14 },
  { x: 200,  y: 280,    w: 120,    h: 14 },
  { x: 370,  y: 320,    w: 110,    h: 14 },
  { x: 80,   y: 220,    w: 100,    h: 14 },
  { x: 290,  y: 210,    w: 110,    h: 14 },
  { x: 420,  y: 250,    w: 80,     h: 14 },
  { x: 150,  y: 150,    w: 90,     h: 14 },
  { x: 340,  y: 130,    w: 90,     h: 14 },
];

const COIN_SPAWNS: { x: number; y: number }[] = [
  { x: 90,   y: 310 }, { x: 120,  y: 310 },
  { x: 230,  y: 260 }, { x: 260,  y: 260 }, { x: 290, y: 260 },
  { x: 410,  y: 300 }, { x: 440,  y: 300 },
  { x: 120,  y: 200 }, { x: 150,  y: 200 },
  { x: 330,  y: 190 }, { x: 360,  y: 190 },
  { x: 445,  y: 230 }, { x: 460,  y: 230 },
  { x: 180,  y: 130 }, { x: 210,  y: 130 },
  { x: 370,  y: 110 }, { x: 395,  y: 110 },
  { x: 30,   y: 370 }, { x: 250,  y: 370 }, { x: 480, y: 370 },
];

function rectsOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function drawLightning(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, fill: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(10, -4);
  ctx.lineTo(6, 0);
  ctx.lineTo(4, 0);
  ctx.lineTo(10, 8);
  ctx.lineTo(-4, 16);
  ctx.lineTo(-10, 4);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, -8);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform) {
  const g = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
  g.addColorStop(0, '#6B1D20');
  g.addColorStop(1, '#3A0A0C');
  ctx.fillStyle = g;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.fillStyle = 'rgba(255,215,0,0.12)';
  ctx.fillRect(p.x, p.y, p.w, 2);
}

function drawCoin(ctx: CanvasRenderingContext2D, c: Coin, t: number) {
  if (c.collected) return;
  const bob = Math.sin(t * 0.004 + c.x) * 2;
  ctx.save();
  ctx.translate(c.x, c.y + bob);
  const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, c.r);
  g.addColorStop(0, '#FFE066');
  g.addColorStop(0.6, '#FFC107');
  g.addColorStop(1, '#E6A800');
  ctx.beginPath();
  ctx.arc(0, 0, c.r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#7B1113';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', 0, 0);
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#140726');
  g.addColorStop(0.35, '#3D0F1A');
  g.addColorStop(0.65, '#6B1414');
  g.addColorStop(1, '#7B1113');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 25; i++) {
    const sx = (i * 139 + 47) % W;
    const sy = (i * 91 + 23) % (H * 0.55);
    const sr = 0.4 + (i % 3) * 0.4;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function Advergame() {
  let canvas: HTMLCanvasElement | undefined;
  const [score, setScore] = createSignal(0);
  const [phase, setPhase] = createSignal<Phase>('playing');
  const [couponDone, setCouponDone] = createSignal(false);

  let rafId = 0;
  let lastTime = 0;
  let keys = { left: false, right: false, jump: false };
  let jumpLock = false;

  let coins: Coin[] = COIN_SPAWNS.map((p) => ({ ...p, r: 8, collected: false }));
  let player: Player = {
    x: 50, y: H - 100, w: PLAYER_W, h: PLAYER_H,
    vx: 0, vy: 0, onGround: false,
  };

  function resetGame() {
    coins = COIN_SPAWNS.map((p) => ({ ...p, r: 8, collected: false }));
    player = { x: 50, y: H - 100, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, onGround: false };
    setScore(0);
    setPhase('playing');
    setCouponDone(false);
    keys = { left: false, right: false, jump: false };
  }

  function tick() {
    if (phase() !== 'playing') return;

    if (keys.left) player.vx = -MOVE_SPEED;
    else if (keys.right) player.vx = MOVE_SPEED;
    else player.vx *= 0.7;

    if (keys.jump && player.onGround) {
      player.vy = JUMP_VEL;
      player.onGround = false;
    }

    player.vy += GRAVITY;
    if (player.vy > 12) player.vy = 12;

    player.x += player.vx;
    for (const p of PLATFORMS) {
      if (rectsOverlap(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h)) {
        if (player.vx > 0) { player.x = p.x - player.w; }
        else if (player.vx < 0) { player.x = p.x + p.w; }
        player.vx = 0;
      }
    }
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > W) { player.x = W - player.w; player.vx = 0; }

    player.y += player.vy;
    player.onGround = false;
    for (const p of PLATFORMS) {
      if (rectsOverlap(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h)) {
        if (player.vy > 0) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else if (player.vy < 0) {
          player.y = p.y + p.h;
          player.vy = 0;
        }
      }
    }

    for (const c of coins) {
      if (c.collected) continue;
      const dx = player.x + player.w / 2 - c.x;
      const dy = player.y + player.h / 2 - c.y;
      if (dx * dx + dy * dy < (c.r + 14) * (c.r + 14)) {
        c.collected = true;
        const s = score() + 1;
        setScore(s);
        if (s >= WIN_SCORE) {
          if (!couponDone()) {
            applyGameCoupon();
            setCouponDone(true);
          }
          setPhase('won');
          keys = { left: false, right: false, jump: false };
        }
      }
    }

    if (player.y > H + 60) setPhase('lost');
  }

  function draw(time: number) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    drawBackground(ctx);
    for (const p of PLATFORMS) drawPlatform(ctx, p);
    for (const c of coins) drawCoin(ctx, c, time);

    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 22;
    drawLightning(ctx, cx, cy, 1.1, 'rgba(255,215,0,0.25)');
    ctx.restore();
    drawLightning(ctx, cx, cy, 1, '#FFD700');
  }

  function loop(time: number) {
    const dt = time - lastTime;
    if (dt > 100) { lastTime = time; rafId = requestAnimationFrame(loop); return; }
    lastTime = time;
    tick();
    draw(time);
    rafId = requestAnimationFrame(loop);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (phase() !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
      e.preventDefault();
      if (!jumpLock) { keys.jump = true; jumpLock = true; }
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') { keys.jump = false; jumpLock = false; }
  }

  function onTouchStart(e: TouchEvent) {
    if (phase() !== 'playing' || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    if (!t) return;
    const tx = t.clientX - rect.left;
    const ty = t.clientY - rect.top;
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const gx = tx * scaleX;
    const gy = ty * scaleY;
    if (gy < H * 0.45) {
      keys.jump = true;
    } else if (gx < W * 0.5) {
      keys.left = true;
      keys.right = false;
    } else {
      keys.right = true;
      keys.left = false;
    }
  }

  function onTouchEnd(e: TouchEvent) {
    e.preventDefault();
    keys.left = false;
    keys.right = false;
    keys.jump = false;
  }

  onMount(() => {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    rafId = requestAnimationFrame(loop);
  });

  onCleanup(() => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    cancelAnimationFrame(rafId);
  });

  return (
    <div class="relative w-full max-w-[500px] mx-auto select-none" role="application" aria-label="Puka Power Advergame">
      <canvas
        ref={canvas}
        width={W}
        height={H}
        class="w-full h-auto rounded-2xl shadow-2xl shadow-brand-dark/30 touch-none cursor-pointer"
        ontouchstart={onTouchStart}
        ontouchend={onTouchEnd}
      />

      <div class="absolute top-3 left-3 flex items-center space-x-2 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-yellow-500/20 pointer-events-none">
        <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <span class="text-yellow-400 font-bold text-sm font-mono tracking-wider">{score()} / {WIN_SCORE}</span>
      </div>

      <div class="absolute top-3 right-3 flex items-center space-x-1.5 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/10 pointer-events-none">
        <svg class="w-3 h-3 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <span class="text-white/60 text-[10px] font-bold uppercase tracking-wider">Toca / Flechas</span>
      </div>

      <Show when={phase() === 'won'}>
        <div class="absolute inset-0 bg-brand-dark/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 space-y-5">
          <div class="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center animate-bounce">
            <svg class="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div class="text-center space-y-1">
            <h3 class="font-serif text-3xl font-black text-yellow-400">¡Ganaste!</h3>
            <p class="text-yellow-200/80 text-sm font-medium">
              Desbloqueaste tu <strong class="text-white">BOLT15</strong> — 15% de descuento
            </p>
          </div>
          <div class="w-full max-w-[220px] space-y-2.5 pt-2">
            <a
              href="/tienda"
              class="block w-full py-3.5 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-bold text-xs uppercase tracking-widest rounded-xl text-center transition-all duration-300 shadow-lg shadow-brand-accent/30"
            >
              Canjear descuento ahora
            </a>
            <button
              onClick={resetGame}
              class="block w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300"
            >
              Jugar de nuevo
            </button>
          </div>
        </div>
      </Show>

      <Show when={phase() === 'lost'}>
        <div class="absolute inset-0 bg-brand-dark/85 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 space-y-5">
          <div class="w-16 h-16 bg-brand-accent/20 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="text-center space-y-1">
            <h3 class="font-serif text-3xl font-black text-brand-light">¡Fallaste!</h3>
            <p class="text-brand-light/70 text-sm">
              Necesitas {WIN_SCORE} monedas para ganar el descuento. ¡Intenta de nuevo!
            </p>
          </div>
          <div class="w-full max-w-[220px] space-y-2.5 pt-2">
            <button
              onClick={resetGame}
              class="block w-full py-3.5 bg-brand-accent hover:bg-brand-accentGold text-brand-light font-bold text-xs uppercase tracking-widest rounded-xl transition-all duration-300 shadow-lg shadow-brand-accent/30"
            >
              Reintentar
            </button>
            <a
              href="/tienda"
              class="block w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-widest rounded-xl text-center transition-all duration-300"
            >
              Ir a la tienda
            </a>
          </div>
        </div>
      </Show>

      <div class="mt-3 flex justify-center space-x-4 text-[10px] text-brand-dark/50 font-bold uppercase tracking-wider">
        <span class="flex items-center space-x-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
          <span>Mover</span>
        </span>
        <span class="flex items-center space-x-1">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
          </svg>
          <span>Saltar</span>
        </span>
        <span class="flex items-center space-x-1">
          <svg class="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span>{WIN_SCORE} = Descuento</span>
        </span>
      </div>
    </div>
  );
}
