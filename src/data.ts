export type SharkId = 'reef' | 'mako' | 'hammer' | 'tiger' | 'greatwhite' | 'megalodon';

export type StatKey =
  | 'eatFish' | 'eatTurtle' | 'eatPelican' | 'eatDiver' | 'eatFisher' | 'eatHuman'
  | 'eatShark' | 'eatGW' | 'eatGulper' | 'mine' | 'sub' | 'depth' | 'score'
  | 'combo' | 'boostDist' | 'survive' | 'objects' | 'noDamage' | 'crab' | 'eatInCombo';

export interface SharkDef {
  id: SharkId;
  name: string;
  cost: number;
  length: number;
  hp: number;
  speed: number;
  boostMul: number;
  bite: number;
  depth: number;
  diet: number;
  color: number;
  belly: number;
  fin: number;
  immunePoison?: boolean;
  blurb: string;
}

export const SHARKS: SharkDef[] = [
  { id: 'reef', name: 'Reef Shark', cost: 0, length: 3.2, hp: 100, speed: 9.0, boostMul: 1.55, bite: 1.0, depth: 90, diet: 1, color: 0x6f8f9a, belly: 0xd7e2e2, fin: 0x55727c, blurb: '浅滩猎手：灵活、食量小，怕深水。' },
  { id: 'mako', name: 'Mako Shark', cost: 1500, length: 4.0, hp: 115, speed: 11.0, boostMul: 1.6, bite: 1.15, depth: 110, diet: 2, color: 0x4f7f9e, belly: 0xcfe4ee, fin: 0x3c637d, blurb: '速度型：冲刺距离更长，适合追击飞鱼。' },
  { id: 'hammer', name: 'Hammerhead', cost: 6000, length: 5.2, hp: 135, speed: 11.5, boostMul: 1.6, bite: 1.35, depth: 130, diet: 3, color: 0x7a8d93, belly: 0xdfe6e4, fin: 0x5c6e73, blurb: '重咬合：能咬穿潜水员与小型鲨鱼。' },
  { id: 'tiger', name: 'Tiger Shark', cost: 15000, length: 6.4, hp: 160, speed: 12.0, boostMul: 1.65, bite: 1.55, depth: 150, diet: 4, color: 0x8a7a5f, belly: 0xe4dcc4, fin: 0x6a5c45, blurb: '抗压：多数攻击只造成轻微伤害。' },
  { id: 'greatwhite', name: 'Great White', cost: 35000, length: 7.6, hp: 190, speed: 13.0, boostMul: 1.7, bite: 1.8, depth: 170, diet: 5, color: 0x9aa7ad, belly: 0xf0f3f2, fin: 0x76858b, blurb: '顶级掠食者：可猎杀敌对大白鲨。' },
  { id: 'megalodon', name: 'Megalodon', cost: 50000, length: 11.0, hp: 260, speed: 14.5, boostMul: 1.8, bite: 2.2, depth: 220, diet: 6, color: 0x6b7f8f, belly: 0xd9e2e8, fin: 0x4f6270, immunePoison: true, blurb: '史前巨兽：免疫水母毒素，可下潜至深渊。' },
];

export const sharkById = (id: SharkId): SharkDef => SHARKS.find(s => s.id === id) ?? SHARKS[0];

export type Kind = 'fish' | 'turtle' | 'crab' | 'pelican' | 'fisher' | 'diver' | 'manta' | 'sailfish' | 'gulper' | 'angler' | 'shark' | 'gw' | 'gem';

export interface PreyDef {
  id: string;
  name: string;
  kind: Kind;
  cls: number;
  score: number;
  coinChance: number;
  biteTime: number;
  heal: number;
  speed: number;
  radius: number;
  color: number;
  accent: number;
  stat: StatKey;
  human?: boolean;
}

