// 브리핑 JSON 검사: node scripts/brief-check.mjs public/briefing/2026-11-16.json
import fs from 'node:fs';import assert from 'node:assert/strict';
const f=process.argv[2];const B=JSON.parse(fs.readFileSync(f,'utf8'));
const S=new Map(JSON.parse(fs.readFileSync('sources.json','utf8')).map(s=>[s.id,s]));
const ORDER=['us','cn','uk','ru','fr','me','in'];
assert.match(B.date,/^\d{4}-\d{2}-\d{2}$/);assert(f.endsWith(B.date+'.json'),'파일명과 date 불일치');
assert(Array.isArray(B.headline)&&B.headline.length===3,'headline 3줄');
assert.deepEqual(B.countries.map(c=>c.id),ORDER,'나라 순서');
if(B.headlineMap){assert(Array.isArray(B.headlineMap)&&B.headlineMap.length===3,'headlineMap은 headline과 같은 3개');
 for(const m of B.headlineMap){assert(m.what&&m.what.length<=40,'흐름 what(40자 이내) 필요');
  assert(Array.isArray(m.keys)&&m.keys.length>=2&&m.keys.length<=4,'keys 2~4개');
  if(m.why)assert(m.why.length<=40,'why 40자 이내');
  assert(Array.isArray(m.react)&&m.react.length>=1&&m.react.length<=4,'react 1~4개');for(const r of m.react)assert(r.who&&r.text&&r.text.length<=40,'react who/text(40자 이내)');
  for(const [c,i] of m.refs||[]){const C=B.countries.find(x=>x.id===c);assert(C&&C.issues[i],'refs가 없는 이슈를 가리킴: '+c+' '+i);}}}
for(const c of B.countries){assert(c.issues.length>=1&&c.issues.length<=3,c.id+' 이슈 1~3개');
 for(const it of c.issues){assert(it.title&&it.what,'title/what');
  for(const s of it.stances){assert(S.has(s.source),'모르는 매체 '+s.source);assert.equal(S.get(s.source).country,c.id,s.source+' 나라 불일치');assert(s.text);}
  for(const l of it.links||[]){assert(S.has(l.source));assert(/^https:\/\//.test(l.url));assert(l.title);}}}
const idx=JSON.parse(fs.readFileSync('public/briefing/index.json','utf8'));assert(idx.dates.includes(B.date),'index.json에 날짜 없음');
console.log('브리핑 검사 통과: '+B.date+' · 이슈 '+B.countries.reduce((n,c)=>n+c.issues.length,0)+'개');
