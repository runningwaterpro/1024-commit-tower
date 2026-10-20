#!/usr/bin/env node
/**
 * 1024 Commit Tower — data pipeline (final)
 *
 * Produces the tower layer data + account bookkeeping used by the web app.
 *
 * Modes
 *   node scripts/fetch-tower-data.mjs account <login> [maxLayers]
 *       -> public/data/<login>.json
 *          layers = ONLY commits authored by the account owner (author email match)
 *          meta   = account bookkeeping (repo count, total commits incl. upstream, own commits…)
 *
 *   node scripts/fetch-tower-data.mjs repo <owner/repo> [maxLayers]
 *       -> public/data/repo__<owner>__<repo>.json
 *          layers = all commits of the repo (own = bright, upstream = dim)
 *
 * Every layer carries real diff stats (additions / deletions / files) pulled from
 * GET /repos/{o}/{r}/commits/{sha}.
 *
 * Env: GITHUB_TOKEN | GH_TOKEN
 * Note: on machines with a TLS-intercepting proxy use `node --use-system-ca`.
 */

import fs from "node:fs";
import path from "node:path";

const MODE = process.argv[2] || "account";
const TARGET = process.argv[3] || "runningwaterpro";
const MAX_LAYERS = Number(process.argv[4] || 1024);
const OWN_EMAILS = (process.env.OWN_EMAILS || "runningwaterpro@gmail.com,runningwaterpro@users.noreply.github.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const API = "https://api.github.com";
const OUT_DIR = path.resolve("public/data");

if (!TOKEN) { console.error("Missing GITHUB_TOKEN / GH_TOKEN"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p) {
  for (let a = 0; a < 5; a++) {
    const res = await fetch(`${API}${p}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get("x-ratelimit-reset") || 0) * 1000;
      await sleep(Math.max(3000, reset - Date.now() + 2000));
      continue;
    }
    if (res.status === 404 || res.status === 409 || res.status === 451) return null; // missing / empty / takedown
    if (!res.ok) throw new Error(`${res.status} ${p}`);
    return { json: await res.json(), link: res.headers.get("link") || "" };
  }
  throw new Error("rate limit: " + p);
}
const lastPage = (link) => { const m = link.match(/[?&]page=(\d+)>; rel="last"/); return m ? Number(m[1]) : null; };

/* ---------------- classification ---------------- */
const TYPE_RULES = [
  ["feat",     /^feat(\([^)]*\))?!?:/i,     "#2f6fd0"],
  ["fix",      /^fix(\([^)]*\))?!?:/i,      "#c8443c"],
  ["refactor", /^refactor(\([^)]*\))?!?:/i, "#7a52b8"],
  ["perf",     /^perf(\([^)]*\))?!?:/i,     "#0f9b8e"],
  ["docs",     /^docs(\([^)]*\))?!?:/i,     "#4a8fb5"],
  ["test",     /^test(\([^)]*\))?!?:/i,     "#c79a1e"],
  ["ci",       /^ci(\([^)]*\))?!?:/i,       "#6b7280"],
  ["chore",    /^chore(\([^)]*\))?!?:/i,    "#8d949e"],
  ["style",    /^style(\([^)]*\))?!?:/i,    "#b08968"],
  ["build",    /^build(\([^)]*\))?!?:/i,    "#7c6f64"],
  ["revert",   /^revert(\([^)]*\))?!?:/i,   "#a13b3b"],
  ["release",  /^release(\([^)]*\))?!?:/i,  "#d4a017"],
];
const CN_RULES = [
  ["feat",     /(新增|添加|实现|支持|加入|完成)/],
  ["fix",      /(修复|修正|解决|bug|BUG|报错|崩溃|闪退|乱码|死锁|卡死|未定义)/],
  ["refactor", /(重构|清理|整理|拆分|移除)/],
  ["perf",     /(优化|提速|性能)/],
  ["docs",     /(文档|README|说明)/],
  ["test",     /(测试|用例)/],
];
function classify(msg) {
  const first = String(msg).split("\n")[0].trim();
  for (const [type, re, color] of TYPE_RULES) {
    const m = first.match(re);
    if (m) return { type, color, prefix: m[0] };
  }
  for (const [type, re] of CN_RULES) {
    if (re.test(first)) return { type, color: TYPE_RULES.find((t) => t[0] === type)[2], prefix: "" };
  }
  if (/^Merge (pull request|branch)/i.test(first)) return { type: "merge", color: "#9aa4b2", prefix: "merge" };
  return { type: "other", color: "#5b6472", prefix: "" };
}

/* ---------------- time (UTC+8) ---------------- */
const TZ = 8;
function localParts(iso) {
  const d = new Date(new Date(iso).getTime() + TZ * 3600 * 1000);
  return {
    localDate: d.toISOString().slice(0, 10),
    localHour: d.getUTCHours(),
    weekday: d.getUTCDay(),
  };
}
const isOwn = (c) => {
  const em = (c.commit.author?.email || "").toLowerCase();
  const nm = (c.commit.author?.name || "").toLowerCase();
  return OWN_EMAILS.includes(em) || OWN_EMAILS.includes(nm);
};

function toLayer(c, repo, fork) {
  const cls = classify(c.commit.message || "");
  const lp = localParts(c.commit.author.date);
  return {
    sha: c.sha,
    repo,
    repoShort: repo.split("/").pop(),
    fork,
    message: (c.commit.message || "").split("\n")[0].slice(0, 180),
    body: (c.commit.message || "").slice(0, 600),
    author: c.commit.author?.name || "",
    authorEmail: c.commit.author?.email || "",
    date: c.commit.author.date,
    localDate: lp.localDate,
    localHour: lp.localHour,
    night: lp.localHour >= 1 && lp.localHour <= 4,
    weekend: lp.weekday === 0 || lp.weekday === 6,
    own: isOwn(c),
    type: cls.type,
    color: cls.color,
    prefix: cls.prefix,
    additions: 0, deletions: 0, files: 0,
  };
}

async function fetchStats(layers) {
  let done = 0;
  for (const L of layers) {
    const r = await api(`/repos/${L.repo}/commits/${L.sha}`);
    if (r) {
      L.additions = r.json.stats?.additions ?? 0;
      L.deletions = r.json.stats?.deletions ?? 0;
      L.files = r.json.files?.length ?? 0;
    }
    if (++done % 150 === 0) console.log(`    stats ${done}/${layers.length}`);
  }
}

function summarize(layers) {
  const typeCount = {}, repoCount = {}, byDate = {}, byHour = {};
  let night = 0, weekend = 0, lines = 0, own = 0;
  for (const L of layers) {
    typeCount[L.type] = (typeCount[L.type] || 0) + 1;
    repoCount[L.repoShort] = (repoCount[L.repoShort] || 0) + 1;
    byDate[L.localDate] = (byDate[L.localDate] || 0) + 1;
    byHour[L.localHour] = (byHour[L.localHour] || 0) + 1;
    if (L.night) night++;
    if (L.weekend) weekend++;
    if (L.own) own++;
    lines += L.additions + L.deletions;
  }
  const busiest = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const biggest = [...layers].sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions)).slice(0, 5);
  const bigSet = new Set(biggest.map((b) => b.sha));
  layers.forEach((L, i) => { L.seq = i + 1; L.big = bigSet.has(L.sha); L.creature = i === 0; });
  return {
    typeCount, repoCount, byDate, byHour,
    nightCount: night, weekendCount: weekend,
    ownCount: own, totalLinesChanged: lines,
    busiestDate: busiest[0], busiestDateCount: busiest[1],
    biggestCommits: biggest.map((b) => ({ sha: b.sha, repo: b.repoShort, message: b.message, additions: b.additions, deletions: b.deletions, date: b.localDate })),
    topRepos: Object.entries(repoCount).sort((a, b) => b[1] - a[1]).slice(0, 12),
  };
}

/* ---------------- modes ---------------- */

async function buildAccount(login) {
  const u = (await api(`/users/${login}`)).json;
  console.log(`account ${u.login} · ${u.public_repos} repos · joined ${u.created_at.slice(0, 10)}`);

  const repos = [];
  for (let p = 1; p <= 5; p++) {
    const r = await api(`/users/${login}/repos?per_page=100&page=${p}&sort=pushed`);
    if (!r || !r.json.length) break;
    repos.push(...r.json);
  }

  const own = [];
  const book = [];
  let totalAll = 0;

  for (const rp of repos) {
    const head = await api(`/repos/${rp.full_name}/commits?per_page=1`);
    if (!head) { book.push({ name: rp.full_name, total: 0, own: 0, fork: rp.fork, skipped: true }); continue; }
    const total = lastPage(head.link) || 1;
    totalAll += total;

    let repoOwn = 0, stale = 0, stop = false;
    for (let page = 1; page <= 40 && !stop; page++) {
      const r = await api(`/repos/${rp.full_name}/commits?per_page=100&page=${page}`);
      if (!r || !r.json.length) break;
      for (const c of r.json) {
        if (isOwn(c)) { own.push(toLayer(c, rp.full_name, !!rp.fork)); repoOwn++; stale = 0; }
        else { stale++; if (stale >= 120) { stop = true; break; } }
      }
      if (r.json.length < 100) break;
    }
    book.push({ name: rp.full_name, total, own: repoOwn, fork: !!rp.fork });
    console.log(`  ${rp.full_name.padEnd(50)} total=${String(total).padStart(6)} own=${String(repoOwn).padStart(4)} ${rp.fork ? "fork" : "ORIGIN"}`);
  }

  own.sort((a, b) => new Date(a.date) - new Date(b.date));
  const layers = own.slice(-MAX_LAYERS);
  console.log(`\nown commits: ${own.length} -> layers ${layers.length}`);
  console.log("fetching stats ...");
  await fetchStats(layers);

  const stats = summarize(layers);
  const payload = {
    meta: {
      kind: "account",
      login: u.login,
      name: u.name,
      avatar: u.avatar_url,
      profile: u.html_url,
      accountCreated: u.created_at.slice(0, 10),
      publicRepos: u.public_repos,
      repoCount: repos.length,
      totalCommitsAllRepos: totalAll,
      ownCommitsTotal: own.length,
      generatedAt: new Date().toISOString(),
      layerCount: layers.length,
      spanStart: layers[0]?.localDate ?? null,
      spanEnd: layers[layers.length - 1]?.localDate ?? null,
      ownRatio: own.length / Math.max(1, totalAll),
      limitMark: 1024,
    },
    stats,
    layers,
    repoBook: book.filter((b) => !b.skipped).sort((a, b) => b.own - a.own),
  };
  const file = path.join(OUT_DIR, `${login}.json`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 1));
  console.log(`\nWROTE ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
  console.log(`  total(all repos)=${totalAll}  own=${own.length}  ratio=${(own.length / totalAll * 100).toFixed(2)}%`);
  console.log(`  span ${payload.meta.spanStart} -> ${payload.meta.spanEnd}`);
  console.log(`  types ${JSON.stringify(stats.typeCount)}`);
  console.log(`  busiest ${stats.busiestDate} x${stats.busiestDateCount} | night=${stats.nightCount} weekend=${stats.weekendCount}`);
  console.log(`  lines changed ${stats.totalLinesChanged}`);
  console.log(`  topRepos ${JSON.stringify(stats.topRepos.slice(0, 5))}`);
  return payload;
}

async function buildRepo(full) {
  const [owner, repo] = full.split("/");
  const meta0 = (await api(`/repos/${owner}/${repo}`)).json;
  const head = await api(`/repos/${owner}/${repo}/commits?per_page=1`);
  const total = lastPage(head.link) || 1;
  console.log(`repo ${full} · total=${total} · fork=${!!meta0.fork}`);

  const all = [];
  for (let page = 1; page <= 60; page++) {
    const r = await api(`/repos/${owner}/${repo}/commits?per_page=100&page=${page}`);
    if (!r || !r.json.length) break;
    for (const c of r.json) all.push(toLayer(c, full, !!meta0.fork));
    if (all.length >= MAX_LAYERS) break;
    if (r.json.length < 100) break;
  }
  all.sort((a, b) => new Date(a.date) - new Date(b.date));
  const layers = all.slice(-MAX_LAYERS);
  console.log(`layers ${layers.length} (own ${layers.filter((l) => l.own).length})`);
  console.log("fetching stats ...");
  await fetchStats(layers);

  const stats = summarize(layers);
  const payload = {
    meta: {
      kind: "repo",
      login: owner,
      repo: repo,
      full: full,
      description: meta0.description || "",
      htmlUrl: meta0.html_url,
      fork: !!meta0.fork,
      parent: meta0.parent?.full_name || null,
      totalCommits: total,
      generatedAt: new Date().toISOString(),
      layerCount: layers.length,
      spanStart: layers[0]?.localDate ?? null,
      spanEnd: layers[layers.length - 1]?.localDate ?? null,
      limitMark: 1024,
    },
    stats,
    layers,
  };
  const file = path.join(OUT_DIR, `repo__${owner}__${repo}.json`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 1));
  console.log(`WROTE ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
  console.log(`  span ${payload.meta.spanStart} -> ${payload.meta.spanEnd}`);
  console.log(`  types ${JSON.stringify(stats.typeCount)}`);
  console.log(`  own ${payload.stats.ownCount}/${layers.length}`);
  return payload;
}

const t0 = Date.now();
try {
  if (MODE === "account") await buildAccount(TARGET);
  else if (MODE === "repo") await buildRepo(TARGET);
  else throw new Error("mode must be 'account' or 'repo'");
  console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
}
