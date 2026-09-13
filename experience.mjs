import {normalize,filterRows} from './analytics.mjs';
import {GORILLA_QUESTION,JUHAYNA_QUESTION} from './presentation.mjs';
export function supportingRows(sheet){return normalize((sheet?.rows||[]).map(r=>({...r,Rep:r.Rep||r['New Repzo User']||r.TDM||'',Date:r.Date||r._sourceDate||''})));}
export function supportedFilters(sheet){
 const cols=new Set(sheet?.columns||[]),out=new Set(['search']);
 for(const k of ['RTM','Rep','Governorate','Area Name','Outlet Type','حالة الزيارة'])if(cols.has(k))out.add(k);
 if(cols.has('New Repzo User')||cols.has('TDM'))out.add('Rep');
 if(cols.has('Date')||sheet?.rows.some(r=>r._sourceDate))['from','to','_date','_cycle','_week'].forEach(k=>out.add(k));
 if(cols.has(GORILLA_QUESTION))out.add('_surveyGorilla');
 if(cols.has(JUHAYNA_QUESTION))out.add('_juhayna');
 return out;
}
export function filterSupporting(sheet,filters,omit){const allowed=supportedFilters(sheet);return filterRows(supportingRows(sheet),Object.fromEntries(Object.entries(filters).filter(([k])=>allowed.has(k))),omit);}
export function notificationKeys(issues,rows,sheets){
 const byRow=new Map(rows.map(r=>[r._row,r]));
 const keys=issues.filter(i=>i.severity!=='info').map(i=>{const r=byRow.get(i.row)||{};return JSON.stringify(['issue',i.kind,i.column||'',r._id||'',r['Started At']||r.Date||'',r._sourceFile||'']);});
 for(const r of sheets.Missing?.rows||[])keys.push(JSON.stringify(['missing',r['Adhoc Serial']||r['Client Code']||r.Client,r._sourceDate||r.Date||'']));
 for(const [name,sheet] of Object.entries(sheets))for(const col of sheet.columns)keys.push(JSON.stringify(['column',name,col]));
 return [...new Set(keys)];
}
export function attachPasswordEyes(root,ar=false){
 root.querySelectorAll('input[type="password"]').forEach(input=>{
  if(input.parentElement.classList.contains('password-wrap'))return;
  const wrap=document.createElement('span');wrap.className='password-wrap';input.before(wrap);wrap.append(input);
  const button=document.createElement('button');button.type='button';button.className='password-eye';button.setAttribute('aria-controls',input.id);wrap.append(button);
  const update=()=>{const open=input.type==='text';button.setAttribute('aria-label',ar?(open?'إخفاء كلمة المرور':'إظهار كلمة المرور'):(open?'Hide password':'Show password'));button.setAttribute('aria-pressed',String(open));button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${open?'<path d="m3 3 18 18"/>':''}</svg>`;};
  button.onclick=()=>{input.type=input.type==='password'?'text':'password';update();};update();
 });
}
let audioContext;
export function unlockAlertAudio(){try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});}catch{}}
export function playAlert(){
 navigator.vibrate?.([250,100,250,100,250,100,250,100,250]);
 if(!audioContext||audioContext.state!=='running')return;
 const now=audioContext.currentTime;
 for(let i=0;i<4;i++){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.value=i%2?880:660;gain.gain.setValueAtTime(0,now+i*.5);gain.gain.linearRampToValueAtTime(.25,now+i*.5+.03);gain.gain.exponentialRampToValueAtTime(.001,now+i*.5+.45);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(now+i*.5);oscillator.stop(now+i*.5+.48);}
}
