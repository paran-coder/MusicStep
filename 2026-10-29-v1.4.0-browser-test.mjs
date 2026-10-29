import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { wavHeader, pcm16, parseSrt } from './2026-10-29-core.mjs';
const out=path.resolve('2026-10-29-v1.4.0-test-results');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-features=MediaRouter']});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:1050}});
await context.addInitScript(()=>{window.showSaveFilePicker=undefined;});
const page=await context.newPage(),requests=[],errors=[],results=[];
page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.goto('http://127.0.0.1:5173/');
const srt='1\n00:00:00,000 --> 00:00:06,000\n첫 가사\n\n2\n00:00:07,500 --> 00:00:09,000\n다음 가사\n';
function wav(seconds){const frames=seconds*44100;const a=new Float32Array(frames);for(let i=0;i<frames;i++)a[i]=i<44100*3?0:Math.sin(i/44100*440*2*Math.PI)*.15;return Buffer.concat([wavHeader(frames),pcm16([a,a],0,frames)]);}
const a=wav(12),b=wav(18);
const inputs=[{name:'private-a.wav',mimeType:'audio/wav',buffer:a},{name:'private-a.srt',mimeType:'text/plain',buffer:Buffer.from(srt)},{name:'private-b.wav',mimeType:'audio/wav',buffer:b},{name:'private-b.srt',mimeType:'text/plain',buffer:Buffer.from(srt)}];
async function check(name,fn){try{const detail=await fn();results.push({name,pass:true,detail});console.log('PASS',name,detail||'');}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message);}}
async function savedDownload(action,label){const event=page.waitForEvent('download');await action();const d=await event;const file=path.join(out,'2026-10-29-'+label+'-'+d.suggestedFilename());await d.saveAs(file);return fs.readFile(file);}
await check('import local music and captions; pending review blocks export',async()=>{await page.locator('#files').setInputFiles(inputs);await page.waitForFunction(()=>document.querySelector('#track-count').textContent==='2');await page.waitForFunction(()=>!document.querySelector('#files').disabled);assert.equal(await page.locator('#tracks li').count(),2);await page.locator('#export').click();assert.match(await page.locator('#notice').textContent(),/확인할 곡이 2곡/);});
await check('manual correction applies only first start and sets reviewed state',async()=>{await page.locator('#start').fill('3');await page.locator('#start').dispatchEvent('change');await page.locator('#apply').click();assert.match(await page.locator('#selected-status').textContent(),/검수 완료/);await page.getByRole('button',{name:'private-b.wav',exact:true}).click();await page.locator('#start').fill('4');await page.locator('#start').dispatchEvent('change');await page.locator('#apply').click();assert.match(await page.locator('#summary').textContent(),/완료 2/);});
await check('reorder and gap are reflected in exported combined SRT',async()=>{await page.getByRole('button',{name:'private-b.wav 위로'}).click();await page.locator('#gap').fill('2');await page.locator('#gap').dispatchEvent('change');await page.locator('#export-mode').selectOption('srt');const bytes=await savedDownload(()=>page.locator('#export').click(),'combined-srt');const cues=parseSrt(bytes.toString());assert.equal(cues[0].start,4);assert.equal(cues[0].end,6);assert.equal(cues[1].start,7.5);assert.equal(cues[2].start,23);assert.equal(cues[3].start,27.5);});
await check('combined ZIP contains sample-correct WAV plus corrected subtitles',async()=>{await page.locator('#export-mode').selectOption('combined');const bytes=await savedDownload(()=>page.locator('#export').click(),'combined-zip');const zip=unzipSync(bytes),wavEntry=Object.entries(zip).find(([n])=>n.endsWith('.wav'))[1],d=new DataView(wavEntry.buffer,wavEntry.byteOffset,wavEntry.byteLength);assert.equal(d.getUint32(40,true),32*44100*4);assert.equal(wavEntry.length,32*44100*4+44);const cues=parseSrt(strFromU8(Object.entries(zip).find(([n])=>n.endsWith('.srt'))[1]));assert.equal(cues[2].start,23);const silenceStart=18*44100*4+44;assert.equal(wavEntry.subarray(silenceStart,silenceStart+2*44100*4).some(x=>x!==0),false);});
await check('individual ZIP preserves original audio bytes',async()=>{await page.locator('#export-mode').selectOption('individual');const bytes=await savedDownload(()=>page.locator('#export').click(),'individual-zip');const zip=unzipSync(bytes);assert.deepEqual(Buffer.from(zip['01-private-b.wav']),b);assert.deepEqual(Buffer.from(zip['02-private-a.wav']),a);assert.equal(parseSrt(strFromU8(zip['02-private-a.srt']))[0].start,3);});
let project;
await check('project save stores local settings without embedding audio',async()=>{const bytes=await savedDownload(()=>page.locator('#save-project').click(),'project');project=JSON.parse(bytes);assert.deepEqual(project.tracks.map(t=>t.name),['private-b.wav','private-a.wav']);assert.equal(project.tracks[1].start,3);assert.ok(bytes.length<10000);});
await page.screenshot({path:path.join(out,'2026-10-29-desktop.png'),fullPage:true});
await check('project restore preserves saved order regardless of file selection order',async()=>{assert.ok(project);await page.locator('#project-file').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.locator('#files').setInputFiles([inputs[0],inputs[2]]);await page.waitForFunction(()=>document.querySelector('#track-count').textContent==='2');await page.waitForFunction(()=>!document.querySelector('#files').disabled);assert.equal(await page.locator('#tracks .track-name').first().textContent(),'private-b.wav');assert.match(await page.locator('#summary').textContent(),/완료 0/);});
await check('first two boundaries can be repaired without moving later captions',async()=>{
 await page.getByRole('button',{name:'private-a.wav',exact:true}).click();
 await page.locator('#start').fill('8');await page.locator('#start').dispatchEvent('change');
 assert.equal(await page.locator('#apply').isDisabled(),true);assert.match(await page.locator('#review-title').textContent(),/첫 가사/);
 await page.locator('#opening-boundaries summary').click();
 await page.locator('#opening-end').fill('8.5');await page.locator('#opening-end').dispatchEvent('change');
 await page.locator('#second-start').fill('8.5');await page.locator('#second-start').dispatchEvent('change');
 await page.locator('#apply').click();assert.match(await page.locator('#selected-status').textContent(),/검수 완료/);
 await page.getByRole('button',{name:'private-b.wav',exact:true}).click();await page.locator('#apply').click();
 await page.locator('#export-mode').selectOption('srt');const bytes=await savedDownload(()=>page.locator('#export').click(),'boundary-repair');
 const cues=parseSrt(bytes.toString());assert.equal(cues[2].start,28);assert.equal(cues[2].end,28.5);assert.equal(cues[3].start,28.5);assert.equal(cues[3].end,29);
 const saved=JSON.parse(await savedDownload(()=>page.locator('#save-project').click(),'boundary-project'));
 assert.equal(saved.version,2);assert.equal(saved.tracks[1].end,8.5);assert.equal(saved.tracks[1].secondStart,8.5);
});
await check('explicit precise mode dispatches separation and reports model failure as reviewable',async()=>{
 await page.route('**/models/*UVR-MDX-NET*',route=>route.abort());
 await page.locator('#analysis-method').selectOption('precise');await page.locator('#analyze-one').click();
 await page.waitForFunction(()=>!document.querySelector('#analyze-one').disabled,{},{timeout:10000});
 assert.ok(requests.some(r=>r.url.includes('UVR-MDX-NET')));
 assert.match(await page.locator('#analysis-note').textContent(),/분석 실패/);
 assert.equal(await page.locator('#selected-status').textContent(),'검수 필요');
 await page.unroute('**/models/*UVR-MDX-NET*');await page.locator('#analysis-method').selectOption('fast');
});
await check('mobile viewport has no horizontal overflow',async()=>{await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'2026-10-29-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));});
await check('no outside origin, upload body or content in request URLs',async()=>{const bad=requests.filter(r=>(!r.url.startsWith('http://127.0.0.1:5173/')&&!r.url.startsWith('blob:http://127.0.0.1:5173/'))||r.method!=='GET'||r.body||r.url.includes('private-'));assert.deepEqual(bad,[]);return {requests:requests.length};});
await check('no uncaught browser exceptions',async()=>assert.deepEqual(errors,[]));
await fs.writeFile(path.join(out,'2026-10-29-browser-results.json'),JSON.stringify({results,requests,errors},null,2));await browser.close();if(results.some(r=>!r.pass))process.exitCode=1;

