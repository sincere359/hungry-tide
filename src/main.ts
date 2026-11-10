import './style.css';
import { World } from './world';
import { Player } from './player';
import { Input } from './input';
import { AudioEngine } from './audio';
import { UI } from './ui';
import { Bus } from './bus';
import {
  loadSave, saveGame, addXp, purchase, buyUpgrade, completeMission,
  isMissionDone, type SaveData, type UpgradeSet,
} from './state';
import {
  MISSIONS, sharkById, zoneAt, type SharkId, type MissionDef, type StatKey,
  type PreyDef,
} from './data';

type GState = 'menu' | 'playing' | 'paused' | 'dead';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const bus = new Bus();
const audio = new AudioEngine();
const world = new World(canvas, bus);
const player = new Player(world.scene, bus);
const input = new Input();
const ui = new UI();

let save: SaveData = loadSave();
(window as unknown as { __save: SaveData }).__save = save;

let state: GState = 'menu';
let score = 0;
let mult = 2;
let multMax = 2;
let comboTimer = 0;
let comboFish = 0;
let comboFishMax = 0;
let rush = 0;
let rushTime = 0;
let runCoins = 0;
let runMissions = 0;
let runTime = 0;
let noDamageTime = 0;
let maxDepth = 0;
let freeRevive = true;
let hudTimer = 0;
let missionTimer = 0;
let saveTimer = 10;
let fpsAccum = 0;
let fpsFrames = 0;
let degraded = false;
let tutorialShown = false;
let debugGod = false;
let boostFx = false;

const runStats: Record<StatKey, number> = {
  eatFish: 0, eatTurtle: 0, eatPelican: 0, eatDiver: 0, eatFisher: 0, eatHuman: 0,
  eatShark: 0, eatGW: 0, eatGulper: 0, mine: 0, sub: 0, depth: 0, score: 0,
  combo: 0, boostDist: 0, survive: 0, objects: 0, noDamage: 0, crab: 0, eatInCombo: 0,
};

const currentId = (): SharkId => save.current;

function statValue(m: MissionDef): number {
  switch (m.stat) {
    case 'score': return Math.floor(score);
    case 'depth': return Math.floor(maxDepth);
    case 'survive': return runTime;
    case 'combo': return multMax;
    case 'boostDist': return player.boostDistance;
    case 'noDamage': return noDamageTime;
    case 'eatInCombo': return comboFishMax;
    case 'objects': return runStats.objects;
    default: return runStats[m.stat];
  }
}

function checkMissions(announce = true): void {
  const id = currentId();
  const list = MISSIONS[id];
  const othersDone = list.filter(m => !m.super).every(m => isMissionDone(save, id, m));
  for (const m of list) {
    if (m.super && !othersDone && !isMissionDone(save, id, m)) continue;
    const before = isMissionDone(save, id, m);
    completeMission(save, id, m, statValue(m));
    if (!before && isMissionDone(save, id, m)) {
      runCoins += m.reward;
      runMissions++;
      if (announce) ui.toast(`任务完成：${m.text}  +${m.reward}`);
      audio.play('level');
    }
  }
}

function resetRun(): void {
  score = 0;
  mult = 2;
  multMax = 2;
  comboTimer = 0;
  comboFish = 0;
  comboFishMax = 0;
  rush = 0;
  rushTime = 0;
  runCoins = 0;
  runMissions = 0;
  runTime = 0;
  noDamageTime = 0;
  maxDepth = 0;
  freeRevive = true;
  for (const k of Object.keys(runStats) as StatKey[]) runStats[k] = 0;
  ui.setBoss(false);
  ui.goldRush(false);
}

function setBoostFx(on: boolean): void {
  if (on === boostFx) return;
  boostFx = on;
  ui.setBoost(on);
}

