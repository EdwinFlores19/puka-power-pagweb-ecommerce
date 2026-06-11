import { createSignal, Switch, Match, Show, onMount, onCleanup } from 'solid-js';
import { applyGameCoupon } from '@/store/cartStore';

function dl(...args: unknown[]) {
  if (typeof window !== 'undefined' && Array.isArray((window as Record<string, unknown>).dataLayer)) {
    ((window as Record<string, unknown>).dataLayer as unknown[]).push(...args);
  }
}

const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const BASE_SPEED = 6;
const TIME_LIMIT = 150;
const COST_PUKA = 5;
const COST_GENERIC = 6;

const APP_STATE = { MENU_GENDER: 0, MENU_LEVEL: 1, PLAYING: 2, GAME_OVER: 3, VICTORY: 4 } as const;

const ENTITY = {
  PLATFORM: 0, COIN: 1, VENDING_GENERIC: 2, VENDING_PUKA: 3, ENEMY: 4, GOAL: 5, SUPER_FRUIT: 6,
  SURPRISE_BLOCK: 7, STATIC_BLOCK: 8, DYNAMIC_REWARD: 9,
} as const;

const PLAYER_STATE = { NORMAL: 'NORMAL', GENERIC_RUSH: 'GENERIC_RUSH', TACHYCARDIA: 'TACHYCARDIA', PUKA_OVERDRIVE: 'PUKA_OVERDRIVE' } as const;

const THEMES = {
  GOH_RONG: {
    id: 'GOH_RONG', name: 'El Restaurante Goh-Rong', difficulty: 'Nivel 1 — Fácil',
    bg: '#1A080A', platformTop: '#7B1113', platformBottom: '#3A0003', accent: '#FFD700',
    goalEmoji: '🏮', enemies: ['🥟', '🥠'],
  },
  BAMBOO_FOREST: {
    id: 'BAMBOO_FOREST', name: 'El Bosque de Bambú Místico', difficulty: 'Nivel 2 — Intermedio',
    bg: '#0B1A12', platformTop: '#1E4620', platformBottom: '#0A1D0D', accent: '#A3E635',
    goalEmoji: '🎋', enemies: ['🐼', '🐍'],
  },
  TURTLE_MOUNTAIN: {
    id: 'TURTLE_MOUNTAIN', name: 'La Montaña de la Tortuga Sagrada', difficulty: 'Nivel 3 — Experto Ninja',
    bg: '#0F172A', platformTop: '#E2E8F0', platformBottom: '#334155', accent: '#38BDF8',
    goalEmoji: '🏯', enemies: ['🐺', '🦉'],
  },
} as const;

type GenderId = 'BOY' | 'GIRL' | 'MAN' | 'WOMAN';
type ThemeId = 'GOH_RONG' | 'BAMBOO_FOREST' | 'TURTLE_MOUNTAIN';

const GENDERS: Record<GenderId, { id: GenderId; name: string; idle: string; run: string }> = {
  BOY: { id: 'BOY', name: 'Niño', idle: '🧍', run: '🏃' },
  GIRL: { id: 'GIRL', name: 'Niña', idle: '🧍', run: '🏃' },
  MAN: { id: 'MAN', name: 'Hombre', idle: '🧍‍♂️', run: '🏃‍♂️' },
  WOMAN: { id: 'WOMAN', name: 'Mujer', idle: '🧍‍♀️', run: '🏃‍♀️' },
};

class SoundEngine {
  ctx: AudioContext | null;
  constructor() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      this.ctx = null;
    }
  }
  playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio fail-safe: ignore playback errors
    }
  }
  jump() { this.playTone(300, 'sine', 0.1, 0.05); setTimeout(() => this.playTone(500, 'sine', 0.2, 0.05), 50); }
  coin() { this.playTone(1200, 'square', 0.1, 0.05); }
  stomp() { this.playTone(150, 'square', 0.15, 0.1); }
  hurt() { this.playTone(100, 'sawtooth', 0.3, 0.2); }
  powerup() { this.playTone(400, 'sine', 0.1, 0.1); setTimeout(() => this.playTone(800, 'sine', 0.3, 0.1), 100); }
  gameover() { this.playTone(200, 'sawtooth', 0.5, 0.2); setTimeout(() => this.playTone(100, 'sawtooth', 1, 0.2), 300); }
  victory() {
    this.playTone(500, 'square', 0.2, 0.1);
    setTimeout(() => this.playTone(700, 'square', 0.2, 0.1), 200);
    setTimeout(() => this.playTone(1000, 'square', 0.5, 0.1), 400);
  }
}

interface Entity { type: number; x: number; y: number; width: number; height: number; active?: boolean; vx?: number; vy?: number; startX?: number; range?: number; emoji?: string; isHit?: boolean; reward?: string; rewardType?: string; coinScale?: number; }
interface GhostPos { x: number; y: number; alpha: number; }
interface Player { x: number; y: number; vx: number; vy: number; width: number; height: number; grounded: boolean; state: string; stateTimer: number; facingLeft: boolean; isDead: boolean; isGiant: boolean; hasPet: boolean; canDoubleJump: boolean; idleTimer: number; lastSafeX: number; lastSafeY: number; jumpTimer: number; justLanded: boolean; squashX: number; squashY: number; ghosts: GhostPos[]; sugarCrashTimer: number; }
interface Keys { left: boolean; right: boolean; up: boolean; upJustPressed: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; alpha: number; size: number; }
interface EnvParticle { x: number; y: number; vx: number; vy: number; size: number; rotation: number; rotationSpeed: number; alpha: number; }

