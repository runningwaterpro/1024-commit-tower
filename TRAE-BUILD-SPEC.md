# 1024 Commit 塔 · TRAE 建造规格书

> 这份文档是给 TRAE 用的施工图。每个 Phase 末尾有一段**可直接粘贴进 TRAE 的 prompt**。
> 目标：今晚（10/20）完成 Phase 0–3，明天（10/21）完成 Phase 4–6 并部署发帖。

---

## 0. 一句话

一个纯静态网页：输入 GitHub 用户名或 `owner/repo` → 把**真实提交史**盖成一座塔。每层是一次提交，层高 = 真实改动行数，层色 = 提交类型，亮色层 = 你自己写的，暗色层 = fork 进来的上游代码。塔侧立一根 1024 格限高标尺，旁边一根暗色影子柱代表你继承的上游提交体量。

## 1. 核心叙事（所有设计决策都服务于它）

**「我的 GitHub 有 33,683 次提交，其实只有 287 次是我写的。」**

真实数据（已核）：

| 指标 | 值 |
|---|---|
| 公开仓库 | 47 个（只有 5 个含自己的提交） |
| 账号提交总数（含 fork 上游） | 33,683 |
| **自己写的提交** | **287（0.85%）** |
| 自己的提交分布 | Voice_VibeCoding 205 / opencode-traffic-light 28 / WinUHid 27 / milkup 26 / markdown 1 |
| 类型分布（287 层） | fix 130 / feat 52 / docs 25 / chore 20 / ci 19 / other 19 / refactor 10 / style 4 / perf 3 |
| 时间跨度 | 2013-12-17 → 2026-09-28，但 **286 层挤在 2026 年 4–9 月** |
| 提交时段 | 7:00–21:00，**凌晨 0–6 点一次都没有** |
| 周末提交 | 81 次（28%） |
| 改动总行数 | 67,202 |
| 最猛一天 | 2026-09-12，33 次 |
| BOSS 层 | 2026-09-24 Voice_VibeCoding +2868/-4146（98 个文件） |
| 创世层 | 2013-12-17 markdown `Initial commit` |

**因此：**
- 主塔 = **你自己写的 287 次提交**（不是混入上游的 1024 层）
- 「1024」用**限高标尺**落地：塔侧一根 0→1024 格的标尺，你的塔停在第 287 格，上面用虚线画未建成的轮廓
- 旁边一根**暗色影子柱**表示 33,683 次上游提交（按 log 比例压缩，明确标注「比例已压缩」）
- 结算页那句话：「你 GitHub 上的代码，99.1% 是借来的。」

**绝不做的事**：把上游提交混进主塔当你的。诚实是这个作品全部价值的来源。

---

## 2. 技术栈（不要改）

| 项 | 选型 | 理由 |
|---|---|---|
| 构建 | Vite + TypeScript + React | 脚手架已就位（`package.json` / `vite.config.ts` / `tsconfig.json` / `index.html` 已存在） |
| 渲染 | 原生 Canvas 2D | 1024 层 DOM 会卡；不引图表库 |
| 样式 | 原生 CSS + CSS variables | 蓝图风格要精确控制 |
| 状态 | 一个 `useTowerData` hook + 纯函数 | 不需要状态库 |
| 依赖 | **只允许 `html-to-image`**（可选，导 PNG 用） | 依赖越少，TRAE 出错率越低 |

> `src/types.ts` 已定义好完整的数据契约（`TowerData` / `TowerStats` / `Layer`），直接用，不要重新定义。
> `src/App.tsx` 是一版**朴素基线**（每层一个 div，无视觉打磨），它就是「改造前」的基准，TRAE 的任务是从它升级到蓝图 canvas 版。

**硬性约束**
- **零后端**。GitHub API 的 CORS 是 `Access-Control-Allow-Origin: *`，浏览器直连即可（已验证）。
- **Demo 链接必须免登录、免 Key、点开即用**。默认展示预生成数据 `public/data/runningwaterpro.json`。
- 首屏不允许要求用户做任何操作。

