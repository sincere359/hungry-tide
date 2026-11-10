import { SHARKS, MISSIONS, type SharkId, type MissionDef } from './data';
import {
  type SaveData, type UpgradeSet, upgradeCost, canPurchase, isMissionDone,
  missionProgress, superUnlocked, xpToNext, MAX_LEVEL,
} from './state';

const fmt = (n: number) => Math.floor(n).toLocaleString('en-US');

export interface DeadInfo {
  score: number;
  best: number;
  coins: number;
  missions: number;
  canFree: boolean;
  reviveCost: number;
  wallet: number;
}

export interface MenuHandlers {
  onStart: () => void;
  onSelect: (id: SharkId) => void;
  onBuy: (id: SharkId) => void;
  onUpgrade: (id: SharkId, stat: keyof UpgradeSet) => void;
  onMissions: (id: SharkId) => void;
  onSound: () => void;
}

export class UI {
  private el = (id: string) => document.getElementById(id)!;

  readonly hud = this.el('hud');
  private menu = this.el('menu');
  private dead = this.el('deadScreen');
  private pause = this.el('pauseScreen');
  private missionsEl = this.el('missionsPanel');
  private rail = this.el('sharkRail');
  private toastEl = this.el('toast');
  private tutorial = this.el('tutorial');
  private gold = this.el('goldVignette');
  private damage = this.el('damageVignette');
  private boostLines = this.el('boostLines');

  private score = this.el('scoreTxt');
  private mult = this.el('multTxt');
  private hpFill = this.el('hpFill');
  private hpTxt = this.el('hpTxt');
  private depthTxt = this.el('depthTxt');
  private coinTxt = this.el('coinTxt');
  private rushFill = this.el('rushFill');
  private boostBtn = this.el('boostBtn');
  private sharkTag = this.el('sharkTag');
  private bossBar = this.el('bossBar');
  private bossFill = this.el('bossFill');
  private bossLabel = this.el('bossLabel');

  private toastTimer = 0;
  private tutorialTimer = 0;
  private menuScroll = 0;

  constructor() {
    this.el('hud').classList.add('hidden');
  }

  showTutorial(): void {
    this.tutorial.classList.remove('hidden');
    this.tutorialTimer = 5.5;
  }

  tick(dt: number): void {
    if (this.tutorialTimer > 0) {
      this.tutorialTimer -= dt;
      if (this.tutorialTimer <= 0) this.tutorial.classList.add('hidden');
    }
    if (this.toastTimer > 0) this.toastTimer -= dt;
  }