export const PREY: Record<string, PreyDef> = {
  sardine:   { id: 'sardine',   name: '沙丁鱼',   kind: 'fish',     cls: 1, score: 5,   coinChance: 0.03, biteTime: 0.08, heal: 2,  speed: 2.2, radius: 0.45, color: 0xbfe3ea, accent: 0x7fb7c4, stat: 'eatFish' },
  tropical:  { id: 'tropical',  name: '热带鱼',   kind: 'fish',     cls: 1, score: 10,  coinChance: 0.06, biteTime: 0.12, heal: 3,  speed: 2.8, radius: 0.6,  color: 0xffb648, accent: 0xe86a3c, stat: 'eatFish' },
  flyingfish:{ id: 'flyingfish',name: '飞鱼',     kind: 'fish',     cls: 2, score: 15,  coinChance: 0.08, biteTime: 0.15, heal: 3,  speed: 4.2, radius: 0.55, color: 0xa8d8e8, accent: 0x5f9fb8, stat: 'eatFish' },
  turtle:    { id: 'turtle',    name: '海龟',     kind: 'turtle',   cls: 2, score: 40,  coinChance: 0.12, biteTime: 0.5,  heal: 8,  speed: 1.2, radius: 1.1,  color: 0x6f9a5e, accent: 0x4a6d3f, stat: 'eatTurtle' },
  crab:      { id: 'crab',      name: '蟹',       kind: 'crab',     cls: 2, score: 30,  coinChance: 0.2,  biteTime: 0.4,  heal: 4,  speed: 1.0, radius: 0.7,  color: 0xd3653f, accent: 0x9c3f26, stat: 'eatFish' },
  pelican:   { id: 'pelican',   name: '鹈鹕',     kind: 'pelican',  cls: 2, score: 80,  coinChance: 0.3,  biteTime: 0.45, heal: 5,  speed: 3.0, radius: 0.8,  color: 0xf2efe4, accent: 0xe8a33c, stat: 'eatPelican' },
  fisherman: { id: 'fisherman', name: '渔民',     kind: 'fisher',   cls: 3, score: 120, coinChance: 0.5,  biteTime: 0.6,  heal: 6,  speed: 0.8, radius: 0.6,  color: 0xf0c9a0, accent: 0x2f6f8f, stat: 'eatFisher', human: true },
  diver:     { id: 'diver',     name: '潜水员',   kind: 'diver',    cls: 3, score: 300, coinChance: 0.8,  biteTime: 0.7,  heal: 7,  speed: 3.4, radius: 0.7,  color: 0x2b3a44, accent: 0xffc63d, stat: 'eatDiver', human: true },
  manta:     { id: 'manta',     name: '蝠鲼',     kind: 'manta',    cls: 3, score: 150, coinChance: 0.25, biteTime: 1.0,  heal: 9,  speed: 2.0, radius: 1.8,  color: 0x3f5d6b, accent: 0x8fb2bd, stat: 'eatFish' },
  sailfish:  { id: 'sailfish',  name: '旗鱼',     kind: 'sailfish', cls: 3, score: 180, coinChance: 0.25, biteTime: 0.8,  heal: 8,  speed: 5.4, radius: 0.8,  color: 0x8a6fae, accent: 0x5f4a85, stat: 'eatFish' },
  gulper:    { id: 'gulper',    name: 'Gulper',   kind: 'gulper',   cls: 4, score: 250, coinChance: 0.4,  biteTime: 0.9,  heal: 12, speed: 2.6, radius: 1.0,  color: 0x6b4a3f, accent: 0xd9614f, stat: 'eatGulper' },
  angler:    { id: 'angler',    name: '鮟鱇',     kind: 'angler',   cls: 4, score: 300, coinChance: 0.4,  biteTime: 1.0,  heal: 12, speed: 1.6, radius: 0.9,  color: 0x3c3a44, accent: 0x7ef2c8, stat: 'eatGulper' },
  shark:     { id: 'shark',     name: '敌对鲨鱼', kind: 'shark',    cls: 4, score: 350, coinChance: 0.6,  biteTime: 1.4,  heal: 10, speed: 4.6, radius: 1.1,  color: 0x5e737d, accent: 0x41525a, stat: 'eatShark' },
  gw:        { id: 'gw',        name: '敌对大白鲨', kind: 'gw',     cls: 5, score: 1200, coinChance: 1.0, biteTime: 3.0,  heal: 25, speed: 5.2, radius: 2.0,  color: 0x8b989d, accent: 0x5f6d72, stat: 'eatGW' },
  gem:       { id: 'gem',       name: '宝石鱼',   kind: 'gem',      cls: 3, score: 200, coinChance: 0,    biteTime: 0.6,  heal: 6,  speed: 6.0, radius: 0.5,  color: 0x9ff2ff, accent: 0x35d6ff, stat: 'eatFish' },
};

export interface ZoneDef {
  id: string;
  name: string;
  top: number;
  bottom: number;
  fog: number;
  density: number;
  amb: number;
  fish: number;
  mid: number;
  hazard: number;
  big: number;
  surface?: boolean;
  deep?: boolean;
}

export const ZONES: ZoneDef[] = [
  { id: 'surface', name: '水面', top: 6, bottom: -12, fog: 0x8fe9f2, density: 0.0055, amb: 0xdff7ff, fish: 34, mid: 4, hazard: 1, big: 0, surface: true },
  { id: 'reef', name: '珊瑚浅滩', top: -12, bottom: -45, fog: 0x2fa9c4, density: 0.011, amb: 0x9fe4e8, fish: 46, mid: 9, hazard: 4, big: 1 },
  { id: 'open', name: '开阔中层', top: -45, bottom: -90, fog: 0x0c5a78, density: 0.018, amb: 0x4d94a8, fish: 26, mid: 6, hazard: 7, big: 2 },
  { id: 'abyss', name: '深渊海床', top: -90, bottom: -150, fog: 0x041e2c, density: 0.028, amb: 0x1b4658, fish: 14, mid: 5, hazard: 6, big: 2, deep: true },
];