---

## 3. 数据契约

### 3.1 账号塔 `public/data/<login>.json`

```ts
interface AccountTower {
  meta: {
    kind: "account";
    login: string; name: string; avatar: string; profile: string;
    accountCreated: string;          // "2010-09-07"
    publicRepos: number;
    repoCount: number;
    totalCommitsAllRepos: number;    // 33683  含 fork 上游
    ownCommitsTotal: number;          // 287
    ownRatio: number;                 // 0.0085
    generatedAt: string;
    layerCount: number;               // 287
    spanStart: string; spanEnd: string;
    limitMark: 1024;
  };
  stats: {
    typeCount: Record<string, number>;
    repoCount: Record<string, number>;
    byDate: Record<string, number>;
    byHour: Record<number, number>;
    nightCount: number; weekendCount: number;
    ownCount: number; totalLinesChanged: number;
    busiestDate: string; busiestDateCount: number;
    biggestCommits: Array<{ sha; repo; message; additions; deletions; date }>;
    topRepos: Array<[string, number]>;
  };
  layers: Layer[];                   // 按时间正序：layers[0] = 塔底 = 最早
  repoBook: Array<{ name: string; total: number; own: number; fork: boolean }>;
}
```

### 3.2 仓库塔 `public/data/repo__<owner>__<repo>.json`

结构同上，`meta.kind === "repo"`，额外有 `meta.repo / meta.full / meta.description / meta.htmlUrl / meta.fork / meta.parent / meta.totalCommits`。`layers` 含该仓库**全部**提交（含上游），每层的 `own` 字段区分归属。

### 3.3 Layer

```ts
interface Layer {
  seq: number;              // 1 = 塔底
  sha: string;
  repo: string;             // "runningwaterpro/opencode-traffic-light"
  repoShort: string;
  fork: boolean;
  message: string;          // 首行
  body: string;             // 全文前 600 字符
  author: string; authorEmail: string;
  date: string;             // ISO UTC
  localDate: string;        // "YYYY-MM-DD"  UTC+8
  localHour: number;        // 0-23  UTC+8
  night: boolean;           // 1:00-4:59
  weekend: boolean;
  own: boolean;             // 作者是账号本人
  type: "feat"|"fix"|"refactor"|"perf"|"docs"|"test"|"ci"|"chore"|"style"|"build"|"release"|"revert"|"merge"|"other";
  color: string;            // 十六进制
  prefix: string;
  additions: number; deletions: number; files: number;
  big: boolean;             // 改动量 top5 → BOSS 层
  creature: boolean;        // 塔底第一层 → 创世层
}
```

**要点**
- `layers` 已按时间正序（数组第 0 项 = 塔底 = 最早）。
- 层高由 `additions + deletions` 决定，是**真实 stats**，不是拍脑袋的固定值。
- `localDate/localHour` 已按 UTC+8 算好，直接用。

---

## 4. 视觉规格：工程蓝图

全场参赛作品大量用霓虹 / 像素 / 木鱼 / 复古终端。**蓝图是唯一贴「工程」的视觉语言**，务必执行到位。

### 4.1 Design token

```css
:root {
  --bg-deep:     #08192B;
  --bg-panel:    #0C2338;
  --grid-faint:  rgba(127,196,255,0.07);
  --grid-line:   rgba(127,196,255,0.16);
  --ink:         #CFE6FF;
  --ink-dim:     #7FA8CC;
  --line:        #7FC4FF;
  --accent:      #FFC24B;   /* 里程碑 / 创世层 */
  --accent-hot:  #FF6B5B;   /* 深夜层 */
  --own:         #7FC4FF;   /* 自己写的层：亮 */
  --ghost:       #3A5570;   /* 上游层：暗 */
  --font-mono: "JetBrains Mono","Cascadia Mono",ui-monospace,monospace;
  --font-cn: "Microsoft YaHei","PingFang SC",system-ui,sans-serif;
}
```

### 4.2 图纸三要素

