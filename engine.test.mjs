import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detect,removeShipping,outputName,tokens,addressTextMatches} from './engine.js';
const item=(str,x,y,width=110)=>({str,transform:[10,0,0,10,x,y],width,height:10});
const items=[item('Adresse de livraison ( ou de',210,732,165),item('reference dans le cas d’une',210,719),item('livraison en point relais )',210,706),item('Ancien nom',210,680),item('Ancienne rue',210,667),item('Adresse de facturation',386,732),item('Nom facturation',386,706),item('Numéro de facture',60,585),item('12,89 €',510,370)];
test('Repère la livraison à partir des textes et exclut la facturation et les montants',()=>{const z=detect(items,595.28,841.89);assert.equal(z.selected.length,5);assert(!z.selected.includes(items[5]));assert(!z.selected.includes(items[8]));});
test('Refuse les documents sans adresses ou ambigus',()=>{assert.throws(()=>detect([],595,842));assert.throws(()=>detect([...items,items[0]],595,842));assert.throws(()=>detect(items,842,595));});
test('Supprime réellement les objets de livraison sans toucher aux autres',()=>{const z=detect(items,595.28,841.89);const src=items.map(i=>`q BT ${i.transform[4]} ${i.transform[5]} Td [(Secret ${i.str.replace(/[()]/g,'')})] TJ ET Q`).join('\n');const clean=removeShipping(src,z.selected);assert(!clean.includes('Ancienne rue'));assert(clean.includes('Nom facturation'));assert(clean.includes('12,89 €'));});
test('Suit les transformations et ignore les opérateurs dans les chaînes',()=>{const s=item('test',210,732);const src='q 1 0 0 1 10 12 cm BT 200 720 Td [(BT ET cm \\(nom\\))] TJ ET Q';assert(!removeShipping(src,[s]).includes('nom'));assert.equal(tokens('(ET BT \\(foo\\))')[0].kind,'string');});
test('Refuse une suppression partielle, dupliquée ou une structure inattendue',()=>{const s=item('test',210,732);assert.throws(()=>removeShipping('BT 211 732 Td [(nom)] TJ ET',[s]));assert.throws(()=>removeShipping('BT 210 732 Td (nom) Tj ET',[s]));assert.throws(()=>removeShipping('BT 210 732 Td [(nom)] TJ ET BT 210 732 Td [(nom)] TJ ET',[s]));});
test('Nom de sortie BX et conservation du numéro',()=>{assert.equal(outputName('#FA084421','source.pdf'),'BX FA084421.pdf');assert.equal(outputName('sans numéro','facture.pdf'),'BX facture.pdf');});

test('Le contrôle accepte les espaces de collage sans modifier les lignes',()=>{
 const actual=['Adresse de livraison','Point relais carrefour expresse','12 rue de charenton','75012 paris'].map(str=>({str}));
 assert(addressTextMatches(actual,[' Point relais carrefour expresse','12 rue de charenton ','75012 paris']));
 assert(addressTextMatches(actual,['Point relais  carrefour expresse','12 rue de charenton\u00a0','75012 paris']));
 assert(!addressTextMatches(actual,['Point relais carrefour expresse','12 rue de charenton','75013 paris']));
 assert(!addressTextMatches([...actual,{str:'Ancien téléphone'}],['Point relais carrefour expresse','12 rue de charenton','75012 paris']));
 assert(!addressTextMatches(actual,['Point relais carrefour expresse','75012 paris','12 rue de charenton']));
});
