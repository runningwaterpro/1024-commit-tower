# 1024 Commit 塔 · TRAE 施工提示词（逐段粘贴）

> 配套文档：`TRAE-BUILD-SPEC.md`（设计说明与取舍理由）、`POST-DRAFT.md`（发帖终稿）
> 用法：把下面每一段单独粘进 TRAE，**等它跑通、你看一眼效果，再粘下一段**。
> 每段末尾都有自检项，让 TRAE 自己核对，不要跳过。

---

## 0. 先看这个：坐标系是怎么定的（**所有提示词都基于它**）

### 方向约定（第一优先级，任何实现都不得反）

```
        ↑  时间向前 / 越新越高
        │
   塔顶 ┤ ← layers[n-1]  最新的一次提交（2026-09-28）
        │
        │ ← 中间是 2026 年的 286 层
        │
   塔底 ┤ ← layers[0]    最早的一次提交（2013-12-17）「创世层」
        │
      地基线
```

- **`layers` 数组已经按时间升序排好**：`layers[0]` = 最早 = 塔底，`layers[n-1]` = 最新 = 塔顶。
  数据管道里已经 `sort((a,b) => new Date(a.date) - new Date(b.date))` 过，**前端不要重排、不要反转**。
- **层序号 i（0-based）越大 → 场景 y 越小 → 位置越高**。
- 爬塔 = **滚轮向上** = 场景 y 变小 = 越新。滚轮向下 = 往回看更旧的提交。
- 限高标尺的 0 格在塔底、1024 格在塔顶，与时间同向。

**如果实现出来是倒的，那是 bug，不是设计。** 提示词 2 里有专门的断言会抓这个。

### 为什么限高标尺的 287→1024 段要压缩

要让「你的塔停在第 287 层」被**看见**，塔顶线必须和标尺的 287 刻度在**同一像素高度**上。
所以 0→287 这一段**等比且与塔严格对齐**。

但 287→1024 如果也等比，那段会有 4416px 长，视口根本装不下，首屏全是空白。
所以**只有 287→1024 这一段压缩成固定 280px**，并明确标注「未按比例」。

结果：
- 塔顶线永远在 y = **440**
- 1024 限高线永远在 y = **160**
- 塔顶到 1024 之间是 280px 的虚线轮廓，写着「这里还有 737 层，是空的」
- 塔本身占场景高度的 **68%**——够大，撑得住画面

### 世界坐标（单位 px，y 向下增加）

```
LIMIT       = 1024         限高格数
GRID        = 6            一层名义格高（真实层数段用）
TAPER_H     = 280          压缩段高度（塔顶 → 1024 限高线）
PAD_TOP     = 160          场景顶部留白（1024 限高线所在）
PAD_BOTTOM  = 220          场景底部留白（塔底 / 0 格线所在）
TOWER_MAX_W = 280          塔最大宽度
```

**注意 SCENE_H 是层数的函数**（因为塔高随层数变）：

```
sceneHeight(n) = PAD_TOP + TAPER_H + n*GRID + PAD_BOTTOM
   n=287  → 160 + 280 + 1722 + 220 = 2382
   n=1024 → 160 + 280 + 6144 + 220 = 6804
```

关键锚点（N = 层数）：

| 元素 | y 坐标（世界坐标） |
|---|---|
| 1024 限高线 | `PAD_TOP` = **160** |
| 塔顶线（第 N 层格顶） | `PAD_TOP + TAPER_H` = **440** |
| 第 i 层（0-based）名义格底边 | `yBase - i*GRID`，其中 `yBase = sceneHeight(N) - PAD_BOTTOM` |
| 第 i 层（0-based）名义格顶边 | `yBase - (i+1)*GRID` |
| 塔底 / 标尺 0 格 | `yBase` |

验算（N=287）：
- yBase = 2382 − 220 = **2162**
- 塔顶 = 2162 − 287×6 = **440** ✅ 与 `PAD_TOP + TAPER_H` 一致
- 1024 限高线 = **160** ✅
- 塔占 (2162−440)/1722 = **100%** 的塔段 + 280px 压缩段，总占比 (2162−440)/(2162−160) = **86%**

验算（N=1024）：
- yBase = 6804 − 220 = 6584
- 塔顶 = 6584 − 6144 = **440** ✅（和 N=287 时一样，永远在 440）

**首屏检查**：scrollTop=0 时视口显示 y ∈ [0, viewportH]。视口高 ≥ 600px 时，
160（1024 线）、440（塔顶线）、以及塔顶几十层**都在首屏内**。✅

### 标尺的两段刻度

