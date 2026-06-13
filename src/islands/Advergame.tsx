import { createSignal, Switch, Match, Show, onMount, onCleanup } from 'solid-js';
import { markGameWon } from '@/store/cartStore';

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

// Hearts system: 1 full heart = 2 half-hearts internally.
// So lives ranges from 0 to LIVES_MAX*2 (e.g. 0..6 for 3 full hearts).
const LIVES_MAX = 3;
const LIVES_MAX_HALVES = LIVES_MAX * 2;
const HITSTUN_MS = 350;
const PROJECTILE_KNOCKBACK_VX = 6;
const PROJECTILE_KNOCKBACK_VY = -4;
const NINJA_KNOCKBACK_VX = 7;
const NINJA_KNOCKBACK_VY = -5;

const SPRITE = {
  PUKA_RUN: '/sprites/pucca_animacion_caminata_sprite_sheet.png',
  PUKA_IDLE: '/sprites/pucca_idle_cuerpo_completo.png',
  PUKA_JUMP: '/sprites/puka_saltando_hacia_arriba.png',
  PUKA_ATTACK: '/sprites/pucca_guerrera_gato_espada.png',
  PUKA_VICTORY: '/sprites/pucca_abrazando_garu_mareado_victoria.png',
  PUKA_LAUGH: '/sprites/pucca_risa_inclinada.png',
  GARU_RUN: '/sprites/garu_animacion_carrera_sprite_sheet.png',
  GARU_IDLE: '/sprites/garu_de_pie_enojado.png',
  GARU_LOVE: '/sprites/garu_ojos_corazon_fondo_rosa.png',
  GARU_SCARED: '/sprites/garu_asustado_inclinado_derecha.png',
  NINJA: '/sprites/enemigo_ninja_morado_espada.png',
  NINJA2: '/sprites/enemigo2_pucca.png',
  NINJA_MALO_2: '/sprites/ninja-malo-2.png',
  CHING: '/sprites/personaje_cocinero_rojo_con_cubos_variante.png',
  ABYO: '/sprites/npc_abyo_luchador.png',
  CAT: '/sprites/gato_negro_cuerpo_completo.png',
  PORTADA: '/sprites/portada.png',
  PUKA_POWER: '/sprites/Puka-Power.png',
  RED_BULL: '/sprites/red-bull.png',
  MONSTER: '/sprites/monster.png',
  MALA_PUCCA: '/sprites/mala_pucca.png',
  CAT_PUKA_POWER: '/sprites/Gato-Tomando-Puka-Power.png',
  GARU_ATTACK: '/sprites/garu_con_pose_de_ataque.png',
  SHURIKEN: '/sprites/shuriken.png',
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
  [SPRITE.PUKA_LAUGH]: { w: 40, h: 60 },
  [SPRITE.GARU_RUN]: { w: 40, h: 60 },
  [SPRITE.GARU_IDLE]: { w: 40, h: 60 },
  [SPRITE.GARU_LOVE]: { w: 40, h: 60 },
  [SPRITE.GARU_SCARED]: { w: 40, h: 60 },
  [SPRITE.NINJA]: { w: 40, h: 60 },
  [SPRITE.NINJA2]: { w: 40, h: 60 },
  [SPRITE.NINJA_MALO_2]: { w: 40, h: 60 },
  [SPRITE.CHING]: { w: 48, h: 72 },
  [SPRITE.ABYO]: { w: 44, h: 66 },
  [SPRITE.CAT]: { w: 40, h: 40 },
  [SPRITE.PORTADA]: { w: 800, h: 600 },
  [SPRITE.PUKA_POWER]: { w: 30, h: 45 },
  [SPRITE.RED_BULL]: { w: 24, h: 48 },
  [SPRITE.MONSTER]: { w: 24, h: 48 },
  [SPRITE.MALA_PUCCA]: { w: 40, h: 60 },
  [SPRITE.CAT_PUKA_POWER]: { w: 45, h: 45 },
[SPRITE.SHURIKEN]: { w: 24, h: 24 },
  [SPRITE.GARU_ATTACK]: { w: 40, h: 60 },
};

const DEBUG_MODE = false;

const imageCache = new Map<string, HTMLImageElement>();
let assetsPreloaded = false;

function loadImage(src: string, retries = 3): Promise<void> {
  return new Promise<void>((resolve) => {
    const attempt = (remaining: number) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => {
        if (remaining > 0) attempt(remaining - 1);
        else resolve();
      }, 8000);
      img.onload = () => {
        clearTimeout(timeout);
        imageCache.set(src, img);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        if (remaining > 0) attempt(remaining - 1);
        else resolve();
      };
      img.src = src;
    };
    attempt(retries);
  });
}

