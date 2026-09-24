import {POSM,BRANDS,num,sum,latest,group,cycleInfo} from './analytics.mjs?v=1530';
import {periodMetrics} from './trends.mjs?v=1530';
import {STATUS_FIELD,GORILLA_QUESTION,JUHAYNA_QUESTION} from './presentation.mjs';
const DAY=86400000,day=s=>Math.floor(Date.parse(s+'T12:00:00Z')/DAY),iso=n=>new Date(n*DAY).toISOString().slice(0,10);
const palette=['#2563eb','#f59e0b','#e11d48','#0d9488'];
const CORE_RTMS=['Giza','East Cairo','West Cairo','Alex & North Coast'];
const RTM_COLORS={'Giza':'#2563eb','East Cairo':'#f59e0b','West Cairo':'#0d9488','Alex & North Coast':'#e11d48'};
const isFriday=n=>new Date(n*DAY).getUTCDay()===5;
const cycleWorkdays=start=>Array.from({length:14},(_,i)=>start+i).filter(n=>!isFriday(n));
export function visitSeries(rows,by='cycle',selection=[]){
 const valid=rows.filter(r=>r._date),period=by==='cycle'||by==='month',key=r=>by==='cycle'?cycleInfo(r._date).start:by==='month'?r._date.slice(0,7):String(r[by]??'—');
 const buckets=new Map();for(const r of valid){const k=key(r);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r);}
 const options=[...buckets.keys()].sort((a,b)=>period?a.localeCompare(b):buckets.get(b).length-buckets.get(a).length||a.localeCompare(b));
 const chosen=[...new Set(selection)].filter(k=>buckets.has(k)).slice(0,4);if(!chosen.length)chosen.push(...(period?options.slice(-4):options.slice(0,4)));
 if(!valid.length)return {options,chosen,series:[],labels:[],relative:period};
 const dates=valid.map(r=>r._date).sort(),first=day(dates[0]),last=day(dates.at(-1));
 // Large historical ranges use weekly/monthly bins; period comparisons align relative days.
 const span=last-first+1,bin=period?1:span>730?30:span>120?7:1;
 const count=by==='cycle'?12:by==='month'?31:Math.ceil(span/bin);
 const labels=Array.from({length:count},(_,i)=>period?String(i+1):iso(first+i*bin));
 const series=chosen.map((k,index)=>{const start=by==='cycle'?day(k):by==='month'?day(k+'-01'):first;
  return {key:k,color:palette[index],start,values:Array(count).fill(0),rows:buckets.get(k)};
 });
 for(const s of series){let end=last;if(by==='cycle')end=s.start+13;if(by==='month')end=Math.floor(Date.UTC(Number(s.key.slice(0,4)),Number(s.key.slice(5,7)),0)/DAY);
  if(by==='cycle'){
   const workdays=cycleWorkdays(s.start);s.workDates=workdays.map(iso);s.values=workdays.map(d=>d<first||d>last||d>end?null:0);
   const index=new Map(workdays.map((d,i)=>[d,i]));for(const r of s.rows){const dn=day(r._date),i=index.get(dn);if(i!==undefined)s.values[i]=(s.values[i]??0)+1;}
  }else{
   s.values=s.values.map((_,i)=>{const d=s.start+i*bin;return d<first||d>last||d>end?null:0;});
   for(const r of s.rows){const i=Math.floor((day(r._date)-s.start)/bin);if(i>=0&&i<count)s.values[i]=(s.values[i]??0)+1;}
  }delete s.rows;
 }
 return {options,chosen,series,labels,relative:period,bin};
}
export function rtmShares(rows){const clean=rows.filter(r=>CORE_RTMS.includes(r.RTM)),counts=CORE_RTMS.map(name=>[name,clean.filter(r=>r.RTM===name).length]).filter(([,v])=>v>0),total=clean.length;return counts.map(([name,value])=>({name,value,share:total?value/total:0,color:RTM_COLORS[name]}));}
export function posmTotals(stores){return POSM.filter(key=>stores.some(r=>Object.hasOwn(r,key))).map(key=>[key,stores.some(r=>num(r[key])!==null)?sum(stores,key):null]).sort((a,b)=>(b[1]??-1)-(a[1]??-1));}
let observer=null,trendState={by:'cycle',selected:[]};
export function mountRoyal({rs,filters,mode,esc,fmt,T,display}){
 observer?.disconnect();observer=null;
 const root=document.querySelector('#view'),dashboard=Boolean(root?.querySelector('.mock-kpis'));
 document.body.classList.toggle('royal-page',dashboard);
 const logout=document.querySelector('#logout'),bottom=document.querySelector('.sidebar-bottom');if(logout&&bottom){logout.innerHTML=icon('logout')+'<span>'+T('Sign out','تسجيل الخروج')+'</span>';bottom.append(logout);}
 const refresh=document.querySelector('#refresh');if(refresh)refresh.innerHTML=icon('sync')+'<span>'+T('Data Sync','مزامنة البيانات')+'</span>';
 const slogan=document.querySelector('.sidebar-slogan');if(slogan)slogan.innerHTML='POWER YOUR<br><span>FIELD INSTINCT</span>';
 document.querySelectorAll('.nav-item').forEach(button=>{const span=button.querySelector('span');if(span)span.innerHTML=icon(button.dataset.tab);});
 if(!dashboard)return;
 const oldGrid=root.querySelector('.mock-chart-grid'),trend=oldGrid.querySelector('.trend-panel'),tdm=oldGrid.lastElementChild,comparison=root.querySelector('.comparison-panel'),quick=root.querySelector('.dashboard-quick'),kpis=root.querySelector('.mock-kpis');
 kpis.after(quick);const filterDrawer=root.querySelector('.dashboard-filters');quick.after(filterDrawer);
 oldGrid.className='royal-grid';oldGrid.replaceChildren(trend,comparison);tdm.classList.add('royal-tdms');
 const periods=periodMetrics(rs,mode,filters),stores=latest(rs.filter(r=>r._success===1)),charts=[];
 const panel=(title,subtitle='')=>{const node=document.createElement('section');node.className='mock-panel royal-panel';node.innerHTML=`<div class="mock-panel-head"><h2>${title}</h2><small>${subtitle}</small></div>`;return node;};
 const drawLines=(el,series,labels,{relative=false,percent=false,unit=T('Visits','الزيارات')}={})=>{
  const w=Math.max(180,el.clientWidth),h=Math.max(120,el.clientHeight),l=48,r=14,t=23,b=32,pw=w-l-r,ph=h-t-b;
  const maximum=Math.max(1,...series.flatMap(s=>s.values.filter(v=>v!==null))),step=percent?25:Math.max(1,Math.ceil(maximum/4)),max=step*4,x=i=>l+(labels.length<2?pw/2:i*pw/(labels.length-1)),y=v=>t+ph-v/max*ph;
  let out=`<text x="${l}" y="12">${esc(unit)}</text>`;
  for(let i=0;i<5;i++){const v=i*step;out+=`<line x1="${l}" x2="${w-r}" y1="${y(v)}" y2="${y(v)}" class="royal-gridline"/><text x="${l-8}" y="${y(v)+4}" text-anchor="end">${esc(fmt(v))}${percent?'%':''}</text>`;}
  series.forEach(s=>{let connected=false;const path=s.values.map((v,i)=>{if(v===null){connected=false;return '';}const p=(connected?'L':'M')+x(i)+' '+y(v);connected=true;return p;}).join(' ');out+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3"/>`;s.values.forEach((v,i)=>{if(v!==null){const actual=s.workDates?.[i],tip=actual?`${s.name||s.key||''} · ${T('Working Day ','يوم عمل ')}${labels[i]} · ${actual} — ${fmt(v)}`:`${s.name||s.key||''}: ${labels[i]} — ${fmt(v)}`;out+=`<circle cx="${x(i)}" cy="${y(v)}" r="3.4" fill="${s.color}"><title>${esc(tip)}</title></circle>`;}});});
  [...new Set([0,Math.floor((labels.length-1)/2),labels.length-1])].filter(i=>i>=0).forEach(i=>{out+=`<text x="${x(i)}" y="${h-6}" text-anchor="${i===0?'start':i===labels.length-1?'end':'middle'}">${esc(relative?T('Day ','يوم ')+labels[i]:labels[i])}</text>`;});
  el.innerHTML=labels.length?`<svg class="scaled-trend royal-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(unit)}">${out}</svg>`:`<p class="empty">${T('No dated observations','لا توجد زيارات مؤرخة')}</p>`;
 };
 const plot=node=>{const el=document.createElement('div');el.className='royal-plot';node.append(el);return el;};
 const horizontal=(node,items,key)=>{const max=Math.max(1,...items.map(x=>x[1]??0));node.insertAdjacentHTML('beforeend',`<div class="royal-bars">${items.map(([n,v])=>`<${key?'button':'div'} class="royal-bar" ${key?`data-filter="${esc(key)}" data-value="${esc(n)}"`:''}><span>${esc(n)}</span><span class="royal-track"><i style="width:${(v??0)/max*100}%"></i></span><b>${esc(fmt(v))}</b></${key?'button':'div'}>`).join('')||`<p class="empty">${T('No measurements','لا توجد قياسات')}</p>`}</div>`);};
 const columns=(el,items,percent=false)=>{const w=Math.max(180,el.clientWidth),h=Math.max(130,el.clientHeight),l=48,r=10,t=24,b=42,max=percent?100:Math.max(1,...items.map(x=>x[1]??0)),step=(w-l-r)/Math.max(1,items.length),ph=h-t-b,bw=Math.min(32,step*.52);let out='';[0,.5,1].forEach(v=>{const y=t+ph-v*ph;out+=`<line x1="${l}" x2="${w-r}" y1="${y}" y2="${y}" class="royal-gridline"/><text x="${l-7}" y="${y+4}" text-anchor="end">${esc(fmt(v*max))}${percent?'%':''}</text>`;});items.forEach(([name,value],i)=>{const x=l+step*(i+.5),height=(value??0)/max*ph;out+=`<rect x="${x-bw/2}" y="${t+ph-height}" width="${bw}" height="${height}" rx="3" fill="var(--accent)"><title>${esc(name)}: ${esc(fmt(value))}</title></rect><text x="${x}" y="${h-16}" text-anchor="middle">${esc(String(name).length>12?String(name).slice(0,10)+'…':name)}</text>`;});el.innerHTML=items.length?`<svg class="royal-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(T('Period or territory comparison','مقارنة الفترات أو المناطق'))}">${out}</svg>`:`<p class="empty">${T('No measurements','لا توجد قياسات')}</p>`;};
 trend.innerHTML=`<div class="mock-panel-head"><div><h2>${T('Visits Trend','اتجاه الزيارات')}</h2><small>${T('Cycle comparison uses working days only · Fridays excluded','مقارنة السايكل تعتمد أيام العمل فقط · الجمعة مستبعدة')}</small></div><small>${T('Up to 4 comparisons','حتى ٤ مقارنات')}</small></div><label class="royal-compare-label">${T('Compare by','المقارنة حسب')} <select id="royal-trend-group">${[['cycle',T('Cycle','السايكل')],['month',T('Month','الشهر')],['RTM','RTM'],['Rep','TDM'],[STATUS_FIELD,T('Visit status','حالة الزيارة')],['Governorate',T('Governorate','المحافظة')],['Area Name',T('Area','المنطقة')],['Outlet Type',T('Outlet type','نوع المحل')],[GORILLA_QUESTION,T('Gorilla question','سؤال جوريلا')],[JUHAYNA_QUESTION,T('Juhayna question','سؤال جهينة')]].map(([k,n])=>`<option value="${esc(k)}" ${trendState.by===k?'selected':''}>${n}</option>`).join('')}</select></label><div class="royal-series-controls"></div>`;
 const linePlot=plot(trend);trend.insertAdjacentHTML('beforeend',`<small class="royal-trend-note"></small>`);
 const seriesControls=trend.querySelector('.royal-series-controls');let model;
 const describe=k=>trendState.by==='cycle'?cycleInfo(k).label:display(trendState.by,k);
 function updateTrend(){model=visitSeries(rs,trendState.by,trendState.selected);trendState.selected=model.chosen;
  seriesControls.innerHTML=[0,1,2,3].map((slot)=>{const s=model.series[slot],vals=(s?.values||[]).filter(v=>v!==null),total=vals.reduce((a,b)=>a+b,0),avg=vals.length?total/vals.length:0;return `<label class="royal-series-card"><i style="background:${palette[slot]}"></i><span><select data-royal-series="${slot}" aria-label="${esc(T('Comparison ','المقارنة ')+(slot+1))}"><option value="">${T('None','بدون')}</option>${model.options.map(k=>`<option value="${esc(k)}" ${model.chosen[slot]===k?'selected':''} ${model.chosen.includes(k)&&model.chosen[slot]!==k?'disabled':''}>${esc(describe(k))}</option>`).join('')}</select>${s?`<small><b>${fmt(total)}</b> ${T('Visits','زيارة')} · ${T('Avg','متوسط')} ${fmt(avg,0)} / ${trendState.by==='cycle'?T('Working Day','يوم عمل'):T('Point','نقطة')}</small>`:''}</span></label>`}).join('');
  trend.querySelector('.royal-trend-note').textContent=model.relative?(trendState.by==='cycle'?T('Aligned working days · Fridays excluded from trend and averages · active filters apply','أيام العمل متقابلة · الجمعة مستبعدة من الترند والمتوسط · طبقًا للفلاتر'):T('Aligned days within each period · active filters apply','أيام متقابلة داخل كل فترة · طبقًا للفلاتر')):T('Same dates · active filters apply','نفس التواريخ · طبقًا للفلاتر');drawTrend();
 }
 function drawTrend(){drawLines(linePlot,model.series.map(s=>({...s,name:describe(s.key)})),model.labels,{relative:model.relative});}
 trend.querySelector('#royal-trend-group').onchange=e=>{trendState={by:e.target.value,selected:[]};updateTrend();};
 seriesControls.onchange=e=>{const slot=Number(e.target.dataset.royalSeries);if(!Number.isInteger(slot))return;const keys=[...model.chosen];keys[slot]=e.target.value;trendState.selected=keys.filter(Boolean);updateTrend();};updateTrend();charts.push(drawTrend);
 // Keep the existing full period table in the dedicated Presence Dashboard.
 comparison.classList.add('royal-panel');const select=comparison.querySelector('#comparison-mode');comparison.replaceChildren();comparison.innerHTML=`<div class="mock-panel-head"><h2>${T('Period comparisons','مقارنات الفترات')}</h2></div><small>${T('Stores with Gorilla · latest visit per period','محلات بها جوريلا · آخر زيارة في كل فترة')}</small>`;comparison.querySelector('.mock-panel-head').append(select);const cp=plot(comparison);charts.push(()=>columns(cp,periods.slice(-6).map(p=>[p.period,p.present])));
 comparison.insertAdjacentHTML('beforeend',`<button class="royal-text-link" data-tab="presence">${T('Open Gorilla Distribution','فتح انتشار جوريلا')} ↗</button>`);
 const posm=panel(T('POSM execution by type','الدعاية حسب النوع'),T('Latest store visits · units','آخر زيارات المحلات · وحدات'));posm.classList.add('royal-posm');horizontal(posm,posmTotals(stores));oldGrid.append(posm);
 const territory=panel(T('POSM units by territory','وحدات الدعاية حسب المنطقة'),T('Latest store visits','آخر زيارات المحلات'));const tp=plot(territory),territories=group(stores.filter(r=>r._posm!==null),'RTM','_posm');charts.push(()=>columns(tp,territories));oldGrid.append(territory);
 const market=panel(T('Competitive shelf landscape','واجهات المنافسين'),T('Latest store visits · facings','آخر زيارات المحلات · واجهات'));horizontal(market,[['Gorilla',stores.some(r=>r._gorilla!==null)?sum(stores,'_gorilla'):null],...BRANDS.filter(b=>stores.some(r=>Object.hasOwn(r,b))).map(b=>[b,stores.some(r=>num(r[b])!==null)?sum(stores,b):null])],'_brand');oldGrid.append(market);
 const presence=panel(T('Gorilla Distribution','انتشار جوريلا'),T('Known presence % · successful visits only','نسبة التواجد المعروف · الزيارات الناجحة فقط'));const pp=plot(presence);charts.push(()=>drawLines(pp,[{values:periods.map(p=>p.rate===null?null:p.rate*100),color:palette[0]}],periods.map(p=>p.period),{percent:true,unit:T('Presence %','التواجد %')}));presence.insertAdjacentHTML('beforeend',`<button class="royal-text-link" data-tab="presence">${T('Open Gorilla Distribution','فتح انتشار جوريلا')} ↗</button>`);oldGrid.append(presence);
 const shares=rtmShares(rs),rtm=panel(T('RTM share of visits','حصة RTM من الزيارات'),T('Core RTMs only','الـ RTMs الأربعة الأساسيين فقط'));let offset=0;const stops=shares.map(s=>{const start=offset;offset+=s.share*100;return `${s.color} ${start}% ${offset}%`;});const shareTotal=shares.reduce((a,s)=>a+s.value,0);rtm.innerHTML+=`<div class="royal-donut-wrap"><div class="royal-donut" style="background:conic-gradient(${stops.join(',')||'var(--line) 0 100%'})" role="img" aria-label="${esc(T('RTM share of all filtered visits','حصة المناطق من كل الزيارات المصفاة'))}"><div><b>${fmt(shareTotal)}</b><small>${T('Total Visits','إجمالي الزيارات')}</small></div></div><div class="royal-donut-legend">${shares.map(s=>`<button data-filter="RTM" data-value="${esc(s.name)}"><i style="background:${s.color}"></i><span>${esc(s.name)}</span><span class="royal-share-visits">${fmt(s.value)}</span><b>${fmt(s.share*100,1)}%</b></button>`).join('')}</div></div>`;oldGrid.append(rtm,tdm);
 observer=new ResizeObserver(()=>charts.forEach(draw=>draw()));observer.observe(oldGrid);charts.forEach(draw=>draw());
}
function icon(key){const paths={dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',presence:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',geo:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',health:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',notifications:'<path d="M18 8a6 6 0 0 0-12 0c0 6-3 9-3 9h18s-3-3-3-9M10 21h4"/>',logout:'<path d="M9 3H3v18h6m5-14 5 5-5 5m-8-5h13"/>',sync:'<path d="M20 7a9 9 0 0 0-15-2L2 8m0-6v6h6m-4 9a9 9 0 0 0 15 2l3-3m0 6v-6h-6"/>',settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>',photos:'<path d="M3 7h5l2-3h4l2 3h5v14H3Z"/><circle cx="12" cy="13" r="4"/>',execution:'<path d="M5 21V3h14l-3 5 3 5H5"/>',newstores:'<path d="M12 5v14M5 12h14"/><path d="M4 4h16v16H4Z"/>',stores:'<path d="m3 9 2-6h14l2 6M5 10v11h14V10M9 21v-7h6v7M3 9h18"/>',availability:'<path d="m3 7 9-5 9 5-9 5Zm0 0v10l9 5 9-5V7M12 12v10"/>',users:'<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m1-18a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 5v2"/>',reports:'<path d="M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8M8 16h8"/>',presencetrends:'<path d="M3 3v18h18M6 16l4-6 4 3 6-8"/>'};return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[key]||paths[key==='performance'?'users':key==='market'?'presencetrends':'reports']}</svg>`;}