function startRun(): void {
  const id = currentId();
  if (!save.unlocked.includes(id)) return;
  if (window.matchMedia('(orientation: portrait)').matches) {
    ui.toast('请横屏游玩');
    return;
  }
  const def = sharkById(id);
  resetRun();
  player.reset(def, save.levels[id], save.upgrades[id]);
  world.reset(player);
  input.enabled = true;
  input.reset();
  ui.hideMenu();
  ui.hideDead();
  ui.hidePause();
  ui.hideMissions();
  ui.hideToast();
  ui.showHud();
  setBoostFx(false);
  if (!tutorialShown) {
    tutorialShown = true;
    ui.showTutorial();
  }
  state = 'playing';
  audio.init();
  audio.setMode('game');
  saveGame(save);
}

function setupDemo(): void {
  const id = currentId();
  const def = sharkById(id);
  player.reset(def, save.levels[id], save.upgrades[id]);
  player.x = 0;
  player.y = -26;
  player.group.position.set(0, -26, 0);
  world.reset(player);
  world.setGoldRush(false);
}

function showMenu(): void {
  bankCoins();
  save.best = Math.max(save.best, Math.floor(score));
  saveGame(save);
  state = 'menu';
  input.enabled = false;
  input.reset();
  ui.hideDead();
  ui.hidePause();
  ui.hideHud();
  ui.goldRush(false);
  setBoostFx(false);
  audio.setMode('menu');
  setupDemo();
  ui.showMenu(save, menuHandlers);
}

function bankCoins(): void {
  if (runCoins > 0) {
    save.coins += runCoins;
    runCoins = 0;
  }
}

function endRun(): void {
  if (state === 'dead') return;
  state = 'dead';
  input.enabled = false;
  input.reset();
  ui.hideToast();
  ui.hideTutorial();
  setBoostFx(false);
  if (rushTime > 0) endGoldRush();
  checkMissions(false);
  const earned = runCoins;
  bankCoins();
  save.best = Math.max(save.best, Math.floor(score));
  saveGame(save);
  audio.setMode('menu');
  audio.play('death');
  ui.setBoss(false);
  ui.showDead({
    score: Math.floor(score),
    best: save.best,
    coins: earned,
    missions: runMissions,
    canFree: freeRevive,
    reviveCost: 300,
    wallet: save.coins,
  }, revive, () => {
    ui.hideDead();
    showMenu();
  });
}

function revive(): void {
  if (freeRevive) {
    freeRevive = false;
  } else if (save.coins >= 300) {
    save.coins -= 300;
  } else {
    return;
  }
  saveGame(save);
  player.revive();
  ui.hideDead();
  state = 'playing';
  input.enabled = true;
  input.reset();
  audio.init();
  audio.setMode('game');
  audio.play('revive');
  ui.toast('复活！');
}

function startGoldRush(): void {
  rush = 0;
  rushTime = 20;
  player.goldRush = true;
  world.setGoldRush(true);
  ui.goldRush(true);
  audio.setMode('gold');
  audio.play('goldrush');
  ui.toast('GOLD RUSH · 20 秒全金盛宴');
  world.burst(player.x, player.y, 0xffd35c, 24, 10);
}

function endGoldRush(): void {
  rushTime = 0;
  player.goldRush = false;
  world.setGoldRush(false);
  ui.goldRush(false);
  audio.setMode('game');
}

function pauseGame(): void {
  if (state !== 'playing') return;
  state = 'paused';
  input.enabled = false;
  input.reset();
  setBoostFx(false);
  audio.setMode('menu');
  ui.showPause(resumeGame, () => {
    ui.hidePause();
    endRun();
  }, toggleSound, save.sound);
}

function resumeGame(): void {
  if (state !== 'paused') return;
  ui.hidePause();
  state = 'playing';
  input.enabled = true;
  input.reset();
  audio.setMode(rushTime > 0 ? 'gold' : 'game');
}

function toggleSound(): void {
  save.sound = !save.sound;
  audio.setMuted(!save.sound);
  ui.setSound(save.sound);
  saveGame(save);
}

