import {D} from './voice-vocabulary.mjs?v=1520';
import {latest,num,cycleInfo,health,SKU,POSM} from './analytics.mjs';
import {triState,formatDuration} from './presentation.mjs';
export const normalizeText=s=>String(s??'').toLowerCase().replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\u0600-\u06ffa-z0-9]+/gi,' ').replace(/\s+/g,' ').trim();
const articles=s=>s.split(' ').map(w=>/^[\u0600-\u06ff]+$/.test(w)?w.replace(/^(?:بال|وال|ال)(?=.{3})/,''):w).join(' ');
const hasPhrase=(text,term)=>(' '+text+' ').includes(' '+normalizeText(term)+' ')||(' '+articles(text)+' ').includes(' '+articles(normalizeText(term))+' ');
const skuKeys=['SKU_ULTIMATE_250','SKU_ULTIMATE_500','SKU_MANGO_250','SKU_MANGO_500','SKU_WATERMELON_250','SKU_WATERMELON_500'];
const fieldAliases={POSTERS:['Posters'],TRANSPARENT_POSTERS:['Transparent Posters'],PARASITE_RACK:['Parasite Rack'],SHELF_TALKER:['Shelf Talker'],COUNTER_TOP:['Counter Top'],SHELF_STRIPE:['Shelf Stripe'],STICKER_3_PACK:['Sticker 3 Pack'],PALLET_WRAP:['Pallet Wrap'],STOPPER:['Stopper'],PUSH_PULL:['Push & Pull Door Sticker'],SHELF_IN_SHELF:['Shelf in Shelf'],CARTON_DISPLAY:['Carton Display'],COMP_REDBULL:['Redbull'],COMP_MONSTER:['Monster'],COMP_POWER_HORSE:['Power Horse'],COMP_STING:['Sting'],COMP_FURY:['Fury'],COMP_TWIST:['Twist'],GORILLA_COOLER:['هل يوجد ثلاجه جوريلا لدى العميل؟'],JUHAYNA_COOLER:['تواجد ثلاجة جهينة'],STRONG_STORE:['محل قوى'],COOLER_RECOMMEND:['هل ترشح المحل للحصول على ثلاجه جوريلا ؟'],PRICE_250:['سعر جوريلا 250 مل'],PRICE_500:['سعر جوريلا 500 مل'],STORE_CLASS:['تصنيف المحل'],STORE_TYPE:['نوع المحل','Outlet Type'],VISIT_STATUS:['حالة الزيارة'],JUHAYNA_PRODUCTS:['حضرتك بتتعامل فى منتجات جهينة'],JUHAYNA_SOURCE:['حضرتك بتجيب منتجات جهينة منين'],JUHAYNA_REP:['هل مندوب جهينة بيعدى عليك'],WHOLESALER:['أسم تاجر الجملة اللى حضرتك بتتعامل معاه'],PRICING:['هل يوجد اي تسعير على اي نقطه بيع لمنتجات جوريلا في المكان ؟'],PLANOGRAM:['هل Portfolio الخاص بمنتجات جوريلا مطبق في العرض الرئيسي حسب البلانوجرام ؟'],HOTSPOT:['منتجات جوريلا معروضة فى مكان ظاهر وواضح (Hotspot)'],NOTES:['ملاحظات عامة'],DURATION:['_duration'],START_TIME:['Started At'],END_TIME:['Ended At']};
const generic=new Set(['REPORT','EXPORT_REPORT','EXPORT','SHOW','COUNT','TOP','BOTTOM','BEST','WORST','TOP_N','BOTTOM_N','BY','GROUP','SORT','ONLY','TDM','RTM','STORE','VISIT','GORILLA','PRODUCT','PRESENCE','GORILLA_PRESENCE','AVAILABILITY','AVAILABILITY_FIELD','WITH','WITHOUT','GIZA','EAST','WEST','ALEX','CAIRO','TODAY','YESTERDAY','THIS_WEEK','LAST_WEEK','LAST_TWO_WEEKS','WEEK1','WEEK2','CYCLE1','CYCLE2','DETAILS','CLIENT_CODE','CLIENT_ID','GOVERNORATE','AREA','SUPERVISOR','DM','FACING','POSM','ERROR','MAIN_DISPLAY','COLD_DISPLAY','HOT_DISPLAY',...skuKeys]);
export function identify(text){const z=normalizeText(text),hits=[];for(const [key,aliases] of Object.entries(D)){if(aliases.some(a=>hasPhrase(z,a)))hits.push(key);}return hits;}
const columnFor=(concept,columns)=>{const aliases=[...(fieldAliases[concept]||[]),...(D[concept]||[])];return columns.find(c=>aliases.some(a=>normalizeText(a)===normalizeText(c)));};
const isoDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const shift=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export function parseRequest(text,{columns=[],rows=[],now=new Date()}={}){
 const z=normalizeText(text),keys=identify(text),has=k=>keys.includes(k),issues=[];
 if(/^(صباح الخير|مساء الخير|ازيك|شكرا|تسلم|hello|hi|thanks)$/.test(z))return {smalltalk:'أهلًا! اسألني عن التواجد أو الزيارات أو الأصناف، والنتيجة من البيانات الحالية.'};
 const plan={text,keys,metric:'',field:'',group:has('TDM')?'Rep':has('RTM')?'RTM':'',rank:has('BEST')||has('TOP')?'best':has('WORST')||has('BOTTOM')?'worst':'',limit:1,absent:has('WITHOUT')||/مفيهوش|معندوش|ماعندوش|مافيهوش/.test(z),rate:/نسبه|percentage|percent|rate/.test(z),filters:[],conditions:[],from:'',to:'',issues};
 if((has('BEST')||has('TOP'))&&(has('WORST')||has('BOTTOM')))issues.push('حدد ترتيبًا واحدًا: الأعلى أم الأقل؟');
 const n=z.match(/(?:احسن|افضل|اسوا|اوحش|اضعف|اعلي|اعلى|اقل|اكتر|اول|اخر|top|bottom|best|worst)\s+(\d+)/);if(n)plan.limit=Math.min(100,Math.max(1,Number(n[1])));
 if(has('SUPERVISOR')||has('DM')){plan.group=columnFor(has('SUPERVISOR')?'SUPERVISOR':'DM',columns)||'';if(!plan.group)issues.push('عمود المشرف/المدير غير موجود في البيانات الحالية.');}
 if(has('COMPARE')||has('EXCEPT')||has('SAME_RESULT'))issues.push('المقارنة والاستثناء والرجوع لنتيجة سابقة تحتاج طلبًا محددًا مستقلًا في هذه النسخة.');
 if(has('NEW_STORE')||has('MISSING')||has('COVERAGE'))issues.push('المفهوم ده محتاج تعريفًا أو مصدرًا إضافيًا؛ مش هعتبر عدد الزيارات تغطية للعملاء.');
 const skuHits=skuKeys.filter(has);if(skuHits.length>1)issues.push('اختر صنفًا واحدًا للتقرير، أو اطلب كل الأصناف من صفحة Availability.');
 if(skuHits.length){plan.sku=SKU[skuKeys.indexOf(skuHits[0])];plan.metric=has('FACING')?'facings':'presence';}
 else if(/مانجو|mango|بطيخ|watermelon|التيميت|التميت|ultimate/.test(z))issues.push('حدد حجم الصنف: 250 أم 500 مل؟');
 if(!plan.metric&&(has('PRESENCE')||has('GORILLA_PRESENCE')||has('AVAILABILITY')||has('GORILLA')&&plan.absent))plan.metric='presence';
 if(has('ERROR'))plan.metric='errors';
 if(!plan.metric&&has('VISIT'))plan.metric='visits';
 if(has('FACING')&&!plan.sku){plan.metric='field';plan.field='_gorilla';}
 const displays=['MAIN_DISPLAY','COLD_DISPLAY','HOT_DISPLAY'].filter(has);if(displays.length>1)issues.push('حدد نوع عرض واحدًا.');
 if(displays.length){if(!plan.sku)issues.push('حدد الصنف والحجم المطلوب داخل العرض.');else{const names={MAIN_DISPLAY:'',COLD_DISPLAY:' [2]',HOT_DISPLAY:' [3]'};const rawSku=plan.sku.replace('Watermelon','Watermelon-Melon');const expected='Gorilla '+rawSku+' Facing Count'+names[displays[0]];plan.field=columns.find(c=>normalizeText(c)===normalizeText(expected));if(!plan.field)issues.push('عمود الصنف داخل نوع العرض المطلوب غير موجود.');}}
 // Prefer longer, specific concepts over their contained general aliases.
 if(has('TRANSPARENT_POSTERS'))keys.splice(keys.indexOf('POSTERS'),keys.includes('POSTERS')?1:0);
 if(keys.some(k=>k.endsWith('_COOLER'))){for(const k of [...keys])if(k.startsWith('COMP_'))keys.splice(keys.indexOf(k),1);}
 const conditionKeys=['STRONG_STORE','COOLER_RECOMMEND'];
 for(const k of conditionKeys.filter(has)){const field=columnFor(k,columns);if(field)plan.conditions.push({field});else issues.push('عمود '+(D[k]?.[0]||k)+' غير موجود.');}
 const specifics=keys.filter(k=>!generic.has(k)&&!conditionKeys.includes(k));
 const fields=[...new Set(specifics.map(k=>{const field=columnFor(k,columns);if(!field)issues.push('فهمت '+(D[k]?.[0]||k)+' لكن لا يوجد عمود مطابق مؤكد.');return field;}).filter(Boolean))];
 if(fields.length>1)issues.push('الطلب فيه أكثر من مقياس. اختر واحدًا للتقرير الحالي.');
 if(fields.length===1){plan.metric='field';plan.field=fields[0];}
 if(!plan.metric){const exact=columns.filter(c=>!c.startsWith('_')&&hasPhrase(z,c));if(exact.length===1){plan.metric='field';plan.field=exact[0];}else if(exact.length>1)issues.push('اختر عمودًا واحدًا للتحليل.');}
 if(/ثلاج|cooler/.test(z)&&!keys.some(k=>/COOLER/.test(k)))issues.push('حدد نوع الثلاجة بوضوح؛ مثال: ثلاجة جوريلا.');
 plan.aggregation=has('PRICE_250')||has('PRICE_500')||has('DURATION')?'average':'sum';
 if(plan.aggregation==='average'&&plan.rank&&/احسن|افضل|اسوا|اوحش/.test(z))issues.push('حدد أعلى أم أقل متوسط سعر/مدة، بدل أفضل أو أسوأ.');
 if(!plan.metric&&has('POSM')){plan.metric='field';plan.field='_posm';}
 if(!plan.metric&&has('STORE'))plan.metric='stores';
 if(!plan.metric&&plan.conditions.length)plan.metric='stores';
 if(!plan.metric)issues.push('حدد المطلوب: تواجد صنف، زيارات، محلات، أخطاء، أو عمود بعينه.');
 if(plan.rank&&!plan.group)issues.push('مين المطلوب ترتيبه: المناديب أم RTM؟');
 if(plan.rate&&plan.metric!=='presence')issues.push('النسبة مدعومة هنا لتواجد جوريلا أو صنف محدد؛ حدد مقام النسبة للمقاييس الأخرى.');
 const geoAliases={GIZA:['giza','جيزه'],EAST:['east','شرق'],WEST:['west','غرب'],ALEX:['alex','alexandria','اسكندريه'],CAIRO:['cairo','قاهره']};
 for(const k of Object.keys(geoAliases).filter(has)){const values=[...new Set(rows.map(r=>String(r.RTM||'')))].filter(v=>geoAliases[k].some(a=>normalizeText(v).includes(a)));if(!values.length)issues.push('لا توجد منطقة مطابقة لـ'+D[k][0]+' داخل البيانات المسموحة والفلاتر الحالية.');else plan.filters.push({field:'RTM',values});}
 // Exact person/area names are discovered only in the already scoped data.
 for(const field of ['Rep','Area Name','Governorate']){const values=[...new Set(rows.map(r=>String(r[field]||'')))].filter(v=>v.length>2&&hasPhrase(z,v));if(values.length)plan.filters.push({field,values});}
 const statusRules=[[/ناجح|successful/,'زيارة ناجحة'],[/مغلق|closed/,'مغلق'],[/رفض|refus/,'رفض']];
 for(const [pattern,label] of statusRules){if(pattern.test(z)){const matches=[...new Set(rows.map(r=>String(r['حالة الزيارة']||'')))].filter(v=>pattern.test(normalizeText(v)));if(matches.length)plan.filters.push({field:'حالة الزيارة',values:matches});else issues.push('لا توجد حالة زيارة مطابقة لـ'+label+' في البيانات الحالية.');}}
 const dates=String(text).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).match(/\d{4}-\d{2}-\d{2}/g)||[];
 if(dates.length){if(dates.length>2||dates.some(d=>!Number.isFinite(Date.parse(d))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d))issues.push('اكتب تاريخًا صالحًا بصيغة YYYY-MM-DD.');else{plan.from=dates[0];plan.to=dates[1]||dates[0];if(plan.from>plan.to)issues.push('بداية الفترة بعد نهايتها.');}}
 const today=isoDate(now),weekDay=new Date(today+'T12:00:00Z').getUTCDay(),start=shift(today,-((weekDay+1)%7));
 const timeKeys=['TODAY','YESTERDAY','THIS_WEEK','LAST_WEEK','LAST_TWO_WEEKS'].filter(has);if(timeKeys.length>1||timeKeys.length&&dates.length)issues.push('حدد فترة زمنية واحدة.');
 if(has('TODAY'))plan.from=plan.to=today;if(has('YESTERDAY'))plan.from=plan.to=shift(today,-1);if(has('THIS_WEEK')){plan.from=start;plan.to=today;}if(has('LAST_WEEK')){plan.from=shift(start,-7);plan.to=shift(start,-1);}if(has('LAST_TWO_WEEKS')){plan.from=shift(today,-13);plan.to=today;}
 if(has('CYCLE1')||has('CYCLE2')){const wanted=has('CYCLE1')?1:2,cycles=[...new Set(rows.filter(r=>r._date&&cycleInfo(r._date)?.cycle===wanted).map(r=>cycleInfo(r._date).start))];if(cycles.length!==1)issues.push('رقم السايكل بيتكرر؛ اختر سايكل محدد من الفلاتر أو اكتب نطاق تاريخه.');else{plan.from=cycles[0];plan.to=cycleInfo(cycles[0]).end;}}
 if(has('WEEK1')||has('WEEK2'))plan.week=has('WEEK1')?1:2;
 plan.unclear=unclearTokens(text,keys,issues);
 return plan;
}
const STOPWORDS=new Set(['في','من','علي','عن','الي','إلى','و','او','أو','ال','يا','لو','ان','إن','مع','عند','هو','هي','انا','أنا','ايه','إيه','ده','دي','كام','فين','ليه','هل','دى','انت','إنت','عايز','عاوز','ممكن','لو سمحت','بقى','كده','the','a','an','of','in','on','for','and','or','to','is','are','me','my','please']);
// Best-effort: which words in the raw request weren't matched to any known concept/alias,
// so the UI can point at exactly the unclear part instead of a generic error.
function unclearTokens(text,keys,issues){
 if(!issues.length)return[];
 const z=normalizeText(text);
 const matchedWords=new Set();
 for(const k of keys)for(const a of (D[k]||[]))for(const w of normalizeText(a).split(' '))if(w)matchedWords.add(w);
 for(const c of Object.keys(fieldAliases))for(const a of fieldAliases[c])for(const w of normalizeText(a).split(' '))if(w)matchedWords.add(w);
 return [...new Set(z.split(' ').filter(w=>w.length>1&&!/^\d+$/.test(w)&&!STOPWORDS.has(w)&&!matchedWords.has(w)))];
}
export function runRequest(plan,{rows,columns=[],settings={}}){
 if(plan.issues.length)return {error:plan.issues.join('\n')};
 let rs=rows.filter(r=>(!plan.from||r._date>=plan.from)&&(!plan.to||r._date<=plan.to)&&(!plan.week||cycleInfo(r._date)?.week===plan.week)&&plan.filters.every(f=>f.values.includes(String(r[f.field]||''))));
 const dateRange=rs.map(r=>r._date).filter(Boolean).sort();
 const base=plan.metric==='visits'||plan.metric==='errors'?rs:latest(rs.filter(r=>r._id));
 const filtered=base.filter(r=>plan.conditions.every(c=>triState(r[c.field])===true));
 const evidence=r=>{if(plan.field){const v=num(r[plan.field]);return v===null?triState(r[plan.field]):v>0;}if(!plan.sku)return r._presence;const sku=r._skus?.find(s=>s.name===plan.sku);const quantity=sku?.quantity??num(r[plan.sku]);return quantity===null?null:quantity>0;};
 let values=filtered,records=[],matched=[];
 const grouped=new Map();for(const r of values){const key=plan.group?String(r[plan.group]||'—'):'الإجمالي';if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
 for(const [name,items] of grouped){let value=null,record={};
  if(plan.metric==='presence'){const present=items.filter(r=>evidence(r)===true),absent=items.filter(r=>evidence(r)===false),known=present.length+absent.length,selected=plan.absent?absent:present;value=plan.rate?(known?selected.length/known*100:null):selected.length;record={'محلات موجود':present.length,'محلات غير موجود':absent.length,'غير معروف':items.length-known,'نسبة التواجد %':known?Math.round(present.length/known*10000)/100:null};matched.push(...selected);}
  else if(plan.metric==='errors'){value=health(items,columns,settings).filter(i=>i.row&&i.severity!=='info').length;matched.push(...items);}
  else if(plan.metric==='visits'||plan.metric==='stores'){value=items.length;matched.push(...items);}
  else{const field=plan.field||'_gorilla',measure=plan.metric==='facings'&&!plan.field?items.map(r=>r._skus?.find(s=>s.name===plan.sku)?.quantity??null):items.map(r=>num(r[field]));const nums=measure.filter(v=>v!==null);
   if(nums.length){value=nums.reduce((a,b)=>a+b,0)/(plan.aggregation==='average'?nums.length:1);record={'طريقة الحساب':plan.aggregation==='average'?'متوسط':'مجموع','قياسات معروفة':nums.length,'قياسات ناقصة':items.length-nums.length};matched.push(...items);}
   else{const known=items.filter(r=>triState(r[field])!==null),selected=known.filter(r=>triState(r[field])===!plan.absent);if(known.length){value=selected.length;matched.push(...selected);}else if(!plan.rank){matched.push(...items);value=items.length;record={'نوع النتيجة':'عرض قيم العمود بدون جمع'};}else return {error:'العمود نصي أو بلا قياسات رقمية؛ لا يمكن ترتيب الأفضل تلقائيًا. اختر مقياسًا آخر.'};}
  }
  records.push({[plan.group||'النطاق']:name,'القيمة':value,...record});
 }
 const lowerBetter=plan.metric==='errors',ascending=plan.rank==='best'?lowerBetter:plan.rank==='worst'?!lowerBetter:false;
 records.sort((a,b)=>a['القيمة']===null?1:b['القيمة']===null?-1:(ascending?1:-1)*(a['القيمة']-b['القيمة']));
 if(plan.rank){records=records.filter(r=>r['القيمة']!==null);const boundary=records[plan.limit-1]?.['القيمة'];if(boundary!==undefined)records=records.filter((r,i)=>i<plan.limit||r['القيمة']===boundary);const winners=new Set(records.map(r=>r[plan.group]));matched=matched.filter(r=>winners.has(String(r[plan.group]||'—')));}
 const fieldLabel=plan.field?.startsWith('_')?'القياس المطلوب':plan.field;
 const detailColumns=[...new Set(['Client Code','Client','Rep','RTM','Date',...(plan.sku?[plan.sku]:[]),...(fieldLabel?[fieldLabel]:[])])];
 const details=matched.map(r=>Object.fromEntries(detailColumns.map(c=>[c,c===fieldLabel?(plan.field==='_duration'?formatDuration(r[plan.field]==null?null:r[plan.field]*60):r[plan.field]):c===plan.sku?r._skus?.find(s=>s.name===plan.sku)?.quantity??r[c]:r[c]])));
 if(plan.field==='_duration')records=records.map(r=>({...r,'القيمة':formatDuration(r['القيمة']===null?null:r['القيمة']*60)}));
 return {records,columns:[...new Set(records.flatMap(Object.keys))],details,detailColumns,count:filtered.length,dates:[dateRange[0],dateRange.at(-1)].filter(Boolean),metric:plan.metric,sku:plan.sku,rank:plan.rank,rate:plan.rate,field:plan.field,group:plan.group,note:plan.metric==='presence'?'كل عميل مرة واحدة بآخر زيارة في الفترة؛ يُنسب لمندوب آخر زيارة. العدد هو الأساس ما لم تطلب النسبة. الحالات غير المعروفة خارج مقام النسبة.':plan.metric==='errors'?'الترتيب بعدد ملاحظات جودة البيانات التحذيرية والحرجة؛ مش عدد الزيارات الخاطئة.':plan.metric==='visits'?'عدد سجلات الزيارات داخل النطاق.':'آخر زيارة لكل عميل داخل النطاق؛ القياسات الناقصة لا تُعتبر صفرًا.'};
}
