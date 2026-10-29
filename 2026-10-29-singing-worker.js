import {env,InferenceSession,Tensor} from 'onnxruntime-web/wasm';
import {logMel,windowAt} from './2026-10-29-singing-features.mjs';
import {VoiceGate} from './2026-10-29-fast-voice.mjs';
env.wasm.wasmPaths='/vendor/ort/';env.wasm.numThreads=1;env.wasm.proxy=false;
let session;
self.onmessage=async({data})=>{
 try {
  const begin=performance.now();postMessage({type:'progress',message:'빠른 노래 보컬 감지 모델 준비 중 (약 9.56MB)…'});
  const samples=new Float32Array(data.samples);
  if(!samples.some(s=>Math.abs(s)>.0001)){postMessage({type:'result',kind:'singing',frames:[],result:{start:null,status:'review'},processedSeconds:samples.length/16000,modelMs:Math.round(performance.now()-begin)});return;}
  session ||= await InferenceSession.create('/models/2026-10-29-singing-voice.onnx',{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  const feature=logMel(samples),gate=new VoiceGate({threshold:.7,minFrames:3,maxGapFrames:1}),frames=[];
  const classify=async center=>{const input=new Tensor('float32',windowAt(feature,center),[1,1,75,80]);const out=await session.run({input});const score=Number(out.probability.data[0]);input.dispose();out.probability.dispose();return score;};
  let candidate=null,processed=0;
  for(let center=37;center<feature.count-37;center+=25){const score=await classify(center);frames.push({time:center*.01,score});processed=(center+37)*.01;candidate=gate.push(center*.01,score);if(candidate&&!data.probe)break;if(frames.length%10===0)postMessage({type:'progress',message:`빠른 보컬 감지 ${processed.toFixed(1)}초 구간 확인 중…`});}
  let result=gate.result||{start:null,status:'review'};
  if(result.start!==null&&!data.probe){const coarse=result.start,refine=new VoiceGate({threshold:.5,minFrames:3,maxGapFrames:0});for(let center=Math.max(37,Math.round(coarse*100)-25);center<=Math.min(feature.count-38,Math.round(coarse*100)+25);center+=5){const score=await classify(center);frames.push({time:center*.01,score});const r=refine.push(center*.01,score);if(r){result=r;break;}}}
  frames.sort((a,b)=>a.time-b.time);
  postMessage({type:'result',kind:'singing',frames,result,processedSeconds:processed,modelMs:Math.round(performance.now()-begin)});
 }catch(error){postMessage({type:'error',message:error.message||String(error)});}
};