const menuHandlers = {
  onStart: startRun,
  onSelect: (id: SharkId) => {
    if (!save.unlocked.includes(id)) return;
    save.current = id;
    saveGame(save);
    audio.play('ui');
    setupDemo();
    ui.showMenu(save, menuHandlers);
  },
  onBuy: (id: SharkId) => {
    if (purchase(save, id)) {
      saveGame(save);
      audio.play('level');
      setupDemo();
      ui.showMenu(save, menuHandlers);
      ui.toast(`${sharkById(id).name} 已解锁`);
    } else {
      ui.toast('金币不足，或前置鲨鱼未满级');
    }
  },
  onUpgrade: (id: SharkId, stat: keyof UpgradeSet) => {
    if (buyUpgrade(save, id, stat)) {
      saveGame(save);
      audio.play('coin');
      setupDemo();
      ui.showMenu(save, menuHandlers);
    } else {
      ui.toast('金币不足');
    }
  },
  onMissions: (id: SharkId) => {
    ui.showMissions(id, state === 'playing' ? statMap() : null);
  },
  onSound: toggleSound,
};

function statMap(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const k of Object.keys(runStats) as StatKey[]) m[k] = runStats[k];
  m.score = score;
  m.depth = maxDepth;
  m.survive = runTime;
  m.boostDist = player.boostDistance;
  m.noDamage = noDamageTime;
  m.eatInCombo = comboFishMax;
  m.combo = multMax;
  return m;
}

// ---------------- events ----------------
bus.on('sfx', p => audio.play(p as string));
bus.on('fx:bubble', p => {
  const q = p as { x: number; y: number };
  world.bubble(q.x, q.y);
});

bus.on('player:damage', () => {
  ui.flashDamage();
  audio.play('damage');
  noDamageTime = 0;
  world.shake(0.2);
});

bus.on('player:death', () => {
  if (state === 'playing') endRun();
});

bus.on('world:eat', p => {
  const d = p as { def: PreyDef; gold: boolean; coins: number; kind: string };
  const gain = d.def.score * (d.gold ? 3 : 1) * mult;
  score += gain;
  mult = Math.min(24, mult + 0.25);
  multMax = Math.max(multMax, mult);
  comboTimer = 1.4;
  comboFish++;
  comboFishMax = Math.max(comboFishMax, comboFish);

  runStats[d.def.stat] = (runStats[d.def.stat] ?? 0) + 1;
  if (d.def.human) runStats.eatHuman++;

  if (d.coins) runCoins += d.coins;
  if (d.gold) audio.play('coin');

  const xp = d.def.score * (d.gold ? 3 : 1);
  const ups = addXp(save, currentId(), xp);
  if (ups > 0) {
    player.setLevel(save.levels[currentId()]);
    ui.toast(`成长！Lv.${save.levels[currentId()]}`);
    audio.play('level');
  }

  if (rushTime <= 0) {
    rush += gain * 0.02;
    if (rush >= 100) startGoldRush();
  }
  checkMissions();
});

bus.on('world:coin', p => {
  runCoins += (p as { amount: number }).amount;
  audio.play('coin');
});

bus.on('world:stat', p => {
  const stat = (p as { stat: StatKey }).stat;
  runStats[stat] = (runStats[stat] ?? 0) + 1;
  checkMissions();
});

bus.on('world:pickup', p => {
  const d = p as { kind: string; coins: number };
  runCoins += d.coins;
  if (d.kind === 'object') runStats.objects++;
  audio.play(d.kind === 'shell' ? 'coin' : 'gem');
  ui.toast(d.kind === 'shell' ? '贝壳 +25' : '沉没物 +60');
  checkMissions();
});

bus.on('boss:start', () => {
  ui.setBoss(true, world.bossPhase());
  ui.toast('GIANT CRAB 出现！闪避 3 次后冲刺弱点');
  audio.setMode('boss');
});
bus.on('boss:hp', p => {
  const phase = (p as { phase: number }).phase;
  ui.setBoss(phase > 0, Math.max(0, phase));
});
bus.on('boss:dodge', p => {
  const c = (p as { count: number }).count;
  ui.toast(`闪避 ${c}/3`);
});
bus.on('boss:vulnerable', () => {
  ui.toast('弱点暴露！冲刺撞击');
  audio.play('goldrush');
});
bus.on('boss:dead', () => {
  runCoins += 800;
  save.gems += 3;
  runStats.crab = 1;
  ui.setBoss(false);
  ui.toast('GIANT CRAB 击败！+800 金币 +3 宝石');
  checkMissions();
});

