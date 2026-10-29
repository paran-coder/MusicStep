import { pcm16, wavHeader, outputFrames } from './2026-10-29-core.mjs';
import { Zip, ZipPassThrough, strToU8 } from 'fflate';
export async function decode(file) {
 const ctx = new AudioContext({sampleRate:44100});
 try {return await ctx.decodeAudioData(await file.arrayBuffer());} finally {await ctx.close();}
}
export function waveform(buffer,bins=3000){
 const peaks=new Float32Array(bins);const stride=Math.max(1,Math.floor(buffer.length/bins));
 for(let b=0;b<bins;b++){let peak=0;for(let ch=0;ch<buffer.numberOfChannels;ch++){const d=buffer.getChannelData(ch);for(let i=b*stride;i<Math.min((b+1)*stride,d.length);i+=Math.max(1,Math.floor(stride/100)))peak=Math.max(peak,Math.abs(d[i]));}peaks[b]=peak;}return peaks;
}
export async function mono16(buffer,seconds){
 const frames=Math.max(1,Math.round(Math.min(seconds,buffer.duration)*16000));
 const offline=new OfflineAudioContext(1,frames,16000),source=offline.createBufferSource();source.buffer=buffer;source.connect(offline.destination);source.start();return (await offline.startRendering()).getChannelData(0).slice();
}
export function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export async function openSink(name,estimatedBytes){
 if(estimatedBytes>512*1024*1024&&!window.showSaveFilePicker)throw Error('이 크기는 디스크 직접 저장이 필요합니다. 데스크톱 Chrome/Edge를 사용하거나 곡을 나눠주세요.');
 if(window.showSaveFilePicker){const handle=await window.showSaveFilePicker({suggestedName:name});const writable=await handle.createWritable();return {write:data=>writable.write(data),close:()=>writable.close(),abort:()=>writable.abort(),disk:true};}
 let parts=[],size=0;return {async write(data){size+=data.byteLength;if(size>512*1024*1024)throw Error('브라우저 메모리 저장 한도 512MB를 초과했습니다.');parts.push(data);},async close(){download(new Blob(parts),name);parts=[];},async abort(){parts=[];},disk:false};
}
export async function exportWav(tracks,gap,sink,onProgress,signal){
 const total=tracks.reduce((n,t)=>n+outputFrames(t.duration),0)+outputFrames(gap)*Math.max(0,tracks.length-1);await sink.write(wavHeader(total));
 const zeros=new Uint8Array(65536*4);
 for(let index=0;index<tracks.length;index++){
  if(signal.aborted)throw new DOMException('취소되었습니다.','AbortError');
  onProgress(`음악 연결 ${index+1}/${tracks.length} · ${tracks[index].file.name}`);
  let buffer=await decode(tracks[index].file);const length=outputFrames(tracks[index].duration);
  if(buffer.sampleRate!==44100||buffer.length!==length)throw Error('디코딩 길이가 변경되었습니다. 파일을 다시 불러오세요.');
  const left=buffer.getChannelData(0),right=buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1));
  for(let start=0;start<length;start+=65536){if(signal.aborted)throw new DOMException('취소되었습니다.','AbortError');await sink.write(pcm16([left,right],start,Math.min(65536,length-start)));if(start%(65536*8)===0)await new Promise(r=>setTimeout(r,0));}buffer=null;
  if(index<tracks.length-1)for(let remaining=outputFrames(gap);remaining>0;remaining-=65536){if(signal.aborted)throw new DOMException('취소되었습니다.','AbortError');await sink.write(zeros.subarray(0,Math.min(remaining,65536)*4));}
 }
}
export async function exportZip(entries,sink,signal){
 let writes=Promise.resolve(),error;
 const zip=new Zip((err,data)=>{if(err){error=err;return;}writes=writes.then(()=>sink.write(data));writes.catch(()=>{});});
 for(const e of entries){if(signal.aborted)throw new DOMException('취소되었습니다.','AbortError');const stream=new ZipPassThrough(e.name);zip.add(stream);if(typeof e.data==='string'){stream.push(strToU8(e.data),true);await writes;}else{const reader=e.data.stream().getReader();try{while(true){if(signal.aborted)throw new DOMException('취소되었습니다.','AbortError');const {done,value}=await reader.read();if(done)break;stream.push(value,false);await writes;}stream.push(new Uint8Array(),true);}finally{await reader.cancel();}}if(error)throw error;}
 zip.end();await writes;if(error)throw error;
}