```
rulerY(grids, n):
  if grids <= n:  return yBase - grids*GRID            // 等比段，与塔严格对齐
  else:           return (yBase - n*GRID) - (grids-n)/(LIMIT-n) * TAPER_H   // 压缩段
```

- `rulerY(0, n) === yBase`（塔底）
- `rulerY(n, n) === 440`（塔顶，与塔顶线同高）
- `rulerY(1024, n) === 160`（限高线）

压缩段**必须标注**「↑ 287→1024 未按比例」（9px，#7FA8CC，斜排或放在标尺右侧）。

### 每层的实体高度与宽度

```
diff_i   = additions + deletions
maxDiff  = 所有层 diff 的最大值

实体高 h_i = GRID * (0.55 + 0.75 * (diff_i/maxDiff)^0.4) * (isBoss ? 1.8 : 1)
实体宽 w_i = TOWER_MAX_W * (0.42 + 0.58 * sqrt(diff_i/maxDiff))
```

- diff=0 → 高 3.3px，宽 117.6px
- diff=max → 高 7.8px，宽 280px
- BOSS 层高 ×1.8 = 14.0px，**允许溢出名义格**，视觉上顶出格线

实体**从名义格底边往上长**（底部对齐），所以层越新越靠上、实体不越界。

### 渲染架构：sticky canvas + 视口裁剪

**不要**做一个 2382px（满塔时 6804px）高的 canvas（Safari 上限 4096px，且滚动会掉帧）。

```
<div class="scroll">        height: sceneHeight(n) px   （内容高度，就是滚动条长度）
  <canvas class="stage">    position: sticky; top: 0; height: 100vh; width: 100%
</div>
```

- 滚动容器高 = sceneHeight(n)
- canvas 用 `position: sticky; top: 0` 贴在视口，**高度 = 视口高**
- 渲染时：`screenY = worldY - scrollTop`，只画 `worldY ∈ [-80, viewportH+80]` 的层
- `scroll` / `resize` / `选中变化` 时 `requestAnimationFrame` 重绘
- canvas 尺寸按 devicePixelRatio 缩放：`canvas.width = cssW * dpr`，`ctx.scale(dpr, dpr)`

### 真实数据（用来验收，不要写死进代码）

```
账号塔 runningwaterpro：287 层
  总提交 33,683   自有 287 (0.85%)   跨度 2013-12-17 → 2026-09-28
  286 层在 2026 年；2013 年只有 1 层（塔底创世层）
  改动总行数 67,202   最猛一天 2026-09-12（33 次）   周末 81 次
  提交时段 7:00–21:00，凌晨 0 次
  BOSS 层 2026-09-24 Voice_VibeCoding +2868/-4146（98 文件）
```

---

## 提示词 1 · 启动与基线确认（20 分钟）

```
这个仓库是「1024 Commit 塔」——把 GitHub 提交史盖成一座代码塔。

先做三件事，做完汇报，不要写新功能：

1. 通读并理解这两份文档（这是完整的设计说明，不是要你改的东西）：
   - TRAE-BUILD-SPEC.md
   - POST-DRAFT.md 里「它长什么样」那段
   另外通读 src/types.ts（数据契约）和 public/data/runningwaterpro.json 的前 200 行
   （真实数据，287 层，每层有 sha/repo/message/date/additions/deletions/type/color/own/night/weekend/big/creature）

2. 跑通现有基线：
     npm install
     npm run dev
   报一下能不能起来、页面有没有报错。

3. 现在的基线是 src/App.tsx —— 每层一个 div 堆叠。请量一下它的滚动性能：
   用 Chrome DevTools Performance 面板滚一遍，记录平均帧率。
   这是「改造前」的基准，后面的 canvas 版本要跟它对比，所以这个数字我需要。

注意：npm 11 会拦截依赖安装脚本。如果 esbuild 报缺二进制，先
  npm approve-scripts esbuild
  npm rebuild esbuild
再跑。

汇报格式：
- 能不能跑通
- 基线滚动帧率
- 你读到的数据结构要点（3-5 条）
- 你准备怎么实现 canvas 渲染（简述思路，先别动手）
```

---

## 提示词 2 · 几何库（纯函数，可自测）

```
按下面这份规格写一个纯函数几何库，这是后面所有渲染的基础。**这一轮不要写任何渲染代码**，
只写计算，并给每个函数写断言自测。

新建 src/lib/geometry.ts：

```ts
export const LIMIT = 1024;         // 限高格数
export const GRID = 6;             // 一层名义格高（真实层数段）
export const TAPER_H = 280;        // 压缩段高度（塔顶 → 1024 限高线）
export const PAD_TOP = 160;        // 场景顶部留白（1024 限高线）
export const PAD_BOTTOM = 220;     // 场景底部留白（塔底 / 0 格线）
export const TOWER_MAX_W = 280;    // 塔最大宽度
export const TOWER_CENTER_X = 0;   // 塔在场景坐标系里的中心 x
export const RULER_X = 200;        // 限高标尺 x（塔右侧）
export const CALENDAR_X = -190;    // 年历标尺 x（塔左侧）
export const SHADOW_X = -300;      // 影子柱 x（年历标尺再往左）
export const SHADOW_W = 80;

