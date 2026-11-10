# EdgeOne Pages 自定义域名绑定步骤

> 现状（2026-11-10 复核）：两个项目的默认域名在国内节点访问均返回 **401 UNAUTHORIZED**（`eo_token` 强制鉴权、且有时效）；偶尔命中海外节点会 200，但不能依赖。
> 因此当前公开分享用的是 Cloudflare 临时隧道，**要长期访问就必须绑定自定义域名**，即本文流程。
>
> 目标：把当前 EdgeOne 项目 `hungry-tide` 绑定到你的域名，得到**长期、无 eo_token、无测试水印**的 HTTPS 链接。
> 当前项目控制台：https://console.cloud.tencent.com/edgeone/makers/project/makers-445n7nputydw/domain

---

## 0. 先选择项目（按域名是否备案）

已在你的 EdgeOne 账号下准备好两个项目，内容相同：

| 项目 | 适用域名 | 控制台 | 当前默认域名解析目标 |
|---|---|---|---|
| `hungry-tide`（全球/含大陆） | **已备案**域名 | https://console.cloud.tencent.com/edgeone/makers/project/makers-445n7nputydw | `013c344bef7f6e5e.edgeone.cool.pages.dnsoe5.com` |
| `hungry-tide-overseas`（海外） | **未备案**域名 | https://console.cloud.tencent.com/edgeone/makers/project/makers-ur4tvdyvhafe | `2354db541df20c20.edgeone.dev.pages.dnsoe6.com` |

> 该账号当前**没有已注册域名**（域名注册控制台显示 0 个），绑定自定义域名前需先注册或转入一个域名。
> 控制台弹窗给出的 CNAME 目标优先；上表是当前项目实测解析值，供参考。

### 备案判断

- 域名已备案 → 用 `hungry-tide`，大陆访问更快。
- 域名未备案 → 用 `hungry-tide-overseas`，无需备案；大陆访问可能较慢。

---

## 1. 打开域名管理

1. 登录腾讯云控制台，打开上面的项目链接。
2. 左侧/顶部切到 **“域名管理”**。
3. 点击 **“添加自定义域名”**。

## 2. 输入域名

建议用子域名，例如：

```
shark.yourdomain.com
```

不要填 `https://`，不要带路径。

## 3. 按弹窗添加解析

弹窗会给出两种记录中的一种或两种：

### A. 归属权验证（TXT）

在域名服务商添加：

| 类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| TXT | 控制台显示的主机名 | 控制台显示的值 | 600 |

### B. 接入 CNAME

在域名服务商添加：

| 类型 | 主机记录 | 记录值 | TTL |
|---|---|---|---|
| CNAME | `shark`（你输入的前缀） | **控制台显示的 CNAME 目标**（原样复制） | 600 |

> 根域名（`yourdomain.com`）通常不能直接加 CNAME；请用 `www` 或 `shark` 这类子域名。

## 4. 等待生效

- 回控制台点“验证/刷新”，状态变为 **已生效 / 已激活**。
- DNS 生效通常 1–10 分钟，最长 24 小时。

## 5. 配置 HTTPS

域名添加后**不会自动带证书**。在域名管理里点该域名的 **HTTPS / 证书配置**：

1. 选择 **申请免费证书**。
2. 验证方式优先选 **DNS 验证**（按提示再加一条 TXT/CNAME）。
3. 等待签发（通常几分钟）。

## 6. 验收

在手机或电脑打开：

```
https://shark.yourdomain.com
```

应满足：
- 不再出现 `eo_token`；
- 不再出现 “For demonstration and testing purposes only”；
- 横屏菜单正常、可进入游戏。

把最终域名发我，我会用手机 UA + 无 token 方式复测，并更新 README 的主链接。你也可以先本地自检：

```powershell
pwsh -File tools/check-domain.ps1 -Domain shark.yourdomain.com
```

期望输出：`CNAME -> 013c.../2354...`、`HTTP: 200`、`结果: 通过`、`JS ... -> HTTP 200`。若出现 `HTTP: 401`，说明仍在使用 EdgeOne 默认预览域名或自定义域名尚未生效。

---

## 常见问题

| 现象 | 处理 |
|---|---|
| 控制台提示需要备案 | 换已备案域名，或改用海外区项目 |
| CNAME 一直未生效 | 检查是否与已有 A/AAAA 记录冲突；等待 TTL；用 `nslookup shark.yourdomain.com` 验证 |
| 打开 401 | 说明还在用 `edgeone.cool` 默认预览域名；必须用你绑定的自定义域名 |
| 打开 404 | 确认 CNAME 指向的是当前 Pages 项目的目标，而不是其他项目 |
| HTTPS 证书待签发 | 检查 DNS 验证记录是否添加；或改用 HTTP 文件验证 |

> 不要把腾讯云 SecretId/SecretKey 发给我；只需要域名和 CNAME 目标。
