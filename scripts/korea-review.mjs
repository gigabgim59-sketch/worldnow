// 한국 원자료는 아침 브리핑에서 근거와 함께 승인한 URL만 공개한다.
// 구조 검사는 편집 판단을 대신하지 않는다. 의미·원문 대조는 BRIEFING.md에 따라 Claude가 한다.
import assert from 'node:assert/strict';
const FOREIGN=new Set(['reuters_kr','ap_kr','nhk_kr','xinhua_kr']);
const https=u=>{try{return new URL(u).protocol==='https:';}catch{return false;}};
const text=x=>typeof x==='string'&&x.trim().length>0;
export function checkKoreaItem(it,sources){
  const proof=it.international;
  assert(proof&&text(proof.reason),'한국: 국제적 파장 설명 필요');
  assert(Array.isArray(it.links)&&it.links.length,'한국: 승인할 근거 기사 필요');
  for(const l of it.links){assert(sources.get(l.source)?.country==='kr'&&https(l.url)&&text(l.title),'한국: 근거 기사 매체·URL·제목');}
  assert(Array.isArray(proof.evidence)&&proof.evidence.length,'한국: 실제 해외 주목 근거 필요');
  for(const e of proof.evidence){
    assert(https(e.url)&&text(e.title)&&Number.isFinite(Date.parse(e.date)),'한국: 해외 근거 URL·제목·날짜');
    assert(['media','official','international-organization'].includes(e.kind),'한국: 해외 근거 종류');
    if(e.kind==='media')assert(FOREIGN.has(e.source)&&it.links.some(l=>l.source===e.source&&l.url===e.url),'한국: 해외 매체 근거는 같은 사안의 승인 기사로 연결');
    else assert(text(e.actor)&&text(e.country)&&e.country!=='한국'&&e.country!=='kr','한국: 해외 공식 근거의 주체·나라');
  }
  assert(Array.isArray(it.reactions),'한국: reactions 배열 필요 (확인된 반응이 없으면 [])');
  for(const r of it.reactions)assert(['official','media','expert'].includes(r.kind)&&text(r.country)&&text(r.actor)&&text(r.text)&&https(r.url)&&Number.isFinite(Date.parse(r.date)),'한국: 반응의 나라·주체·종류·내용·URL·날짜');
}
export async function publishKorea(feeds,previous,read){
  const sources=new Map(feeds.map(f=>[f.source.id,f.source]));
  const history=await read('public/data/history.json');
  const available=new Map();
  for(const a of history?.items||[])if(a.country==='kr')available.set(a.source+'\n'+a.url,a);
  for(const f of [...(previous?.feeds||[]),...feeds])if(f.source.country==='kr')for(const a of f.items||[])available.set(f.source.id+'\n'+a.url,{...a,source:f.source.id});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const index=await read('public/briefing/index.json');
  let review=null;
  for(const date of [...new Set(index?.dates||[])].filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=today).sort().reverse()){
    const b=await read('public/briefing/'+date+'.json');const country=b?.countries?.find(c=>c.id==='kr');
    if(!country)continue;
    try{
      assert(b.date===date&&Array.isArray(country.issues)&&country.issues.length<=3);
      const entries=[...country.issues,...(b.know||[]).filter(k=>k.c==='kr')];
      const urls=new Set();
      for(const it of entries){checkKoreaItem(it,sources);for(const l of it.links)urls.add(l.source+'\n'+l.url);
        for(const e of it.international.evidence)if(e.kind==='media')assert(available.get(e.source+'\n'+e.url)&&!available.get(e.source+'\n'+e.url).opinion,'한국: 해외 사실 근거를 원자료에서 확인할 수 없음 또는 칼럼');}
      // 기사 원문이 없는 승인으로 이전 게시본을 지우지 않는다.
      for(const key of urls)assert(available.has(key),'한국: 승인 기사의 원자료 없음');
      review={date,urls};break;
    }catch(e){console.warn('한국 검수본 제외 '+date+': '+e.message);}
  }
  const previousDate=(previous?.feeds||[]).filter(f=>f.source.country==='kr').map(f=>f.koreaReview?.date).filter(Boolean).sort().at(-1);
  if(review&&previousDate&&review.date<previousDate)review=null;
  if(!review){
    for(const f of feeds.filter(f=>f.source.country==='kr')){const old=(previous?.feeds||[]).find(p=>p.source.id===f.source.id&&p.koreaReview?.date);f.items=old?.items||[];f.koreaReview=old?.koreaReview||{date:null};f.status=old?'approved':'review-pending';}
  }else for(const f of feeds.filter(f=>f.source.country==='kr')){
    f.items=[...review.urls].filter(k=>k.startsWith(f.source.id+'\n')).map(k=>{const {source,country,...a}=available.get(k);return a;}).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    f.koreaReview={date:review.date};f.status='approved';
  }
  return {date:review?.date||feeds.find(f=>f.source.country==='kr'&&f.koreaReview?.date)?.koreaReview.date||null,approved:feeds.filter(f=>f.source.country==='kr').reduce((n,f)=>n+f.items.length,0)};
}
