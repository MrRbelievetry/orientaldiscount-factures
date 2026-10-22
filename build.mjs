import fs from 'node:fs/promises';
await fs.mkdir('dist/vendor',{recursive:true});
await fs.mkdir('dist/fonts',{recursive:true});
for(const file of ['index.html','style.css','app.js','engine.js','preview.js'])await fs.copyFile(file,'dist/'+file);
for(const [from,to]of [
 ['pdf-lib/dist/pdf-lib.min.js','pdf-lib.min.js'],
 ['@pdf-lib/fontkit/dist/fontkit.umd.min.js','fontkit.umd.min.js'],
 ['pdfjs-dist/build/pdf.mjs','pdf.mjs'],
 ['pdfjs-dist/build/pdf.worker.mjs','pdf.worker.mjs']
])await fs.copyFile('node_modules/'+from,'dist/vendor/'+to);
for(const file of ['Vera.ttf','VeraBd.ttf'])await fs.writeFile('dist/fonts/'+file,Buffer.from(await fs.readFile(file+'.b64','utf8'),'base64'));
await fs.copyFile('FONT-LICENSE.txt','dist/fonts/LICENSE.txt');
await fs.writeFile('dist/.nojekyll','');
console.log('Application statique prÃªte dans dist/');
