import {correctOpening} from './2026-10-29-opening-v1.1.0.mjs';
export function captureNextLyric(cues,start,playbackTime,duration){
 if(!cues?.[1])throw Error('지정할 두 번째 가사 자막이 없습니다. 세부 조정을 이용해주세요.');
 const boundary=Math.round(playbackTime*1000)/1000,firstStart=Math.round(start*1000)/1000;
 if(!Number.isFinite(boundary)||!Number.isFinite(firstStart)||firstStart<0||boundary<=firstStart)throw Error('아직 첫 가사가 시작되기 전이에요. 두 번째 가사가 들리는 순간에 눌러주세요.');
 if(boundary>=cues[1].end)throw Error('두 번째 가사의 표시 끝을 지났어요. 다시 듣고 두 번째 가사가 시작될 때 눌러주세요.');
 if(!Number.isFinite(duration)||boundary>duration)throw Error('음악 길이를 벗어난 위치입니다. 두 번째 가사를 다시 들어주세요.');
 return {boundary,cues:correctOpening(cues,{start:firstStart,end:boundary,secondStart:boundary},duration)};
}
