import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const target=path.resolve('public/og-image.png');
try{await fs.access(target);throw new Error('Existing og-image.png is preserved; review before regenerating.');}catch(e){if(e.code!=='ENOENT')throw e;}
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
 await page.setContent(await fs.readFile('2026-10-29-og-image.html','utf8'));
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:target});
 console.log('Created',target,'1200 × 630 PNG');
}finally{await browser.close();}
