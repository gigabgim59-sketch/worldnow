const COUNTRY={uk:'영국',fr:'프랑스',us:'미국',ru:'러시아',in:'인도',cn:'중국',me:'중동'};
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const unescapeXML=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const field=(s,t)=>unescapeXML((s.match(new RegExp('<'+t+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+t+'>','i'))||[])[1]||'');
const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
// ── 토픽 분류 ──
// 로마자 키워드는 단어 경계로만 일치시킨다(Warns→war, senator→nato, taxis→tax, dévoilé→oil 같은 오탐 방지).
// 끝에 *가 붙은 키워드만 접두어(econom* → economy, economic…)로 일치. 키릴·아랍·데바나가리 키워드는 어간이라 부분 일치 유지.
const KW={
'금리·물가':['inflation*','interest rate*','rate rise*','rate cut*','central bank*','cost of living','taux','ключев.{0,8}ставк','инфляц','تضخم','فائدة'],
'예산·재정':['budget*','tax','taxes','taxation','taxpayer*','fiscal','debt*','déficit*','impôt*','бюджет','налог','ميزانية','ضرائب'],
'AI·반도체':['AI','artificial intelligence','semiconductor*','chip','chips','chipmaker*','nvidia','intelligence artificielle','人工智能','ذكاء اصطناعي'],
'전쟁·휴전':['ceasefire*','ukrain*','gaza','war','wars','wartime','warship*','troops','airstrike*','drone strike*','guerre*','войн','перемири','حرب','وقف إطلاق'],
'에너지·원유':['oil*','gas','energy','opec','pétrole','énergie*','нефт','газ','نفط','طاقة'],
'이민·국경':['immigra*','migrant*','asylum','border*','immigr*','границ','мигран','هجرة','لاجئ'],
'정치·선거':['election*','parliament*','congress*','senat*','MP','MPs','labour','tory','tories','justice','supreme court','minister*','president*','government*','democra*','republican*','party','parties','corruption','court','courts','vote','votes','voters','trump*','modi','macron','starmer','élection*','président*','gouvernement*','выбор','правитель','انتخاب','حكومة'],
'경제·물가':['inflation*','econom*','price','prices','interest rate*','central bank*','budget*','growth','jobs','employment','gdp','économ*','croissance','(?:^|\\s)цен[аыуе]','эконом','бюджет','اقتصاد','تضخم','فائدة'],
'외교·안보':['war','wars','military','navy','naval','warship*','troops','army','spy','spies','espionage','terror*','security','iran*','israel*','palestin*','settler*','settlement*','occupied','défense','missile*','ukrain*','gaza','diploma*','nato','sanctions','defence','defense','peace','summit*','guerre*','armée*','войн','ракет','حرب','إيران','غزة'],
'산업·시장':['stock','stocks','market*','industr*','bank','banks','banking','trade','trading','tariff*','energy','oil','gas','chip','chips','tech','technology','cyber*','microsoft','compan*','AI','bourse','entreprise*','marché*','рын','нефт','компан','أسهم','نفط','شركات'],
'사회·생활':['housing','manifestation*','grève*','interpellation*','sociale*','health*','school*','transport*','flight*','poverty','inequal*','crime*','rights','education','immigra*','protest*','worker*','police','climate','social','logement*','santé','école*','социал','образован','مناخ','تعليم']};
const HI={"금리·물가": "महंगाई|ब्याज दर|रिजर्व बैंक", "예산·재정": "बजट|टैक्स|कर ", "AI·반도체": "", "전쟁·휴전": "युद्ध|संघर्ष विराम", "에너지·원유": "तेल|ऊर्जा", "이민·국경": "सीमा|घुसपैठ", "정치·선거": "चुनाव|सरकार|मोदी|भाजपा|कांग्रेस|संसद|मंत्री|राहुल|विधानसभा|अदालत", "경제·물가": "अर्थव्यवस्था|महंगाई|जीडीपी|रोजगार", "외교·안보": "सेना|रक्षा|पाकिस्तान|चीन|विदेश|आतंक", "산업·시장": "बाजार|शेयर|व्यापार|कंपनी|टैरिफ", "사회·생활": "किसान|शिक्षा|स्वास्थ्य|पुलिस|अपराध|प्रदूषण"};
const kwRe=k=>/^[A-Za-zÀ-ÿ ]+\*?$/.test(k)?'(?<![\\p{L}\\p{N}])'+(k.endsWith('*')?k.slice(0,-1):k+'(?![\\p{L}\\p{N}])'):k;
const topics=Object.entries(KW).map(([n,ks])=>[n,new RegExp([...ks.map(kwRe),...(HI[n]?[HI[n]]:[])].join('|'),'iu')]);
// 비유·고유명사 속 단어는 토픽 판정 전에 지운다 (기후변화와의 '전쟁', '노예 무역', 웨스트뱅크의 'Bank', 대학 이름의 'Tech')
const FIGURE=/\bwar(?= on (?:climate|drugs?|poverty|woke|cancer|waste|cash))|\bslave trade\b|\bWest Bank\b|\bGeorgia Tech\b|\bVirginia Tech\b|\bTexas Tech\b/gi;
const topicOf=t=>{const x=t.replace(FIGURE,' ');return topics.filter(([,r])=>r.test(x)).map(([n])=>n);};
// ── 제목 정리·선별 ──
// 스포츠·연예·문화·생활 기사 (제목 키워드)
const SKIP=/football|soccer|cricket|horoscope|rugby|tennis|mbappé|celebrity|paintings|cinéma|festival|recipe|fashion|royal family|prince william|kate middleton|stock price today|stock quote|share price today|\bnfl\b|\bnba\b|\bmlb\b|ncaa|quarterback|touchdown|playoff|super bowl|clemson|formula 1|grand prix|\bXV de France\b|\bTop 14\b|\bLigue 1\b|\bPSG\b|Ballon d.Or|Tour de France|Roland.Garros|Goncourt|ventes de livres|box.office|bestseller|\bwedding\b|\bboyfriend\b|\bgirlfriend\b|\bdivorce\b|opens up about|tiger woods|\bIPL\b|क्रिकेट|बॉलीवुड|फिल्म|राशिफल/i;
// 칼럼·분석 (정렬에서 감점, 쟁점 계산에서 제외)
const OPINION=/^(?:opinion|analysis|comment|editorial|op-ed|column)\s*[|•:\-–]|\|\s*(?:opinion|comment)\b/i;
// Guardian은 칼럼 제목 끝에 "| 필자 이름"을 붙인다
const BYLINE=/\s\|\s[A-Z][a-z]+(?: [A-Z][a-z'-]+){1,2}$/;
// 제목 끝에 붙는 영문 URL 꼬리 (예: Dainik Jagran "… - sad and bjp may alliance this month …")
const SLUG=/\s+-\s+[a-z0-9][a-z0-9 ]{14,}$/;
const norm=t=>t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\b(?:a|an|the)\b/g,' ').replace(/\s+/g,' ').trim();
const similar=(a,b)=>{if(a===b)return true;const A=new Set(a.split(' ')),B=new Set(b.split(' '));let i=0;A.forEach(w=>{if(B.has(w))i++;});return i/Math.max(A.size,B.size)>=0.8;};
// 제목 하나를 정리·판정한다. 버릴 제목이면 null.
function screen(raw,s){
  let title=raw;
  if(/[^\x00-\x7F]/.test(title.replace(SLUG,''))&&SLUG.test(title))title=title.replace(SLUG,'').trim();
  if(title.length<20||/(?:\.\.|…)$/.test(title)||SKIP.test(title))return null;
  if(s.id==='republic'&&!/india|indian|modi|bjp|delhi|mumbai|rupee|\brbi\b/i.test(title))return null;
  if(s.id==='tass'&&!/russia|russian|putin|kremlin|moscow|lavrov/i.test(title))return null;
  const tags=topicOf(title);if(!tags.length)return null;
  if(s.economy&&!tags.some(t=>['금리·물가','예산·재정','AI·반도체','에너지·원유','경제·물가','산업·시장'].includes(t)))return null;
  return {title,topics:tags,opinion:OPINION.test(title)||(s.id==='guardian'&&BYLINE.test(title))};
}
async function cached(key,ttl,fn){const req=new Request('https://news-cache.invalid/'+key);let cache;try{cache=caches.default;const hit=await cache.match(req);if(hit)return await hit.json();}catch{}const value=await fn();if(cache)await cache.put(req,new Response(JSON.stringify(value),{headers:{'cache-control':'public, max-age='+ttl,'content-type':'application/json'}}));return value;}
async function getFeed(s){try{const local={uk:'(UK OR Britain OR British OR Starmer OR Labour)',fr:'(France OR français OR Macron OR gouvernement)',us:'(US OR America OR Trump OR Congress OR Federal)',ru:'(Russia OR Russian OR Россия OR Путин OR российский)',in:'(India OR Indian OR Modi OR BJP OR भारत OR मोदी OR सरकार)',cn:'(China OR Chinese)',me:'(Iran OR Israel OR Palestine OR Gaza OR Saudi OR Qatar OR Middle East OR إيران OR السعودية OR اقتصاد)'};const query=(s.query||'site:'+s.domain)+' '+local[s.country]+' when:3d';const locale=s.lang==='fr'?['fr','FR','FR:fr']:s.lang==='ru'?['ru','RU','RU:ru']:s.lang==='ar'?['ar','SA','SA:ar']:s.lang==='hi'?['hi','IN','IN:hi']:['en-US','US','US:en'];const u=new URL('https://news.google.com/rss/search');u.search=new URLSearchParams({q:query,hl:locale[0],gl:locale[1],ceid:locale[2]});const r=await fetch(u,{signal:AbortSignal.timeout(14000),headers:{'user-agent':'WorldNewsDesk/1.0'}});if(!r.ok)throw Error('feed HTTP '+r.status);const xml=await r.text();if(!xml.includes('<rss'))throw Error('invalid feed');const seen=new Set();const items=[];for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)){const x=m[1];const source=x.match(/<source\s+url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/);if(source){try{const host=new URL(unescapeXML(source[1])).hostname;if(host!==s.domain&&!host.endsWith('.'+s.domain))continue;}catch{continue;}}let title=plain(field(x,'title'));const sourceName=source?plain(unescapeXML(source[2])):'';if(sourceName&&title.endsWith(' - '+sourceName))title=title.slice(0,-sourceName.length-3);const link=field(x,'link');const date=new Date(field(x,'pubDate'));const v=screen(title,s);if(!v)continue;title=v.title;const key=norm(title);if(!/^https?:\/\//.test(link)||[...seen].some(k=>similar(k,key))||!Number.isFinite(+date)||+date<Date.now()-3*86400000||+date>Date.now()+3600000)continue;seen.add(key);items.push({id:s.id+'-'+items.length,title,url:link,date:date.toISOString(),topics:v.topics,...(v.opinion?{opinion:true}:{})});if(items.length>=8)break;}return {source:s,items,fetchedAt:new Date().toISOString(),status:items.length?'ok':'empty'};}catch(e){return{source:s,items:[],status:'error',error:'현재 기사를 가져오지 못했습니다.',fetchedAt:new Date().toISOString()};}}
async function translate(text,lang,env){if(new TextEncoder().encode(text).length>500)throw Error('제목이 번역 길이 한도를 초과했습니다.');const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(lang+':'+text));const key=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');return cached('translation-v1/'+key,604800,async()=>{let translated;if(env.DEEPL_API_KEY){const endpoint=env.DEEPL_API_KEY.endsWith(':fx')?'https://api-free.deepl.com/v2/translate':'https://api.deepl.com/v2/translate';const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'DeepL-Auth-Key '+env.DEEPL_API_KEY,'content-type':'application/json'},body:JSON.stringify({text:[text],source_lang:lang.toUpperCase(),target_lang:'KO'}),signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('번역 서비스 응답 오류');translated=(await r.json()).translations?.[0]?.text;}else{const u=new URL('https://api.mymemory.translated.net/get');u.search=new URLSearchParams({q:text,langpair:lang+'|ko'});const r=await fetch(u,{signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('번역 서비스 응답 오류');const j=await r.json();if(j.responseStatus!==200||j.quotaFinished)throw Error('무료 번역 한도 또는 서비스 제한');translated=j.responseData?.translatedText;}if(!translated||!/[가-힣]/.test(translated))throw Error('한국어 번역을 확인하지 못했습니다.');return{translated:unescapeXML(translated),provider:env.DEEPL_API_KEY?'DeepL':'MyMemory'};});}


// Google 번역 무료 엔드포인트로 여러 제목을 한 번에 번역 (키 불필요). 실패하면 null.
async function googleBatch(texts){
  if(!texts.length)return [];
  const q=texts.map(t=>t.replace(/\n/g,' ')).join('\n');
  for(let attempt=0;attempt<3;attempt++){
    try{
      const body=new URLSearchParams({q});
      const r=await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','user-agent':'Mozilla/5.0'},body,signal:AbortSignal.timeout(30000)});
      if(!r.ok)throw Error('HTTP '+r.status);
      const j=await r.json();
      const parts=(j[0]||[]).map(s=>s&&s[0]||'').join('').split('\n').map(s=>s.trim());
      if(parts.length===texts.length)return parts;
      // 줄 수가 어긋나면 한 개씩
      const out=[];
      for(const t of texts){const one=await googleBatch1(t);out.push(one);}
      return out;
    }catch(e){console.warn('Google 번역 재시도 '+(attempt+1)+': '+e.message);await new Promise(r=>setTimeout(r,2000+attempt*4000));}
  }
  return null;
}
async function googleBatch1(t){
  try{const u='https://translate.googleapis.com/translate_a/single?'+new URLSearchParams({client:'gtx',sl:'auto',tl:'ko',dt:'t',q:t});
    const r=await fetch(u,{headers:{'user-agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});if(!r.ok)return null;
    const j=await r.json();return (j[0]||[]).map(s=>s&&s[0]||'').join('').trim()||null;}catch{return null;}
}
export { getFeed, translate, googleBatch, screen, topicOf, norm, similar };
