// Strict TCPDF content editing. Coordinates are discovered from PDF text, never hard-coded.
const fail = message => { throw new Error(message); };
export const normal = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function outputName(text, filename) {
  const number = text.match(/\bFA\s*(\d{4,12})\b/i);
  return number ? `BX FA${number[1]}.pdf` : `BX ${filename.replace(/\.pdf$/i,'').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')}.pdf`;
}
export function detect(items, width, height) {
  if(Math.abs(width-595.28)>3 || Math.abs(height-841.89)>3) fail('Format non compatible : une facture A4 portrait est requise.');
  const text = items.filter(i=>i.str?.trim());
  const shipping = text.filter(i=>normal(i.str).startsWith('adresse de livraison'));
  const billing = text.filter(i=>normal(i.str).startsWith('adresse de facturation'));
  if(shipping.length!==1 || billing.length!==1) fail('Impossible d’identifier sans ambiguïté les deux blocs d’adresse.');
  const s=shipping[0], b=billing[0], x=s.transform[4], y=s.transform[5];
  if(b.transform[4]-x<130 || Math.abs(y-b.transform[5])>5 || x<width*.2) fail('La disposition des adresses n’est pas compatible.');
  const rows=text.filter(i=>normal(i.str).includes('numero de facture') && i.transform[5]<y-40);
  if(rows.length!==1) fail('La limite inférieure du bloc de livraison est introuvable.');
  const region={left:x-1,right:b.transform[4]-5,top:y+Math.max(10,s.height),bottom:rows[0].transform[5]+22};
  const selected=text.filter(i=>i.transform[4]>=region.left && i.transform[4]<region.right && i.transform[5]<=region.top && i.transform[5]>=region.bottom);
  if(selected.length<2 || selected.length>22 || selected.some(i=>i.transform[4]+i.width>region.right+1 || Math.abs(i.transform[1])>.01 || Math.abs(i.transform[2])>.01)) fail('Le bloc de livraison déborde ou sa structure est ambiguë.');
  return {region,selected,x,y,width:region.right-x-2,height:y-region.bottom, billing:b};
}

