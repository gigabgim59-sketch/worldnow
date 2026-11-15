import fs from 'node:fs/promises';
import { getFeed, translate, googleBatch } from './news-lib.mjs';
const root=new URL('../',import.meta.url);
const read=async p=>{try{return JSON.parse(await fs.readFile(new URL(p,root),'utf8'));}catch{return null;}};
const write=async(p,j)=>fs.writeFile(new URL(p,root),JSON.stringify(j,null,2));
await fs.mkdir(new URL('public/data/',root),{recursive:true});await fs.mkdir(new URL('.cache/',root),{recursive:true});
const sources=await read('sources.json');
let previous=await read('.cache/news-last-good.json')||await read('public/data/news.json');
if(process.env.PREVIOUS_DATA_URL){try{const r=await fetch(process.env.PREVIOUS_DATA_URL,{signal:AbortSignal.timeout(8000)});if(r.ok){const p=await r.json();if(p.feeds?.length&&(!previous||new Date(p.generatedAt)>new Date(previous.generatedAt)))previous=p;}}catch{}}
const oldFeeds=new Map((previous?.feeds||[]).map(f=>[f.source.id,f]));const feeds=[];let cursor=0;let successful=0;
async function collector(){while(cursor<sources.length){const i=cursor++;const s=sources[i];const fresh=await getFeed(s);const old=oldFeeds.get(s.id);if(fresh.status==='ok'&&fresh.items.length){successful++;feeds[i]=fresh;}else if(old?.items?.length){feeds[i]={...old,source:s,status:'stale',lastAttemptAt:fresh.fetchedAt,error:'이번 수집에 실패해 마지막 성공본을 표시합니다.'};}else{feeds[i]=fresh;}console.log(s.id+': '+feeds[i].status+' ('+feeds[i].items.length+')');}}
await Promise.all([collector(),collector(),collector(),collector()]);
if(!successful){console.error('모든 수집이 실패했습니다. 기존 게시본을 유지하고 배포하지 않습니다.');process.exit(1);}
const cached=await read('.cache/translations.json')||{};const day=new Date().toISOString().slice(0,10);let usage=await read('.cache/translation-usage.json');if(usage?.day!==day)usage={day,characters:0};
const budget=Math.max(0,Number(process.env.TRANSLATION_BUDGET??4000));let stopped=false;const jobs=[];
for(let n=0;n<8;n++)for(const f of feeds){const a=f.items[n];if(a)jobs.push([f,a]);}
// 1) 캐시 재사용
const todo=[];
for(const [f,a] of jobs){const key=f.source.lang+':'+a.title;if(a.titleKo&&!cached[key])cached[key]=a.titleKo;if(cached[key]){a.titleKo=cached[key];continue;}todo.push([f,a,key]);}
console.log('새로 번역할 제목: '+todo.length);
// 2) 1순위: DeepL 키가 있으면 DeepL, 없으면 Google 무료 번역(묶음)
const ko=s=>s&&/[가-힣]/.test(s);
if(!process.env.DEEPL_API_KEY){
  for(let i=0;i<todo.length;i+=25){
    const chunk=todo.slice(i,i+25);
    const res=await googleBatch(chunk.map(([,a])=>a.title));
    if(!res){console.warn('Google 번역 실패: 남은 제목은 예비 번역기로 넘깁니다.');break;}
    chunk.forEach(([,a,key],n)=>{if(ko(res[n])){a.titleKo=res[n];cached[key]=res[n];}});
    await new Promise(r=>setTimeout(r,400));
  }
}
// 3) 남은 제목: DeepL(키 있을 때) 또는 MyMemory(일일 한도 안에서)
for(const [f,a,key] of todo){if(a.titleKo)continue;if(stopped||!budget||new TextEncoder().encode(a.title).length>500)continue;if(!process.env.DEEPL_API_KEY&&usage.characters+a.title.length>budget)continue;
try{usage.characters+=a.title.length;const r=await translate(a.title,f.source.lang,process.env);a.titleKo=r.translated;cached[key]=r.translated;}catch(e){console.warn('예비 번역 중단: '+e.message);stopped=true;}}
const result={schemaVersion:1,generatedAt:new Date().toISOString(),feeds,collector:{successful,total:sources.length,translated:feeds.reduce((n,f)=>n+f.items.filter(a=>a.titleKo).length,0)}};
await write('public/data/news.json',result);await fs.writeFile(new URL('public/data/news.js',root),'window.WORLD_NEWS='+JSON.stringify(result).replace(/</g,'\\u003c')+';\n');await write('.cache/news-last-good.json',result);
const keys=Object.keys(cached);for(const k of keys.slice(0,Math.max(0,keys.length-2000)))delete cached[k];await write('.cache/translations.json',cached);await write('.cache/translation-usage.json',usage);console.log(JSON.stringify(result.collector));
