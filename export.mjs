import {displayValue,googleMapsUrl,isLocationField} from './presentation.mjs';
const xml=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const safe=v=>/^[\s]*[=+@-]/.test(String(v))?"'"+v:String(v);
export function exportColumns(columns){return [...new Set([...columns.filter(c=>!c.startsWith('_')), 'Open Location'])];}
function value(row,c,lang){return isLocationField(c)?googleMapsUrl(row)||'':c==='Client Code'?String(row[c]??''):displayValue(c,row[c],lang);}
export function csvBytes(rows,columns,lang='en'){
  const cols=exportColumns(columns),quote=v=>'"'+safe(v??'').replace(/"/g,'""')+'"';
  return new TextEncoder().encode('\uFEFF'+[cols,...rows.map(r=>cols.map(c=>value(r,c,lang)))].map(r=>r.map(quote).join(',')).join('\r\n'));
}
// Minimal uncompressed ZIP / OOXML writer. Strings remain strings, never formulas.
const enc=new TextEncoder();
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function join(parts){const out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
function header(size,values){const b=new Uint8Array(size),d=new DataView(b.buffer);for(const [at,n,width] of values)width===2?d.setUint16(at,n,true):d.setUint32(at,n,true);return b;}
function zip(files){const parts=[],central=[];let offset=0;
  for(const [path,text] of Object.entries(files)){
    const name=enc.encode(path),bytes=enc.encode(text),checksum=crc(bytes);
    const local=header(30,[[0,0x04034b50],[4,20,2],[10,0,2],[12,33,2],[14,checksum],[18,bytes.length],[22,bytes.length],[26,name.length,2]]);
    parts.push(local,name,bytes);
    central.push(header(46,[[0,0x02014b50],[4,20,2],[6,20,2],[14,33,2],[16,checksum],[20,bytes.length],[24,bytes.length],[28,name.length,2],[42,offset]]),name);
    offset+=local.length+name.length+bytes.length;
  }
  const directory=join(central),count=Object.keys(files).length;
  return join([...parts,directory,header(22,[[0,0x06054b50],[8,count,2],[10,count,2],[12,directory.length],[16,offset]])]);
}
function colName(i){let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;}
export function xlsxBytes(rows,columns,lang='en'){
  const cols=exportColumns(columns),links=[],relations=[];
  if(rows.length>1048575||cols.length>16384)throw new Error('Excel size limit exceeded; narrow the filters.');
  const body=[cols,...rows.map(r=>cols.map(c=>value(r,c,lang)))].map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>{
    const ref=colName(j)+(i+1),url=i&&isLocationField(cols[j])?googleMapsUrl(rows[i-1]):null;
    if(url){const id='rId'+(links.length+1);links.push(`<hyperlink ref="${ref}" r:id="${id}"/>`);relations.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(url)}" TargetMode="External"/>`);v=lang==='ar'?'افتح اللوكيشن':'Open Location';}
    return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  return zip({
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Gorilla" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0" rightToLeft="${lang==='ar'?1:0}"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols>${cols.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${Math.min(55,Math.max(18,c.length+3))}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData><autoFilter ref="A1:${colName(cols.length-1)}${rows.length+1}"/>${links.length?'<hyperlinks>'+links.join('')+'</hyperlinks>':''}</worksheet>`,
    'xl/worksheets/_rels/sheet1.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations.join('')}</Relationships>`
  });
}
