import test from 'node:test';
import assert from 'node:assert/strict';
import {siteOrigin,socialMetadata} from './2026-10-29-social-meta.mjs';
test('production domain wins over preview deployment domain',()=>assert.equal(siteOrigin({VERCEL_PROJECT_PRODUCTION_URL:'musicstep.example.com',VERCEL_URL:'preview.example.com'}),'https://musicstep.example.com'));
test('explicit public domain wins and trailing slash is normalized',()=>assert.equal(siteOrigin({SITE_URL:'https://custom.example.com/',VERCEL_PROJECT_PRODUCTION_URL:'musicstep.example.com'}),'https://custom.example.com'));
test('local build uses the user confirmed production domain',()=>assert.equal(siteOrigin({}),'https://music-step.vercel.app'));
test('Vercel without exposed environment uses the confirmed production domain',()=>assert.equal(siteOrigin({VERCEL:'1'}),'https://music-step.vercel.app'));
test('unsafe or non-origin URLs cannot enter the HTML head',()=>{for(const SITE_URL of ['http://example.com','https://user:pass@example.com','https://example.com/sub','https://example.com/?a=1','javascript:alert(1)'])assert.throws(()=>siteOrigin({SITE_URL}));});
test('OG and Twitter image URLs plus canonical exist in built HTML',()=>{const result=socialMetadata({SITE_URL:'https://musicstep.example.com'}).transformIndexHtml('<head><meta property="og:image" content="/og-image.png"><meta name="twitter:image" content="/og-image.png"></head>');assert.equal((result.match(/https:\/\/musicstep.example.com\/og-image.png/g)||[]).length,2);assert.match(result,/property="og:url"/);assert.match(result,/rel="canonical"/);});
