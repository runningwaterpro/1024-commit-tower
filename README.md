# 1024 Commit 塔

> 把你的 GitHub 提交史，盖成一座 1024 层的代码塔。

为 [TRAE 社区 1024 Builder 作品秀](https://forum.trae.cn/t/topic/325833) 打造。

**在线演示**：https://runningwaterpro.github.io/1024-commit-tower/

---

## 它是什么

输入一个 GitHub 用户名，网页会把这个人的**真实提交史**渲染成一座塔：

- **每层 = 一次提交**，从塔底（最早）到塔顶（最新）
- **层高 = 真实改动行数**（`additions + deletions`，不是拍脑袋的固定值）
- **层色 = 提交类型**（fix 红 / feat 蓝 / docs 青 / chore 灰 / refactor 紫…）
- **实心亮层 = 你自己写的**，**暗色虚线层 = fork 进来的上游代码**
- **BOSS 层** = 改动量最大的 5 次提交，明显高出好几层并被标注
- **创世层** = 最早的那一次提交，在塔底
- **右侧限高标尺**：0 → 1024 格。你的塔停在第 N 格，上面是虚线画出的、还没盖到的部分
- **左侧影子柱**：你继承的上游提交体量（log 比例压缩，柱旁标明「比例已压缩」）
- **年历标尺**：每层对应的年月，年份之间的空档用虚线标出
- 滚轮 = 爬塔，点任意层 = 看到那一次提交的 sha / 仓库 / 时间 / GitHub 链接
- 登顶后出结算：层数、跨度、最猛的一天、周末提交数、改动总行数

## 一个关键的诚实设计

GitHub 上大多数仓库是 fork，而 **fork 的提交历史里混着上游作者的提交**。
直接拿来盖塔，等于把别人的代码算成自己的。

所以这座塔只统计 **author email 匹配账号所有者** 的提交 —— 每一层亮色实心层都是 TA 自己写的。

以本仓库作者为例：

| 指标 | 值 |
|---|---|
| 公开仓库 | 47 个（只有 5 个含自己的提交） |
| 账号提交总数（含 fork 上游） | 33,683 |
| **自己写的提交** | **287（0.85%）** |
| 时间跨度 | 2013-12-17 → 2026-09-28，但 286 层挤在 2026 年 4–9 月 |
| 提交时段 | 7:00–21:00，凌晨 0–6 点一次都没有 |
| 改动总行数 | 67,202 |

> 「你 GitHub 上的代码，99.1% 是借来的。」

## 技术要点

- 纯静态前端（Vite + React + TypeScript + Canvas 2D），**零后端**
- GitHub API 的 CORS 是 `Access-Control-Allow-Origin: *`，浏览器直连即可
- 预生成数据随站发布，打开即用；实时抓取作为增强（受 GitHub 60 次/小时未认证限流约束）
- 1024 层用 canvas + 视口裁剪渲染，保证滚动 60fps

## 目录

```
scripts/fetch-tower-data.mjs   数据管道：抓提交 → 过滤自有 → 分类 → 取 stats → 生成 JSON
public/data/*.json             预生成的图层数据
src/types.ts                   数据契约
src/App.tsx                    基线版渲染（朴素 div），蓝图 canvas 版由 TRAE 实现
TRAE-BUILD-SPEC.md             视觉与交互规格书（含逐阶段 TRAE prompt）
POST-DRAFT.md                  论坛发帖终稿
```

## 本地运行数据管道

```bash
# 账号塔（只统计自己写的提交）
GITHUB_TOKEN=$(gh auth token) node --use-system-ca scripts/fetch-tower-data.mjs account runningwaterpro 1024

# 仓库塔（全部提交，own 字段区分归属）
GITHUB_TOKEN=$(gh auth token) node --use-system-ca scripts/fetch-tower-data.mjs repo runningwaterpro/PyWxDump 1024
```

> `--use-system-ca`：部分网络环境有 TLS 中间人代理，Node 需要显式使用系统证书。
> 浏览器端不受影响。

## 本地运行前端

```bash
npm install
npm run dev
```

> npm 11 会拦截依赖的安装脚本，需要先 `npm approve-scripts esbuild` 再 `npm rebuild esbuild`。

## 部署

推送到 `main` 分支即触发 GitHub Actions，自动部署到 GitHub Pages。

## License

MIT
