import fs from 'node:fs/promises';
import { getFeed, translate, googleBatch, claudeBatch, numbersOk } from './news-lib.mjs';
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
// 0) 번역 품질 검사: 한국어가 거의 없거나 원문 글자가 많이 남으면 실패로 봄
const LET=/[A-Za-zÀ-ÿ\u0400-\u04FF\u0600-\u06FF]/g, HAN=/[가-힣]/g;
function bad(ko,orig){
  if(!ko||!/[가-힣]/.test(ko))return true;
  const h=(ko.match(HAN)||[]).length, f=(ko.match(LET)||[]).length;
  if(/[\u0400-\u04FF]/.test(orig)&&(ko.match(/[\u0400-\u04FF]/g)||[]).length>=3)return true; // 러시아 글자 남음
  if(/[\u0600-\u06FF]/.test(orig)&&(ko.match(/[\u0600-\u06FF]/g)||[]).length>=3)return true; // 아랍 글자 남음
  if(/[\u0900-\u097F]/.test(orig)&&(ko.match(/[\u0900-\u097F]/g)||[]).length>=3)return true; // 힌디 글자 남음
  return f>h*1.5&&h<10; // 라틴 글자가 한글보다 훨씬 많으면 덜 번역된 것
}
const script=t=>/[\u0400-\u04FF]/.test(t)?'cyr':/[\u0600-\u06FF]/.test(t)?'ara':'lat';
// 검색 결과 페이지 등 기사 아닌 항목 제거
for(const f of feeds)f.items=(f.items||[]).filter(x=>!/^you searched for|search results? for/i.test(x.title));
// 1) 캐시 재사용 (품질이 나쁜 예전 번역은 버리고 다시 번역)
const todo=[];
for(const [f,a] of jobs){if(!f.items.includes(a))continue;const key=f.source.lang+':'+a.title;if(cached[key]&&bad(cached[key],a.title))delete cached[key];if(cached[key]){a.titleKo=cached[key];a.tr='google';continue;}delete a.titleKo;todo.push([f,a,key]);}
console.log('새로 번역할 제목: '+todo.length+' / 전체 '+jobs.length+' / 캐시 '+Object.keys(cached).length);
// 1.5) Claude 번역 (ANTHROPIC_API_KEY가 있을 때). 비용 한도 세 겹:
//   ① 월 한도 CLAUDE_MONTHLY_USD(기본 2달러) — 저장소 data/translation-spend.json에 누적 기록
//   ② 1회 실행당 최대 CLAUDE_MAX_TITLES_PER_RUN(기본 60)개
//   ③ 요청마다 호출 전 최대 비용을 미리 계산해 한도를 넘을 요청은 보내지 않음
//   (그 밖의 최종 상한은 Claude Console의 워크스페이스 월 지출 한도)
const ckey=(f,a)=>'claude1:'+f.source.lang+':'+a.title;
const ccache=await read('.cache/translations-claude.json')||{};
for(const f of previous?.feeds||[])for(const a of f.items||[])if(a.tr==='claude'&&a.titleKo&&!ccache[ckey(f,a)])ccache[ckey(f,a)]=a.titleKo; // 캐시가 날아가도 직전 게시본에서 복구
const month=new Date().toISOString().slice(0,7);
let spend=await read('data/translation-spend.json');if(spend?.month!==month)spend={month,usd:0,calls:0,titles:0,inputTokens:0,outputTokens:0};
const LIMIT=Math.max(0,Number(process.env.CLAUDE_MONTHLY_USD||2)),PER_RUN=Math.max(0,Number(process.env.CLAUDE_MAX_TITLES_PER_RUN||60));
const PIN=Number(process.env.CLAUDE_PRICE_IN||0.10)/1e6,POUT=Number(process.env.CLAUDE_PRICE_OUT||0.50)/1e6; // 100만 토큰당 달러 (Haiku 5.5, 10만 토큰 이하 요청)
const glossary=await read('scripts/glossary.json')||{};
let claudeRun={titles:0,usd:0,rejected:0,stopped:null};
for(const [f,a] of jobs){if(!f.items.includes(a))continue;const k=ckey(f,a);if(ccache[k]&&!bad(ccache[k],a.title)){if(a.titleKo&&a.titleKo!==ccache[k])a.titleKoAlt=a.titleKo;a.titleKo=ccache[k];a.tr='claude';}}
if(process.env.ANTHROPIC_API_KEY&&LIMIT>0&&PER_RUN>0){
  // 새 제목 먼저, 그다음 예전(Google) 번역을 Claude로 교체
  const want=jobs.filter(([f,a])=>f.items.includes(a)&&a.tr!=='claude').sort((x,y)=>(x[1].titleKo?1:0)-(y[1].titleKo?1:0)).slice(0,PER_RUN);
  for(let i=0;i<want.length;i+=25){
    const chunk=want.slice(i,i+25);
    const list=chunk.map(([f,a],n)=>({id:n,title:a.title,outlet:f.source.name,country:f.source.country,lang:f.source.lang}));
    const estIn=2500+JSON.stringify(list).length,estOut=400+list.length*160; // 입력은 글자 수로 넉넉히 잡음
    if(spend.usd+estIn*PIN+estOut*POUT>LIMIT){claudeRun.stopped='월 한도 도달';break;}
    try{
      const {out,usage}=await claudeBatch(list,process.env,glossary);
      const cost=(usage.input_tokens||0)*PIN+(usage.output_tokens||0)*POUT;
      spend.usd=+(spend.usd+cost).toFixed(6);spend.calls++;spend.inputTokens+=usage.input_tokens||0;spend.outputTokens+=usage.output_tokens||0;claudeRun.usd+=cost;
      const byId=new Map(out.map(o=>[+o.id,o.ko]));
      chunk.forEach(([f,a],n)=>{const ko=(byId.get(n)||'').trim();
        if(!ko||bad(ko,a.title)||!numbersOk(a.title,ko)){claudeRun.rejected++;console.log('Claude 번역 거부 '+f.source.id+': '+a.title.slice(0,60)+' → '+ko.slice(0,60));return;}
        if(a.titleKo&&a.titleKo!==ko)a.titleKoAlt=a.titleKo;a.titleKo=ko;a.tr='claude';ccache[ckey(f,a)]=ko;spend.titles++;claudeRun.titles++;});
    }catch(e){claudeRun.stopped=e.message;console.warn('Claude 번역 중단: '+e.message);break;}
  }
  console.log('Claude 번역: '+claudeRun.titles+'개, 이번 실행 $'+claudeRun.usd.toFixed(4)+', 이번 달 누적 $'+spend.usd.toFixed(4)+' / 한도 $'+LIMIT+(claudeRun.stopped?' · 중단: '+claudeRun.stopped:''));
}
for(let i=todo.length-1;i>=0;i--)if(todo[i][1].titleKo)todo.splice(i,1); // Claude가 처리한 제목은 아래 단계에서 제외
// 2) 1순위: DeepL 키가 있으면 DeepL, 없으면 Google 무료 번역
//    언어(문자·매체 언어)별로 묶어서 보내야 자동 언어 감지가 섞이지 않음
if(!process.env.DEEPL_API_KEY){
  const groups=new Map();
  for(const j of todo){const g=script(j[1].title)+':'+j[0].source.lang;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(j);}
  let retry=[];
  outer: for(const [g,list] of groups){
    for(let i=0;i<list.length;i+=20){
      const chunk=list.slice(i,i+20);
      const res=await googleBatch(chunk.map(([,a])=>a.title));
      if(!res){console.warn('Google 번역 실패: 남은 제목은 예비 번역기로 넘깁니다.');break outer;}
      chunk.forEach((j,n)=>{if(bad(res[n],j[1].title))retry.push(j);else{j[1].titleKo=res[n];j[1].tr='google';cached[j[2]]=res[n];}});
      await new Promise(r=>setTimeout(r,400));
    }
  }
  // 묶음에서 덜 번역된 제목은 한 개씩 다시
  console.log('한 개씩 다시 번역: '+retry.length);
  for(const [f,a,key] of retry){const r=await googleBatch([a.title]);const k=r&&r[0];if(k&&!bad(k,a.title)){a.titleKo=k;a.tr='google';cached[key]=k;}await new Promise(r=>setTimeout(r,250));}
}
// 3) 남은 제목: DeepL(키 있을 때) 또는 MyMemory(일일 한도 안에서)
for(const [f,a,key] of todo){if(a.titleKo)continue;if(stopped||!budget||new TextEncoder().encode(a.title).length>500)continue;if(!process.env.DEEPL_API_KEY&&usage.characters+a.title.length>budget)continue;
try{usage.characters+=a.title.length;const r=await translate(a.title,f.source.lang,process.env);if(!bad(r.translated,a.title)){a.titleKo=r.translated;a.tr=process.env.DEEPL_API_KEY?'deepl':'mymemory';cached[key]=r.translated;}}catch(e){console.warn('예비 번역 중단: '+e.message);stopped=true;}}
for(const [f,a] of jobs){if(!f.items.includes(a))continue;if(!a.titleKo)console.log('미번역 '+f.source.id+': '+a.title.slice(0,70));else if(bad(a.titleKo,a.title))console.log('의심 '+f.source.id+': '+a.titleKo.slice(0,70));}
const result={schemaVersion:1,generatedAt:new Date().toISOString(),feeds,collector:{successful,total:sources.length,translated:feeds.reduce((n,f)=>n+f.items.filter(a=>a.titleKo).length,0),byClaude:feeds.reduce((n,f)=>n+f.items.filter(a=>a.tr==='claude').length,0),claude:{run:claudeRun,month:spend.month,monthUsd:+spend.usd.toFixed(4),limitUsd:LIMIT}}};
await write('public/data/news.json',result);await fs.writeFile(new URL('public/data/news.js',root),'window.WORLD_NEWS='+JSON.stringify(result).replace(/</g,'\\u003c')+';\n');await write('.cache/news-last-good.json',result);
const keys=Object.keys(cached);for(const k of keys.slice(0,Math.max(0,keys.length-2000)))delete cached[k];await write('.cache/translations.json',cached);await write('.cache/translation-usage.json',usage);await fs.mkdir(new URL('data/',root),{recursive:true});await write('data/translation-spend.json',spend);{const ck=Object.keys(ccache);for(const k of ck.slice(0,Math.max(0,ck.length-3000)))delete ccache[k];await write('.cache/translations-claude.json',ccache);}console.log(JSON.stringify(result.collector));
