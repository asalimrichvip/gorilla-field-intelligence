import {parseRequest,runRequest,normalizeText} from './assistant-engine.mjs?v=1521';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Wrap words the assistant didn't recognize with a highlighted <mark>, so the person can see
// exactly which part of what they said needs to be clarified instead of a generic error.
function renderUserBubble(text,unclear){
 if(!unclear?.length)return esc(text);
 const set=new Set(unclear);
 return text.split(/(\s+)/).map(tok=>{
  if(!tok.trim())return tok;
  const bare=tok.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'');
  if(bare&&set.has(normalizeText(bare)))return `<mark class="unclear-term" title="مش متأكد من المقصود بالكلمة دي — جرب توضحها">${esc(tok)}</mark>`;
  return esc(tok);
 }).join('');
}

export function mountAssistant({getContext,authorizeExport,exportResult,canPage,canExport}){
 const host=document.querySelector('.header-actions');if(!host)return()=>{};
 const button=document.createElement('button');button.id='gorilla-assistant';button.type='button';button.textContent='✦ Gorilla Assistant';button.setAttribute('aria-haspopup','dialog');host.prepend(button);

 const panel=document.createElement('section');panel.id='assistant-panel';panel.dir='rtl';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','assistant-heading');panel.setAttribute('aria-hidden','true');
 panel.innerHTML=`
  <div class="assistant-backdrop" data-close></div>
  <div class="assistant-frame">
   <header class="assistant-head">
    <div class="assistant-head-title"><span class="assistant-avatar">✦</span><div><h2 id="assistant-heading">مساعد جوريلا</h2><small>يجاوب من البيانات المسموحة لك والفلاتر الحالية</small></div></div>
    <div class="assistant-head-actions">
     <button type="button" data-settings aria-haspopup="true" aria-label="الإعدادات">⚙</button>
     <button type="button" data-close aria-label="إغلاق">×</button>
    </div>
   </header>
   <div class="assistant-settings" hidden>
    <label>لغة الميكروفون<select id="assistant-language"><option value="ar-EG">العربية المصرية</option><option value="en-US">English</option></select></label>
    <label class="assistant-toggle"><input type="checkbox" id="assistant-highlight" checked><span>لوّن الكلمات اللي مش فاهمها في طلبك</span></label>
    <p class="assistant-settings-help">لو الرد قال إنه مش فاهم جزء من الطلب، هتلاقي الكلمة أو الكلمتين ملوّنة في رسالتك، وتقدر تدوس "ليه؟" تحت أي رد عشان تشوف الكلمات اللي فهمها فعلاً وليه استنتج كده.</p>
    <p class="assistant-privacy">الصوت يبدأ بطلبك فقط؛ ممكن المتصفح يبعته لخدمة تعرف على الكلام. راجع النص قبل الإرسال. الكتابة تشتغل من غير ميكروفون.</p>
   </div>
   <div class="assistant-conversation" aria-live="polite"></div>
   <form class="assistant-inputbar">
    <button type="button" class="assistant-mic" data-mic aria-label="تسجيل صوتي"><span class="mic-icon">🎙</span><span class="mic-dot"></span></button>
    <textarea id="assistant-query" rows="1" placeholder="اكتب طلبك… مثلاً: أحسن مندوب في تواجد مانجو 250"></textarea>
    <button type="submit" class="assistant-send" aria-label="إرسال" disabled>➤</button>
   </form>
   <p class="assistant-status" role="status"></p>
  </div>`;
 document.body.append(panel);

 const query=panel.querySelector('#assistant-query'),chat=panel.querySelector('.assistant-conversation'),
  status=panel.querySelector('.assistant-status'),mic=panel.querySelector('[data-mic]'),
  send=panel.querySelector('.assistant-send'),settingsBtn=panel.querySelector('[data-settings]'),
  settingsBox=panel.querySelector('.assistant-settings'),highlightToggle=panel.querySelector('#assistant-highlight');
 let recognition=null,wantsListening=false,disposed=false,lastPlanByMsg=new WeakMap();

 function autoGrow(){query.style.height='auto';query.style.height=Math.min(140,query.scrollHeight)+'px';}
 query.addEventListener('input',()=>{autoGrow();send.disabled=!query.value.trim();});

 function message(html,kind='bot',{plan}={}){
  const el=document.createElement('div');el.className='assistant-message '+kind;el.innerHTML=html;chat.append(el);chat.scrollTop=chat.scrollHeight;
  if(kind==='bot'&&plan){
   const why=document.createElement('button');why.type='button';why.className='assistant-why';why.textContent='ليه؟ (اللي فهمته من طلبك)';
   const box=document.createElement('div');box.className='assistant-why-box';box.hidden=true;
   const understood=[...new Set(plan.keys||[])];
   box.innerHTML=`
    ${understood.length?`<p><b>فهمت إنك بتقصد:</b> ${understood.map(k=>esc(k)).join('، ')}</p>`:''}
    ${plan.unclear?.length?`<p><b>مش متأكد من:</b> <mark class="unclear-term">${plan.unclear.map(esc).join('</mark>، <mark class="unclear-term">')}</mark></p>`:''}
    ${plan.issues?.length?`<p><b>محتاج توضيح لـ:</b><br>${plan.issues.map(esc).join('<br>')}</p>`:''}`;
   why.onclick=()=>{box.hidden=!box.hidden;};
   el.append(why,box);
  }
  return el;
 }
 message('أهلًا! أقدر أطلع تواجد جوريلا وأصنافها، ترتيب المناديب، الزيارات، قياسات الأعمدة ومواد الدعاية. مثال: «أحسن 5 مناديب في نسبة تواجد مانجو 250». لو مش فاهم جزء من طلبك، هيتلوّن في رسالتك وأقولك ليه من زرار "ليه؟" تحت الرد.');

 function table(rows,columns){const wrap=document.createElement('div');wrap.className='assistant-table';const t=document.createElement('table'),head=t.createTHead().insertRow();for(const c of columns){const th=document.createElement('th');th.textContent=c;head.append(th);}const body=t.createTBody();for(const row of rows.slice(0,100)){const tr=body.insertRow();for(const c of columns)tr.insertCell().textContent=row[c]??'—';}wrap.append(t);chat.append(wrap);chat.scrollTop=chat.scrollHeight;}

 panel.querySelector('.assistant-inputbar').onsubmit=e=>{
  e.preventDefault();
  const text=query.value.trim();if(!text)return;
  if(recognition)stopMic(true);
  const ctx=getContext();if(!ctx)return;
  let plan;try{plan=parseRequest(text,ctx);}catch(error){message(esc('تعذر تحليل الطلب: '+error.message));return;}
  query.value='';autoGrow();send.disabled=true;status.textContent='';
  message(renderUserBubble(text,highlightToggle.checked?plan.unclear:[]),'user');
  try{
   if(plan.smalltalk){message(esc(plan.smalltalk),'bot',{plan});return;}
   const target=plan.metric==='errors'?'health':plan.metric==='presence'?'presence':plan.metric==='visits'?'all':plan.metric==='stores'?'stores':plan.field==='_posm'||/POSTERS|RACK|SHELF|STICKER|POSM|COUNTER|STOPPER|PUSH_PULL|PALLET|CARTON/.test(plan.keys.join(' '))?'execution':'availability';
   if(!canPage(target)||(plan.group==='Rep'&&!canPage('performance'))){message(esc('ليس لديك صلاحية صفحة التحليل المطلوبة.'),'bot',{plan});return;}
   const result=runRequest(plan,ctx);
   if(result.error){message(esc(result.error).replace(/\n/g,'<br>'),'bot',{plan});return;}
   const metricNames={presence:plan.absent?'غياب مؤكد':'تواجد',visits:'عدد الزيارات',stores:'عدد المحلات',errors:'ملاحظات جودة البيانات',facings:'مجموع الواجهات',field:'قياس/عرض العمود'};
   message([`${esc(metricNames[plan.metric])}${plan.sku?' · '+esc(plan.sku):''}${plan.field?' · '+esc(plan.field):''}${plan.rate?' · الترتيب بالنسبة %':plan.rank?' · الترتيب بالعدد/القيمة':''}`,`الفترة الفعلية: ${esc(result.dates.join(' → ')||'لا توجد زيارات مؤرخة')} · ${result.count} سجل/محل أساس التحليل`,esc(result.note||''),plan.rank?'التعادل في آخر مركز مطلوب يظهر بالكامل.':''].filter(Boolean).join('<br>'),'bot',{plan});
   if(!result.records.length){message(esc('لا توجد بيانات مطابقة داخل الفلاتر والصلاحيات الحالية.'));return;}
   table(result.records,result.columns);if(result.details.length)table(result.details.slice(0,20),result.detailColumns);
   if(canExport()){const actions=document.createElement('div');actions.className='assistant-actions';for(const [label,records,columns] of [['تصدير التقرير Excel',result.records,result.columns],['تصدير التفاصيل Excel',result.details,result.detailColumns],['تصدير التقرير CSV',result.records,result.columns]]){if(!records.length)continue;const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await authorizeExport();if(disposed||!canExport())return;exportResult(records,columns,label.endsWith('CSV')?'csv':'xlsx');}catch(error){status.textContent=error.message;}finally{b.disabled=false;}};actions.append(b);}chat.append(actions);}
   chat.scrollTop=chat.scrollHeight;
  }catch(error){message(esc('تعذر تنفيذ الطلب: '+error.message));}
 };

 // ---- open / close ----
 function open(){panel.classList.add('open');panel.setAttribute('aria-hidden','false');document.body.classList.add('assistant-lock');query.focus();}
 function close(){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');stopMic(true);status.textContent='';document.body.classList.remove('assistant-lock');}
 button.onclick=open;
 panel.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 settingsBtn.onclick=()=>{settingsBox.hidden=!settingsBox.hidden;};

 // ---- mic: continuous listening with seamless auto-restart + no duplicated text ----
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 let finalText='',restartTimer=null;

 function startMic(){
  if(!SR){status.textContent='التعرف الصوتي غير متاح في المتصفح ده. تقدر تكتب طلبك.';return;}
  if(!window.isSecureContext){status.textContent='الصوت يحتاج HTTPS أو localhost.';return;}
  finalText=query.value.trim();
  wantsListening=true;
  launch();
 }
 function launch(){
  const rec=new SR();recognition=rec;
  rec.lang=panel.querySelector('#assistant-language').value;rec.continuous=true;rec.interimResults=true;
  rec.onstart=()=>{status.textContent='بسمعك… اضغط تاني تقف، الطلب بيكمل تلقائي لو سكت شوية.';mic.classList.add('listening');mic.setAttribute('aria-label','إيقاف التسجيل');};
  rec.onresult=e=>{
   if(disposed)return;
   let interim='';
   for(let i=e.resultIndex;i<e.results.length;i++){
    const r=e.results[i];
    if(r.isFinal)finalText=(finalText?finalText+' ':'')+r[0].transcript.trim();
    else interim+=r[0].transcript;
   }
   query.value=[finalText,interim].filter(Boolean).join(' ');autoGrow();send.disabled=!query.value.trim();
  };
  rec.onerror=e=>{
   if(e.error==='no-speech'||e.error==='aborted')return; // will auto-restart from onend, keeps the mic "open" instead of dying on brief silence
   if(['not-allowed','service-not-allowed'].includes(e.error)){wantsListening=false;status.textContent='اسمح بالميكروفون من إعدادات الموقع، أو اكتب طلبك.';}
   else status.textContent='تعذر التعرف الصوتي: '+e.error;
  };
  rec.onend=()=>{
   recognition=null;
   if(wantsListening&&!disposed){restartTimer=setTimeout(launch,120);return;} // browser cut the session on silence; resume transparently
   mic.classList.remove('listening');mic.setAttribute('aria-label','تسجيل صوتي');if(status.textContent.startsWith('بسمعك'))status.textContent='';
  };
  try{rec.start();}catch{recognition=null;if(wantsListening)restartTimer=setTimeout(launch,200);}
 }
 function stopMic(silent){
  wantsListening=false;clearTimeout(restartTimer);
  mic.classList.remove('listening');mic.setAttribute('aria-label','تسجيل صوتي');
  if(silent)status.textContent='';
  recognition?.stop();
 }
 mic.onclick=()=>{recognition||wantsListening?stopMic():startMic();};

 return()=>{disposed=true;stopMic(true);panel.remove();button.remove();};
}