/** 场景总高随层数变（塔高 = n*GRID） */
export function sceneHeight(n: number): number {
  return PAD_TOP + TAPER_H + n * GRID + PAD_BOTTOM;
}
/** 塔底 / 标尺 0 格的 y */
export function towerBaseY(n: number): number {
  return sceneHeight(n) - PAD_BOTTOM;
}
/** 塔顶 y —— 恒等于 PAD_TOP + TAPER_H = 440 */
export function towerTopY(n: number): number {
  return towerBaseY(n) - n * GRID;
}

/**
 * 【方向约定 —— 最重要的一条】
 * layers 数组已按时间【升序】排好：layers[0] = 最早 = 塔底，layers[n-1] = 最新 = 塔顶。
 * i 越大 → 场景 y 越小 → 位置越高。绝不能反。
 */
export function layerNominalBottom(i: number, n: number): number {
  return towerBaseY(n) - i * GRID;
}
export function layerNominalTop(i: number, n: number): number {
  return layerNominalBottom(i, n) - GRID;
}

/**
 * 标尺：grids 格（0 在塔底，1024 在顶部）的 y
 * 0..n 为等比段，与塔严格对齐；n..1024 为压缩段。
 */
export function rulerY(grids: number, n: number): number {
  if (grids <= n) return towerBaseY(n) - grids * GRID;
  const t = (grids - n) / (LIMIT - n);
  return towerTopY(n) - t * TAPER_H;
}

export interface Box {
  x: number; y: number; w: number; h: number;   // 左上角 + 尺寸
  nominalBottom: number; nominalTop: number;     // 名义格边界
  layerIndex: number;                            // 0-based
}

/** 第 i 层（0-based）的实体盒。实体从名义格底边往上长。 */
export function layerBox(i: number, n: number, diff: number, maxDiff: number, isBoss: boolean): Box {
  const nb = layerNominalBottom(i, n);
  const h = GRID * (0.55 + 0.75 * Math.pow(diff / maxDiff, 0.4)) * (isBoss ? 1.8 : 1);
  const w = TOWER_MAX_W * (0.42 + 0.58 * Math.sqrt(diff / maxDiff));
  return { x: -w / 2, y: nb - h, w, h, nominalBottom: nb, nominalTop: nb - GRID, layerIndex: i };
}

/** 影子柱高度（log 压缩）。total<=0 返回 0 */
export function shadowHeight(total: number, towerHeight: number): number {
  if (total <= 0) return 0;
  return towerHeight * (Math.log10(total) / Math.log10(LIMIT));
}

export interface YearSegment {
  year: number;
  fromIndex: number; toIndex: number;   // 0-based 层区间（含）
  gridFrom: number; gridTo: number;     // gridFrom = fromIndex, gridTo = toIndex+1
  firstDate: string; lastDate: string;
  gapYearsBefore: number;               // 与上一段相隔多少年（第一段为 0）
}

/** 把 layers 按 localDate 的年份切段，保持原有顺序（塔底→塔顶） */
export function yearSegments(layers: { localDate: string }[]): YearSegment[]
```

`yearSegments` 的实现要求：
- 按**数组顺序**（已按时间升序）遍历，遇到年份变化就切一段
- `gapYearsBefore` = 本段首层日期 与 上一段末层日期 之间的整年数
  （`Math.floor((dateB - dateA) / (365.25 * 24 * 3600 * 1000))`）

硬性数值要求（写完必须跑自测，全部通过）：

```
sceneHeight(287) === 2382
sceneHeight(1024) === 6804
towerBaseY(287) === 2162
towerTopY(287) === 440
towerTopY(1024) === 440          ← 塔顶位置与层数无关
rulerY(0, 287) === 2162
rulerY(287, 287) === 440         ← 塔顶与 287 刻度同高
rulerY(1024, 287) === 160        ← 限高线
rulerY(287, 287) - rulerY(1024, 287) === 280    ← 压缩段高度

layerNominalBottom(0, 287) === 2162    ← 塔底 = 最早的那层
layerNominalBottom(286, 287) === 444
layerNominalBottom(0, 287) > layerNominalBottom(286, 287)   ← 【方向断言】i 越大 y 越小（越高）

