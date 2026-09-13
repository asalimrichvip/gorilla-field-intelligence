// Shared display/export conventions. Raw source fields are never overwritten.
export const GORILLA_QUESTION = 'هل منتجات جوريلا موجودة بالمحل عموما';
export const JUHAYNA_QUESTION = 'حضرتك بتتعامل فى منتجات جهينة';
export const STATUS_FIELD = 'حالة الزيارة';
export const FLAVOR_COLORS = {ultimate:'#011689', mango:'#FFC52E', watermelon:'#F44764'};
export function flavorColor(name='') {
  const n=String(name).toLowerCase();
  return n.includes('ultimate')?FLAVOR_COLORS.ultimate:n.includes('mango')?FLAVOR_COLORS.mango:n.includes('watermelon')?FLAVOR_COLORS.watermelon:null;
}
const normalizeArabic=s=>String(s??'').trim().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
const statuses=[
 ['زيارة ناجحة','Successful visit'],['لم يستدل','Not found'],['مغلق نهائى','Permanently closed'],
 ['مغلق مؤقت','Temporarily closed'],['مغلق مؤقتا','Temporarily closed'],['رفض','Refused'],['محل جديد','New store']
];
export function statusText(value,lang='en') {
  const match=statuses.find(([ar,en])=>normalizeArabic(ar)===normalizeArabic(value)||en.toLowerCase()===String(value).toLowerCase());
  return match?(lang==='ar'?match[0]:match[1]):String(value??'—');
}
export function triState(value) {
  const s=normalizeArabic(value).toLowerCase();
  if(['yes','نعم','true','1','اه'].includes(s))return true;
  if(['no','لا','false','0'].includes(s))return false;
  return null;
}
export const answerText=(value,lang='en')=>value===true?(lang==='ar'?'نعم':'Yes'):value===false?(lang==='ar'?'لا':'No'):(lang==='ar'?'غير معروف':'Unknown');
export function formatDuration(seconds) {
  if(seconds==null||!Number.isFinite(Number(seconds))||Number(seconds)<0)return '—';
  const s=Math.round(Number(seconds));
  return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');
}
export function parseDuration(value) {
  const m=String(value??'').trim().match(/^(\d+)\s*:\s*(\d{1,2})\s*:\s*(\d{1,2})(?:\.(\d+))?$/);
  if(!m||+m[2]>59||+m[3]>59)return null;
  return +m[1]*3600+ +m[2]*60+ +m[3]+Number('0.'+(m[4]||'0'));
}
export function formatTimestamp(value) {
  if(value==null||value==='')return '—';
  const s=String(value),date=s.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const time=s.match(/(?:T|,?\s+)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(am|pm)?/i);
  if(!date||!time)return s;
  let h=+time[1];if(time[4])h=h%12+(time[4].toLowerCase()==='pm'?12:0);
  return `${date} ${String(h).padStart(2,'0')}:${time[2]}:${time[3]||'00'}`;
}
export function durationSeconds(field,value) {
  if(value==null||value==='')return null;
  if(['Duration (min)','Avg minutes','Average visit duration','_duration'].includes(field))return Number.isFinite(+value)?+value*60:null;
  if(field==='Visit hours')return Number.isFinite(+value)?+value*3600:null;
  if(field==='Total Duration')return parseDuration(value);
  return null;
}
export function googleMapsUrl(row) {
  const lat=row.Lat,lng=row.Lng;
  if(lat==null||lng==null||String(lat).trim()===''||String(lng).trim()==='')return null;
  const a=Number(lat),b=Number(lng);
  if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a)>90||Math.abs(b)>180||(a===0&&b===0))return null;
  return `https://www.google.com/maps/search/?api=1&query=${a},${b}`;
}
export const isLocationField=k=>['Link','Open Location','افتح اللوكيشن','افتح اللوكيشن على جوجل ماب'].includes(k);
export function displayValue(field,value,lang='en') {
  if(field===STATUS_FIELD||field==='Visit Status (EN)'||field==='Status')return statusText(value,lang);
  if(['Duration (min)','Avg minutes','Average visit duration','Visit hours','Total Duration','_duration'].includes(field))return formatDuration(durationSeconds(field,value));
  if(['Started At','Ended At'].includes(field))return formatTimestamp(value);
  if(field==='Visit Hour')return value!==''&&value!=null&&Number.isFinite(+value)?formatDuration(+value*3600):'—';
  return value??'—';
}