export const zoneAt = (y: number): ZoneDef => ZONES.find(z => y <= z.top && y > z.bottom) ?? ZONES[ZONES.length - 1];

export interface MissionDef {
  id: string;
  text: string;
  stat: StatKey;
  target: number;
  reward: number;
  super?: boolean;
}

export const MISSIONS: Record<SharkId, MissionDef[]> = {
  reef: [
    { id: 'r1', text: '吃掉 8 条鱼', stat: 'eatFish', target: 8, reward: 150 },
    { id: 'r2', text: '吃掉 2 只海龟', stat: 'eatTurtle', target: 2, reward: 180 },
    { id: 'r3', text: '下潜到 30 米', stat: 'depth', target: 30, reward: 160 },
    { id: 'r4', text: '跃出水面吃掉 1 只鹈鹕', stat: 'eatPelican', target: 1, reward: 220 },
    { id: 'r5', text: '单局得分 25,000', stat: 'score', target: 25000, reward: 1500, super: true },
  ],
  mako: [
    { id: 'm1', text: '吃掉 3 只鹈鹕', stat: 'eatPelican', target: 3, reward: 260 },
    { id: 'm2', text: '冲刺累计 500 米', stat: 'boostDist', target: 500, reward: 300 },
    { id: 'm3', text: '一次连吃 10 条鱼', stat: 'eatInCombo', target: 10, reward: 320 },
    { id: 'm4', text: '吃掉 2 名潜水员', stat: 'eatDiver', target: 2, reward: 380 },
    { id: 'm5', text: '单局得分 50,000', stat: 'score', target: 50000, reward: 1500, super: true },
  ],
  hammer: [
    { id: 'h1', text: '吃掉 3 名潜水员', stat: 'eatDiver', target: 3, reward: 420 },
    { id: 'h2', text: '撞爆 2 颗水雷', stat: 'mine', target: 2, reward: 400 },
    { id: 'h3', text: '单局得分 30,000', stat: 'score', target: 30000, reward: 450 },
    { id: 'h4', text: '吃掉 1 条敌对鲨鱼', stat: 'eatShark', target: 1, reward: 520 },
    { id: 'h5', text: '单局得分 100,000', stat: 'score', target: 100000, reward: 1500, super: true },
  ],
  tiger: [
    { id: 't1', text: '吃掉 5 名渔民', stat: 'eatFisher', target: 5, reward: 520 },
    { id: 't2', text: '击毁 1 艘潜艇', stat: 'sub', target: 1, reward: 560 },
    { id: 't3', text: '存活 3 分钟', stat: 'survive', target: 180, reward: 600 },
    { id: 't4', text: '吃掉 2 条敌对鲨鱼', stat: 'eatShark', target: 2, reward: 680 },
    { id: 't5', text: '单局得分 200,000', stat: 'score', target: 200000, reward: 1500, super: true },
  ],
  greatwhite: [
    { id: 'g1', text: '吃掉 10 名人类', stat: 'eatHuman', target: 10, reward: 700 },
    { id: 'g2', text: '击毁 2 艘潜艇', stat: 'sub', target: 2, reward: 720 },
    { id: 'g3', text: '击杀 1 条敌对大白鲨', stat: 'eatGW', target: 1, reward: 900 },
    { id: 'g4', text: '集齐 8 件沉没物', stat: 'objects', target: 8, reward: 800 },
    { id: 'g5', text: '单局得分 1,000,000', stat: 'score', target: 1000000, reward: 1500, super: true },
  ],
  megalodon: [
    { id: 'x1', text: '吃掉 3 只 Gulper', stat: 'eatGulper', target: 3, reward: 900 },
    { id: 'x2', text: '击败 Giant Crab', stat: 'crab', target: 1, reward: 1200 },
    { id: 'x3', text: '单局得分 200,000', stat: 'score', target: 200000, reward: 1000 },
    { id: 'x4', text: '2 分钟不受伤', stat: 'noDamage', target: 120, reward: 1100 },
    { id: 'x5', text: '单局得分 5,000,000', stat: 'score', target: 5000000, reward: 1500, super: true },
  ],
};

export const COLLECTIBLE_SPOTS = [
  { x: -300, y: -128 }, { x: -180, y: -42 }, { x: -60, y: -96 },
  { x: 40, y: -24 }, { x: 130, y: -136 }, { x: 210, y: -62 },
  { x: 300, y: -110 }, { x: 380, y: -34 },
];

export const SHELL_SPOTS = [
  { x: -360, y: -20 }, { x: -240, y: -70 }, { x: -120, y: -30 },
  { x: 20, y: -60 }, { x: 160, y: -100 }, { x: 280, y: -30 }, { x: 400, y: -80 },
];

export const BOAT_SPOTS = [
  { x: -250, y: -4 }, { x: -40, y: -4 }, { x: 170, y: -4 }, { x: 340, y: -4 },
];
