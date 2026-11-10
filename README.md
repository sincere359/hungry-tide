# Hungry Tide · 经典海洋生存（移动端 Web 复刻）

以《Hungry Shark Evolution》2012–2013 经典版为**行为与视觉基准**的原创 Web 复刻。
未使用原版任何模型、贴图、音频、字体或 UI 切图；全部几何、材质、UI 与音频均由代码生成。

- 形态：横屏移动端 Web 游戏，2.5D 侧视 + Three.js 透视相机
- 玩法：单地图生存、6 条鲨鱼成长、金潮、任务、Giant Crab Boss、死亡/复活
- 技术：Vite + TypeScript + Three.js（WebGL2），无框架、无状态库、无物理引擎
- 体积：`dist` 约 **678 KB 原始 / 176 KB gzip**（JS 658.2 KB / 170.4 KB gzip）
- 在线游玩：**https://sincere359.github.io/hungry-tide/**（GitHub Pages，HTTPS，免登录，长期有效）

---

## 本地启动

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
# 手机与电脑同一局域网，浏览器打开 http://<电脑IP>:5173
```

生产构建与预览：

```bash
npm run build     # tsc --noEmit && vite build
npm run preview -- --host 0.0.0.0 --port 4173
```

### 公网访问（长期链接，GitHub Pages）

**https://sincere359.github.io/hungry-tide/**

- 免费、HTTPS、**不依赖本机进程**，长期有效；源码与构建流程也在同一仓库：https://github.com/sincere359/hungry-tide
- 推送 `main` 后由 GitHub Actions 自动构建（`npm run build -- --base=/hungry-tide/`）并发布到 `gh-pages`，配置见 `.github/workflows/deploy-pages.yml`。
- 2026-11-10 复测：首页 200 / 5.0 KB，`assets/index-6AM9CEm9.js` 200 / 658 KB；移动视口完整闭环通过（见验收表）。
- 国内访问 GitHub Pages 速度一般（首屏约 1–3 s），可作为日常分享链接。

**备用（临时隧道）**：**https://selections-integrating-mar-gloves.trycloudflare.com**
Cloudflare Quick Tunnel → 本机 `vite preview`（4173），仅在本机两个进程存活期间有效，重建方法见下方"链接失效时"。

### EdgeOne Pages 部署（已完成，但默认域名不可直接分享）

已通过 EdgeOne CLI 部署到当前登录账号（同一份 `dist`）：

- `hungry-tide`（全球/含大陆）：Project `makers-445n7nputydw`，默认域名 `hungry-tide-9jk57mjy.edgeone.cool`
- `hungry-tide-overseas`（海外）：Project `makers-ur4tvdyvhafe`，默认域名 `hungry-tide-overseas-qfntgxhw.edgeone.dev`
- 控制台：https://console.cloud.tencent.com/edgeone/makers/project/makers-445n7nputydw/domain
- 部署命令：`npx -y edgeone@1.7.2 pages deploy ./dist -n <project> [-a overseas]`

**限制（实测 2026-11-10）**：两个默认域名在国内节点访问均返回 **401 UNAUTHORIZED**（强制 `eo_token`，且 token 有时效）；偶尔命中海外节点会 200，但不可依赖。要长期公开必须绑定自定义域名，账号当前无域名，步骤见 [docs/domain-setup.md](docs/domain-setup.md)。

### 链接失效时

```powershell
npm run build
npm run preview -- --port 4173 --strictPort
tools\cloudflared.exe tunnel --url http://localhost:4173 --no-autoupdate
```

### 真机验收清单（请在手机上执行）

1. 横屏打开链接，确认无安装、无登录；竖屏应出现"请横屏"遮罩。
2. 首次触摸后应听到 BGM；若无声音，再点一次屏幕。
3. 按住屏幕任意位置拖动，鲨鱼应跟手；右下冲刺应即时生效。
4. 吃鱼 → 分数/金币增长 → 升级提示 → 任务完成提示。
5. 主动送死 → 结算 → 免费复活 → 继续；返回港口后可购买/升级鲨鱼。
6. 切后台 5 秒再回前台：音乐应恢复、游戏不应跳帧或黑屏。
7. 连续游玩 10 分钟，观察是否发热降频、掉帧、破音或内存崩溃。

调试参数与钩子：

- `?debug`：左下角显示 FPS / 鱼群数 / 实体数 / Draw calls
- `window.__game`：只读状态与测试方法（`tp` / `spawnFish` / `kill` / `bossPhase` 等）

---

## 操作

| 输入 | 行为 |
|---|---|
| 按住屏幕任意位置拖动 | 动态虚拟摇杆（原点=触点），控制游向 |
| 右下「冲刺」或第二指按住屏幕 | 冲刺，消耗 Boost 槽 |
| 右上「任务」 | 查看当前鲨鱼 4+1 条任务（会暂停） |
| 右上「❚❚」 | 暂停 / 音效开关 / 结束本局 |
| 菜单「全屏」 | 隐藏浏览器地址栏/工具栏并尝试锁定横屏（Android Chrome 支持；失败时提示添加到主屏幕） |

竖屏时显示横屏提示并自动暂停；首次触摸解锁 Web Audio。

---

## 已实现

- 动态摇杆、加速、惯性、转向阻尼、镜头前瞻与弹簧跟随、冲刺 FOV
- 饥饿掉血、进食回血、水母毒伤、水雷、潜艇导弹、敌对鲨、超深度压迫
- 自动撕咬（按体型/咬合力计算咬合时长）、4 区深度生态、实例化鱼群
- 分数连击倍率 2x–24x、金潮 20 秒（全金/无敌/回血/无限冲刺）
- 跨局等级 1–10、局内体型增长、Bite/Speed/Boost 升级、6 条鲨鱼金币解锁
- 每鲨 4 条普通任务 + 1 条超级任务，进度持久化
- Giant Crab：3 阶段、钳击预警、闪避 3 次暴露弱点、冲刺撞弱点
- 死亡结算、免费复活 1 次 / 300 金币复活、localStorage 存档
- 程序化 BGM（菜单/游戏/金潮/Boss）+ 20 余个程序化音效
- 手绘漫画风 HUD、金潮/受伤滤镜、任务面板、暂停、音效开关
- 移动端适配：横屏、`viewport-fit=cover`、安全区、Pointer Events、禁用缩放/滚动；`--app-h` 跟随 `visualViewport` 高度；菜单提供「全屏」隐藏浏览器工具栏

## 未实现 / 降级（如实列出）

| 项 | 状态 |
|---|---|
| 多地图（北极/南海等） | 未实现，仅单张 900m 主地图 |
| 倾斜控制 / 陀螺仪 | 未实现，仅触控摇杆 |
| 宝石经济 / 内购 / 广告 | 未实现；宝石仅 Boss 奖励展示 |
| 特殊鲨鱼、进化、Baby Shark、皮肤、配饰 | 未实现 |
| 每日宝箱 / 在线排行榜 / live-ops | 未实现 |
| 贝壳解锁任务的流程 | 降级：任务常驻可看，贝壳仅给金币 |
| 15 件沉没物 | 降级为 8 件 |
| Boss 数量 | 仅 Giant Crab；无多 Boss 体系 |
| 原版美术/音频 | 全部程序化替代，风格"神似"而非还原 |
| 视角 | 2.5D 侧视自由游动，非原版全 3D 相机 |
| iOS Safari / Android Chrome 真机 | **尚未验证**（仅 headless Chromium 自动化） |
| 公网 HTTPS 链接 | **待部署**（用户选择"先本地，部署后定"） |

---

## 验证记录（阶段三）

环境：Windows / Edge headless（Chromium 内核）/ SwiftShader 软件渲染 / 844×390 横屏 / DPR 2。
软件渲染下 41–59 FPS；真机 GPU 预期更高（未实测）。

| 项 | 结果 | 证据 |
|---|---|---|
| 菜单 → 开局 → 进食 → 升级 | 通过（分数 0→952，Lv.1→2） | `docs/shots/02-play.png`、`04-eat.png` |
| 任务完成与奖励 | 通过（吃 8 条鱼 +150、下潜 30m +160） | `04-eat.png` |
| 死亡 → 结算 → 复活 | 通过（结算金币 348，复活后 50% 血） | `07-dead.png`、`08-revive.png` |
| 金潮自然触发 | 通过（投喂后 rush 100%，20 秒模式） | `10-goldrush-natural.png` |
| Giant Crab 三阶段循环 | 通过（闪避 3 次→弱点→冲刺→共 3 次→击败 +800 金币） | `11-boss.png`、`13-boss-vulnerable.png`、`14-boss-defeated.png` |
| 购买/升级 | 通过（10000→8500 买 Mako；咬合 0→1，-120） | `15-menu-mako.png`、`16-menu-upgrade.png` |
| 暂停 / 横竖屏 | 通过（暂停面板；竖屏自动暂停并显示遮罩，回横屏需手动继续） | `05-pause.png`、`23-public-portrait.png` |
| 音频 | 公网 HTTPS 下点击开局后 AudioContext `running`，BGM 连续无异常 | 控制台 `(none)` |
| 后台切换 | `hidden` → 自动暂停 + AudioContext `suspended`；回前台音频 `running`，可继续 | 自动化日志 |
| Android Chrome | **通过**（Pixel 3 AVD，786×268 CSS，DPR 2.75）：菜单加载 → 可信首触 Play 后音频 `running` → 吃鱼升级 Lv.4 / 完成 2 条任务 → 摇杆位移 → 冲刺速度线 → 死亡 → **免费复活**（hp 62，音频保持 running）；FPS 39–41；无异常 | `36–41-android-*.png`、`android-verify.txt` |
| Android 全屏 | **通过**：786×268 → **786×372 CSS**，`fullscreenElement=true`，`--app-h=351px`；全屏内音频 `running`、开局 `playing`、33–37 FPS；横屏锁定无异常 | `42–44-android-*.png`、`45–47-android-latest-*.png` |
| 紧凑横屏布局 | 通过（批量测试 268 / 300 / 320 / 346 / 390px；≤460px 启用紧凑菜单/HUD；`--app-h` 跟随 `visualViewport` 适配 iOS 工具栏） | `layout-268.png`、`layout-346.png`、`layout-390.png` |
| iOS Safari | **按用户要求不纳入本次验收（仅 Android）** | — |
| EdgeOne Pages | 部署成功、构建产物一致；但两个默认域名在国内节点均 401（强制 `eo_token`），需自定义域名才能长期分享 | 见"EdgeOne Pages 部署" |
| 公网链接复测 | 通过（GitHub Pages 首页 200 / 5.0 KB，`index-6AM9CEm9.js` 200 / 658 KB；隧道同样 200） | `tools/check-domain.ps1` 可复跑 |
| 内存 | 10 分钟持续投喂：JS Heap 7.2–13.5 MB 波动，结束 12.2 MB，无持续增长、无异常；详见 `docs/shots/soak.txt` | `22-soak-end.png` + `soak.txt` |
| 公网 HTTPS | 通过（GitHub Pages 长期链接 + Cloudflare 临时隧道；Chromium 与 Android Chrome 均可开局） | `20-public-menu.png`、`21-public-play.png`、`36-android-menu.png` |
| 公网链接完整闭环 | **通过**（对 `https://sincere359.github.io/hungry-tide/` 复跑，Android UA + 844×390 横屏）：`https:` / `isSecureContext=true` → 菜单 → 开局 `playing`、音频 `running` → 刷鱼进食 160→523 分、升到 Lv.2 → 死亡面板出现 → 免费复活 `playing`、hp 56、音频仍 `running` → 控制台 0 异常 | `48-live-menu.png`、`49-live-eating.png`、`50-live-dead.png`、`51-live-revived.png`；复跑 `node tools/cdp-live-e2e.mjs` |