layerBox(0, 287, 0, maxDiff, false).h === 3.3
layerBox(0, 287, 0, maxDiff, false).w === 117.6
layerBox(0, 287, maxDiff, maxDiff, false).h === 7.8
layerBox(0, 287, maxDiff, maxDiff, false).w === 280
layerBox(0, 287, maxDiff, maxDiff, true).h === 14.04
shadowHeight(33683, 287 * GRID) ≈ 2574.5     // 1722 * log10(33683)/log10(1024)
```

**再加一组用真实数据的断言**（从 public/data/runningwaterpro.json 读）：

```
layers[0].localDate === '2013-12-17'                 ← 最早，在塔底
layers[layers.length - 1].localDate === '2026-09-28' ← 最新，在塔顶
layers[0].creature === true
yearSegments(layers) 有 2 段：
  第 1 段 year=2013, fromIndex=0, toIndex=0
  第 2 段 year=2026, fromIndex=1, toIndex=286, gapYearsBefore >= 12
```

把自测写成一个可运行的脚本（scripts/selftest-geometry.mjs，或用你项目里已有的测试方式），
跑一遍，把完整输出贴给我。**任何一条断言没过就别往下走，先修。**
```

---

## 提示词 3 · 蓝图 canvas 渲染（核心）

```
按规格实现 canvas 蓝图渲染。几何计算全部走 src/lib/geometry.ts，不要在渲染代码里
另写一份公式。

新建 src/lib/towerCanvas.ts，导出：

```ts
export interface RenderCtx {
  layers: Layer[];
  maxDiff: number;
  meta: TowerMeta;
  stats: TowerStats;
  scrollTop: number;      // 滚动容器的 scrollTop
  viewportH: number;      // 视口高度（px）
  viewportW: number;
  selectedSha: string | null;
  builtUntil: number;     // 已经"建造"（stagger 动画）到第几层（0-based，含）
}

