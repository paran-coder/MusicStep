import { defineConfig } from 'vite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {socialMetadata} from './2026-10-29-social-meta.mjs';
const ortWasmModule=join(dirname(createRequire(import.meta.url).resolve('onnxruntime-web/wasm')),'ort.wasm.min.mjs');
export default defineConfig({
 resolve:{alias:[{find:/^onnxruntime-web$/,replacement:ortWasmModule}]},
 plugins:[socialMetadata(),{name:'local-ort-runtime',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]==='/vendor/ort/ort-wasm-simd-threaded.mjs'){res.setHeader('Content-Type','application/javascript');res.end(readFileSync(new URL('./public/vendor/ort/ort-wasm-simd-threaded.mjs',import.meta.url)));}else next();});}}],
 server:{host:'127.0.0.1',port:5173,strictPort:true,headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},preview:{port:4173,strictPort:true,headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}},build:{target:'es2022'},worker:{format:'es'}
});