1. **背景网格**：8pt 网格，0.5px `--grid-faint`；每 5 格加粗一档 `--grid-line`。
2. **图纸标题栏**（右下角固定或顶部通栏）：字段 = 项目名 / 作者 / 层数 / 时间跨度 / 数据生成时间 / 限高标记 / 比例尺。字段间用竖线分隔，标签小字灰、值亮蓝，`--font-mono`。
3. **尺寸标注**：塔左侧竖直标尺，标「第 1 层」「第 287 层」「第 1024 层（限高）」。

### 4.3 塔身绘制规则

- 每层一个矩形，居中对齐。
- 层高：`h = 2.4 + Math.log10(1 + additions + deletions) * 3.2`（px），整体缩放到目标画布高度。
- 层宽：`w = 46% + 54% * (diff / maxDiff)`，diff = additions + deletions → 中间宽两端窄，自然钟形剖面。
- **层色分两档**：
  - `own === true` → 实心填充 `layer.color`，全不透明，1px 亮边
  - `own === false` → 填充 `layer.color` 但透明度 0.22，边框改**虚线** `--ghost`
- 相邻同色层留 1px 间隙，形成砌块感。
- **BOSS 层**（`big`）：层高 ×2.5，右侧拉引线标注「BOSS · +add / -del · 仓库名」。
- **创世层**（`creature`）：塔底一层 `--accent` 描边 + 底部地基线，标「创世层 · 第一次提交」。
- **深夜层**（`night`）：层左侧叠一条 `--accent-hot` 发光竖条。
  ⚠️ runningwaterpro 的 287 层里**没有一层是深夜的**（他最早 7:00 提交）——这条规则对别人可能触发，对他不会。别在文案里写死「深夜层」。
- **周末层**（`weekend`）：边框改虚线（若与 own 的虚线冲突，用点线）。
- **序号**：`seq` 用 `--font-mono` 10px 画在层右侧 `--ink-dim`，每 10 层标一次。

### 4.4 限高标尺（**这张图的灵魂，不能砍**）

塔右侧一根独立竖直标尺：

```
第 1024 层  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  ← 限高线，虚线 + 标签「1024 限高」
            ┆
            ┆   ← 未建成区域：极淡的塔身轮廓（虚线框，透明度 0.08）
            ┆
第 287 层   ├══════════════════  ← 你的塔顶，亮线 + 标签「你的塔顶 287」
            │  ← 你的塔身
第 1 层     ├══════════════════  ← 创世层
            ┴
```

- 标尺总高恒为 1024 格，与实际层数无关。
- 你的塔顶线用 `--accent` 实线。
- 1024 限高线用虚线 + `--ink-dim` 标签「1024 限高」。
- 塔顶与限高之间画**淡虚线轮廓**（提示"还能盖 737 层"）。
- 标尺底部标「0」。

### 4.5 影子柱

塔左侧一根暗色半透明矩形：

- 宽度固定为塔宽的 1/4，顶部超出塔顶
- 高度 = `log10(totalCommitsAllRepos) / log10(1024) * 塔高`（log 压缩），**必须在旁边标注「比例已压缩」**
- 柱身竖排文字：`33,683 次提交 · fork 上游`
- 柱底对齐塔底
- 柱顶画一条水平虚线，标注 `33,683`

### 4.6 年历标尺（**第二根标尺，讲的是时间**）

塔身左侧（影子柱与塔之间）再立一根细标尺，标出每层对应的年月：

- 每层的年份首次出现处打一个刻度，写上 `2013` / `2026`
- 跨度大的年份之间用**虚线**连接，并在线上标注跨度，例如 `12 年 · 0 层`
- 2026 年内按月打小刻度（`2026-06`、`2026-07`…），密集区用实线

**这条标尺要表达的**（runningwaterpro 的真实数据）：
> 塔底孤零零站着 2013 年 12 月的第一层；往上是虚线，标「**12 年 · 0 层**」；
> 然后 2026 年 4 月开始，286 层在半年里密密麻麻堆起来。

