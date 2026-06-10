import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Coins, ShieldCheck, Activity, Play, ArrowLeft, Heart } from 'lucide-react';

// --- ARQUITECTURA DEL MOTOR FISICO Y CONSTANTES ---
const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const BASE_SPEED = 6;
const CAMERA_OFFSET_X = window.innerWidth > 768 ? 400 : 150;
const TIME_LIMIT = 150; 

// Economía In-Game
const COST_PUKA = 5;
const COST_GENERIC = 6;

const APP_STATE = { MENU_GENDER: 0, MENU_LEVEL: 1, PLAYING: 2, GAME_OVER: 3, VICTORY: 4 };
// Nuevos tipos de Entidades
const ENTITY = { 
  PLATFORM: 0, COIN: 1, VENDING_GENERIC: 2, VENDING_PUKA: 3, ENEMY: 4, GOAL: 5, SUPER_FRUIT: 6,
  SURPRISE_BLOCK: 7, STATIC_BLOCK: 8, DYNAMIC_REWARD: 9 
};
const PLAYER_STATE = { NORMAL: 'NORMAL', GENERIC_RUSH: 'GENERIC_RUSH', TACHYCARDIA: 'TACHYCARDIA', PUKA_OVERDRIVE: 'PUKA_OVERDRIVE' };

// Base de Datos de Temáticas
const THEMES = {
  SCHOOL: { id: 'SCHOOL', name: 'Colegio', bg: '#87CEEB', platform: '#4CAF50', floor: '#2E7D32', enemies: ['📚', '🚌'], goal: '🏫' },
  OFFICE: { id: 'OFFICE', name: 'Oficina', bg: '#2c3e50', platform: '#95a5a6', floor: '#546e7a', enemies: ['💼', '⏰'], goal: '🏢' },
  SHOPPING: { id: 'SHOPPING', name: 'Mall', bg: '#f8bbd0', platform: '#ce93d8', floor: '#ab47bc', enemies: ['🛍️', '💳'], goal: '🏬' },
  BEACH: { id: 'BEACH', name: 'Playa', bg: '#00BCD4', platform: '#ffe082', floor: '#ffca28', enemies: ['🦀', '🦈'], goal: '🏖️' }
};

// Sprites Base
const GENDERS = {
  BOY: { id: 'BOY', name: 'Niño', idle: '🧍', run: '🏃' },
  GIRL: { id: 'GIRL', name: 'Niña', idle: '🧍', run: '🏃' },
  MAN: { id: 'MAN', name: 'Hombre', idle: '🧍‍♂️', run: '🏃‍♂️' },
  WOMAN: { id: 'WOMAN', name: 'Mujer', idle: '🧍‍♀️', run: '🏃‍♀️' }
};

// --- MOTOR DE AUDIO SINTETIZADO ---
class SoundEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  playTone(freq, type, duration, vol = 0.1) {
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
  victory() { this.playTone(500, 'square', 0.2, 0.1); setTimeout(() => this.playTone(700, 'square', 0.2, 0.1), 200); setTimeout(() => this.playTone(1000, 'square', 0.5, 0.1), 400); }
}

