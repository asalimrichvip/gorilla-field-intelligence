import {parseRequest,runRequest} from './assistant-engine.mjs?v=1520';
export function mountAssistant({getContext,authorizeExport,exportResult,canPage,canExport}){
 const host=document.querySelector('.header-actions');if(!host)return()=>{};
 const button=document.createElement('button');button.id='gorilla-assistant';button.type='button';button.textContent='✦ Gorilla Assistant';button.setAttribute('aria-haspopup','dialog');host.prepend(button);
 const dialog=document.createElement('dialog');dialog.id='assistant-dialog';dialog.dir='rtl';dialog.setAttribute('aria-labelledby','assistant-heading');
 dialog.innerHTML='<header><h2 id="assistant-heading">مساعد جوريلا</h2><button type="button" data-close aria-label="إغلاق">×</button></header><p class="assistant-scope">النتائج من البيانات المسموحة لك والفلاتر الحالية. الفترة المكتوبة تضيق النطاق الحالي.</p><div class="assistant-conversation" aria-live="polite"></div><form><label for="assistant-query">اكتب طلبك أو استخدم الميكروفون</label><textarea id="assistant-query" rows="2" placeholder="أحسن مندوب في تواجد مانجو 250"></textarea><div class="assistant-actions"><select aria-label="لغة الصوت" id="assistant-language"><option value="ar-EG">العربية المصرية</option><option value="en-US">English</option></select><button type="button" data-mic>🎙 ميكروفون</button><button type="submit">تحليل الطلب</button></div></form><p class="assistant-status" role="status"></p><small class="assistant-privacy">الصوت يبدأ بطلبك فقط؛ قد يرسله المتصفح لخدمة التعرف على الكلام. راجع النص قبل إرساله. الكتابة تعمل بدون ميكروفون.</small>';
 document.body.append(dialog);
 const query=dialog.querySelector('textarea'),chat=dialog.querySelector('.assistant-conversation'),status=dialog.querySelector('.assistant-status'),mic=dialog.querySelector('[data-mic]');let recognition=null,disposed=false;
 function message(text,kind='bot'){const el=document.createElement('div');el.className='assistant-message '+kind;el.textContent=text;chat.append(el);chat.scrollTop=chat.scrollHeight;return el;}
 message('أهلًا! أقدر أطلع تواجد جوريلا وأصنافها، ترتيب المناديب، الزيارات، قياسات الأعمدة ومواد الدعاية. مثال: «أحسن 5 مناديب في نسبة تواجد مانجو 250». الطلب غير الواضح هطلب منك تحديده.');
 function table(rows,columns){const wrap=document.createElement('div');wrap.className='assistant-table';const t=document.createElement('table'),head=t.createTHead().insertRow();for(const c of columns){const th=document.createElement('th');th.textContent=c;head.append(th);}const body=t.createTBody();for(const row of rows.slice(0,100)){const tr=body.insertRow();for(const c of columns)tr.insertCell().textContent=row[c]??'—';}wrap.append(t);chat.append(wrap);}
 dialog.querySelector('form').onsubmit=e=>{e.preventDefault();recognition?.abort();const text=query.value.trim();if(!text)return;query.value='';message(text,'user');status.textContent='';
  try{const ctx=getContext();if(!ctx)return;const plan=parseRequest(text,ctx);if(plan.smalltalk){message(plan.smalltalk);return;}
   const target=plan.metric==='errors'?'health':plan.metric==='presence'?'presence':plan.metric==='visits'?'all':plan.metric==='stores'?'stores':plan.field==='_posm'||/POSTERS|RACK|SHELF|STICKER|POSM|COUNTER|STOPPER|PUSH_PULL|PALLET|CARTON/.test(plan.keys.join(' '))?'execution':'availability';
   if(!canPage(target)||(plan.group==='Rep'&&!canPage('performance'))){message('ليس لديك صلاحية صفحة التحليل المطلوبة.');return;}
   const result=runRequest(plan,ctx);if(result.error){message(result.error);return;}
   const metricNames={presence:plan.absent?'غياب مؤكد':'تواجد',visits:'عدد الزيارات',stores:'عدد المحلات',errors:'ملاحظات جودة البيانات',facings:'مجموع الواجهات',field:'قياس/عرض العمود'};
   message([`${metricNames[plan.metric]}${plan.sku?' · '+plan.sku:''}${plan.field?' · '+plan.field:''}${plan.rate?' · الترتيب بالنسبة %':plan.rank?' · الترتيب بالعدد/القيمة':''}`,`الفترة الفعلية: ${result.dates.join(' → ')||'لا توجد زيارات مؤرخة'} · ${result.count} سجل/محل أساس التحليل`,result.note,plan.rank?'التعادل في آخر مركز مطلوب يظهر بالكامل.':''].filter(Boolean).join('\n'));
   if(!result.records.length){message('لا توجد بيانات مطابقة داخل الفلاتر والصلاحيات الحالية.');return;}
   table(result.records,result.columns);if(result.details.length)table(result.details.slice(0,20),result.detailColumns);
   if(canExport()){const actions=document.createElement('div');actions.className='assistant-actions';for(const [label,records,columns] of [['تصدير التقرير Excel',result.records,result.columns],['تصدير التفاصيل Excel',result.details,result.detailColumns],['تصدير التقرير CSV',result.records,result.columns]]){if(!records.length)continue;const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await authorizeExport();if(disposed||!canExport())return;exportResult(records,columns,label.endsWith('CSV')?'csv':'xlsx');}catch(error){status.textContent=error.message;}finally{b.disabled=false;}};actions.append(b);}chat.append(actions);}
   chat.scrollTop=chat.scrollHeight;
  }catch(error){message('تعذر تنفيذ الطلب: '+error.message);}
 };
 button.onclick=()=>{dialog.showModal();query.focus();};dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{recognition?.abort();status.textContent='';});
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 mic.onclick=()=>{if(recognition){recognition.stop();return;}if(!SR){status.textContent='التعرف الصوتي غير متاح في المتصفح ده. تقدر تكتب طلبك.';return;}if(!window.isSecureContext){status.textContent='الصوت يحتاج HTTPS أو localhost.';return;}
  const rec=new SR();recognition=rec;rec.lang=dialog.querySelector('#assistant-language').value;rec.continuous=true;rec.interimResults=true;const base=query.value.trim();
  rec.onstart=()=>{status.textContent='بسمعك… اضغط الميكروفون للإيقاف، ثم راجع الكلام واضغط تحليل الطلب.';mic.textContent='■ إيقاف الاستماع';};
  rec.onresult=e=>{if(disposed)return;const parts=[];for(let i=0;i<e.results.length;i++)parts.push(e.results[i][0].transcript);query.value=[base,...parts].filter(Boolean).join(' ');};
  rec.onerror=e=>{status.textContent=['not-allowed','service-not-allowed'].includes(e.error)?'اسمح بالميكروفون من إعدادات الموقع، أو اكتب طلبك.':'تعذر التعرف الصوتي: '+e.error;};
  rec.onend=()=>{recognition=null;mic.textContent='🎙 ميكروفون';};try{rec.start();}catch{recognition=null;status.textContent='تعذر بدء الميكروفون. جرّب مرة أخرى أو اكتب الطلب.';}
 };
 return()=>{disposed=true;recognition?.abort();dialog.remove();button.remove();};
}
