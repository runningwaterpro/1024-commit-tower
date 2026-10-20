import fs from "node:fs";
const TOKEN = process.env.GITHUB_TOKEN;
const LOGIN = process.argv[2] || "runningwaterpro";
const H = { Accept: "application/vnd.github+json", Authorization: `Bearer ${TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p) {
  for (let a = 0; a < 4; a++) {
    const r = await fetch(`https://api.github.com${p}`, { headers: H });
    if (r.status === 403 || r.status === 429) { const w = Number(r.headers.get("x-ratelimit-reset") || 0) * 1000; await sleep(Math.max(3000, w - Date.now() + 2000)); continue; }
    if (r.status === 404 || r.status === 409 || r.status === 451) return { skip: r.status };
    if (!r.ok) return { err: r.status };
    return { json: await r.json(), link: r.headers.get("link") || "" };
  }
  return { err: "rate" };
}
const lastOf = (l) => { const m = l.match(/[?&]page=(\d+)>; rel="last"/); return m ? Number(m[1]) : null; };

const repos = (await api(`/users/${LOGIN}/repos?per_page=100&sort=pushed`)).json || [];
let grand = { total: 0, own: 0, ownRepos: 0 };
const rows = [];
for (const rp of repos) {
  const first = await api(`/repos/${rp.full_name}/commits?per_page=1`);
  if (first.skip || first.err) { rows.push({ name: rp.full_name, note: `skip ${first.skip || first.err}` }); continue; }
  const total = lastOf(first.link) || 1;
  let own = 0, scanned = 0, stale = 0, stop = false;
  for (let page = 1; page <= 60 && !stop; page++) {
    const r = await api(`/repos/${rp.full_name}/commits?per_page=100&page=${page}`);
    if (!r.json) break;
    scanned += r.json.length;
    for (const c of r.json) {
      const em = (c.commit.author?.email || "").toLowerCase();
      if (em === "runningwaterpro@gmail.com" || em === "runningwaterpro@users.noreply.github.com") { own++; stale = 0; }
      else { stale++; if (stale >= 120) { stop = true; break; } }
    }
    if (r.json.length < 100) break;
  }
  grand.total += total; grand.own += own;
  if (own > 0) grand.ownRepos++;
  rows.push({ name: rp.full_name, total, own, scanned, fork: rp.fork });
  console.log(`${rp.full_name.padEnd(50)} total=${String(total).padStart(5)} own=${String(own).padStart(4)} scanned=${scanned} ${rp.fork ? "(fork)" : "(ORIGIN)"}`);
}
console.log("\n=== SUMMARY ===");
console.log(`repos=${repos.length} reposWithOwnCommits=${grand.ownRepos}`);
console.log(`TOTAL commits (all repos, incl upstream) = ${grand.total}`);
console.log(`OWN commits (author=runningwaterpro)      = ${grand.own}`);
fs.writeFileSync("scan-summary.json", JSON.stringify({ grand, rows }, null, 2));
