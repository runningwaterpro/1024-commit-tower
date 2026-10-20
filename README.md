# 1024 Commit 塔

> 把你的 GitHub 提交史，盖成一座 1024 层的代码塔。

为 [TRAE 社区 1024 Builder 作品秀](https://forum.trae.cn/t/topic/325833) 打造。

---

## 它是什么

输入一个 GitHub 用户名，网页会把这个人的**真实提交史**渲染成一座塔：

- **每层 = 一次提交**，从塔底（最早）到塔顶（最新）
- **层高 = 真实改动行数**（`additions + deletions`，不是拍脑袋的固定值）
- **层色 = 提交类型**（feat 蓝 / fix 红 / docs 青 / chore 灰 / refactor 紫…）
- **BOSS 层** = 改动量最大的 5 次提交，会明显高出好几层并被标注
- **创世层** = 最早的那一次提交，在塔底
- **深夜层** = 凌晨 1:00–4:59 的提交，左侧带发光标记
- 滚轮 = 爬塔，点任意层 = 看到那一次提交的 sha / 仓库 / 时间 / GitHub 链接
- 登顶后出结算：层数、跨度、最猛的一天、深夜提交数、改动总行数

## 一个关键的诚实设计

GitHub 上大多数仓库是 fork，而 **fork 的提交历史里混着上游作者的提交**。
直接拿来盖塔，等于把别人的代码算成自己的。

所以这座塔只统计 **author email 匹配仓库所有者** 的提交 —— 每一层都是 TA 自己写的。

## 技术要点

- 纯静态前端（Vite + TypeScript + Canvas 2D），**零后端**
- GitHub API 的 CORS 是 `Access-Control-Allow-Origin: *`，浏览器直连即可
- 预生成数据随站发布，打开即用；实时抓取作为增强（受 GitHub 60 次/小时未认证限流约束）
- 1024 层用 canvas + 视口裁剪渲染，保证滚动 60fps

## 目录

```
scripts/fetch-tower-data.mjs   数据管道：抓提交 → 过滤自有 → 分类 → 取 stats → 生成 JSON
public/data/*.json             预生成的图层数据
TRAE-BUILD-SPEC.md             视觉与交互规格书（含逐阶段 TRAE prompt）
```

## 本地运行数据管道

```bash
GITHUB_TOKEN=$(gh auth token) node --use-system-ca scripts/fetch-tower-data.mjs runningwaterpro 1024
```

> `--use-system-ca`：部分网络环境有 TLS 中间人代理，Node 需要显式使用系统证书。
> 浏览器端不受影响。

## 本地运行前端

```bash
npm install
npm run dev
```

## License

MIT
