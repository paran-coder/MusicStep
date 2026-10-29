import {env,InferenceSession,Tensor} from 'onnxruntime-web/wasm';
import {PffftSTFT} from 'web-audio-separation';
import {openingCandidate} from './2026-10-29-opening-v1.1.0.mjs';
env.wasm.wasmPaths='/vendor/ort/';
env.wasm.numThreads=1;
env.wasm.proxy=false;
let session;
self.onmessage=async({data})=>{
  try {
    postMessage({type:'progress',message:'보컬 분리 모델 준비 중 (약 67MB, 브라우저 로컬 실행)…'});
    session ||= await InferenceSession.create('/models/2026-10-29-UVR-MDX-NET-Voc_FT.onnx',{executionProviders:['wasm'],graphOptimizationLevel:'all'});
    const left=new Float32Array(data.left),right=new Float32Array(data.right);
    const nfft=7680,hop=1024,chunk=hop*255,trim=nfft/2,step=chunk-2*trim;
    const stft=new PffftSTFT(nfft,hop,3072);await stft.init();
    const vocals=[new Float32Array(left.length),new Float32Array(left.length)];
    let processed=0,frames=[],result;
    const energyFrames=(endIndex)=>{const values=[],window=4410;for(let pos=0;pos<endIndex;pos+=window){let vs=0,ms=0;const end=Math.min(pos+window,endIndex);for(let i=pos;i<end;i++){vs+=vocals[0][i]**2+vocals[1][i]**2;ms+=left[i]**2+right[i]**2;}const count=Math.max(1,(end-pos)*2);values.push({time:pos/44100,rms:Math.sqrt(vs/count),mix:Math.sqrt(ms/count)});}return values;};
    for(let pos=0;pos<left.length;pos+=step){
      const input=new Float32Array(chunk*2);
      for(let ch=0;ch<2;ch++){const source=ch===0?left:right;const begin=pos-trim,from=Math.max(0,begin),to=Math.min(source.length,begin+chunk);if(to>from)input.set(source.subarray(from,to),ch*chunk+from-begin);}
      const spectrum=stft.forward(input,1,chunk);
      const tensor=new Tensor('float32',spectrum,[1,4,3072,256]);
      const outputs=await session.run({[session.inputNames[0]]:tensor});
      const output=outputs[session.outputNames[0]],signal=stft.inverse(output.data,1);
      const length=Math.min(step,left.length-pos);
      for(let ch=0;ch<2;ch++)vocals[ch].set(signal.subarray(ch*chunk+trim,ch*chunk+trim+length),pos);
      tensor.dispose();for(const value of Object.values(outputs))value.dispose();
      processed=pos+length;frames=energyFrames(processed);result=openingCandidate(frames);
      postMessage({type:'progress',message:`보컬 분리 ${Math.min(100,Math.round((pos+step)/left.length*100))}%`});
      if(result.start!==null&&processed/44100>=result.start+1)break;
    }
    result ||= openingCandidate(frames);
    postMessage({type:'result',frames,result,processedSeconds:processed/44100});
  }catch(error){postMessage({type:'error',message:error.message||String(error)});}
};
