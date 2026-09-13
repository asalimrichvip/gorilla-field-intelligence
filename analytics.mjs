import {GORILLA_QUESTION,JUHAYNA_QUESTION,triState,parseDuration,formatTimestamp} from './presentation.mjs';
export const SKU = ['Ultimate 250ml','Ultimate 500ml','Mango Coconut 250ml','Mango Coconut 500ml','Watermelon 250ml','Watermelon 500ml'];
export const BRANDS = ['Redbull','Monster','Power Horse','Sting','Fury','Twist','Other ED'];

export const CYCLE_ANCHOR = '2026-08-29';
function dayNumber(iso){const d=new Date(String(iso)+'T12:00:00Z');return Number.isFinite(+d)?Math.floor(+d/86400000):null;}
export function cycleInfo(iso){
 const dn=dayNumber(iso),anchor=dayNumber(CYCLE_ANCHOR);if(dn===null)return null;
 const diff=dn-anchor,block=Math.floor(diff/14),offset=((diff%14)+14)%14;
 const startDn=anchor+block*14,start=new Date(startDn*86400000).toISOString().slice(0,10),end=new Date((startDn+13)*86400000).toISOString().slice(0,10);
 const cycle=((block%2)+2)%2+1,week=Math.floor(offset/7)+1,weekStart=new Date((startDn+(week-1)*7)*86400000).toISOString().slice(0,10),weekEnd=new Date((startDn+(week-1)*7+6)*86400000).toISOString().slice(0,10);
 return {cycle,week,start,end,weekStart,weekEnd,key:start,label:`Cycle ${cycle} | ${start} → ${end}`};
}
export function cyclePeriods(rows){const map=new Map();for(const r of rows){const c=cycleInfo(r._date);if(c)map.set(c.key,c);}return [...map.values()].sort((a,b)=>b.start.localeCompare(a.start));}

