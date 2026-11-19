// 유료 API·이미지 생성 없이, 편집자가 고른 Commons 사진의 무료 이용조건을 확인한다.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
const digest=b=>createHash('sha256').update(b).digest('hex');
export function freeLicense(meta){
  const name=plain(meta.LicenseShortName?.value),url=plain(meta.LicenseUrl?.value).replace(/^http:/,'https:').replace(/\/deed(?:\.[a-z-]+)?\/?$/i,'/');
  if(plain(meta.Restrictions?.value))return null;
  if(name==='Public domain')return {name,url:'https://creativecommons.org/publicdomain/mark/1.0/'};
  if(['CC0','CC0 1.0'].includes(name)&&/^https:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/?$/.test(url))return {name:'CC0 1.0',url};
  if(/^CC BY(?:-SA)? (?:2\.0|2\.5|3\.0|4\.0)$/.test(name)){
    const [type,version]=name.slice(3).split(' '),expected='https://creativecommons.org/licenses/'+type.toLowerCase()+'/'+version+'/';
    if(url.replace(/\/?$/,'/')===expected)return {name,url:expected};
  }
  return null;
}
export function validSelection(photo){return photo&&typeof photo.file==='string'&&/^File:[^\r\n]{1,220}\.(?:jpe?g|png|webp)$/i.test(photo.file)&&['archive','event'].includes(photo.kind)&&typeof photo.caption==='string'&&photo.caption.trim().length>0&&photo.caption.length<=180&&typeof photo.context==='string'&&photo.context.trim().length>0;}
export async function collectBriefPhotos(root,{request=fetch}={}){
  const read=async p=>{try{return JSON.parse(await fs.readFile(new URL(p,root),'utf8'));}catch{return null;}};
  const index=await read('public/briefing/index.json');const selections=await read('data/briefing-photo-selections.json')||{};const previous=await read('public/briefing/photos.json')||{dates:{}};
  const result={schemaVersion:1,dates:{}};let downloaded=0,kept=0,rejected=0;
  await fs.mkdir(new URL('public/data/photos/',root),{recursive:true});
  for(const date of (index?.dates||[]).slice(0,90)){
    const b=await read('public/briefing/'+date+'.json');if(!b?.headline)continue;
    const photos=[];
    for(let i=0;i<3;i++){
      const extra=selections[date]?.find(x=>x.headline===b.headline[i]);const photo=b.headlineDetail?.[i]?.photo||extra?.photo;
      if(!validSelection(photo)){photos.push(null);continue;}
      const binding=digest(JSON.stringify([b.headline[i],photo]));const old=previous.dates?.[date]?.[i];
      try{
        if(old?.binding===binding&&/^data\/photos\/[a-f0-9]{64}\.jpg$/.test(old.src)&&freeLicense({LicenseShortName:{value:old.license},LicenseUrl:{value:old.licenseUrl}})){
          const bytes=await fs.readFile(new URL('public/'+old.src,root));if(digest(bytes)===old.sha256){photos.push(old);kept++;continue;}
        }
        const u=new URL('https://commons.wikimedia.org/w/api.php');u.search=new URLSearchParams({action:'query',format:'json',prop:'imageinfo',iiprop:'url|extmetadata|size',iiurlwidth:'640',titles:photo.file,redirects:'1'});
        const r=await request(u,{signal:AbortSignal.timeout(12000),headers:{'user-agent':'Worldnow/1.0 (free Commons photo attribution; github.com/gigabgim59-sketch/worldnow)'}});if(!r.ok)throw Error('Commons metadata HTTP '+r.status);
        const j=await r.json(),page=Object.values(j.query?.pages||{}).find(p=>p.imageinfo?.length),info=page?.imageinfo?.[0],meta=info?.extmetadata||{},license=freeLicense(meta);
        if(!license)throw Error('무료 재사용 라이선스를 확인하지 못함');
        const author=plain(meta.Artist?.value);if(!author)throw Error('저작자 누락');
        const takenAt=plain(meta.DateTimeOriginal?.value||meta.DateTime?.value);const photoDay=takenAt.match(/\d{4}-\d{2}-\d{2}/)?.[0];
        if(photo.kind==='event'&&(!photoDay||Math.abs(Date.parse(date)-Date.parse(photoDay))>86400000))throw Error('실제 사건 사진의 촬영일 확인 필요 — 자료사진으로 분류');
        const imageUrl=new URL(info.thumburl||'');if(imageUrl.protocol!=='https:'||!['upload.wikimedia.org','thumb.wikimedia.org'].includes(imageUrl.hostname))throw Error('허용하지 않는 이미지 출처');
        const img=await request(imageUrl,{signal:AbortSignal.timeout(15000),redirect:'error',headers:{'user-agent':'Worldnow/1.0 (free Commons photo)'}});if(!img.ok)throw Error('Commons image HTTP '+img.status);
        if(+img.headers.get('content-length')>250000)throw Error('이미지 250KB 초과');
        const reader=img.body.getReader();let size=0;const chunks=[];
        while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>250000){await reader.cancel();throw Error('이미지 250KB 초과');}chunks.push(value);}
        const bytes=Buffer.concat(chunks);if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('JPEG 사진만 허용');
        const sha256=digest(bytes),src='data/photos/'+sha256+'.jpg';await fs.writeFile(new URL('public/'+src,root),bytes);
        const item={binding,headline:b.headline[i],src,sha256,width:info.thumbwidth,height:info.thumbheight,caption:photo.caption,kind:photo.kind,context:photo.context,author,license:license.name,licenseUrl:license.url,takenAt,file:page.title,sourceUrl:'https://commons.wikimedia.org/wiki/'+encodeURIComponent(page.title.replace(/ /g,'_')),checkedAt:new Date().toISOString(),changes:'Wikimedia Commons 제공 축소본 · 추가 편집 없음'};
        photos.push(item);downloaded++;
      }catch(e){photos.push(null);rejected++;console.warn('사진 생략 '+date+' #'+(i+1)+': '+e.message);}
    }
    if(photos.some(Boolean))result.dates[date]=photos;
  }
  // 선택에서 빠진 이미지는 활성 목록에서 제외한다. 과거 파일을 임의 삭제하지 않는다.
  await fs.writeFile(new URL('public/briefing/photos.json',root),JSON.stringify(result,null,2)+'\n');
  console.log('무료 브리핑 사진: 새로 저장 '+downloaded+' · 재사용 '+kept+' · 생략 '+rejected);
  return result;
}
if(process.argv[1]&&new URL(import.meta.url).pathname.endsWith('/'+process.argv[1].replace(/\\/g,'/').split('/').pop()))await collectBriefPhotos(new URL('../',import.meta.url));
