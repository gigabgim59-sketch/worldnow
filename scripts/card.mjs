// 카톡 링크 미리보기용 '오늘의 세계 3줄' 그림을 만들고, 배포할 index.html의 미리보기(og) 정보를 그날 것으로 바꾼다.
// GitHub Actions에서 collect.mjs 다음에 실행한다. 크롬이 없으면 경고만 남기고 넘어간다.
// 사용: node scripts/card.mjs [--og]   (--og: public/index.html의 미리보기 태그를 고침. 배포 직전에만 사용)
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';

const root = new URL('../', import.meta.url);
const p = rel => new URL(rel, root);
const SITE = 'https://gigabgim59-sketch.github.io/worldnow/';
const read = async rel => {try {return JSON.parse(await fs.readFile(p(rel), 'utf8'));} catch {return null;}};
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

const idx = await read('public/briefing/index.json');
const date = idx?.dates?.[0];
const B = date && await read('public/briefing/' + date + '.json');
if (!B?.headline?.length) {console.log('미리보기 그림: 브리핑 없음 → 건너뜀'); process.exit(0);}

const [y, m, d] = date.split('-').map(Number);
const wd = '일월화수목금토'[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
const label = m + '월 ' + d + '일(' + wd + ') 아침';
const X = Array.isArray(B.headlineDetail) ? B.headlineDetail : [];

// ── 그림 ──
const rows = B.headline.map((h, i) => {
  const x = X[i] || {};
  const badge = x.status === 'new' ? '<span class="bd new">新</span>' : x.status === 'cont' ? '<span class="bd cont">이어짐</span>' : '';
  const sub = x.status === 'cont' && x.change ? '오늘: ' + x.change : (x.keys || []).join(' · ');
  return '<div class="r"><div class="n">' + (i + 1) + '</div><div><div class="t">' + badge + esc(h) + '</div>' + (sub ? '<div class="s">' + esc(sub) + '</div>' : '') + '</div></div>';
}).join('');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#f4f6f3;font-family:"Pretendard Variable",Pretendard,"Noto Sans CJK KR","Noto Sans KR","Apple SD Gothic Neo",sans-serif;color:#1d2622}
.c{position:absolute;inset:0;padding:40px 56px;display:flex;flex-direction:column}
.top{display:flex;align-items:center;gap:14px}.m{width:52px;height:52px;border-radius:14px;background:#128353;color:#fff;font-weight:900;font-size:30px;display:flex;align-items:center;justify-content:center}
.top b{font-size:30px;font-weight:900}.top span{font-size:23px;color:#5f6a65;margin-left:auto;font-weight:700}
h2{margin:22px 0 8px;font-size:22px;color:#128353;letter-spacing:.04em}
.r{display:grid;grid-template-columns:44px 1fr;gap:4px;padding:14px 0;border-top:2px solid #dfe7e1}.r:first-of-type{border-top:0}
.n{font-size:32px;font-weight:900;color:#128353;line-height:1.3}.t{font-size:31px;font-weight:800;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bd{display:inline-block;font-size:21px;font-weight:900;border-radius:8px;padding:2px 9px;margin-right:10px;vertical-align:5px}.new{background:#128353;color:#fff}.cont{color:#5f6a65;box-shadow:inset 0 0 0 2px #c9d3cd;background:#fff}
.s{font-size:21px;color:#a86a12;margin-top:5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.f{margin-top:auto;font-size:20px;color:#76827c}</style></head><body><div class="c">
<div class="top"><div class="m">W</div><b>세계의 오늘</b><span>${esc(label)}</span></div>
<h2>오늘의 세계 3줄</h2>${rows}
<div class="f">7개국과 중동 · 진영별 시각과 나라별 이슈는 링크에서</div></div></body></html>`;

const hash = crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
const png = 'public/briefing/card-' + date + '.png';
const state = await read('data/card-state.json') || {};
let ok = existsSync(p(png)) && state.date === date && state.hash === hash;
if (!ok) {
  const chrome = [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)
    .find(b => {try {execFileSync('which', [b], {stdio: 'ignore'}); return true;} catch {return false;}});
  if (!chrome) console.warn('미리보기 그림: 크롬 없음 → 건너뜀');
  else {
    // 한글 글꼴이 없으면(깃허브 서버) 그림을 새로 만들 때만 설치한다. 웹글꼴(Pretendard)을 못 받아도 글자가 깨지지 않게.
    try {if (!execFileSync('fc-list', [':lang=ko'], {encoding: 'utf8'}).trim() && process.env.CI) {console.log('한글 글꼴 설치');
      execFileSync('bash', ['-c', 'sudo apt-get update -qq && sudo apt-get install -y -qq fonts-noto-cjk >/dev/null'], {stdio: 'inherit', timeout: 240000});}} catch (e) {console.warn('글꼴 확인 실패: ' + e.message);}
    const tmp = '/tmp/worldnow-card.html';
    await fs.writeFile(tmp, html);
    try {
      execFileSync(chrome, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--disable-gpu', '--force-device-scale-factor=1',
        '--virtual-time-budget=6000', '--window-size=1200,630', '--screenshot=' + new URL(png, root).pathname, 'file://' + tmp], {stdio: 'ignore', timeout: 60000});
      ok = existsSync(p(png));
      if (ok) {await fs.writeFile(p('data/card-state.json'), JSON.stringify({date, hash}) + '\n'); console.log('미리보기 그림: ' + png);}
    } catch (e) {console.warn('미리보기 그림 실패: ' + e.message);}
  }
} else console.log('미리보기 그림: 그대로 (' + png + ')');

// 2주 지난 그림 정리
for (const f of await fs.readdir(p('public/briefing/'))) {
  const mm = f.match(/^card-(\d{4}-\d{2}-\d{2})\.png$/);
  if (mm && mm[1] < new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10)) await fs.rm(p('public/briefing/' + f));
}

// ── 배포할 index.html의 미리보기 태그를 그날 것으로 ──
if (ok && process.argv.includes('--og')) {
  const img = SITE + 'briefing/card-' + date + '.png';
  const url = SITE + '?d=' + date;
  const title = '세계의 오늘 · ' + label + ' 3줄';
  const desc = B.headline.map((h, i) => (i + 1) + '. ' + h).join(' ');
  let s = await fs.readFile(p('public/index.html'), 'utf8');
  const set = (re, val) => {s = s.replace(re, (all, a, b) => a + esc(val) + b);};
  set(/(<meta property="og:image" content=")[^"]*(")/, img);
  set(/(<meta name="twitter:image" content=")[^"]*(")/, img);
  set(/(<meta property="og:image:width" content=")[^"]*(")/, '1200');
  set(/(<meta property="og:image:height" content=")[^"]*(")/, '630');
  set(/(<meta property="og:image:alt" content=")[^"]*(")/, title);
  set(/(<meta property="og:url" content=")[^"]*(")/, url);
  set(/(<meta property="og:title" content=")[^"]*(")/, title);
  set(/(<meta name="twitter:title" content=")[^"]*(")/, title);
  set(/(<meta property="og:description" content=")[^"]*(")/, desc);
  set(/(<meta name="twitter:description" content=")[^"]*(")/, desc);
  await fs.writeFile(p('public/index.html'), s);
  console.log('미리보기 태그: ' + url);
}