实现要点：
- 年份边界由 `layers` 的 `localDate` 推出，不用写死
- 虚线段 = 相邻两层年份差 > 1 的地方
- 标注文字用 `--ink-dim` 10px `--font-mono`

### 4.7 版面

```
┌────────────────────────────────────────────────────────────┐
│ 顶栏：1024 COMMIT 塔 | 输入框 | 加载态 | 预设按钮 | 封顶按钮  │
├──────────┬───────────────────────────────┬─────────────────┤
│ 左栏 300 │  中间 canvas                    │ 右栏 340        │
│ 头像/账号 │   影子柱 │ 塔 │ 限高标尺        │ 当前层详情       │
│ 账号底账  │                               │                 │
│ 类型图例  │                               │ 结算预览         │
│ 仓库清单  │                               │                 │
├──────────┴───────────────────────────────┴─────────────────┤
│ 底部：图纸标题栏                                                │
└────────────────────────────────────────────────────────────┘
```

**左栏「账号底账」必须包含**（这是作品的观点所在）：

```
账号底账
注册于        2010-09-07
公开仓库      47 个（其中 5 个含自己的提交）
提交总数      33,683 次
其中自己写的  287 次  (0.85%)
────────────────────────────────
你 GitHub 上的代码，99.1% 是借来的。
```

---

## 5. 交互规格

| 交互 | 行为 |
|---|---|
| 滚轮 / 拖拽 | 纵向滚动 = 爬塔。层进入视口时逐层 stagger 出现（每层 12ms），只播一次 |
| 点击层 | 选中：描白边，右栏出详情 |
| 点击「一键封顶」 | 相机平滑滚到塔顶，结算面板从下方滑入 |
| 滚回塔底 | 塔身重置，可重播建造动画 |
| 键盘 | `↑/↓` 移动选中层，`Enter` 打开 GitHub 链接 |
| 详情里的仓库名 | 点击跳该仓库该 commit 的 GitHub 页 |

### 结算面板（登顶出现，是截图第二主角）

```
塔顶结算
层数        287 层 · 距 1024 限高还差 737 层
跨度        2013-12-17 → 2026-09-28
最猛的一天  2026-09-12，共 33 次提交
周末提交    81 次（28%）
代码行      共改动 67,202 行
最猛的一层  2026-09-24 · Voice_VibeCoding · +2868/-4146（98 个文件）
────────────────────────────────────────
这 287 层里，130 层是修复，52 层是新功能。
```

**所有数字必须从 `stats` / `meta` 动态取，缺字段显示「—」，绝不能写死。**

最后那句总结必须用 `stats.typeCount` 算出来，不要写死。

### 三句可用的洞察（都从数据算，不写死）

1. **「你 GitHub 上的代码，99.1% 是借来的。」** ← `1 - meta.ownRatio`
2. **「你的 287 层里，286 层都挤在最近半年，中间空着 12 年。」** ← 按年分组算出最大空档
3. **「你的代码，一层都没在凌晨写过。」** ← `stats.byHour` 里 0–5 点为 0 时才显示这句

第 3 条要注意：如果换成别人的账号有凌晨提交，这句就不该出现。写成条件句。

### 分享图导出（Phase 5，可延后）

「整塔 + 影子柱 + 限高标尺 + 结算数据」导出 1080×1920 竖版 PNG。
推荐手绘到离屏 canvas（可控），文件名 `1024-commit-tower-<login>.png`。

---

## 6. 实时模式（输入别的用户名时）

评委可能想输入自己的用户名试。**必须能跑通，允许降级。**

```
输入含 "/"  → 当 owner/repo
否则        → 当 GitHub 用户名
```

### 账号实时抓取（未认证 60 次/小时上限）

1. `GET /users/{login}/repos?per_page=100&sort=pushed` → 全部仓库
2. 对每个仓库 `GET /repos/{o}/{r}/commits?per_page=1` 读 `Link` 头 `rel="last"` → 总提交数（1 请求/仓库，最多 47 次）
3. 只对 **最近 push 的 12 个仓库**翻页抓提交（每仓 1 页，100 条 = 12 次）
4. 过滤 `author.email` == 目标账号邮箱 → 得到自己的提交
5. 合并排序，取最多 1024 条 → 反转成塔底到塔顶
6. 剩余预算给**最近 8 条** fetch 单 commit 拿 stats（真实层高），其余层用基准高度

