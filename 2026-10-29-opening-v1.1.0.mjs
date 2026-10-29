export function correctOpening(cues, draft, duration) {
  if (!cues?.length) throw Error('자막이 없습니다.');
  const start=Math.round(draft.start*1000)/1000,end=Math.round(draft.end*1000)/1000,secondStart=draft.secondStart==null?null:Math.round(draft.secondStart*1000)/1000;
  if (![start,end,duration].every(Number.isFinite) || start < 0 || end <= start || end > duration)
    throw Error('첫 자막의 시작 < 종료 ≤ 음악 길이를 확인하세요.');
  if (cues[1] && (!Number.isFinite(secondStart) || secondStart < end || secondStart >= cues[1].end))
    throw Error('두 번째 자막 시작은 첫 자막 종료 이상, 두 번째 자막 종료 미만이어야 합니다.');
  return cues.map((c,i)=>({...c,...(i===0?{start:Math.round(start*1000)/1000,end:Math.round(end*1000)/1000}:i===1?{start:Math.round(secondStart*1000)/1000}:{})}));
}
export function openingCandidate(frames) {
  if (!frames.length) return {start:null,status:'review'};
  const levels=frames.map(f=>f.rms).sort((a,b)=>a-b);
  const peak=levels[Math.floor((levels.length-1)*.95)]||0;
  const noise=levels[Math.floor((levels.length-1)*.2)]||0;
  const threshold=Math.max(.0003,peak*.08,noise*6);
  if(frames.length>=5 && frames.slice(0,5).every(f=>f.rms>.003&&f.rms/Math.max(f.mix,.00001)>.4))return {start:0,status:'review',threshold,noise,peak};
  for(let i=0;i<frames.length-4;i++) {
    const window=frames.slice(i,i+5);
    if(window.filter(f=>f.rms>=threshold && f.rms/Math.max(f.mix,.00001)>.025).length>=4 && window[0].rms>=threshold) {
      return {start:Math.max(0,Math.round(frames[i].time*1000)/1000),status:'review',threshold,noise,peak};
    }
  }
  return {start:null,status:'review',threshold,noise,peak};
}
