const N=1024,HOP=160,BANDS=80,SR=16000;
const hann=Float64Array.from({length:N},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/N));
const hzToMel=hz=>hz<1000?hz/(200/3):15+Math.log(hz/1000)/(Math.log(6.4)/27);
const melToHz=mel=>mel<15?mel*(200/3):1000*Math.exp((mel-15)*(Math.log(6.4)/27));
let filters;
export function melWeights(){
 if(filters)return filters;
 const points=Array.from({length:BANDS+2},(_,i)=>melToHz(hzToMel(SR/2)*i/(BANDS+1)));
 filters=Array.from({length:BANDS},(_,i)=>Float64Array.from({length:513},(_,k)=>{
  const freq=k*SR/N;return Math.max(0,Math.min((freq-points[i])/(points[i+1]-points[i]),(points[i+2]-freq)/(points[i+2]-points[i+1])))*2/(points[i+2]-points[i]);
 }));return filters;
}
function fftPower(samples,center){
 const real=new Float64Array(N),imag=new Float64Array(N),length=samples.length;
 for(let i=0;i<N;i++){let j=center+i-N/2;if(length<=1)j=0;else{while(j<0||j>=length)j=j<0?-j:2*length-2-j;}real[i]=(samples[j]||0)*hann[i];}
 for(let i=1,j=0;i<N;i++){let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[real[i],real[j]]=[real[j],real[i]];}
 for(let size=2;size<=N;size<<=1){const angle=-2*Math.PI/size,wr=Math.cos(angle),wi=Math.sin(angle);for(let base=0;base<N;base+=size){let ar=1,ai=0;for(let j=0;j<size/2;j++){const p=base+j,q=p+size/2,tr=ar*real[q]-ai*imag[q],ti=ar*imag[q]+ai*real[q];real[q]=real[p]-tr;imag[q]=imag[p]-ti;real[p]+=tr;imag[p]+=ti;const next=ar*wr-ai*wi;ai=ar*wi+ai*wr;ar=next;}}}
 return Float64Array.from({length:513},(_,i)=>real[i]**2+imag[i]**2);
}
export function logMel(samples){
 const count=1+Math.floor(samples.length/HOP),data=new Float32Array(count*BANDS),weights=melWeights();let max=1e-10;
 for(let t=0;t<count;t++){const power=fftPower(samples,t*HOP);for(let b=0;b<BANDS;b++){let value=0;const w=weights[b];for(let k=0;k<513;k++)value+=w[k]*power[k];data[t*BANDS+b]=value;max=Math.max(max,value);}}
 const reference=10*Math.log10(max);
 for(let i=0;i<data.length;i++)data[i]=Math.max(-80,10*Math.log10(Math.max(1e-10,data[i]))-reference);
 return {count,bands:BANDS,data};
}
export function windowAt(feature,center){
 const out=new Float32Array(75*80);for(let i=0;i<75;i++){const frame=Math.max(0,Math.min(feature.count-1,center-37+i));out.set(feature.data.subarray(frame*80,frame*80+80),i*80);}return out;
}