**请求预算**：1（repos）+ 12（repos head）+ 12（commits）+ 8（stats）≈ **33 次**，在 60 次/小时内。

### 仓库实时抓取

`GET /repos/{o}/{r}/commits?per_page=100` 翻页到 1024 条（11 次）→ 再取前 8 条的 stats。

### 降级链（必须全做）

| 情况 | 表现 |
|---|---|
| 静态 JSON 命中 | 直接用，最快（默认就是 runningwaterpro） |
| 实时抓取成功 | 正常渲染；层高降级为简化值，角标提示「实时模式 · 层高为简化值」 |
| 429 / 403 限流 | 提示「GitHub 限流了，先看这几个现成的塔」+ 3 个预置 login 快捷按钮 |
| 网络失败 | 同上，不白屏 |

实时模式的类型分类：把 `scripts/fetch-tower-data.mjs` 里的 `classify()` 搬到前端 `src/lib/classify.ts`，两份保持一致。

**预置按钮（4 个，都是真实数据）**

| 按钮 | 数据 | 亮点 |
|---|---|---|
| runningwaterpro（账号塔） | 287 层 | 默认，观点所在 |
| runningwaterpro/PyWxDump（仓库塔） | 1024 层 | **满塔**，看 1024 层长什么样 |
| runningwaterpro/opencode-traffic-light | 28 层 | 纯原创，100% 是自己的 |
| runningwaterpro/Voice_VibeCoding | 238 层 | 205 层是自己写的（86%） |

---

## 7. Phase 清单（每段一个 TRAE prompt，按顺序执行）

### Phase -1 · 数据管道（先做，20 分钟）
`scripts/fetch-tower-data.mjs` 已有一版可跑初稿，**请把它贴进 TRAE，让 TRAE 跑通并修掉两个真实的坑**——这段就是帖子里"TRAE 发挥作用"的真实素材，截图也好看。

```
这是我的 Node 数据管道脚本 scripts/fetch-tower-data.mjs，用来抓 GitHub 提交史生成塔的图层数据。
请先通读，然后：
1. 帮我装好依赖（无外部依赖，Node 原生 fetch 就够）
2. 运行它，跑出 public/data/runningwaterpro.json
3. 本机有 TLS 中间人代理，Node 报 UNABLE_TO_VERIFY_LEAF_SIGNATURE，
   请判断正确处理方式（--use-system-ca？还是设 NODE_EXTRA_CA_CERTS？）并给出可复现命令
4. 我新建的空仓库 1024-commit-tower 会让 GitHub 返回 409，请确认脚本已正确跳过空仓库
5. 再跑 repo 模式：node scripts/fetch-tower-data.mjs repo runningwaterpro/PyWxDump 1024
   我要一个满 1024 层的塔做对照
运行命令：
  GITHUB_TOKEN=$(gh auth token) node --use-system-ca scripts/fetch-tower-data.mjs account runningwaterpro 1024
跑完后告诉我：抓了多少仓库、多少条自有提交、多少层、类型分布、深夜提交数、最猛的一天、改动总行数。
```

### Phase 0 · 脚手架（**已就位，只需确认**）
```
这个仓库的脚手架已经建好了：Vite + React + TypeScript，package.json / vite.config.ts /
tsconfig.json / index.html / src/main.tsx / src/types.ts / src/styles.css 都已存在。

src/App.tsx 现在是一版朴素基线：287 层用 div 堆叠，颜色按提交类型，
滚动时会明显卡顿，没有任何视觉设计。

请先跑起来确认能用：
  npm install && npm run dev
如果 npm install 或启动报错，请修好它。然后告诉我基线版的滚动帧率大概是多少。
```

