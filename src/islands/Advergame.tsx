import { createSignal, Switch, Match, Show, onMount, onCleanup } from 'solid-js';
import { applyGameCoupon } from '@/store/cartStore';

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
  SCHOOL: { id: 'SCHOOL', name: 'Colegio', bg: '#87CEEB', platform: '#4CAF50', floor: '#2E7D32', enemies: ['📚', '🚌'], goal: '🏫' },
  OFFICE: { id: 'OFFICE', name: 'Oficina', bg: '#2c3e50', platform: '#95a5a6', floor: '#546e7a', enemies: ['💼', '⏰'], goal: '🏢' },
  SHOPPING: { id: 'SHOPPING', name: 'Mall', bg: '#f8bbd0', platform: '#ce93d8', floor: '#ab47bc', enemies: ['🛍️', '💳'], goal: '🏬' },
  BEACH: { id: 'BEACH', name: 'Playa', bg: '#00BCD4', platform: '#ffe082', floor: '#ffca28', enemies: ['🦀', '🦈'], goal: '🏖️' },
} as const;

type GenderId = 'BOY' | 'GIRL' | 'MAN' | 'WOMAN';
type ThemeId = 'SCHOOL' | 'OFFICE' | 'SHOPPING' | 'BEACH';

const GENDERS: Record<GenderId, { id: GenderId; name: string; idle: string; run: string }> = {
  BOY: { id: 'BOY', name: 'Niño', idle: '🧍', run: '🏃' },
  GIRL: { id: 'GIRL', name: 'Niña', idle: '🧍', run: '🏃' },
  MAN: { id: 'MAN', name: 'Hombre', idle: '🧍‍♂️', run: '🏃‍♂️' },
  WOMAN: { id: 'WOMAN', name: 'Mujer', idle: '🧍‍♀️', run: '🏃‍♀️' },
};class SoundEngine {
  ctx: AudioContext;
  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  playTone(freq: number, type: OscillatorType, duration: number, vol = 0.1) {
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

interface Entity { type: number; x: number; y: number; width: number; height: number; active?: boolean; vx?: number; vy?: number; startX?: number; range?: number; emoji?: string; isHit?: boolean; reward?: string; rewardType?: string; }
interface Player { x: number; y: number; vx: number; vy: number; width: number; height: number; grounded: boolean; state: string; stateTimer: number; facingLeft: boolean; isDead: boolean; isGiant: boolean; hasPet: boolean; canDoubleJump: boolean; idleTimer: number; lastSafeX: number; lastSafeY: number; }
interface Keys { left: boolean; right: boolean; up: boolean; upJustPressed: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; alpha: number; size: number; }export default function Advergame() {
  const [appState, setAppState] = createSignal<number>(APP_STATE.MENU_GENDER);
  const [selection, setSelection] = createSignal<{ gender: GenderId | null; theme: ThemeId | null }>({ gender: null, theme: null });
  const [uiState, setUiState] = createSignal({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: 3 });
  const [couponDone, setCouponDone] = createSignal(false);
  const [soundReady, setSoundReady] = createSignal(false);

  const getCameraOffset = () => (typeof window !== 'undefined' && window.innerWidth > 768 ? 400 : 150);

  let engineState: {
    keys: Keys; camera: { x: number; y: number };
    player: Player; entities: Entity[]; particles: Particle[];
    score: number; lives: number; startTime: number;
    viewport: { width: number; height: number };
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
      player: { x: 100, y: 100, vx: 0, vy: 0, width: 40, height: 60, grounded: false, state: PLAYER_STATE.NORMAL, stateTimer: 0, facingLeft: false, isDead: false, isGiant: false, hasPet: false, canDoubleJump: false, idleTimer: 0, lastSafeX: 100, lastSafeY: 100 },
      entities: [], particles: [], score: 0, lives: 3, startTime: 0,
      viewport: { width: 800, height: 600 },
    };
    setCouponDone(false);
  }

  function generateLevel(theme: typeof THEMES[keyof typeof THEMES]) {
    const s = engineState;
    s.entities = []; s.score = 0; s.lives = 3;
    s.player = { ...s.player, x: 100, y: 100, vx: 0, vy: 0, state: PLAYER_STATE.NORMAL, isDead: false, isGiant: false, hasPet: false, canDoubleJump: false, width: 40, height: 60, idleTimer: 0, lastSafeX: 100, lastSafeY: 100 };
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
        s.entities.push({ type: ENTITY.COIN, x: curX + 260, y: groundY - 160, width: 30, height: 30, active: true });
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
  }

  function spawnParticle(x: number, y: number, color: string, amount = 5, isPuka = false) {
    for (let i = 0; i < amount; i++) {
      engineState.particles.push({ x: x + 20, y: y + 30, vx: (Math.random() - 0.5) * (isPuka ? 10 : 5), vy: (Math.random() - 0.5) * (isPuka ? 10 : 5), life: isPuka ? 800 : 400, maxLife: isPuka ? 800 : 400, color, alpha: 1, size: isPuka ? Math.random() * 8 + 4 : Math.random() * 5 + 2 });
    }
  }

  function spawnDynamicReward(x: number, y: number, rewardType: string) {
    engineState.entities.push({ type: ENTITY.DYNAMIC_REWARD, rewardType, x: x + 5, y: y - 40, width: 30, height: 30, vx: 0, vy: -6, active: true });
  }

  function startGame(themeId: ThemeId) {
    if (!audioInst) { audioInst = new SoundEngine(); setSoundReady(true); }
    setSelection((prev) => ({ ...prev, theme: themeId }));
    setAppState(APP_STATE.PLAYING);
    generateLevel(THEMES[themeId]);
    setUiState({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: 3 });
    lastFrameUpdate = 0;
  }  function gameLoop(time: number) {
    if (appState() !== APP_STATE.PLAYING) { rafId = requestAnimationFrame(gameLoop); return; }
    const s = engineState;
    const p = s.player;
    const k = s.keys;
    const cam = s.camera;
    const vp = s.viewport;
    const theme = THEMES[selection().theme!];

    if (!p.isDead) {
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
        } else {
          p.isDead = true;
          if (audioInst) audioInst.gameover();
          setAppState(APP_STATE.GAME_OVER);
          rafId = requestAnimationFrame(gameLoop);
          return;
        }
      }

      if (time - lastFrameUpdate > 100) {
        setUiState((prev) => ({ ...prev, timeLeft, coins: s.score, lives: s.lives }));
        lastFrameUpdate = time;
      }

      const isRunning = Math.abs(p.vx) > 0.5;
      if (isRunning || !p.grounded || k.left || k.right || k.up) p.idleTimer = 0;
      else p.idleTimer += 16.6;

      let currentSpeed = p.hasPet ? BASE_SPEED * 2.2 : BASE_SPEED;
      let jumpMult = 1;
      if (p.stateTimer > 0) p.stateTimer -= 16.6;

      switch (p.state) {
        case PLAYER_STATE.GENERIC_RUSH:
          currentSpeed = Math.max(currentSpeed, BASE_SPEED * 1.6);
          if (Math.random() > 0.8) spawnParticle(p.x, p.y + 40, '#ffffff', 1);
          if (p.stateTimer <= 0) {
            p.state = PLAYER_STATE.TACHYCARDIA; p.stateTimer = 3000;
            setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.TACHYCARDIA, message: '¡TAQUICARDIA!', messageType: 'error' }));
            if (audioInst) audioInst.hurt();
          }
          break;
        case PLAYER_STATE.TACHYCARDIA:
          currentSpeed = BASE_SPEED * 0.3;
          jumpMult = 0.5;
          p.x += (Math.random() - 0.5) * 4;
          if (p.stateTimer <= 0) { p.state = PLAYER_STATE.NORMAL; setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.NORMAL, message: '' })); }
          break;
        case PLAYER_STATE.PUKA_OVERDRIVE:
          currentSpeed = BASE_SPEED * 2.2; jumpMult = 1.3;
          if (Math.random() > 0.5) spawnParticle(p.x, p.y + 40, '#ff4b4b', 1, true);
          if (p.stateTimer <= 0) { p.state = PLAYER_STATE.NORMAL; setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.NORMAL, message: 'ENERG\u00cdA ESTABILIZADA', messageType: 'info' })); }
          break;
      }

      if (k.left && p.state !== PLAYER_STATE.TACHYCARDIA) { p.vx = -currentSpeed; p.facingLeft = true; }
      else if (k.right && p.state !== PLAYER_STATE.TACHYCARDIA) { p.vx = currentSpeed; p.facingLeft = false; }
      else p.vx *= 0.8;

      if (k.up && p.grounded && jumpMult > 0) {
        p.vy = JUMP_FORCE * jumpMult;
        p.grounded = false;
        p.canDoubleJump = p.hasPet;
        if (audioInst) audioInst.jump();
        spawnParticle(p.x, p.y + p.height, '#ccc', 10);
        k.upJustPressed = false;
      } else if (k.upJustPressed && !p.grounded && p.canDoubleJump && jumpMult > 0) {
        p.vy = JUMP_FORCE * jumpMult * 0.9;
        p.canDoubleJump = false;
        if (audioInst) audioInst.jump();
        spawnParticle(p.x, p.y + p.height, '#ff4b4b', 15);
        k.upJustPressed = false;
      }
      k.upJustPressed = false;

      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.grounded = false;

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
            } else {
              p.vx = 0;
              if (p.x < entity.x) p.x = entity.x - p.width;
              else p.x = entity.x + entity.width;
            }
          } else if (entity.type === ENTITY.DYNAMIC_REWARD && entity.active) {
            entity.active = false;
            if (entity.rewardType === 'PET') {
              p.hasPet = true;
              setUiState((prev) => ({ ...prev, message: '\u00a1MASCOTA YOSHI! Doble Salto + Velocidad', messageType: 'success' }));
              if (audioInst) audioInst.powerup();
              spawnParticle(entity.x, entity.y, '#ff4b4b', 30, true);
            } else if (entity.rewardType === 'PUKA') {
              p.state = PLAYER_STATE.PUKA_OVERDRIVE; p.stateTimer = 8000;
              setUiState((prev) => ({ ...prev, playerState: PLAYER_STATE.PUKA_OVERDRIVE, message: '\u00a1PUKA POWER EXTRA!', messageType: 'success' }));
              if (audioInst) audioInst.powerup();
              spawnParticle(entity.x, entity.y, '#ff4b4b', 30, true);
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
              spawnParticle(entity.x, entity.y, theme.floor, 15); s.score += 2;
            } else {
              if (p.hasPet) {
                p.hasPet = false; p.canDoubleJump = false; p.vy = -6; p.vx = p.facingLeft ? 8 : -8;
                entity.active = false;
                if (audioInst) audioInst.hurt();
                setUiState((prev) => ({ ...prev, message: '\u00a1MASCOTA PERDIDA!', messageType: 'warning' }));
              } else if (p.isGiant) {
                p.isGiant = false; p.width = 40; p.height = 60; p.vy = -6; p.vx = p.facingLeft ? 8 : -8;
                entity.active = false;
                if (audioInst) audioInst.hurt();
                setUiState((prev) => ({ ...prev, message: '\u00a1PODER PERDIDO!', messageType: 'warning' }));
              } else {
                p.vx = p.facingLeft ? 10 : -10; p.vy = -5;
                s.score = Math.max(0, s.score - 1);
                if (audioInst) audioInst.hurt();
                setUiState((prev) => ({ ...prev, message: '\u00a1GOLPE! -1 \u{1FA99}', messageType: 'error' }));
              }
            }
          } else if (entity.type === ENTITY.SUPER_FRUIT && entity.active) {
            entity.active = false;
            if (!p.isGiant) { p.isGiant = true; p.width = 60; p.height = 90; p.y -= 30; }
            s.lives += 1;
            if (audioInst) audioInst.powerup();
            setUiState((prev) => ({ ...prev, message: '\u00a1CAMU CAMU! +1 VIDA', messageType: 'success', lives: s.lives }));
            spawnParticle(entity.x, entity.y, '#dc143c', 20);
          } else if ((entity.type === ENTITY.VENDING_GENERIC || entity.type === ENTITY.VENDING_PUKA) && entity.active) {
            const isPuka = entity.type === ENTITY.VENDING_PUKA;
            const cost = isPuka ? COST_PUKA : COST_GENERIC;
            if (s.score >= cost) {
              entity.active = false; s.score -= cost;
              if (audioInst) audioInst.powerup();
              const newState = isPuka ? PLAYER_STATE.PUKA_OVERDRIVE : PLAYER_STATE.GENERIC_RUSH;
              p.state = newState; p.stateTimer = isPuka ? 8000 : 4000;
              setUiState((prev) => ({ ...prev, playerState: newState, message: isPuka ? '\u00a1PUKA POWER! Energ\u00eda Natural' : '\u00a1RUSH DE QU\u00cdMICOS!', messageType: isPuka ? 'success' : 'warning' }));
              spawnParticle(entity.x, entity.y, isPuka ? '#ff4b4b' : '#3b82f6', 30);
            }
          } else if (entity.type === ENTITY.GOAL) {
            p.isDead = true;
            if (audioInst) audioInst.victory();
            if (!couponDone()) { applyGameCoupon(); setCouponDone(true); }
            setAppState(APP_STATE.VICTORY);
            return;
          }
        }
      });

      const targetCamX = p.x - getCameraOffset();
      cam.x += (targetCamX - cam.x) * 0.1;
      if (cam.x < 0) cam.x = 0;

      s.particles.forEach((part, idx) => {
        part.life -= 16.6; part.x += part.vx; part.y += part.vy;
        part.alpha = Math.max(0, part.life / part.maxLife);
        if (part.life <= 0) s.particles.splice(idx, 1);
      });
    }

    if (canvasEl) render(canvasEl.getContext('2d')!, s, theme);
    rafId = requestAnimationFrame(gameLoop);
  }  function render(ctx: CanvasRenderingContext2D, s: typeof engineState, theme: typeof THEMES[keyof typeof THEMES]) {
    const { camera, viewport, player } = s;
    const genderData = GENDERS[selection().gender!];

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.save();
    ctx.translate(-camera.x, 0);

    ctx.fillStyle = theme.floor + '40';
    for (let i = 0; i < 30; i++) {
      const px = (i * 400) + (camera.x * 0.7);
      ctx.beginPath(); ctx.arc(px, 400, 100, 0, Math.PI * 2); ctx.fill();
    }

    ctx.textBaseline = 'top';
    s.entities.forEach((entity) => {
      if (entity.x < camera.x - 200 || entity.x > camera.x + viewport.width + 200) return;

      if (entity.type === ENTITY.PLATFORM) {
        ctx.fillStyle = theme.platform;
        ctx.fillRect(entity.x, entity.y, entity.width, 20);
        const rh = entity.height === 20 ? 0 : entity.height - 20;
        ctx.fillStyle = theme.floor;
        if (rh > 0) ctx.fillRect(entity.x, entity.y + 20, entity.width, rh);
      } else if (entity.type === ENTITY.STATIC_BLOCK) {
        ctx.fillStyle = theme.platform;
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        ctx.strokeStyle = theme.floor; ctx.lineWidth = 3;
        ctx.strokeRect(entity.x, entity.y, entity.width, entity.height);
      } else if (entity.type === ENTITY.SURPRISE_BLOCK) {
        ctx.fillStyle = entity.isHit ? '#7f8c8d' : '#f1c40f';
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 2;
        ctx.strokeRect(entity.x, entity.y, entity.width, entity.height);
        if (!entity.isHit) {
          ctx.fillStyle = '#d35400'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
          ctx.fillText('?', entity.x + entity.width / 2, entity.y + 6);
        }
      } else if (entity.type === ENTITY.DYNAMIC_REWARD && entity.active) {
        ctx.font = '30px Arial'; ctx.textAlign = 'left';
        if (entity.rewardType === 'PET') {
          ctx.shadowColor = 'rgba(255, 75, 75, 1)'; ctx.shadowBlur = 15;
          ctx.fillText('\u{1F408}', entity.x, entity.y); ctx.shadowBlur = 0;
        } else if (entity.rewardType === 'PUKA') { ctx.fillText('\u{1F36B}', entity.x, entity.y); }
        else { ctx.fillText('\u{1FA99}', entity.x, entity.y); }
      } else if (entity.type === ENTITY.COIN && entity.active) {
        ctx.textAlign = 'left'; ctx.font = '30px Arial';
        ctx.fillText('\u{1FA99}', entity.x, entity.y);
      } else if (entity.type === ENTITY.ENEMY && entity.active) {
        ctx.font = '40px Arial'; ctx.textAlign = 'left'; ctx.save();
        if (entity.vx! > 0) { ctx.translate(entity.x + entity.width, entity.y); ctx.scale(-1, 1); ctx.fillText(entity.emoji!, 0, 0); }
        else { ctx.fillText(entity.emoji!, entity.x, entity.y); }
        ctx.restore();
      } else if (entity.type === ENTITY.VENDING_GENERIC || entity.type === ENTITY.VENDING_PUKA) {
        if (!entity.active) return;
        ctx.textAlign = 'left';
        const isPuka = entity.type === ENTITY.VENDING_PUKA;
        ctx.fillStyle = isPuka ? '#e11d48' : '#1e3a8a';
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(entity.x + 10, entity.y + 10, entity.width - 20, entity.height - 40);
        ctx.font = '30px Arial';
        ctx.fillText(isPuka ? '\u{1F36B}' : '\u{1F364}', entity.x + 25, entity.y + 20);
        const label = isPuka ? 'PUKA POWER' : 'RED BULL';
        ctx.font = '900 18px Arial';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(entity.x + (entity.width / 2) - (tw / 2) - 8, entity.y - 32, tw + 16, 24);
        ctx.fillStyle = isPuka ? '#ff4b4b' : '#60a5fa';
        ctx.shadowColor = isPuka ? '#ff4b4b' : 'transparent'; ctx.shadowBlur = isPuka ? 15 : 0;
        ctx.fillText(label, entity.x + (entity.width / 2) - (tw / 2), entity.y - 28);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial';
        ctx.fillText((isPuka ? COST_PUKA : COST_GENERIC) + ' \u{1FA99}', entity.x + 20, entity.y + entity.height - 25);
      } else if (entity.type === ENTITY.SUPER_FRUIT && entity.active) {
        ctx.textAlign = 'left'; ctx.font = '40px Arial'; ctx.fillText('\u{1F352}', entity.x, entity.y);
      } else if (entity.type === ENTITY.GOAL) {
        ctx.textAlign = 'left'; ctx.font = '100px Arial'; ctx.fillText(theme.goal, entity.x, entity.y);
      }
    });

    s.particles.forEach((p) => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    const isRunning = Math.abs(player.vx) > 0.5;
    let emoji = isRunning ? genderData.run : genderData.idle;
    if (player.state === PLAYER_STATE.TACHYCARDIA) emoji = '\u{1F635}';

    ctx.save();
    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE) { ctx.shadowColor = 'rgba(255,75,75,1)'; ctx.shadowBlur = 25; }
    else if (player.state === PLAYER_STATE.TACHYCARDIA) { ctx.filter = 'grayscale(100%)'; }

    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    ctx.translate(cx, cy);
    ctx.save();
    if (!player.facingLeft) ctx.scale(-1, 1);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';

    if (player.hasPet) {
      ctx.shadowColor = 'rgba(255,75,75,1)'; ctx.shadowBlur = 20;
      ctx.font = '50px Arial';
      if (isRunning && !player.isDead && player.grounded) ctx.translate(0, Math.abs(Math.sin(Date.now() / 60)) * -4);
      ctx.fillText('\u{1F408}', 0, 15);
      ctx.shadowBlur = 0;
      ctx.font = player.isGiant ? '60px Arial' : '40px Arial';
      ctx.fillText(emoji, 0, -25);
    } else {
      ctx.font = player.isGiant ? '85px Arial' : '55px Arial';
      if (isRunning && !player.isDead && player.grounded) {
        ctx.rotate(Math.sin(Date.now() / 80) * 0.15);
        ctx.translate(0, Math.abs(Math.sin(Date.now() / 80)) * -8);
      }
      ctx.fillText(emoji, 0, 0);
    }
    ctx.restore();

    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE && !player.isDead) {
      const pt = Date.now() / 150;
      ctx.font = player.isGiant ? '35px Arial' : '20px Arial';
      ctx.shadowBlur = 0;
      ctx.fillText('\u26A1', Math.cos(pt) * (player.width * 0.9), Math.sin(pt) * (player.height * 0.7));
      ctx.fillText('\u26A1', Math.cos(pt + Math.PI) * (player.width * 0.9), Math.sin(pt + Math.PI) * (player.height * 0.7));
    }

    if (player.idleTimer > 3000 && !player.isDead) {
      ctx.font = '25px Arial';
      ctx.fillText('\u{1F4A4}', 15, -player.height / 2 - 15 + Math.sin(Date.now() / 200) * 5);
    }

    ctx.restore();
    ctx.restore();
  }  function PlayingScreen() {
    onMount(() => {
      if (!canvasEl || !containerEl) return;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          canvasEl!.width = entry.contentRect.width;
          canvasEl!.height = entry.contentRect.height;
          engineState.viewport = { width: canvasEl!.width, height: canvasEl!.height };
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

    return (
      <div class="w-full h-screen bg-black overflow-hidden relative flex flex-col select-none font-sans">
        <div class="absolute top-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
          <div class="flex flex-col gap-2">
            <div class="flex gap-1 mb-1">
              {Array.from({ length: Math.max(0, ui.lives) }).map((_, i) => (
                <svg key={i} class="w-8 h-8 text-red-500 fill-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              ))}
            </div>
            <div class="flex items-center gap-2 bg-slate-800/90 px-4 py-2 rounded-xl border border-slate-700 shadow-xl">
              <svg class="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span class="text-2xl font-black text-white">{ui.coins}</span>
            </div>
            <div class={"flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm tracking-wide transition-colors shadow-lg " + (isPuka ? 'text-red-500 bg-red-500/10 border-red-500' : isRush ? 'text-blue-400 bg-blue-400/10 border-blue-400' : isTachy ? 'text-gray-400 bg-gray-600/30 border-gray-500' : 'text-green-400 bg-green-400/10 border-green-400')}>
              <svg class={"w-5 h-5 " + (isPuka ? 'animate-pulse' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isPuka || isRush || isTachy
                  ? <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  : <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                }
              </svg>
              {isPuka ? 'PUKA OVERDRIVE' : isRush ? 'GENERIC RUSH' : isTachy ? 'TACHYCARDIA' : 'SISTEMA ESTABLE'}
            </div>
          </div>
          <div class="text-right flex flex-col items-end">
            <div class={"text-3xl font-black bg-slate-800/80 px-4 py-1 rounded-lg border border-slate-700 " + (ui.timeLeft < 15 ? 'text-red-500 animate-pulse' : 'text-white')}>
              {Math.floor(ui.timeLeft / 60)}:{(ui.timeLeft % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {ui.message && (
          <div class="absolute top-24 w-full flex justify-center z-20 pointer-events-none">
            <div class={"px-6 py-3 rounded-full backdrop-blur-lg border font-bold uppercase text-sm flex gap-2 items-center " + (ui.messageType === 'success' ? 'bg-red-500/20 text-red-400 border-red-500' : ui.messageType === 'error' ? 'bg-gray-800/80 text-white border-gray-600' : ui.messageType === 'warning' ? 'bg-orange-500/20 text-orange-400 border-orange-500' : 'bg-blue-500/20 text-blue-400 border-blue-500')}>
              {ui.message}
            </div>
          </div>
        )}

        <div ref={containerEl} class="flex-1 w-full relative">
          <canvas ref={canvasEl} class="block w-full h-full" style={{ 'image-rendering': 'pixelated' }} />
        </div>

        <div class="absolute bottom-8 w-full px-8 flex justify-between z-30 md:hidden opacity-70">
          <div class="flex gap-4">
            <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.left = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.left = false; }} onMouseDown={() => { engineState.keys.left = true; }} onMouseUp={() => { engineState.keys.left = false; }} class="w-16 h-16 bg-black/50 rounded-full border border-white/20 text-white text-2xl font-black touch-none flex items-center justify-center">{'\u2190'}</button>
            <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING) engineState.keys.right = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.right = false; }} onMouseDown={() => { engineState.keys.right = true; }} onMouseUp={() => { engineState.keys.right = false; }} class="w-16 h-16 bg-black/50 rounded-full border border-white/20 text-white text-2xl font-black touch-none flex items-center justify-center">{'\u2192'}</button>
          </div>
          <button onTouchStart={(e) => { e.preventDefault(); if (appState() === APP_STATE.PLAYING && !engineState.keys.up) engineState.keys.upJustPressed = true; engineState.keys.up = true; }} onTouchEnd={(e) => { e.preventDefault(); engineState.keys.up = false; }} onMouseDown={() => { if (!engineState.keys.up) engineState.keys.upJustPressed = true; engineState.keys.up = true; }} onMouseUp={() => { engineState.keys.up = false; }} class="w-20 h-20 bg-red-500/50 rounded-full border border-red-500 text-white text-2xl font-black touch-none flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.5)]">{'\u2191'}</button>
        </div>

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
    <Switch>
      <Match when={appState() === APP_STATE.MENU_GENDER}>
        <div class="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <h1 class="text-5xl font-black italic mb-2 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">PUKA POWER</h1>
          <p class="text-xl text-slate-400 mb-10">Elige a tu personaje para la aventura</p>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Object.values(GENDERS).map((g) => (
              <button onClick={() => { setSelection({ gender: g.id, theme: null }); setAppState(APP_STATE.MENU_LEVEL); }}
                class="bg-slate-800 p-8 rounded-2xl border-2 border-slate-700 hover:border-red-500 hover:scale-105 transition-all group">
                <div class="text-6xl mb-4 group-hover:scale-110 transition-transform">{g.idle}</div>
                <div class="font-bold text-lg uppercase">{g.name}</div>
              </button>
            ))}
          </div>
        </div>
      </Match>

      <Match when={appState() === APP_STATE.MENU_LEVEL}>
        <div class="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <button onClick={() => setAppState(APP_STATE.MENU_GENDER)}
            class="absolute top-6 left-6 flex items-center text-slate-400 hover:text-white">
            {iconArrowLeft} Cambiar Personaje
          </button>
          <h2 class="text-4xl font-black mb-10">¿A dónde vas hoy?</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            {Object.values(THEMES).map((t) => (
              <button key={t.id} onClick={() => startGame(t.id)}
                style={{ 'background-color': t.bg }}
                class="relative overflow-hidden p-8 rounded-2xl border-4 border-transparent hover:border-white hover:scale-105 transition-all text-left group shadow-2xl">
                <div class="text-7xl mb-4 absolute right-4 bottom-4 opacity-50 group-hover:opacity-100 transition-opacity">{t.goal}</div>
                <div class="relative z-10">
                  <h3 class="font-black text-3xl text-black/80 uppercase">{t.name}</h3>
                  <p class="font-bold text-black/60 mt-2">Dificultad Normal</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Match>

      <Match when={appState() === APP_STATE.GAME_OVER}>
        <div class="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div class="text-8xl mb-6 grayscale opacity-50">💀</div>
          <h1 class="text-6xl font-black uppercase mb-4 text-red-500">Game Over</h1>
          <p class="text-2xl text-slate-300 mb-8">Monedas recolectadas: <span class="text-yellow-400 font-bold">{uiState().coins} 🪙</span></p>
          <button onClick={() => setAppState(APP_STATE.MENU_LEVEL)}
            class="bg-red-500 hover:bg-red-600 text-white font-black text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105">
            {iconPlay} JUGAR DE NUEVO
          </button>
        </div>
      </Match>

      <Match when={appState() === APP_STATE.VICTORY}>
        <div class="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div class="text-8xl mb-6 animate-bounce">{selection().theme ? THEMES[selection().theme!].goal : '\u{1F3C6}'}</div>
          <h1 class="text-6xl font-black uppercase mb-4 text-green-400">¡Llegaste a tiempo!</h1>
          <p class="text-2xl text-slate-300 mb-4">Monedas recolectadas: <span class="text-yellow-400 font-bold">{uiState().coins} 🪙</span></p>
          <Show when={couponDone()}>
            <div class="bg-green-500/20 border border-green-500 text-green-400 font-bold px-6 py-3 rounded-xl mb-6 text-lg">
              🎉 Cupón BOLT15 activado — 15% de descuento
            </div>
          </Show>
          <div class="flex gap-4">
            <button onClick={() => setAppState(APP_STATE.MENU_LEVEL)}
              class="bg-red-500 hover:bg-red-600 text-white font-black text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105">
              {iconPlay} JUGAR DE NUEVO
            </button>
            <a href="/tienda"
              class="bg-yellow-500 hover:bg-yellow-600 text-black font-black text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105 animate-pulse">
              Ir a la tienda 🛒
            </a>
          </div>
        </div>
      </Match>

      <Match when={appState() === APP_STATE.PLAYING}>
        <PlayingScreen />
      </Match>
    </Switch>
  );
}