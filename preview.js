import * as pdfjs from './vendor/pdf.mjs';
// Compare rendered pixels outside the shipping region, on every page.
export async function verifyRendering(original, modified, info, preview) {
  const docs=await Promise.all([original,modified].map(bytes=>pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false}).promise));
  try{
    for(let n=1;n<=docs[0].numPages;n++){
      const canvases=[];
      for(const doc of docs){
        const page=await doc.getPage(n),view=page.getViewport({scale:1.5});
        const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);
        await page.render({canvasContext:canvas.getContext('2d',{willReadFrequently:true}),viewport:view}).promise;canvases.push(canvas);
      }
      const [a,b]=canvases;
      if(a.width!==b.width||a.height!==b.height)throw new Error('Le format visuel du document a changé.');
      const old=a.getContext('2d').getImageData(0,0,a.width,a.height).data,fresh=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
      const r=info.zone.region,h=info.pages[n-1].height;
      for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
        if(n===info.page+1&&x/1.5>=r.left-3&&x/1.5<=r.right+3&&y/1.5>=h-r.top-3&&y/1.5<=h-r.bottom+3)continue;
        const p=(y*a.width+x)*4;
        if(old[p]!==fresh[p]||old[p+1]!==fresh[p+1]||old[p+2]!==fresh[p+2]||old[p+3]!==fresh[p+3])throw new Error('Le contrôle visuel a détecté une différence hors de l’adresse. Le téléchargement est bloqué.');
      }
      if(n===info.page+1){preview.width=b.width;preview.height=b.height;preview.getContext('2d').drawImage(b,0,0);}
    }
  }finally{await Promise.all(docs.map(d=>d.destroy()));}
}
