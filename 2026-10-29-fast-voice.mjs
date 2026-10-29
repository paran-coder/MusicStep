export class VoiceGate {
  constructor({threshold=.6,minFrames=8,maxGapFrames=2}={}) {
    this.threshold=threshold;this.minFrames=minFrames;this.maxGapFrames=maxGapFrames;
    this.start=null;this.voiced=0;this.gap=0;this.score=1;this.result=null;
  }
  push(time,score) {
    if(this.result)return this.result;
    if(Number.isFinite(time)&&Number.isFinite(score)&&score>=this.threshold) {
      if(this.start===null)this.start=time;
      this.voiced++;this.gap=0;this.score=Math.min(this.score,score);
      if(this.voiced>=this.minFrames)this.result={start:Math.round(this.start*1000)/1000,status:'review',score:this.score};
    } else if(this.start!==null&&++this.gap>this.maxGapFrames) {
      this.start=null;this.voiced=0;this.gap=0;this.score=1;
    }
    return this.result;
  }
}
