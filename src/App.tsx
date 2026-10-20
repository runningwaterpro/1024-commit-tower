/**
 * BASELINE 渲染 —— 这是一次性的朴素版本：
 * 每一层一个 div，颜色按提交类型。
 *
 * 这个版本的作用：
 *   1. 让仓库今晚就能跑起来、部署出可访问的链接
 *   2. 作为 TRAE 改造的「改造前」基准
 *
 * 正式的蓝图渲染（canvas 2D + 限高标尺 + 影子柱 + 爬塔动画）
 * 见 TRAE-BUILD-SPEC.md 第 4 节，由 TRAE 实现。
 */
import { useEffect, useMemo, useState } from "react";
import type { Layer, TowerData } from "./types";

const DATA_KEY = "runningwaterpro";

export default function App() {
  const [data, setData] = useState<TowerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Layer | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/${DATA_KEY}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const maxDiff = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.layers.map((l) => l.additions + l.deletions));
  }, [data]);

  if (error) {
    return (
      <div className="boot">
        <p>数据加载失败：{error}</p>
        <p>运行 <code>npm run data</code> 生成 public/data/{DATA_KEY}.json</p>
      </div>
    );
  }

  if (!data) return <div className="boot">正在加载塔…</div>;

  const { meta, stats } = data;
  const ownRatio = meta.ownRatio ?? 0;
  const borrowedPct = ((1 - ownRatio) * 100).toFixed(1);
  const borrowedLabel = ownRatio >= 0.5 ? "是 fork 来的" : "是借来的";

  return (
    <div className="app">
      <header className="top">
        <h1>1024 COMMIT 塔</h1>
        <div className="sub">
          {meta.login} · {meta.layerCount} 层 · {meta.spanStart} → {meta.spanEnd}
        </div>
      </header>

      <div className="body">
        <aside className="left">
          <h2>账号底账</h2>
          <dl>
            <dt>注册于</dt>
            <dd>{meta.accountCreated}</dd>
            <dt>公开仓库</dt>
            <dd>{meta.repoCount} 个</dd>
            <dt>提交总数</dt>
            <dd>{meta.totalCommitsAllRepos?.toLocaleString()} 次</dd>
            <dt>自己写的</dt>
            <dd>
              {meta.ownCommitsTotal} 次（{((meta.ownRatio ?? 0) * 100).toFixed(1)}%）
            </dd>
          </dl>
          <p className="punch">
            你 GitHub 上的代码，{borrowedPct}% {borrowedLabel}。
          </p>

          <h2>类型分布</h2>
          <ul className="legend">
            {Object.entries(stats.typeCount)
              .sort((a, b) => b[1] - a[1])
              .map(([t, n]) => (
                <li key={t}>
                  <span className="dot" style={{ background: TYPE_COLOR[t] ?? "#5b6472" }} />
                  {t} <b>{n}</b>
                </li>
              ))}
          </ul>
        </aside>

        <main className="tower">
          {data.layers.map((l) => {
            const diff = l.additions + l.deletions;
            const h = 2.4 + Math.log10(1 + diff) * 3.2;
            const w = 46 + 54 * (diff / maxDiff);
            return (
              <div
                key={l.sha}
                className={"layer" + (l.own ? "" : " ghost") + (selected?.sha === l.sha ? " sel" : "")}
                style={{
                  height: `${h}px`,
                  width: `${w}%`,
                  background: l.color,
                }}
                title={`#${l.seq} ${l.message}`}
                onClick={() => setSelected(l)}
              />
            );
          })}
        </main>

        <aside className="right">
          {selected ? (
            <>
              <h2>第 {selected.seq} 层</h2>
              <p className="msg">{selected.message}</p>
              <dl>
                <dt>sha</dt>
                <dd>
                  <a href={`https://github.com/${selected.repo}/commit/${selected.sha}`} target="_blank" rel="noreferrer">
                    {selected.sha.slice(0, 7)}
                  </a>
                </dd>
                <dt>仓库</dt>
                <dd>{selected.repoShort}</dd>
                <dt>作者</dt>
                <dd>{selected.author}</dd>
                <dt>时间</dt>
                <dd>
                  {selected.localDate} {String(selected.localHour).padStart(2, "0")}:00
                </dd>
                <dt>类型</dt>
                <dd>{selected.type}</dd>
                <dt>改动</dt>
                <dd>
                  +{selected.additions} / -{selected.deletions}（{selected.files} 文件）
                </dd>
              </dl>
            </>
          ) : (
            <p className="hint">点塔上的任意一层看详情</p>
          )}
        </aside>
      </div>

      <footer className="titleblock">
        <span>项目 1024 COMMIT 塔</span>
        <span>作者 {meta.login}</span>
        <span>层数 {meta.layerCount} / 限高 {meta.limitMark}</span>
        <span>跨度 {meta.spanStart} → {meta.spanEnd}</span>
        <span>生成 {meta.generatedAt.slice(0, 10)}</span>
      </footer>
    </div>
  );
}

const TYPE_COLOR: Record<string, string> = {
  feat: "#2f6fd0",
  fix: "#c8443c",
  refactor: "#7a52b8",
  perf: "#0f9b8e",
  docs: "#4a8fb5",
  test: "#c79a1e",
  ci: "#6b7280",
  chore: "#8d949e",
  style: "#b08968",
  build: "#7c6f64",
  revert: "#a13b3b",
  release: "#d4a017",
  merge: "#9aa4b2",
  other: "#5b6472",
};