// ---------------- loop ----------------
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.033, Math.max(0.0005, (now - last) / 1000));
  last = now;
  ui.tick(dt);
  audio.update();

  if (state === 'playing') {
    player.update(dt, input.dir, input.boost);
    world.update(dt);
    if (state === 'playing') gameTick(dt);
    fpsAccum += dt;
    fpsFrames++;
    if (fpsAccum > 3 && !degraded) {
      const fps = fpsFrames / fpsAccum;
      if (fps < 42) {
        world.setLowQuality();
        degraded = true;
      }
      fpsAccum = 0;
      fpsFrames = 0;
    }
  } else if (state === 'menu' || state === 'dead') {
    world.updateAmbientScene(dt);
  }

  world.render();
  requestAnimationFrame(frame);
}

function gameTick(dt: number): void {
  if (debugGod) {
    player.maxHp = 99999;
    player.hp = 99999;
  }
  runTime += dt;
  noDamageTime += dt;
  maxDepth = Math.max(maxDepth, player.depth);
  setBoostFx(player.boosting);

  if (comboTimer > 0) {
    comboTimer -= dt;
  } else if (mult > 2) {
    mult = Math.max(2, mult - dt * 2.0);
    comboFish = 0;
  }

  if (rushTime > 0) {
    rushTime -= dt;
    if (rushTime <= 0) endGoldRush();
  }

  missionTimer -= dt;
  if (missionTimer <= 0) {
    missionTimer = 0.3;
    checkMissions();
  }

  saveTimer -= dt;
  if (saveTimer <= 0) {
    saveTimer = 10;
    saveGame(save);
  }

  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.06;
    ui.updateHud({
      score, mult, hp: player.hp, maxHp: player.maxHp, depth: player.depth,
      coins: save.coins + runCoins, rush: rushTime > 0 ? 100 : rush,
      boost: player.boost, sharkName: player.def.name, level: player.level,
    });
  }
}

// ---------------- boot ----------------
world.setPlayer(player);
audio.setMuted(!save.sound);
audio.setMode('menu');
setupDemo();
ui.showMenu(save, menuHandlers);
ui.setSound(save.sound);

const syncViewport = (): void => {
  const vv = window.visualViewport;
  const h = Math.round(vv?.height ?? window.innerHeight);
  document.documentElement.style.setProperty('--app-h', `${h}px`);
  world.resize();
};
syncViewport();
window.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('resize', syncViewport);
window.visualViewport?.addEventListener('scroll', syncViewport);

const fsBtn = document.getElementById('menuFullscreen') as HTMLButtonElement;
const updateFsLabel = (): void => {
  fsBtn.textContent = document.fullscreenElement ? '退出全屏' : '全屏';
};
fsBtn.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      try { await screen.orientation.lock('landscape'); } catch { /* unsupported */ }
    } else {
      try { screen.orientation.unlock(); } catch { /* unsupported */ }
      await document.exitFullscreen();
    }
  } catch {
    ui.toast('当前浏览器不支持全屏，可添加到主屏幕');
  }
  updateFsLabel();
  syncViewport();
});
document.addEventListener('fullscreenchange', () => {
  updateFsLabel();
  syncViewport();
});

input.attach(
  canvas,
  document.getElementById('joystick')!,
  document.getElementById('joyKnob')!,
  document.getElementById('boostBtn')!,
);
input.onFirstGesture = () => audio.init();