  toast(text: string, ms = 1800): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this.toastEl.classList.remove('pop');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('pop');
    this.toastTimer = ms / 1000;
  }

  hideToast(): void {
    this.toastEl.classList.add('hidden');
    this.toastTimer = 0;
  }

  hideTutorial(): void {
    this.tutorial.classList.add('hidden');
    this.tutorialTimer = 0;
  }

  goldRush(on: boolean): void {
    this.gold.classList.toggle('on', on);
  }

  setBoost(on: boolean): void {
    this.boostLines.classList.toggle('on', on);
  }

  flashDamage(): void {
    this.damage.classList.remove('hit');
    void this.damage.offsetWidth;
    this.damage.classList.add('hit');
  }

  showMenu(save: SaveData, h: MenuHandlers): void {
    this.menu.classList.remove('hidden');
    this.dead.classList.add('hidden');
    this.pause.classList.add('hidden');
    this.missionsEl.classList.add('hidden');
    this.hud.classList.add('hidden');
    this.gold.classList.remove('on');
    this.renderMenu(save, h);
  }

  hideMenu(): void {
    this.menu.classList.add('hidden');
    this.missionsEl.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  private renderMenu(save: SaveData, h: MenuHandlers): void {
    this.menuScroll = this.rail.scrollLeft;
    const coins = this.el('menuCoins');
    coins.textContent = fmt(save.coins);
    this.el('menuGems').textContent = fmt(save.gems);
    this.el('menuBest').textContent = fmt(save.best);
    this.el('menuSound').textContent = save.sound ? '音效 开' : '音效 关';
    this.el('menuMissionsBtn').dataset.shark = save.current;

    const list = SHARKS.map(def => {
      const unlocked = save.unlocked.includes(def.id);
      const level = save.levels[def.id] ?? 1;
      const up = save.upgrades[def.id];
      const selected = save.current === def.id;
      const check = unlocked ? { ok: false, reason: '' } : canPurchase(save, def.id);
      const xpNeed = xpToNext(save, def.id);
      const xpNow = save.xp[def.id] ?? 0;
      const xpPrev = level >= MAX_LEVEL ? 0 : [0, 120, 320, 640, 1100, 1750, 2650, 3850, 5400, 7400][level - 1];
      const xpPct = level >= MAX_LEVEL ? 100 : Math.min(100, (xpNow / Math.max(1, xpPrev + xpNeed)) * 100);

      const stats = (['bite', 'speed', 'boost'] as const).map(k => {
        const label = k === 'bite' ? '咬合' : k === 'speed' ? '速度' : '冲刺';
        const lv = up[k];
        return `<div class="statline"><span>${label}</span><div class="statbar"><i style="width:${(lv / 10) * 100}%"></i></div><em>${lv}/10</em></div>`;
      }).join('');

      const upgrades = (['bite', 'speed', 'boost'] as const).map(k => {
        const lv = up[k];
        const cost = upgradeCost(k, lv);
        const label = k === 'bite' ? '咬合' : k === 'speed' ? '速度' : '冲刺';
        if (!unlocked || lv >= 10) {
          return `<button class="up" disabled>${label} ${lv >= 10 ? 'MAX' : '—'}</button>`;
        }
        return `<button class="up" data-up="${k}" data-shark="${def.id}" ${save.coins < cost ? 'disabled' : ''}>${label}+ ${cost}</button>`;
      }).join('');

      let action = '';
      if (unlocked) {
        action = selected
          ? `<button class="act primary" disabled>当前使用</button>`
          : `<button class="act" data-select="${def.id}">选择</button>`;
      } else if (check.ok) {
        action = `<button class="act buy" data-buy="${def.id}">解锁 · ${fmt(def.cost)}</button>`;
      } else {
        action = `<button class="act locked" disabled>${check.reason || '未解锁'}</button>`;
      }

      return `
        <article class="card ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-shark="${def.id}">
          <div class="card-head">
            <div>
              <h3>${def.name}</h3>
              <div class="levelrow"><span class="lv">Lv.${level}</span>${unlocked ? `<span class="xp"><i style="width:${xpPct}%"></i></span>` : `<span class="cost">${fmt(def.cost)} 金币</span>`}</div>
            </div>
            <div class="len">${def.length.toFixed(1)}m</div>
          </div>
          <p class="blurb">${def.blurb}</p>
          <div class="stats">${stats}</div>
          <div class="actions">${action}</div>
          <div class="upgrades">${upgrades}</div>
        </article>`;
    }).join('');

    this.rail.innerHTML = list;
    this.rail.scrollLeft = this.menuScroll;

    this.rail.querySelectorAll<HTMLButtonElement>('[data-select]').forEach(b => {
      b.addEventListener('click', () => h.onSelect(b.dataset.select as SharkId));
    });
    this.rail.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(b => {
      b.addEventListener('click', () => h.onBuy(b.dataset.buy as SharkId));
    });
    this.rail.querySelectorAll<HTMLButtonElement>('[data-up]').forEach(b => {
      b.addEventListener('click', () => h.onUpgrade(b.dataset.shark as SharkId, b.dataset.up as keyof UpgradeSet));
    });

    const play = this.el('playBtn') as HTMLButtonElement;
    play.onclick = h.onStart;
    (this.el('menuSound') as HTMLButtonElement).onclick = h.onSound;
    (this.el('menuMissionsBtn') as HTMLButtonElement).onclick = () => h.onMissions(save.current);
  }

  showHud(): void {
    this.hud.classList.remove('hidden');
  }

  hideHud(): void {
    this.hud.classList.add('hidden');
  }

  updateHud(p: {
    score: number; mult: number; hp: number; maxHp: number; depth: number;
    coins: number; rush: number; boost: number; sharkName: string; level: number;
  }): void {
    this.score.textContent = fmt(p.score);
    this.mult.textContent = `x${p.mult.toFixed(2)}`;
    const hpPct = Math.max(0, Math.min(1, p.hp / p.maxHp));
    this.hpFill.style.width = `${hpPct * 100}%`;
    this.hpFill.style.background = hpPct > 0.55 ? 'linear-gradient(90deg,#6be05a,#b7f36a)'
      : hpPct > 0.25 ? 'linear-gradient(90deg,#ffc63d,#ff8a3c)' : 'linear-gradient(90deg,#e8433c,#ff6b5a)';
    this.hpTxt.textContent = `${Math.ceil(p.hp)}`;
    this.depthTxt.textContent = `${Math.round(p.depth)} m`;
    this.coinTxt.textContent = fmt(p.coins);
    this.rushFill.style.width = `${Math.min(100, p.rush)}%`;
    this.boostBtn.style.background =
      `conic-gradient(from -90deg, #ffc63d ${p.boost * 3.6}deg, rgba(8,34,44,.72) 0)`;
    this.sharkTag.textContent = `${p.sharkName} · Lv.${p.level}`;
  }

  setBoss(active: boolean, phase = 3): void {
    this.bossBar.classList.toggle('hidden', !active);
    if (active) {
      this.bossFill.style.width = `${(phase / 3) * 100}%`;
      this.bossLabel.textContent = `GIANT CRAB · ${phase}/3`;
    }
  }

  showDead(info: DeadInfo, onRevive: () => void, onMenu: () => void): void {
    this.dead.classList.remove('hidden');
    this.el('deadScore').textContent = fmt(info.score);
    this.el('deadBest').textContent = fmt(info.best);
    this.el('deadCoins').textContent = fmt(info.coins);
    this.el('deadMissions').textContent = `${info.missions}`;
    const rev = this.el('reviveBtn') as HTMLButtonElement;
    rev.textContent = info.canFree ? '免费复活' : `复活 · ${info.reviveCost} 金币`;
    rev.disabled = !info.canFree && info.wallet < info.reviveCost;
    rev.onclick = onRevive;
    (this.el('deadMenuBtn') as HTMLButtonElement).onclick = onMenu;
  }

  hideDead(): void {
    this.dead.classList.add('hidden');
  }

  showPause(onResume: () => void, onQuit: () => void, onSound: () => void, soundOn: boolean): void {
    this.pause.classList.remove('hidden');
    (this.el('resumeBtn') as HTMLButtonElement).onclick = onResume;
    (this.el('quitBtn') as HTMLButtonElement).onclick = onQuit;
    const s = this.el('pauseSound') as HTMLButtonElement;
    s.textContent = soundOn ? '音效 开' : '音效 关';
    s.onclick = onSound;
  }

  hidePause(): void {
    this.pause.classList.add('hidden');
  }

  isPauseOpen(): boolean {
    return !this.pause.classList.contains('hidden');
  }

  showMissions(shark: SharkId, run: Record<string, number> | null, onClose?: () => void): void {
    const save = (window as unknown as { __save?: SaveData }).__save;
    this.missionsEl.classList.remove('hidden');
    const list = MISSIONS[shark];
    const finishedAll = save ? superUnlocked(save, shark) : false;
    const rows = list.map((m: MissionDef) => {
      const done = save ? isMissionDone(save, shark, m) : false;
      const prog = Math.max(save ? missionProgress(save, shark, m) : 0, run?.[m.stat] ?? 0);
      const pct = Math.min(100, (prog / m.target) * 100);
      const locked = m.super && !finishedAll && !done;
      return `<div class="mission ${done ? 'done' : ''} ${locked ? 'locked' : ''}">
        <div class="mtop"><span>${done ? '✔' : '◇'} ${m.text}</span><em>+${fmt(m.reward)}</em></div>
        <div class="mbar"><i style="width:${done ? 100 : pct}%"></i></div>
        <div class="mnum">${done ? '已完成' : `${fmt(Math.min(prog, m.target))} / ${fmt(m.target)}`}${locked ? ' · 完成上面 4 条解锁' : ''}</div>
      </div>`;
    }).join('');
    this.missionsEl.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>任务 · ${shark.toUpperCase()}</h2><button id="closeMissions" class="x">×</button></div>
        <div class="mission-list">${rows}</div>
      </div>`;
    (document.getElementById('closeMissions') as HTMLButtonElement).onclick = () => {
      this.missionsEl.classList.add('hidden');
      onClose?.();
    };
  }

  hideMissions(): void {
    this.missionsEl.classList.add('hidden');
  }

  setSound(on: boolean): void {
    (this.el('menuSound') as HTMLButtonElement).textContent = on ? '音效 开' : '音效 关';
  }
}