export function drawTower(ctx: CanvasRenderingContext2D, r: RenderCtx): void
export function hitTest(r: RenderCtx, screenX: number, screenY: number): Layer | null
```

绘制顺序（严格按这个顺序叠放）：

**【方向】塔底 = 最早（layers[0]），塔顶 = 最新（layers[n-1]）。越往上越新。**
所有 y 越小的 = 越新。渲染时务必用 `layerBox(i, n, ...)`，i 直接用 layers 的下标，
**不要反转数组**。

0. **方向指示器**：塔右侧画一个竖直向上的箭头（从塔底指向塔顶），
   箭头旁竖排写 `时间 ↑`（9px，#7FA8CC）。
   —— 工程图必须有方向标，否则看的人不知道哪边是新的。

1. **背景**：填充 `--bg-deep` #08192B
2. **网格**：8pt 网格，细线 rgba(127,196,255,0.07)，线宽 0.5；
   每 5 格加粗一档 rgba(127,196,255,0.16)。
   网格是**屏幕固定**的（不随滚动移动），模拟图纸底纹。
3. **影子柱**（仅账号塔且 totalCommitsAllRepos > 0 时画）：
   - x = SHADOW_X，宽 SHADOW_W
   - 底边对齐塔底（y = towerBaseY(n)），高 = shadowHeight(total, n*GRID)
   - 填充 rgba(58,85,112,0.5)，无边框
   - 柱顶画一条水平虚线（#3A5570，dash [4,4]），右端标 `33,683`
   - 柱身竖排文字（逐字旋转 90° 或逐行绘制，竖排居中）：
     `33,683 次提交 · fork 上游`
   - 柱底旁标注 `比例已压缩`（9px，#7FA8CC）
4. **年历标尺**（x = CALENDAR_X）：
   - 一条从 y=towerBaseY(n) 到 y=PAD_TOP 的细竖线，#3A5570
   - 对每个 yearSegment：在该段首层的名义格顶边位置打一个短横刻度 + 年份文字（如 `2026`）
   - **年份断点标记（重要）**：当某个 yearSegment 的 `gapYearsBefore >= 2`，
     说明两层之间跳了多年。在这一层的名义格顶边位置，**横贯塔身画一对折断斜线**
     （工程图的省略符号：两条平行斜线，与垂直方向约 60°，
     颜色 #FFC24B，线宽 1.2px，横跨塔身宽度），表示「这里时间被折叠了」。
   - 折断符号旁用引线拉到年历标尺，在标尺上标 `12 年 · 0 层`（10px，#FFC24B）
   - 2026 年内按月画小刻度（3px 短线），不标文字
   - 标尺底端标 `0`，顶端标 `1024`
   - ⚠️ 年份之间在**层网格上只隔 1 格**（2013 那层和 2026 那层是相邻的），
     所以「12 年」这件事**不能靠留白表达**，必须靠折断符号 + 引线标注表达。
     这是本设计最容易做错的地方。
5. **塔身**（居中于 x=0）：
   - 只画 worldY ∈ [-80, viewportH+80] 的层（视口裁剪）
   - 每层一个矩形，`layerBox(i, n, diff, maxDiff, layer.big)`，**i 就是 layers 的下标**
   - **own 层**：实心填充 layer.color，不透明，边框 rgba(255,255,255,0.12) 1px
   - **非 own 层**：填充 layer.color 但 globalAlpha=0.22，边框改虚线 #3A5570，dash [3,3]
   - 层与层之间留 1px 间隙（h 减 1），形成砌块感
   - **BOSS 层**：额外在右侧拉一条引线（从层右边缘到 x=130 的折线），
     标注 `BOSS +2868/-4146 · 98 文件`（9px，#FFC24B）
   - **创世层**（layer.creature，即 layers[0]，最早那层，在塔底）：
     用 #FFC24B 描边 1.5px，
     塔底画一条地基线（横贯塔宽的 1px 实线 #FFC24B），
     引线标注 `创世层 · 2013-12-17 · 你的第一次提交`（9px，#FFC24B）
   - **塔顶**（layers[n-1]，最新那层）：加一条 1px 的 #7FC4FF 顶边线，
     引线标注 `最新 · 2026-09-28`（9px，#7FC4FF）
   - **深夜层**（layer.night）：层左侧叠一条 2px 宽的 #FF6B5B 竖条
   - **周末层**（layer.weekend）：边框改点线 [1,2]
   - **选中层**：外扩 1px 画白色 2px 描边
   - **建造动画**：i <= builtUntil 的层正常画；i > builtUntil 的层画成高度为 0 的占位
     （即"还没盖到"）
6. **限高标尺**（x = RULER_X）：
   - 一条从 y=towerBaseY(n) 到 y=PAD_TOP 的竖线，#7FC4FF
   - **下段（0 → n，等比）**：每 64 格打一个刻度（64/128/192/256），
     旁标数字（9px #7FA8CC）。这一段和塔严格对齐。
   - **上段（n → 1024，压缩）**：虚线 #3FC4FF dash [3,3]，
     顶端 1024 处画横线（#7FC4FF 虚线 dash [6,4]），右端标 `1024 限高`（10px #CFE6FF）
   - **压缩段必须标注** `↑ 287→1024 未按比例`（9px，#7FA8CC）
   - **塔顶线**：在 y = rulerY(n, n) = 440 处画一条横线（#FFC24B，1.5px），
     右端标 `你的塔顶 287`（10px #FFC24B）
   - **未建成轮廓**：从塔顶线到 1024 限高线之间，画一个塔身宽度的虚线轮廓矩形
     （rgba(127,196,255,0.18)，dash [4,4]），里面不填色；
     轮廓中间写 `这里还有 737 层，是空的`（11px，rgba(127,196,255,0.25)，居中）
   - 标尺底端标 `0`
7. **场景坐标 → 屏幕坐标**：
   场景 x 以塔中心为 0 → 屏幕 x = viewportW/2 + sceneX
   场景 y → 屏幕 y = sceneY - scrollTop
   也就是说滚动时塔往上走、标尺跟着走，网格不动。
   滚轮向上（scrollTop 变小）= 场景 y 变小 = 位置更高 = 更新 = 爬塔。

8. **尺寸标注**：塔左下角画一条水平尺寸线（带端头竖线的工程标注样式），
   标注 `287 层`；标尺顶端画一条垂直尺寸线标注 `1024`。

实现要求：
- canvas 尺寸按 devicePixelRatio 处理（canvas.width = cssW*dpr，ctx.scale(dpr,dpr)）
- 用 ResizeObserver 监听容器尺寸变化并重绘
- 文字全部用 `--font-mono` 栈：'JetBrains Mono','Cascadia Mono',ui-monospace,monospace
  （不要引 Google Fonts，国内不可达；系统没有就退到 ui-monospace）
- 中文标注用 'Microsoft YaHei','PingFang SC',system-ui

自检：
- 画完后，塔顶线 y 必须等于 rulerY(n, n)（你自己在代码里 assert）
- 1024 限高线 y 必须等于 160
- 塔顶线必须在 440
- 首屏（scrollTop=0，视口 900px）必须同时看到：1024 限高线、塔顶线、虚线轮廓、塔身顶部几十层
- 滚动到最底时，塔底和创世层必须在画面里

跑起来给我看效果截图。
```

---

## 提示词 4 · 爬塔动画与交互