### Phase 1 · 数据读取
```
读取 public/data/runningwaterpro.json，按规格书第 3 节的 schema 用 TypeScript interface
完整定义 AccountTower / Layer / stats。
实现 hook useTowerData(input: string)：
  1. 先请求 public/data/{key}.json，命中就用（key 规则见规格书 6）
  2. 没命中再走实时抓取（src/lib/github.ts）
  3. 实时抓取失败时抛带 kind 的错误（'ratelimit' | 'network' | 'notfound'），由 UI 决定降级提示
先不管好不好看，用最朴素的方式（每层一个 div，灰色）把 287 层从上到下画出来，确认数据通了。
```

### Phase 2 · 蓝图视觉系统
```
把朴素 div 渲染换成 canvas 2D 绘制，严格按规格书 4.2 / 4.3：
- 深蓝底 + 8pt 网格（0.5px 细线，每 5 格加粗）
- 塔身：每层一个居中矩形，层高 h = 2.4 + log10(1+additions+deletions)*3.2，缩放到画布高度
- 层宽 w = (46% + 54%*diff/maxDiff)，diff = additions+deletions
- own 层：实心填充 layer.color；非 own 层：透明度 0.22 + 虚线边框
- BOSS 层（layer.big）层高 ×2.5，右侧拉引线标注
- 创世层（layer.creature）用 --accent 描边 + 地基线
- 深夜层（layer.night）左侧加 --accent-hot 发光竖条
- 周末层（layer.weekend）边框改点线
- 左侧水平尺寸线标注总层数
- 背景加图纸标题栏（title block）
```

### Phase 3 · 限高标尺 + 影子柱 + 年历标尺（**本作品的核心，不能砍**）
```
按规格书 4.4 / 4.5 / 4.6 实现三个元素，这是整个作品的观点所在：

1. 限高标尺：塔右侧一根恒定 1024 格高的竖直标尺
   - 0 在底，1024 在顶，标尺高度与实际层数无关
   - 你的塔顶在第 287 层，画 --accent 实线 + 标签「你的塔顶 287」
   - 塔顶到 1024 之间画极淡的虚线塔身轮廓（透明度 0.08）
   - 1024 处画虚线限高线 + 标签「1024 限高」
   - 标出「1 层」「287 层」「1024 层」三个刻度

2. 影子柱：塔左侧一根暗色半透明矩形
   - 高度 = log10(totalCommitsAllRepos)/log10(1024) * 塔高（log 压缩）
   - 柱身竖排文字「33,683 次提交 · fork 上游」
   - 柱顶画水平虚线并标注 33,683
   - 旁边必须标注「比例已压缩」

3. 年历标尺：塔身左侧（影子柱与塔之间）一根细标尺
   - 每层对应一个年月，年份首次出现处打刻度并标年份
   - 相邻两层年份差 > 1 的地方用虚线连接，线上标注「12 年 · 0 层」
   - 2026 年内按月打小刻度
   - 目标效果：塔底孤零零一层 2013 年，往上虚线标「12 年 · 0 层」，
     然后 2026 年 4 月起 286 层密密麻麻堆起来
   - 年份边界要从 layers 的 localDate 推出来，不要写死

4. 左栏加「账号底账」面板，字段按规格书 4.7，
   底部那行「你 GitHub 上的代码，99.1% 是借来的。」要能根据 ownRatio 动态算
```

### Phase 4 · 爬塔动画 + 选中交互
```
实现爬塔体验：
- 画布放在可滚动容器里，canvas 高度 = 塔总高 + 上下留白
- 层进入视口时按顺序 stagger 出现（每层 12ms），只播一次；滚回塔底时重置
- 点击层：命中测试（y 坐标 → 层索引），选中层描白边
- 选中层时右栏 LayerPanel 显示 sha / message / 作者 / 本地时间 / 类型 / 改动行数 /
  仓库 / GitHub 链接；仓库名可点，跳该仓库该 commit
- 键盘 ↑↓ 切换选中层，Enter 打开 GitHub 链接
- 性能：必须 60fps。做不到就上视口裁剪（只画可见区间）+ 背景网格离屏缓存
```