export default function Advergame() {
  const [appState, setAppState] = createSignal<number>(APP_STATE.MENU_GENDER);
  const [selection, setSelection] = createSignal<{ gender: GenderId | null; theme: ThemeId | null }>({ gender: null, theme: null });
  const [uiState, setUiState] = createSignal<{ coins: number; timeLeft: number; message: string; messageType: string; playerState: string; lives: number }>({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: 3 });
  const [couponDone, setCouponDone] = createSignal(false);
  const [showTutorial, setShowTutorial] = createSignal(true);

  const getCameraOffset = () => (typeof window !== 'undefined' && window.innerWidth > 768 ? 400 : 150);

  let engineState: {
    keys: Keys; camera: { x: number; y: number };
    player: Player; entities: Entity[]; particles: Particle[]; envParticles: EnvParticle[];
    score: number; lives: number; startTime: number;
    viewport: { width: number; height: number };
    shakeTimer: number; shakeIntensity: number; hitstopFrames: number;
  } = {} as any;
  let audioInst: SoundEngine | null = null;
  let rafId = 0;
  let lastFrameUpdate = 0;
  let canvasEl: HTMLCanvasElement | undefined;
  let containerEl: HTMLDivElement | undefined;

  function resetEngine() {
    engineState = {
      keys: { left: false, right: false, up: false, upJustPressed: false },
      camera: { x: 0, y: 0 },
      player: {
        x: 100, y: 100, vx: 0, vy: 0, width: 40, height: 60,
        grounded: false, state: PLAYER_STATE.NORMAL, stateTimer: 0,
        facingLeft: false, isDead: false, isGiant: false, hasPet: false,
        canDoubleJump: false, idleTimer: 0, lastSafeX: 100, lastSafeY: 100,
        jumpTimer: 0, justLanded: false, squashX: 1, squashY: 1,
        ghosts: [], sugarCrashTimer: 0,
      },
      entities: [], particles: [], envParticles: [], score: 0, lives: 3, startTime: 0,
      viewport: { width: 800, height: 600 },
      shakeTimer: 0, shakeIntensity: 0, hitstopFrames: 0,
    };
    setCouponDone(false);
  }

  function triggerShake(intensity = 8, duration = 150) {
    engineState.shakeIntensity = intensity;
    engineState.shakeTimer = duration;
  }

  function triggerHitstop(frames = 2) {
    engineState.hitstopFrames = frames;
  }

  function generateLevel(theme: typeof THEMES[keyof typeof THEMES]) {
    const s = engineState;
    s.entities = []; s.score = 0; s.lives = 3;
    s.player = { ...s.player, x: 100, y: 100, vx: 0, vy: 0, state: PLAYER_STATE.NORMAL, isDead: false, isGiant: false, hasPet: false, canDoubleJump: false, width: 40, height: 60, idleTimer: 0, lastSafeX: 100, lastSafeY: 100, jumpTimer: 0, justLanded: false, squashX: 1, squashY: 1, ghosts: [], sugarCrashTimer: 0 };
    s.camera.x = 0;
    let curX = 0;
    let petSpawned = false;
    const groundY = 500;
    const addPlat = (x: number, w: number, y = groundY, h = 800) => s.entities.push({ type: ENTITY.PLATFORM, x, y, width: w, height: h });
    addPlat(0, 800); curX = 800;

    for (let i = 0; i < 30; i++) {
      const p = i % 5;
      if (p === 0) {
        curX += 180; addPlat(curX, 500); addPlat(curX + 100, 200, groundY - 150, 20);
        const isPetBox = !petSpawned && i > 3; if (isPetBox) petSpawned = true;
        s.entities.push({ type: ENTITY.SURPRISE_BLOCK, x: curX + 180, y: groundY - 300, width: 40, height: 40, isHit: false, reward: isPetBox ? 'PET' : 'PUKA' });
        s.entities.push({ type: ENTITY.SURPRISE_BLOCK, x: curX + 220, y: groundY - 300, width: 40, height: 40, isHit: false, reward: 'COIN' });
        curX += 500;
      } else if (p === 1) {
        curX += 150; addPlat(curX, 600);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3 - r; c++) s.entities.push({ type: ENTITY.STATIC_BLOCK, x: curX + 200 + c * 40 + r * 20, y: groundY - 40 - r * 40, width: 40, height: 40 });
        curX += 600;
      } else if (p === 2) {
        curX += 100; addPlat(curX, 800); addPlat(curX + 200, 150, groundY - 120, 20);
        s.entities.push({ type: ENTITY.COIN, x: curX + 260, y: groundY - 160, width: 30, height: 30, active: true, coinScale: 1 });
        const ee = theme.enemies[Math.floor(Math.random() * theme.enemies.length)];
        s.entities.push({ type: ENTITY.ENEMY, x: curX + 400, y: groundY - 40, width: 40, height: 40, vx: -2, startX: curX + 300, range: 300, emoji: ee, active: true });
        curX += 800;
      } else if (p === 3) {
        curX += 180; addPlat(curX, 800);
        s.entities.push({ type: ENTITY.VENDING_GENERIC, x: curX + 200, y: groundY - 100, width: 80, height: 100, active: true });
        s.entities.push({ type: ENTITY.VENDING_PUKA, x: curX + 500, y: groundY - 100, width: 80, height: 100, active: true });
        curX += 800;
      } else {
        curX += 150; addPlat(curX, 600);
        s.entities.push({ type: ENTITY.SUPER_FRUIT, x: curX + 250, y: groundY - 60, width: 40, height: 40, active: true });
        s.entities.push({ type: ENTITY.SURPRISE_BLOCK, x: curX + 350, y: groundY - 200, width: 40, height: 40, isHit: false, reward: 'PUKA' });
        curX += 600;
      }
    }
    curX += 150; addPlat(curX, 1000);
    s.entities.push({ type: ENTITY.GOAL, x: curX + 400, y: groundY - 150, width: 150, height: 150 });
    s.startTime = Date.now();
    s.envParticles = [];
    for (let i = 0; i < 40; i++) {
      if (theme.id === 'GOH_RONG') {
        s.envParticles.push({ x: Math.random() * (curX + 1000), y: 480 + Math.random() * 120, vx: (Math.random() - 0.5) * 0.3, vy: -0.3 - Math.random() * 0.4, size: 2 + Math.random() * 5, rotation: 0, rotationSpeed: 0, alpha: 0.05 + Math.random() * 0.04 });
      } else if (theme.id === 'BAMBOO_FOREST') {
        s.envParticles.push({ x: Math.random() * (curX + 1000), y: Math.random() * 600, vx: -0.4 - Math.random() * 0.6, vy: 0.2 + Math.random() * 0.3, size: 3 + Math.random() * 4, rotation: Math.random() * Math.PI * 2, rotationSpeed: 0.02 + Math.random() * 0.03, alpha: 0.25 + Math.random() * 0.25 });
      } else {
        s.envParticles.push({ x: Math.random() * (curX + 1000), y: Math.random() * 600, vx: -1.2 - Math.random() * 0.8, vy: 0.1 + Math.random() * 0.2, size: 1 + Math.random() * 3, rotation: 0, rotationSpeed: 0, alpha: 0.4 + Math.random() * 0.3 });
      }
    }
  }

  function spawnParticle(x: number, y: number, color: string, amount = 5, isPuka = false) {
    for (let i = 0; i < amount; i++) {
      engineState.particles.push({
        x: x + 20, y: y + 30,
        vx: (Math.random() - 0.5) * (isPuka ? 10 : 5),
        vy: (Math.random() - 0.5) * (isPuka ? 10 : 5),
        life: isPuka ? 800 : 400, maxLife: isPuka ? 800 : 400,
        color, alpha: 1, size: isPuka ? Math.random() * 8 + 4 : Math.random() * 5 + 2,
      });
    }
  }

  function spawnDynamicReward(x: number, y: number, rewardType: string) {
    engineState.entities.push({ type: ENTITY.DYNAMIC_REWARD, rewardType, x: x + 5, y: y - 40, width: 30, height: 30, vx: 0, vy: -6, active: true });
  }

  function startGame(themeId: ThemeId) {
    if (!audioInst) { audioInst = new SoundEngine(); }
    resetEngine();
    setSelection((prev) => ({ ...prev, theme: themeId }));
    setAppState(APP_STATE.PLAYING);
    generateLevel(THEMES[themeId]);
    setUiState({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: 3 });
    lastFrameUpdate = 0;
    dl({ event: 'puka_game_start', character: selection().gender, level: themeId });
  }

  function gameLoop(time: number) {
    if (appState() !== APP_STATE.PLAYING) { rafId = requestAnimationFrame(gameLoop); return; }
    const s = engineState;
    const p = s.player;
    const k = s.keys;
    const cam = s.camera;
    const vp = s.viewport;
    if (vp.width <= 0 || vp.height <= 0) { rafId = requestAnimationFrame(gameLoop); return; }
    const theme = THEMES[selection().theme!];

    if (s.hitstopFrames > 0) {
      s.hitstopFrames--;
    } else if (!showTutorial() && !s.player.isDead) {
      const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
      const timeLeft = TIME_LIMIT - elapsed;

      if (timeLeft <= 0 || p.y > 1500) {
        if (s.lives > 1) {
          s.lives--;
          p.x = p.lastSafeX || 100; p.y = (p.lastSafeY || 500) - 100;
          p.vx = 0; p.vy = 0;
          p.isGiant = false; p.hasPet = false; p.canDoubleJump = false;
          p.width = 40; p.height = 60; p.idleTimer = 0;
          if (timeLeft <= 0) s.startTime = Date.now();
          setUiState((prev) => ({ ...prev, lives: s.lives, message: '¡VIDA PERDIDA!', messageType: 'error' }));
          if (audioInst) audioInst.hurt();
          triggerShake(12, 200);
          triggerHitstop(3);
        } else {
          p.isDead = true;
          if (audioInst) audioInst.gameover();
          dl({ event: 'puka_game_over', coins: s.score, timeLeft });
          setAppState(APP_STATE.GAME_OVER);
          rafId = requestAnimationFrame(gameLoop);
          return;
        }
      }

      if (time - lastFrameUpdate > 100) {
        setUiState((prev) => ({ ...prev, timeLeft, coins: s.score, lives: s.lives }));
        lastFrameUpdate = time;
      }

      const wasGrounded = p.grounded;
      const isRunning = Math.abs(p.vx) > 0.5;
      if (isRunning || !p.grounded || k.left || k.right || k.up) p.idleTimer = 0;
      else p.idleTimer += 16.6;

      let currentSpeed = p.hasPet ? BASE_SPEED * 2.2 : BASE_SPEED;
      let jumpMult = 1;
      if (p.stateTimer > 0) p.stateTimer -= 16.6;
      if (p.sugarCrashTimer > 0) p.sugarCrashTimer -= 16.6;

      let currentSpeedMult = p.sugarCrashTimer > 0 ? 0.5 : 1;

      switch (p.state) {
        case PLAYER_STATE.GENERIC_RUSH:
          currentSpeed = Math.max(currentSpeed, BASE_SPEED * 1.6);
          if (Math.random() > 0.8) spawnParticle(p.x, p.y + 40, '#ffffff', 1);
          if (p.stateTimer <= 0) {
            p.state = PLAYER_STATE.TACHYCARDIA; p.stateTimer = 3000;
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.TACHYCARDIA, message: '¡TAQUICARDIA!', messageType: 'error' }));
            if (audioInst) audioInst.hurt();
            triggerShake(6, 200);
          }
          break;
        case PLAYER_STATE.TACHYCARDIA:
          currentSpeed = BASE_SPEED * 0.3;
          jumpMult = 0.5;
          p.x += (Math.random() - 0.5) * 4;
          if (p.stateTimer <= 0) {
            p.state = PLAYER_STATE.NORMAL;
            p.sugarCrashTimer = 3000;
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.NORMAL, message: '¡CRASH DE AZÚCAR!', messageType: 'warning' }));
          }
          break;
        case PLAYER_STATE.PUKA_OVERDRIVE:
          currentSpeed = BASE_SPEED * 2.2; jumpMult = 1.3;
          if (Math.random() > 0.5) spawnParticle(p.x, p.y + 40, '#ffd700', 2, true);
          if (Math.random() > 0.7) spawnParticle(p.x - 5, p.y + 20, '#ff4b4b', 1, true);
          if (p.stateTimer <= 0) {
            p.state = PLAYER_STATE.NORMAL;
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.NORMAL, message: 'ENERGÍA ESTABILIZADA', messageType: 'info' }));
          }
          break;
      }

      if (k.left && p.state !== PLAYER_STATE.TACHYCARDIA) { p.vx = -currentSpeed * currentSpeedMult; p.facingLeft = true; }
      else if (k.right && p.state !== PLAYER_STATE.TACHYCARDIA) { p.vx = currentSpeed * currentSpeedMult; p.facingLeft = false; }
      else p.vx *= 0.8;

      if (k.up && p.grounded && jumpMult > 0) {
        p.vy = JUMP_FORCE * jumpMult;
        p.grounded = false;
        p.canDoubleJump = p.hasPet;
        if (audioInst) audioInst.jump();
        spawnParticle(p.x, p.y + p.height, '#ccc', 10);
        k.upJustPressed = false;
        p.squashX = 0.85; p.squashY = 1.2;
      } else if (k.upJustPressed && !p.grounded && p.canDoubleJump && jumpMult > 0) {
        p.vy = JUMP_FORCE * jumpMult * 0.9;
        p.canDoubleJump = false;
        if (audioInst) audioInst.jump();
        spawnParticle(p.x, p.y + p.height, '#ff4b4b', 15);
        k.upJustPressed = false;
        p.squashX = 0.85; p.squashY = 1.2;
      }
      k.upJustPressed = false;

      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.grounded = false;

      if (!p.grounded) p.jumpTimer += 16.6;
      else p.jumpTimer = 0;

      p.squashX += (1 - p.squashX) * 0.3;
      p.squashY += (1 - p.squashY) * 0.3;

      if (p.state === PLAYER_STATE.PUKA_OVERDRIVE && Math.random() > 0.6) {
        p.ghosts.push({ x: p.x, y: p.y, alpha: 0.4 });
        if (p.ghosts.length > 5) p.ghosts.shift();
      }
      p.ghosts.forEach((g) => g.alpha -= 0.03);
      p.ghosts = p.ghosts.filter((g) => g.alpha > 0);

      s.entities.forEach((ent) => {
        if (ent.type === ENTITY.DYNAMIC_REWARD && ent.active) {
          ent.vy! += GRAVITY;
          ent.y += ent.vy!;
          s.entities.forEach((plat) => {
            if ((plat.type === ENTITY.PLATFORM || plat.type === ENTITY.STATIC_BLOCK || plat.type === ENTITY.SURPRISE_BLOCK) && ent.x < plat.x + plat.width && ent.x + ent.width > plat.x && ent.y < plat.y + plat.height && ent.y + ent.height > plat.y) {
              if (ent.vy! > 0 && ent.y + ent.height - ent.vy! <= plat.y + 15) { ent.y = plat.y - ent.height; ent.vy = 0; }
            }
          });
        }
      });

      s.entities.forEach((entity) => {
        if (entity.x < cam.x - 300 || entity.x > cam.x + vp.width + 300) return;

        if (entity.type === ENTITY.ENEMY && entity.active) {
          entity.x += entity.vx!;
          if (entity.x < entity.startX! || entity.x > entity.startX! + entity.range!) entity.vx! *= -1;
        }

        const isColliding = p.x < entity.x + entity.width && p.x + p.width > entity.x && p.y < entity.y + entity.height && p.y + p.height > entity.y;

        if (isColliding) {
          const isSolid = entity.type === ENTITY.PLATFORM || entity.type === ENTITY.STATIC_BLOCK || entity.type === ENTITY.SURPRISE_BLOCK;

          if (isSolid) {
            if (p.vy < 0 && p.y <= entity.y + entity.height && p.y - p.vy >= entity.y + entity.height - 15) {
              p.y = entity.y + entity.height; p.vy = 0;
              if (entity.type === ENTITY.SURPRISE_BLOCK && !entity.isHit) { entity.isHit = true; spawnDynamicReward(entity.x, entity.y, entity.reward!); if (audioInst) audioInst.coin(); }
            } else if (p.vy > 0 && p.y + p.height - p.vy <= entity.y + 15) {
              p.y = entity.y - p.height; p.vy = 0; p.grounded = true; p.lastSafeX = p.x; p.lastSafeY = p.y;
              if (p.hasPet) p.canDoubleJump = true;
              if (!wasGrounded) {
                p.squashX = 1.25; p.squashY = 0.75;
              }
            } else {
              p.vx = 0;
              if (p.x < entity.x) p.x = entity.x - p.width;
              else p.x = entity.x + entity.width;
            }
          } else if (entity.type === ENTITY.DYNAMIC_REWARD && entity.active) {
            entity.active = false;
            if (entity.rewardType === 'PET') {
              p.hasPet = true;
              setUiState((prev) => ({ ...prev, message: '¡MASCOTA YOSHI! Doble Salto + Velocidad', messageType: 'success' }));
              if (audioInst) audioInst.powerup();
              spawnParticle(entity.x, entity.y, '#ff4b4b', 30, true);
            } else if (entity.rewardType === 'PUKA') {
              p.state = PLAYER_STATE.PUKA_OVERDRIVE; p.stateTimer = 8000;
              setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.PUKA_OVERDRIVE, message: '¡PUKA POWER EXTRA!', messageType: 'success' }));
              if (audioInst) audioInst.powerup();
              spawnParticle(entity.x, entity.y, '#ffd700', 30, true);
            } else {
              s.score += 1;
              if (audioInst) audioInst.coin();
            }
          } else if (entity.type === ENTITY.COIN && entity.active) {
            entity.active = false; s.score += 1;
            if (audioInst) audioInst.coin();
            spawnParticle(entity.x, entity.y, '#ffd700', 8);
          } else if (entity.type === ENTITY.ENEMY && entity.active) {
            if (p.vy > 0 && p.y + p.height - p.vy <= entity.y + 20) {
              entity.active = false; p.vy = JUMP_FORCE * 0.8;
              if (audioInst) audioInst.stomp();
              spawnParticle(entity.x, entity.y, theme.platformBottom, 15); s.score += 2;
            } else {
              if (audioInst) audioInst.hurt();
              triggerShake(10, 150);
              triggerHitstop(2);
              if (p.hasPet) {
                p.hasPet = false; p.canDoubleJump = false; p.vy = -6; p.vx = p.facingLeft ? 8 : -8;
                entity.active = false;
                setUiState((prev) => ({ ...prev, message: '¡MASCOTA PERDIDA!', messageType: 'warning' }));
              } else if (p.isGiant) {
                p.isGiant = false; p.width = 40; p.height = 60; p.vy = -6; p.vx = p.facingLeft ? 8 : -8;
                entity.active = false;
                setUiState((prev) => ({ ...prev, message: '¡PODER PERDIDO!', messageType: 'warning' }));
              } else {
                p.vx = p.facingLeft ? 10 : -10; p.vy = -5;
                s.score = Math.max(0, s.score - 1);
                setUiState((prev) => ({ ...prev, message: '¡GOLPE! -1 🪙', messageType: 'error' }));
              }
            }
          } else if (entity.type === ENTITY.SUPER_FRUIT && entity.active) {
            entity.active = false;
            if (!p.isGiant) { p.isGiant = true; p.width = 60; p.height = 90; p.y -= 30; }
            s.lives += 1;
            if (audioInst) audioInst.powerup();
            setUiState((prev) => ({ ...prev, message: '¡CAMU CAMU! +1 VIDA', messageType: 'success', lives: s.lives }));
            spawnParticle(entity.x, entity.y, '#dc143c', 20);
          } else if ((entity.type === ENTITY.VENDING_GENERIC || entity.type === ENTITY.VENDING_PUKA) && entity.active) {
            const isPuka = entity.type === ENTITY.VENDING_PUKA;
            const cost = isPuka ? COST_PUKA : COST_GENERIC;
            if (s.score >= cost) {
              entity.active = false; s.score -= cost;
              if (audioInst) audioInst.powerup();
              const newState = isPuka ? PLAYER_STATE.PUKA_OVERDRIVE : PLAYER_STATE.GENERIC_RUSH;
              p.state = newState; p.stateTimer = isPuka ? 8000 : 4000;
              setUiState((prev) => ({ ...prev, playerState: newState, message: isPuka ? '¡PUKA POWER! Energía Natural' : '¡RUSH DE QUÍMICOS!', messageType: isPuka ? 'success' : 'warning' }));
              spawnParticle(entity.x, entity.y, isPuka ? '#ffd700' : '#3b82f6', 30);
              if (isPuka) triggerShake(4, 100);
              else triggerShake(8, 250);
            }
          } else if (entity.type === ENTITY.GOAL) {
            p.isDead = true;
            if (audioInst) audioInst.victory();
            if (!couponDone()) { applyGameCoupon(); setCouponDone(true); }
            dl({ event: 'puka_game_victory', coins: s.score });
            setAppState(APP_STATE.VICTORY);
            return;
          }
        }
      });

      const targetCamX = p.x - getCameraOffset();
      cam.x += (targetCamX - cam.x) * 0.1;
      if (cam.x < 0) cam.x = 0;

      if (s.shakeTimer > 0) s.shakeTimer -= 16.6;

      s.particles.forEach((part, idx) => {
        part.life -= 16.6; part.x += part.vx; part.y += part.vy;
        part.alpha = Math.max(0, part.life / part.maxLife);
        if (part.life <= 0) s.particles.splice(idx, 1);
      });

      s.envParticles.forEach((ep) => {
        ep.x += ep.vx;
        ep.y += ep.vy;
        ep.rotation += ep.rotationSpeed;
        if (ep.y > 620 || ep.y < -20 || ep.x < cam.x - 200 || ep.x > cam.x + vp.width + 400) {
          if (theme.id === 'GOH_RONG') { ep.x = cam.x + Math.random() * vp.width; ep.y = 480 + Math.random() * 120; }
          else if (theme.id === 'BAMBOO_FOREST') { ep.x = cam.x + vp.width + 50 + Math.random() * 100; ep.y = Math.random() * 500; }
          else { ep.x = cam.x + vp.width + 50 + Math.random() * 100; ep.y = Math.random() * 600; }
        }
      });
    }

    if (canvasEl) render(canvasEl.getContext('2d')!, s, theme);
    rafId = requestAnimationFrame(gameLoop);
  }

  function drawParallaxMid(ctx: CanvasRenderingContext2D, s: typeof engineState, vw: number, vh: number, theme: typeof THEMES[keyof typeof THEMES]) {
    const camX = s.camera.x;
    ctx.save();
    ctx.translate(-camX * 0.15, 0);
    ctx.globalAlpha = 0.3;
    if (theme.id === 'GOH_RONG') {
      ctx.fillStyle = '#7B111330';
      for (let i = 0; i < 12; i++) {
        const bx = i * 300 - (camX * 0.15 % 300);
        ctx.fillRect(bx, vh * 0.4, 40, vh * 0.5);
        ctx.fillRect(bx + 80, vh * 0.35, 30, vh * 0.55);
        ctx.beginPath();
        ctx.arc(bx + 20, vh * 0.35, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD70030';
        ctx.fill();
        ctx.fillStyle = '#7B111330';
      }
    } else if (theme.id === 'BAMBOO_FOREST') {
      ctx.fillStyle = '#1E462025';
      for (let i = 0; i < 10; i++) {
        const bx = i * 360 - (camX * 0.15 % 360);
        ctx.fillRect(bx + 30, vh * 0.2, 18, vh * 0.7);
        ctx.fillRect(bx + 30, vh * 0.35, 18, 5);
        ctx.fillRect(bx + 30, vh * 0.55, 18, 5);
        ctx.fillRect(bx + 160, vh * 0.3, 14, vh * 0.6);
        ctx.fillRect(bx + 160, vh * 0.45, 14, 4);
      }
    } else {
      ctx.fillStyle = '#33415525';
      for (let i = 0; i < 8; i++) {
        const bx = i * 450 - (camX * 0.15 % 450);
        ctx.beginPath();
        ctx.moveTo(bx, vh * 0.8);
        ctx.lineTo(bx + 80, vh * 0.05);
        ctx.lineTo(bx + 160, vh * 0.55);
        ctx.lineTo(bx + 240, vh * 0.15);
        ctx.lineTo(bx + 320, vh * 0.65);
        ctx.lineTo(bx + 400, vh * 0.3);
        ctx.lineTo(bx + 480, vh * 0.85);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function render(ctx: CanvasRenderingContext2D, s: typeof engineState, theme: typeof THEMES[keyof typeof THEMES]) {
    const { camera, viewport, player } = s;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const genderData = GENDERS[selection().gender!];
    const now = Date.now();

    ctx.save();

    if (s.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * s.shakeIntensity;
      const sy = (Math.random() - 0.5) * s.shakeIntensity;
      ctx.translate(sx, sy);
    }

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    const grad = ctx.createLinearGradient(0, viewport.height * 0.7, 0, viewport.height);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, '#00000040');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    drawParallaxMid(ctx, s, viewport.width, viewport.height, theme);

    ctx.save();
    ctx.translate(-camera.x, 0);

    ctx.textBaseline = 'top';
    s.entities.forEach((entity) => {
      const isPlatform = entity.type === ENTITY.PLATFORM;
      const cullMargin = isPlatform ? 1000 : 200;
      if (entity.x < camera.x - cullMargin || entity.x > camera.x + viewport.width + cullMargin) return;

      if (entity.type === ENTITY.PLATFORM) {
        const g = ctx.createLinearGradient(entity.x, entity.y, entity.x, entity.y + entity.height);
        g.addColorStop(0, theme.platformTop);
        g.addColorStop(0.3, theme.platformTop);
        g.addColorStop(1, theme.platformBottom);
        ctx.fillStyle = g;
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(entity.x, entity.y + 1.5);
        ctx.lineTo(entity.x + entity.width, entity.y + 1.5);
        ctx.stroke();
      } else if (entity.type === ENTITY.STATIC_BLOCK) {
        const g = ctx.createLinearGradient(entity.x, entity.y, entity.x, entity.y + entity.height);
        g.addColorStop(0, theme.platformTop);
        g.addColorStop(1, theme.platformBottom);
        ctx.fillStyle = g;
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.strokeRect(entity.x, entity.y, entity.width, entity.height);
      } else if (entity.type === ENTITY.SURPRISE_BLOCK) {
        const g = ctx.createLinearGradient(entity.x, entity.y, entity.x, entity.y + entity.height);
        g.addColorStop(0, entity.isHit ? '#95a5a6' : '#f1c40f');
        g.addColorStop(1, entity.isHit ? '#7f8c8d' : '#e67e22');
        ctx.fillStyle = g;
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        ctx.strokeStyle = '#d35400'; ctx.lineWidth = 2;
        ctx.strokeRect(entity.x, entity.y, entity.width, entity.height);
        if (!entity.isHit) {
          ctx.fillStyle = '#d35400'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
          ctx.fillText('?', entity.x + entity.width / 2, entity.y + 6);
        }
      } else if (entity.type === ENTITY.DYNAMIC_REWARD && entity.active) {
        ctx.font = '30px Arial'; ctx.textAlign = 'left';
        if (entity.rewardType === 'PET') {
          ctx.shadowColor = 'rgba(255, 75, 75, 1)'; ctx.shadowBlur = 15;
          ctx.fillText('🐈', entity.x, entity.y); ctx.shadowBlur = 0;
        } else if (entity.rewardType === 'PUKA') { ctx.fillText('🍫', entity.x, entity.y); }
        else { ctx.fillText('🪙', entity.x, entity.y); }
      } else if (entity.type === ENTITY.COIN && entity.active) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const coinScale = 0.6 + Math.abs(Math.sin(now / 120)) * 0.4;
        const cx = entity.x + entity.width / 2;
        const cy = entity.y + entity.height / 2;
        const r = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
        r.addColorStop(0, 'rgba(255,215,0,0.8)');
        r.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = r;
        ctx.fillRect(cx - 25, cy - 25, 50, 50);
        ctx.font = `${Math.round(26 * coinScale)}px Arial`;
        ctx.fillText('🪙', cx - 13 * coinScale + 5, cy + 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      } else if (entity.type === ENTITY.ENEMY && entity.active) {
        ctx.save();
        ctx.font = '40px Arial'; ctx.textAlign = 'left';
        if (entity.vx! > 0) { ctx.translate(entity.x + entity.width, entity.y); ctx.scale(-1, 1); ctx.fillText(entity.emoji!, 0, 0); }
        else { ctx.fillText(entity.emoji!, entity.x, entity.y); }
        ctx.restore();
      } else if (entity.type === ENTITY.VENDING_GENERIC || entity.type === ENTITY.VENDING_PUKA) {
        if (!entity.active) return;
        const isPuka = entity.type === ENTITY.VENDING_PUKA;
        ctx.textAlign = 'left';

        ctx.save();
        if (isPuka) {
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 20;
          ctx.strokeStyle = '#ffd700';
          ctx.lineWidth = 3;
          ctx.strokeRect(entity.x - 3, entity.y - 3, entity.width + 6, entity.height + 6);
          ctx.shadowBlur = 0;
        }

        const g = ctx.createLinearGradient(entity.x, entity.y, entity.x, entity.y + entity.height);
        if (isPuka) {
          g.addColorStop(0, '#e11d48'); g.addColorStop(0.5, '#be123c'); g.addColorStop(1, '#881337');
        } else {
          g.addColorStop(0, '#1e3a8a'); g.addColorStop(0.5, '#1e40af'); g.addColorStop(1, '#172554');
        }
        ctx.fillStyle = g;
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);

        if (isPuka) {
          ctx.shadowColor = '#ffd700';
          ctx.shadowBlur = 10;
        }
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(entity.x + 10, entity.y + 10, entity.width - 20, entity.height - 40);
        ctx.font = '30px Arial';
        ctx.fillText(isPuka ? '🍫' : '🍤', entity.x + 25, entity.y + 20);
        ctx.restore();

        const label = isPuka ? 'PUKA POWER' : 'RED BULL';
        ctx.save();
        ctx.font = '900 18px Arial';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(entity.x + (entity.width / 2) - (tw / 2) - 8, entity.y - 32, tw + 16, 24);
        ctx.fillStyle = isPuka ? '#ffd700' : '#60a5fa';
        if (isPuka) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12; }
        ctx.fillText(label, entity.x + (entity.width / 2) - (tw / 2), entity.y - 28);
        ctx.restore();

        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial';
        ctx.fillText((isPuka ? COST_PUKA : COST_GENERIC) + ' 🪙', entity.x + 20, entity.y + entity.height - 25);
      } else if (entity.type === ENTITY.SUPER_FRUIT && entity.active) {
        ctx.textAlign = 'left'; ctx.font = '40px Arial'; ctx.fillText('🍒', entity.x, entity.y);
      } else if (entity.type === ENTITY.GOAL) {
        ctx.textAlign = 'left'; ctx.font = '100px Arial'; ctx.fillText(theme.goalEmoji, entity.x, entity.y);
      }
    });

    ctx.save();
    s.particles.forEach((p) => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    s.envParticles.forEach((ep) => {
      ctx.globalAlpha = ep.alpha;
      ctx.save();
      ctx.translate(ep.x, ep.y);
      ctx.rotate(ep.rotation);
      if (theme.id === 'GOH_RONG') {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.arc(0, 0, ep.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (theme.id === 'BAMBOO_FOREST') {
        ctx.fillStyle = '#A3E635';
        ctx.beginPath();
        ctx.ellipse(0, 0, ep.size * 0.5, ep.size, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(255,255,255,0.4)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(0, 0, ep.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    ctx.save();
    const isRunning = Math.abs(player.vx) > 0.5;
    let emoji = isRunning ? genderData.run : genderData.idle;
    if (player.state === PLAYER_STATE.TACHYCARDIA) emoji = '😵';
    if (player.sugarCrashTimer > 0) emoji = '🥵';

    for (const g of player.ghosts) {
      ctx.globalAlpha = g.alpha * 0.3;
      ctx.font = '40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, g.x + player.width / 2, g.y + player.height / 2);
    }
    ctx.globalAlpha = 1;

    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 30; }
    else if (player.state === PLAYER_STATE.TACHYCARDIA) {
      ctx.filter = 'hue-rotate(90deg) contrast(150%) saturate(200%)';
    }

    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    ctx.translate(cx, cy);
    ctx.save();
    if (!player.facingLeft) ctx.scale(-1, 1);
    ctx.scale(player.squashX, player.squashY);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';

    if (player.hasPet) {
      ctx.shadowColor = 'rgba(255,75,75,1)'; ctx.shadowBlur = 20;
      ctx.font = '50px Arial';
      if (isRunning && !player.isDead && player.grounded) ctx.translate(0, Math.abs(Math.sin(now / 60)) * -4);
      ctx.fillText('🐈', 0, 15);
      ctx.shadowBlur = 0;
      ctx.font = player.isGiant ? '60px Arial' : '40px Arial';
      ctx.fillText(emoji, 0, -25);
    } else {
      ctx.font = player.isGiant ? '85px Arial' : '55px Arial';
      if (isRunning && !player.isDead && player.grounded) {
        ctx.rotate(Math.sin(now / 80) * 0.15);
        ctx.translate(0, Math.abs(Math.sin(now / 80)) * -8);
      }
      ctx.fillText(emoji, 0, 0);
    }
    ctx.restore();

    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE && !player.isDead) {
      const pt = now / 150;
      ctx.font = player.isGiant ? '35px Arial' : '20px Arial';
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 15;
      ctx.fillText('⚡', Math.cos(pt) * (player.width * 0.9), Math.sin(pt) * (player.height * 0.7));
      ctx.fillText('⚡', Math.cos(pt + Math.PI) * (player.width * 0.9), Math.sin(pt + Math.PI) * (player.height * 0.7));
      ctx.fillText('✨', Math.cos(pt + 1.5) * (player.width * 1.2), Math.sin(pt + 1.5) * (player.height * 0.9));
      ctx.fillText('✨', Math.cos(pt + 4.5) * (player.width * 1.2), Math.sin(pt + 4.5) * (player.height * 0.9));
      ctx.shadowBlur = 0;
    }

    if (player.idleTimer > 3000 && !player.isDead) {
      ctx.font = '25px Arial';
      ctx.fillText('💤', 15, -player.height / 2 - 15 + Math.sin(now / 200) * 5);
    }

    ctx.restore();

    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE) {
      ctx.restore();
    }

    ctx.restore();
  }

  function PlayingScreen() {
    onMount(() => {
      if (!canvasEl || !containerEl) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          const h = Math.round(entry.contentRect.height);
          if (w <= 0 || h <= 0) return;
          canvasEl!.width = w;
          canvasEl!.height = h;
          engineState.viewport = { width: w, height: h };
        }
      });
      ro.observe(containerEl);
      rafId = requestAnimationFrame(gameLoop);

      const hKD = (e: KeyboardEvent) => {
        if (appState() !== APP_STATE.PLAYING) return;
        if (e.code === 'ArrowLeft') engineState.keys.left = true;
        if (e.code === 'ArrowRight') engineState.keys.right = true;
        if (e.code === 'ArrowUp' || e.code === 'Space') {
          if (!engineState.keys.up) engineState.keys.upJustPressed = true;
          engineState.keys.up = true;
        }
      };
      const hKU = (e: KeyboardEvent) => {
        if (e.code === 'ArrowLeft') engineState.keys.left = false;
        if (e.code === 'ArrowRight') engineState.keys.right = false;
        if (e.code === 'ArrowUp' || e.code === 'Space') engineState.keys.up = false;
      };
      window.addEventListener('keydown', hKD);
      window.addEventListener('keyup', hKU);

      onCleanup(() => {
        window.removeEventListener('keydown', hKD);
        window.removeEventListener('keyup', hKU);
        cancelAnimationFrame(rafId);
        ro.disconnect();
      });
    });

    const ui = uiState();
    const pst = ui.playerState;
    const s = engineState;
    const isPuka = pst === PLAYER_STATE.PUKA_OVERDRIVE || s.player.hasPet;
    const isRush = pst === PLAYER_STATE.GENERIC_RUSH;
    const isTachy = pst === PLAYER_STATE.TACHYCARDIA;

    const goalEntity = s.entities.find((e) => e.type === ENTITY.GOAL);
    const progressPct = goalEntity ? Math.min(100, Math.max(0, (s.player.x / goalEntity.x) * 100)) : 0;

    return (
      <div class="fixed inset-0 bg-black overflow-hidden select-none font-sans">
        <div class="absolute top-0 left-0 right-0 z-10 flex justify-between items-start p-2 sm:p-3 pointer-events-none">
          <div class="flex items-center gap-2">
            <div class="flex gap-0.5">
              {Array.from({ length: Math.max(0, ui.lives) }).map(() => (
                <svg class="w-5 h-5 sm:w-6 sm:h-6 text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              ))}
            </div>
            <div class="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-700/50 shadow-lg">
              <svg class="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="text-lg sm:text-xl font-black text-white">{ui.coins}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-xl sm:text-2xl font-black bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-700/50"
              classList={{ 'text-red-500': ui.timeLeft < 15, 'text-white': ui.timeLeft >= 15 }}>
              {Math.floor(ui.timeLeft / 60)}:{(ui.timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        <div class="absolute top-12 sm:top-14 left-2 sm:left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[10px] sm:text-xs tracking-wide transition-colors pointer-events-none"
          classList={{
            'text-red-400 bg-red-500/10 border-red-500/30': isPuka,
            'text-blue-400 bg-blue-400/10 border-blue-400/30': isRush,
            'text-gray-400 bg-gray-600/30 border-gray-500/30': isTachy,
            'text-green-400 bg-green-400/10 border-green-400/30': !isPuka && !isRush && !isTachy,
          }}>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isPuka || isRush || isTachy
              ? <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              : <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            }
          </svg>
          {isPuka ? 'PUKA OVERDRIVE' : isRush ? 'GENERIC RUSH' : isTachy ? 'TACHYCARDIA' : 'SISTEMA ESTABLE'}
        </div>

        <div class="absolute top-0 left-0 right-0 z-10 flex justify-center pt-1 sm:pt-2 px-20">
          <div class="w-full max-w-md bg-slate-900/60 backdrop-blur-sm rounded-full h-1.5 sm:h-2 overflow-hidden border border-slate-700/40">
            <div class="h-full rounded-full transition-all duration-300 ease-out"
              classList={{
                'bg-gradient-to-r from-red-500 to-orange-400': progressPct < 40,
                'bg-gradient-to-r from-orange-400 to-yellow-400': progressPct >= 40 && progressPct < 70,
                'bg-gradient-to-r from-yellow-400 to-green-400': progressPct >= 70,
              }}
              style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {ui.message && (
          <div class="absolute top-28 sm:top-32 left-0 right-0 flex justify-center z-20 pointer-events-none px-4">
            <div class="px-4 py-2 rounded-full backdrop-blur-md border font-bold uppercase text-[10px] sm:text-xs animate-pulse"
              classList={{
                'bg-red-500/20 text-red-400 border-red-500/40': ui.messageType === 'success',
                'bg-gray-800/80 text-white border-gray-600/40': ui.messageType === 'error',
                'bg-orange-500/20 text-orange-400 border-orange-500/40': ui.messageType === 'warning',
                'bg-blue-500/20 text-blue-400 border-blue-500/40': ui.messageType !== 'success' && ui.messageType !== 'error' && ui.messageType !== 'warning',
              }}>
              {ui.message}
            </div>
          </div>
        )}

        <div ref={containerEl} class="w-full min-h-[85vh] lg:h-[90vh] bg-black mx-auto relative">
          <canvas ref={canvasEl} class="block w-full h-full" style={{ 'image-rendering': 'pixelated' }} />
        </div>

        <Show when={!showTutorial()}>
          <div class="absolute bottom-3 sm:bottom-6 left-0 right-0 px-3 sm:px-6 flex justify-between items-end z-30 md:hidden">
            <div class="flex gap-3 sm:gap-4">
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.left = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.left = false; }} onMouseDown={() => { engineState.keys.left = true; }} onMouseUp={() => { engineState.keys.left = false; }} class="w-16 h-16 sm:w-20 sm:h-20 bg-black/60 backdrop-blur-sm rounded-2xl border-2 border-white/15 text-white text-2xl sm:text-3xl font-black touch-none active:bg-white/20 active:scale-90 transition-all duration-100 shadow-lg flex items-center justify-center">{'\u2190'}</button>
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.right = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.right = false; }} onMouseDown={() => { engineState.keys.right = true; }} onMouseUp={() => { engineState.keys.right = false; }} class="w-16 h-16 sm:w-20 sm:h-20 bg-black/60 backdrop-blur-sm rounded-2xl border-2 border-white/15 text-white text-2xl sm:text-3xl font-black touch-none active:bg-white/20 active:scale-90 transition-all duration-100 shadow-lg flex items-center justify-center">{'\u2192'}</button>
            </div>
            <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING && !engineState.keys.up) engineState.keys.upJustPressed = true; engineState.keys.up = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.up = false; }} onMouseDown={() => { if (!engineState.keys.up) engineState.keys.upJustPressed = true; engineState.keys.up = true; }} onMouseUp={() => { engineState.keys.up = false; }} class="w-20 h-20 sm:w-24 sm:h-24 bg-red-500/30 backdrop-blur-sm rounded-2xl border-2 border-red-500/50 text-white text-3xl sm:text-4xl font-black touch-none shadow-[0_0_20px_rgba(239,68,68,0.2)] active:bg-red-500/60 active:scale-90 transition-all duration-100 flex items-center justify-center">{'\u2191'}</button>
          </div>
        </Show>
      </div>
    );
  }

  const iconArrowLeft = (
    <svg class="w-5 h-5 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
    </svg>
  );

  const iconPlay = (
    <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z"/>
    </svg>
  );

  return (
    <>
      <Switch>
        <Match when={appState() === APP_STATE.MENU_GENDER}>
          <div class="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center relative overflow-hidden">
            <div class="absolute inset-0 opacity-5">
              <div class="absolute top-10 left-10 w-72 h-72 bg-red-500 rounded-full blur-3xl animate-pulse" />
              <div class="absolute bottom-10 right-10 w-96 h-96 bg-orange-500 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s" />
            </div>
            <div class="absolute top-6 left-6 z-10">
              <a href="/tienda"
                class="flex items-center gap-1 text-sm text-slate-400 hover:text-yellow-400 transition-colors">
                {iconArrowLeft} Volver a la Tienda
              </a>
            </div>
            <h1 class="text-5xl sm:text-7xl font-black italic mb-2 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-red-400 to-orange-400 drop-shadow-[0_0_30px_rgba(220,38,38,0.3)]">PUKA POWER</h1>
            <p class="text-lg sm:text-xl text-slate-400 mb-6 sm:mb-10">Elige a tu personaje para la aventura</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto w-full px-4">
              {Object.values(GENDERS).map((g) => (
                <button onClick={() => { setSelection({ gender: g.id, theme: null }); setAppState(APP_STATE.MENU_LEVEL); }}
                  class="bg-slate-800/80 backdrop-blur-sm p-6 sm:p-8 rounded-2xl border-2 border-slate-700/50 hover:border-red-500 hover:scale-105 hover:shadow-[0_0_40px_rgba(220,38,38,0.15)] transition-all duration-300 group relative overflow-hidden">
                  <div class="absolute inset-0 bg-gradient-to-b from-red-500/0 via-red-500/0 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div class="relative z-10">
                    <div class="text-6xl sm:text-7xl mb-3 sm:mb-4 group-hover:scale-110 group-hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all duration-300">{g.idle}</div>
                    <div class="font-bold text-base sm:text-lg uppercase tracking-wider">{g.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.MENU_LEVEL}>
          <div class="w-full min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-6 text-center relative overflow-hidden">
            <div class="absolute inset-0 opacity-5">
              <div class="absolute top-20 right-20 w-64 h-64 bg-blue-500 rounded-full blur-3xl animate-pulse" />
              <div class="absolute bottom-20 left-20 w-80 h-80 bg-purple-500 rounded-full blur-3xl animate-pulse" style="animation-delay: 0.7s" />
            </div>
            <button onClick={() => setAppState(APP_STATE.MENU_GENDER)}
              class="absolute top-6 left-6 flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors z-10">
              {iconArrowLeft} Cambiar Personaje
            </button>
            <h2 class="text-4xl sm:text-5xl font-black mb-8 sm:mb-10">¿A dónde vas hoy?</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 w-full max-w-5xl mx-auto px-4">
              {Object.values(THEMES).map((t) => (
                <button onClick={() => startGame(t.id)}
                  style={{ 'background-color': t.bg }}
                  class="relative overflow-hidden p-6 sm:p-8 rounded-2xl border-4 border-transparent hover:border-white hover:scale-105 hover:shadow-2xl transition-all duration-300 text-left group shadow-xl">
                  <div class="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors duration-300" />
                  <div class="text-6xl sm:text-7xl absolute right-3 sm:right-4 bottom-3 sm:bottom-4 opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300">{t.goalEmoji}</div>
                  <div class="relative z-10">
                    <h3 class="font-black text-2xl sm:text-3xl text-black/80 uppercase tracking-wide">{t.name}</h3>
                    <div class="flex items-center gap-2 mt-2">
                      <span class="inline-block w-2 h-2 rounded-full bg-black/40" />
                      <p class="font-bold text-black/60 text-sm sm:text-base tracking-wide">{t.difficulty}</p>
                    </div>
                    <div class="mt-3 flex gap-1.5">
                      {Array.from({ length: 3 }).map(() => (
                        <span class="inline-block w-8 h-1.5 rounded-full bg-black/30 group-hover:bg-black/50 transition-colors" />
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.GAME_OVER}>
          <div class="w-full min-h-screen bg-gradient-to-br from-slate-900 via-red-950/50 to-slate-900 text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div class="absolute inset-0 opacity-10">
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600 rounded-full blur-3xl animate-pulse" />
            </div>
            <div class="relative z-10">
              <div class="text-8xl mb-6 grayscale opacity-60 animate-pulse">{'\u{1F480}'}</div>
              <h1 class="text-6xl sm:text-7xl font-black uppercase mb-4 text-red-500 drop-shadow-[0_0_20px_rgba(220,38,38,0.3)]">Game Over</h1>
              <p class="text-xl sm:text-2xl text-slate-300 mb-4">Monedas recolectadas: <span class="text-yellow-400 font-bold drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">{uiState().coins} {'\u{1FA99}'}</span></p>
              <p class="text-base text-slate-500 mb-8">¡No te rindas! El poder del rayo te espera.</p>
              <button onClick={() => setAppState(APP_STATE.MENU_LEVEL)}
                class="bg-red-500 hover:bg-red-600 text-white font-black text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                {iconPlay} JUGAR DE NUEVO
              </button>
            </div>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.VICTORY}>
          <div class="w-full min-h-screen bg-gradient-to-br from-slate-900 via-green-950/30 to-slate-900 text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div class="absolute inset-0 opacity-10">
              <div class="absolute top-10 left-10 w-64 h-64 bg-green-500 rounded-full blur-3xl animate-pulse" />
              <div class="absolute bottom-10 right-10 w-80 h-80 bg-yellow-500 rounded-full blur-3xl animate-pulse" style="animation-delay: 0.5s" />
            </div>
            <div class="relative z-10">
              <div class="text-8xl sm:text-9xl mb-6 animate-bounce drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">{selection().theme ? THEMES[selection().theme!].goal : '\u{1F3C6}'}</div>
              <h1 class="text-5xl sm:text-6xl font-black uppercase mb-4 text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.3)]">{'\u{00A1}'}Llegaste a tiempo!</h1>
              <p class="text-xl sm:text-2xl text-slate-300 mb-4">Monedas recolectadas: <span class="text-yellow-400 font-bold drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">{uiState().coins} {'\u{1FA99}'}</span></p>
              <Show when={couponDone()}>
                <div class="bg-green-500/20 backdrop-blur-sm border-2 border-green-500/50 text-green-400 font-bold px-6 py-3 rounded-xl mb-6 text-lg animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                  {'\u{1F389}'} Cupón BOLT15 activado — 15% de descuento
                </div>
              </Show>
              <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => setAppState(APP_STATE.MENU_LEVEL)}
                  class="bg-red-500 hover:bg-red-600 text-white font-black text-lg sm:text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                  {iconPlay} JUGAR DE NUEVO
                </button>
                <a href="/tienda"
                  class="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-lg sm:text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.3)]">
                  Ir a la tienda {'\u{1F6D2}'}
                </a>
              </div>
            </div>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.PLAYING}>
          <PlayingScreen />
        </Match>
      </Switch>

      <Show when={appState() === APP_STATE.PLAYING && showTutorial()}>
        <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div class="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 max-w-sm w-full p-8 text-center text-white shadow-2xl shadow-red-500/5 space-y-6 relative overflow-hidden">
            <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-red-500" />
            <div class="text-5xl">{'\u{1F3AE}'}</div>
            <h2 class="text-2xl font-black uppercase tracking-wider drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{'\u{00A1}'}A jugar!</h2>
            <ul class="text-left space-y-3 text-sm text-slate-300">
              <li class="flex items-start gap-3 p-2 rounded-lg bg-white/5">
                <span class="text-xl flex-shrink-0">{'\u{2190}'}{'\u{2192}'}</span>
                <span><strong class="text-white">Flechas izquierda/derecha</strong> o botones táctiles para moverte</span>
              </li>
              <li class="flex items-start gap-3 p-2 rounded-lg bg-white/5">
                <span class="text-xl flex-shrink-0">{'\u{2191}'}</span>
                <span><strong class="text-white">Flecha arriba / Espacio</strong> o botón rojo para saltar</span>
              </li>
              <li class="flex items-start gap-3 p-2 rounded-lg bg-white/5">
                <span class="text-xl flex-shrink-0">{'\u{1FA99}'}</span>
                <span><strong class="text-white">Recolecta monedas</strong> y usa las máquinas expendedoras</span>
              </li>
              <li class="flex items-start gap-3 p-2 rounded-lg bg-white/5">
                <span class="text-xl flex-shrink-0">{'\u{1F3C1}'}</span>
                <span><strong class="text-white">Llega a la meta</strong> para ganar tu cupón BOLT15</span>
              </li>
            </ul>
            <button
              onClick={() => { setShowTutorial(false); engineState.startTime = Date.now(); }}
              class="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black py-4 px-8 rounded-xl text-lg tracking-wider uppercase transition-all hover:scale-105 shadow-lg shadow-red-500/20"
            >
              {'\u{1F680}'} ¡Comenzar!
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