function preloadAssets(): Promise<void> {
  if (assetsPreloaded) {
    return Promise.resolve();
  }
  const paths = Object.values(SPRITE);
  const promises = paths.map((src) => loadImage(src));
  return Promise.allSettled(promises).then(() => {
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
  1: { segments: 20, minCoins: 3, name: 'El Restaurante Goh-Rong', themeId: 'GOH_RONG' as ThemeId, chemSpeedMult: 1.0 },
  2: { segments: 30, minCoins: 5, name: 'El Bosque de Bambú Místico', themeId: 'BAMBOO_FOREST' as ThemeId, chemSpeedMult: 1.4 },
  3: { segments: 40, minCoins: 0, name: 'La Montaña de la Tortuga Sagrada', themeId: 'TURTLE_MOUNTAIN' as ThemeId, chemSpeedMult: 1.0 },
};

const APP_STATE = { START_SCREEN: 0, CHARACTER_SELECTION: 1, PLAYING: 2, GAME_OVER: 3, VICTORY: 4, LEVEL_COMPLETED: 5 } as const;

const ENTITY = {
  PLATFORM: 0, COIN: 1, ENEMY_NINJA: 2, GOAL: 3,
  NPC_CHING: 4, NPC_ABYO: 5, NPC_TIOS: 6,
  TRAP_CHEMICAL: 7, PROJECTILE_BULL: 8,
  PROJECTILE_KUNAI: 9, PROJECTILE_SHURIKEN: 10, AMMO_BOX: 11,
  NPC_MALA_PUCCA: 12,
  NPC_CAT_PUKA_POWER: 13,
} as const;

// ============ Per-level NPC dialogs ============
// Each level features a different character with a unique dialog. The
// chef (CHING) is the level-1 ally, the warrior (ABYO) is the level-2
// ally, the cat (TIOS) is a level-1-and-2 helper, and the level-3
// finale is a cinemática (no NPC dialog).
interface LevelNpcDialog {
  name: string;
  text: string;
}

const NPC_DIALOGS: Record<'ching' | 'abyo' | 'tios', Record<number, LevelNpcDialog>> = {
  // CHEF CHING — el cocinero rojo (aparece en niveles 1 y 2)
  ching: {
    1: { name: 'CHING', text: '¡Fideos de la velocidad! Por tu ritmo te preparé unos noodles. ¡Toma este Puka Power, antes de que se enfríe! 🍜⚡' },
    2: { name: 'CHING', text: '¡Wok caliente, ninja veloz! Esta vez el ramen viene con extra energía Sooga. ¡No te detengas! 🍜' },
    3: { name: 'CHING', text: '¡El último plato! Fideos místicos de la montaña sagrada. Después de esto, la cocina cierra — Garu te espera. 🍜' },
  },
  // ABYO — el luchador (aparece en niveles 1 y 2)
  abyo: {
    1: { name: 'ABYO', text: '¡El espíritu del rayo arde en ti! Siente la energía de Sooga, pequeña ninja. ¡KIAAA! 🔥' },
    2: { name: 'ABYO', text: '¡Más profundo en el bambú! Cada paso es un latido del dragón. ¡No temas, el rayo te guía! 🔥' },
    3: { name: 'ABYO', text: '¡La última línea! Cruza y el corazón de Garu será tuyo. ¡KIAAA, hija del rayo! 🔥' },
  },
  // TÍOS — el gato negro (aparece en niveles 1 y 2, no en 3)
  tios: {
    1: { name: 'TÍOS', text: 'Buena suerte, pequeña. Un té antes de continuar — la vida es corta, los fideos largos. 🍵' },
    2: { name: 'TÍOS', text: 'El bambú oculta secretos. Mantén los ojos abiertos, querida. 🍵' },
    3: { name: 'TÍOS', text: 'Buen viaje, Pucca. Recuerda: el amor es la velocidad. 🐢' },
  },
};

// ============ LEVEL_COMPLETED config (per level) ============
interface LevelCompletedConfig {
  /** Main hero image (the kiss / ramo / boda). */
  heroImage: string;
  heroAlt: string;
  /** Character to show in the popup card. null = no popup (cinemática
      de boda en el nivel 3). */
  popup: null | {
    name: string;
    title: string;
    text: string;
    icon: string;          // emoji (e.g. "🐱")
    image: string;         // path to sprite
  };
  /** Header text under the hero image. */
  header: string;
  /** Subtitle text. */
  subtitle: string;
}

const LEVEL_COMPLETED_CONFIG: Record<number, LevelCompletedConfig> = {
  1: {
    heroImage: '/sprites/pucca_y_garu_enamorados_sticker.png',
    heroAlt: 'Pucca y Garu, novios en el restaurante',
    popup: {
      name: 'MIO',
      title: '¡EL GATO MIO TE FELICITA!',
      text: '¡MIAU! 🐱 ¡Nivel completado! Eres una verdadera Ninja del amor. 💋',
      icon: '🐱',
      image: '/sprites/gato_negro_cuerpo_completo.png',
    },
    header: '¡Nivel 1 Completado!',
    subtitle: 'Del Restaurante Goh-Rong al siguiente paso. ¡El ramen de Ching te espera!',
  },
  2: {
    heroImage: '/sprites/garu_con_ramo_flores.png',
    heroAlt: 'Garu sosteniendo un ramo de flores para Pucca',
    popup: {
      name: 'CHING',
      title: '¡EL CHEF CHING TE FELICITA!',
      text: '¡Wok caliente, ninja veloz! El bosque de bambú no te detuvo. ¡Sigue así! 🍜',
      icon: '🍜',
      image: '/sprites/personaje_cocinero_rojo_con_cubos_variante.png',
    },
    header: '¡Nivel 2 Completado!',
    subtitle: 'El espíritu del rayo te acompaña. La montaña sagrada te espera.',
  },
  3: {
    // Regular "level completed" card for level 3 — the wedding cinemática
    // lives in the VICTORY screen (so the user doesn't see the wedding
    // image twice in a row).
    heroImage: '/sprites/pucca_y_garu_enamorados_sticker.png',
    heroAlt: 'Pucca y Garu, muy enamorados antes del altar',
    popup: null,
    header: '¡Nivel 3 Completado!',
    subtitle: 'Garu te espera al final del sendero… 💍🌸 Pulsa Reclamar Recompensas para la cinemática final.',
  },
};

const PLAYER_STATE = {
  NORMAL: 'NORMAL',
  CHEMICAL_RUSH: 'CHEMICAL_RUSH',
  TACHYCARDIA: 'TACHYCARDIA',
  PUKA_OVERDRIVE: 'PUKA_OVERDRIVE',
} as const;

const THEMES = {
  GOH_RONG: {
    id: 'GOH_RONG', name: 'El Restaurante Goh-Rong', difficulty: 'Nivel 1 – Fácil',
    bg: '#1A080A', platformTop: '#7B1113', platformBottom: '#3A0003', accent: '#FFD700',
    goalEmoji: '🏁', enemies: ['🥷', '💀'],
  },
  BAMBOO_FOREST: {
    id: 'BAMBOO_FOREST', name: 'El Bosque de Bambú Místico', difficulty: 'Nivel 2 – Intermedio',
    bg: '#0B1A12', platformTop: '#1E4620', platformBottom: '#0A1D0D', accent: '#A3E635',
    goalEmoji: '🏁', enemies: ['🥷', '💀'],
  },
  TURTLE_MOUNTAIN: {
    id: 'TURTLE_MOUNTAIN', name: 'La Montaña de la Tortuga Sagrada', difficulty: 'Nivel 3 – Experto Ninja',
    bg: '#0F172A', platformTop: '#E2E8F0', platformBottom: '#334155', accent: '#38BDF8',
    goalEmoji: '🏁', enemies: ['🥷', '💀'],
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

interface Entity { type: number; x: number; y: number; width: number; height: number; active?: boolean; vx?: number; vy?: number; startX?: number; range?: number; emoji?: string; isHit?: boolean; reward?: string; rewardType?: string; coinScale?: number; lastShot?: number; sprite?: string; angle?: number; }
interface GhostPos { x: number; y: number; alpha: number; }
interface Player { x: number; y: number; vx: number; vy: number; width: number; height: number; grounded: boolean; state: string; stateTimer: number; facingLeft: boolean; isDead: boolean; isGiant: boolean; hasPet: boolean; canDoubleJump: boolean; idleTimer: number; lastSafeX: number; lastSafeY: number; jumpTimer: number; justLanded: boolean; squashX: number; squashY: number; ghosts: GhostPos[]; sugarCrashTimer: number; attackCooldown: number; attackAnimTimer: number; animFrame: number; animTimer: number; hitstun: number; }
interface Keys { left: boolean; right: boolean; up: boolean; upJustPressed: boolean; attack: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; alpha: number; size: number; }
interface EnvParticle { x: number; y: number; vx: number; vy: number; size: number; rotation: number; rotationSpeed: number; alpha: number; }
interface Projectile { id: number; type: number; x: number; y: number; vx: number; vy: number; width: number; height: number; angle: number; active: boolean; facingLeft: boolean; }

export default function Advergame() {
  const [appState, setAppState] = createSignal<number>(APP_STATE.START_SCREEN);
  const [selection, setSelection] = createSignal<{ theme: ThemeId | null }>({ theme: null });
  const [uiState, setUiState] = createSignal<{ coins: number; timeLeft: number; message: string; messageType: string; playerState: string; lives: number }>({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: LIVES_MAX_HALVES });
  const [couponDone, setCouponDone] = createSignal(false);
  const [showTutorial, setShowTutorial] = createSignal(true);
  const [inventory, setInventory] = createSignal<string[]>([]);
  const [currentLevelIndex, setCurrentLevelIndex] = createSignal(1);
  const [ammo, setAmmo] = createSignal(10);
  const [assetsReady, setAssetsReady] = createSignal(false);

  const getCameraOffset = () => {
    if (typeof window === 'undefined') return 150;
    const vw = engineState.viewport?.width || window.innerWidth;
    const vh = engineState.viewport?.height || window.innerHeight;
    const isLandscape = vw > vh && vh < 500;
    if (isLandscape) return Math.max(vw * 0.25, 150);
    if (vw > 768 && vw > vh) return 400;
    if (vw > vh) return 250;
    return Math.max(vw * 0.4, 200);
  };
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  let engineState: {
    keys: Keys; camera: { x: number; y: number };
    player: Player; entities: Entity[]; particles: Particle[]; envParticles: EnvParticle[];
    score: number; lives: number; startTime: number;
    viewport: { width: number; height: number };
    shakeTimer: number; shakeIntensity: number; hitstopFrames: number;
    companion: { x: number; y: number; vx: number; vy: number; grounded: boolean; width: number; height: number; targetDistance: number; animFrame: number; animTimer: number; isNinjaRecovering?: boolean };
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
        ghosts: [], sugarCrashTimer: 0, attackCooldown: 0, attackAnimTimer: 0, animFrame: 0, animTimer: 0,
        hitstun: 0,
      },
      entities: [], particles: [], envParticles: [], score: 0, lives: LIVES_MAX_HALVES, startTime: 0,
      viewport: { width: 800, height: 600 },
      shakeTimer: 0, shakeIntensity: 0, hitstopFrames: 0,
      companion: { x: 280, y: 100, vx: 5, vy: 0, grounded: false, width: 40, height: 60, targetDistance: 180, animFrame: 0, animTimer: 0, isNinjaRecovering: false },
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

  /**
   * Applies a knockback impulse to the player. The direction is determined
   * by the source's X position: if the source is to the LEFT of the player,
   * the player is pushed to the RIGHT (+vx), and vice versa.
   */
  function applyKnockback(p: Player, fromX: number, vxMag: number, vyMag: number) {
    const dir = p.x < fromX ? 1 : -1;
    p.vx = dir * vxMag;
    p.vy = vyMag;
    p.hitstun = HITSTUN_MS;
  }

  /**
   * Applies damage to the player. If a shield (hasPet/isGiant/Puka_OVERDRIVE)
   * is active, the shield absorbs the hit. Otherwise:
   *   1. Decrement lives (default = 1 half-heart)
   *   2. Apply knockback away from `fromX`
   *   3. Visual + audio feedback
   *   4. If lives reach 0, trigger GAME_OVER
   */
  function damagePlayer(p: Player, fromX: number, halfHearts = 1, vxMag = PROJECTILE_KNOCKBACK_VX, vyMag = PROJECTILE_KNOCKBACK_VY) {
    if (p.state === PLAYER_STATE.PUKA_OVERDRIVE) return; // immune
    if (p.hitstun > 0) return; // i-frames

    if (p.hasPet) {
      p.hasPet = false;
      p.canDoubleJump = false;
      applyKnockback(p, fromX, vxMag, vyMag);
      setUiState((prev) => ({ ...prev, message: '\u00A1MASCOTA PERDIDA!', messageType: 'warning' }));
    } else if (p.isGiant) {
      p.isGiant = false;
      p.width = 40;
      p.height = 60;
      applyKnockback(p, fromX, vxMag, vyMag);
      setUiState((prev) => ({ ...prev, message: '\u00A1PODER PERDIDO!', messageType: 'warning' }));
    } else {
      // Real damage (default = 1 half-heart per hit)
      engineState.lives = Math.max(0, engineState.lives - halfHearts);
      applyKnockback(p, fromX, vxMag, vyMag);
      setUiState((prev) => ({ ...prev, lives: engineState.lives, message: '\u00A1SHURIKEN! -' + halfHearts + ' \u{1F4A5}\u{1F4A5}', messageType: 'error' }));
      if (audioInst) audioInst.hurt();
      triggerShake(8, 200);
      triggerHitstop(2);
      if (engineState.lives <= 0) {
        p.isDead = true;
        if (audioInst) audioInst.victory();
        trackGameEvent('puka_game_over', { stage: currentLevelIndex(), score: engineState.score, timeLeft: uiState().timeLeft });
        setAppState(APP_STATE.GAME_OVER);
      }
    }
  }

  function spawnFloatingText(x: number, y: number, text: string) {
    engineState.floatingTexts.push({ x, y, text, life: 1500, maxLife: 1500, alpha: 1 });
  }
  function spawnFloatingScore(x: number, y: number, text: string) {
    engineState.floatingScores.push({ x, y, text, life: 1000, maxLife: 1000, vy: -2 });
  }

  function generateLevel(theme: typeof THEMES[keyof typeof THEMES], levelIndex: number) {
    const s = engineState;
    s.entities = []; s.score = 0; s.lives = LIVES_MAX_HALVES;
    s.projectiles = []; s.nextProjectileId = 0;
    s.player = { ...s.player, x: 100, y: 100, vx: 0, vy: 0, state: PLAYER_STATE.NORMAL, isDead: false, isGiant: false, hasPet: false, canDoubleJump: false, width: 40, height: 60, idleTimer: 0, lastSafeX: 100, lastSafeY: 100, jumpTimer: 0, justLanded: false, squashX: 1, squashY: 1, ghosts: [], sugarCrashTimer: 0, attackCooldown: 0, animFrame: 0, animTimer: 0, hitstun: 0 };
    s.camera.x = 0;
    setAmmo(10);
    let curX = 0;
    let chingSpawned = false;
    let abyoSpawned = false;
    let tiosSpawned = false;
    let malaPuccaSpawned = false;
    let catPowerSpawned = false;
    const groundY = 500;
    const SEGMENTS = LEVEL_CONFIG[levelIndex as keyof typeof LEVEL_CONFIG]?.segments || 20;
    const platWidth = levelIndex === 3 ? (w: number) => Math.max(80, w - 30) : (w: number) => w;
    const addPlat = (x: number, w: number, y = groundY, h = 800) => s.entities.push({ type: ENTITY.PLATFORM, x, y, width: platWidth(w), height: h });
    addPlat(0, 800); curX = 800;

    for (let i = 0; i < SEGMENTS; i++) {
      const p = i % 5;
      if (p === 0) {
        curX += 180; addPlat(curX, 500); addPlat(curX + 100, 200, groundY - 150, 20);
        for (let c = 0; c < 3; c++) s.entities.push({ type: ENTITY.COIN, x: curX + 100 + c * 50, y: groundY - 200 - c * 40, width: 30, height: 30, active: true, coinScale: 1 });
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
        const ninjaSprite = (Math.random() > 0.5) ? SPRITE.NINJA : SPRITE.NINJA_MALO_2;
        s.entities.push({ type: ENTITY.ENEMY_NINJA, x: curX + 400, y: groundY - 60, width: 40, height: 60, vx: ninjaVx, startX: curX + 300, range: 300, emoji: ee, active: true, lastShot: 0, sprite: ninjaSprite });
        curX += 800;
      } else if (p === 3) {
        curX += 180; addPlat(curX, 800);
        s.entities.push({ type: ENTITY.TRAP_CHEMICAL, x: curX + 200, y: groundY - 36, width: 24, height: 36, active: true });
        curX += 800;
      } else {
        curX += 150; addPlat(curX, 600);
        s.entities.push({ type: ENTITY.COIN, x: curX + 200, y: groundY - 100, width: 30, height: 30, active: true, coinScale: 1 });
        s.entities.push({ type: ENTITY.COIN, x: curX + 280, y: groundY - 160, width: 30, height: 30, active: true, coinScale: 1 });
        if (i % 4 === 0) {
          s.entities.push({ type: ENTITY.AMMO_BOX, x: curX + 300, y: groundY - 60, width: 30, height: 30, active: true });
        }
        curX += 600;
      }

      // Spawning NPCs at precise, evenly distributed segment indices for perfect spacing!
      if (i === Math.floor(SEGMENTS * 0.15)) {
        s.entities.push({ type: ENTITY.NPC_CHING, x: curX - 300, y: groundY - 72, width: 48, height: 72, active: true });
      } else if (i === Math.floor(SEGMENTS * 0.35)) {
        s.entities.push({ type: ENTITY.NPC_ABYO, x: curX - 300, y: groundY - 66, width: 44, height: 66, active: true, vx: -1.5, startX: curX - 450, range: 300 });
      } else if (i === Math.floor(SEGMENTS * 0.55)) {
        s.entities.push({ type: ENTITY.NPC_MALA_PUCCA, x: curX - 300, y: groundY - 60, width: 40, height: 60, active: true });
      } else if (i === Math.floor(SEGMENTS * 0.75)) {
        s.entities.push({ type: ENTITY.NPC_CAT_PUKA_POWER, x: curX - 300, y: groundY - 45, width: 45, height: 45, active: true });
      } else if (i === Math.floor(SEGMENTS * 0.90)) {
        s.entities.push({ type: ENTITY.NPC_TIOS, x: curX - 300, y: groundY - 72, width: 48, height: 72, active: true });
      }
    }
    curX += 150; addPlat(curX, 1000);
    s.entities.push({ type: ENTITY.GOAL, x: curX + 400, y: groundY - 150, width: 150, height: 150, active: true });
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
    setUiState({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: LIVES_MAX_HALVES });
    lastFrameUpdate = 0;
    trackGameEvent('puka_campaign_start', { stage: levelIdx });
    preloadAssets();
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
    setUiState({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: LIVES_MAX_HALVES });
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
        (window as any).teleportPuka = (x: number) => { p.x = x; s.camera.x = x - 100; };
        (window as any).getLevelLength = () => s.totalLevelLength;
        (window as any).setScore = (sc: number) => { s.score = sc; };
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
          // Falling off / time-out counts as losing a FULL heart (2 half-hearts).
          s.lives = Math.max(0, s.lives - 2);
          p.x = p.lastSafeX || 100; p.y = (p.lastSafeY || 500) - 100;
          p.vx = 0; p.vy = 0;
          p.hitstun = 0; // reset i-frames so the next hit registers
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
      if (p.hitstun > 0) p.hitstun -= 16.6;

      let currentSpeedMult = p.sugarCrashTimer > 0 ? 0.5 : 1;

      if (p.attackCooldown > 0) p.attackCooldown -= 16.6;
      if (p.attackAnimTimer > 0) p.attackAnimTimer -= 16.6;
      if (k.attack && ammo() > 0 && p.attackCooldown <= 0 && p.state !== PLAYER_STATE.TACHYCARDIA) {
        k.attack = false;
        setAmmo((prev) => Math.max(0, prev - 1));
        p.attackCooldown = 250;
        p.attackAnimTimer = 1000;
        const projType = Math.random() > 0.5 ? ENTITY.PROJECTILE_KUNAI : ENTITY.PROJECTILE_SHURIKEN;
        s.projectiles.push({
          id: s.nextProjectileId++,
          type: projType,
          x: p.facingLeft ? p.x - 10 : p.x + p.width + 10,
          y: p.y + 15,
          vx: p.facingLeft ? -14 : 14,
          vy: 0,
          width: 32,
          height: 32,
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
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.TACHYCARDIA, message: '¡TAQUICARDIA por químicos industriales! 💔⚡', messageType: 'error' }));
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
            p.state = PLAYER_STATE.NORMAL;
            p.sugarCrashTimer = 6000;
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.NORMAL, message: '¡RECUPERADA! Fatiga de azúcar 💥💥💥💥', messageType: 'warning' }));
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

      if (typeof window !== 'undefined' && (window as any).autoNinjaJump) {
        if (p.x >= 710 && p.x <= 750 && p.grounded) {
          k.up = true;
          k.upJustPressed = true;
          console.log('[DEBUG COLLISION] Auto Ninja Jump triggered at X:', p.x);
        }
      }

      if (k.up && p.grounded && jumpMult > 0) {
        p.vy = JUMP_FORCE * jumpMult;
        p.grounded = false;
        p.canDoubleJump = true;
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

      // Animation tick → player
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

      // Platform collision resolution for Garu - Disabled while recovering so he can jump through platforms cleanly!
      s.companion.grounded = false;
      if (!s.companion.isNinjaRecovering) {
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

      // Respawn Garu in front of Puka if he falls off a cliff - Epic Ninja Recovery
      if (s.companion.y > 1500 && !s.companion.isNinjaRecovering) {
        s.companion.isNinjaRecovering = true;
        s.companion.x = p.x + 300;
        s.companion.y = 650;
        s.companion.vy = -18;
        s.companion.vx = BASE_SPEED;
        s.companion.grounded = false;
      }

      if (s.companion.isNinjaRecovering) {
        if (Math.random() < 0.4) {
          spawnParticle(s.companion.x, s.companion.y + 30, '#ffffff', 4);
          spawnParticle(s.companion.x + 20, s.companion.y + 30, '#60a5fa', 2);
        }
        // Recover only when he has successfully cleared the platform height (y <= 440) and is moving down or reaching apex (vy >= -1)
        if (s.companion.y <= 440 && s.companion.vy >= -1) {
          s.companion.isNinjaRecovering = false;
        }
      }

      // Animation tick → Garu
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

      // PUKA_OVERDRIVE victory check → catch Garu
      if (p.state === PLAYER_STATE.PUKA_OVERDRIVE && p.x >= s.companion.x) {
        p.isDead = true;
        if (audioInst) audioInst.victory();
        trackGameEvent('puka_campaign_victory', { finalCoins: s.score });
        setAppState(APP_STATE.LEVEL_COMPLETED);
        return;
      }

      // Chemical projectile movement (thrown TRAP_CHEMICAL) → collides with platforms
      s.entities.forEach((chem) => {
        if (chem.type === ENTITY.TRAP_CHEMICAL && chem.vx !== undefined && chem.active) {
          chem.x += chem.vx;
          chem.vy = (chem.vy || 0) + 0.3;
          chem.y += chem.vy;
          for (const plat of s.entities) {
            if (plat.type === ENTITY.PLATFORM && plat.active !== false &&
                chem.x < plat.x + plat.width && chem.x + chem.width > plat.x &&
                chem.y < plat.y + plat.height && chem.y + chem.height > plat.y) {
              chem.active = false;
              break;
            }
          }
          if (chem.x < cam.x - 200 || chem.x > cam.x + vp.width + 200 || chem.y > 1500) chem.active = false;
        }
      });

      // Projectile movement (PROJECTILE_BULL) → collides with platforms
      s.entities.forEach((proj) => {
        if (proj.type === ENTITY.PROJECTILE_BULL && proj.active) {
          proj.angle = (proj.angle || 0) + (proj.vx! > 0 ? 0.25 : -0.25);
          proj.x += proj.vx!;
          for (const plat of s.entities) {
            if (plat.type === ENTITY.PLATFORM && plat.active !== false &&
                proj.x < plat.x + plat.width && proj.x + proj.width > plat.x &&
                proj.y < plat.y + plat.height && proj.y + proj.height > plat.y) {
              proj.active = false;
              break;
            }
          }
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
            s.entities.push({ type: ENTITY.PROJECTILE_BULL, x: ninja.x + (dir > 0 ? 40 : -20), y: ninja.y + 15, width: 16, height: 16, vx: dir * 5, vy: 0, active: true, angle: 0 });
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
        if (proj.type === ENTITY.PROJECTILE_SHURIKEN || proj.type === ENTITY.PROJECTILE_KUNAI) proj.angle += proj.vx > 0 ? 0.3 : -0.3;
        if (proj.x < cam.x - 100 || proj.x > cam.x + vp.width + 100) proj.active = false;
      });
      s.projectiles = s.projectiles.filter((p) => p.active);

      // Broad-phase culling: only check nearby entities
      const nearby = s.entities.filter((e) => e.x < cam.x + vp.width + 200 && e.x + (e.width || 0) > cam.x - 200);

      for (const entity of nearby) {
        if (entity.active === false && entity.type !== ENTITY.PLATFORM) continue;

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
            p.canDoubleJump = true;
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
            if (inventory().length < 5) {
              setInventory(prev => [...prev, 'PUKA_POWER']);
            }
            spawnFloatingText(entity.x, entity.y - 40, '¡Hola Pucca! ¡Toma un Puka Power para ir más rápido! \u{1F60A}\u{1F60A}\u{1F60A}');
            if (audioInst) audioInst.powerup();
            spawnParticle(entity.x, entity.y, '#ffd700', 25);
            triggerShake(4, 150);
            break;
          }
          case ENTITY.NPC_ABYO: {
            entity.active = false;
            if (inventory().length < 5) {
              setInventory(prev => [...prev, 'PUKA_POWER']);
            }
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
            spawnFloatingText(entity.x, entity.y - 40, '¡KIAAA! ¡Siente la energía de Sooga, Pucca! 🔥🔥🔥🔥');
            if (audioInst) audioInst.powerup();
            spawnParticle(entity.x, entity.y, '#ef4444', 30);
            triggerShake(8, 200);
            break;
          }
          case ENTITY.NPC_TIOS: {
            entity.active = false;
            if (inventory().length < 5) {
              setInventory(prev => [...prev, 'PUKA_POWER']);
            }
            s.timerFrozen = true;
            s.timerFreezeEnd = Date.now() + 5000;
            spawnFloatingText(entity.x, entity.y - 40, '¡Fideos de la felicidad listos! ¡Buen viaje, Pucca! 🍜😊😊😊');
            if (audioInst) audioInst.powerup();
            spawnParticle(entity.x, entity.y, '#22c55e', 25);
            break;
          }
          case ENTITY.NPC_CAT_PUKA_POWER: {
            entity.active = false;
            if (inventory().length < 5) {
              setInventory(prev => [...prev, 'PUKA_POWER']);
            }
            spawnFloatingText(entity.x, entity.y - 40, '¡Miau! ¡Puka Power natural para ti! 🐱😊😊😊😊');
            if (audioInst) audioInst.powerup();
            spawnParticle(entity.x, entity.y, '#ffd700', 25);
            triggerShake(4, 150);
            break;
          }
          case ENTITY.NPC_MALA_PUCCA: {
            entity.active = false;
            p.state = PLAYER_STATE.CHEMICAL_RUSH;
            p.stateTimer = 2000;
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.CHEMICAL_RUSH, message: '¡RUSH INDUSTRIAL! ⚡⚡⚡', messageType: 'warning' }));
            if (audioInst) { audioInst.powerup(); audioInst.rushEnergy(); }
            spawnParticle(entity.x, entity.y, '#8b5cf6', 25);
            triggerShake(6, 150);
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
            // Use the shared damagePlayer helper: 1 half-heart per hit,
            // knockback away from the projectile.
            damagePlayer(p, entity.x, 1, PROJECTILE_KNOCKBACK_VX, PROJECTILE_KNOCKBACK_VY);
            break;
          }
          case ENTITY.AMMO_BOX: {
            entity.active = false;
            setAmmo((prev) => Math.min(20, prev + 5));
            spawnFloatingText(entity.x, entity.y - 40, '+5 MUNICIÓN 💥💥💥');
            if (audioInst) audioInst.coin();
            spawnParticle(entity.x, entity.y, '#60a5fa', 10);
            break;
          }
          case ENTITY.GOAL: {
            const curLevel = currentLevelIndex();
            const cfg = LEVEL_CONFIG[curLevel as keyof typeof LEVEL_CONFIG];
            if (cfg && s.score < cfg.minCoins) {
              setUiState((prev) => ({ ...prev, message: `¡Necesitas ${cfg.minCoins} monedas! \u{1FA99}`, messageType: 'warning' }));
              break;
            }
            if (curLevel < 3) {
              p.isDead = true;
              if (audioInst) audioInst.victory();
              setAppState(APP_STATE.LEVEL_COMPLETED);
              return;
            }
            // Level 3 — the campaign is complete. Mark the game as won
            // *right now* (sets the signed won-cookie via /api/mark-won)
            // so the 15% coupon is applied by default as soon as the user
            // navigates to /tienda — no extra click required.
            //
            // We chain off the markGameWon() promise so the state
            // transition (and the analytics event) only fire AFTER the
            // cookie has landed. That way, even if the user clicks
            // "Volver a la Tienda" in the header (bypassing the VICTORY
            // screen), the cookie is already in the browser.
            p.isDead = true;
            if (audioInst) audioInst.victory();
            trackGameEvent('puka_campaign_victory', { finalCoins: s.score });
            if (!couponDone()) {
              setCouponDone(true);
              try { localStorage.setItem('puka_campaign_won', 'true'); } catch (_) { /* noop */ }
              // Fire the mark-won request; once the cookie is set, the
              // server returns success and we transition to the
              // completed screen. Coupon path is guaranteed to work
              // by the time the user lands on /tienda.
              markGameWon().finally(() => {
                setAppState(APP_STATE.LEVEL_COMPLETED);
              });
            } else {
              setAppState(APP_STATE.LEVEL_COMPLETED);
            }
            return;
          }
        }
      }

      // Projectile vs entity collisions
      for (const proj of s.projectiles) {
        if (!proj.active) continue;
        const nearEntities = s.entities.filter((e) => e.x < cam.x + vp.width + 200 && e.x > cam.x - 200);
        for (const entity of nearEntities) {
        if (entity.active === false) continue;
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

      const isLandscapeMobile = vp.width > vp.height && vp.height < 500;
      const worldScaleForCam = (vp.width < 900) ? (isLandscapeMobile ? 1.25 : 1.5) : 1;
      const effectiveVpHeight = vp.height / worldScaleForCam;
      if (effectiveVpHeight < 600) {
        const targetCamY = p.y - effectiveVpHeight * 0.55;
        cam.y += (targetCamY - cam.y) * 0.08;
      } else {
        cam.y += (0 - cam.y) * 0.1;
      }

      if (s.shakeTimer > 0) s.shakeTimer -= 16.6;

      // Decay floating texts, scores, and particles; use reverse iteration
      // + splice to avoid the forEach + splice index-shift bug.
      for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
        const ft = s.floatingTexts[i];
        ft.life -= 16.6;
        ft.alpha = Math.max(0, ft.life / ft.maxLife);
        ft.y -= 0.5;
        if (ft.life <= 0) s.floatingTexts.splice(i, 1);
      }
      for (let i = s.floatingScores.length - 1; i >= 0; i--) {
        const fs = s.floatingScores[i];
        fs.life -= 16.6;
        fs.y += fs.vy;
        if (fs.life <= 0) s.floatingScores.splice(i, 1);
      }

      for (let i = s.particles.length - 1; i >= 0; i--) {
        const part = s.particles[i];
        part.life -= 16.6; part.x += part.vx; part.y += part.vy;
        part.alpha = Math.max(0, part.life / part.maxLife);
        if (part.life <= 0) s.particles.splice(i, 1);
      }

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
      // Defer to the shared damagePlayer helper for consistency.
      // 1 half-heart loss + knockback, away from `entity.x`.
      entity.active = false;
      damagePlayer(p, entity.x, 1, NINJA_KNOCKBACK_VX, NINJA_KNOCKBACK_VY);
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
    groundY: number = 500,
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

    // Responsive Y helper — fractional distance ABOVE the ground line.
    // bgY(0.25) = the Y position that is 25% of vh above the ground,
    // so on a 1080-tall canvas the result is 500 - 270 = 230, which
    // is always above the ground regardless of vh.
    const bgY = (fracAboveGround: number) => groundY - vh * fracAboveGround;

    // Layer 1: Far background (slowest movement, speed factor 0.05)
    ctx.save();
    const s1 = -scrollX * 0.05;
    ctx.translate(((s1 % vw) + vw) % vw, 0);
    ctx.globalAlpha = 0.6;
    if (themeId === 'GOH_RONG') {
      // Far mountain silhouettes — visible against the dark wine sky
      ctx.fillStyle = '#7a1a1f';
      for (let i = -1; i < 3; i++) {
        const x = i * vw;
        const mBase = bgY(0.18);
        ctx.beginPath();
        ctx.moveTo(x - 50, vh);
        ctx.lineTo(x + vw * 0.3, mBase);
        ctx.lineTo(x + vw * 0.6, mBase + vh * 0.10);
        ctx.lineTo(x + vw * 0.8, mBase - vh * 0.05);
        ctx.lineTo(x + vw + 50, vh);
        ctx.closePath();
        ctx.fill();
      }
    } else if (themeId === 'BAMBOO_FOREST') {
      // Misty mountain silhouettes — brightened so they show against the dark base
      ctx.fillStyle = '#1f6f3e';
      for (let i = -1; i < 3; i++) {
        const x = i * vw;
        const mBase = bgY(0.22);
        ctx.beginPath();
        ctx.moveTo(x - 100, vh);
        ctx.quadraticCurveTo(x + vw * 0.25, mBase, x + vw * 0.5, mBase + vh * 0.10);
        ctx.quadraticCurveTo(x + vw * 0.75, mBase - vh * 0.04, x + vw + 100, vh);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Snowy mountain peaks (level 3) — slate-600 for visible contrast
      ctx.fillStyle = '#475569';
      for (let i = -1; i < 3; i++) {
        const x = i * vw;
        const mBase = bgY(0.20);
        ctx.beginPath();
        ctx.moveTo(x - 20, vh);
        ctx.lineTo(x + vw * 0.25, mBase);
        ctx.lineTo(x + vw * 0.5, mBase + vh * 0.12);
        ctx.lineTo(x + vw * 0.75, mBase - vh * 0.05);
        ctx.lineTo(x + vw + 20, vh);
        ctx.closePath();
        ctx.fill();

        // Snow cap — larger and with a bright highlight stripe
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.moveTo(x + vw * 0.25 - vh * 0.07, mBase + vh * 0.04);
        ctx.lineTo(x + vw * 0.25, mBase);
        ctx.lineTo(x + vw * 0.25 + vh * 0.07, mBase + vh * 0.04);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#475569';
      }
    }
    ctx.restore();

    // Layer 2: Middle background (medium speed, speed factor 0.15)
    ctx.save();
    const s2 = -scrollX * 0.15;
    ctx.translate(((s2 % vw) + vw) % vw, 0);
    ctx.globalAlpha = 0.75;
    if (themeId === 'GOH_RONG') {
      // Traditional houses (pagodas) — positioned ABOVE the ground line
      // so they are always visible regardless of vh.
      ctx.fillStyle = '#7B1113';
      const houseTopFrac = 0.22;   // 22% of vh above the ground
      const houseHFrac = 0.22;     // 22% of vh tall
      for (let i = -1; i < 4; i++) {
        const bx = i * Math.max(360, vw * 0.22);
        const hY = bgY(houseTopFrac);
        const hH = vh * houseHFrac;
        // Body
        ctx.fillRect(bx + 50, hY, 150, hH);
        // Pagoda roof — curved top
        ctx.beginPath();
        ctx.moveTo(bx + 20, hY);
        ctx.quadraticCurveTo(bx + 125, hY - vh * 0.06, bx + 230, hY);
        ctx.lineTo(bx + 200, hY + 15);
        ctx.lineTo(bx + 50, hY + 15);
        ctx.closePath();
        ctx.fill();
        // Golden door / window
        ctx.beginPath();
        ctx.arc(bx + 125, hY + hH * 0.45, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.fillStyle = '#7B1113';
      }
    } else if (themeId === 'BAMBOO_FOREST') {
      // Mid-distance bamboo — full-height trunks, denser spacing so the
      // forest feels like a forest and not a sparse row of poles.
      ctx.fillStyle = 'rgba(40, 120, 70, 0.75)';
      const trunkW = Math.max(18, vw * 0.015);
      const separation = Math.max(160, vw * 0.085);
      const bY = 0;                              // trunks start at top
      const bH = vh + 20;                        // extend past bottom
      for (let i = -1; i < 7; i++) {
        const bx = i * separation;
        // Trunk
        ctx.fillRect(bx + 30, bY, trunkW, bH);
        // Node joints — distributed evenly down the trunk
        ctx.fillStyle = 'rgba(22, 101, 52, 0.95)';
        for (let y = bY + 50; y < bY + bH; y += 80) {
          ctx.fillRect(bx + 28, y, trunkW + 4, 5);
        }
        ctx.fillStyle = 'rgba(40, 120, 70, 0.75)';
        // Subtle leaves at the top — always near the top edge
        ctx.fillStyle = 'rgba(101, 163, 13, 0.55)';
        ctx.beginPath();
        ctx.moveTo(bx + 36, bY + 10);
        ctx.quadraticCurveTo(bx + 56, bY, bx + 54, bY + 18);
        ctx.quadraticCurveTo(bx + 46, bY + 14, bx + 36, bY + 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(40, 120, 70, 0.75)';
      }
    } else {
      // Steep rocky cliffs (level 3 mid layer)
      ctx.fillStyle = '#64748b';
      for (let i = -1; i < 4; i++) {
        const bx = i * Math.max(420, vw * 0.25);
        const cBase = bgY(0.18);
        ctx.beginPath();
        ctx.moveTo(bx, vh);
        ctx.lineTo(bx + 100, cBase);
        ctx.lineTo(bx + 220, cBase + 20);
        ctx.lineTo(bx + 320, cBase - vh * 0.06);
        ctx.lineTo(bx + 400, cBase + 40);
        ctx.lineTo(bx + 480, vh);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // Layer 3: Foreground (fast speed, speed factor 0.3)
    ctx.save();
    const s3 = -scrollX * 0.3;
    ctx.translate(((s3 % vw) + vw) % vw, 0);
    ctx.globalAlpha = 0.85;
    if (themeId === 'GOH_RONG') {
      // Restaurant columns (full-height) + tables
      ctx.fillStyle = '#3A0003';
      for (let i = -1; i < 5; i++) {
        const bx = i * Math.max(300, vw * 0.18);
        ctx.fillRect(bx + 80, 0, 18, vh);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(bx + 80, vh - 180, 18, 6);
        ctx.fillStyle = '#3A0003';
        ctx.fillRect(bx + 180, vh - 120, 120, 120);
        ctx.fillRect(bx + 160, vh - 130, 160, 12);
      }
    } else if (themeId === 'BAMBOO_FOREST') {
      // Detailed foreground bamboo — full-height trunks with leaves at
      // the very top of the canvas and along the stalk. Dense enough to
      // cover the full width of the screen at any scrollX position.
      const fY = 0;
      const fH = vh + 20;
      const trunkW = Math.max(20, vw * 0.02);
      const separation = Math.max(140, vw * 0.07);
      const NODE_GAP = 60;
      for (let i = -1; i < 10; i++) {
        const bx = i * separation + 50;
        // Trunk: 2-tone gradient effect (darker stripe on left edge)
        ctx.fillStyle = '#15803d';
        ctx.fillRect(bx - 1, fY, trunkW + 2, fH);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(bx, fY, trunkW, fH);
        // Nodes distributed along the full trunk
        for (let y = fY + 30; y < fY + fH; y += NODE_GAP) {
          ctx.fillStyle = '#166534';
          ctx.fillRect(bx - 2, y, trunkW + 4, 6);
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(bx + 1, y + 1, trunkW - 2, 2);
        }
        // Leaves at the top of the trunk (y ≈ 8, always near the top edge)
        ctx.fillStyle = '#65a30d';
        ctx.beginPath();
        ctx.moveTo(bx + 7, fY + 8);
        ctx.quadraticCurveTo(bx + 35, fY - 5, bx + 32, fY + 18);
        ctx.quadraticCurveTo(bx + 20, fY + 14, bx + 7, fY + 8);
        ctx.fill();
        // Left-side leaf
        ctx.beginPath();
        ctx.moveTo(bx + 7, fY + 16);
        ctx.quadraticCurveTo(bx - 22, fY + 6, bx - 18, fY + 28);
        ctx.quadraticCurveTo(bx - 5, fY + 22, bx + 7, fY + 16);
        ctx.fill();
        // Mid-stalk leaves — positioned as fractions of vh so they scale
        ctx.beginPath();
        ctx.moveTo(bx + 7, fY + vh * 0.40);
        ctx.quadraticCurveTo(bx + 28, fY + vh * 0.40 - 10, bx + 24, fY + vh * 0.40 + 12);
        ctx.quadraticCurveTo(bx + 16, fY + vh * 0.40 + 8, bx + 7, fY + vh * 0.40);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bx + 7, fY + vh * 0.70);
        ctx.quadraticCurveTo(bx - 24, fY + vh * 0.70 - 8, bx - 20, fY + vh * 0.70 + 12);
        ctx.quadraticCurveTo(bx - 6, fY + vh * 0.70 + 6, bx + 7, fY + vh * 0.70);
        ctx.fill();
      }
    } else {
      // Clouds passing by horizontally (level 3 foreground)
      ctx.fillStyle = 'rgba(241, 245, 249, 0.35)';
      for (let i = -1; i < 4; i++) {
        const bx = i * Math.max(420, vw * 0.25);
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
    ctx.font = 'bold 16px Arial';
    const textWidth = ctx.measureText(text).width;
    const bubbleWidth = textWidth + 20;
    const bubbleHeight = 30;
    const bx = x - bubbleWidth / 2;
    const by = y - bubbleHeight - 14;

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
    ctx.moveTo(x - 8, by + bubbleHeight);
    ctx.lineTo(x, by + bubbleHeight + 10);
    ctx.lineTo(x + 8, by + bubbleHeight);
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

    // Scale up the game world on small viewports so characters and text
    // are readable. The parallax background is drawn at its NATIVE viewport
    // size (not scaled) so the mountains, houses and bamboo keep their
    // intended layout and never get clipped on small screens.
    const isSmallViewport = viewport.width < 900;
    const isLandscapeMobile = viewport.width > viewport.height && viewport.height < 500;
    const worldScale = isSmallViewport ? (isLandscapeMobile ? 1.25 : 1.5) : 1;

    ctx.save();

    ctx.clearRect(0, 0, viewport.width, viewport.height);
    drawParallaxBackground(ctx, theme.id, camera.x, viewport.width, viewport.height);

    if (s.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * s.shakeIntensity;
      const sy = (Math.random() - 0.5) * s.shakeIntensity;
      ctx.translate(sx, sy);
    }

    // Apply worldScale only to the game entities (player, platforms, NPCs, projectiles)
    if (worldScale !== 1) {
      ctx.save();
      ctx.translate(viewport.width / 2, viewport.height / 2);
      ctx.scale(worldScale, worldScale);
      ctx.translate(-viewport.width / 2, -viewport.height / 2);
    }

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Floating texts
    ctx.textBaseline = 'middle';
    s.floatingTexts.forEach((ft) => {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = 'bold 22px Arial';
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
      ctx.font = 'bold 30px Arial';
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
      if (entity.y < camera.y - cullMargin || entity.y > camera.y + viewport.height + cullMargin) return;

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
        ctx.fillText('$', cx - 7 * coinScale, cy + 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      } else if (entity.type === ENTITY.ENEMY_NINJA && entity.active) {
        drawSprite(ctx, entity.sprite || SPRITE.NINJA, 0, entity.x, entity.y, entity.width, entity.height, (entity.vx ?? 0) > 0);
      } else if (entity.type === ENTITY.NPC_CHING && entity.active) {
        const lvl = (currentLevelIndex() as 1 | 2 | 3) || 1;
        const dialog = NPC_DIALOGS.ching[lvl] || NPC_DIALOGS.ching[1];
        ctx.save();
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 25;
        drawSprite(ctx, SPRITE.CHING, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#ffd700'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(dialog.name, entity.x, entity.y - 8);

        // Floating Puka Power can above head!
        drawSprite(ctx, SPRITE.PUKA_POWER, 0, entity.x + entity.width / 2 - 12, entity.y - 45, 24, 36);
        // Speech Bubble with level-specific dialog
        drawSpeechBubble(ctx, dialog.text, entity.x + entity.width / 2, entity.y - 48);
      } else if (entity.type === ENTITY.NPC_CAT_PUKA_POWER && entity.active) {
        const lvl = (currentLevelIndex() as 1 | 2 | 3) || 1;
        const dialog = NPC_DIALOGS.abyo[lvl] || NPC_DIALOGS.abyo[1];
        ctx.save();
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 25;
        drawSprite(ctx, SPRITE.CAT_PUKA_POWER, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#ffd700'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('MIO', entity.x, entity.y - 8);

        // Floating Puka Power above head
        drawSprite(ctx, SPRITE.PUKA_POWER, 0, entity.x + entity.width / 2 - 12, entity.y - 45, 24, 36);
        // Speech Bubble
        drawSpeechBubble(ctx, dialog.text, entity.x + entity.width / 2, entity.y - 48);
      } else if (entity.type === ENTITY.NPC_ABYO && entity.active) {
        const lvl = (currentLevelIndex() as 1 | 2 | 3) || 1;
        const dialog = NPC_DIALOGS.abyo[lvl] || NPC_DIALOGS.abyo[1];
        ctx.save();
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15;
        drawSprite(ctx, SPRITE.ABYO, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(dialog.name, entity.x, entity.y - 8);

        // Speech Bubble
        drawSpeechBubble(ctx, dialog.text, entity.x + entity.width / 2, entity.y - 8);
      } else if (entity.type === ENTITY.NPC_TIOS && entity.active) {
        const lvl = (currentLevelIndex() as 1 | 2 | 3) || 1;
        const dialog = NPC_DIALOGS.tios[lvl] || NPC_DIALOGS.tios[1];
        ctx.save();
        ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 20;
        drawSprite(ctx, SPRITE.CAT, 0, entity.x, entity.y, 40, 40);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#22c55e'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(dialog.name, entity.x, entity.y - 8);

        // Speech Bubble
        drawSpeechBubble(ctx, dialog.text, entity.x + 20, entity.y - 8);
      } else if (entity.type === ENTITY.NPC_MALA_PUCCA && entity.active) {
        ctx.save();
        ctx.shadowColor = '#8b5cf6'; ctx.shadowBlur = 15;
        drawSprite(ctx, SPRITE.MALA_PUCCA, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 20px Arial'; ctx.fillStyle = '#8b5cf6'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('MALA PUCCA', entity.x, entity.y - 8);
        
        // Float a Monster or Red Bull above her head
        const spriteSrc = (Math.floor(entity.x) % 2 === 0) ? SPRITE.RED_BULL : SPRITE.MONSTER;
        drawSprite(ctx, spriteSrc, 0, entity.x + entity.width/2 - 12, entity.y - 45, 24, 36);
        // Speech Bubble
        drawSpeechBubble(ctx, "¡Toma esta bebida oscura! ¡Te hará volar! 😈⚡⚡", entity.x + entity.width / 2, entity.y - 48);
      } else if (entity.type === ENTITY.TRAP_CHEMICAL && entity.active) {
        ctx.save();
        const isRedBull = (Math.floor(entity.x) % 2 === 0);
        const spriteSrc = isRedBull ? SPRITE.RED_BULL : SPRITE.MONSTER;
        
        // Thrown by enemy (has vx) = just the can, no character
        // Static placed (no vx) = character companion next to it
        if (entity.vx === undefined) {
          const hostSprite = isRedBull ? SPRITE.MALA_PUCCA : SPRITE.NINJA2;
          drawSprite(ctx, hostSprite, 0, entity.x - 32, entity.y - 12, 32, 48);
          const deceptiveText = isRedBull 
            ? "¡Toma un Red Bull, te dará alas de verdad! 😈😊😊😊" 
            : "¡Prueba un Monster helado! ¡Es energía ninja! 😈😊😊😊";
          drawSpeechBubble(ctx, deceptiveText, entity.x - 8, entity.y - 15);
        }
        
        // Draw the can
        drawSprite(ctx, spriteSrc, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.restore();
      } else if (entity.type === ENTITY.PROJECTILE_BULL && entity.active) {
        ctx.save();
        ctx.translate(entity.x + entity.width / 2, entity.y + entity.height / 2);
        ctx.rotate(entity.angle || 0);
        const shurikenImg = imageCache.get(SPRITE.SHURIKEN);
        if (shurikenImg) {
          ctx.drawImage(shurikenImg, -entity.width / 2, -entity.height / 2, entity.width, entity.height);
        }
        ctx.restore();
      } else if (entity.type === ENTITY.AMMO_BOX && entity.active) {
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(now / 250) * 0.3;
        ctx.shadowColor = '#60a5fa'; ctx.shadowBlur = 15;
        drawSprite(ctx, SPRITE.PUKA_ATTACK, 0, entity.x, entity.y, entity.width, entity.height);
        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.font = 'bold 18px Arial'; ctx.fillStyle = '#60a5fa'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('AMMO', entity.x, entity.y - 8);
      } else if (entity.type === ENTITY.GOAL) {
        ctx.save();
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 30;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '140px Arial';
        ctx.fillText(theme.goalEmoji, entity.x + entity.width / 2, entity.y + entity.height / 2);
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('🏁 META 🏁', entity.x + entity.width / 2, entity.y - 10);
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

    // Render projectiles (Kunai / Shuriken) - both use the shuriken image, spinning
    s.projectiles.forEach((proj) => {
      if (!proj.active) return;
      ctx.save();
      ctx.translate(proj.x + proj.width / 2, proj.y + proj.height / 2);
      ctx.rotate(proj.angle);
      const shurikenImg = imageCache.get(SPRITE.SHURIKEN);
      if (shurikenImg) {
        ctx.drawImage(shurikenImg, -proj.width / 2, -proj.height / 2, proj.width, proj.height);
      } else {
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('✦', 0, 0);
      }
      ctx.restore();
    });

    // Garu companion
    ctx.save();
    if (s.companion.isNinjaRecovering) {
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 15;
      drawSprite(ctx, SPRITE.GARU_ATTACK, 0, s.companion.x, s.companion.y, s.companion.width, s.companion.height, player.facingLeft);
      ctx.shadowBlur = 0;
    } else if (player.state === PLAYER_STATE.TACHYCARDIA) {
      ctx.shadowColor = 'rgba(255,0,0,0.5)';
      ctx.shadowBlur = 20;
      drawSprite(ctx, SPRITE.GARU_SCARED, 0, s.companion.x, s.companion.y, s.companion.width, s.companion.height, player.facingLeft);
      ctx.shadowBlur = 0;
    } else if (!s.companion.grounded) {
      drawSprite(ctx, SPRITE.GARU_ATTACK, 0, s.companion.x, s.companion.y, s.companion.width, s.companion.height, player.facingLeft);
    } else {
      const garuMoving = Math.abs(s.companion.vx) > 0.5;
      if (garuMoving) {
        drawSprite(ctx, SPRITE.GARU_RUN, s.companion.animFrame, s.companion.x, s.companion.y, s.companion.width, s.companion.height, player.facingLeft);
      } else {
        // In level 2 Garu is "in love" — show heart-eyes sprite instead of the angry idle.
        const loveLevel = currentLevelIndex() === 2;
        const garuSprite = loveLevel ? SPRITE.GARU_LOVE : SPRITE.GARU_IDLE;
        drawSprite(ctx, garuSprite, 0, s.companion.x, s.companion.y, s.companion.width, s.companion.height, player.facingLeft);
        // Emit subtle heart particles on level 2 every ~800ms while Garu is on-screen
        if (loveLevel && now % 800 < 32) {
          spawnParticle(s.companion.x + s.companion.width / 2, s.companion.y - 4, '#ff6b9d', 1, true);
        }
      }
    }
    ctx.restore();
    ctx.font = 'bold 20px Arial';
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

    if (player.attackAnimTimer > 0) {
      currentSrc = SPRITE.PUKA_LAUGH;
      currentFrame = 0;
    } else if (player.isDead) {
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
        // Rising → show upward sprite
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
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 15;
      ctx.fillStyle = '#ffd700';
      const drawBolt = (x: number, y: number, size: number) => {
        ctx.beginPath();
        ctx.moveTo(x - size * 0.25, y - size * 0.7);
        ctx.lineTo(x + size * 0.15, y - size * 0.1);
        ctx.lineTo(x - size * 0.05, y - size * 0.1);
        ctx.lineTo(x + size * 0.25, y + size * 0.7);
        ctx.lineTo(x - size * 0.15, y + size * 0.05);
        ctx.lineTo(x + size * 0.05, y + size * 0.05);
        ctx.closePath();
        ctx.fill();
      };
      drawBolt(cx + Math.cos(pt) * (player.width * 0.9), cy + Math.sin(pt) * (player.height * 0.7), 22);
      drawBolt(cx + Math.cos(pt + Math.PI) * (player.width * 0.9), cy + Math.sin(pt + Math.PI) * (player.height * 0.7), 22);
      ctx.shadowBlur = 0;
    }

    // Idle sleep Zzz - three Z's of growing size, classic sleep animation
    if (player.idleTimer > 3000 && !player.isDead) {
      ctx.shadowColor = '#c4b5fd'; ctx.shadowBlur = 10;
      ctx.strokeStyle = '#c4b5fd';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const baseY = cy - player.height / 2 - 24;
      const bobOffset = Math.sin(now / 250) * 4;
      const zSizes = [14, 18, 22];
      const zSpacing = 16;
      for (let i = 0; i < 3; i++) {
        const zx = cx + 18 + i * zSpacing;
        const zy = baseY - i * 14 + bobOffset;
        const zs = zSizes[i];
        const zw = zs * 0.65;
        ctx.beginPath();
        ctx.moveTo(zx - zw, zy - zs);
        ctx.lineTo(zx + zw, zy - zs);
        ctx.lineTo(zx - zw, zy + zs);
        ctx.lineTo(zx + zw, zy + zs);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    if (DEBUG_MODE) {
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(player.x, player.y, player.width, player.height);
      ctx.strokeRect(s.companion.x, s.companion.y, s.companion.width, s.companion.height);
    }

    ctx.filter = 'none';
    ctx.restore();

    // Close the worldScale block (only if it was opened)
    if (worldScale !== 1) {
      ctx.restore();
    }

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
    setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.PUKA_OVERDRIVE, message: '¡PUKA OVERDRIVE! ⚡⚡⚡', messageType: 'success' }));
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
          const MAX_W = 1920;
          const rw = Math.min(w, MAX_W);
          const rh = Math.round(h * (rw / w));
          canvasEl!.width = rw;
          canvasEl!.height = rh;
          engineState.viewport = { width: rw, height: rh };
        }
      });
      ro.observe(containerEl);

      preloadAssets().then(() => {
        cancelAnimationFrame(rafId);
        const w = containerEl!.clientWidth || window.innerWidth;
        const h = containerEl!.clientHeight || window.innerHeight;
        const MAX_W = 1920;
        const rw = Math.min(w, MAX_W);
        const rh = Math.round(h * (rw / w));
        canvasEl!.width = rw;
        canvasEl!.height = rh;
        engineState.viewport = { width: rw, height: rh };
        rafId = requestAnimationFrame(gameLoop);
      });

      const onVisibility = () => { engineState.isPaused = document.hidden; };
      const onOrientationChange = () => {
        setTimeout(onResize, 150);
        setTimeout(onResize, 400);
        setTimeout(onResize, 800);
      };
      const onResize = () => {
        if (!canvasEl || !containerEl) return;
        const w = containerEl.clientWidth || window.innerWidth;
        const h = containerEl.clientHeight || window.innerHeight;
        if (w <= 0 || h <= 0) return;
        const MAX_W = 1920;
        const rw = Math.min(w, MAX_W);
        const rh = Math.round(h * (rw / w));
        if (canvasEl.width !== rw || canvasEl.height !== rh) {
          canvasEl.width = rw;
          canvasEl.height = rh;
          engineState.viewport = { width: rw, height: rh };
        }
      };
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onOrientationChange);
      document.addEventListener('visibilitychange', onVisibility);

      const hKD = (e: KeyboardEvent) => {
        if (appState() !== APP_STATE.PLAYING) return;
        if (e.code === 'ArrowLeft') engineState.keys.left = true;
        if (e.code === 'ArrowRight') engineState.keys.right = true;
        if (e.code === 'ArrowUp' || e.code === 'Space') {
          // Robust, instant jump and double-jump trigger directly on keydown!
          const p = engineState.player;
          if (p.grounded) {
            p.vy = JUMP_FORCE;
            p.grounded = false;
            p.canDoubleJump = true;
            if (audioInst) audioInst.jump();
            spawnParticle(p.x, p.y + p.height, '#ccc', 10);
            p.squashX = 0.85; p.squashY = 1.2;
          } else if (p.canDoubleJump) {
            p.vy = JUMP_FORCE * 0.9;
            p.canDoubleJump = false; // consume double jump!
            if (audioInst) audioInst.jump();
            spawnParticle(p.x, p.y + p.height, '#ff4b4b', 15);
            p.squashX = 0.85; p.squashY = 1.2;
          }
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

      let touchStartX = 0;
      let touchStartY = 0;
      let lastTapTime = 0;
      let swipeActiveX: 'left' | 'right' | null = null;
      let swipeActiveY: 'up' | null = null;

      const handleTouchStart = (e: TouchEvent) => {
        if (appState() !== APP_STATE.PLAYING) return;
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        swipeActiveX = null;
        swipeActiveY = null;

        const now = Date.now();
        if (now - lastTapTime < 350) {
          engineState.keys.attack = true;
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (appState() !== APP_STATE.PLAYING) return;
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;

        if (Math.abs(dx) > 20 && !swipeActiveX) {
          if (dx < 0) { engineState.keys.left = true; engineState.keys.right = false; swipeActiveX = 'left'; }
          else { engineState.keys.right = true; engineState.keys.left = false; swipeActiveX = 'right'; }
          touchStartX = t.clientX;
        }

        if (dy < -30 && !swipeActiveY) {
          const p = engineState.player;
          if (p.grounded) {
            p.vy = JUMP_FORCE; p.grounded = false; p.canDoubleJump = true;
            if (audioInst) audioInst.jump();
            spawnParticle(p.x, p.y + p.height, '#ccc', 10);
            p.squashX = 0.85; p.squashY = 1.2;
          } else if (p.canDoubleJump) {
            p.vy = JUMP_FORCE * 0.9; p.canDoubleJump = false;
            if (audioInst) audioInst.jump();
            spawnParticle(p.x, p.y + p.height, '#ff4b4b', 15);
            p.squashX = 0.85; p.squashY = 1.2;
          }
          engineState.keys.up = true;
          swipeActiveY = 'up';
          touchStartY = t.clientY;
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (appState() !== APP_STATE.PLAYING) return;
        if (!swipeActiveX) {
          engineState.keys.left = false;
          engineState.keys.right = false;
        }
        if (!swipeActiveY) {
          engineState.keys.up = false;
        }
        setTimeout(() => { engineState.keys.attack = false; }, 100);
        swipeActiveX = null;
        swipeActiveY = null;
      };

      containerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      containerEl.addEventListener('touchmove', handleTouchMove, { passive: true });
      containerEl.addEventListener('touchend', handleTouchEnd, { passive: true });

      onCleanup(() => {
        window.removeEventListener('keydown', hKD);
        window.removeEventListener('keyup', hKU);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onOrientationChange);
        containerEl.removeEventListener('touchstart', handleTouchStart);
        containerEl.removeEventListener('touchmove', handleTouchMove);
        containerEl.removeEventListener('touchend', handleTouchEnd);
        cancelAnimationFrame(rafId);
        ro.disconnect();
      });
    });

    const ui = uiState;
    const s = () => engineState;
    const isPuka = () => ui().playerState === PLAYER_STATE.PUKA_OVERDRIVE || s().player.hasPet;
    const isRush = () => ui().playerState === PLAYER_STATE.CHEMICAL_RUSH;
    const isTachy = () => ui().playerState === PLAYER_STATE.TACHYCARDIA;
    const inv = inventory;

    const progressPct = () => s().totalLevelLength > 0 ? Math.min(100, Math.max(0, (s().player.x / s().totalLevelLength) * 100)) : 0;

    // Heart rendering: lives stored as half-hearts (0..LIVES_MAX*2).
    // Render `Math.floor(lives/2)` full hearts + one half heart if `lives % 2 === 1`.
    const renderHearts = () => {
      const lives = Math.max(0, ui().lives);
      const fullHearts = Math.floor(lives / 2);
      const hasHalf = lives % 2 === 1;
      const out: any[] = [];
      for (let i = 0; i < fullHearts; i++) {
        out.push(
          <svg class="w-7 h-7 sm:w-8 sm:h-8 text-red-500 fill-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]" viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>,
        );
      }
      if (hasHalf) {
        out.push(
          <svg class="w-7 h-7 sm:w-8 sm:h-8 text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]" viewBox="0 0 24 24">
            <defs>
              <clipPath id="heart-half-clip">
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
            </defs>
            <g clip-path="url(#heart-half-clip)">
              <path class="fill-red-500" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </g>
            <path class="fill-red-500/20" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>,
        );
      }
      return out;
    };

    return (
      <div class="fixed inset-0 bg-black overflow-hidden select-none font-sans">
        <div class="absolute top-0 left-0 right-0 z-30 flex justify-between items-start p-2 sm:p-3 pointer-events-none">
          <div class="flex items-center gap-2">
            <div class="flex gap-0.5">
              {renderHearts()}
            </div>
            <div class="flex items-center gap-2 bg-slate-900/80   px-3 py-1.5 rounded-lg border border-slate-700/50 shadow-lg">
              <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="text-2xl sm:text-3xl font-black text-white">{ui().coins}</span>
            </div>
            <div class="flex items-center gap-2 bg-slate-900/80   px-3 py-1.5 rounded-lg border border-slate-700/50 shadow-lg"
              classList={{ 'animate-pulse border-red-500/50': ammo() === 0 }}>
              <span class="text-base sm:text-lg flex items-center"><img src="/sprites/shuriken.png" class="w-5 h-5 sm:w-6 sm:h-6 object-contain" /></span>
              <span class="text-2xl sm:text-3xl font-black"
                classList={{ 'text-red-500': ammo() === 0, 'text-blue-300': ammo() > 0 }}>{ammo()}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-2xl sm:text-3xl font-black bg-slate-900/80   px-3 py-1.5 rounded-lg border border-slate-700/50"
              classList={{ 'text-red-500': ui().timeLeft < 15, 'text-white': ui().timeLeft >= 15 }}>
              {Math.floor(ui().timeLeft / 60)}:{(ui().timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        <div class="hidden absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex-col gap-1 bg-slate-900/80   px-3 py-2 rounded-lg border border-slate-700/50 text-white text-xs font-semibold pointer-events-none"
          classList={{ 'md:flex': !isTouchDevice }}>
          <div class="flex items-center gap-1.5">
            <span class="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{'\u2190'}</span>
            <span class="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{'\u2192'}</span>
            <span>Moverse</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{'\u2191'}</span>
            <span class="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Espacio</span>
            <span>Saltar</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">X</span>
            <span class="flex items-center gap-1"><img src="/sprites/shuriken.png" class="w-4 h-4 object-contain" /><span>TIRA SHURIKENS CON LA TECLA X</span></span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Shift</span>
            <span class="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">C</span>
            <span>Puka Overdrive {'\u26A1'}</span>
          </div>
        </div>

        <div class="absolute top-12 sm:top-14 left-2 sm:left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-[10px] sm:text-xs tracking-wide transition-colors pointer-events-none"
          classList={{
            'text-red-400 bg-red-500/10 border-red-500/30': isPuka(),
            'text-blue-400 bg-blue-400/10 border-blue-400/30': isRush(),
            'text-gray-400 bg-gray-600/30 border-gray-500/30': isTachy(),
            'text-green-400 bg-green-400/10 border-green-400/30': !isPuka() && !isRush() && !isTachy(),
          }}>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isPuka() || isRush() || isTachy()
              ? <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              : <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            }
          </svg>
          {isPuka() ? 'PUKA OVERDRIVE' : isRush() ? 'CHEMICAL RUSH' : isTachy() ? 'TACHYCARDIA' : 'SISTEMA ESTABLE'}
        </div>

        <Show when={!showTutorial()}>
          <div class="absolute top-12 sm:top-14 right-2 sm:right-3 z-30 flex items-center gap-1 px-3 py-1 rounded-lg border border-purple-500/30 bg-purple-900/45   pointer-events-auto shadow-lg"
            classList={{ 'opacity-40': inv().length === 0 }}>
            <span class="text-[10px] sm:text-xs font-black text-purple-300 mr-1.5 tracking-wide">INV</span>
            
            {/* Single dynamic slot with x1, x2, x3 counter */}
            <div class="w-7 h-7 rounded-md border border-purple-500/30 bg-purple-950/40 flex items-center justify-center text-xs transition-all relative overflow-hidden">
              {inv().length > 0 ? (
                <>
                  <img src="/sprites/Puka-Power.png" class="w-5.5 h-5.5 object-contain animate-pulse" />
                  <span class="absolute bottom-0 right-0.5 text-[9px] font-black bg-purple-950/80 text-yellow-300 px-0.5 rounded-tl border-l border-t border-purple-500/30">
                    x{inv().length}
                  </span>
                </>
              ) : (
                <span class="text-[9px] text-slate-500 font-bold">VACÍO</span>
              )}
            </div>

            <button
              onClick={() => consumeBoost()}
              disabled={inv().length === 0}
              classList={{
                'opacity-30 cursor-not-allowed': inv().length === 0,
                'hover:bg-purple-500/30 active:scale-90 hover:scale-105 hover:border-yellow-400/50 hover:text-yellow-300': inv().length > 0,
              }}
              class="ml-2 w-7 h-7 rounded-md border border-yellow-400/40 bg-yellow-400/10 flex items-center justify-center text-xs transition-all duration-100 font-bold text-yellow-400">
              ?
            </button>
          </div>
        </Show>

        <div class="absolute top-0 left-0 right-0 z-30 flex justify-center pt-1 sm:pt-2 px-20">
          <div class="w-full max-w-lg flex items-center gap-2">
            <span class="text-[10px] sm:text-xs font-bold text-slate-400 bg-slate-900/60   px-1.5 py-0.5 rounded border border-slate-700/40 shrink-0">
              NIVEL {currentLevelIndex()}/3
            </span>
            <div class="flex-1 bg-slate-900/60   rounded-full h-1.5 sm:h-2 overflow-hidden border border-slate-700/40">
              <div class="h-full rounded-full transition-all duration-300 ease-out"
                classList={{
                  'bg-gradient-to-r from-red-500 to-orange-400': progressPct() < 40,
                  'bg-gradient-to-r from-orange-400 to-yellow-400': progressPct() >= 40 && progressPct() < 70,
                  'bg-gradient-to-r from-yellow-400 to-green-400': progressPct() >= 70,
                }}
                style={{ width: `${progressPct()}%` }} />
            </div>
          </div>
        </div>

        {ui().message && (
          <div class="absolute bottom-24 sm:bottom-28 left-0 right-0 flex justify-center z-20 pointer-events-none px-4">
            <div class="max-w-2xl px-4 py-2 rounded-2xl border font-bold uppercase text-[10px] sm:text-xs animate-pulse text-center whitespace-normal leading-snug"
              classList={{
                'bg-red-500/20 text-red-400 border-red-500/40': ui().messageType === 'success',
                'bg-gray-800/80 text-white border-gray-600/40': ui().messageType === 'error',
                'bg-orange-500/20 text-orange-400 border-orange-500/40': ui().messageType === 'warning',
                'bg-blue-500/20 text-blue-400 border-blue-500/40': ui().messageType !== 'success' && ui().messageType !== 'error' && ui().messageType !== 'warning',
              }}>
              {ui().message}
            </div>
          </div>
        )}

        <div class="relative w-full h-dvh bg-[#0a0d1a] overflow-hidden">
          <div ref={containerEl} class="absolute inset-0">
            <canvas ref={canvasEl} class="relative z-10 w-full h-full block" style={{ 'image-rendering': 'pixelated' }} />
          </div>
        </div>

        <Show when={!showTutorial()}>
          <div class="absolute bottom-2 sm:bottom-4 left-0 right-0 px-2 sm:px-4 flex justify-between items-end z-30" classList={{ 'md:hidden': !isTouchDevice }}
            style={{ 'max-height': '35vh' }}>
            <div class="flex gap-2 sm:gap-3">
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.left = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.left = false; }} onMouseDown={() => { engineState.keys.left = true; }} onMouseUp={() => { engineState.keys.left = false; }} class="w-14 h-14 sm:w-20 sm:h-20 landscape:w-12 landscape:h-12 bg-black/60   rounded-xl border-2 border-white/15 text-white text-2xl sm:text-3xl landscape:text-xl font-black touch-none active:bg-white/20 active:scale-90 transition-all duration-100 shadow-lg flex items-center justify-center">{'\u2190'}</button>
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.right = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.right = false; }} onMouseDown={() => { engineState.keys.right = true; }} onMouseUp={() => { engineState.keys.right = false; }} class="w-14 h-14 sm:w-20 sm:h-20 landscape:w-12 landscape:h-12 bg-black/60   rounded-xl border-2 border-white/15 text-white text-2xl sm:text-3xl landscape:text-xl font-black touch-none active:bg-white/20 active:scale-90 transition-all duration-100 shadow-lg flex items-center justify-center">{'\u2192'}</button>
            </div>
            <div class="flex gap-2 sm:gap-3 items-end">
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.attack = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.attack = false; }} onMouseDown={() => { engineState.keys.attack = true; }} onMouseUp={() => { engineState.keys.attack = false; }}
                class="w-11 h-11 sm:w-16 sm:h-16 landscape:w-10 landscape:h-10 bg-blue-500/20   rounded-xl border-2 border-blue-500/40 text-blue-300 text-xl sm:text-2xl landscape:text-lg font-black touch-none active:bg-blue-500/40 active:scale-90 transition-all duration-100 shadow-[0_0_15px_rgba(59,130,246,0.15)] flex items-center justify-center">
                <img src="/sprites/shuriken.png" class="w-5 h-5 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4 object-contain" />
              </button>
              <button onTouchStart={(e) => { e.preventDefault(); consumeBoost(); }} onTouchEnd={(e) => e.preventDefault()} onMouseDown={() => { consumeBoost(); }} disabled={inv().length === 0}
                classList={{ 'opacity-40': inv().length === 0 }}
                class="w-11 h-11 sm:w-16 sm:h-16 landscape:w-10 landscape:h-10 bg-yellow-500/20   rounded-xl border-2 border-yellow-500/40 text-yellow-300 text-xl sm:text-2xl landscape:text-lg font-black touch-none active:bg-yellow-500/40 active:scale-90 transition-all duration-100 shadow-[0_0_15px_rgba(234,179,8,0.15)] flex items-center justify-center">
                <img src="/sprites/Puka-Power.png" class="w-5 h-5 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4 object-contain" />
              </button>
              <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING && !engineState.keys.up) engineState.keys.upJustPressed = true; engineState.keys.up = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.up = false; }} onMouseDown={() => { if (!engineState.keys.up) engineState.keys.upJustPressed = true; engineState.keys.up = true; }} onMouseUp={() => { engineState.keys.up = false; }} class="w-16 h-16 sm:w-24 sm:h-24 landscape:w-14 landscape:h-14 bg-red-500/30   rounded-xl border-2 border-red-500/50 text-white text-3xl sm:text-4xl landscape:text-2xl font-black touch-none shadow-[0_0_20px_rgba(239,68,68,0.2)] active:bg-red-500/60 active:scale-90 transition-all duration-100 flex items-center justify-center">{'\u2191'}</button>
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
          <div class="w-screen h-screen overflow-hidden relative bg-[#1A080A] bg-[url('/sprites/portada.png')] bg-cover bg-center bg-no-repeat">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
            <button
              onClick={() => startGame(THEMES.GOH_RONG.id)}
              class="absolute bottom-[15%] left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-500 text-white font-black text-2xl sm:text-5xl landscape:text-3xl py-4 sm:py-5 landscape:py-3 px-12 sm:px-16 landscape:px-10 rounded-2xl shadow-2xl shadow-red-500/40 hover:shadow-red-500/60 hover:scale-105 active:scale-95 transition-all duration-200 uppercase tracking-widest border-2 border-red-400/30">
              EMPEZAR
            </button>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.CHARACTER_SELECTION}>
          <div class="w-screen h-screen overflow-hidden relative bg-[#1A080A] bg-[url('/sprites/portada.png')] bg-cover bg-center bg-no-repeat">
            <div class="absolute inset-0 bg-black/60  " />
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
            <div class="relative z-10 flex flex-col items-center">
              <img src="/sprites/pucca_chocada_redbull_o_enojada.png" class="w-48 h-48 object-contain animate-pulse mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]" />
              <h1 class="text-4xl sm:text-5xl font-black uppercase mb-4 text-red-500 drop-shadow-[0_0_20px_rgba(220,38,38,0.3)]">¡No lograste alcanzar a Garu... 😭!</h1>
              <p class="text-xl sm:text-2xl text-slate-300 mb-2">Nivel {currentLevelIndex()}/3</p>
              <p class="text-xl sm:text-2xl text-slate-300 mb-4">Monedas recolectadas: <span class="text-yellow-400 font-bold drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">{uiState().coins} {'\u{1FA99}'}</span></p>
              <p class="text-base text-slate-500 mb-8">¡No te rindas! El verdadero poder del rayo te espera.</p>
              <button onClick={() => setAppState(APP_STATE.START_SCREEN)}
                class="bg-red-500 hover:bg-red-600 text-white font-black text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                {iconPlay} JUGAR DE NUEVO
              </button>
            </div>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.VICTORY}>
          <div class="w-full min-h-screen bg-gradient-to-br from-slate-900 via-pink-950/40 to-rose-950/40 text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div class="absolute inset-0 opacity-15">
              <div class="absolute top-10 left-10 w-64 h-64 bg-pink-500 rounded-full blur-3xl animate-pulse" />
              <div class="absolute bottom-10 right-10 w-80 h-80 bg-rose-500 rounded-full blur-3xl animate-pulse" style="animation-delay: 0.5s" />
            </div>
            <a href="/tienda"
              class="absolute top-6 left-6 flex items-center gap-1 text-sm text-slate-400 hover:text-yellow-400 transition-colors z-10">
              {iconArrowLeft} Volver a la Tienda
            </a>
            <div class="relative z-10 max-w-3xl">
              {/* The wedding photo — the center of everything */}
              <div class="mb-6 animate-bubble-in">
                <img
                  src="/sprites/boda_pukaygaru.jpg"
                  alt="La boda de Pucca y Garu en la montaña sagrada"
                  class="w-72 sm:w-96 h-auto object-contain mx-auto rounded-2xl ring-4 ring-pink-400/30 shadow-[0_0_60px_rgba(255,100,150,0.5)]"
                  width="384"
                  height="auto"
                  decoding="async"
                />
              </div>

              <div class="text-7xl sm:text-8xl mb-4 animate-bounce drop-shadow-[0_0_30px_rgba(255,100,150,0.4)]">{'\u{1F48D}'}</div>
              <h1 class="text-3xl sm:text-4xl md:text-5xl font-black uppercase mb-4 text-pink-300 drop-shadow-[0_0_20px_rgba(255,100,150,0.5)]">
                {currentLevelIndex() === 3 ? '¡Garu no tiene escapatoria!' : '¡Campaña completada!'}
              </h1>
              <p class="text-base sm:text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed mb-6">
                Pasaste los 3 niveles. Atrapaste a Garu. Pero lo más importante: cruzaste la línea. Y ahora Garu no tiene opción. Pucca y Garu se casan al fin, en la montaña donde empezó todo. 💋🌸
              </p>
              <p class="text-sm text-slate-400 mb-6">Nivel {currentLevelIndex()}/3 · Monedas: <span class="text-yellow-400 font-bold">{uiState().coins}</span> 🪙</p>
              <div class="my-6 p-5 sm:p-6 rounded-2xl bg-white/5 border border-pink-500/30 backdrop-blur-sm flex flex-col items-center gap-3 shadow-[0_0_40px_rgba(255,100,150,0.15)]">
                <span class="text-[10px] sm:text-xs text-pink-300 uppercase tracking-[0.25em] font-semibold">{'\u{2728}'} En colaboración con {'\u{2728}'}</span>
                <img src="/sprites/Pucca-Logo.png" alt="Pucca Logo" class="w-40 sm:w-52 h-auto object-contain drop-shadow-[0_0_40px_rgba(255,100,150,0.5)] hover:scale-105 transition-transform duration-700" />
                <span class="text-xs sm:text-sm text-slate-400">{'\u{1F48B}'} Puka Power × Pucca {'\u{1F48B}'}</span>
              </div>
              <Show when={couponDone()}>
                <div class="bg-pink-500/20 border-2 border-pink-500/50 text-pink-300 font-bold px-6 py-3 rounded-xl mb-6 text-lg animate-pulse shadow-[0_0_20px_rgba(255,100,150,0.15)]">
                  {'\u{1F389}'} Descuento de 15% activado – canjeado en tu carrito
                </div>
              </Show>
              <Show when={!couponDone()}>
                <button
                  onClick={async () => {
                    // Defensive: usually couponDone is true here because
                    // markGameWon was already fired on the level-3 GOAL.
                    await markGameWon();
                    setCouponDone(true);
                    window.location.href = '/tienda';
                  }}
                  class="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black text-lg sm:text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.3)] mx-auto mb-4">
                  {'\u{1F389}'} Canjear 15% de descuento ahora
                </button>
              </Show>
              <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => setAppState(APP_STATE.START_SCREEN)}
                  class="bg-red-500 hover:bg-red-600 text-white font-black text-lg sm:text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 hover:shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                  {iconPlay} JUGAR DE NUEVO
                </button>
                 <a href="/tienda"
                  class="bg-pink-600 hover:bg-pink-500 text-white font-black text-lg sm:text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105">
                  Ir a la tienda {'\u{1F6D2}'}
                </a>
              </div>
            </div>
          </div>
        </Match>

        <Match when={appState() === APP_STATE.LEVEL_COMPLETED}>
          {(() => {
            const lvl = (currentLevelIndex() as 1 | 2 | 3) || 1;
            const cfg = LEVEL_COMPLETED_CONFIG[lvl] || LEVEL_COMPLETED_CONFIG[1];
            const isFinal = lvl === 3;
            // Cinemática de boda uses a pink/rose gradient; levels 1 and 2
            // use the purple/slate gradient.
            const bgClass = isFinal
              ? 'bg-gradient-to-br from-slate-900 via-pink-950/50 to-rose-950/60'
              : 'bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900';
            const glowColor = isFinal ? 'bg-pink-500' : 'bg-purple-600';
            const ringColor = isFinal ? 'ring-pink-400/30' : 'ring-purple-400/20';
            const heroSizeClass = isFinal
              ? 'w-72 sm:w-96 h-auto'    // boda is wide, use auto height
              : 'w-64 h-64 object-contain';
            return (
              <div class={`w-full min-h-screen ${bgClass} text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden`}>
                <div class="absolute inset-0 opacity-15">
                  <div class={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] ${glowColor} rounded-full blur-3xl animate-pulse`} />
                </div>
                <a href="/tienda"
                  class="absolute top-6 left-6 flex items-center gap-1 text-sm text-slate-400 hover:text-yellow-400 transition-colors z-10">
                  {iconArrowLeft} Volver a la Tienda
                </a>

                {/* ===== Layout: hero on the left/center, popup on the right ===== */}
                <div class="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
                  {/* Left/center: hero image + header + subtitle + CTA */}
                  <div class="flex flex-col items-center text-center order-2 lg:order-1">
                    <img
                      src={cfg.heroImage}
                      alt={cfg.heroAlt}
                      class={`${heroSizeClass} object-contain ${isFinal ? 'rounded-2xl ring-4 ' + ringColor + ' shadow-[0_0_50px_rgba(255,100,150,0.5)]' : 'animate-bounce drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]'} mb-4`}
                      decoding="async"
                    />
                    <h1 class={`text-3xl sm:text-4xl md:text-5xl font-black uppercase mb-3 ${isFinal ? 'text-pink-300 drop-shadow-[0_0_20px_rgba(255,100,150,0.5)]' : 'text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]'}`}>
                      {cfg.header}
                    </h1>
                    <p class="text-base sm:text-lg text-slate-200 max-w-xl leading-relaxed mb-6">
                      {cfg.subtitle}
                    </p>

                    {/* CTA — different for level 3 (Reclamar) vs 1/2 (Siguiente) */}
                    <Show
                      when={isFinal}
                      fallback={
                        <button
                          onClick={() => advanceToNextLevel()}
                          class="w-full max-w-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xl py-4 rounded-full flex items-center justify-center gap-3 transition-transform hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] uppercase tracking-wider"
                        >
                          Siguiente Nivel {iconPlay}
                        </button>
                      }
                    >
                      <button
                        onClick={async () => {
                          // Defensive: markGameWon was already fired on the
                          // level-3 GOAL collision, so this is a no-op in
                          // the normal flow — only re-runs if the user
                          // somehow reached this screen without the cookie.
                          if (!couponDone()) {
                            await markGameWon();
                            setCouponDone(true);
                            if (typeof window !== 'undefined') {
                              try { localStorage.setItem('puka_campaign_won', 'true'); } catch (_) { /* noop */ }
                            }
                          }
                          setAppState(APP_STATE.VICTORY);
                        }}
                        class="w-full max-w-sm bg-gradient-to-r from-pink-600 via-rose-500 to-pink-600 hover:from-pink-500 hover:to-rose-400 text-white font-black text-xl py-4 rounded-full flex items-center justify-center gap-3 transition-transform hover:scale-105 hover:shadow-[0_0_40px_rgba(255,100,150,0.6)] uppercase tracking-wider"
                      >
                        💍 Reclamar Recompensas {iconPlay}
                      </button>
                    </Show>
                  </div>

                  {/* Right: popup character (only on levels 1 and 2) */}
                  <Show when={cfg.popup}>
                    {(popup) => (
                      <div class="order-1 lg:order-2 w-full max-w-sm mx-auto">
                        <div class="relative bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-md border-2 border-purple-500/50 rounded-3xl p-5 sm:p-6 shadow-[0_0_40px_rgba(168,85,247,0.4)] animate-bubble-in">
                          <div class="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-3xl pointer-events-none" />
                          <div class="relative flex flex-col items-center text-center">
                            <div class="relative mb-3">
                              <div class="absolute inset-0 bg-purple-400/40 blur-2xl rounded-full animate-pulse" />
                              <img
                                src={popup().image}
                                alt={popup().name}
                                class="relative w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.9)]"
                                width="128"
                                height="128"
                                decoding="async"
                              />
                              <div class="absolute -top-1 -right-1 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center text-xl shadow-lg ring-2 ring-purple-500/60 animate-bounce">
                                {popup().icon}
                              </div>
                            </div>
                            <p class="text-[10px] sm:text-xs font-black uppercase text-purple-300 mb-2 tracking-[0.2em] flex items-center gap-1.5">
                              <span class="inline-block w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                              {popup().title}
                            </p>
                            <p class="text-sm sm:text-base text-slate-100 leading-relaxed font-semibold">
                              {popup().text}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Show>
                </div>
              </div>
            );
          })()}
        </Match>

        <Match when={appState() === APP_STATE.PLAYING}>
          <PlayingScreen />
        </Match>
      </Switch>

      <Show when={appState() === APP_STATE.PLAYING && showTutorial()}>
        {(() => {
          const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
          return (
            <div class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 sm:p-6">
              <div class="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border border-slate-700/50 w-full text-center text-white shadow-2xl shadow-red-500/5 relative overflow-hidden max-h-[90vh] overflow-y-auto"
                classList={{ 'max-w-md p-8 space-y-6': !isMobile, 'max-w-sm p-5 space-y-3 landscape:space-y-2 landscape:p-4': isMobile }}>
                <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-red-500" />
                <div class="text-4xl sm:text-5xl">{'\u{1F3AE}'}</div>
                <h2 class="text-xl sm:text-2xl font-black uppercase tracking-wider">{'\u{00A1}'}A jugar!</h2>

                {isMobile ? (
                  <ul class="text-center space-y-2.5 text-xs sm:text-sm text-slate-300">
                    <li class="p-2 rounded-lg bg-white/5 flex flex-col items-center gap-1">
                      <span class="text-lg">{'\u{1F446}'}</span>
                      <span><strong class="text-white">Desliza</strong> para moverte y saltar</span>
                    </li>
                    <li class="p-2 rounded-lg bg-white/5 flex flex-col items-center gap-1">
                      <span><strong class="text-white">Toma Puka Power</strong> para ir más rápido</span>
                      <div class="flex items-center gap-2">
                        <img src="/sprites/Puka-Power.png" class="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow-[0_0_6px_rgba(255,200,0,0.4)]" />
                        <span class="text-lg">⚡</span>
                      </div>
                    </li>
                    <li class="p-2 rounded-lg bg-white/5 flex flex-col items-center gap-1">
                      <div class="flex items-center gap-1.5">
                        <span class="text-lg">{'\u{1F977}'}</span>
                        <span class="text-lg">{'\u{1F480}'}</span>
                        <img src="/sprites/red-bull.png" class="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow-[0_0_6px_rgba(255,50,50,0.4)]" />
                      </div>
                      <span><strong class="text-white">Cuidado</strong> ninjas, trampas y Red Bulls</span>
                    </li>
                    <li class="p-2 rounded-lg bg-white/5 flex flex-col items-center gap-1">
                      <span class="text-lg flex items-center gap-1"><img src="/sprites/shuriken.png" class="w-5 h-5 object-contain" /></span>
                      <span><strong class="text-white">TIRA SHURIKENS CON LA TECLA X</strong></span>
                    </li>
                    {currentLevelIndex() === 3 && (
                      <li class="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 animate-pulse flex flex-col items-center gap-1">
                        <span class="text-lg">🚀</span>
                        <span><strong class="text-purple-300">¡DOBLE SALTO!</strong></span>
                      </li>
                    )}
                  </ul>
                ) : (
                  <ul class="text-center space-y-3 text-sm text-slate-300">
                    <li class="p-2 rounded-lg bg-white/5 flex flex-col items-center gap-1">
                      <span class="text-xl">{'\u{2190}'}{'\u{2192}'} {'\u{2191}'} <span class="text-xs font-bold text-slate-500">ESPACIO</span></span>
                      <span><strong class="text-white">Flechas</strong> para moverte y saltar</span>
                    </li>
                    <li class="p-2 rounded-lg bg-white/5 flex flex-col items-center gap-1">
                      <span><strong class="text-white">Toma Puka Power</strong> para ir más rápido</span>
                      <div class="flex items-center gap-2">
                        <img src="/sprites/Puka-Power.png" class="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-[0_0_6px_rgba(255,200,0,0.4)]" />
                        <span class="text-lg">⚡</span>
                      </div>
                    </li>
                    <li class="p-2 rounded-lg bg-white/5 flex flex-col items-center gap-1">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xl">{'\u{1F977}'}</span>
                        <span class="text-xl">{'\u{1F480}'}</span>
                        <img src="/sprites/red-bull.png" class="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-[0_0_6px_rgba(255,50,50,0.4)]" />
                      </div>
                      <span><strong class="text-white">Cuidado</strong> ninjas, trampas y Red Bulls</span>
                    </li>
                    <li class="p-2 rounded-lg bg-white/5 flex flex-col items-center gap-1">
                      <span class="text-xl flex items-center gap-1"><img src="/sprites/shuriken.png" class="w-5 h-5 object-contain" /> <span class="text-xs font-bold text-slate-500">X</span></span>
                      <span><strong class="text-white">TIRA SHURIKENS CON LA TECLA X</strong></span>
                    </li>
                    <Show when={currentLevelIndex() === 3}>
                      <li class="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 animate-pulse flex flex-col items-center gap-1">
                        <span class="text-xl"></span>
                        <span><strong class="text-purple-300">¡DOBLE SALTO!</strong></span>
                      </li>
                    </Show>
                  </ul>
                )}
                <button
                  onClick={() => { setShowTutorial(false); engineState.startTime = Date.now(); }}
                  class="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black rounded-xl tracking-wider uppercase transition-all hover:scale-105 shadow-lg shadow-red-500/20"
                  classList={{ 'py-4 px-8 text-lg': !isMobile, 'py-5 px-6 text-base': isMobile }}
                >
                  {'\u{1F680}'} ¡Comenzar!
                </button>
              </div>
            </div>
          );
        })()}
      </Show>
    </>
  );
}