### Phase 5 · 结算面板 + 预设切换
```
实现：
- 「一键封顶」按钮：平滑滚动到塔顶，结算面板从底部滑入
- 结算面板字段严格按规格书第 5 节，数据从 stats / meta 取，缺失字段显示「—」不崩
- 结算面板最后那句总结（类型分布 + 深夜提交数）必须用 stats 动态算出来
- 顶栏加 4 个预设按钮（规格书 6 的表格），点击切换塔，带加载态
- 实时模式下在画布右上角加小角标「实时模式 · 层高为简化值」
```

### Phase 6 · 分享图导出
```
把「整塔 + 影子柱 + 限高标尺 + 结算数据」导出成 1080×1920 竖版 PNG：
- 推荐把 canvas 内容 drawImage 到离屏 1080×1920 canvas，再手绘结算文字（更可控）
- 下载文件名 1024-commit-tower-{login}.png
```

---

## 8. 部署

```bash
npm run build     # 产出 dist/
```

- Cloudflare Pages：连接 GitHub 仓库 `runningwaterpro/1024-commit-tower` → 构建命令 `npm run build` → 输出目录 `dist`
- 或 Vercel：`npx vercel --prod`

**部署后必测**
1. 手机浏览器打开，不横向滚动、不溢出
2. 打开静态 JSON 路径仍能拿到塔（证明数据随站发布）
3. 输入不存在的用户名 → 友好错误，不白屏
4. 输入 `runningwaterpro` → 必须命中静态 JSON，秒开
5. 切到 PyWxDump 预设 → 看到满 1024 层

---

## 9. 验收清单（发帖前逐条打勾）

- [ ] 打开链接 3 秒内看到塔，不需要任何操作
- [ ] 塔层数正确（账号塔 287 层；PyWxDump 1024 层）
- [ ] **限高标尺在，塔顶线在 287，1024 限高虚线在，上方有淡轮廓**
- [ ] **影子柱在，标了 33,683，标了「比例已压缩」**
- [ ] 左栏账号底账字段齐全，最后那行「99.1% 是借来的」是动态算的
- [ ] 层色能看出类型分布
- [ ] BOSS 层明显更高且有标注；创世层样式不同
- [ ] 滚到底再滚回来，动画能重播
- [ ] 点任意层，右栏出详情，GitHub 链接可点
- [ ] 「一键封顶」出结算面板
- [ ] 结算面板每行都有数，没有 undefined / NaN
- [ ] 4 个预设都能切换
- [ ] 输入别的用户名不白屏
- [ ] 手机端布局不塌
- [ ] 滚动不卡

## 10. 发帖素材（截图时一次拍完）

1. **首屏大图**：整塔全景 1600px（含影子柱 + 限高标尺 + 标题栏）
2. **5 秒 GIF**：塔自动从底部长到顶
3. **细节图 3 张**：BOSS 层标注 / 层详情面板 / 结算面板
4. **完整录屏 mp4**：30–45 秒，输入 → 爬塔 → 点层 → 封顶结算
5. **TRAE 对话截图 2 张**：一段是数据管道修 409 + TLS；一段是 canvas 性能优化

## 11. 已知坑

| 坑 | 说明 |
|---|---|
| Node 报 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | 本机 TLS 中间人代理，Node 需 `--use-system-ca`。浏览器端不受影响 |
| 提交列表接口不含 `stats`/`files` | 只有单 commit 接口 `GET /repos/{o}/{r}/commits/{sha}` 才有 → 实时模式只能给少数层算真实层高 |
| 新建空仓库返回 409 | 脚本要跳过（已处理） |
| 被下架的仓库返回 451 | 脚本要跳过（已处理） |
| 未认证 60 次/小时 | 实时模式控制在 33 次请求内；静态 JSON 是主力 |
| Discourse 首次上传 mp4 会转码 | 发帖后可能几分钟才有播放器，预留时间 |
| 1024 层用 DOM 会卡 | 必须 canvas + 视口裁剪 |
