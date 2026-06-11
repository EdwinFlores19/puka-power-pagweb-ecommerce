import { createSignal, Switch, Match, Show, onMount, onCleanup } from 'solid-js';
import { applyGameCoupon } from '@/store/cartStore';

function dl(...args: unknown[]) {
  if (typeof window !== 'undefined' && Array.isArray((window as Record<string, unknown>).dataLayer)) {
    ((window as Record<string, unknown>).dataLayer as unknown[]).push(...args);
  }
}

const trackGameEvent = (eventName: string, payload: Record<string, unknown>) => {
  if (typeof window !== 'undefined' && (window as any).dataLayer) {
    (window as any).dataLayer.push({ event: eventName, ...payload });
  }
};

const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const BASE_SPEED = 6;
const TIME_LIMIT = 150;
const COOLDOWN_SHURIKEN = 2000;

const SPRITE = {
  PUKA_RUN: '/sprites/pucca_animacion_caminata_sprite_sheet.png',
  PUKA_IDLE: '/sprites/pucca_idle_cuerpo_completo.png',
  PUKA_JUMP: '/sprites/puka_saltando_hacia_arriba.png',
  PUKA_ATTACK: '/sprites/pucca_guerrera_gato_espada.png',
  PUKA_VICTORY: '/sprites/pucca_abrazando_garu_mareado_victoria.png',
  GARU_RUN: '/sprites/garu_animacion_carrera_sprite_sheet.png',
  GARU_IDLE: '/sprites/garu_de_pie_enojado.png',
  GARU_SCARED: '/sprites/garu_asustado_inclinado_derecha.png',
  NINJA: '/sprites/enemigo_ninja_morado_espada.png',
  CHING: '/sprites/personaje_cocinero_rojo_con_cubos_variante.png',
  ABYO: '/sprites/npc_abyo_luchador.png',
  CAT: '/sprites/gato_negro_cuerpo_completo.png',
  PORTADA: '/sprites/portada.png',
  PUKA_POWER: '/sprites/Puka-Power.png',
  RED_BULL: '/sprites/red-bull.png',
  MONSTER: '/sprites/monster.png',
} as const;

const SPRITE_FRAMES: Record<string, number> = {
  [SPRITE.PUKA_RUN]: 8,
  [SPRITE.GARU_RUN]: 8,
};

const SPRITE_GRID: Record<string, { cols: number; rows: number }> = {
  [SPRITE.PUKA_RUN]: { cols: 4, rows: 2 },
  [SPRITE.GARU_RUN]: { cols: 4, rows: 2 },
};

const SPRITE_DISPLAY: Record<string, { w: number; h: number }> = {
  [SPRITE.PUKA_RUN]: { w: 40, h: 60 },
  [SPRITE.PUKA_IDLE]: { w: 40, h: 60 },
  [SPRITE.PUKA_JUMP]: { w: 40, h: 60 },
  [SPRITE.PUKA_ATTACK]: { w: 40, h: 60 },
  [SPRITE.PUKA_VICTORY]: { w: 40, h: 60 },
  [SPRITE.GARU_RUN]: { w: 40, h: 60 },
  [SPRITE.GARU_IDLE]: { w: 40, h: 60 },
  [SPRITE.GARU_SCARED]: { w: 40, h: 60 },
  [SPRITE.NINJA]: { w: 40, h: 40 },
  [SPRITE.CHING]: { w: 48, h: 72 },
  [SPRITE.ABYO]: { w: 44, h: 66 },
  [SPRITE.CAT]: { w: 40, h: 40 },
  [SPRITE.PORTADA]: { w: 800, h: 600 },
  [SPRITE.PUKA_POWER]: { w: 30, h: 45 },
  [SPRITE.RED_BULL]: { w: 24, h: 36 },
  [SPRITE.MONSTER]: { w: 24, h: 36 },
};

const DEBUG_MODE = false;

const imageCache = new Map<string, HTMLImageElement>();
let assetsPreloaded = false;

function preloadAssets(): Promise<void> {
  if (assetsPreloaded) {
    return Promise.resolve();
  }
  const paths = Object.values(SPRITE);
  const promises = paths.map((src) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { imageCache.set(src, img); resolve(); };
      img.onerror = () => { resolve(); };
      img.src = src;
    });
  });
  return Promise.allSettled(promises).then((results) => {
    assetsPreloaded = true;
  });
}

function usePreloadedSprite(src: string): HTMLImageElement | null {
  const img = imageCache.get(src);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  src: string,
  frameIndex: number,
  dx: number, dy: number, dw: number, dh: number,
  flipX = false,
) {
  const img = usePreloadedSprite(src);
  if (!img) {
    ctx.fillStyle = '#ff00ff40';
    const fx = Math.floor(dx), fy = Math.floor(dy), fw = Math.floor(dw), fh = Math.floor(dh);
    ctx.fillRect(fx, fy, fw, fh);
    return;
  }
  const grid = SPRITE_GRID[src] || { cols: 1, rows: 1 };
  const sw = Math.floor(img.naturalWidth / grid.cols);
  const sh = Math.floor(img.naturalHeight / grid.rows);
  
  const totalFrames = grid.cols * grid.rows;
  const index = Math.min(frameIndex, totalFrames - 1);
  
  const col = index % grid.cols;
  const row = Math.floor(index / grid.cols);
  
  const sx = col * sw;
  const sy = row * sh;
  const fx = Math.floor(dx), fy = Math.floor(dy), fw = Math.floor(dw), fh = Math.floor(dh);
  ctx.save();
  if (flipX) {
    ctx.translate(fx + fw, fy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, fw, fh);
  } else {
    ctx.drawImage(img, sx, sy, sw, sh, fx, fy, fw, fh);
  }
  ctx.restore();
}

const LEVEL_CONFIG = {
  1: { segments: 20, minCoins: 10, name: 'El Restaurante Goh-Rong', themeId: 'GOH_RONG' as ThemeId, chemSpeedMult: 1.0 },
  2: { segments: 30, minCoins: 15, name: 'El Bosque de Bambú Místico', themeId: 'BAMBOO_FOREST' as ThemeId, chemSpeedMult: 1.4 },
  3: { segments: 40, minCoins: 0, name: 'La Montaña de la Tortuga Sagrada', themeId: 'TURTLE_MOUNTAIN' as ThemeId, chemSpeedMult: 1.0 },
};

const APP_STATE = { START_SCREEN: 0, CHARACTER_SELECTION: 1, PLAYING: 2, GAME_OVER: 3, VICTORY: 4 } as const;

const ENTITY = {
  PLATFORM: 0, COIN: 1, ENEMY_NINJA: 2, GOAL: 3,
  NPC_CHING: 4, NPC_ABYO: 5, NPC_TIOS: 6,
  TRAP_CHEMICAL: 7, PROJECTILE_BULL: 8,
  PROJECTILE_KUNAI: 9, PROJECTILE_SHURIKEN: 10, AMMO_BOX: 11,
} as const;

const PLAYER_STATE = {
  NORMAL: 'NORMAL',
  CHEMICAL_RUSH: 'CHEMICAL_RUSH',
  TACHYCARDIA: 'TACHYCARDIA',
  PUKA_OVERDRIVE: 'PUKA_OVERDRIVE',
} as const;

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

type ThemeId = 'GOH_RONG' | 'BAMBOO_FOREST' | 'TURTLE_MOUNTAIN';

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
  heartbeatTachycardia() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {
      // fail-safe
    }
  }
  rushEnergy() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const baseTime = this.ctx.currentTime;
      [400, 600, 800, 1000].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        const start = baseTime + i * 0.08;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.08, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.12);
      });
    } catch {
      // fail-safe
    }
  }
  shoot() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const baseTime = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, baseTime);
      osc.frequency.linearRampToValueAtTime(950, baseTime + 0.08);
      gain.gain.setValueAtTime(0.08, baseTime);
      gain.gain.exponentialRampToValueAtTime(0.01, baseTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(baseTime);
      osc.stop(baseTime + 0.08);
    } catch {
      // fail-safe
    }
  }
  impactMetal() {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // fail-safe
    }
  }
}

const iconArrowLeft = '←';
const iconPlay = '▶';

interface Entity { type: number; x: number; y: number; width: number; height: number; active?: boolean; vx?: number; vy?: number; startX?: number; range?: number; emoji?: string; isHit?: boolean; reward?: string; rewardType?: string; coinScale?: number; lastShot?: number; }
interface GhostPos { x: number; y: number; alpha: number; }
interface Player { x: number; y: number; vx: number; vy: number; width: number; height: number; grounded: boolean; state: string; stateTimer: number; facingLeft: boolean; isDead: boolean; isGiant: boolean; hasPet: boolean; canDoubleJump: boolean; idleTimer: number; lastSafeX: number; lastSafeY: number; jumpTimer: number; justLanded: boolean; squashX: number; squashY: number; ghosts: GhostPos[]; sugarCrashTimer: number; attackCooldown: number; animFrame: number; animTimer: number; }
interface Keys { left: boolean; right: boolean; up: boolean; upJustPressed: boolean; attack: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; alpha: number; size: number; }
interface EnvParticle { x: number; y: number; vx: number; vy: number; size: number; rotation: number; rotationSpeed: number; alpha: number; }
interface Projectile { id: number; type: number; x: number; y: number; vx: number; vy: number; width: number; height: number; angle: number; active: boolean; facingLeft: boolean; }