document.addEventListener('pointerdown', () => audio.init(), { once: true });
document.getElementById('pauseBtn')!.addEventListener('click', pauseGame);
document.getElementById('missionsBtn')!.addEventListener('click', () => {
  if (state !== 'playing') return;
  state = 'paused';
  input.enabled = false;
  input.reset();
  ui.showMissions(currentId(), statMap(), () => {
    if (state === 'paused') {
      state = 'playing';
      input.enabled = true;
    }
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    audio.suspend();
    if (state === 'playing') pauseGame();
  } else {
    audio.resume();
  }
});

// iOS Safari 专用兜底：手势缩放、页面缓存、横竖屏事件
document.addEventListener('gesturestart', e => e.preventDefault());
const unlockAudio = (): void => {
  audio.init();
  if (audio.ctx && audio.ctx.state === 'running') {
    document.removeEventListener('pointerdown', unlockAudio, true);
    document.removeEventListener('touchstart', unlockAudio, true);
  }
};
document.addEventListener('pointerdown', unlockAudio, true);
document.addEventListener('touchstart', unlockAudio, true);
window.addEventListener('pagehide', () => {
  audio.suspend();
  if (state === 'playing') pauseGame();
});
window.addEventListener('pageshow', () => audio.resume());
window.addEventListener('orientationchange', () => {
  if (window.matchMedia('(orientation: portrait)').matches && state === 'playing') pauseGame();
});

window.addEventListener('resize', () => {
  const zone = zoneAt(player.y);
  document.body.dataset.zone = zone.id;
});

window.matchMedia('(orientation: portrait)').addEventListener('change', e => {
  if (e.matches && state === 'playing') pauseGame();
});

// 调试面板
if (location.search.includes('debug')) {
  const perf = document.createElement('div');
  perf.id = 'perf';
  perf.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:10px monospace;color:#9ff2ff;background:rgba(0,0,0,.55);padding:4px 6px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(perf);
  setInterval(() => {
    const d = world.debug;
    perf.textContent = `fps ${(fpsFrames / Math.max(0.001, fpsAccum)).toFixed(0)}  fish ${d.fish}  ents ${d.ents}  calls ${d.calls}  score ${Math.floor(score)}  state ${state}`;
  }, 500);
}

(window as unknown as { __game: unknown }).__game = {
  get state() { return state; },
  get score() { return Math.floor(score); },
  get coins() { return save.coins + runCoins; },
  get hp() { return Math.round(player.hp); },
  get x() { return Math.round(player.x); },
  get y() { return Math.round(player.y); },
  get fish() { return world.debug.fish; },
  get ents() { return world.debug.ents; },
  get calls() { return world.debug.calls; },
  get mode() { return rushTime > 0 ? 'gold' : 'normal'; },
  get bossPhase() { return world.bossPhase(); },
  get bossActive() { return world.bossActive; },
  get bossState() { return world.bossState(); },
  get bossDodge() { return world.bossDodge(); },
  get bossDefeated() { return world.bossDefeated; },
  get rush() { return rushTime > 0 ? 100 : Math.round(rush); },
  get shark() { return player.def ? player.def.name : ''; },
  get level() { return player.level; },
  get audioState() { return audio.ctx ? audio.ctx.state : 'none'; },
  get fps() { return Math.round(fpsFrames / Math.max(0.001, fpsAccum)); },
  visuals: () => world.debugVisuals(),
  get scene() { return world.scene; },
  start: () => startRun(),
  setScore: (v: number) => { score = v; },
  spawnFish: (x: number, y: number, n = 8) => world.spawnTestFish(x, y, n),
  tp: (x: number, y: number) => { player.x = x; player.y = y; player.vx = 0; player.vy = 0; },
  hurt: (n: number) => player.takeDamage(n, 'debug'),
  kill: () => { player.goldRush = false; player.hp = 0; player.die(); },
  gold: () => startGoldRush(),
  addCoins: (n: number) => { runCoins += n; },
  boost: (on: boolean) => input.pressBoostButton(on),
  god: () => { debugGod = true; player.maxHp = 99999; player.hp = 99999; },
  grant: (n: number) => { save.coins += n; saveGame(save); },
  levelUp: (id: SharkId, lv: number) => {
    save.levels[id] = lv;
    save.xp[id] = [0, 120, 320, 640, 1100, 1750, 2650, 3850, 5400, 7400][Math.max(0, lv - 1)];
    saveGame(save);
  },
  get unlocked() { return save.unlocked.join(','); },
  finish: () => endRun(),
};

requestAnimationFrame(frame);