export const POSM = ['Posters','Transparent Posters','Parasite Rack','Shelf Talker','Counter Top','Shelf Stripe','Sticker 3 Pack','Pallet Wrap','Stopper','Push & Pull Door Sticker','Shelf in Shelf','Carton Display','أخرى (عدد)'];
export const num = x => x === '' || x == null || !Number.isFinite(Number(x)) ? null : Number(x);
export const sum = (rows,key) => rows.reduce((a,r)=>a+(num(typeof key==='function'?key(r):r[key])??0),0);
export const avg = (rows,key) => {const valid=rows.map(r=>num(r[key])).filter(v=>v!==null);return valid.length?valid.reduce((a,b)=>a+b,0)/valid.length:null;};
export const yes = v => ['yes','نعم','true','1','اه'].includes(String(v??'').trim().toLowerCase());
export const unique = (rows,key='_id') => new Set(rows.map(r=>r[key]).filter(v=>v!==''&&v!=null)).size;
export function dateValue(v){const m=String(v??'').match(/^(\d{4}-\d{2}-\d{2})/);if(!m)return '';const d=new Date(m[1]+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===m[1]?m[1]:'';}
export function skuDetails(r) {
 return SKU.map(name=>{
  const rawName='Gorilla '+name.replace('Watermelon','Watermelon-Melon')+' Facing Count';
  const rawKeys=Object.keys(r).filter(k=>k===rawName||k.startsWith(rawName+' ['));
  const values=rawKeys.map(k=>num(r[k])).filter(v=>v!==null&&v>=0);
  const consolidated=num(r[name]);
  // Blank survey measurements must not become measured zero through cached formulas.
  return {name,quantity:values.length?values.reduce((a,b)=>a+b,0):rawKeys.length&&!(consolidated>0)?null:consolidated!==null&&consolidated>=0?consolidated:null};
 });
}
export function normalize(rows){return rows.map((r,i)=>{
 const id=r['Client Code']==null?'':String(r['Client Code']).trim();
 const lat=num(r.Lat),lng=num(r.Lng),seconds=parseDuration(r['Total Duration']),duration=num(r['Duration (min)'])??(seconds===null?null:seconds/60);
 const skus=skuDetails(r),known=skus.filter(s=>s.quantity!==null),present=skus.filter(s=>s.quantity>0),hasSkuColumns=Object.keys(r).some(k=>SKU.includes(k)||k.startsWith('Gorilla ')&&k.includes('Facing Count'));
 const rawPosm=POSM.filter(k=>Object.hasOwn(r,k));
 const photos=[];for(const [key,value]of Object.entries(r)){if(typeof value!=='string')continue;for(const u of value.match(/https?:\/\/[^\s|]+/g)??[])if(/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u))photos.push({url:u,category:key});}
 const survey=triState(r[GORILLA_QUESTION])??triState(r['هل يوجد لدى العميل منتج جوريلا ؟']);
 const productPresence=present.length>0?true:known.length===SKU.length?false:null;
 const presence=survey===true||productPresence===true?true:survey===false||productPresence===false?false:null;
 return {...r,_row:i+2,_id:id,_date:dateValue(r.Date),_duration:duration,_availability:known.length===SKU.length?present.length:presence===false?0:hasSkuColumns?null:num(r.Availability),_skus:skus,_skuCount:known.length===SKU.length?present.length:presence===false?0:null,_surveyGorilla:survey===null?'unknown':String(survey),_juhayna:triState(r[JUHAYNA_QUESTION])===null?'unknown':String(triState(r[JUHAYNA_QUESTION])),_presenceConflict:survey!==null&&productPresence!==null&&survey!==productPresence,_posm:rawPosm.length?sum([r],x=>POSM.reduce((a,k)=>a+(num(x[k])??0),0)):num(r['POSM Units']),_gorilla:num(r['Gorilla Total Facings']),_competitor:num(r['Competitor Facings']),_presence:presence,_success:num(r['Successful Visit'])??(r['حالة الزيارة']?Number(r['حالة الزيارة']==='زيارة ناجحة'):null),_geo:lat!==null&&lng!==null&&Math.abs(lat)<=90&&Math.abs(lng)<=180&&(lat!==0||lng!==0)?[lat,lng]:null,_photos:photos};
});}
export const visitStamp=r=>formatTimestamp(r['Started At']||r.Date||'');
export function latest(rows){const map=new Map();for(const r of rows){if(!r._id)continue;const before=map.get(r._id);if(!before||visitStamp(r)>=visitStamp(before))map.set(r._id,r);}return [...map.values()];}
export function filterRows(rows,f,omit){return rows.filter(r=>Object.entries(f).every(([k,v])=>!v||k===omit||(k==='search'?Object.values(r).some(x=>typeof x!=='object'&&String(x??'').toLowerCase().includes(v.toLowerCase())):k==='from'?r._date&&r._date>=v:k==='to'?r._date&&r._date<=v:k==='_sku'?(r._skus?.find(s=>s.name===v)?.quantity??num(r[v]))>0:k==='_brand'?num(v==='Gorilla'?r._gorilla:r[v])>0:k==='_presence'?String(r._presence)===v:k==='_cycle'?cycleInfo(r._date)?.key===v:k==='_week'?String(cycleInfo(r._date)?.week||'')===String(v):String(r[k]??'')===v)));}
export function group(rows,key,metric){const m=new Map();for(const r of rows){const k=String(r[key]??'')||'—';m.set(k,(m.get(k)||0)+(metric?(num(r[metric])??0):1));}return [...m].sort((a,b)=>b[1]-a[1]);}
export function kpis(rows){const stores=latest(rows),measured=stores.filter(r=>r._gorilla!==null&&r._competitor!==null),g=sum(measured,'_gorilla'),c=sum(measured,'_competitor');return {visits:rows.length,stores:stores.length,success:avg(rows,'_success'),availability:avg(stores,'_availability'),presence:avg(stores.map(r=>({...r,p:r._presence===null?null:Number(r._presence)})),'p'),share:g+c?g/(g+c):null,posm:stores.some(r=>r._posm!==null)?sum(stores,'_posm'):null,duration:avg(rows,'_duration'),orders:rows.some(r=>num(r['Order Cartons'])!==null)?sum(rows,'Order Cartons'):null};}
export function health(rows,columns,settings={short:2,share:15,availability:0}){const issues=[], seen=new Set();const add=(kind,severity,r)=>issues.push({kind,severity,row:r._row,id:r._id});for(const r of rows){
 if(!r._id)add('missingId','critical',r);if(!r._date)add('invalidDate','critical',r);else if(r._date>new Date().toISOString().slice(0,10))add('futureDate','warning',r);
 if(!r._geo)add('invalidGeo','warning',r);if(r._duration===null||r._duration<0||r._duration>480)add('invalidDuration','warning',r);
 if(r._duration!==null&&r._duration>=0&&r._duration<settings.short)add('shortVisit','warning',r);
 if(r._availability!==null&&r._availability<=settings.availability)add('noAvailability','critical',r);
 if(r._gorilla!==null&&r._competitor!==null&&r._gorilla+r._competitor>0&&r._gorilla/(r._gorilla+r._competitor)*100<settings.share)add('lowShare','warning',r);
 if(yes(r['محل قوى'])&&r._presence===false)add('strongOpportunity','warning',r);
 if(r._id&&r['Started At']){const key=r._id+'|'+visitStamp(r);if(seen.has(key))add('duplicate','critical',r);seen.add(key);}
 if(r._presenceConflict)add('presenceConflict','warning',r);
 if(r._posm!==null&&num(r['POSM Units'])!==null&&r._posm!==num(r['POSM Units']))add('posmMismatch','info',r);
 if(r._availability!==null&&num(r.Availability)!==null&&r._availability!==num(r.Availability))add('availabilityMismatch','info',r);
 if(Object.values(r).some(v=>typeof v==='string'&&/^#(DIV\/0!|VALUE!|N\/A|NAME\?|NUM!|NULL!)/.test(v)))add('formulaError','warning',r);
 }for(const k of ['Client Code','Date','Started At','Rep'])if(!columns.includes(k))issues.push({kind:'missingColumn',severity:'critical',column:k});return issues;}

// Deduplicate exact visit timestamps only for frequency-based outlet histories.
// Missing timestamps cannot establish separate repeat visits on the same date.
export function distinctVisits(rs) {
 const seen=new Map();for(const r of rs){const key=r._id+'|'+(r['Started At']?visitStamp(r):r._date||'undated');const existing=seen.get(key);if(!existing||r._presence===true||existing._presence===null)seen.set(key,r);}return [...seen.values()];
}
export function presenceReport(all,filters={}) {
 const rawPeriod=filterRows(all,filters).filter(r=>r._id&&r._date);
 const cycle=filters._cycle?cycleInfo(filters._cycle):null;
 const cycleEnd=cycle?(filters._week==='1'?cycle.weekEnd:cycle.end):'';
 const end=filters.to||filters._date||cycleEnd||rawPeriod.map(r=>r._date).filter(Boolean).sort().at(-1)||all.map(r=>r._date).filter(Boolean).sort().at(-1)||'';
 const period=rawPeriod.filter(r=>!end||r._date<=end);
 const historyFilters={...filters,from:'',to:end,_date:'',_cycle:'',_week:''};
 const cumulative=filterRows(all,historyFilters).filter(r=>r._id&&r._date&&(!end||r._date<=end));
 const presentRows=period.filter(r=>r._presence===true),cumulativeRows=cumulative.filter(r=>r._presence===true);
 const fullHistory=all.filter(r=>r._id&&r._date&&(!end||r._date<=end));
 const allKnownPresent=new Set(fullHistory.filter(r=>r._presence===true).map(r=>r._id));
 const unknownIds=new Set(fullHistory.filter(r=>r._presence===null).map(r=>r._id));
 const absences=new Map();for(const r of distinctVisits(period).filter(r=>r._presence===false)){if(!absences.has(r._id))absences.set(r._id,[]);absences.get(r._id).push(r);}
 const repeatedIds=new Set([...absences].filter(([,v])=>v.length>=2).map(([id])=>id));
 const neverIds=new Set([...absences.keys()].filter(id=>!allKnownPresent.has(id)&&!unknownIds.has(id)));
 const repeatedRows=period.filter(r=>repeatedIds.has(r._id)&&r._presence===false);
 const neverRows=period.filter(r=>neverIds.has(r._id)&&r._presence===false);
 const days=[...new Set(period.map(r=>r._date))].sort();
 const trend=days.map(date=>({date,present:unique(presentRows.filter(r=>r._date===date)),cumulative:unique(cumulativeRows.filter(r=>r._date<=date))}));
 return {end,period,presentRows,cumulativeRows,repeatedRows,neverRows,trend,absences,presentCount:unique(presentRows),cumulativeCount:unique(cumulativeRows),repeatedCount:repeatedIds.size,neverCount:neverIds.size,conflicts:period.filter(r=>r._presenceConflict).length};
}
