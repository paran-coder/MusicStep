import {correctOpening} from './2026-10-29-opening-v1.1.0.mjs';
export const isComplete=status=>status==='auto'||status==='done';
const time=value=>Number(value).toFixed(2)+'초';
export function explainOpening(cues,draft,duration){
 const {start,end,secondStart}=draft;
 if(!Number.isFinite(start)||start<0)return {code:'invalid-start',title:'첫 가사가 나타날 시간을 확인해주세요.',message:'첫 가사 표시 시작에는 0초 이상의 시간을 입력해주세요.',field:'start'};
 if(!Number.isFinite(end)||end<=start)return {code:'end-before-start',title:'첫 가사와 다음 가사를 이어줄 지점이 필요해요.',message:`첫 가사는 ${time(start)}부터 보여줘야 하는데, 표시 끝은 ${Number.isFinite(end)?time(end):'입력되지 않은 상태'}입니다. ${cues[1]?'아래에서 듣다가 두 번째 가사가 시작되는 순간 버튼을 누르세요. 두 시간은 함께 맞춰지고 저장됩니다.':'세부 조정에서 첫 가사가 사라질 시간을 정해주세요.'}`,field:'opening-end'};
 if(end>duration)return {code:'song-limit',title:'가사 자막이 음악보다 늦게 끝나요.',message:`이 음악의 길이는 ${time(duration)}입니다. 첫 가사 표시 끝을 음악이 끝나기 전으로 맞춰주세요.`,field:'opening-end'};
 if(cues[1]&&(!Number.isFinite(secondStart)||secondStart<end))return {code:'second-overlap',title:'첫 가사와 두 번째 가사가 겹쳐서 표시돼요.',message:`첫 가사는 ${time(end)}까지 보이는데, 두 번째 가사는 ${Number.isFinite(secondStart)?time(secondStart):'입력되지 않은 시각'}부터 나옵니다. 아래에서 듣다가 두 번째 가사가 시작되는 순간 누르면, 두 시간을 함께 맞추고 저장합니다.`,field:'second-start'};
 if(cues[1]&&secondStart>=cues[1].end)return {code:'second-reversed',title:'두 번째 가사의 표시 시간을 확인해주세요.',message:`두 번째 가사는 ${time(cues[1].end)}에 사라지도록 되어 있습니다. 그보다 앞의 시각을 두 번째 가사 표시 시작으로 정해주세요.`,field:'second-start'};
 return null;
}
export function assessAnalysis({cues,draft,duration,result,method,manualChanges=false}){
 if(!Number.isFinite(result?.start)||result.start<0)return {status:'review',issue:{code:'no-candidate',title:'목소리 시작을 확실하게 찾지 못했어요.',message:'시작 전후 듣기로 확인하거나 정밀 분석을 선택해주세요.'}};
 const proposed={start:result.start,end:draft.end,secondStart:draft.secondStart};
 const issue=explainOpening(cues,proposed,duration);
 if(issue)return {status:'review',issue};
 if(manualChanges)return {status:'review',issue:{code:'manual-changes',title:'직접 조정한 표시 시간이 있어요.',message:'자동으로 덮어쓰지 않았습니다. 변경 내용을 확인한 뒤 저장해주세요.'}};
 if(method!=='fast'||!Number.isFinite(result.score)||result.score<.7)return {status:'review',issue:{code:'uncertain',title:'시작 지점을 한 번 들어봐주세요.',message:'자동 적용 기준을 통과하지 못했습니다. 첫 목소리가 맞는지 확인한 뒤 저장해주세요.'}};
 return {status:'auto',cues:correctOpening(cues,proposed,duration),issue:null};
}