export default function Advergame() {
  const [appState, setAppState] = createSignal<number>(APP_STATE.START_SCREEN);
  const [selection, setSelection] = createSignal<{ theme: ThemeId | null }>({ theme: null });
  const [uiState, setUiState] = createSignal<{ coins: number; timeLeft: number; message: string; messageType: string; playerState: string; lives: number }>({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: 3 });
  const [couponDone, setCouponDone] = createSignal(false);
  const [showTutorial, setShowTutorial] = createSignal(true);
  const [inventory, setInventory] = createSignal<string[]>([]);
  const [currentLevelIndex, setCurrentLevelIndex] = createSignal(1);
  const [ammo, setAmmo] = createSignal(10);
  const [assetsReady, setAssetsReady] = createSignal(false);

  const getCameraOffset = () => (typeof window !== 'undefined' && window.innerWidth > 768 ? 400 : 150);

  let engineState: {
    keys: Keys; camera: { x: number; y: number };
    player: Player; entities: Entity[]; particles: Particle[]; envParticles: EnvParticle[];
    score: number; lives: number; startTime: number;
    viewport: { width: number; height: number };
    shakeTimer: number; shakeIntensity: number; hitstopFrames: number;
    companion: { x: number; y: number; vx: number; vy: number; grounded: boolean; width: number; height: number; targetDistance: number; animFrame: number; animTimer: number };
    playerYHistory: number[];
    floatingTexts: { x: number; y: number; text: string; life: number; maxLife: number; alpha: number }[];
    floatingScores: { x: number; y: number; text: string; life: number; maxLife: number; vy: number }[];
    timerFrozen: boolean;
    timerFreezeEnd: number;
    totalLevelLength: number;
    projectiles: Projectile[];
    nextProjectileId: number;
    isPaused: boolean;
  } = {} as any;
  let audioInst: SoundEngine | null = null;
  let rafId = 0;
  let lastFrameUpdate = 0;
  let canvasEl: HTMLCanvasElement | undefined;
  let containerEl: HTMLDivElement | undefined;

  function resetEngine() {
    engineState = {
      keys: { left: false, right: false, up: false, upJustPressed: false, attack: false },
      camera: { x: 0, y: 0 },
      player: {
        x: 100, y: 100, vx: 0, vy: 0, width: 40, height: 60,
        grounded: false, state: PLAYER_STATE.NORMAL, stateTimer: 0,
        facingLeft: false, isDead: false, isGiant: false, hasPet: false,
        canDoubleJump: false, idleTimer: 0, lastSafeX: 100, lastSafeY: 100,
        jumpTimer: 0, justLanded: false, squashX: 1, squashY: 1,
        ghosts: [], sugarCrashTimer: 0, attackCooldown: 0, animFrame: 0, animTimer: 0,
      },
      entities: [], particles: [], envParticles: [], score: 0, lives: 3, startTime: 0,
      viewport: { width: 800, height: 600 },
      shakeTimer: 0, shakeIntensity: 0, hitstopFrames: 0,
      companion: { x: 280, y: 100, vx: 5, vy: 0, grounded: false, width: 40, height: 60, targetDistance: 180, animFrame: 0, animTimer: 0 },
      playerYHistory: [],
      floatingTexts: [],
      floatingScores: [],
      timerFrozen: false,
      timerFreezeEnd: 0,
      totalLevelLength: 8000,
      projectiles: [],
      nextProjectileId: 0,
      isPaused: false,
    };
    setAmmo(10);
    setCouponDone(false);
    setInventory([]);
  }

  function triggerShake(intensity = 8, duration = 150) {
    engineState.shakeIntensity = intensity;
    engineState.shakeTimer = duration;
  }

  function triggerHitstop(frames = 2) {
    engineState.hitstopFrames = frames;
  }

  function spawnFloatingText(x: number, y: number, text: string) {
    engineState.floatingTexts.push({ x, y, text, life: 1500, maxLife: 1500, alpha: 1 });
  }
  function spawnFloatingScore(x: number, y: number, text: string) {
    engineState.floatingScores.push({ x, y, text, life: 1000, maxLife: 1000, vy: -2 });
  }

  function generateLevel(theme: typeof THEMES[keyof typeof THEMES], levelIndex: number) {
    const s = engineState;
    s.entities = []; s.score = 0; s.lives = 3;
    s.projectiles = []; s.nextProjectileId = 0;
    s.player = { ...s.player, x: 100, y: 100, vx: 0, vy: 0, state: PLAYER_STATE.NORMAL, isDead: false, isGiant: false, hasPet: false, canDoubleJump: false, width: 40, height: 60, idleTimer: 0, lastSafeX: 100, lastSafeY: 100, jumpTimer: 0, justLanded: false, squashX: 1, squashY: 1, ghosts: [], sugarCrashTimer: 0, attackCooldown: 0, animFrame: 0, animTimer: 0 };
    s.camera.x = 0;
    setAmmo(10);
    let curX = 0;
    let chingSpawned = false;
    let tiosSpawned = false;
    const groundY = 500;
    const SEGMENTS = LEVEL_CONFIG[levelIndex as keyof typeof LEVEL_CONFIG]?.segments || 20;
    const platWidth = levelIndex === 3 ? (w: number) => Math.max(40, w - 60) : (w: number) => w;
    const addPlat = (x: number, w: number, y = groundY, h = 800) => s.entities.push({ type: ENTITY.PLATFORM, x, y, width: platWidth(w), height: h });
    addPlat(0, 800); curX = 800;

    for (let i = 0; i < SEGMENTS; i++) {
      const p = i % 5;
      if (p === 0) {
        curX += 180; addPlat(curX, 500); addPlat(curX + 100, 200, groundY - 150, 20);
        for (let c = 0; c < 3; c++) s.entities.push({ type: ENTITY.COIN, x: curX + 100 + c * 50, y: groundY - 200 - c * 40, width: 30, height: 30, active: true, coinScale: 1 });
        if (!chingSpawned && i > 3) {
          chingSpawned = true;
          s.entities.push({ type: ENTITY.NPC_CHING, x: curX + 200, y: groundY - 120, width: 48, height: 72, active: true });
        }
        curX += 500;
      } else if (p === 1) {
        const stepW = levelIndex === 3 ? 30 : 40;
        const stepH = levelIndex === 3 ? 30 : 40;
        curX += 150; addPlat(curX, levelIndex === 3 ? 400 : 600);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3 - r; c++) {
            addPlat(curX + 150 + c * (stepW + 10) + r * 15, stepW, groundY - 40 - r * stepH, stepH);
          }
        }
        if (i % 5 === 1) s.entities.push({ type: ENTITY.AMMO_BOX, x: curX + 100, y: groundY - 60, width: 30, height: 30, active: true });
        curX += 600;
      } else if (p === 2) {
        curX += 100; addPlat(curX, 800); addPlat(curX + 200, levelIndex === 3 ? 100 : 150, groundY - 120, 20);
        s.entities.push({ type: ENTITY.COIN, x: curX + 260, y: groundY - 160, width: 30, height: 30, active: true, coinScale: 1 });
        s.entities.push({ type: ENTITY.COIN, x: curX + 300, y: groundY - 200, width: 30, height: 30, active: true, coinScale: 1 });
        const ee = theme.enemies[Math.floor(Math.random() * theme.enemies.length)];
        const ninjaVx = levelIndex === 2 ? -3 : -2;
        s.entities.push({ type: ENTITY.ENEMY_NINJA, x: curX + 400, y: groundY - 40, width: 40, height: 40, vx: ninjaVx, startX: curX + 300, range: 300, emoji: ee, active: true, lastShot: 0 });
        curX += 800;
      } else if (p === 3) {
        curX += 180; addPlat(curX, 800);
        s.entities.push({ type: ENTITY.TRAP_CHEMICAL, x: curX + 200, y: groundY - 36, width: 24, height: 36, active: true });
        s.entities.push({ type: ENTITY.NPC_ABYO, x: curX + 500, y: groundY - 72, width: 44, height: 66, active: true, vx: -1.5, startX: curX + 350, range: 300 });
        curX += 800;
      } else {
        curX += 150; addPlat(curX, 600);
        s.entities.push({ type: ENTITY.COIN, x: curX + 200, y: groundY - 100, width: 30, height: 30, active: true, coinScale: 1 });
        s.entities.push({ type: ENTITY.COIN, x: curX + 280, y: groundY - 160, width: 30, height: 30, active: true, coinScale: 1 });
        if (!tiosSpawned && i > 6) {
          tiosSpawned = true;
          s.entities.push({ type: ENTITY.NPC_TIOS, x: curX + 350, y: groundY - 72, width: 48, height: 72, active: true });
        } else if (tiosSpawned && i % 4 === 0) {
          s.entities.push({ type: ENTITY.AMMO_BOX, x: curX + 300, y: groundY - 60, width: 30, height: 30, active: true });
        }
        curX += 600;
      }
    }
    curX += 150; addPlat(curX, 1000);
    s.entities.push({ type: ENTITY.GOAL, x: curX + 400, y: groundY - 150, width: 150, height: 150 });
    s.totalLevelLength = curX + 1000;
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

  function isAABBCollision(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function spawnParticle(x: number, y: number, color: string, amount = 5, isPuka = false) {
    for (let i = 0; i < amount; i++) {
      engineState.particles.push({
        x: x + Math.random() * 40, y: y + Math.random() * 40,
        vx: (Math.random() - 0.5) * (isPuka ? 10 : 5),
        vy: (Math.random() - 0.5) * (isPuka ? 10 : 5),
        life: isPuka ? 800 : 400, maxLife: isPuka ? 800 : 400,
        color, alpha: 1, size: isPuka ? Math.random() * 8 + 4 : Math.random() * 5 + 2,
      });
    }
  }

  function startGame(themeId: ThemeId) {
    if (!audioInst) { audioInst = new SoundEngine(); }
    const levelMap: Record<string, number> = { GOH_RONG: 1, BAMBOO_FOREST: 2, TURTLE_MOUNTAIN: 3 };
    const levelIdx = levelMap[themeId] || 1;
    setCurrentLevelIndex(levelIdx);
    resetEngine();
    setSelection((prev) => ({ ...prev, theme: themeId }));
    setAppState(APP_STATE.PLAYING);
    generateLevel(THEMES[themeId], levelIdx);
    setUiState({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: 3 });
    lastFrameUpdate = 0;
    trackGameEvent('puka_campaign_start', { stage: levelIdx });
    preloadAssets().then(() => {
      if (canvasEl) {
        cancelAnimationFrame(rafId);
        canvasEl.width = window.innerWidth;
        canvasEl.height = window.innerHeight;
        engineState.viewport = { width: window.innerWidth, height: window.innerHeight };
        rafId = requestAnimationFrame(gameLoop);
      }
    });
  }

  function advanceToNextLevel() {
    const nextLevel = currentLevelIndex() + 1;
    if (nextLevel > 3) return;
    const themeMap: Record<number, ThemeId> = { 2: 'BAMBOO_FOREST', 3: 'TURTLE_MOUNTAIN' };
    const nextTheme = themeMap[nextLevel];
    setCurrentLevelIndex(nextLevel);
    if (!audioInst) { audioInst = new SoundEngine(); }
    resetEngine();
    setSelection((prev) => ({ ...prev, theme: nextTheme }));
    setAppState(APP_STATE.PLAYING);
    generateLevel(THEMES[nextTheme], nextLevel);
    setUiState({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: 3 });
    lastFrameUpdate = 0;
    trackGameEvent('puka_level_up', { stage: nextLevel });
  }

  let lastHeartbeatTime = 0;

  function gameLoop(time: number) {
    try {
      if (appState() !== APP_STATE.PLAYING) { return; }
      if (engineState.isPaused) { rafId = requestAnimationFrame(gameLoop); return; }
      const s = engineState;
      const p = s.player;
      const k = s.keys;
      const cam = s.camera;
      const vp = s.viewport;
      if (typeof window !== 'undefined') {
        (window as any).pukaX = p.x;
      }
      if (vp.width <= 0 || vp.height <= 0) {
        rafId = requestAnimationFrame(gameLoop);
        return;
      }
      const theme = THEMES[selection().theme!];

    if (s.hitstopFrames > 0) {
      s.hitstopFrames--;
    } else if (!showTutorial() && !s.player.isDead) {
      if (s.timerFrozen && Date.now() >= s.timerFreezeEnd) {
        s.startTime += Date.now() - s.timerFreezeEnd;
        s.timerFrozen = false;
      }
      const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
      const timeLeft = TIME_LIMIT - elapsed;

      if (timeLeft <= 0 || p.y > 1500) {
        if (s.lives > 1) {
          s.lives--;
          p.x = p.lastSafeX || 100; p.y = (p.lastSafeY || 500) - 100;
          p.vx = 0; p.vy = 0;
          p.isGiant = false; p.hasPet = false; p.canDoubleJump = false;
          p.width = 40; p.height = 60; p.idleTimer = 0;
          p.state = PLAYER_STATE.NORMAL; p.stateTimer = 0;
          if (timeLeft <= 0) s.startTime = Date.now();
          setUiState((prev) => ({ ...prev, lives: s.lives, message: '¡VIDA PERDIDA!', messageType: 'error', playerState: PLAYER_STATE.NORMAL }));
          if (audioInst) audioInst.hurt();
          triggerShake(12, 200);
          triggerHitstop(3);
          } else {
            p.isDead = true;
            if (audioInst) audioInst.gameover();
            trackGameEvent('puka_game_over', { stage: currentLevelIndex(), score: s.score, timeLeft });
            setAppState(APP_STATE.GAME_OVER);
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

      if (p.attackCooldown > 0) p.attackCooldown -= 16.6;
      if (k.attack && ammo() > 0 && p.attackCooldown <= 0 && p.state !== PLAYER_STATE.TACHYCARDIA) {
        k.attack = false;
        setAmmo((prev) => Math.max(0, prev - 1));
        p.attackCooldown = 250;
        const projType = Math.random() > 0.5 ? ENTITY.PROJECTILE_KUNAI : ENTITY.PROJECTILE_SHURIKEN;
        s.projectiles.push({
          id: s.nextProjectileId++,
          type: projType,
          x: p.facingLeft ? p.x - 10 : p.x + p.width + 10,
          y: p.y + 15,
          vx: p.facingLeft ? -14 : 14,
          vy: 0,
          width: 24,
          height: 24,
          angle: 0,
          active: true,
          facingLeft: p.facingLeft,
        });
        if (audioInst) audioInst.shoot();
      }

      switch (p.state) {
        case PLAYER_STATE.CHEMICAL_RUSH:
          currentSpeed = BASE_SPEED * 2.8;
          if (Math.random() > 0.8) spawnParticle(p.x, p.y + 40, '#3b82f6', 1);
          if (p.stateTimer <= 0) {
            p.state = PLAYER_STATE.TACHYCARDIA; p.stateTimer = 4000;
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.TACHYCARDIA, message: '¡TAQUICARDIA! 😭', messageType: 'error' }));
            if (audioInst) audioInst.hurt();
            triggerShake(6, 200);
          }
          break;
        case PLAYER_STATE.TACHYCARDIA:
          currentSpeed = BASE_SPEED * 0.3;
          jumpMult = 0.5;
          p.x += (Math.random() - 0.5) * 4;
          if (audioInst && Date.now() - lastHeartbeatTime > 400) {
            lastHeartbeatTime = Date.now();
            audioInst.heartbeatTachycardia();
          }
          if (p.stateTimer <= 0) {
            p.isDead = true;
            if (audioInst) audioInst.gameover();
            trackGameEvent('puka_game_over', { stage: currentLevelIndex(), score: s.score, timeLeft });
            setAppState(APP_STATE.GAME_OVER);
            return;
          }
          break;
        case PLAYER_STATE.PUKA_OVERDRIVE:
          currentSpeed = BASE_SPEED * 2.5; jumpMult = 1.3;
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
      else p.vx *= currentLevelIndex() === 3 ? 0.88 : 0.8;

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
      if (p.x < cam.x) {
        p.x = cam.x;
        if (p.vx < 0) p.vx = 0;
      }
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

      // Animation tick — player
      {
        const moving = Math.abs(p.vx) > 0.5;
        const runFrames = SPRITE_FRAMES[SPRITE.PUKA_RUN] || 1;
        if (moving && p.grounded) {
          p.animTimer += 16.6;
          if (p.animTimer >= 120) {
            p.animTimer = 0;
            p.animFrame = (p.animFrame + 1) % runFrames;
          }
        } else {
          p.animFrame = 0;
          p.animTimer = 0;
        }
      }

      // Garu companion independent physics & AI
      s.companion.vy += GRAVITY;
      s.companion.y += s.companion.vy;

      let targetVx = BASE_SPEED;
      const distance = s.companion.x - p.x;
      if (p.state === PLAYER_STATE.TACHYCARDIA) {
        targetVx = 8;
      } else if (p.state === PLAYER_STATE.PUKA_OVERDRIVE) {
        targetVx = 10;
      } else if (distance < 160) {
        targetVx = Math.max(p.vx + 1.5, 7.5);
      } else if (distance > 300) {
        targetVx = Math.max(1, p.vx - 1);
      } else {
        targetVx = Math.max(p.vx, BASE_SPEED - 0.5);
      }
      s.companion.vx += (targetVx - s.companion.vx) * 0.1;
      s.companion.x += s.companion.vx;

      // Clamp Garu's position relative to Puka so he stays visible on the screen
      const minDistance = 100;
      const maxDistance = 320;
      const currentDistance = s.companion.x - p.x;
      if (currentDistance < minDistance) {
        s.companion.x = p.x + minDistance;
        s.companion.vx = Math.max(s.companion.vx, p.vx);
      } else if (currentDistance > maxDistance) {
        s.companion.x = p.x + maxDistance;
        s.companion.vx = Math.min(s.companion.vx, p.vx);
      }

      // Platform collision resolution for Garu
      s.companion.grounded = false;
      const nearbyForGaru = s.entities.filter((e) => e.type === ENTITY.PLATFORM && e.x < s.companion.x + 300 && e.x + e.width > s.companion.x - 300);
      for (const entity of nearbyForGaru) {
        if (isAABBCollision(s.companion, entity)) {
          const isHittingTop = s.companion.vy >= 0 && (s.companion.y + s.companion.height >= entity.y - 2) && (s.companion.y + s.companion.height - s.companion.vy <= entity.y + 15);
          
          if (isHittingTop) {
            s.companion.y = entity.y - s.companion.height;
            s.companion.vy = 0;
            s.companion.grounded = true;
          } else if (s.companion.vy < 0 && s.companion.y <= entity.y + entity.height && s.companion.y - s.companion.vy >= entity.y + entity.height - 15) {
            s.companion.y = entity.y + entity.height;
            s.companion.vy = 0;
          } else {
            s.companion.vx = 0;
            if (s.companion.x < entity.x) {
              s.companion.x = entity.x - s.companion.width;
              // Wall collision: Auto jump!
              if (s.companion.grounded) {
                s.companion.vy = JUMP_FORCE * 1.05;
                s.companion.grounded = false;
              }
            } else {
              s.companion.x = entity.x + entity.width;
            }
          }
        }
      }

      // Gap AI Jumping for Garu
      if (s.companion.grounded) {
        let platformAhead = false;
        const checkX = s.companion.x + 100;
        const checkY = s.companion.y + s.companion.height + 20;
        for (const entity of s.entities) {
          if (entity.type === ENTITY.PLATFORM) {
            if (checkX >= entity.x && checkX <= entity.x + entity.width && checkY >= entity.y && checkY <= entity.y + entity.height) {
              platformAhead = true;
              break;
            }
          }
        }
        if (!platformAhead) {
          s.companion.vy = JUMP_FORCE * 0.95;
          s.companion.grounded = false;
        }
      }

      // Respawn Garu in front of Puka if he falls off a cliff
      if (s.companion.y > 1500) {
        s.companion.x = p.x + 200;
        s.companion.y = p.y - 100;
        s.companion.vx = p.vx || BASE_SPEED;
        s.companion.vy = 0;
        s.companion.grounded = false;
      }

      // Animation tick — Garu
      {
        const garuMoving = Math.abs(s.companion.vx) > 0.5 && s.companion.grounded;
        const garuRunFrames = SPRITE_FRAMES[SPRITE.GARU_RUN] || 1;
        if (garuMoving) {
          s.companion.animTimer += 16.6;
          if (s.companion.animTimer >= 120) {
            s.companion.animTimer = 0;
            s.companion.animFrame = (s.companion.animFrame + 1) % garuRunFrames;
          }
        } else {
          s.companion.animFrame = 0;
          s.companion.animTimer = 0;
        }
      }

      // PUKA_OVERDRIVE victory check — catch Garu
      if (p.state === PLAYER_STATE.PUKA_OVERDRIVE && p.x >= s.companion.x) {
        p.isDead = true;
        if (audioInst) audioInst.victory();
        trackGameEvent('puka_campaign_victory', { finalCoins: s.score });
        if (!couponDone()) { applyGameCoupon(); setCouponDone(true); }
        setAppState(APP_STATE.VICTORY);
        return;
      }

      // Chemical projectile movement (thrown TRAP_CHEMICAL)
      s.entities.forEach((chem) => {
        if (chem.type === ENTITY.TRAP_CHEMICAL && chem.vx !== undefined && chem.active) {
          chem.x += chem.vx;
          chem.vy = (chem.vy || 0) + 0.3;
          chem.y += chem.vy;
          if (chem.x < cam.x - 200 || chem.x > cam.x + vp.width + 200 || chem.y > 1500) chem.active = false;
        }
      });

      // Projectile movement
      s.entities.forEach((proj) => {
        if (proj.type === ENTITY.PROJECTILE_BULL && proj.active) {
          proj.x += proj.vx!;
          if (proj.x < cam.x - 200 || proj.x > cam.x + vp.width + 200) proj.active = false;
        }
      });

      // NPC_ABYO patrol
      s.entities.forEach((abyo) => {
        if (abyo.type === ENTITY.NPC_ABYO && abyo.active) {
          abyo.x += abyo.vx!;
          if (abyo.x < abyo.startX! || abyo.x > abyo.startX! + abyo.range!) abyo.vx! *= -1;
        }
      });

      // ENEMY_NINJA patrol + shoot + chemical traps
      s.entities.forEach((ninja) => {
        if (ninja.type === ENTITY.ENEMY_NINJA && ninja.active) {
          ninja.x += ninja.vx!;
          if (ninja.x < ninja.startX! || ninja.x > ninja.startX! + ninja.range!) ninja.vx! *= -1;
          const now_ms = Date.now();
          if (!ninja.lastShot) ninja.lastShot = 0;
          if (now_ms - ninja.lastShot > COOLDOWN_SHURIKEN && Math.abs(p.x - ninja.x) < vp.width * 0.6) {
            ninja.lastShot = now_ms;
            const dir = p.x < ninja.x ? -1 : 1;
            s.entities.push({ type: ENTITY.PROJECTILE_BULL, x: ninja.x + (dir > 0 ? 40 : -20), y: ninja.y + 15, width: 16, height: 16, vx: dir * 5, vy: 0, active: true, emoji: '💨' });
          }
          if (!(ninja as any).chemTimer) {
            (ninja as any).chemTimer = now_ms + 2000 + Math.random() * 2000;
          }
          if (now_ms >= (ninja as any).chemTimer) {
            (ninja as any).chemTimer = now_ms + 2000 + Math.random() * 2000;
            const dir = p.x < ninja.x ? -1 : 1;
            const chemSpeed = 6 * (LEVEL_CONFIG[currentLevelIndex() as keyof typeof LEVEL_CONFIG]?.chemSpeedMult || 1);
            s.entities.push({ type: ENTITY.TRAP_CHEMICAL, x: ninja.x + (dir > 0 ? 40 : -20), y: ninja.y + 10, width: 24, height: 36, vx: dir * chemSpeed, vy: -3, active: true });
          }
        }
      });

      // Projectile physics and bounds culling
      s.projectiles.forEach((proj) => {
        if (!proj.active) return;
        proj.x += proj.vx;
        proj.y += proj.vy;
        if (proj.type === ENTITY.PROJECTILE_SHURIKEN) proj.angle += 0.25;
        if (proj.x < cam.x - 100 || proj.x > cam.x + vp.width + 100) proj.active = false;
      });
      s.projectiles = s.projectiles.filter((p) => p.active);

      // Broad-phase culling: only check nearby entities
      const nearby = s.entities.filter((e) => e.x < cam.x + vp.width + 200 && e.x + (e.width || 0) > cam.x - 200);

      for (const entity of nearby) {
        if (!entity.active && entity.type !== ENTITY.PLATFORM) continue;

        const isSolid = entity.type === ENTITY.PLATFORM;

        if (isSolid) {
          if (!isAABBCollision(p, entity)) continue;
          
          const isHittingTop = p.vy >= 0 && (p.y + p.height >= entity.y - 2) && (p.y + p.height - p.vy <= entity.y + 15);
          
          if (isHittingTop) {
            p.y = entity.y - p.height;
            p.vy = 0;
            p.grounded = true;
            p.lastSafeX = p.x;
            p.lastSafeY = p.y;
            if (p.hasPet) p.canDoubleJump = true;
            if (!wasGrounded) { p.squashX = 1.25; p.squashY = 0.75; }
          } else if (p.vy < 0 && p.y <= entity.y + entity.height && p.y - p.vy >= entity.y + entity.height - 15) {
            p.y = entity.y + entity.height;
            p.vy = 0;
          } else {
            p.vx = 0;
            if (p.x < entity.x) {
              p.x = entity.x - p.width;
            } else {
              p.x = entity.x + entity.width;
            }
          }
          continue;
        }

        if (!entity.active) continue;
        if (!isAABBCollision(p, entity)) continue;

        switch (entity.type) {
          case ENTITY.COIN: {
            entity.active = false; s.score += 1;
            if (audioInst) audioInst.coin();
            spawnParticle(entity.x, entity.y, '#ffd700', 8);
            break;
          }
          case ENTITY.ENEMY_NINJA: {
            if (p.vy > 0 && p.y + p.height - p.vy <= entity.y + 20) {
              entity.active = false; p.vy = JUMP_FORCE * 0.8;
              if (audioInst) audioInst.stomp();
              spawnParticle(entity.x, entity.y, theme.platformBottom, 15); s.score += 2;
            } else {
              handleHit(entity);
            }
            break;
          }
          case ENTITY.NPC_CHING: {
            entity.active = false;
            if (inventory().length < 2) {
              setInventory(prev => [...prev, 'PUKA_POWER']);
            }
            spawnFloatingText(entity.x, entity.y - 40, '¡Hola Pucca! ¡Toma un Puka Power para ir más rápido! ⚡🌸');
            if (audioInst) audioInst.powerup();
            spawnParticle(entity.x, entity.y, '#ffd700', 25);
            triggerShake(4, 150);
            break;
          }
          case ENTITY.NPC_ABYO: {
            entity.active = false;
            const sweepStart = entity.x;
            const sweepEnd = entity.x + 300;
            s.entities.forEach((e) => {
              if (e.type === ENTITY.ENEMY_NINJA && e.active && e.x >= sweepStart && e.x <= sweepEnd) {
                e.active = false;
                s.entities.push({ type: ENTITY.COIN, x: e.x, y: e.y, width: 30, height: 30, active: true, coinScale: 1 });
                s.entities.push({ type: ENTITY.COIN, x: e.x + 20, y: e.y - 20, width: 30, height: 30, active: true, coinScale: 1 });
              }
              if ((e.type === ENTITY.TRAP_CHEMICAL || e.type === ENTITY.PROJECTILE_BULL) && e.active && e.x >= sweepStart && e.x <= sweepEnd) {
                e.active = false;
              }
            });
            spawnFloatingText(entity.x, entity.y - 40, '¡KIAAA! ¡Siente la energía de Sooga, Pucca! 🥋💥');
            if (audioInst) audioInst.powerup();
            spawnParticle(entity.x, entity.y, '#ef4444', 30);
            triggerShake(8, 200);
            break;
          }
          case ENTITY.NPC_TIOS: {
            entity.active = false;
            s.timerFrozen = true;
            s.timerFreezeEnd = Date.now() + 5000;
            spawnFloatingText(entity.x, entity.y - 40, '¡Fideos de la felicidad listos! ¡Buen viaje, Pucca! 🍜🔋');
            if (audioInst) audioInst.powerup();
            spawnParticle(entity.x, entity.y, '#22c55e', 25);
            break;
          }
          case ENTITY.TRAP_CHEMICAL: {
            if (p.state === PLAYER_STATE.PUKA_OVERDRIVE) break;
            p.state = PLAYER_STATE.CHEMICAL_RUSH; p.stateTimer = 2000;
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.CHEMICAL_RUSH, message: '¡TRAMPA QUÍMICA! RUSH TÓXICO', messageType: 'warning' }));
            if (audioInst) { audioInst.hurt(); audioInst.rushEnergy(); }
            triggerShake(8, 250);
            spawnParticle(entity.x, entity.y, '#3b82f6', 30);
            entity.active = false;
            break;
          }
          case ENTITY.PROJECTILE_BULL: {
            entity.active = false;
            if (p.state === PLAYER_STATE.PUKA_OVERDRIVE) break;
            if (p.hasPet) {
              p.hasPet = false; p.canDoubleJump = false; p.vy = -6; p.vx = p.facingLeft ? 8 : -8;
              setUiState((prev) => ({ ...prev, message: '¡MASCOTA PERDIDA!', messageType: 'warning' }));
            } else if (p.isGiant) {
              p.isGiant = false; p.width = 40; p.height = 60; p.vy = -6; p.vx = p.facingLeft ? 8 : -8;
              setUiState((prev) => ({ ...prev, message: '¡PODER PERDIDO!', messageType: 'warning' }));
            } else {
              p.vx = p.facingLeft ? 10 : -10; p.vy = -5;
              s.score = Math.max(0, s.score - 1);
              setUiState((prev) => ({ ...prev, message: '¡SHURIKEN! -1 🪙', messageType: 'error' }));
            }
            if (audioInst) audioInst.hurt();
            triggerShake(8, 120);
            triggerHitstop(2);
            break;
          }
          case ENTITY.AMMO_BOX: {
            entity.active = false;
            setAmmo((prev) => Math.min(20, prev + 5));
            spawnFloatingText(entity.x, entity.y - 40, '+5 MUNICIÓN 🗡️');
            if (audioInst) audioInst.coin();
            spawnParticle(entity.x, entity.y, '#60a5fa', 10);
            break;
          }
          case ENTITY.GOAL: {
            const curLevel = currentLevelIndex();
            const cfg = LEVEL_CONFIG[curLevel as keyof typeof LEVEL_CONFIG];
            if (cfg && s.score < cfg.minCoins) {
              setUiState((prev) => ({ ...prev, message: `¡Necesitas ${cfg.minCoins} monedas! 🪙`, messageType: 'warning' }));
              break;
            }
            if (curLevel < 3) {
              p.isDead = true;
              if (audioInst) audioInst.victory();
              setTimeout(() => advanceToNextLevel(), 300);
              rafId = requestAnimationFrame(gameLoop);
              return;
            }
            p.isDead = true;
            if (audioInst) audioInst.victory();
            trackGameEvent('puka_campaign_victory', { finalCoins: s.score });
            if (!couponDone()) { applyGameCoupon(); setCouponDone(true); }
            setAppState(APP_STATE.VICTORY);
            return;
          }
        }
      }

      // Projectile vs entity collisions
      for (const proj of s.projectiles) {
        if (!proj.active) continue;
        const nearEntities = s.entities.filter((e) => e.x < cam.x + vp.width + 200 && e.x > cam.x - 200);
        for (const entity of nearEntities) {
          if (!entity.active) continue;
          if (!isAABBCollision(proj, entity)) continue;
          if (entity.type === ENTITY.PLATFORM) {
            proj.active = false;
            if (audioInst) audioInst.impactMetal();
            spawnParticle(proj.x, proj.y, '#FFD700', 5);
            break;
          }
          if (entity.type === ENTITY.ENEMY_NINJA) {
            proj.active = false;
            entity.active = false;
            s.score += 5;
            spawnFloatingScore(entity.x, entity.y - 40, '+5 PTS');
            spawnParticle(entity.x, entity.y, 'rgba(200,200,200,0.6)', 15);
            if (audioInst) audioInst.impactMetal();
            triggerHitstop(3);
            triggerShake(8, 150);
            break;
          }
        }
      }
      s.projectiles = s.projectiles.filter((p) => p.active);

      const targetCamX = p.x - getCameraOffset();
      cam.x += (targetCamX - cam.x) * 0.1;
      if (cam.x < 0) cam.x = 0;

      if (s.shakeTimer > 0) s.shakeTimer -= 16.6;

      s.floatingTexts.forEach((ft, idx) => {
        ft.life -= 16.6;
        ft.alpha = Math.max(0, ft.life / ft.maxLife);
        ft.y -= 0.5;
        if (ft.life <= 0) s.floatingTexts.splice(idx, 1);
      });
      s.floatingScores.forEach((fs, idx) => {
        fs.life -= 16.6;
        fs.y += fs.vy;
        if (fs.life <= 0) s.floatingScores.splice(idx, 1);
      });

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

    function handleHit(entity: Entity) {
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

    if (canvasEl) render(canvasEl.getContext('2d')!, s, theme);
    rafId = requestAnimationFrame(gameLoop);
    } catch (error) {
      console.error('Fallo crítico en gameLoop:', error);
      cancelAnimationFrame(rafId);
    }
  }

  function drawParallaxBackground(
    ctx: CanvasRenderingContext2D,
    themeId: ThemeId,
    scrollX: number,
    vw: number,
    vh: number,
  ) {
    // Clear screen with theme's sky/base background
    let bgGrad = ctx.createLinearGradient(0, 0, 0, vh);
    if (themeId === 'GOH_RONG') {
      bgGrad.addColorStop(0, '#1A080A');
      bgGrad.addColorStop(1, '#33080c');
    } else if (themeId === 'BAMBOO_FOREST') {
      bgGrad.addColorStop(0, '#02120b');
      bgGrad.addColorStop(1, '#0e2417');
    } else {
      bgGrad.addColorStop(0, '#0a0d1a');
      bgGrad.addColorStop(1, '#1b223c');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, vw, vh);

    // Layer 1: Far background (slowest movement, speed factor 0.05)
    ctx.save();
    const s1 = -scrollX * 0.05;
    ctx.translate(s1 % vw, 0);
    ctx.globalAlpha = 0.45;
    if (themeId === 'GOH_RONG') {
      // Far mountains
      ctx.fillStyle = '#4c1115';
      for (let i = -1; i < 3; i++) {
        const x = i * vw;
        ctx.beginPath();
        ctx.moveTo(x - 50, vh);
        ctx.lineTo(x + vw * 0.3, vh - 220);
        ctx.lineTo(x + vw * 0.6, vh - 120);
        ctx.lineTo(x + vw * 0.8, vh - 260);
        ctx.lineTo(x + vw + 50, vh);
        ctx.closePath();
        ctx.fill();
      }
    } else if (themeId === 'BAMBOO_FOREST') {
      // Misty sky mountains/clouds
      ctx.fillStyle = '#0f3825';
      for (let i = -1; i < 3; i++) {
        const x = i * vw;
        ctx.beginPath();
        ctx.moveTo(x - 100, vh);
        ctx.quadraticCurveTo(x + vw * 0.25, vh - 180, x + vw * 0.5, vh - 100);
        ctx.quadraticCurveTo(x + vw * 0.75, vh - 200, x + vw + 100, vh);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Snowy mountain peaks
      ctx.fillStyle = '#1e293b';
      for (let i = -1; i < 3; i++) {
        const x = i * vw;
        ctx.beginPath();
        ctx.moveTo(x - 20, vh);
        ctx.lineTo(x + vw * 0.25, vh - 320);
        ctx.lineTo(x + vw * 0.5, vh - 150);
        ctx.lineTo(x + vw * 0.75, vh - 350);
        ctx.lineTo(x + vw + 20, vh);
        ctx.closePath();
        ctx.fill();
        
        // Draw snow cap highlights
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(x + vw * 0.25 - 40, vh - 270);
        ctx.lineTo(x + vw * 0.25, vh - 320);
        ctx.lineTo(x + vw * 0.25 + 40, vh - 270);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#1e293b';
      }
    }
    ctx.restore();

    // Layer 2: Middle background (medium speed, speed factor 0.15)
    ctx.save();
    const s2 = -scrollX * 0.15;
    ctx.translate(s2 % vw, 0);
    ctx.globalAlpha = 0.55;
    if (themeId === 'GOH_RONG') {
      // Traditional houses (pagodas) - Raised higher for absolute visibility
      ctx.fillStyle = '#7B1113';
      for (let i = -1; i < 4; i++) {
        const bx = i * 400;
        ctx.fillRect(bx + 50, vh - 400, 150, 400);
        ctx.beginPath();
        ctx.moveTo(bx + 20, vh - 400);
        ctx.quadraticCurveTo(bx + 125, vh - 450, bx + 230, vh - 400);
        ctx.lineTo(bx + 200, vh - 385);
        ctx.lineTo(bx + 50, vh - 385);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(bx + 125, vh - 330, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.fillStyle = '#7B1113';
      }
    } else if (themeId === 'BAMBOO_FOREST') {
      // Blurred bamboo stalks
      ctx.filter = 'blur(2px)';
      ctx.fillStyle = '#14532d';
      for (let i = -1; i < 6; i++) {
        const bx = i * 250;
        ctx.fillRect(bx + 30, vh - 400, 12, 400);
        for (let y = vh - 350; y < vh; y += 80) {
          ctx.fillRect(bx + 28, y, 16, 4);
        }
      }
      ctx.filter = 'none';
    } else {
      // Steep rocky cliffs
      ctx.fillStyle = '#334155';
      for (let i = -1; i < 4; i++) {
        const bx = i * 450;
        ctx.beginPath();
        ctx.moveTo(bx, vh);
        ctx.lineTo(bx + 100, vh - 220);
        ctx.lineTo(bx + 220, vh - 200);
        ctx.lineTo(bx + 320, vh - 300);
        ctx.lineTo(bx + 400, vh - 180);
        ctx.lineTo(bx + 480, vh);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // Layer 3: Foreground (fast speed, speed factor 0.3)
    ctx.save();
    const s3 = -scrollX * 0.3;
    ctx.translate(s3 % vw, 0);
    ctx.globalAlpha = 0.7;
    if (themeId === 'GOH_RONG') {
      // Restaurant tables & columns
      ctx.fillStyle = '#3A0003';
      for (let i = -1; i < 5; i++) {
        const bx = i * 350;
        ctx.fillRect(bx + 80, 0, 18, vh);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(bx + 80, vh - 180, 18, 6);
        ctx.fillStyle = '#3A0003';
        ctx.fillRect(bx + 180, vh - 120, 120, 120);
        ctx.fillRect(bx + 160, vh - 130, 160, 12);
      }
    } else if (themeId === 'BAMBOO_FOREST') {
      // Crisp, defined vertical bamboos
      ctx.fillStyle = '#22c55e';
      for (let i = -1; i < 7; i++) {
        const bx = i * 200;
        ctx.fillRect(bx + 50, vh - 500, 14, 500);
        for (let y = vh - 450; y < vh; y += 70) {
          ctx.fillStyle = '#a3e635';
          ctx.fillRect(bx + 47, y, 20, 4);
        }
        ctx.fillStyle = '#22c55e';
      }
    } else {
      // Clouds passing by horizontally
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = -1; i < 4; i++) {
        const bx = i * 450;
        ctx.beginPath();
        ctx.arc(bx + 100, vh - 150, 40, 0, Math.PI * 2);
        ctx.arc(bx + 140, vh - 170, 50, 0, Math.PI * 2);
        ctx.arc(bx + 180, vh - 150, 40, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSpeechBubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
    ctx.save();
    ctx.font = 'bold 11px Arial';
    const textWidth = ctx.measureText(text).width;
    const bubbleWidth = textWidth + 16;
    const bubbleHeight = 24;
    const bx = x - bubbleWidth / 2;
    const by = y - bubbleHeight - 12;

    // Draw bubble background
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bubbleWidth, bubbleHeight, 6) : ctx.rect(bx, by, bubbleWidth, bubbleHeight);
    ctx.fill();
    ctx.stroke();

    // Draw triangle pointing down
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 6, by + bubbleHeight);
    ctx.lineTo(x, by + bubbleHeight + 8);
    ctx.lineTo(x + 6, by + bubbleHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw text
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, by + bubbleHeight / 2);
    ctx.restore();
  }

  function render(ctx: CanvasRenderingContext2D, s: typeof engineState, theme: typeof THEMES[keyof typeof THEMES]) {
    const { camera, viewport, player } = s;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const now = Date.now();

    ctx.save();

    if (s.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * s.shakeIntensity;
      const sy = (Math.random() - 0.5) * s.shakeIntensity;
      ctx.translate(sx, sy);
    }

    drawParallaxBackground(ctx, theme.id, camera.x, viewport.width, viewport.height);

    ctx.save();
    ctx.translate(-camera.x, 0);

    // Floating texts
    ctx.textBaseline = 'middle';
    s.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillText(ft.text, ft.x + 20, ft.y - 40);
      ctx.restore();
    });
    // Floating scores
    s.floatingScores.forEach((fs) => {
      ctx.save();
      ctx.globalAlpha = fs.life / fs.maxLife;
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillText(fs.text, fs.x + 20, fs.y);
      ctx.restore();
    });
    ctx.globalAlpha = 1;

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
      } else if (entity.type === ENTITY.ENEMY_NINJA && entity.active) {
        drawSprite(ctx, SPRITE.NINJA, 0, entity.x, entity.y, entity.width, entity.height, (entity.vx ?? 0) > 0);
      } else if (entity.type === ENTITY.NPC_CHING && entity.active) {
        ctx.save();
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 25;
        drawSprite(ctx, SPRITE.CHING, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#ffd700'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('CHING', entity.x, entity.y - 8);
        
        // Floating Puka Power can above head!
        drawSprite(ctx, SPRITE.PUKA_POWER, 0, entity.x + entity.width / 2 - 12, entity.y - 45, 24, 36);
        // Speech Bubble
        drawSpeechBubble(ctx, "¡Hola Pucca! ¡Toma un Puka Power para ir más rápido! ⚡🌸", entity.x + entity.width / 2, entity.y - 48);
      } else if (entity.type === ENTITY.NPC_ABYO && entity.active) {
        ctx.save();
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15;
        drawSprite(ctx, SPRITE.ABYO, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('ABYO', entity.x, entity.y - 8);
        
        // Speech Bubble
        drawSpeechBubble(ctx, "¡KIAAA! ¡Siente la energía de Sooga, Pucca! 🥋💥", entity.x + entity.width / 2, entity.y - 8);
      } else if (entity.type === ENTITY.NPC_TIOS && entity.active) {
        ctx.save();
        ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 20;
        drawSprite(ctx, SPRITE.CAT, 0, entity.x, entity.y, 40, 40);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#22c55e'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('TÍOS', entity.x, entity.y - 8);
        
        // Speech Bubble
        drawSpeechBubble(ctx, "¡Fideos de la felicidad listos! ¡Buen viaje, Pucca! 🍜🔋", entity.x + 20, entity.y - 8);
      } else if (entity.type === ENTITY.TRAP_CHEMICAL && entity.active) {
        ctx.save();
        const spriteSrc = (Math.floor(entity.x) % 2 === 0) ? SPRITE.RED_BULL : SPRITE.MONSTER;
        drawSprite(ctx, spriteSrc, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.restore();
      } else if (entity.type === ENTITY.PROJECTILE_BULL && entity.active) {
        ctx.save();
        ctx.font = '24px Arial'; ctx.textAlign = 'left';
        ctx.fillText('💨', entity.x, entity.y);
        ctx.restore();
      } else if (entity.type === ENTITY.AMMO_BOX && entity.active) {
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(now / 250) * 0.3;
        ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 15;
        drawSprite(ctx, SPRITE.PUKA_ATTACK, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 12px Arial'; ctx.fillStyle = '#60a5fa'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('AMMO', entity.x, entity.y - 8);
      } else if (entity.type === ENTITY.GOAL) {
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '100px Arial'; ctx.fillText(theme.goalEmoji, entity.x, entity.y);
      }
    });

    if (DEBUG_MODE) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1.5;
      s.entities.forEach((e) => {
        if (!e.active && e.type !== ENTITY.PLATFORM) return;
        ctx.strokeRect(e.x, e.y, e.width, e.height);
      });
    }

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

    // Render projectiles (Kunai / Shuriken)
    s.projectiles.forEach((proj) => {
      if (!proj.active) return;
      ctx.save();
      ctx.translate(proj.x + proj.width / 2, proj.y + proj.height / 2);
      if (proj.type === ENTITY.PROJECTILE_SHURIKEN) {
        ctx.rotate(proj.angle);
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', 0, 0);
      } else {
        ctx.font = '22px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🗡️', 0, 0);
      }
      ctx.restore();
    });

    // Garu companion
    ctx.save();
    if (player.state === PLAYER_STATE.TACHYCARDIA) {
      ctx.shadowColor = 'rgba(255,0,0,0.5)';
      ctx.shadowBlur = 20;
      drawSprite(ctx, SPRITE.GARU_SCARED, 0, s.companion.x, s.companion.y, s.companion.width, s.companion.height, player.facingLeft);
      ctx.shadowBlur = 0;
    } else {
      const garuMoving = Math.abs(s.companion.vx) > 0.5 && s.companion.grounded;
      if (garuMoving) {
        drawSprite(ctx, SPRITE.GARU_RUN, s.companion.animFrame, s.companion.x, s.companion.y, s.companion.width, s.companion.height, player.facingLeft);
      } else {
        drawSprite(ctx, SPRITE.GARU_IDLE, 0, s.companion.x, s.companion.y, s.companion.width, s.companion.height, player.facingLeft);
      }
    }
    ctx.restore();
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#a855f7';
    ctx.textAlign = 'center';
    ctx.fillText('GARU', s.companion.x + s.companion.width / 2, s.companion.y - 12);

    ctx.save();

    // Ghost trail for PUKA_OVERDRIVE
    for (const g of player.ghosts) {
      ctx.globalAlpha = g.alpha * 0.3;
      const ghostSprite = SPRITE.PUKA_RUN;
      drawSprite(ctx, ghostSprite, player.animFrame, g.x, g.y, player.width, player.height, player.facingLeft);
    }
    ctx.globalAlpha = 1;

    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE) { ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 30; }
    else if (player.state === PLAYER_STATE.TACHYCARDIA) {
      ctx.filter = 'hue-rotate(130deg) contrast(175%) saturate(250%)';
    } else if (player.sugarCrashTimer > 0) {
      ctx.filter = 'saturate(30%) brightness(60%)';
    }

    // Determine which sprite to use based on state
    let currentSrc = SPRITE.PUKA_IDLE;
    let currentFrame = 0;
    const moving = Math.abs(player.vx) > 0.5;

    if (player.isDead) {
      currentSrc = SPRITE.PUKA_IDLE;
      currentFrame = 0;
    } else if (player.state === PLAYER_STATE.TACHYCARDIA) {
      currentSrc = SPRITE.PUKA_JUMP;
      currentFrame = 0;
    } else if (!player.grounded) {
      currentSrc = SPRITE.PUKA_JUMP;
      currentFrame = 0;
      // Vertical bob for jumping
      const jb = Math.sin(now / 120) * 3;
      if (player.vy < -2) {
        // Rising — show upward sprite
      }
    } else if (moving) {
      currentSrc = SPRITE.PUKA_RUN;
      currentFrame = player.animFrame;
    } else if (player.idleTimer > 3000) {
      currentSrc = SPRITE.PUKA_IDLE;
      currentFrame = 0;
    } else {
      currentSrc = SPRITE.PUKA_IDLE;
      currentFrame = 0;
    }

    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;

    if (player.hasPet) {
      ctx.shadowColor = 'rgba(255,75,75,1)'; ctx.shadowBlur = 20;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(player.squashX, player.squashY);
      // Draw pet cat (small sprite above player)
      drawSprite(ctx, SPRITE.CAT, 0, -player.width / 2, -player.height / 2 - 15, 24, 24, player.facingLeft);
      ctx.restore();
      ctx.shadowBlur = 0;
      // Draw player below the pet
      ctx.save();
      ctx.translate(cx, cy + 12);
      ctx.scale(player.squashX, player.squashY);
      if (moving && player.grounded) ctx.translate(0, Math.abs(Math.sin(now / 60)) * -3);
      drawSprite(ctx, currentSrc, currentFrame, -player.width / 2, -player.height / 2, player.width, player.height, player.facingLeft);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(player.squashX, player.squashY);
      if (moving && player.grounded) {
        ctx.translate(0, Math.abs(Math.sin(now / 80)) * -4);
      }
      ctx.save();
      drawSprite(ctx, currentSrc, currentFrame, -player.width / 2, -player.height / 2, player.width, player.height, player.facingLeft);
      ctx.restore();
      ctx.restore();
    }

    // PUKA_OVERDRIVE lightning bolts
    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE && !player.isDead) {
      const pt = now / 150;
      ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffd700';
      ctx.fillText('⚡', cx + Math.cos(pt) * (player.width * 0.9), cy + Math.sin(pt) * (player.height * 0.7));
      ctx.fillText('⚡', cx + Math.cos(pt + Math.PI) * (player.width * 0.9), cy + Math.sin(pt + Math.PI) * (player.height * 0.7));
      ctx.shadowBlur = 0;
    }

    // Idle sleep Zzz
    if (player.idleTimer > 3000 && !player.isDead) {
      ctx.font = '25px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText('💤', cx, cy - player.height / 2 - 20 + Math.sin(now / 200) * 5);
    }

    if (DEBUG_MODE) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(player.x, player.y, player.width, player.height);
      ctx.strokeRect(s.companion.x, s.companion.y, s.companion.width, s.companion.height);
    }

    ctx.filter = 'none';
    ctx.restore();

    ctx.restore();

    ctx.restore();
  }

  function consumeBoost() {
    const p = engineState.player;
    if (inventory().length <= 0) return;
    if (p.state === PLAYER_STATE.PUKA_OVERDRIVE) return;
    if (p.isDead || appState() !== APP_STATE.PLAYING) return;
    setInventory(prev => prev.slice(1));
    p.state = PLAYER_STATE.PUKA_OVERDRIVE;
    p.stateTimer = 5000;
    if (audioInst) { audioInst.powerup(); audioInst.rushEnergy(); }
    setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.PUKA_OVERDRIVE, message: '¡PUKA OVERDRIVE! ⚡🌸', messageType: 'success' }));
    triggerShake(6, 200);
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

      preloadAssets().then(() => {
        cancelAnimationFrame(rafId);
        const w = containerEl!.clientWidth || window.innerWidth;
        const h = containerEl!.clientHeight || window.innerHeight;
        canvasEl!.width = w;
        canvasEl!.height = h;
        engineState.viewport = { width: w, height: h };
        rafId = requestAnimationFrame(gameLoop);
      });

      const onVisibility = () => { engineState.isPaused = document.hidden; };
      document.addEventListener('visibilitychange', onVisibility);

      const hKD = (e: KeyboardEvent) => {
        if (appState() !== APP_STATE.PLAYING) return;
        if (e.code === 'ArrowLeft') engineState.keys.left = true;
        if (e.code === 'ArrowRight') engineState.keys.right = true;
        if (e.code === 'ArrowUp' || e.code === 'Space') {
          if (!engineState.keys.up) engineState.keys.upJustPressed = true;
          engineState.keys.up = true;
        }
        if (e.code === 'ShiftLeft' || e.code === 'KeyC') {
          consumeBoost();
        }
        if (e.code === 'KeyF' || e.code === 'KeyX') {
          engineState.keys.attack = true;
        }
      };
      const hKU = (e: KeyboardEvent) => {
        if (e.code === 'ArrowLeft') engineState.keys.left = false;
        if (e.code === 'ArrowRight') engineState.keys.right = false;
        if (e.code === 'ArrowUp' || e.code === 'Space') engineState.keys.up = false;
        if (e.code === 'KeyF' || e.code === 'KeyX') engineState.keys.attack = false;
      };
      window.addEventListener('keydown', hKD);
      window.addEventListener('keyup', hKU);

      onCleanup(() => {
        window.removeEventListener('keydown', hKD);
        window.removeEventListener('keyup', hKU);
        document.removeEventListener('visibilitychange', onVisibility);
        cancelAnimationFrame(rafId);
        ro.disconnect();
      });
    });

    const ui = uiState();
    const pst = ui.playerState;
    const s = engineState;
    const isPuka = pst === PLAYER_STATE.PUKA_OVERDRIVE || s.player.hasPet;
    const isRush = pst === PLAYER_STATE.CHEMICAL_RUSH;
    const isTachy = pst === PLAYER_STATE.TACHYCARDIA;
    const inv = inventory();

    const progressPct = s.totalLevelLength > 0 ? Math.min(100, Math.max(0, (s.player.x / s.totalLevelLength) * 100)) : 0;

    return (
      <div class="fixed inset-0 bg-black overflow-hidden select-none font-sans">
        <div class="absolute top-0 left-0 right-0 z-30 flex justify-between items-start p-2 sm:p-3 pointer-events-none">
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
            <div class="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-700/50 shadow-lg"
              classList={{ 'animate-pulse border-red-500/50': ammo() === 0 }}>
              <span class="text-sm sm:text-base">🗡️</span>
              <span class="text-lg sm:text-xl font-black"
                classList={{ 'text-red-500': ammo() === 0, 'text-blue-300': ammo() > 0 }}>{ammo()}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-xl sm:text-2xl font-black bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-700/50"
              classList={{ 'text-red-500': ui.timeLeft < 15, 'text-white': ui.timeLeft >= 15 }}>
              {Math.floor(ui.timeLeft / 60)}:{(ui.timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        <div class="absolute top-12 sm:top-14 left-2 sm:left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[10px] sm:text-xs tracking-wide transition-colors pointer-events-none"
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
          {isPuka ? 'PUKA OVERDRIVE' : isRush ? 'CHEMICAL RUSH' : isTachy ? 'TACHYCARDIA' : 'SISTEMA ESTABLE'}
        </div>

        <Show when={!showTutorial()}>
          <div class="absolute top-12 sm:top-14 right-2 sm:right-3 z-30 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-900/30 backdrop-blur-sm pointer-events-auto"
            classList={{ 'opacity-40': inv.length === 0 }}>
            <span class="text-[10px] sm:text-xs font-bold text-purple-300 mr-1">INV</span>
            {Array.from({ length: 2 }).map((_, i) => (
              <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-md border flex items-center justify-center text-xs transition-all duration-200"
                classList={{
                  'border-yellow-400/60 bg-yellow-400/20 shadow-[0_0_8px_rgba(234,179,8,0.3)]': i < inv.length,
                  'border-slate-600/30 bg-slate-800/30': i >= inv.length,
                }}>
                {i < inv.length ? (
                  <img src="/sprites/Puka-Power.png" class="w-5 h-5 object-contain" />
                ) : ''}
              </div>
            ))}
            <button
              onClick={() => consumeBoost()}
              disabled={inv.length === 0}
              classList={{
                'opacity-30 cursor-not-allowed': inv.length === 0,
                'hover:bg-purple-500/30 active:scale-90': inv.length > 0,
              }}
              class="ml-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-md border border-yellow-400/40 bg-yellow-400/10 flex items-center justify-center text-xs transition-all duration-100">
              ⚡
            </button>
          </div>
        </Show>

        <div class="absolute top-0 left-0 right-0 z-30 flex justify-center pt-1 sm:pt-2 px-20">
          <div class="w-full max-w-lg flex items-center gap-2">
            <span class="text-[10px] sm:text-xs font-bold text-slate-400 bg-slate-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded border border-slate-700/40 shrink-0">
              NIVEL {currentLevelIndex()}/3
            </span>
            <div class="flex-1 bg-slate-900/60 backdrop-blur-sm rounded-full h-1.5 sm:h-2 overflow-hidden border border-slate-700/40">
              <div class="h-full rounded-full transition-all duration-300 ease-out"
                classList={{
                  'bg-gradient-to-r from-red-500 to-orange-400': progressPct < 40,
                  'bg-gradient-to-r from-orange-400 to-yellow-400': progressPct >= 40 && progressPct < 70,
                  'bg-gradient-to-r from-yellow-400 to-green-400': progressPct >= 70,
                }}
                style={{ width: `${progressPct}%` }} />
            </div>
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

        <div class="relative w-full h-[85vh] lg:h-[90vh] bg-[url('/sprites/portada.png')] bg-cover bg-center bg-no-repeat overflow-hidden">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-none z-0"></div>
          <div ref={containerEl} class="absolute inset-0 mx-auto max-w-[1920px]">
            <canvas ref={canvasEl} class="relative z-10 w-full h-full block" style={{ 'image-rendering': 'pixelated' }} />
          </div>
        </div>

        <Show when={!showTutorial()}>
          <div class="absolute bottom-3 sm:bottom-6 left-0 right-0 px-3 sm:px-6 flex justify-between items-end z-30 md:hidden">
            <div class="flex gap-3 sm:gap-4">
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.left = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.left = false; }} onMouseDown={() => { engineState.keys.left = true; }} onMouseUp={() => { engineState.keys.left = false; }} class="w-16 h-16 sm:w-20 sm:h-20 bg-black/60 backdrop-blur-sm rounded-2xl border-2 border-white/15 text-white text-2xl sm:text-3xl font-black touch-none active:bg-white/20 active:scale-90 transition-all duration-100 shadow-lg flex items-center justify-center">{'\u2190'}</button>
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.right = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.right = false; }} onMouseDown={() => { engineState.keys.right = true; }} onMouseUp={() => { engineState.keys.right = false; }} class="w-16 h-16 sm:w-20 sm:h-20 bg-black/60 backdrop-blur-sm rounded-2xl border-2 border-white/15 text-white text-2xl sm:text-3xl font-black touch-none active:bg-white/20 active:scale-90 transition-all duration-100 shadow-lg flex items-center justify-center">{'\u2192'}</button>
            </div>
            <div class="flex gap-3 sm:gap-4 items-end">
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.attack = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.attack = false; }} onMouseDown={() => { engineState.keys.attack = true; }} onMouseUp={() => { engineState.keys.attack = false; }}
                class="w-14 h-14 sm:w-18 sm:h-18 bg-blue-500/20 backdrop-blur-sm rounded-2xl border-2 border-blue-500/40 text-blue-300 text-xl sm:text-2xl font-black touch-none active:bg-blue-500/40 active:scale-90 transition-all duration-100 shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center justify-center">
                🗡️
              </button>
              <button onTouchStart={(e) => { e.preventDefault(); consumeBoost(); }} onMouseDown={() => { consumeBoost(); }} disabled={inv.length === 0}
                classList={{ 'opacity-40': inv.length === 0 }}
                class="w-14 h-14 sm:w-18 sm:h-18 bg-yellow-500/20 backdrop-blur-sm rounded-2xl border-2 border-yellow-500/40 text-yellow-300 text-xl sm:text-2xl font-black touch-none active:bg-yellow-500/40 active:scale-90 transition-all duration-100 shadow-[0_0_15px_rgba(234,179,8,0.15)] flex items-center justify-center">
                ⚡
              </button>
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING && !engineState.keys.up) engineState.keys.upJustPressed = true; engineState.keys.up = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.up = false; }} onMouseDown={() => { if (!engineState.keys.up) engineState.keys.upJustPressed = true; engineState.keys.up = true; }} onMouseUp={() => { engineState.keys.up = false; }} class="w-20 h-20 sm:w-24 sm:h-24 bg-red-500/30 backdrop-blur-sm rounded-2xl border-2 border-red-500/50 text-white text-3xl sm:text-4xl font-black touch-none shadow-[0_0_20px_rgba(239,68,68,0.2)] active:bg-red-500/60 active:scale-90 transition-all duration-100 flex items-center justify-center">{'\u2191'}</button>
            </div>
          </div>
        </Show>
      </div>
    );
  }

  return (
    <>
      <Switch>
        <Match when={appState() === APP_STATE.START_SCREEN}>
          <div class="w-screen h-screen overflow-hidden relative bg-[url('/sprites/portada.png')] bg-cover bg-center bg-no-repeat">
            <button
              onClick={() => startGame(THEMES.GOH_RONG.id)}
              class="absolute bottom-[15%] left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-500 text-white font-black text-3xl sm:text-5xl py-5 px-16 rounded-2xl shadow-2xl shadow-red-500/40 hover:shadow-red-500/60 hover:scale-105 active:scale-95 transition-all duration-200 uppercase tracking-widest border-2 border-red-400/30">
              EMPEZAR
            </button>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.CHARACTER_SELECTION}>
          <div class="w-screen h-screen overflow-hidden relative bg-[url('/sprites/portada.png')] bg-cover bg-center bg-no-repeat">
            <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <a href="/tienda"
              class="absolute top-6 left-6 z-20 flex items-center gap-1 text-sm text-slate-400 hover:text-yellow-400 transition-colors">
              <svg class="w-5 h-5 mr-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Volver a la Tienda
            </a>
            <div class="relative z-10 w-full h-full flex flex-col items-center justify-center p-4">
              <h1 class="text-5xl sm:text-7xl font-black text-white drop-shadow-[0_0_20px_rgba(0,0,0,0.9)] mb-4 sm:mb-6 tracking-tight text-center">
                PUKA POWER
              </h1>
              <button
                onClick={() => startGame(THEMES.GOH_RONG.id)}
                class="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-xl sm:text-2xl py-4 px-14 rounded-full shadow-2xl shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-200 uppercase tracking-wider border-2 border-red-400/30">
                COMENZAR
              </button>
            </div>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.GAME_OVER}>
          <div class="w-full min-h-screen bg-gradient-to-br from-slate-900 via-red-950/50 to-slate-900 text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div class="absolute inset-0 opacity-10">
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600 rounded-full blur-3xl animate-pulse" />
            </div>
            <a href="/tienda"
              class="absolute top-6 left-6 flex items-center gap-1 text-sm text-slate-400 hover:text-yellow-400 transition-colors z-10">
              {iconArrowLeft} Volver a la Tienda
            </a>
            <div class="relative z-10">
              <div class="text-8xl mb-6 grayscale opacity-60 animate-pulse">{'\u{1F480}'}</div>
              <h1 class="text-6xl sm:text-7xl font-black uppercase mb-4 text-red-500 drop-shadow-[0_0_20px_rgba(220,38,38,0.3)]">Game Over</h1>
              <p class="text-xl sm:text-2xl text-slate-300 mb-2">Nivel {currentLevelIndex()}/3</p>
              <p class="text-xl sm:text-2xl text-slate-300 mb-4">Monedas recolectadas: <span class="text-yellow-400 font-bold drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">{uiState().coins} {'\u{1FA99}'}</span></p>
              <p class="text-base text-slate-500 mb-8">¡No te rindas! El poder del rayo te espera.</p>
              <button onClick={() => setAppState(APP_STATE.START_SCREEN)}
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
            <a href="/tienda"
              class="absolute top-6 left-6 flex items-center gap-1 text-sm text-slate-400 hover:text-yellow-400 transition-colors z-10">
              {iconArrowLeft} Volver a la Tienda
            </a>
            <div class="relative z-10">
              <div class="text-8xl sm:text-9xl mb-6 animate-bounce drop-shadow-[0_0_30px_rgba(34,197,94,0.3)]">{'\u{1F3C6}'}</div>
              <h1 class="text-5xl sm:text-6xl font-black uppercase mb-2 text-green-400 drop-shadow-[0_0_20px_rgba(34,197,94,0.3)]">{'\u{00A1}'}Campaña completada!</h1>
              <p class="text-lg sm:text-xl text-slate-300 mb-2">Nivel {currentLevelIndex()}/3</p>
              <p class="text-xl sm:text-2xl text-slate-300 mb-4">Monedas recolectadas: <span class="text-yellow-400 font-bold drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">{uiState().coins} {'\u{1FA99}'}</span></p>
              <Show when={couponDone()}>
                <div class="bg-green-500/20 backdrop-blur-sm border-2 border-green-500/50 text-green-400 font-bold px-6 py-3 rounded-xl mb-6 text-lg animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.15)]">
                  {'\u{1F389}'} Cupón BOLT15 activado — 15% de descuento
                </div>
              </Show>
              <Show when={!couponDone()}>
                <button
                  onClick={() => {
                    applyGameCoupon();
                    setCouponDone(true);
                    window.location.href = '/tienda';
                  }}
                  class="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-lg sm:text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.3)] mx-auto mb-4">
                  {'\u{1F389}'} Canjear descuento ahora
                </button>
              </Show>
              <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => setAppState(APP_STATE.START_SCREEN)}
                  class="bg-red-500 hover:bg-red-600 text-white font-black text-lg sm:text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                  {iconPlay} JUGAR DE NUEVO
                </button>
                <a href="/tienda"
                  class="bg-slate-700 hover:bg-slate-600 text-white font-black text-lg sm:text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105">
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
                <span><strong class="text-white">Recolecta monedas</strong> y busca a los personajes de Sooga</span>
              </li>
              <li class="flex items-start gap-3 p-2 rounded-lg bg-white/5">
                <span class="text-xl flex-shrink-0">{'\u{1F3C1}'}</span>
                <span><strong class="text-white">¡Cuidado! Ninjas, trampas y rivales</strong> en tu camino a la meta</span>
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
