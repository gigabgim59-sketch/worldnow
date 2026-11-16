// 카톡·문자 원고 만들기: public/briefing/sms.txt, sms-short.txt, sms-test.txt, latest.txt
// 수집 성공 여부와 상관없이 워크플로가 매번 실행한다. 오늘(한국 시간) 브리핑이 없으면 빈 파일.
import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const read=async p=>{try{return JSON.parse(await fs.readFile(new URL(p,root),'utf8'));}catch{return null;}};
// 3줄 문구: 문장 아래에 키워드를 └ 줄로 (headlineDetail이 있는 브리핑만)
const threeLine=(B,i)=>{const x=B.headlineDetail?.[i]||{},k=x.keys,tag=x.status==='new'?'[新] ':x.status==='cont'?'[이어짐] ':'';
  return (i+1)+'. '+tag+B.headline[i]+(x.status==='cont'&&x.change?'\n   └ 오늘: '+x.change:Array.isArray(k)&&k.length?'\n   └ '+k.join(', '):'');};
const knowLines=B=>Array.isArray(B.know)&&B.know.length?'\n\n[알아둘 만한 소식]\n'+B.know.map(k=>'· '+k.t).join('\n'):'';
const threeLines=B=>B.headline.map((x,i)=>threeLine(B,i)).join('\n\n');
{const SITE='https://gigabgim59-sketch.github.io/worldnow/';const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 let msg='';try{const idx=await read('public/briefing/index.json');const d=idx?.dates?.[0];const B=d&&await read('public/briefing/'+d+'.json');
  if(B?.headline?.length)msg='[세계의 오늘] '+(B.title||d)+'\n\n'+threeLines(B)+'\n\n전체 보기: '+SITE;
  await fs.writeFile(new URL('public/briefing/latest.txt',root),msg?msg+'\n':'');
  console.log('문자 원고: '+(d===today&&msg?d+' ('+msg.length+'자)':'오늘 브리핑 없음 → 빈 파일'));}catch(e){console.warn('문자 원고 생성 실패: '+e.message);}}
// 카톡 발송용 요약(briefing/sms.txt): 오늘(한국 시간) 브리핑이 있으면 요약, 없으면 빈 파일 → 단축어가 어제 내용을 다시 보내지 않음
{let txt='';try{const idx=await read('public/briefing/index.json');const d=idx?.dates?.[0];const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 if(d===today){const B=await read('public/briefing/'+d+'.json');if(B?.headline?.length)txt='[세계의 오늘] '+(B.title||d+' 아침 이슈 브리핑')+'\n\n'+threeLines(B)+knowLines(B)+'\n\nBY 형준\n\n▶ 나라별 이슈와 진영별 시각: https://gigabgim59-sketch.github.io/worldnow/';}}catch{}
 await fs.writeFile(new URL('public/briefing/sms.txt',root),txt);
 // 짧은 판(제목 + 첫 줄 + 링크): 카톡 단축어가 긴 글에서 시간 초과될 때 대안
 let short='';try{if(txt){const idx=await read('public/briefing/index.json');const B=await read('public/briefing/'+idx.dates[0]+'.json');short='[세계의 오늘] '+(B.title||'')+'\n'+threeLine(B,0)+'\n\nBY 형준\n\n▶ https://gigabgim59-sketch.github.io/worldnow/';}}catch{}
 await fs.writeFile(new URL('public/briefing/sms-short.txt',root),short);await fs.writeFile(new URL('public/briefing/sms-test.txt',root),'세계의 오늘 카톡 발송 시험\n');console.log('카톡 요약: '+(txt?txt.length+'자':'오늘 브리핑 없음(빈 파일)'));}