export default function App() {
  const [appState, setAppState] = useState(APP_STATE.MENU_GENDER);
  const [selection, setSelection] = useState({ gender: null, theme: null });
  const [uiState, setUiState] = useState({ coins: 0, timeLeft: TIME_LIMIT, message: '', messageType: '', playerState: PLAYER_STATE.NORMAL, lives: 3 });

  const canvasRef = useRef(null);
  const requestRef = useRef(null);
  const audioRef = useRef(null);

  // Estado Mutable del Motor Físico
  const engineState = useRef({
    keys: { left: false, right: false, up: false, upJustPressed: false },
    camera: { x: 0, y: 0 },
    player: { x: 100, y: 100, vx: 0, vy: 0, width: 40, height: 60, grounded: false, state: PLAYER_STATE.NORMAL, stateTimer: 0, facingLeft: false, isDead: false, isGiant: false, hasPet: false, canDoubleJump: false, idleTimer: 0, lastSafeX: 100, lastSafeY: 100 },
    entities: [],
    particles: [],
    score: 0,
    lives: 3,
    startTime: 0,
    viewport: { width: 800, height: 600 }
  });

  // --- GENERACIÓN DE NIVEL PROCEDURAL DETERMINISTA ---
  const generateLevel = (theme) => {
    const s = engineState.current;
    s.entities = [];
    s.score = 0;
    s.lives = 3;
    s.player = { ...s.player, x: 100, y: 100, vx: 0, vy: 0, state: PLAYER_STATE.NORMAL, isDead: false, isGiant: false, hasPet: false, canDoubleJump: false, width: 40, height: 60, idleTimer: 0, lastSafeX: 100, lastSafeY: 100 };
    s.camera.x = 0;
    
    let curX = 0;
    let petSpawned = false; 
    const groundY = 500;
    
    const addPlat = (x, w, y = groundY, h = 800) => s.entities.push({ type: ENTITY.PLATFORM, x, y, width: w, height: h }); 

    addPlat(0, 800);
    curX = 800;

    for (let i = 0; i < 30; i++) {
      const pattern = i % 5;
      
      if (pattern === 0) {
        // Bloques Aéreos y Cajas Sorpresa (Ajuste de altura para permitir paso Gigante)
        curX += 180;
        addPlat(curX, 500);
        // Base aérea en Y: 350 (groundY - 150)
        addPlat(curX + 100, 200, groundY - 150, 20); 
        
        const isPetBox = !petSpawned && i > 3;
        if (isPetBox) petSpawned = true;
        
        // Cajas subidas a Y: 200 (groundY - 300) -> 150px gap exactos con la base aérea
        s.entities.push({ type: ENTITY.SURPRISE_BLOCK, x: curX + 180, y: groundY - 300, width: 40, height: 40, isHit: false, reward: isPetBox ? 'PET' : 'PUKA' });
        s.entities.push({ type: ENTITY.SURPRISE_BLOCK, x: curX + 220, y: groundY - 300, width: 40, height: 40, isHit: false, reward: 'COIN' });
        curX += 500;
      } 
      else if (pattern === 1) {
        // Geometría Piramidal
        curX += 150;
        addPlat(curX, 600);
        const startTriX = curX + 200;
        for (let r = 0; r < 3; r++) {
           for (let c = 0; c < 3 - r; c++) {
               s.entities.push({ type: ENTITY.STATIC_BLOCK, x: startTriX + c*40 + r*20, y: groundY - 40 - r*40, width: 40, height: 40 });
           }
        }
        curX += 600;
      }
      else if (pattern === 2) {
        // Enemigos y Bases
        curX += 100;
        addPlat(curX, 800);
        addPlat(curX + 200, 150, groundY - 120, 20);
        s.entities.push({ type: ENTITY.COIN, x: curX + 260, y: groundY - 160, width: 30, height: 30, active: true });
        const enemyEmoji = theme.enemies[Math.floor(Math.random() * theme.enemies.length)];
        s.entities.push({ type: ENTITY.ENEMY, x: curX + 400, y: groundY - 40, width: 40, height: 40, vx: -2, startX: curX + 300, range: 300, emoji: enemyEmoji, active: true });
        curX += 800;
      }
      else if (pattern === 3) {
         // Máquinas Expendedoras
         curX += 180;
         addPlat(curX, 800);
         s.entities.push({ type: ENTITY.VENDING_GENERIC, x: curX + 200, y: groundY - 100, width: 80, height: 100, active: true });
         s.entities.push({ type: ENTITY.VENDING_PUKA, x: curX + 500, y: groundY - 100, width: 80, height: 100, active: true });
         curX += 800;
      }
      else if (pattern === 4) {
         // Fruta Súper Poder
         curX += 150;
         addPlat(curX, 600);
         s.entities.push({ type: ENTITY.SUPER_FRUIT, x: curX + 250, y: groundY - 60, width: 40, height: 40, active: true });
         // Caja subida a Y: 300 (groundY - 200) -> 200px gap desde el suelo
         s.entities.push({ type: ENTITY.SURPRISE_BLOCK, x: curX + 350, y: groundY - 200, width: 40, height: 40, isHit: false, reward: 'PUKA' });
         curX += 600;
      }
    }

    curX += 150;
    addPlat(curX, 1000);
    s.entities.push({ type: ENTITY.GOAL, x: curX + 400, y: groundY - 150, width: 150, height: 150 });
    
    s.startTime = Date.now();
  };

  const spawnParticle = (x, y, color, amount = 5, isPuka = false) => {
    for(let i=0; i<amount; i++) {
      engineState.current.particles.push({
        x: x + 20, y: y + 30,
        vx: (Math.random() - 0.5) * (isPuka ? 10 : 5),
        vy: (Math.random() - 0.5) * (isPuka ? 10 : 5),
        life: isPuka ? 800 : 400,
        maxLife: isPuka ? 800 : 400,
        color, alpha: 1, size: isPuka ? Math.random() * 8 + 4 : Math.random() * 5 + 2
      });
    }
  };

  const spawnDynamicReward = (x, y, rewardType) => {
    engineState.current.entities.push({
      type: ENTITY.DYNAMIC_REWARD, rewardType,
      x: x + 5, y: y - 40, width: 30, height: 30,
      vx: 0, vy: -6, active: true
    });
  };

  // --- CORE GAME LOOP ---
  const gameLoop = useCallback((time) => {
    if (appState !== APP_STATE.PLAYING) return;
    
    const s = engineState.current;
    const { player, keys, camera, viewport } = s;
    const theme = THEMES[selection.theme];

    if (player.isDead) return;

    const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
    const timeLeft = TIME_LIMIT - elapsed;
    
    if (timeLeft <= 0 || player.y > 1500) {
      if (s.lives > 1) {
        s.lives--;
        player.x = player.lastSafeX || 100;
        player.y = (player.lastSafeY || 500) - 100;
        player.vx = 0; player.vy = 0;
        player.isGiant = false; player.hasPet = false; player.canDoubleJump = false;
        player.width = 40; player.height = 60; player.idleTimer = 0;
        
        if (timeLeft <= 0) s.startTime = Date.now();
        
        setUiState(p => ({ ...p, lives: s.lives, message: '¡VIDA PERDIDA!', messageType: 'error' }));
        if (audioRef.current) audioRef.current.hurt();
      } else {
        player.isDead = true;
        if (audioRef.current) audioRef.current.gameover();
        setAppState(APP_STATE.GAME_OVER);
        return;
      }
    }

    if (time % 10 < 1) setUiState(p => ({ ...p, timeLeft, coins: s.score, lives: s.lives }));

    const isRunning = Math.abs(player.vx) > 0.5;
    if (isRunning || !player.grounded || keys.left || keys.right || keys.up) player.idleTimer = 0;
    else player.idleTimer += 16.6; 

    // FSM Estados y Buffs
    let currentSpeed = player.hasPet ? BASE_SPEED * 2.2 : BASE_SPEED;
    let jumpMult = 1;
    if (player.stateTimer > 0) player.stateTimer -= 16.6;

    switch(player.state) {
      case PLAYER_STATE.GENERIC_RUSH:
        currentSpeed = Math.max(currentSpeed, BASE_SPEED * 1.6);
        if (Math.random() > 0.8) spawnParticle(player.x, player.y + 40, '#ffffff', 1);
        if (player.stateTimer <= 0) {
          player.state = PLAYER_STATE.TACHYCARDIA; player.stateTimer = 3000;
          setUiState(p => ({ ...p, playerState: PLAYER_STATE.TACHYCARDIA, message: '¡TAQUICARDIA!', messageType: 'error' }));
          if (audioRef.current) audioRef.current.hurt();
        }
        break;
      case PLAYER_STATE.TACHYCARDIA:
        currentSpeed = BASE_SPEED * 0.3; // Tachycardia anula velocidad de mascota
        jumpMult = 0.5;
        player.x += (Math.random() - 0.5) * 4;
        if (player.stateTimer <= 0) {
          player.state = PLAYER_STATE.NORMAL;
          setUiState(p => ({ ...p, playerState: PLAYER_STATE.NORMAL, message: '' }));
        }
        break;
      case PLAYER_STATE.PUKA_OVERDRIVE:
        currentSpeed = BASE_SPEED * 2.2; jumpMult = 1.3;
        if (Math.random() > 0.5) spawnParticle(player.x, player.y + 40, '#ff4b4b', 1, true);
        if (player.stateTimer <= 0) {
          player.state = PLAYER_STATE.NORMAL;
          setUiState(p => ({ ...p, playerState: PLAYER_STATE.NORMAL, message: 'ENERGÍA ESTABILIZADA', messageType: 'info' }));
        }
        break;
      default: break;
    }

    if (keys.left && player.state !== PLAYER_STATE.TACHYCARDIA) { player.vx = -currentSpeed; player.facingLeft = true; }
    else if (keys.right && player.state !== PLAYER_STATE.TACHYCARDIA) { player.vx = currentSpeed; player.facingLeft = false; }
    else player.vx *= 0.8;

    // Lógica de Doble Salto (Edge Triggered)
    if (keys.up && player.grounded && jumpMult > 0) {
      // Salto Normal (Permite bunny-hop)
      player.vy = JUMP_FORCE * jumpMult;
      player.grounded = false;
      player.canDoubleJump = player.hasPet; // Habilita doble salto si tiene mascota
      if (audioRef.current) audioRef.current.jump();
      spawnParticle(player.x, player.y + player.height, '#ccc', 10);
      keys.upJustPressed = false; // Consume el edge
    } 
    else if (keys.upJustPressed && !player.grounded && player.canDoubleJump && jumpMult > 0) {
      // Doble Salto en el Aire
      player.vy = JUMP_FORCE * jumpMult * 0.9;
      player.canDoubleJump = false;
      if (audioRef.current) audioRef.current.jump();
      spawnParticle(player.x, player.y + player.height, '#ff4b4b', 15); // Aura de salto mágico
      keys.upJustPressed = false; // Consume el edge
    }
    keys.upJustPressed = false; // Reset de seguridad en cada frame

    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;
    player.grounded = false;

    // Físicas de Entidades Dinámicas
    s.entities.forEach(ent => {
        if (ent.type === ENTITY.DYNAMIC_REWARD && ent.active) {
            ent.vy += GRAVITY;
            ent.y += ent.vy;
            s.entities.forEach(plat => {
                if ((plat.type === ENTITY.PLATFORM || plat.type === ENTITY.STATIC_BLOCK || plat.type === ENTITY.SURPRISE_BLOCK) && 
                    ent.x < plat.x + plat.width && ent.x + ent.width > plat.x && ent.y < plat.y + plat.height && ent.y + ent.height > plat.y) {
                    if (ent.vy > 0 && ent.y + ent.height - ent.vy <= plat.y + 15) {
                        ent.y = plat.y - ent.height;
                        ent.vy = 0;
                    }
                }
            });
        }
    });

    // Colisiones del Jugador (AABB)
    s.entities.forEach(entity => {
      if (entity.x < camera.x - 300 || entity.x > camera.x + viewport.width + 300) return;

      if (entity.type === ENTITY.ENEMY && entity.active) {
        entity.x += entity.vx;
        if (entity.x < entity.startX || entity.x > entity.startX + entity.range) entity.vx *= -1;
      }

      const isColliding = player.x < entity.x + entity.width && player.x + player.width > entity.x &&
                          player.y < entity.y + entity.height && player.y + player.height > entity.y;

      if (isColliding) {
        const isSolid = entity.type === ENTITY.PLATFORM || entity.type === ENTITY.STATIC_BLOCK || entity.type === ENTITY.SURPRISE_BLOCK;
        
        if (isSolid) {
           // Detección Golpe de Techo
           if (player.vy < 0 && player.y <= entity.y + entity.height && player.y - player.vy >= entity.y + entity.height - 15) {
               player.y = entity.y + entity.height;
               player.vy = 0;
               if (entity.type === ENTITY.SURPRISE_BLOCK && !entity.isHit) {
                   entity.isHit = true;
                   spawnDynamicReward(entity.x, entity.y, entity.reward);
                   if (audioRef.current) audioRef.current.coin();
               }
           } 
           // Colisión Suelo regular
           else if (player.vy > 0 && player.y + player.height - player.vy <= entity.y + 15) {
             player.y = entity.y - player.height;
             player.vy = 0;
             player.grounded = true;
             player.lastSafeX = player.x;
             player.lastSafeY = player.y;
             if (player.hasPet) player.canDoubleJump = true; // Restaurar salto doble al tocar suelo
           } 
           // Pared
           else {
             player.vx = 0;
             if (player.x < entity.x) player.x = entity.x - player.width;
             else player.x = entity.x + entity.width;
           }
        }
        else if (entity.type === ENTITY.DYNAMIC_REWARD && entity.active) {
          entity.active = false;
          if (entity.rewardType === 'PET') {
              player.hasPet = true;
              setUiState(p => ({ ...p, message: '¡MASCOTA YOSHI! Doble Salto + Velocidad', messageType: 'success' }));
              if (audioRef.current) audioRef.current.powerup();
              spawnParticle(entity.x, entity.y, '#ff4b4b', 30, true);
          } else if (entity.rewardType === 'PUKA') {
              player.state = PLAYER_STATE.PUKA_OVERDRIVE; player.stateTimer = 8000;
              setUiState(p => ({ ...p, playerState: PLAYER_STATE.PUKA_OVERDRIVE, message: '¡PUKA POWER EXTRA!', messageType: 'success' }));
              if (audioRef.current) audioRef.current.powerup();
              spawnParticle(entity.x, entity.y, '#ff4b4b', 30, true);
          } else {
              s.score += 1;
              if (audioRef.current) audioRef.current.coin();
          }
        }
        else if (entity.type === ENTITY.COIN && entity.active) {
          entity.active = false;
          s.score += 1;
          if (audioRef.current) audioRef.current.coin();
          spawnParticle(entity.x, entity.y, '#ffd700', 8);
        }
        else if (entity.type === ENTITY.ENEMY && entity.active) {
          if (player.vy > 0 && player.y + player.height - player.vy <= entity.y + 20) {
            entity.active = false;
            player.vy = JUMP_FORCE * 0.8;
            if (audioRef.current) audioRef.current.stomp();
            spawnParticle(entity.x, entity.y, theme.floor, 15);
            s.score += 2;
          } else {
             // Absorción de daño 
             if (player.hasPet) {
                 player.hasPet = false;
                 player.canDoubleJump = false;
                 player.vy = -6; player.vx = player.facingLeft ? 8 : -8;
                 entity.active = false;
                 if (audioRef.current) audioRef.current.hurt();
                 setUiState(p => ({ ...p, message: '¡MASCOTA PERDIDA!', messageType: 'warning' }));
             } else if (player.isGiant) {
               player.isGiant = false;
               player.width = 40; player.height = 60;
               player.vy = -6; player.vx = player.facingLeft ? 8 : -8;
               entity.active = false;
               if (audioRef.current) audioRef.current.hurt();
               setUiState(p => ({ ...p, message: '¡PODER PERDIDO!', messageType: 'warning' }));
             } else {
               player.vx = player.facingLeft ? 10 : -10;
               player.vy = -5;
               s.score = Math.max(0, s.score - 1); 
               if (audioRef.current) audioRef.current.hurt();
               setUiState(p => ({ ...p, message: '¡GOLPE! -1 🪙', messageType: 'error' }));
             }
          }
        }
        else if (entity.type === ENTITY.SUPER_FRUIT && entity.active) {
            entity.active = false;
            if (!player.isGiant) {
                player.isGiant = true;
                player.width = 60; player.height = 90; player.y -= 30; 
            }
            s.lives += 1;
            if (audioRef.current) audioRef.current.powerup();
            setUiState(p => ({ ...p, message: '¡CAMU CAMU! +1 VIDA', messageType: 'success', lives: s.lives }));
            spawnParticle(entity.x, entity.y, '#dc143c', 20);
        }
        else if ((entity.type === ENTITY.VENDING_GENERIC || entity.type === ENTITY.VENDING_PUKA) && entity.active) {
            const isPuka = entity.type === ENTITY.VENDING_PUKA;
            const cost = isPuka ? COST_PUKA : COST_GENERIC;
            
            if (s.score >= cost) {
              entity.active = false;
              s.score -= cost;
              if (audioRef.current) audioRef.current.powerup();
              const newState = isPuka ? PLAYER_STATE.PUKA_OVERDRIVE : PLAYER_STATE.GENERIC_RUSH;
              player.state = newState;
              player.stateTimer = isPuka ? 8000 : 4000;
              setUiState(p => ({ 
                ...p, playerState: newState, 
                message: isPuka ? '¡PUKA POWER! Energía Natural' : '¡RUSH DE QUÍMICOS!', 
                messageType: isPuka ? 'success' : 'warning' 
              }));
              spawnParticle(entity.x, entity.y, isPuka ? '#ff4b4b' : '#3b82f6', 30);
            }
        }
        else if (entity.type === ENTITY.GOAL) {
            player.isDead = true;
            if (audioRef.current) audioRef.current.victory();
            setAppState(APP_STATE.VICTORY);
            return;
        }
      }
    });

    const targetCamX = player.x - CAMERA_OFFSET_X;
    camera.x += (targetCamX - camera.x) * 0.1;
    if (camera.x < 0) camera.x = 0;

    s.particles.forEach((p, index) => {
      p.life -= 16.6;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) s.particles.splice(index, 1);
    });

    render(canvasRef.current.getContext('2d'), s, theme);
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [appState, selection]);

  // --- RENDERING PIPELINE ---
  const render = (ctx, s, theme) => {
    const { camera, viewport, player } = s;
    const genderData = GENDERS[selection.gender];
    
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    ctx.save();
    ctx.translate(-camera.x, 0);

    ctx.fillStyle = theme.floor + '40';
    for(let i=0; i<30; i++) {
       const px = (i * 400) + (camera.x * 0.7);
       ctx.beginPath();
       ctx.arc(px, 400, 100, 0, Math.PI * 2);
       ctx.fill();
    }

    ctx.textBaseline = "top";
    s.entities.forEach(entity => {
      if (entity.x < camera.x - 200 || entity.x > camera.x + viewport.width + 200) return;

      if (entity.type === ENTITY.PLATFORM) {
        ctx.fillStyle = theme.platform;
        ctx.fillRect(entity.x, entity.y, entity.width, 20);
        ctx.fillStyle = theme.floor;
        const renderHeight = entity.height === 20 ? 0 : entity.height - 20; 
        if (renderHeight > 0) ctx.fillRect(entity.x, entity.y + 20, entity.width, renderHeight);
      } 
      else if (entity.type === ENTITY.STATIC_BLOCK) {
        ctx.fillStyle = theme.platform; 
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        ctx.strokeStyle = theme.floor; ctx.lineWidth = 3;
        ctx.strokeRect(entity.x, entity.y, entity.width, entity.height);
      }
      else if (entity.type === ENTITY.SURPRISE_BLOCK) {
        ctx.fillStyle = entity.isHit ? '#7f8c8d' : '#f1c40f'; 
        ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
        ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 2; 
        ctx.strokeRect(entity.x, entity.y, entity.width, entity.height);
        if (!entity.isHit) {
            ctx.fillStyle = '#d35400'; ctx.font = "bold 24px Arial"; ctx.textAlign = "center";
            ctx.fillText("?", entity.x + entity.width/2, entity.y + 6); 
        }
      }
      else if (entity.type === ENTITY.DYNAMIC_REWARD && entity.active) {
        ctx.font = "30px Arial"; ctx.textAlign = "left";
        if (entity.rewardType === 'PET') {
            ctx.shadowColor = "rgba(255, 75, 75, 1)"; ctx.shadowBlur = 15;
            ctx.fillText("🐈", entity.x, entity.y);
            ctx.shadowBlur = 0;
        } else if (entity.rewardType === 'PUKA') {
            ctx.fillText("🥫", entity.x, entity.y);
        } else {
            ctx.fillText("🪙", entity.x, entity.y);
        }
      }
      else if (entity.type === ENTITY.COIN && entity.active) {
        ctx.textAlign = "left"; ctx.font = "30px Arial";
        ctx.fillText("🪙", entity.x, entity.y);
      }
      else if (entity.type === ENTITY.ENEMY && entity.active) {
        ctx.font = "40px Arial"; ctx.textAlign = "left";
        ctx.save();
        if (entity.vx > 0) {
            ctx.translate(entity.x + entity.width, entity.y); ctx.scale(-1, 1);
            ctx.fillText(entity.emoji, 0, 0);
        } else {
            ctx.fillText(entity.emoji, entity.x, entity.y);
        }
        ctx.restore();
      }
      else if (entity.type === ENTITY.VENDING_GENERIC || entity.type === ENTITY.VENDING_PUKA) {
         if(!entity.active) return;
         ctx.textAlign = "left";
         const isPuka = entity.type === ENTITY.VENDING_PUKA;
         ctx.fillStyle = isPuka ? '#e11d48' : '#1e3a8a';
         ctx.fillRect(entity.x, entity.y, entity.width, entity.height);
         ctx.fillStyle = '#0f172a';
         ctx.fillRect(entity.x + 10, entity.y + 10, entity.width - 20, entity.height - 40);
         ctx.font = "30px Arial";
         ctx.fillText(isPuka ? '🥫' : '🥤', entity.x + 25, entity.y + 20);
         
         const label = isPuka ? 'PUKA POWER' : 'RED BULL';
         ctx.font = "900 18px Arial"; 
         const textWidth = ctx.measureText(label).width;
         ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
         ctx.fillRect(entity.x + (entity.width / 2) - (textWidth / 2) - 8, entity.y - 32, textWidth + 16, 24);

         ctx.fillStyle = isPuka ? '#ff4b4b' : '#60a5fa';
         ctx.shadowColor = isPuka ? '#ff4b4b' : 'transparent'; ctx.shadowBlur = isPuka ? 15 : 0;
         ctx.fillText(label, entity.x + (entity.width / 2) - (textWidth / 2), entity.y - 28);
         ctx.shadowBlur = 0;
         
         const itemCost = isPuka ? COST_PUKA : COST_GENERIC;
         ctx.fillStyle = '#fff'; ctx.font = "bold 14px Arial";
         ctx.fillText(`${itemCost} 🪙`, entity.x + 20, entity.y + entity.height - 25);
      }
      else if (entity.type === ENTITY.SUPER_FRUIT && entity.active) {
         ctx.textAlign = "left"; ctx.font = "40px Arial"; ctx.fillText("🍒", entity.x, entity.y);
      }
      else if (entity.type === ENTITY.GOAL) {
          ctx.textAlign = "left"; ctx.font = "100px Arial"; ctx.fillText(theme.goal, entity.x, entity.y);
      }
    });

    s.particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // --- RENDER JUGADOR Y MASCOTA ---
    const isRunning = Math.abs(player.vx) > 0.5;
    let emoji = isRunning ? genderData.run : genderData.idle;
    if (player.state === PLAYER_STATE.TACHYCARDIA) emoji = '😵';

    ctx.save();
    
    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE) {
      ctx.shadowColor = "rgba(255, 75, 75, 1)"; ctx.shadowBlur = 25;
    } else if (player.state === PLAYER_STATE.TACHYCARDIA) {
      ctx.filter = "grayscale(100%)";
    }

    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    ctx.translate(centerX, centerY);

    ctx.save();
    if (!player.facingLeft) ctx.scale(-1, 1);
    
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    if (player.hasPet) {
        ctx.shadowColor = "rgba(255, 75, 75, 1)"; ctx.shadowBlur = 20;
        ctx.font = "50px Arial";
        
        if (isRunning && !player.isDead && player.grounded) {
          const runCycle = Date.now() / 60;
          ctx.translate(0, Math.abs(Math.sin(runCycle)) * -4);
        }
        ctx.fillText("🐈", 0, 15);
        ctx.shadowBlur = 0;
        
        ctx.font = player.isGiant ? "60px Arial" : "40px Arial";
        ctx.fillText(emoji, 0, -25);
    } 
    else {
        ctx.font = player.isGiant ? "85px Arial" : "55px Arial"; 
        if (isRunning && !player.isDead && player.grounded) {
          const runCycle = Date.now() / 80;
          ctx.rotate(Math.sin(runCycle) * 0.15); 
          ctx.translate(0, Math.abs(Math.sin(runCycle)) * -8); 
        }
        ctx.fillText(emoji, 0, 0);
    }
    ctx.restore(); 

    if (player.state === PLAYER_STATE.PUKA_OVERDRIVE && !player.isDead) {
      const pukaTime = Date.now() / 150; 
      ctx.font = player.isGiant ? "35px Arial" : "20px Arial";
      ctx.shadowBlur = 0; 
      ctx.fillText("⚡", Math.cos(pukaTime) * (player.width * 0.9), Math.sin(pukaTime) * (player.height * 0.7));
      ctx.fillText("⚡", Math.cos(pukaTime + Math.PI) * (player.width * 0.9), Math.sin(pukaTime + Math.PI) * (player.height * 0.7));
    }

    if (player.idleTimer > 3000 && !player.isDead) {
      const zOffset = Math.sin(Date.now() / 200) * 5; 
      ctx.font = "25px Arial";
      ctx.fillText("💤", 15, -player.height/2 - 15 + zOffset);
    }

    ctx.restore(); 
    ctx.restore(); 
  };

  // Input Handlers ajustados para Edge Detection
  useEffect(() => {
    if (appState !== APP_STATE.PLAYING) return;
    const canvas = canvasRef.current;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
        engineState.current.viewport = { width: canvas.width, height: canvas.height };
      }
    });
    resizeObserver.observe(canvas.parentElement);

    const handleKeyDown = (e) => {
      if(e.code === 'ArrowLeft') engineState.current.keys.left = true;
      if(e.code === 'ArrowRight') engineState.current.keys.right = true;
      if(e.code === 'ArrowUp' || e.code === 'Space') {
          if (!engineState.current.keys.up) engineState.current.keys.upJustPressed = true;
          engineState.current.keys.up = true;
      }
    };
    const handleKeyUp = (e) => {
      if(e.code === 'ArrowLeft') engineState.current.keys.left = false;
      if(e.code === 'ArrowRight') engineState.current.keys.right = false;
      if(e.code === 'ArrowUp' || e.code === 'Space') engineState.current.keys.up = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    requestRef.current = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(requestRef.current);
      resizeObserver.disconnect();
    };
  }, [appState, gameLoop]);

  const startGame = (themeId) => {
    if (!audioRef.current) audioRef.current = new SoundEngine();
    setSelection(p => ({ ...p, theme: themeId }));
    setAppState(APP_STATE.PLAYING);
    generateLevel(THEMES[themeId]);
  };

  const handleTouch = (key, val) => (e) => {
    e.preventDefault();
    if(appState === APP_STATE.PLAYING) {
        if (key === 'up' && val && !engineState.current.keys.up) {
            engineState.current.keys.upJustPressed = true;
        }
        engineState.current.keys[key] = val;
    }
  };

  if (appState === APP_STATE.MENU_GENDER) {
    return (
      <div className="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-5xl font-black italic mb-2 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">PUKA POWER</h1>
        <p className="text-xl text-slate-400 mb-10">Elige a tu personaje para la aventura</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Object.values(GENDERS).map(g => (
            <button key={g.id} onClick={() => { setSelection({ gender: g.id }); setAppState(APP_STATE.MENU_LEVEL); }}
              className="bg-slate-800 p-8 rounded-2xl border-2 border-slate-700 hover:border-red-500 hover:scale-105 transition-all group">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">{g.idle}</div>
              <div className="font-bold text-lg uppercase">{g.name}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (appState === APP_STATE.MENU_LEVEL) {
    return (
      <div className="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <button onClick={() => setAppState(APP_STATE.MENU_GENDER)} className="absolute top-6 left-6 flex items-center text-slate-400 hover:text-white">
          <ArrowLeft className="mr-2"/> Cambiar Personaje
        </button>
        <h2 className="text-4xl font-black mb-10">¿A dónde vas hoy?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {Object.values(THEMES).map(t => (
            <button key={t.id} onClick={() => startGame(t.id)} style={{ backgroundColor: t.bg }}
              className="relative overflow-hidden p-8 rounded-2xl border-4 border-transparent hover:border-white hover:scale-105 transition-all text-left group shadow-2xl">
              <div className="text-7xl mb-4 absolute right-4 bottom-4 opacity-50 group-hover:opacity-100 transition-opacity">{t.goal}</div>
              <div className="relative z-10">
                <h3 className="font-black text-3xl text-black/80 uppercase">{t.name}</h3>
                <p className="font-bold text-black/60 mt-2">Dificultad Normal</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (appState === APP_STATE.GAME_OVER || appState === APP_STATE.VICTORY) {
    const isVictory = appState === APP_STATE.VICTORY;
    return (
      <div className="w-full h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className={`text-8xl mb-6 ${isVictory ? 'animate-bounce' : 'grayscale opacity-50'}`}>
          {isVictory ? THEMES[selection.theme].goal : '💀'}
        </div>
        <h1 className={`text-6xl font-black uppercase mb-4 ${isVictory ? 'text-green-400' : 'text-red-500'}`}>
          {isVictory ? '¡Llegaste a tiempo!' : 'Game Over'}
        </h1>
        <p className="text-2xl text-slate-300 mb-8">
          Monedas recolectadas: <span className="text-yellow-400 font-bold">{uiState.coins} 🪙</span>
        </p>
        <button onClick={() => setAppState(APP_STATE.MENU_LEVEL)} className="bg-red-500 hover:bg-red-600 text-white font-black text-xl py-4 px-10 rounded-full flex items-center gap-3 transition-transform hover:scale-105">
          <Play fill="currentColor" /> JUGAR DE NUEVO
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative flex flex-col font-sans select-none">
      <div className="absolute top-0 w-full p-4 z-10 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="flex gap-1 mb-1">
            {Array.from({ length: Math.max(0, uiState.lives) }).map((_, i) => (
              <Heart key={i} className="text-red-500 fill-red-500 w-8 h-8 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" />
            ))}
          </div>

          <div className="flex items-center gap-2 bg-slate-800/90 px-4 py-2 rounded-xl border border-slate-700 shadow-xl">
            <Coins className="text-yellow-400 w-6 h-6" />
            <span className="text-2xl font-black text-white">{uiState.coins}</span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm tracking-wide transition-colors shadow-lg
            ${uiState.playerState === PLAYER_STATE.PUKA_OVERDRIVE || engineState.current.player.hasPet ? 'text-red-500 bg-red-500/10 border-red-500' : 
              uiState.playerState === PLAYER_STATE.GENERIC_RUSH ? 'text-blue-400 bg-blue-400/10 border-blue-400' :
              uiState.playerState === PLAYER_STATE.TACHYCARDIA ? 'text-gray-400 bg-gray-600/30 border-gray-500' : 'text-green-400 bg-green-400/10 border-green-400'}`}>
             {uiState.playerState === PLAYER_STATE.PUKA_OVERDRIVE || engineState.current.player.hasPet ? <Activity className="w-5 h-5 animate-pulse" /> : <ShieldCheck className="w-5 h-5" />}
             {uiState.playerState === PLAYER_STATE.NORMAL && !engineState.current.player.hasPet ? 'SISTEMA ESTABLE' : uiState.playerState.replace('_', ' ')}
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end">
          <div className={`text-3xl font-black bg-slate-800/80 px-4 py-1 rounded-lg border border-slate-700 ${uiState.timeLeft < 15 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {Math.floor(uiState.timeLeft / 60)}:{(uiState.timeLeft % 60).toString().padStart(2, '0')}
          </div>
        </div>
      </div>

      {uiState.message && (
        <div className="absolute top-24 w-full flex justify-center z-20 pointer-events-none">
          <div className={`px-6 py-3 rounded-full backdrop-blur-lg border font-bold uppercase text-sm flex gap-2 items-center
            ${uiState.messageType === 'success' ? 'bg-red-500/20 text-red-400 border-red-500' : 
              uiState.messageType === 'error' ? 'bg-gray-800/80 text-white border-gray-600' : 
              uiState.messageType === 'warning' ? 'bg-orange-500/20 text-orange-400 border-orange-500' : 'bg-blue-500/20 text-blue-400 border-blue-500'}
          `}>
            {uiState.message}
          </div>
        </div>
      )}

      <div className="flex-1 w-full relative">
        <canvas ref={canvasRef} className="block w-full h-full" style={{ imageRendering: 'pixelated' }} />
      </div>

      <div className="absolute bottom-8 w-full px-8 flex justify-between z-30 md:hidden opacity-70">
        <div className="flex gap-4">
          <button onTouchStart={handleTouch('left', true)} onTouchEnd={handleTouch('left', false)} onMouseDown={handleTouch('left', true)} onMouseUp={handleTouch('left', false)} className="w-16 h-16 bg-black/50 rounded-full border border-white/20 text-white text-2xl font-black touch-none flex items-center justify-center">←</button>
          <button onTouchStart={handleTouch('right', true)} onTouchEnd={handleTouch('right', false)} onMouseDown={handleTouch('right', true)} onMouseUp={handleTouch('right', false)} className="w-16 h-16 bg-black/50 rounded-full border border-white/20 text-white text-2xl font-black touch-none flex items-center justify-center">→</button>
        </div>
        <button onTouchStart={handleTouch('up', true)} onTouchEnd={handleTouch('up', false)} onMouseDown={handleTouch('up', true)} onMouseUp={handleTouch('up', false)} className="w-20 h-20 bg-red-500/50 rounded-full border border-red-500 text-white text-2xl font-black touch-none flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.5)]">↑</button>
      </div>
    </div>
  );
}