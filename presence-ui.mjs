import {SKU,latest,distinctVisits,visitStamp} from './analytics.mjs?v=1530';
import {answerText,displayValue,googleMapsUrl,flavorColor} from './presentation.mjs';

export const PRESENCE_MODES={
 present:['Present in period','ظهر بها جوريلا خلال الفترة'],
 cumulative:['Cumulative presence','التواجد التراكمي'],
 repeated:['Absent in 2+ visits','غياب في زيارتين أو أكثر'],
 never:['Never observed present','لم يظهر بها جوريلا مطلقًا']
};
export const modeRows=(report,mode)=>report[{present:'presentRows',cumulative:'cumulativeRows',repeated:'repeatedRows',never:'neverRows'}[mode]]||[];
export const skuPresence=r=>SKU.map(name=>Number((r._skus||[]).find(s=>s.name===name)?.quantity>0));
function followUpTable(shown,report,{T,esc,fmt,lang}){
 return `<div class="table-wrap"><table><thead><tr>${[T('Store','المحل'),'Client Code',T('Latest matching visit','آخر زيارة مطابقة'),...SKU,T('Total / 6','الإجمالي / 6'),T('Absent visits','زيارات الغياب')].map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${shown.map(r=>{const bits=skuPresence(r);return `<tr><td><button class="link-button" data-store="${esc(r._id)}">${esc(r.Client||r._id)}</button></td><td>${esc(r._id)}</td><td>${esc(displayValue('Started At',r['Started At']||r.Date,lang))}</td>${bits.map((b,i)=>`<td class="sku-presence" style="--flavor:${flavorColor(SKU[i])}">${b}</td>`).join('')}<td><b>${bits.reduce((a,b)=>a+b,0)}</b>${r._skuCount===null?` <small title="${T('Incomplete measurements: 0 means not observed','قياسات غير مكتملة: 0 تعني لم يتم رصده')}">＊</small>`:''}</td><td>${fmt(report.absences.get(r._id)?.length||0)}</td></tr>`}).join('')}</tbody></table></div>`;
}
export function presenceView(report,mode,{T,esc,fmt,card,page,pagination,lang}) {
 const selected=modeRows(report,mode),outlets=latest(selected).sort((a,b)=>a._id.localeCompare(b._id)),shown=outlets.slice(page*40,page*40+40);
 return `<div class="metrics presence-metrics">
 ${card(T('With Gorilla in period','عملاء جوريلا خلال الفترة'),fmt(report.presentCount),T('Distinct clients · any positive visit','عملاء فريدون · أي زيارة بها تواجد'),'primary')}
 ${card(T('Cumulative clients','العملاء التراكميون'),fmt(report.cumulativeCount),T('First recorded date through ','من أول تاريخ مسجل حتى ')+report.end)}
 ${card(T('Repeated absence','تكرار غياب جوريلا'),fmt(report.repeatedCount),T('At least two distinct visits in period','زيارتان مميزتان على الأقل خلال الفترة'))}
 ${card(T('Never observed present','لم يظهر بها جوريلا مطلقًا'),fmt(report.neverCount),T('No positive or unknown visits through end date','لا زيارات إيجابية أو مجهولة حتى تاريخ النهاية'))}
 </div><section class="panel presence-time-panel"><div class="panel-head"><h2>${T('Presence over time','التواجد عبر الزمن')}</h2><span class="tag">${T('Cumulative total','الإجمالي التراكمي')}: ${fmt(report.cumulativeCount)}</span><button data-tab="presencetrends">${T('Presence Dashboard','داشبورد التواجد')} ↗</button></div><p>${T('Presence = Yes to the Gorilla question OR a positive SKU facing count. Cumulative clients keep other filters but start at the first recorded date.','التواجد = نعم لسؤال جوريلا أو وجود صنف بواجهات أكبر من صفر. التراكمي يحتفظ ببقية الفلاتر ويبدأ من أول تاريخ مسجل.')}</p>
 <div class="table-wrap"><table><thead><tr><th>${T('Date','التاريخ')}</th><th>${T('Clients with Gorilla that day','عملاء بها جوريلا في اليوم')}</th><th>${T('Cumulative distinct clients','العملاء الفريدون تراكميًا')}</th></tr></thead><tbody>${report.trend.map(d=>`<tr><td><button class="link-button" data-filter="_date" data-value="${d.date}">${d.date}</button></td><td>${fmt(d.present)}</td><td>${fmt(d.cumulative)}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="panel"><div class="panel-head"><h2>${T('Client follow-up','متابعة العملاء')}</h2><div class="actions"><select id="presence-mode" aria-label="${T('Presence view','عرض التواجد')}">${Object.entries(PRESENCE_MODES).map(([k,v])=>`<option value="${k}" ${k===mode?'selected':''}>${T(...v)}</option>`).join('')}</select><button class="accent" data-presence-export="xlsx">${T('Export these stores','تصدير هذه المحلات')}</button></div></div>
 ${mode==='repeated'||mode==='never'?`<p>${T('Blank data does not count as absence. Duplicate timestamps count once; known positive evidence overrides conflicting duplicate absence. “Never” checks full workbook history through the end date.','البيانات الفارغة ليست غيابًا. التوقيت المكرر يُحسب مرة واحدة، ودليل التواجد يمنع احتساب نسخة متعارضة كغياب. «لم يظهر مطلقًا» يفحص تاريخ الملف كله حتى تاريخ النهاية.')}</p>`:''}
 ${followUpTable(shown,report,{T,esc,fmt,lang})}${outlets.length?pagination(outlets.length):`<p class="empty">${T('No matching stores in the available history.','لا توجد محلات مطابقة في التاريخ المتاح.')}</p>`}
 <small>${fmt(selected.length)} ${T('matching visits · export includes every visit and all source fields plus SKU detail.','زيارة مطابقة · التصدير يشمل كل زيارة وجميع حقول المصدر وتفاصيل الأصناف.')}</small></section>`;
}

export function enrichedPresenceRows(rs,report,lang='en') {
 return rs.map(r=>{
  const bits=skuPresence(r);
  const original={...Object.fromEntries(Object.entries(r).filter(([k])=>!k.startsWith('_'))),...Object.fromEntries(SKU.map((name,i)=>[name+' · present',bits[i]])),'Total present / 6':bits.reduce((a,b)=>a+b,0)};
  const absent=report.absences.get(r._id)||[];
  return {...original,'Gorilla presence':answerText(r._presence,lang),'SKU count':r._skuCount,'SKU data complete':r._skus.every(s=>s.quantity!==null)?'Yes':'No','SKU names':r._skus.filter(s=>s.quantity>0).map(s=>s.name).join(' | '),...Object.fromEntries(r._skus.map(s=>[s.name+' · observed facings',s.quantity])),'Presence conflict':r._presenceConflict?'Yes':'No','Absent visit count in period':absent.length,'Absence dates in period':absent.map(visitStamp).join(' | '),'Open Location':googleMapsUrl(r)||''};
 });
}

export function inlineHistory(id,all,{T,esc,fmt,lang,simpleTable,photoCard,photosFor}) {
 const visits=all.filter(r=>r._id===id).sort((a,b)=>visitStamp(b).localeCompare(visitStamp(a))),r=latest(visits)[0];
 if(!r)return '';
 const positive=visits.filter(r=>r._presence===true),negative=distinctVisits(visits).filter(r=>r._presence===false);
 return `<section class="panel inline-history" id="store-history" aria-label="${T('Selected store history','تاريخ المحل المختار')}"><div class="panel-head"><div><h2>${esc(r.Client||id)}</h2><p>Client Code: ${esc(id)} · ${esc(r.RTM)} · ${esc(r.Governorate||'')}</p></div><button id="close-history" aria-label="${T('Close history','إغلاق التاريخ')}">×</button></div>
 <div class="actions"><span>${fmt(positive.length)} ${T('visits with Gorilla','زيارة بها جوريلا')} · ${fmt(negative.length)} ${T('distinct absent visits','زيارات غياب مميزة')}</span><button class="accent" id="export-store">${T('Export positive visits · all fields','تصدير زيارات التواجد · كل الحقول')}</button>${googleMapsUrl(r)?`<a target="_blank" rel="noopener noreferrer" href="${googleMapsUrl(r)}">${T('Open Location','افتح اللوكيشن')}</a>`:''}</div>
 <p class="history-scope">${T('Full history available in All, outside the current filters. Only visits with Gorilla are listed below. Quantities are observed facings, not stock units.','التاريخ المتاح في All كاملًا، خارج الفلاتر الحالية. أدناه الزيارات التي ظهر فيها جوريلا فقط. الأعداد واجهات عرض مسجلة وليست مخزون عبوات.')}</p>
 <div class="table-wrap"><table><thead><tr><th>${T('Visit','الزيارة')}</th><th>TDM</th><th>${T('Status','الحالة')}</th><th>${T('SKU count','عدد الأصناف')}</th>${SKU.map(s=>`<th><span class="sku-dot" style="--flavor:${flavorColor(s)}"></span>${esc(s)}</th>`).join('')}</tr></thead><tbody>${positive.map(v=>`<tr><td>${esc(displayValue('Started At',v['Started At']||v.Date,lang))}</td><td>${esc(v.Rep)}</td><td>${esc(displayValue('حالة الزيارة',v['حالة الزيارة'],lang))}</td><td>${v._skuCount===null?T('Unknown','غير معروف'):fmt(v._skuCount)}</td>${v._skus.map(s=>`<td>${fmt(s.quantity)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${!positive.length?`<p class="empty">${T('No positive Gorilla visits recorded for this store.','لا توجد زيارات مسجلة بتواجد جوريلا لهذا المحل.')}</p>`:''}
 <details><summary>${T('All visits and latest store details','كل الزيارات وبيانات المحل الأخيرة')}</summary>${simpleTable(visits,['Date','Started At','Ended At','Rep','حالة الزيارة','Duration (min)'])}<div class="details">${Object.entries(r).filter(([k])=>!k.startsWith('_')).map(([k,v])=>`<div><small>${esc(k)}</small>${esc(displayValue(k,v,lang))}</div>`).join('')}</div></details>
 <details><summary>${T('Store photos','صور المحل')}</summary><div class="gallery">${photosFor(visits).map(photoCard).join('')}</div></details></section>`;
}
