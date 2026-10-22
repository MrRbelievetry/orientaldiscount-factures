import * as pdfjs from './vendor/pdf.mjs';
import {analyse,modify,outputName} from './engine.js?v=1.0.1';
import {verifyRendering} from './preview.js';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
const $=id=>document.getElementById(id);
let bytes=null,name='',url=null,revision=0,busy=false;
const clearResult=()=>{if(url)URL.revokeObjectURL(url);url=null;$('download').hidden=true;$('reset').hidden=true;$('preview-panel').hidden=true;$('status').textContent='';$('status').className='';};
const message=(text,type='')=>{$('status').textContent=text;$('status').className=type;};
$('file').addEventListener('change',async()=>{
  const current=++revision;clearResult();bytes=null;$('generate').disabled=true;$('file-status').textContent='';
  const file=$('file').files[0];if(!file)return;
  $('filename').textContent=file.name;
  try{
    if(!/\.pdf$/i.test(file.name)||file.size>20*1024*1024)throw new Error('Sélectionnez un PDF de 20 Mo maximum.');
    const data=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw new Error('Le fichier sélectionné n’est pas un PDF valide.');
    $('file-status').textContent='Vérification de la facture…';const info=await analyse(data,pdfjs);if(current!==revision)return;
    bytes=data;name=file.name;$('output-name').textContent=outputName(info.text,name);$('file-status').textContent='✓ Bloc de livraison détecté · facturation distincte';$('generate').disabled=false;
  }catch(e){if(current===revision){$('file-status').textContent='';message(e.message,'error');}}
});
$('address').addEventListener('input',()=>{if(!busy)clearResult();});
$('form').addEventListener('submit',async e=>{
  e.preventDefault();if(!bytes||busy)return;busy=true;clearResult();$('generate').disabled=true;$('file').disabled=true;$('address').disabled=true;message('Modification et contrôle du document…');
  try{
    const [fontBytes,boldBytes]=await Promise.all(['Vera.ttf','VeraBd.ttf'].map(async f=>{const r=await fetch(new URL('./fonts/'+f,import.meta.url));if(!r.ok)throw new Error('Impossible de charger les polices. Rechargez la page.');return new Uint8Array(await r.arrayBuffer());}));
    const result=await modify(bytes,$('address').value,name,{pdfjs,lib:window.PDFLib,fontkit:window.fontkit,fontBytes,boldBytes});
    await verifyRendering(bytes,result.bytes,await analyse(bytes,pdfjs),$('preview'));
    url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));$('download').href=url;$('download').download=result.filename;$('download').textContent='Télécharger '+result.filename;$('download').hidden=false;$('reset').hidden=false;
    $('preview-panel').hidden=false;
    message('Facture prête. Adresse remplacée ; textes, montants et rendu hors adresse contrôlés.','success');$('download').click();
  }catch(e){message(e.message||'Le traitement a échoué. Aucun document n’a été téléchargé.','error');}
  finally{busy=false;$('generate').disabled=!bytes;$('file').disabled=false;$('address').disabled=false;}
});
$('reset').addEventListener('click',()=>{revision++;clearResult();bytes=null;name='';HTMLFormElement.prototype.reset.call($('form'));$('generate').disabled=true;$('filename').textContent='Facture OrientalDiscount au format A4 · 20 Mo maximum';$('file-status').textContent='';$('output-name').textContent='BX FA[numéro].pdf';$('file').focus();});
window.addEventListener('pagehide',()=>{if(url)URL.revokeObjectURL(url);});
