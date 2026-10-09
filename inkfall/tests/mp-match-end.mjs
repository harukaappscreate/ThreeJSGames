// 2 タブで試合の最後(アウトロ)まで進むかのテスト(にせ Wavedash SDK)
//   1) cd inkfall && python3 -m http.server 8766
//   2) node tests/mp-match-end.mjs turf   (または tag)
import { chromium } from 'playwright';
const mode = process.argv[2] || 'turf';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
await ctx.addInitScript(() => localStorage.setItem('inkfall.settings.v1', JSON.stringify({ quality: 'low', language: 'ja', seenIntro: true })));
const errs = [];
const mk = async (n) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${n}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load/.test(m.text())) errs.push(`${n} console: ${m.text().slice(0, 200)}`); });
  await p.goto(`http://localhost:8766/index.html?fakesdk=${n}&autostart=1`);
  await p.waitForFunction(() => window.__inkfall?.manager.currentName === 'title', null, { timeout: 60000 });
  await p.evaluate(() => __inkfall.manager.go('lobby'));
  await p.waitForFunction(() => __inkfall.manager.currentName === 'lobby');
  return p;
};
const A = await mk('alice'), B = await mk('bob');
await A.evaluate((m) => __inkfall.net.create(m), mode);
await B.waitForTimeout(1500);
const [id] = await B.evaluate(() => __inkfall.net.refreshList().then((l) => l.map((x) => x.id)));
await B.evaluate((id) => __inkfall.net.join(id), id);
await B.waitForFunction(() => __inkfall.net.roster.some((r) => r.id === __inkfall.net.selfId), null, { timeout: 15000 });
await B.evaluate(() => __inkfall.net.setReady(true));
await A.waitForFunction(() => { const b = document.querySelector('.big-start'); return b && !b.disabled; }, null, { timeout: 15000 });
await A.evaluate(() => document.querySelector('.big-start').click());
await B.waitForFunction(() => __inkfall.manager.currentName === 'match', null, { timeout: 20000 });
const t0 = Date.now();
let endSize = null;
while (Date.now() - t0 < 240000) {
  const st = await A.evaluate(() => {
    const mgr = __inkfall.manager, s = mgr.current;
    if (mgr.currentName === 'match' && s.match && ['play'].includes(s.match.phase)) for (let i = 0; i < 120; i++) { s.update(1 / 30); if (s.match.phase !== 'play') break; }
    if (mgr.currentName === 'match' && s.match?.phase === 'end' && !window.__sz) window.__sz = JSON.stringify({ k: 'end', results: s.match.results() }).length;
    return { a: mgr.currentName, ph: s.match?.phase, sz: window.__sz };
  });
  endSize = st.sz ?? endSize;
  const b = await B.evaluate(() => ({ b: __inkfall.manager.currentName, ph: __inkfall.manager.current.match?.phase }));
  if (st.a === 'outro' && b.b === 'outro') { console.log(`${mode}: both reached outro in ${((Date.now() - t0) / 1000).toFixed(0)}s, end msg ${endSize}B`); break; }
  await A.waitForTimeout(400);
}
const fin = [await A.evaluate(() => __inkfall.manager.currentName), await B.evaluate(() => __inkfall.manager.currentName)];
console.log('final', fin.join(' / '));
console.log(errs.join('\n') || 'no errors');
await browser.close();