```
在提示词 3 的渲染基础上加交互。要求：

1. **页面结构**
   - 滚动容器（.scroll，height = sceneHeight(n)）里放
     `<canvas class="stage" style="position:sticky;top:0;height:100vh;width:100%">`
   - 滚动时把容器的 scrollTop 传给 drawTower
   - 初始 scrollTop = 0（首屏就是塔顶 + 1024 限高线 + 塔身顶部）

2. **建造动画**
   - `builtUntil` 是一个层索引，layers[0..builtUntil] 已"建好"。
   - 因为 layers[0] 在塔底，所以建造顺序是**从下往上**：
     当用户向下滚动、新的层进入视口时，从当前 builtUntil 往上依次推进，
     每层延迟 12ms 依次"长出来"（高度从 0 过渡到目标高，easeOutCubic，180ms）。
   - 滚回最底部时重置 builtUntil（= -1），回到顶部重新播一次。

3. **命中测试**
   - hitTest(screenX, screenY)：先把屏幕坐标换算成场景坐标
     （sceneX = screenX - viewportW/2，sceneY = screenY + scrollTop），
     再找出所有与该 y 区间相交的层（线性扫 287/1024 个都够快）。
   - 命中多个时，**取层号最大的那个**（因为层号越大 = 位置越高 = 视觉上在最上面）。
   - click 时调用 hitTest，选中该层，画白色描边。

4. **键盘**
   - ↑ / ↓ 在层之间移动选中（每按一次跨 1 层；按住 Shift 跨 10 层）。
     注意方向：↑ 键要移动到**更新**的层（层号 +1），↓ 键移动到更旧的层（层号 -1）。
   - Enter 打开 `https://github.com/{layer.repo}/commit/{layer.sha}`
   - 选中层变化时，自动把该层滚到视口中间（平滑滚动）

5. **性能**
   - 目标 60fps。用 requestAnimationFrame 节流：scroll 事件只记录最新 scrollTop，
     由 rAF 统一消费重绘。
   - 每帧只画视口内的层（已实现）。
   - 如果还有问题，再做「静态背景网格离屏缓存」：把网格画到一张离屏 canvas，
     每帧 drawImage 贴过来，不要每帧重画网格线。

6. **「一键封顶」按钮**
   - 平滑滚动到 scrollTop = 0（塔顶 + 1024 限高线那一屏），这就是"封顶"
   - 再加一个「回到地基」按钮，平滑滚到 scrollTop = 最大值（塔底 + 创世层）

自检：
- 滚到底再滚回顶，建造动画能重播
- 点任意一层能选中，右栏能出详情
- ↑↓ 能移动选中（↑ 往更新方向），Enter 能打开 GitHub
- 一键封顶 / 回到地基 两个按钮都能用
- 滚动帧率报一个数字给我（和基线那个 div 版对比）
```

---

## 提示词 5 · 三根标尺 + 面板（作品的观点所在）

```
现在把作品的核心表达做出来。分三块，每块都要能独立验证。

【A. 三根标尺 + 文案】

1. **限高标尺**（提示词 3 已画基础版，这里补文案与细节）
   - 塔顶线右侧标 `你的塔顶 287`
   - 287 到 1024 之间的虚线轮廓内，居中写：
     `这里还有 737 层，是空的`（11px，rgba(127,196,255,0.25)）
   - 标尺顶端标 `1024 限高`
   - 压缩段旁标 `↑ 287→1024 未按比例`

2. **年历标尺**
   - 用 geometry.ts 的 yearSegments 算出年份分段
   - 关键效果：塔底 2013 年那 1 层，和上面 2026 年的 286 层之间，
     要画出**折断符号**并标 `12 年 · 0 层`
   - 2026 年内按月画小刻度，让密集区看起来很热闹

3. **影子柱**
   - 高度用 shadowHeight(totalCommitsAllRepos, n*GRID)
   - 柱顶虚线 + `33,683`
   - 柱旁必须写 `比例已压缩`
   - 柱身竖排 `33,683 次提交 · fork 上游`

【B. 左栏「账号底账」面板】

字段（用真实值，不要写死）：
```
注册于        2010-09-07
公开仓库      47 个（其中 5 个含自己的提交）
提交总数      33,683 次
其中自己写的  287 次（0.85%）
──────────────────────
你 GitHub 上的代码，99.1% 是借来的。
```
最后那行要**动态算**：(1 - ownRatio)*100，保留 1 位小数。
「其中 5 个含自己的提交」要从 repoBook 里数出来。

【C. 右栏「层详情」+「结算」】