> 说明：以上为自动化冒烟验证，不等同于真机手感验收。软件渲染帧率不代表真机；真机请按上面的清单逐项确认。

---

## 目录

```
index.html
src/
  main.ts        启动、状态机、事件、任务/经济结算
  world.ts       场景、地形、刷怪、碰撞、粒子、Boss、相机
  player.ts      移动、冲刺、饥饿、受伤、成长
  mesh.ts        程序化鲨鱼/猎物/危险物/Boss 几何
  input.ts       动态摇杆 + 冲刺 + Pointer Events
  audio.ts       Web Audio 程序化 BGM 与音效
  ui.ts          HUD、菜单、任务、结算、暂停
  state.ts       存档、等级、升级、任务持久化
  data.ts        鲨鱼/猎物/分区/任务数值表
  bus.ts         事件总线
docs/
  research.md    阶段一调研（10 个来源交叉验证）
  gdd.md         阶段二设计定稿
  comparison.md  原版 vs 本项目视觉对照（含 comparison.png）
  feel.md        转向/加速/镜头三项手感对照与延迟预算
  shots/         自动化验收截图、soak 日志、Android 验证记录
  ref/           公开页面视觉基准图（仅内部对照）
tools/           CDP 自动化测试脚本（非运行时代码）
```

---

## 版权

个人非商业用途的行为层复刻。不包含原版资源；"Hungry Tide" 为原创标题，不使用原版 Logo/字体/角色专名。
