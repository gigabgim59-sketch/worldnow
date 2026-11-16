// 브리핑 JSON 검사: node scripts/brief-check.mjs public/briefing/2026-11-16.json
import fs from 'node:fs';import assert from 'node:assert/strict';
const f=process.argv[2];const B=JSON.parse(fs.readFileSync(f,'utf8'));
const S=new Map(JSON.parse(fs.readFileSync('sources.json','utf8')).map(s=>[s.id,s]));
const ORDER=['us','cn','uk','ru','fr','me','in'];
assert.match(B.date,/^\d{4}-\d{2}-\d{2}$/);assert(f.endsWith(B.date+'.json'),'파일명과 date 불일치');
assert(Array.isArray(B.headline)&&B.headline.length===3,'headline 3줄');
assert.deepEqual(B.countries.map(c=>c.id),ORDER,'나라 순서');
for(const x of B.headline)assert(typeof x==='string'&&x.length<=60,'headline은 한 문장(60자 이내): '+x);
if(B.headlineDetail){assert(Array.isArray(B.headlineDetail)&&B.headlineDetail.length===3,'headlineDetail은 headline과 같은 3개');
 for(const d of B.headlineDetail){assert(Array.isArray(d.keys)&&d.keys.length>=2&&d.keys.length<=4,'keys 2~4개');
  assert(d.desc&&d.desc.length<=110,'desc 한 문장(110자 이내)');
  assert(Array.isArray(d.items)&&d.items.length>=2&&d.items.length<=4,'items 2~4줄');
  for(const it of d.items){assert(ORDER.includes(it.c),'items.c는 나라 id: '+it.c);assert(it.t&&it.t.length<=40,'items.t 40자 이내: '+it.t);}}}
for(const c of B.countries){assert(c.issues.length>=1&&c.issues.length<=3,c.id+' 이슈 1~3개');
 for(const it of c.issues){assert(it.title&&it.what,'title/what');
  if(it.keys)assert(Array.isArray(it.keys)&&it.keys.length>=2&&it.keys.length<=4&&it.keys.every(k=>typeof k==='string'&&k.length<=12),'이슈 keys 2~4개(각 12자 이내): '+it.title);
  for(const s of it.stances){assert(S.has(s.source),'모르는 매체 '+s.source);assert.equal(S.get(s.source).country,c.id,s.source+' 나라 불일치');assert(s.text);}
  for(const l of it.links||[]){assert(S.has(l.source));assert(/^https:\/\//.test(l.url));assert(l.title);}}}
const idx=JSON.parse(fs.readFileSync('public/briefing/index.json','utf8'));assert(idx.dates.includes(B.date),'index.json에 날짜 없음');
console.log('브리핑 검사 통과: '+B.date+' · 이슈 '+B.countries.reduce((n,c)=>n+c.issues.length,0)+'개');
