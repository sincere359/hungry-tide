import { SHARKS, sharkById, type SharkId, type MissionDef, MISSIONS } from './data';

export const XP_STEPS = [0, 120, 320, 640, 1100, 1750, 2650, 3850, 5400, 7400];
export const MAX_LEVEL = 10;

export interface UpgradeSet { bite: number; speed: number; boost: number }

export interface SaveData {
  version: number;
  coins: number;
  gems: number;
  best: number;
  current: SharkId;
  unlocked: SharkId[];
  levels: Record<SharkId, number>;
  xp: Record<SharkId, number>;
  upgrades: Record<SharkId, UpgradeSet>;
  missionProgress: Record<string, number>;
  missionsDone: string[];
  sound: boolean;
}

const KEY = 'hungry-tide-save-v1';

const emptyLevels = (): Record<SharkId, number> => ({ reef: 1, mako: 1, hammer: 1, tiger: 1, greatwhite: 1, megalodon: 1 });
const emptyUpgrades = (): Record<SharkId, UpgradeSet> => ({
  reef: { bite: 0, speed: 0, boost: 0 }, mako: { bite: 0, speed: 0, boost: 0 },
  hammer: { bite: 0, speed: 0, boost: 0 }, tiger: { bite: 0, speed: 0, boost: 0 },
  greatwhite: { bite: 0, speed: 0, boost: 0 }, megalodon: { bite: 0, speed: 0, boost: 0 },
});

export function defaultSave(): SaveData {
  return {
    version: 1, coins: 0, gems: 0, best: 0, current: 'reef',
    unlocked: ['reef'], levels: emptyLevels(), xp: emptyLevels(),
    upgrades: emptyUpgrades(), missionProgress: {}, missionsDone: [], sound: true,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    const merged: SaveData = {
      ...base, ...data,
      levels: { ...base.levels, ...(data.levels ?? {}) },
      xp: { ...base.xp, ...(data.xp ?? {}) },
      upgrades: { ...base.upgrades, ...(data.upgrades ?? {}) },
      missionProgress: data.missionProgress ?? {},
      missionsDone: data.missionsDone ?? [],
      unlocked: data.unlocked?.length ? data.unlocked : ['reef'],
    };
    if (!merged.unlocked.includes(merged.current)) merged.current = 'reef';
    return merged;
  } catch {
    return defaultSave();
  }
}

export function saveGame(save: SaveData): void {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

export function missionKey(shark: SharkId, m: MissionDef): string {
  return `${shark}:${m.id}`;
}

export function isMissionDone(save: SaveData, shark: SharkId, m: MissionDef): boolean {
  return save.missionsDone.includes(missionKey(shark, m));
}

export function missionsOf(shark: SharkId): MissionDef[] {
  return MISSIONS[shark];
}

export function superUnlocked(save: SaveData, shark: SharkId): boolean {
  const list = MISSIONS[shark].filter(m => !m.super);
  return list.every(m => isMissionDone(save, shark, m));
}

export function missionProgress(save: SaveData, shark: SharkId, m: MissionDef): number {
  return save.missionProgress[missionKey(shark, m)] ?? 0;
}

export function completeMission(save: SaveData, shark: SharkId, m: MissionDef, progress: number): void {
  const key = missionKey(shark, m);
  save.missionProgress[key] = Math.max(save.missionProgress[key] ?? 0, progress);
  if (!save.missionsDone.includes(key) && progress >= m.target) {
    save.missionsDone.push(key);
  }
}

export function upgradeCost(stat: keyof UpgradeSet, level: number): number {
  const base = stat === 'bite' ? 120 : stat === 'speed' ? 150 : 180;
  return Math.round(base * Math.pow(1.35, level));
}

export function totalBite(defBite: number, lv: number): number {
  return defBite * (1 + 0.08 * lv);
}
export function totalSpeed(defSpeed: number, lv: number, sharkLevel: number): number {
  return defSpeed * (1 + 0.03 * lv + 0.012 * (sharkLevel - 1));
}
export function totalBoostTime(lv: number): number {
  return 1.0 * (1 + 0.06 * lv);
}
export function boostRegen(lv: number): number {
  return 17 * (1 + 0.04 * lv);
}

export function sharkLevelXp(save: SaveData, id: SharkId): number {
  return save.xp[id] ?? 0;
}

export function xpToNext(save: SaveData, id: SharkId): number {
  const lv = save.levels[id] ?? 1;
  if (lv >= MAX_LEVEL) return 0;
  return XP_STEPS[lv] - XP_STEPS[lv - 1];
}

/** 返回升级次数 */
export function addXp(save: SaveData, id: SharkId, amount: number): number {
  let gained = 0;
  save.xp[id] = (save.xp[id] ?? 0) + amount;
  while ((save.levels[id] ?? 1) < MAX_LEVEL) {
    const lv = save.levels[id];
    const next = XP_STEPS[lv];
    if ((save.xp[id] ?? 0) >= next) {
      save.levels[id] = lv + 1;
      gained++;
    } else break;
  }
  return gained;
}

export function canPurchase(save: SaveData, id: SharkId): { ok: boolean; reason: string } {
  if (save.unlocked.includes(id)) return { ok: false, reason: '已解锁' };
  const def = sharkById(id);
  const idx = SHARKS.findIndex(s => s.id === id);
  const prev = SHARKS[idx - 1];
  if (prev && (save.levels[prev.id] ?? 1) < MAX_LEVEL) {
    return { ok: false, reason: `${prev.name} 需 Lv.10` };
  }
  if (save.coins < def.cost) return { ok: false, reason: `需 ${def.cost} 金币` };
  return { ok: true, reason: '' };
}

export function purchase(save: SaveData, id: SharkId): boolean {
  const check = canPurchase(save, id);
  if (!check.ok) return false;
  save.coins -= sharkById(id).cost;
  save.unlocked.push(id);
  save.current = id;
  return true;
}

export function buyUpgrade(save: SaveData, id: SharkId, stat: keyof UpgradeSet): boolean {
  const set = save.upgrades[id];
  const lv = set[stat];
  if (lv >= 10) return false;
  const cost = upgradeCost(stat, lv);
  if (save.coins < cost) return false;
  save.coins -= cost;
  set[stat] = lv + 1;
  return true;
}
