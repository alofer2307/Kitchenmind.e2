import type { OperationalAttendanceExportRow } from "@/types";

const encoder = new TextEncoder();
const escCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const escXml = (value: unknown) => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const fmt = (value:string|null) => value ? new Intl.DateTimeFormat("es-MX",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)) : "";
const safe = (value:string) => value.replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"asistencia";

function rows(data: OperationalAttendanceExportRow[]): unknown[][] {
  return [["Fecha","No. empleado","Empleado","Sucursal","Turno","Entrada","Salida","Retardo (min)","Incidencias"], ...data.map((r)=>[r.operationalDate,r.employeeNumber,r.employeeName,r.branchName,r.shiftName??"",fmt(r.entryAt),fmt(r.exitAt),r.lateMinutes??"",r.incidentCount])];
}

export function attendanceExportFilename(organizationCode:string, operationalDate:string, extension:string){return `${safe(organizationCode)}-asistencia-${operationalDate}.${extension}`;}
export function buildAttendanceCsv(data: OperationalAttendanceExportRow[]):Uint8Array{return encoder.encode("\uFEFF"+rows(data).map((r)=>r.map(escCsv).join(",")).join("\r\n"));}

const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&0xff]^(c>>>8);return(c^0xffffffff)>>>0;}
function u16(v:number){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v,true);return b;}
function u32(v:number){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v>>>0,true);return b;}
function concat(parts:Uint8Array[]){const out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function zip(entries:Array<{name:string;data:Uint8Array}>){const locals:Uint8Array[]=[];const centrals:Uint8Array[]=[];let offset=0;for(const e of entries){const name=encoder.encode(e.name),crc=crc32(e.data);const local=concat([u32(0x04034b50),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(e.data.length),u32(e.data.length),u16(name.length),u16(0),name,e.data]);locals.push(local);centrals.push(concat([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),u32(crc),u32(e.data.length),u32(e.data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]));offset+=local.length;}const central=concat(centrals),body=concat(locals);return concat([body,central,u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(central.length),u32(body.length),u16(0)]);}
function cell(v:unknown){return `<c t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`;}
function row(v:unknown[]){return `<row>${v.map(cell).join("")}</row>`;}
export function buildAttendanceXlsx(data:OperationalAttendanceExportRow[]):Uint8Array{const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows(data).map(row).join("")}</sheetData></worksheet>`;return zip([
{name:"[Content_Types].xml",data:encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`)},
{name:"_rels/.rels",data:encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)},
{name:"xl/workbook.xml",data:encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Asistencia" sheetId="1" r:id="rId1"/></sheets></workbook>`)},
{name:"xl/_rels/workbook.xml.rels",data:encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`)},
{name:"xl/worksheets/sheet1.xml",data:encoder.encode(sheet)}]);}
