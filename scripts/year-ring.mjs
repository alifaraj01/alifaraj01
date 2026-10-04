// Draws assets/year-ring-dark.svg and assets/year-ring-light.svg from the contribution calendar.
import { mkdir, writeFile } from "node:fs/promises";

const LOGIN = process.env.LOGIN || "alifaraj01";
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) throw new Error("GITHUB_TOKEN is not set");

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar { weeks { contributionDays { date contributionCount } } }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { authorization: `bearer ${TOKEN}`, "content-type": "application/json" },
  body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(`GitHub answered ${res.status}: ${JSON.stringify(json.errors || json)}`);
const year = json.data.user.contributionsCollection.contributionCalendar.weeks
  .flatMap((w) => w.contributionDays).map((d) => ({ date: d.date, count: d.contributionCount })).slice(-365);
const peak = Math.max(1, ...year.map((d) => d.count));

const THEMES = {
  dark: { ink: "#e6edf3", muted: "#8b949e", faint: "#30363d", low: "#1f6feb", high: "#c297ff", glow: "#a371f7", glowOpacity: ".14" },
  light: { ink: "#1f2328", muted: "#59636e", faint: "#d1d9e0", low: "#0969da", high: "#8250df", glow: "#8250df", glowOpacity: ".06" },
};
const W = 520, H = 440, CX = 260, CY = 220, R0 = 72, LEN = 100;
const GAP = 22; // degrees left open at the top, between 12 months ago and today
const RG = R0 + LEN + 6; // the dotted guide ring that carries the month marks
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const mix = (a, b, t) => "#" + hex(a).map((v, k) => Math.round(v + (hex(b)[k] - v) * t).toString(16).padStart(2, "0")).join("");
const pt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)].map((v) => v.toFixed(1)); };

function svg(t) {
  const step = (360 - GAP) / year.length;
  const spokes = year.map((d, k) => {
    const deg = GAP / 2 + k * step;
    if (d.count === 0) { const [x, y] = pt(R0 + 2, deg); return `<circle cx="${x}" cy="${y}" r="0.9" fill="${t.faint}"/>`; }
    const s = Math.log1p(d.count) / Math.log1p(peak); // a log scale keeps ordinary days visible next to the busiest one
    const [x1, y1] = pt(R0, deg), [x2, y2] = pt(R0 + 4 + s * LEN, deg);
    return `<line class="s" style="animation-delay:${(k * 2.2).toFixed(0)}ms" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${mix(t.low, t.high, s)}" stroke-width="1.7" stroke-linecap="round"/>`;
  }).join("");
  const months = year.map((d, k) => [d, k]).filter(([d, k]) => d.date.endsWith("-01") && k > 8 && k < year.length - 8).map(([d, k]) => {
    const deg = GAP / 2 + k * step, [x, y] = pt(RG + 13, deg), [tx1, ty1] = pt(RG - 3, deg), [tx2, ty2] = pt(RG + 3, deg);
    return `<line x1="${tx1}" y1="${ty1}" x2="${tx2}" y2="${ty2}" stroke="${t.muted}" stroke-width="1"/>` +
      `<text x="${x}" y="${y}" class="m" text-anchor="middle" dominant-baseline="middle">${MONTHS[+d.date.slice(5, 7) - 1]}</text>`;
  }).join("");
  const today = GAP / 2 + (year.length - 1) * step;
  const [dx, dy] = pt(RG, today), [lx, ly] = pt(RG + 14, today), [sx, sy] = pt(RG, GAP / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contributions over the last 12 months, one spoke per day">
<style>
  text{font-family:ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;fill:${t.ink}}
  .m{font-size:11px;fill:${t.muted};letter-spacing:.04em}
  .today{font-size:11px;font-weight:600;letter-spacing:.04em}
  .cap{font-size:12px;fill:${t.muted};letter-spacing:.08em}
  .s{animation:in .9s ease-out backwards}
  @keyframes in{from{opacity:0}}
  @media (prefers-reduced-motion:reduce){.s{animation:none}}
</style>
<defs><radialGradient id="g"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.glowOpacity}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient></defs>
<circle cx="${CX}" cy="${CY}" r="${R0 + LEN}" fill="url(#g)"/>
<circle cx="${CX}" cy="${CY}" r="${R0 - 10}" fill="none" stroke="${t.faint}"/>
<circle cx="${CX}" cy="${CY}" r="${RG}" fill="none" stroke="${t.faint}" stroke-dasharray="1 4"/>
${spokes}
${months}
<circle cx="${sx}" cy="${sy}" r="2" fill="${t.muted}"/>
<circle cx="${dx}" cy="${dy}" r="3.2" fill="${t.high}"/>
<text x="${lx}" y="${ly}" class="today" text-anchor="end" dominant-baseline="middle">today</text>
<text x="${CX}" y="${CY - 4}" class="cap" text-anchor="middle">THE LAST</text>
<text x="${CX}" y="${CY + 14}" class="cap" text-anchor="middle">12 MONTHS</text>
</svg>`;
}

await mkdir("assets", { recursive: true });
for (const [name, t] of Object.entries(THEMES)) await writeFile(`assets/year-ring-${name}.svg`, svg(t));
console.log(`drew ${year.length} days`);
