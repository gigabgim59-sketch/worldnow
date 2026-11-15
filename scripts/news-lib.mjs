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

// ── Claude 번역 ──
// 제목 여러 개를 매체·나라·언어 정보와 함께 JSON으로 보내고 [{id,ko}] JSON으로 받는다.
const CLAUDE_SYSTEM=`너는 해외 뉴스 제목을 한국어 신문 헤드라인으로 옮기는 번역가다.
입력: JSON 배열. 각 항목은 id, title(원문 제목), outlet(매체), country(나라), lang(원문 언어).
출력: 한 줄에 제목 하나씩, "id: 번역" 형식으로만 쓴다 (예: 0: 영국 정부 자문위원 "피해자 처우 공개해야"). 설명·머리말·코드블록·빈 줄 금지. 입력의 모든 id를 순서대로 한 번씩.
규칙:
1. 한국 신문 헤드라인 문체(개조식)로 쓴다. "~했다", "~발령", "~촉구", "~전망", "~ 논란"처럼 끝낸다. "~합니다/~습니다/~나요" 존댓말 금지.
2. 원문에 없는 정보·해석·평가를 덧붙이지 않는다. 원문이 따옴표로 남의 주장임을 표시했으면 한국어에서도 따옴표를 유지한다.
3. 숫자·날짜·단위를 정확히 옮긴다. milliard=10억, billion=10억, million=100만, lakh=10만, crore=1000만, млрд=10억, млн=100만. 퍼센트 소수점은 3.4%처럼 쓴다.
4. 다의어는 매체·맥락에 맞게 고른다 (예: 해협의 mine=기뢰, cold alert=한파 경보, swipe at=비판, fallout=파장, stocks mixed=혼조).
5. 관용구·비유는 뜻을 옮긴다 (예: se tirer une balle dans le pied=제 발등 찍기).
6. 인명·지명·기관명은 국내 언론 표기로 쓴다. 생소한 이름은 한글 음역 뒤 괄호에 원어를 한 번 붙여도 된다. 아래 용어집 표기를 반드시 따른다.
7. 코너명·머리표: Opinion=칼럼, Analysis=분석, Urgent=속보, Feature=기획, Explained=해설, Sources=소식통, Economic Watch=경제 워치. "| 필자 이름" 꼬리는 "| 필자 이름(한글)"로.
8. 제목이 두 문장이면 자연스럽게 하나로 이어도 되지만 내용을 빼지 않는다.
용어집(원문 → 표기):
`;
async function claudeBatch(list,env,glossary){
  const sys=CLAUDE_SYSTEM+Object.entries(glossary||{}).filter(([k])=>!k.startsWith('_')).map(([k,v])=>'- '+k+' → '+v).join('\n');
  const body={model:env.CLAUDE_MODEL||'claude-haiku-5-5',max_tokens:Math.min(8000,400+list.length*160),system:sys,
    messages:[{role:'user',content:JSON.stringify(list)}]};
  // 번역에는 사전 '생각' 단계가 필요 없다. 켜져 있으면 출력 한도를 생각에 다 써서 번역문이 잘린다.
  body.thinking={type:'disabled'};
  const call=async b=>{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify(b),signal:AbortSignal.timeout(90000)});return [r,await r.json().catch(()=>null)];};
  let [r,j]=await call(body);
  if(!r.ok&&r.status===400&&/thinking/i.test(j?.error?.message||'')){ // 모델이 생각 끄기를 지원하지 않으면 한도를 넉넉히 늘려 재시도
    delete body.thinking;body.max_tokens=Math.min(32000,body.max_tokens+12000);[r,j]=await call(body);}
  if(!r.ok){const e=Error('Claude '+r.status+': '+(j?.error?.message||'응답 오류'));e.status=r.status;throw e;}
  const text=(j.content||[]).map(c=>c.text||'').join('');
  // "id: 번역" 줄 형식 (따옴표가 섞여도 깨지지 않음). 혹시 JSON으로 답하면 그것도 읽는다.
  let out=[...text.matchAll(/^\s*(\d+)\s*[:：|\t]\s*(.+?)\s*$/gm)].map(m=>({id:+m[1],ko:m[2]}));
  if(!out.length){try{out=JSON.parse(text.slice(text.indexOf('['),text.lastIndexOf(']')+1)).map(o=>({id:+o.id,ko:String(o.ko||'')}));}catch{out=[];}}
  if(out.length<list.length)console.warn('Claude 응답 일부 누락 ('+out.length+'/'+list.length+', stop='+j.stop_reason+', out_tokens='+(j.usage?.output_tokens)+', blocks='+(j.content||[]).map(c=>c.type).join(',')+'): '+JSON.stringify(text.slice(-700)));
  return {out,usage:j.usage||{},maxTokens:body.max_tokens};
}
// 원문의 숫자가 번역에 남아 있는지 확인 (규모 단위가 붙은 숫자·서수 1~2는 환산되므로 제외)
const SCALE=/^\s?(?:millions?|milliards?|billions?|trillions?|bn|mn|tn|lakh|crore|млн|млрд|трлн|тыс|ألف|مليون|مليار|k\b)/i;
function numbersOk(src,ko){
  const kn=new Set((ko.match(/\d[\d.,]*/g)||[]).map(n=>n.replace(/[.,]/g,'')));
  for(const m of src.matchAll(/\d[\d.,]*\d|\d/g)){
    const rest=src.slice(m.index+m[0].length);
    if(SCALE.test(rest))continue;
    if(/^(?:st|nd|rd|th)\b/i.test(rest)&&+m[0]<=2)continue;
    const n=m[0].replace(/[.,]/g,'');
    if(![...kn].some(k=>k===n||k.includes(n)))return false;
  }
  return true;
}
export { claudeBatch, numbersOk, getFeed, translate, googleBatch, screen, topicOf, norm, similar };