点中某层时右栏显示：
```
第 287 层                    ← layer.seq（1-based，所以最新那层是 287）
refactor: harden RC003 voice reliability   ← layer.message，可换行
sha        3f2a9c1
仓库       Voice_VibeCoding
作者       runningwaterpro
时间       2026-09-24 14:32   ← localDate + localHour
类型       refactor
改动       +2868 / -4146（98 个文件）
[在 GitHub 打开]
```

「一键封顶」到位后，结算面板从下方滑入：
```
塔顶结算
层数        287 层 · 距 1024 限高还差 737 层
跨度        2013-12-17 → 2026-09-28
最猛的一天  2026-09-12，共 33 次提交
周末提交    81 次（28%）
代码行      共改动 67,202 行
最猛的一层  2026-09-24 · Voice_VibeCoding · +2868/-4146（98 个文件）
────────────────────────────
这 287 层里，130 层是修复，52 层是新功能。
```
**所有数字必须从 stats / meta 动态算**：
- 最猛的一天 → stats.busiestDate / busiestDateCount
- 周末 → stats.weekendCount / layerCount
- 代码行 → stats.totalLinesChanged
- 最猛的一层 → stats.biggestCommits[0]
- 最后那句 → stats.typeCount 里 fix 和 feat 的数量，取 top2 类型拼句子
- 缺字段显示「—」，绝不能出现 undefined / NaN

自检：
- 改一下 stats 里的数字，结算面板的显示要跟着变（证明不是写死的）
- 头像缺失时不要显示破图
```

---

## 提示词 6 · 预设切换 + 实时模式 + 降级

```
加三件事。

【A. 预设切换按钮】（顶栏）

4 个按钮，全部指向 public/data/ 里已生成的静态文件：
1. `runningwaterpro`        → 账号塔，287 层（全亮），默认
2. `repo__runningwaterpro__Voice_VibeCoding` → 238 层，其中 205 亮 + 33 暗（看得出上游那几层）
3. `repo__runningwaterpro__PyWxDump`        → 1024 层，满塔
4. `repo__runningwaterpro__opencode-traffic-light` → 28 层，纯原创

文件名规则要和 data 目录里的实际文件一致，先 ls 一下 public/data 确认。
切换时显示加载态；切换后要重建 maxDiff、yearSegments、shadowHeight 等派生数据，
**并且 sceneHeight / 滚动容器高度要跟着层数变**（2382 ↔ 6804），
最后把 builtUntil 重置（让建造动画重播）、滚动位置复位。

【B. 实时模式】

顶栏一个输入框，接受两种输入：
- 含 `/` → 当作 `owner/repo`
- 否则 → 当作 GitHub 用户名

请求预算控制（GitHub 未认证 60 次/小时）：
- 账号模式：
  1 次 GET /users/{login}/repos?per_page=100&sort=pushed
  → 对最近 push 的 12 个仓库，各 1 次 GET .../commits?per_page=1 读 Link 头 rel="last" 拿总数
  → 对其中 12 个仓库各 1 页 GET .../commits?per_page=100
  → 合并、按 commit.author.date **降序**、取前 1024 条、**再反转**成塔底→塔顶
  → 过滤 author.email 属于目标账号的提交作为 own
  → 用剩余预算给最靠前的 8 条 fetch 单 commit 拿 stats
  合计约 33 次请求。
- 仓库模式：
  GET .../commits?per_page=100 翻页到 1024 条（11 次），
  再给前 8 条 fetch stats。
- 类型分类：把 scripts/fetch-tower-data.mjs 里的 classify() 搬到
  src/lib/classify.ts（保持两份逻辑一致），实时模式下用本地分类。
- 本地时区：GitHub 返回的是 UTC 时间戳，小时换算要 +8 再取。

【C. 降级链】（必须全做，不能白屏）

| 情况 | 表现 |
|---|---|
| 静态 JSON 命中 | 直接用，秒开 |
| 实时抓取成功 | 正常渲染；层高降级为统一基准值（因为大部分层没有 stats），画布右上角加角标「实时模式 · 层高为简化值」 |
| 429 / 403 | 提示「GitHub 限流了，先看这几个现成的塔」+ 4 个预设按钮 |
| 404 / 用户不存在 | 提示「没找到这个账号，检查一下拼写？」 |
| 网络失败 | 同限流提示，不白屏 |

错误统一用 `throw { kind: 'ratelimit' | 'network' | 'notfound' }` 的形式抛，
由 UI 层 catch 后决定展示什么。

自检：
- 输入 `torvalds` 应该能出塔（可能慢，耐心等）
- 输入 `this_user_does_not_exist_zzz` 应该显示友好提示，不是白屏
- 连点 4 个预设不能卡死，滚动容器高度要跟着变
```

---

## 提示词 7 · 分享图导出

```
加「导出分享图」功能：把整座塔 + 三根标尺 + 结算数据导出成一张 1080×1920 竖版 PNG。

