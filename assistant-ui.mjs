import {parseRequest,runRequest,normalizeText} from './assistant-engine.mjs?v=1530';
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

export function mountAssistant({getContext,authorizeExport,exportResult,canPage,canExport,aiParse}){
 const host=document.querySelector('.header-actions');if(!host)return()=>{};
 const button=document.createElement('button');button.id='gorilla-assistant';button.type='button';button.textContent='✦ Gorilla Assistant';button.setAttribute('aria-haspopup','dialog');host.prepend(button);

 const panel=document.createElement('section');panel.id='assistant-panel';panel.dir='rtl';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','assistant-heading');panel.setAttribute('aria-hidden','true');
 panel.innerHTML=`
  <div class="assistant-backdrop" data-close></div>
  <div class="assistant-frame">
   <header class="assistant-head">
    <div class="assistant-head-title"><span class="assistant-avatar">✦</span><div><h2 id="assistant-heading">مساعد جوريلا</h2><small>يجاوب من البيانات المسموحة لك والفلاتر الحالية</small></div></div>
    <div class="assistant-head-actions">
     <button type="button" data-settings aria-haspopup="true" aria-expanded="false" aria-label="الإعدادات">⚙</button>
     <button type="button" data-close aria-label="إغلاق">×</button>
    </div>
   </header>
   <div class="assistant-settings" hidden>
    <label>لغة الميكروفون<select id="assistant-language"><option value="ar-EG">العربية المصرية</option><option value="en-US">English</option></select></label>
    <label class="assistant-toggle"><input type="checkbox" id="assistant-ai-first" checked><span>الوضع الذكي لتوفير Gemini — الطلبات الواضحة تتحلل محليًا، وGemini يشتغل فقط لما الطلب يحتاج فهم أقوى</span></label>
    <label class="assistant-toggle"><input type="checkbox" id="assistant-highlight" checked><span>لوّن الكلمات اللي مش فاهمها في طلبك</span></label>
    <p class="assistant-settings-help">لو Gemini مش فاهم جزء من طلبك، هتلاقي الكلمة أو الكلمتين ملوّنة في رسالتك. تقدر تدوس "ليه؟" تحت أي رد عشان تشوف اللي فهمه فعلاً.</p>
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
  settingsBox=panel.querySelector('.assistant-settings'),highlightToggle=panel.querySelector('#assistant-highlight'),
  aiFirstToggle=panel.querySelector('#assistant-ai-first');
 let recognition=null,wantsListening=false,disposed=false,lastPlanByMsg=new WeakMap(),geminiRecoveryTimer=null,geminiRecoveryAttempt=0;

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

 // Renders one assistant reply as a single card: a small summary table, then a detailed/"استرشادي" table,
 // then export controls that respect the person's chosen format — all inside the same chat bubble.
 function resultCard(plan,result,metricNames){
  const el=document.createElement('div');el.className='assistant-message bot assistant-result';
  const summaryRows=[
   ['المقياس',`${metricNames[plan.metric]}${plan.sku?' · '+plan.sku:''}${plan.field?' · '+plan.field:''}`],
   ['الترتيب',plan.rate?'بالنسبة %':plan.rank?'بالعدد / القيمة':'—'],
   ['الفترة الفعلية',result.dates.join(' → ')||'لا توجد زيارات مؤرخة'],
   ['أساس التحليل',`${result.count} سجل/محل`]
  ];
  if(result.note)summaryRows.push(['ملاحظة',result.note]);
  if(plan.rank)summaryRows.push(['تنبيه',"التعادل في آخر مركز مطلوب يظهر بالكامل."]);
  const summaryHtml=`<table class="assistant-summary-table">${summaryRows.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`;
  el.innerHTML=`<div class="assistant-summary">${summaryHtml}</div>`;
  if(!result.records.length){el.insertAdjacentHTML('beforeend','<p class="assistant-empty-note">لا توجد بيانات مطابقة داخل الفلاتر والصلاحيات الحالية.</p>');chat.append(el);chat.scrollTop=chat.scrollHeight;return el;}
  el.insertAdjacentHTML('beforeend','<p class="assistant-table-title">جدول تفصيلي استرشادي</p>');
  el.append(dataTable(result.records,result.columns));
  if(result.details?.length){el.insertAdjacentHTML('beforeend','<p class="assistant-table-title">تفاصيل إضافية</p>');el.append(dataTable(result.details.slice(0,20),result.detailColumns));}
  if(canExport()){
   const actions=document.createElement('div');actions.className='assistant-actions';
   for(const [label,records,columns,fmt] of [['تصدير التقرير Excel',result.records,result.columns,'xlsx'],['تصدير التقرير CSV',result.records,result.columns,'csv'],['تصدير التفاصيل Excel',result.details,result.detailColumns,'xlsx']]){
    if(!records?.length)continue;
    const b=document.createElement('button');b.type='button';b.textContent=label;
    b.onclick=async()=>{b.disabled=true;try{await authorizeExport();if(disposed||!canExport())return;exportResult(records,columns,fmt);}catch(error){status.textContent=error.message;}finally{b.disabled=false;}};
    actions.append(b);
   }
   el.append(actions);
  }
  chat.append(el);chat.scrollTop=chat.scrollHeight;
  return el;
 }
 function dataTable(rows,columns){const wrap=document.createElement('div');wrap.className='assistant-table';const t=document.createElement('table'),head=t.createTHead().insertRow();for(const c of columns){const th=document.createElement('th');th.textContent=c;head.append(th);}const body=t.createTBody();for(const row of rows.slice(0,100)){const tr=body.insertRow();for(const c of columns)tr.insertCell().textContent=row[c]??'—';}wrap.append(t);return wrap;}

 // Runs an already-parsed plan (from either Gemini or the local parser) and renders the result card.
 async function runPlan(plan,ctx,badgeHtml){
  const target=plan.metric==='errors'?'health':plan.metric==='presence'?'presence':plan.metric==='visits'?'all':plan.metric==='stores'?'stores':plan.field==='_posm'||/POSTERS|RACK|SHELF|STICKER|POSM|COUNTER|STOPPER|PUSH_PULL|PALLET|CARTON/.test((plan.keys||[]).join(' '))?'execution':'availability';
  if(!canPage(target)||(plan.group==='Rep'&&!canPage('performance'))){message(esc('ليس لديك صلاحية صفحة التحليل المطلوبة.'),'bot',{plan});return;}
  const result=runRequest(plan,ctx);
  if(result.error){message(esc(result.error).replace(/\n/g,'<br>'),'bot',{plan});return;}
  const metricNames={presence:plan.absent?'غياب مؤكد':'تواجد',visits:'عدد الزيارات',stores:'عدد المحلات',errors:'ملاحظات جودة البيانات',facings:'مجموع الواجهات',field:'قياس/عرض العمود'};
  const card=resultCard(plan,result,metricNames);
  if(badgeHtml)card.insertAdjacentHTML('afterbegin',badgeHtml);
  if(plan.keys?.length||plan.unclear?.length){
   const why=document.createElement('button');why.type='button';why.className='assistant-why';why.textContent='ليه؟ (اللي فهمته من طلبك)';
   const box=document.createElement('div');box.className='assistant-why-box';box.hidden=true;
   const understood=[...new Set(plan.keys||[])];
   box.innerHTML=`${understood.length?`<p><b>فهمت إنك بتقصد:</b> ${understood.map(k=>esc(k)).join('، ')}</p>`:''}${plan.unclear?.length?`<p><b>مش متأكد من:</b> <mark class="unclear-term">${plan.unclear.map(esc).join('</mark>، <mark class="unclear-term">')}</mark></p>`:''}`;
   why.onclick=()=>{box.hidden=!box.hidden;};chat.append(why,box);chat.scrollTop=chat.scrollHeight;
  }
 }
 // Local rule-based parse (instant, free, works offline) — used as a fallback when Gemini can't be reached.
 function runLocal(text,ctx,userEl){
  let plan;try{plan=parseRequest(text,ctx);}catch(error){message(esc('تعذر تحليل الطلب: '+error.message));return;}
  if(userEl&&highlightToggle.checked&&plan.unclear?.length)userEl.innerHTML=renderUserBubble(text,plan.unclear);
  if(plan.smalltalk){message(esc(plan.smalltalk),'bot',{plan});return;}
  if(plan.issues.length){const el=message(esc(plan.issues.join('\n')).replace(/\n/g,'<br>'),'bot',{plan});return;}
  runPlan(plan,ctx);
 }
 // Gemini fallback path. The AI only sees the typed sentence + real column names — never store rows.
 function transientGeminiError(error){
  const s=String(error?.message||error||'').toLowerCase();
  return s.includes('503')||s.includes('429')||s.includes('unavailable')||s.includes('high demand')||s.includes('temporarily')||s.includes('timeout')||s.includes('timed out')||s.includes('try again');
 }
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function aiParseWithRetry(text){
  const delays=[0,2500];let last;
  for(let i=0;i<delays.length;i++){
   if(delays[i]){status.textContent=`Gemini مشغول مؤقتًا — محاولة تلقائية ${i+1}/${delays.length}…`;await wait(delays[i]);}
   try{return await aiParse(text)}catch(error){last=error;if(!transientGeminiError(error)||i===delays.length-1)throw error;}
  }
  throw last||new Error('Gemini unavailable');
 }
 function startGeminiRecovery(text){
  if(!aiParse||disposed||geminiRecoveryTimer)return;
  const delays=[15000,30000,60000,120000,180000,300000];
  const schedule=()=>{
   if(disposed)return;
   const delay=delays[Math.min(geminiRecoveryAttempt,delays.length-1)];
   geminiRecoveryTimer=setTimeout(async()=>{
    geminiRecoveryTimer=null;if(disposed)return;
    try{
     await aiParse(text);geminiRecoveryAttempt=0;
     status.textContent='Gemini رجع يشتغل تلقائيًا ✓';
     setTimeout(()=>{if(status.textContent.includes('Gemini رجع'))status.textContent='';},4500);
    }catch(error){
     if(!transientGeminiError(error)){geminiRecoveryAttempt=0;return;}
     geminiRecoveryAttempt+=1;schedule();
    }
   },delay);
  };
  schedule();
 }
 async function runViaAI(text,ctx,userEl){
  status.textContent='بيفكر…';
  try{
   const res=await aiParseWithRetry(text);
   const p=res?.plan;
   if(!p)throw new Error(res?.error||'رد غير متوقع.');
   status.textContent='';
   if(p.smalltalk){message(esc(p.smalltalk),'bot');return;}
   if(p.unclear?.length&&highlightToggle.checked)userEl.innerHTML=renderUserBubble(text,p.unclear.map(w=>normalizeText(w)));
   if(!p.metric){message(esc(p.clarify||'مش متأكد من المقصود بطلبك، ممكن توضحه أكتر؟'),'bot');return;}
   const plan={text,keys:[],unclear:p.unclear||[],metric:p.metric,field:p.field||'',sku:p.sku||'',group:p.group||'',rank:p.rank||'',limit:Math.min(100,Math.max(1,Number(p.limit)||1)),absent:!!p.absent,rate:!!p.rate,filters:Array.isArray(p.filters)?p.filters:[],conditions:[],from:p.from||'',to:p.to||'',aggregation:p.aggregation==='average'?'average':'sum',issues:[]};
   await runPlan(plan,ctx,`<p class="assistant-ai-badge">✦ Gemini${p.note?' — '+esc(p.note):''}</p>`);
  }catch(error){
   status.textContent='';
   message(esc('Gemini لسه غير متاح بعد المحاولات التلقائية (')+esc(error.message)+esc(')، هستخدم الفهم المحلي مؤقتًا. الرسالة الجاية هتحاول Gemini تلقائيًا من جديد:'));
   if(transientGeminiError(error))startGeminiRecovery(text);
   runLocal(text,ctx,userEl);
  }
 }

 // Quota-saving smart router:
 // - clear/simple requests are executed locally with zero Gemini calls
 // - ambiguous/unsupported requests are escalated to Gemini
 // This keeps the free-tier request budget for the messages that actually need it.
 function shouldUseGemini(text,ctx){
  try{
   const plan=parseRequest(text,ctx);
   if(plan.smalltalk)return {use:false,plan};
   if(plan.issues?.length)return {use:true,plan};
   if(!plan.metric)return {use:true,plan};
   return {use:false,plan};
  }catch{
   return {use:true,plan:null};
  }
 }

 panel.querySelector('.assistant-inputbar').onsubmit=e=>{
  e.preventDefault();
  const text=query.value.trim();if(!text)return;
  if(recognition)stopMic(true);
  const ctx=getContext();if(!ctx)return;
  query.value='';autoGrow();send.disabled=true;status.textContent='';
  const userEl=message(esc(text),'user');
  if(aiParse&&aiFirstToggle.checked){
   const route=shouldUseGemini(text,ctx);
   if(route.use)runViaAI(text,ctx,userEl);
   else{
    if(route.plan?.smalltalk){message(esc(route.plan.smalltalk),'bot',{plan:route.plan});}
    else runPlan(route.plan,ctx,'<p class="assistant-ai-badge">⚡ Local · بدون استهلاك Gemini</p>');
   }
  }else runLocal(text,ctx,userEl);
 };

 // ---- open / close ----
 function open(){panel.classList.add('open');panel.setAttribute('aria-hidden','false');document.body.classList.add('assistant-lock');query.focus();}
 function close(){settingsBox.hidden=true;settingsBtn.setAttribute('aria-expanded','false');panel.classList.remove('open');panel.setAttribute('aria-hidden','true');stopMic(true);status.textContent='';document.body.classList.remove('assistant-lock');}
 button.onclick=open;
 panel.querySelectorAll('[data-close]').forEach(b=>b.onclick=close);
 panel.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 settingsBtn.onclick=()=>{settingsBox.hidden=!settingsBox.hidden;settingsBtn.setAttribute('aria-expanded',String(!settingsBox.hidden));};

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

 return()=>{disposed=true;clearTimeout(geminiRecoveryTimer);geminiRecoveryTimer=null;stopMic(true);panel.remove();button.remove();};
}
