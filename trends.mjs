import {cycleInfo,latest,unique} from './analytics.mjs?v=1530';

export function periodMetrics(rows,mode='month',filters={}){
 const buckets=new Map();
 for(const r of rows){if(!r._date)continue;const key=mode==='cycle'?cycleInfo(r._date)?.start:r._date.slice(0,7);if(!key)continue;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}
 const keys=[...buckets.keys()].sort();
 const keyFor=d=>mode==='cycle'?cycleInfo(d)?.start:d?.slice(0,7);
 let first=keyFor(filters.from)||keys[0],last=keyFor(filters.to)||keys.at(-1);
 if(filters._cycle){first=keyFor(filters._cycle);last=keyFor(cycleInfo(filters._cycle)?.end);}
 if(first&&last&&first<=last){let cursor=first;for(let i=0;cursor<=last&&i<1200;i++){if(!buckets.has(cursor))buckets.set(cursor,[]);const date=new Date((mode==='cycle'?cursor:cursor+'-01')+'T12:00:00Z');if(mode==='cycle')date.setUTCDate(date.getUTCDate()+14);else date.setUTCMonth(date.getUTCMonth()+1);cursor=keyFor(date.toISOString().slice(0,10));}}
 return [...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([period,visits])=>{
  const successful=visits.filter(r=>r._success===1),stores=latest(successful.filter(r=>r._id)),known=stores.filter(r=>r._presence===true||r._presence===false),present=stores.filter(r=>r._presence===true).length;
  return {period,visits:successful.length,stores:unique(stores),present:successful.length?present:null,unknown:stores.length-known.length,rate:known.length?present/known.length:null};
 });
}

export function trendChart(points,{esc,fmt,T,animate=true}){
 if(!points.length)return `<p class="empty">${T('No dated observations','لا توجد مشاهدات مؤرخة')}</p>`;
 const width=720,height=240,left=65,right=22,top=22,bottom=48,w=width-left-right,h=height-top-bottom;
 const maximum=Math.max(1,...points.map(p=>p[1]??0)),step=Math.max(1,Math.ceil(maximum/4)),ceiling=step*4;
 const coordinates=points.map((p,i)=>[left+(points.length===1?w/2:i*w/(points.length-1)),top+h-p[1]/ceiling*h]);
 const path=coordinates.map(([x,y],i)=>points[i][1]===null?'':`${i&&points[i-1][1]!==null?'L':'M'} ${x} ${y}`).join(' ');
 const ticks=Array.from({length:5},(_,i)=>{const y=top+h-i*h/4;return `<line x1="${left}" y1="${y}" x2="${width-right}" y2="${y}" stroke="currentColor" opacity=".12"/><text x="${left-10}" y="${y+4}" text-anchor="end">${esc(fmt(i*step))}</text>`}).join('');
 const indices=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])];
 return `<svg class="scaled-trend" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(T('Trend with date and count axes','اتجاه بمحوري التاريخ والعدد'))}">${ticks}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="3"/>${coordinates.map(([x,y],i)=>points[i][1]===null?'':`<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"><title>${esc(points[i][0])}: ${esc(fmt(points[i][1]))}</title></circle>`).join('')}${animate&&points.length>1&&points.every(p=>p[1]!==null)?`<circle class="trend-pulse" r="5" fill="#fff"><animateMotion dur="5s" repeatCount="indefinite" path="${path}"/></circle>`:''}${indices.map(i=>`<text x="${coordinates[i][0]}" y="${height-15}" text-anchor="${i===0?'start':i===points.length-1?'end':'middle'}">${esc(points[i][0])}</text>`).join('')}</svg>`;
}

export function comparisonView(rows,mode,{esc,fmt,T,filters={}},presenceOnly=false){
 const periods=periodMetrics(rows,mode,filters),last=periods.at(-1),prior=periods.at(-2);
 const change=last?.present!=null&&prior?.present!=null?last.present-prior.present:null;
 return `<section class="panel comparison-panel"><div class="panel-head"><h2>${presenceOnly?T('Store presence trends','اتجاه تواجد جوريلا بالمحلات'):T('Period comparisons','مقارنات الفترات')}</h2><select id="comparison-mode" aria-label="${T('Compare periods','مقارنة الفترات')}"><option value="month" ${mode==='month'?'selected':''}>${T('Month to month','شهر بشهر')}</option><option value="cycle" ${mode==='cycle'?'selected':''}>${T('Cycle to cycle','سايكل بسايكل')}</option></select></div><p>${T('Uses the latest visit per Client Code in each period. Unknown presence is excluded from the percentage. Date filters define the custom range; edge periods may be partial.','آخر زيارة لكل كود عميل داخل كل فترة. التواجد غير المعروف مستبعد من النسبة. فلاتر التاريخ تحدد النطاق المخصص؛ الفترات على الأطراف قد تكون جزئية.')}</p>${last?`<p>${T('Latest period','آخر فترة')}: <b>${esc(last.period)}</b> · ${T('Stores with Gorilla','محلات بها جوريلا')}: <b>${fmt(last.present)}</b> · ${T('Change vs previous observed period','التغير عن الفترة السابقة المتاحة')}: <b>${change===null?'—':(change>0?'+':'')+fmt(change)}</b></p>`:''}${trendChart(periods.map(p=>[p.period,p.present]),{esc,fmt,T})}<div class="table-wrap"><table><thead><tr>${[T('Period','الفترة'),T('Visits','الزيارات'),T('Stores','المحلات'),T('Gorilla present','جوريلا موجودة'),T('Unknown','غير معروف'),T('Presence %','نسبة التواجد')].map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${periods.map(p=>`<tr><td>${esc(p.period)}</td><td>${fmt(p.visits)}</td><td>${fmt(p.stores)}</td><td>${fmt(p.present)}</td><td>${fmt(p.unknown)}</td><td>${p.rate===null?'—':fmt(p.rate*100)+'%'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