做法（推荐这个，比 html-to-image 可控）：
1. 建一个离屏 canvas，1080×1920
2. 填充背景 #08192B
3. 把场景画进一张「全场景」离屏 canvas（高度 = sceneHeight(n)），调用 drawTower 渲染完整场景
   （drawTower 的 viewportH 传 sceneHeight(n)、scrollTop 传 0、viewportW 传场景宽度）
4. 再把全场景 canvas 按比例 drawImage 贴进 1080×1920
5. 底部手绘结算文字（层数、跨度、最猛的一天、改动总行数、那句洞察）
6. 右下角写 `1024 COMMIT 塔 · {login}`
7. canvas.toBlob('image/png') → 触发下载，文件名 `1024-commit-tower-{login}.png`

排版建议：
- 上部 ~18% 放标题「1024 COMMIT 塔」+ 副标题
- 中部 ~62% 放塔（等比缩放后居中）
- 下部 ~20% 放结算数字 + 洞察文案
- 塔本身只占场景 86%，缩进中部后上下留白正好

注意：
- 1080×1920 的离屏 canvas 在移动端可能吃内存，做完 toBlob 及时释放引用
- 场景高 6804px（满塔）时，全场景离屏 canvas 很高，注意内存；
  必要时把 scale 缩小后分块画

自检：导出的 PNG 要能正常打开、字不糊、塔完整。
```

---

## 提示词 8 · 收尾自检清单（让 TRAE 自己跑一遍）

```
按下面清单逐条自查并汇报结果，不要只说"已完成"：

- [ ] 打开链接 3 秒内看到塔，不需要任何操作，不需要填任何东西
- [ ] 塔层数 = data.layers.length（287）
- [ ] **塔底是最早的那层**：layers[0].localDate = 2013-12-17 在最下面
- [ ] **塔顶是最新那层**：layers[286].localDate = 2026-09-28 在最上面
- [ ] 塔顶线 y === 440，1024 限高线 y === 160
- [ ] 塔顶线与标尺 287 刻度同高
- [ ] 塔顶线到 1024 限高线之间有虚线轮廓，轮廓里写着「这里还有 737 层，是空的」
- [ ] 压缩段旁边标了「↑ 287→1024 未按比例」
- [ ] 影子柱存在，标了 33,683，标了「比例已压缩」
- [ ] 年历标尺上能看到 2013 和 2026，中间有**折断符号**并标「12 年 · 0 层」
- [ ] 塔旁有向上的箭头 + 「时间 ↑」
- [ ] 层色能看出类型分布；BOSS 层明显更高且有引线标注；创世层用金色描边 + 地基线
- [ ] 首屏（scrollTop=0）能同时看到 1024 限高线、塔顶线、塔身顶部
- [ ] 滚到底再滚回顶，建造动画能重播
- [ ] 点任意层，右栏出详情，GitHub 链接可点
- [ ] ↑ 键往更新方向移动选中
- [ ] 「一键封顶」出结算面板，且每个数字都是动态算的（你改一个 stats 数字试试）
- [ ] 4 个预设都能切换，切换后滚动容器高度跟着变、建造动画重播
- [ ] 输入 `runningwaterpro` 必须命中静态 JSON，秒开（不打 API）
- [ ] 输入不存在的账号 → 友好提示，不白屏
- [ ] 手机宽度（375px）下布局不塌、塔还能看
- [ ] 滚动帧率（报数字）

然后：
- [ ] 跑 `npm run build` 确认能构建通过
- [ ] 提交并 push 到 main（GitHub Pages 会自动部署）
- [ ] 把线上地址贴给我

最后给我一段 60-100 字的说明，介绍你这个实现是怎么做的，
我要用这段话写进作品介绍里。
```

---

## 给你的执行建议

**今晚（10/20）**：提示词 1 → 2 → 3。做到 3 结束就停，睡一觉。
看效果不满意就趁 TRAE 上下文还热的时候让它改。

**明天白天（10/21）**：提示词 4 → 5 → 6。上午做 4、5，下午做 6。
傍晚做 7、8。

**10/21 晚上**：截图 + 录屏 + 发帖（帖子终稿在 `POST-DRAFT.md`，数字全核实过）。

**两个必须自己盯的点**：
1. **10/21 晚上必须发**。评选写的是「内容互动 + 质量」，互动是累计分。
2. **发帖时别把数据管道说成 TRAE 写的**——提示词 1 那一段是真的让 TRAE 跑了数据管道的，
   截图才是真的；其余部分按 TRAE 实际做了什么说什么。
