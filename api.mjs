export class ApiError extends Error {
  constructor(message, code='REQUEST_FAILED'){super(message);this.code=code;}
}
export function createApi(url, storage=globalThis.sessionStorage, fetcher=globalThis.fetch) {
  let token=storage?.getItem('gorilla-session')||'';
  return {
    hasSession:()=>Boolean(token),
    setToken(value){token=value||'';if(token)storage?.setItem('gorilla-session',token);else storage?.removeItem('gorilla-session');},
    async call(action, payload={}){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
      try{
        const res=await fetcher(url,{method:'POST',redirect:'follow',credentials:'omit',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...payload,action,token}),signal:controller.signal});
        const text=await res.text();let out;
        try{out=JSON.parse(text);}catch{throw new ApiError('Google returned a page instead of data. Check the Apps Script deployment URL and access settings.','INVALID_RESPONSE');}
        if(!res.ok||!out.ok)throw new ApiError(out.error||'Request failed',out.error==='Unauthorized'?'UNAUTHORIZED':out.code||'REQUEST_FAILED');
        return out;
      }catch(e){if(e.name==='AbortError')throw new ApiError('The request timed out. Please retry.','TIMEOUT');throw e;}finally{clearTimeout(timer);}
    }
  };
}
export function prepareSheet(result) {
  if(!Array.isArray(result.rows))throw new ApiError('Invalid sheet response');
  const columns=[...new Set([...(result.columns||[]),...result.rows.flatMap(Object.keys)])];
  const ignored=columns.filter(c=>c.includes('#REF!')||result.rows.some(r=>typeof r[c]==='string'&&r[c].includes('#REF!')));
  const keep=columns.filter(c=>!ignored.includes(c));
  return {columns:keep,rows:result.rows.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>!ignored.includes(k)))),ignored,warnings:result.warnings||[]};
}
export async function loadSheets(api,previous){
  const sheets={},ignored={},warnings=[],schemaChanges=[];
  for(const name of ['All','NewAdd','Missing','Start-End']){
    try{
      const response=await api.call('data',{sheet:name});
      const sheet=prepareSheet(response);sheets[name]=sheet;ignored[name]=sheet.ignored;
      warnings.push(...sheet.warnings.map(x=>`${name}: ${x}`));
      if(previous?.sheets[name]){
        const old=previous.sheets[name].columns;
        sheet.columns.filter(x=>!old.includes(x)).forEach(column=>schemaChanges.push({sheet:name,column,type:'added'}));
        old.filter(x=>!sheet.columns.includes(x)).forEach(column=>schemaChanges.push({sheet:name,column,type:'removed'}));
      }
    }catch(e){if(name==='All'||e.code==='UNAUTHORIZED')throw e;warnings.push(`${name}: ${e.message}`);}
  }
  return {sheets,ignored,warnings,schemaChanges,source:'Google Drive',refreshed:new Date().toISOString()};
}