// PDF lexical scanner: literal strings, escaped delimiters, hex strings and comments
// are opaque, so text containing BT / ET / cm cannot be mistaken for an operator.
export function tokens(source) {
  const result=[]; let p=0;
  while(p<source.length){
    if(/[\s\x00]/.test(source[p])) {p++;continue;}
    if(source[p]==='%'){while(p<source.length && !/[\r\n]/.test(source[p]))p++;continue;}
    const start=p; let kind='word';
    if(source[p]==='('){kind='string';p++;let depth=1;while(p<source.length&&depth){if(source[p]==='\\'){p+=2;continue;}if(source[p]==='(')depth++;if(source[p]===')')depth--;p++;}if(depth)fail('Flux PDF incomplet.');}
    else if(source[p]==='<'&&source[p+1]!=='<'){kind='string';p++;while(p<source.length&&source[p]!=='>')p++;p++;}
    else if('[]<>'.includes(source[p])){kind='delimiter';p++;if(source[p-1]===source[p]&&'<>'.includes(source[p]))p++;}
    else {if(source[p]==='/'){kind='name';p++;}while(p<source.length&&!/[\s\x00()[\]<>/%]/.test(source[p]))p++;if(p===start)p++;}
    const value=source.slice(start,p);if(kind==='word'&&/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value))kind='number';
    result.push({start,end:p,value,kind});
  }return result;
}
const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
export function removeShipping(source, selected) {
  const ts=tokens(source), stack=[]; let matrix=[1,0,0,1,0,0], args=[], begin=-1, btMatrix;
  const edits=[], hits=selected.map(()=>0);
  for(let k=0;k<ts.length;k++){
    const t=ts[k];
    if(t.kind!=='word'){args.push(t);continue;}
    if(t.value==='BT'){if(begin!==-1)fail('Objets texte imbriqués non compatibles.');begin=k;btMatrix=matrix.slice();}
    else if(t.value==='ET'&&begin!==-1){
      const body=ts.slice(begin+1,k);begin=-1;
      // TCPDF emits a separate, absolutely positioned text object for each line.
      if(body[0]?.kind==='number'&&body[1]?.kind==='number'&&body[2]?.value==='Td'){
        const px=+body[0].value,py=+body[1].value;
        const x=btMatrix[0]*px+btMatrix[2]*py+btMatrix[4], y=btMatrix[1]*px+btMatrix[3]*py+btMatrix[5];
        const matches=selected.map((i,n)=>Math.abs(i.transform[4]-x)<.3&&Math.abs(i.transform[5]-y)<.3?n:-1).filter(n=>n>=0);
        if(matches.length){
          if(matches.length!==1 || body.at(-1)?.value!=='TJ' || body[3]?.value!=='[' || body.at(-2)?.value!==']' || body.slice(4,-2).some(v=>!['number','string'].includes(v.kind)))fail('Cette structure de texte ne permet pas une suppression fiable.');
          hits[matches[0]]++; edits.push([ts[begin===-1?k-body.length-1:begin].start,t.end]);
        }
      }
    }else if(begin===-1){
      if(t.value==='q')stack.push(matrix.slice());
      if(t.value==='Q'){if(!stack.length)fail('État graphique PDF invalide.');matrix=stack.pop();}
      if(t.value==='cm'){const a=args.slice(-6);if(a.length!==6||a.some(t=>t.kind!=='number'))fail('Matrice PDF invalide.');matrix=multiply(matrix,a.map(t=>+t.value));}
    }
    args=[];
  }
  if(hits.some(h=>h!==1))fail('Suppression non vérifiable : la facture utilise une structure PDF non prise en charge.');
  for(const [a,b]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,a)+source.slice(b);
  return source;
}
export async function analyse(bytes, pdfjs) {
  let doc;
  try{doc=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false}).promise;}
  catch{fail('Le fichier est illisible ou protégé. Sélectionnez une facture PDF originale.');}
  try{
    const pages=[];for(let n=1;n<=doc.numPages;n++){const p=await doc.getPage(n),v=p.getViewport({scale:1});if(p.rotate!==0)fail('Les pages tournées ne sont pas compatibles.');pages.push({items:(await p.getTextContent()).items.filter(i=>'str'in i),width:v.width,height:v.height});}
    const candidates=pages.map((p,i)=>p.items.some(t=>normal(t.str).startsWith('adresse de livraison'))?i:-1).filter(i=>i>=0);
    if(candidates.length!==1)fail('Une seule zone de livraison clairement identifiable est requise.');
    const page=candidates[0], zone=detect(pages[page].items,pages[page].width,pages[page].height);
    return {pages,page,zone,text:pages.flatMap(p=>p.items.map(i=>i.str)).join('\n')};
  }finally{await doc.destroy();}
}
const fingerprint=i=>`${i.str}|${i.transform.map(v=>v.toFixed(2)).join(',')}`;
export async function modify(bytes, address, filename, deps) {
  const {pdfjs,lib,fontkit,fontBytes,boldBytes}=deps;
  const lines=address.replace(/\r\n?/g,'\n').split('\n');
  if(!lines.some(l=>l.trim()))fail('Saisissez une nouvelle adresse.');
  if(lines.length>18 || address.length>1800 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(address))fail('Adresse trop longue ou contenant des caractères de contrôle.');
  const before=await analyse(bytes,pdfjs), {zone,page}=before;
  const doc=await lib.PDFDocument.load(bytes,{updateMetadata:false});
  if(!/TCPDF/i.test(doc.getProducer()||''))fail('Cette application accepte les factures PrestaShop générées par TCPDF.');
  const names=doc.catalog.lookupMaybe(lib.PDFName.of('Names'),lib.PDFDict);
  if(doc.catalog.has(lib.PDFName.of('AcroForm')) || doc.catalog.has(lib.PDFName.of('Perms')) || (names&&names.keys().length))fail('Les documents avec formulaires, signatures ou pièces jointes ne sont pas compatibles.');
  const target=doc.getPage(page);
  const annotations=target.node.lookupMaybe(lib.PDFName.of('Annots'),lib.PDFArray);
  if(annotations)for(let n=0;n<annotations.size();n++){
    const a=annotations.lookup(n,lib.PDFDict),rect=a.lookupMaybe(lib.PDFName.of('Rect'),lib.PDFArray);
    if(a.get(lib.PDFName.of('Subtype'))?.toString()!=='/Link'||!rect)fail('Les annotations autres que des liens ne sont pas compatibles.');
    const r=rect.asArray().map(v=>v.asNumber());
    if(r[0]<zone.region.right&&r[2]>zone.region.left&&r[1]<zone.region.top&&r[3]>zone.region.bottom)fail('Un lien présent dans l’adresse empêche sa suppression fiable.');
  }
  const contents=target.node.get(lib.PDFName.of('Contents'));
  if(!(contents instanceof lib.PDFRef))fail('La page doit contenir un flux TCPDF unique.');
  for(let n=0;n<doc.getPageCount();n++)if(n!==page&&doc.getPage(n).node.get(lib.PDFName.of('Contents'))?.toString()===contents.toString())fail('Flux de page partagé non compatible.');
  const raw=doc.context.lookup(contents);
  if(!(raw instanceof lib.PDFRawStream))fail('Flux PDF non compatible.');
  const decoded=lib.decodePDFRawStream(raw).decode();
  const source=Array.from(decoded,b=>String.fromCharCode(b)).join('');
  const cleaned=removeShipping(source,zone.selected);
  // Replace the original object, rather than overlaying or retaining an orphan copy.
  doc.context.assign(contents,doc.context.flateStream(Uint8Array.from(cleaned,c=>c.charCodeAt(0))));
  doc.registerFontkit(fontkit);
  const font=await doc.embedFont(fontBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true});
  const allowed=new Set(font.getCharacterSet());
  if(lines.some(l=>Array.from(l).some(c=>!allowed.has(c.codePointAt(0)))))fail('Un caractère de cette adresse n’est pas couvert par la police. Veuillez utiliser sa transcription latine.');
  let size=10.5;
  while(size>=8 && (lines.some(l=>font.widthOfTextAtSize(l,size)>zone.width) || 27+lines.length*size*1.3>zone.height))size-=.25;
  if(size<8)fail('Cette adresse dépasse l’espace disponible. Raccourcissez les lignes ou le nom du point relais.');
  target.drawText('Adresse de livraison',{x:zone.x,y:zone.y,font:bold,size:10.5,color:lib.rgb(0,0,0)});
  lines.forEach((line,i)=>{if(line)target.drawText(line,{x:zone.x,y:zone.y-26.25-i*size*1.3,font,size,color:lib.rgb(0,0,0)});});
  const output=await doc.save({useObjectStreams:true,addDefaultPage:false});
  const after=await analyse(output,pdfjs);
  if(after.pages.length!==before.pages.length)fail('Le nombre de pages a changé. Le téléchargement a été bloqué.');
  for(let n=0;n<before.pages.length;n++){
    const old=before.pages[n].items.filter(i=>i.str.trim()&&!(n===page&&zone.selected.includes(i))).map(fingerprint).sort();
    const fresh=after.pages[n].items.filter(i=>i.str.trim()&&!(n===page&&after.zone.selected.includes(i))).map(fingerprint).sort();
    if(JSON.stringify(old)!==JSON.stringify(fresh))fail('Le contrôle de conservation des textes et montants a échoué. Aucun fichier ne sera téléchargé.');
  }
  const newText=after.zone.selected.map(i=>i.str).join('\n');
  if(newText!=='Adresse de livraison\n'+lines.filter(l=>l.trim()).join('\n'))fail('Le contrôle de la nouvelle adresse a échoué. Aucun fichier ne sera téléchargé.');
  return {bytes:output,filename:outputName(before.text,filename),size,removed:zone.selected.length};
}
