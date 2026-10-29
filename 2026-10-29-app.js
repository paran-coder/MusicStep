import {parseSrt,formatSrt,mergeTimeline,pairFiles,srtTime,wavHeader,outputFrames,validateProject} from './2026-10-29-core.mjs';
import {decode,waveform,mono16,download,openSink,exportWav,exportZip} from './2026-10-29-audio.js';
import {Zip,ZipPassThrough,strToU8} from 'fflate';
import {correctOpening} from './2026-10-29-opening-v1.1.0.mjs';
import {assessAnalysis,explainOpening,isComplete} from './2026-10-29-review-policy.mjs';
import {captureNextLyric} from './2026-10-29-capture-boundary.mjs';
const $=id=>document.getElementById(id), audio=$('audio');
const state={tracks:[],selected:null,busy:false,worker:null,abort:null,unpaired:[],subtitles:[],project:[],preview:false,url:null};
const statusText={pending:'분석 대기',review:'검수 필요',auto:'자동 완료',done:'검수 완료',dirty:'저장 전',error:'오류'};
const current=()=>state.tracks.find(t=>t.id===state.selected);
const secs=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const safeName=name=>name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,120)||'track';
const dated='2026-10-29-MusicStep-v1.4.2';
function notify(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function setBusy(value){state.busy=value;for(const el of [$('files'),$('import-files'),$('empty-import'),$('load-project'),$('project-file'),$('add-pairs'),$('gap'),$('save-project'),$('analysis-method'),$('analysis-range')])el.disabled=value;$('cancel').hidden=!value||!state.abort;renderList();renderEditor();}
function badge(status){const el=document.createElement('span');el.className='badge '+(isComplete(status)?'done':status==='error'?'error':['review','dirty'].includes(status)?'review':'');el.textContent=statusText[status]||status;return el;}
function renderList(){
 const list=$('tracks');list.replaceChildren();
 const show=$('filter-review').checked;
 state.tracks.forEach((t,i)=>{if(show&&isComplete(t.status))return;const li=document.createElement('li');if(t.id===state.selected)li.className='active';
 const top=document.createElement('div');top.className='track-top';const number=document.createElement('span');number.className='track-index';number.textContent=String(i+1).padStart(2,'0');top.append(number);
 const info=document.createElement('div');info.className='track-info';const name=document.createElement('button');name.className='track-name';name.textContent=t.file.name;name.disabled=state.busy;name.onclick=()=>select(t.id);info.append(name);const meta=document.createElement('div');meta.className='track-meta';meta.textContent=`${secs(t.duration)} · 적용 ${t.applied.toFixed(2)}초${t.candidate!==null?' · 후보 '+t.candidate.toFixed(2)+'초':''}`;info.append(meta);top.append(info);li.append(top);
 const bottom=document.createElement('div');bottom.className='track-bottom';bottom.append(badge(t.status));const order=document.createElement('div');order.className='track-order';
 for(const [label,delta]of [['↑',-1],['↓',1]]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',`${t.file.name} ${delta<0?'위로':'아래로'}`);b.disabled=state.busy||i+delta<0||i+delta>=state.tracks.length;b.onclick=()=>{[state.tracks[i],state.tracks[i+delta]]=[state.tracks[i+delta],state.tracks[i]];renderList();};order.append(b);}
 const remove=document.createElement('button');remove.textContent='×';remove.className='remove';remove.setAttribute('aria-label',`${t.file.name} 목록에서 제외`);remove.disabled=state.busy;remove.onclick=()=>{state.tracks=state.tracks.filter(x=>x!==t);if(state.selected===t.id)select(state.tracks[0]?.id);renderList();renderEditor();};order.append(remove);bottom.append(order);li.append(bottom);list.append(li);
 });
 $('empty-list').hidden=state.tracks.length>0;$('track-count').textContent=state.tracks.length;const done=state.tracks.filter(t=>t.status==='done').length,auto=state.tracks.filter(t=>t.status==='auto').length,pending=state.tracks.length-done-auto;$('summary').textContent=state.tracks.length?`자동 ${auto} · 검수 완료 ${done} · 확인 ${pending}`:'준비된 곡 없음';
 const duration=state.tracks.reduce((n,t)=>n+t.duration,0)+getGap()*Math.max(0,state.tracks.length-1);
 $('export-summary').textContent=state.tracks.length?`${state.tracks.length}곡 · 총 ${secs(duration)} · 완료 ${done+auto}곡${pending?' · 확인할 곡 '+pending+'곡':''}`:'자동 완료와 검수 완료 곡을 순서대로 내보냅니다.';
 $('export').disabled=state.busy||!state.tracks.length;$('analyze-all').disabled=state.busy||!state.tracks.length;$('next-review').disabled=state.busy||!state.tracks.length;
}
function select(id){audio.pause();state.preview=false;state.selected=id;$('opening-boundaries').open=false;if(state.url)URL.revokeObjectURL(state.url);state.url=null;const t=current();if(t){state.url=URL.createObjectURL(t.file);audio.src=state.url;}else{audio.removeAttribute('src');audio.load();}renderList();renderEditor();}
function renderEditor(){
 const t=current(),disabled=!t||state.busy;
 for(const id of ['analyze-one','preview','start','minus','plus','apply','start-slider','opening-end','second-start'])$(id).disabled=disabled;
 $('selected-title').textContent=t?t.file.name:'음악을 선택하세요';$('selected-meta').textContent=t?`${secs(t.duration)} · ${t.srtName} · 원본 파일 보존`:'파형을 보며 첫 가사의 시작을 맞춥니다.';
 $('selected-status').replaceWith(Object.assign(badge(t?.status||'대기'),{id:'selected-status'}));
 $('lyric').textContent=t?t.cues[0].text:'아직 연결된 자막이 없습니다.';$('cue-end').textContent=t?`원본 첫 가사 표시 끝 ${t.cues[0].end.toFixed(2)}초`:'원본 첫 가사 표시 끝 —';
 const max=t?(t.cues[1]?.end??t.duration)-.002:30;
 $('start').value=t?t.draft.toFixed(3):'0';$('start').max=max;$('start-slider').max=max;$('start-slider').value=t?t.draft:0;
 $('opening-end').value=t?t.draftEnd.toFixed(3):'';$('second-start').value=t?.cues[1]?t.draftSecond.toFixed(3):'';$('second-start').disabled=disabled||!t?.cues[1];
 $('second-lyric').textContent=t?.cues[1]?'두 번째 가사: '+t.cues[1].text:'두 번째 가사 자막 없음';
 const geometry=t?explainOpening(t.cues,{start:t.draft,end:t.draftEnd,secondStart:t.draftSecond},t.duration):null;
 const issue=geometry||t?.reviewIssue||null;
 $('review-guidance').hidden=!t||!issue||isComplete(t.status);$('review-title').textContent=issue?.title||'';$('review-message').textContent=issue?.message||'';
 for(const id of ['start','opening-end','second-start'])$(id).setAttribute('aria-invalid',String(geometry?.field===id));
 if(!t?.cues[1]&&geometry?.field==='opening-end')$('opening-boundaries').open=true;
 $('boundary-warning').textContent=geometry?.field==='opening-end'?'첫 가사 표시 끝을 목소리가 시작된 뒤로 맞춰주세요.':geometry?.field==='second-start'?'두 번째 가사 표시 시작을 조정해주세요.':'노래 길이가 아니라 가사 자막이 보이는 시간을 조절하는 항목입니다.';
 $('change').textContent=t?`${t.cues[0].start.toFixed(2)}초 → ${t.draft.toFixed(2)}초`:'음악을 선택하면 변경 내용을 보여드립니다.';
 $('detected-time').textContent=t?.candidate!=null?t.candidate.toFixed(2)+'초':'—';
 $('result-caption').textContent=t?.status==='auto'?'분석 기준과 표시 시간 순서를 통과해 자동 적용했습니다. 추가 확인 없이 내보낼 수 있어요.':t?.status==='done'?'확인한 표시 시간을 저장했습니다. 내보내기에 반영됩니다.':t?.status==='dirty'?'직접 조정한 표시 시간이 아직 저장되지 않았어요. 확인 후 저장해주세요.':t?.status==='review'?'이 곡은 자동 적용하지 않았어요. 아래 가사 자막의 노란 안내를 확인해주세요.':'전체 분석을 누르면 정상 곡은 자동 수정됩니다.';
 $('apply').disabled=disabled||!!geometry||!!t&&isComplete(t.status);$('apply').hidden=!!t?.cues[1]&&!!geometry&&['opening-end','second-start'].includes(geometry.field);$('apply').textContent=t?.status==='auto'?'자동 적용 완료':t?.status==='done'?'검수 완료':geometry?'표시 시간을 먼저 조정해주세요':'확인한 시간 저장';
 $('analysis-note').textContent=t?.status==='done'?'확인한 가사 자막 표시 시간을 저장했습니다. 내보내기에 반영됩니다.':t?.status==='dirty'?'표시 시간을 조정 중입니다. 저장한 뒤 내보내기에 반영됩니다.':t?.note||'분석 기준과 표시 시간 순서를 통과하면 자동 적용합니다. 확인이 필요한 곡만 검수해주세요.';
 $('wave-empty').hidden=!!t;updateGuidedControls();draw();
}
function updateGuidedControls(){
 const t=current(),hasNext=!!t?.cues[1],position=audio.currentTime||0;
 const issue=t?explainOpening(t.cues,{start:t.draft,end:t.draftEnd,secondStart:t.draftSecond},t.duration):null;
 const captured=hasNext&&isComplete(t.status)&&t.boundaryCaptureTime!=null&&t.appliedEnd===t.boundaryCaptureTime&&t.appliedSecond===t.boundaryCaptureTime;
 const needsBoundary=issue&&['opening-end','second-start'].includes(issue.field);
 const show=hasNext&&(needsBoundary||captured||t.boundaryCaptureTime!=null&&!isComplete(t.status));
 $('next-lyric-review').hidden=!show;$('next-lyric-review').classList.toggle('captured',!!captured);
 $('next-lyric-text').textContent=hasNext?t.cues[1].text:'';
 $('guided-position').textContent=srtTime(position).replace(',','.');
 $('listen-next').disabled=state.busy||!hasNext;$('listen-next').textContent=captured?'① 다시 듣고 바꾸기':'① 첫 가사부터 듣기';
 const valid=hasNext&&Number.isFinite(t.draft)&&position>t.draft&&position<t.cues[1].end&&position<=t.duration;
 const sameSaved=captured&&Math.abs(position-t.boundaryCaptureTime)<.001;
 $('mark-next').disabled=state.busy||!valid||state.preview||!!sameSaved;
 $('mark-next').textContent=sameSaved?'이 지점으로 저장했어요':'② 지금 두 번째 가사 시작 · 저장';
 $('guided-status').textContent=sameSaved?`${t.boundaryCaptureTime.toFixed(2)}초로 두 시간을 함께 맞추고 저장했어요. 별도로 저장할 필요가 없어요.`:state.preview?'아래 첫 가사부터 듣기를 누르면 짧게 반복하지 않고 계속 재생합니다.':hasNext&&position>=t.cues[1].end?'두 번째 가사의 표시 끝을 지났어요. 다시 듣고 시작되는 순간 눌러주세요.':valid?'이 가사가 나오기 시작하면 노란 버튼을 누르세요. 잠시 멈춘 위치도 지정할 수 있어요.':'먼저 첫 가사부터 듣기를 눌러주세요. 숫자를 입력할 필요가 없어요.';
}
function saveReviewedTimes(t){
 correctOpening(t.cues,{start:t.draft,end:t.draftEnd,secondStart:t.draftSecond},t.duration);
 t.applied=t.draft;t.appliedEnd=t.draftEnd;t.appliedSecond=t.draftSecond;t.reviewed=true;t.status='done';t.appliedStatus='done';t.reviewIssue=null;
 renderList();renderEditor();
}
function getGap(){const n=Number($('gap').value);return Number.isFinite(n)&&n>=0&&n<=60?n:0;}
function waveEnd(t){return $('wave-range').value==='all'?t.duration:Math.min(t.duration,Number($('wave-range').value));}
function draw(){
 updateWaveCursor();
 const canvas=$('waveform'),rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=200*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const width=rect.width,height=200,t=current();ctx.clearRect(0,0,width,height);ctx.strokeStyle='#2b3139';ctx.lineWidth=1;
 for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(width*i/6,0);ctx.lineTo(width*i/6,height);ctx.stroke();}ctx.beginPath();ctx.moveTo(0,100);ctx.lineTo(width,100);ctx.stroke();if(!t)return;
 const end=waveEnd(t);$('wave-axis').lastElementChild.textContent=secs(end);
 for(let x=0;x<width;x+=3){const index=Math.min(t.peaks.length-1,Math.floor(x/width*end/t.duration*t.peaks.length)),p=t.peaks[index]||0;ctx.fillStyle=x/width*end<t.draft?'#59626f':'#b3becb';ctx.fillRect(x,100-Math.max(1,p*80),1.6,Math.max(2,p*160));}
 const line=(time,color,label,y)=>{if(time>end)return;const x=Math.max(1,time/end*width);ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke();ctx.fillStyle=color;ctx.font='12px system-ui';ctx.fillText(label,Math.min(x+5,width-100),y);};
 line(t.cues[0].start,'#a3acb9','원본',18);if(t.candidate!==null)line(t.candidate,'#7eb4ff','감지 '+t.candidate.toFixed(2)+'초',38);line(t.draft,'#fcd535','표시 '+t.draft.toFixed(2)+'초',58);
 if(t.frames?.length){ctx.strokeStyle='#7eb4ff';ctx.beginPath();t.frames.forEach((f,i)=>{const x=f.time/end*width,y=195-f.score*35;if(x>width)return;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
 if(audio.currentTime<=end){const x=audio.currentTime/end*width;ctx.fillStyle='#edf8ee';ctx.fillRect(x,100,1,100);}
}
function draftChanged(t){t.reviewIssue=null;t.status=t.draft===t.applied&&t.draftEnd===t.appliedEnd&&t.draftSecond===t.appliedSecond?(t.reviewed?(t.appliedStatus||'done'):(t.candidate==null?'pending':'review')):'dirty';state.preview=false;renderList();renderEditor();}
function setDraft(value){const t=current();if(!t||state.busy)return;if(!Number.isFinite(value))return;t.draft=Math.round(Math.max(0,Math.min((t.cues[1]?.end??t.duration)-.002,value))*1000)/1000;draftChanged(t);}
$('opening-end').onchange=()=>{const t=current();if(!t||state.busy)return;t.draftEnd=Number($('opening-end').value);draftChanged(t);};
$('second-start').onchange=()=>{const t=current();if(!t||state.busy)return;t.draftSecond=Number($('second-start').value);draftChanged(t);};
$('start').onchange=()=>setDraft(Number($('start').value));$('start-slider').oninput=()=>setDraft(Number($('start-slider').value));$('minus').onclick=()=>setDraft(current().draft-.1);$('plus').onclick=()=>setDraft(current().draft+.1);
let dragging=false,wavePointer=null;
function updateWaveCursor(){const canvas=$('waveform'),t=current();if(!t||state.busy){dragging=false;canvas.style.cursor='default';return;}const rect=canvas.getBoundingClientRect(),end=waveEnd(t);const near=wavePointer!==null&&rect.width>0&&end>0&&t.draft<=end&&Math.abs(wavePointer-rect.left-Math.max(1,t.draft/end*rect.width))<=8;canvas.style.cursor=dragging||near?'ew-resize':'crosshair';}
$('waveform').onpointerdown=e=>{if(e.button!==0||!current()||state.busy)return;wavePointer=e.clientX;dragging=true;e.target.setPointerCapture(e.pointerId);movePointer(e);updateWaveCursor();};
$('waveform').onpointermove=e=>{wavePointer=e.clientX;if(dragging)movePointer(e);updateWaveCursor();};
$('waveform').onpointerup=e=>{dragging=false;wavePointer=e.clientX;updateWaveCursor();};
$('waveform').onpointercancel=()=>{dragging=false;wavePointer=null;updateWaveCursor();};
$('waveform').onlostpointercapture=()=>{dragging=false;updateWaveCursor();};
$('waveform').onpointerleave=()=>{if(!dragging){wavePointer=null;updateWaveCursor();}};
function movePointer(e){const rect=$('waveform').getBoundingClientRect();setDraft((e.clientX-rect.left)/rect.width*waveEnd(current()));}
$('wave-range').onchange=draw;new ResizeObserver(draw).observe($('waveform'));
$('apply').onclick=()=>{try{const t=current();const issue=explainOpening(t.cues,{start:t.draft,end:t.draftEnd,secondStart:t.draftSecond},t.duration);if(issue){notify(issue.title,true);return;}saveReviewedTimes(t);notify(`${t.file.name}: 확인한 가사 자막 표시 시간을 저장했습니다. 세 번째 이후 자막 시간은 그대로입니다.`);}catch(e){notify('가사 자막 표시 시간을 확인해주세요. '+e.message,true);}};
$('listen-next').onclick=async()=>{const t=current();if(!t?.cues[1]||state.busy)return;try{state.preview=false;audio.currentTime=Math.max(0,t.draft-.6);await audio.play();updateGuidedControls();}catch(e){notify('재생을 시작하지 못했습니다. 음악을 다시 선택한 뒤 재생해주세요. '+e.message,true);}};
$('mark-next').onclick=()=>{const t=current();if(!t||state.busy)return;try{const captured=captureNextLyric(t.cues,t.draft,audio.currentTime,t.duration);t.draftEnd=captured.boundary;t.draftSecond=captured.boundary;t.boundaryCaptureTime=captured.boundary;state.preview=false;audio.pause();saveReviewedTimes(t);notify(`두 번째 가사 시작을 ${captured.boundary.toFixed(2)}초로 지정했어요. 첫 가사 표시 끝도 함께 맞추고 검수 완료로 저장했습니다.`);}catch(e){notify(e.message,true);}};
$('filter-review').onchange=renderList;$('gap').onchange=()=>{const n=Number($('gap').value);if(!Number.isFinite(n)||n<0||n>60){$('gap').value=0;notify('곡 간격은 0~60초로 입력하세요.',true);}renderList();};
$('next-review').onclick=()=>{const i=state.tracks.findIndex(t=>t.id===state.selected);const rotated=[...state.tracks.slice(i+1),...state.tracks.slice(0,i+1)];const t=rotated.find(t=>!isComplete(t.status));if(t)select(t.id);else notify('모든 곡이 완료됐습니다. 바로 내보낼 수 있습니다.');};
$('preview').onclick=async()=>{try{const t=current();audio.currentTime=Math.max(0,t.draft-2);state.preview=true;await audio.play();}catch(e){notify('재생할 수 없습니다: '+e.message,true);}};
audio.ontimeupdate=()=>{$('play-time').textContent=srtTime(audio.currentTime||0).replace(',','.');const t=current();if(state.preview&&t&&audio.currentTime>=Math.min(t.duration,t.draft+3)){if($('loop').checked){audio.currentTime=Math.max(0,t.draft-2);audio.play().catch(()=>{});}else{audio.pause();state.preview=false;}}updateGuidedControls();draw();};
audio.onplay=updateGuidedControls;audio.onpause=updateGuidedControls;audio.onseeked=updateGuidedControls;
audio.onended=()=>{if(state.preview&&$('loop').checked&&current()){audio.currentTime=Math.max(0,current().draft-2);audio.play().catch(()=>{});}updateGuidedControls();};
function decodeText(bytes){let text=new TextDecoder('utf-8',{fatal:false}).decode(bytes);if(text.includes('\uFFFD')){try{text=new TextDecoder('euc-kr',{fatal:true}).decode(bytes);}catch{throw Error('SRT 인코딩을 읽을 수 없습니다. UTF-8로 저장하세요.');}}return text;}
async function addTrack(file,srtFile,saved){
 if(state.tracks.some(t=>t.file.name===file.name&&t.file.size===file.size))throw Error(`${file.name}: 이미 추가된 파일입니다.`);
 if(file.size>1024*1024*1024)throw Error(`${file.name}: 곡 하나는 1GB 이하로 나눠주세요.`);
 const raw=saved?saved.srt:decodeText(await srtFile.arrayBuffer()),cues=parseSrt(raw);notify(`${file.name} 파형 준비 중…`);
 let buffer=await decode(file);if(cues.some(c=>c.end>buffer.duration+.002))throw Error(`${file.name}: 자막 종료가 음악 길이를 벗어납니다.`);
 const start=saved?saved.start:cues[0].start,end=saved?.end??cues[0].end,second=saved?.secondStart??cues[1]?.start??null;correctOpening(cues,{start,end,secondStart:second},buffer.duration);
 const track={id:crypto.randomUUID(),file,srtName:srtFile?.name||saved.srtName||safeName(file.name)+'.srt',raw,cues,duration:buffer.duration,peaks:waveform(buffer),draft:start,applied:start,draftEnd:end,appliedEnd:end,draftSecond:second,appliedSecond:second,status:'pending',reviewed:false,reviewIssue:null,appliedStatus:null,candidate:null,frames:[],restoreOrder:saved?.restoreOrder??Number.MAX_SAFE_INTEGER,note:saved?'저장한 가사 표시 시간을 복원했습니다. 전체 분석 또는 직접 확인으로 마무리해주세요.':'분석 대기 중입니다. 전체 분석을 누르면 정상 곡은 자동으로 수정됩니다.'};buffer=null;state.tracks.push(track);if(saved)state.tracks.sort((a,b)=>a.restoreOrder-b.restoreOrder);if(!state.selected)select(track.id);return track;
}
async function importFiles(files){if(state.busy)return;files=Array.from(files);setBusy(true);const errors=[];let count=0;
 try{
  const remaining=[];
  for(const file of files){const saved=state.project.find(t=>t.name===file.name&&t.size===file.size);if(saved){try{await addTrack(file,null,saved);state.project=state.project.filter(t=>t!==saved);count++;}catch(e){errors.push(e.message);}}else remaining.push(file);}
  const result=pairFiles(remaining);
  for(const pair of result.pairs){try{await addTrack(pair.audio,pair.srt);count++;}catch(e){errors.push(e.message);}}
  const groups=[...result.ambiguous,...result.orphans];for(const g of groups){state.unpaired.push(...g.audio);state.subtitles.push(...g.srt);}
  if(result.unsupported.length)errors.push(`지원하지 않는 파일 ${result.unsupported.length}개`);
  renderPairing();notify(`${count}곡 추가. ${errors.join(' / ')||'원본 파일은 변경하지 않았습니다.'}${state.project.length?` · 작업 복원: 음악 ${state.project.length}개 재연결 대기`:''}`,!!errors.length);
 }catch(e){notify(e.message,true);}finally{setBusy(false);}
}
function renderPairing(){state.unpaired=[...new Map(state.unpaired.map(f=>[f.name+':'+f.size,f])).values()];state.subtitles=[...new Map(state.subtitles.map(f=>[f.name+':'+f.size,f])).values()];$('pairing').hidden=!(state.unpaired.length||state.subtitles.length);const rows=$('pair-rows');rows.replaceChildren();
 if(!state.unpaired.length){const p=document.createElement('p');p.textContent='연결되지 않은 SRT가 있습니다. 대응하는 음악을 추가로 선택하세요.';rows.append(p);}
 state.unpaired.forEach((file,index)=>{const row=document.createElement('div');row.className='pair-row';const label=document.createElement('span');label.textContent=file.name;const sel=document.createElement('select');sel.dataset.index=index;sel.setAttribute('aria-label',file.name+' 자막 연결');sel.add(new Option('자막 선택 (추가하지 않음)',''));state.subtitles.forEach((srt,i)=>sel.add(new Option(srt.name,String(i))));row.append(label,sel);rows.append(row);});
}
$('add-pairs').onclick=async()=>{if(state.busy)return;const selections=Array.from($('pair-rows').querySelectorAll('select')).filter(s=>s.value!=='');if(!selections.length){notify('연결할 자막을 먼저 선택하세요.',true);return;}setBusy(true);const usedAudio=[],usedSrt=[],errors=[];for(const s of selections){try{await addTrack(state.unpaired[+s.dataset.index],state.subtitles[+s.value]);usedAudio.push(+s.dataset.index);usedSrt.push(+s.value);}catch(e){errors.push(e.message);}}state.unpaired=state.unpaired.filter((_,i)=>!usedAudio.includes(i));state.subtitles=state.subtitles.filter((_,i)=>!usedSrt.includes(i));renderPairing();setBusy(false);notify(errors.join(' / ')||'파일 연결을 추가했습니다.',!!errors.length);};
$('files').onchange=e=>{importFiles(e.target.files);e.target.value='';};
$('import-files').onclick=()=>$('files').click();$('empty-import').onclick=()=>$('files').click();
for(const name of ['dragenter','dragover'])$('drop-zone').addEventListener(name,e=>{e.preventDefault();$('drop-zone').classList.add('dragging');});$('drop-zone').ondragleave=()=>$('drop-zone').classList.remove('dragging');$('drop-zone').ondrop=e=>{e.preventDefault();$('drop-zone').classList.remove('dragging');importFiles(e.dataTransfer.files);};
async function analyzeTrack(t){
 const begin=performance.now(),method=$('analysis-method').value,manualChanges=t.status==='dirty';let buffer=await decode(t.file);const range=$('analysis-range').value;let limit=range==='all'?buffer.duration:Math.min(buffer.duration,Number(range));
 const stereo=(b,seconds)=>{const length=Math.min(b.length,Math.round(seconds*44100));return {left:b.getChannelData(0).slice(0,length),right:b.getChannelData(Math.min(1,b.numberOfChannels-1)).slice(0,length)};};
 let input=method==='fast'?await mono16(buffer,limit):stereo(buffer,limit);buffer=null;
 let response=await classify(input,method);
 if(response.result.start===null&&range==='30'&&t.duration>30){notify('앞 30초에 보컬 후보가 없어 60초로 확장합니다.');buffer=await decode(t.file);limit=Math.min(t.duration,60);input=method==='fast'?await mono16(buffer,limit):stereo(buffer,limit);buffer=null;response=await classify(input,method);}
 const result=response.result;t.frames=method==='fast'?response.frames:response.frames.map(f=>({...f,score:Math.min(1,f.rms/Math.max(result.peak||0,.0001))}));
 t.elapsedMs=performance.now()-begin;t.method=method;
 const assessment=assessAnalysis({cues:t.cues,draft:{end:t.draftEnd,secondStart:t.draftSecond},duration:t.duration,result,method,manualChanges});
 t.candidate=Number.isFinite(result.start)?result.start:null;t.reviewed=false;t.status=assessment.status;t.reviewIssue=assessment.issue;
 if(!manualChanges)t.draft=t.candidate??t.applied;
 if(assessment.status==='auto'){t.applied=t.draft;t.appliedEnd=t.draftEnd;t.appliedSecond=t.draftSecond;t.appliedStatus='auto';t.reviewed=true;}
 const label=method==='fast'?'빠른 보컬 감지':'정밀 보컬 분리';t.note=`${label} · 처리 ${(t.elapsedMs/1000).toFixed(2)}초 · ${t.status==='auto'?'표시 시작 자동 수정 완료':'검수 필요'}`;
 renderList();renderEditor();
}
function classify(samples,method){return new Promise((resolve,reject)=>{if(state.abort.signal.aborted){reject(new DOMException('취소되었습니다.','AbortError'));return;}const worker=method==='fast'?new Worker(new URL('./2026-10-29-singing-worker.js',import.meta.url),{type:'module'}):new Worker(new URL('./2026-10-29-separation-worker.js',import.meta.url),{type:'module'});state.worker=worker;let finished=false;const signal=state.abort.signal;const end=()=>{finished=true;worker.terminate();state.worker=null;clearTimeout(timer);signal.removeEventListener('abort',abort);};const abort=()=>{if(!finished){end();reject(new DOMException('취소되었습니다.','AbortError'));}};const timer=setTimeout(()=>{end();reject(Error('분석 시간 한도를 초과했습니다. 범위를 줄이거나 직접 검수하세요.'));},method==='fast'?60000:300000);signal.addEventListener('abort',abort,{once:true});worker.onerror=e=>{end();reject(Error(e.message||'브라우저에서 모델을 실행하지 못했습니다.'));};worker.onmessage=({data})=>{if(data.type==='progress')notify(data.message);else if(data.type==='error'){end();reject(Error(data.message));}else if(data.type==='result'){end();resolve(data);}};if(method==='fast')worker.postMessage({samples:samples.buffer},[samples.buffer]);else worker.postMessage({left:samples.left.buffer,right:samples.right.buffer},[samples.left.buffer,samples.right.buffer]);});}
async function analyze(tracks){if(state.busy)return;if(!tracks.length){notify('모든 곡이 완료됐습니다. 추가 확인 없이 내보낼 수 있습니다.');return;}audio.pause();state.preview=false;state.abort=new AbortController();setBusy(true);const errors=[];let processed=0;try{for(const t of tracks){if(state.abort.signal.aborted)break;try{notify(`${t.file.name} 분석 준비…`);await analyzeTrack(t);processed++;}catch(e){if(e.name==='AbortError')break;t.status='review';t.reviewed=false;t.candidate=null;t.frames=[];t.reviewIssue={code:'model-error',title:'분석을 완료하지 못했어요.',message:'다시 분석하거나, 직접 듣고 표시 시간을 확인해주세요.'};t.note='분석 실패: '+e.message;errors.push(t.file.name+': '+e.message);}}const automatic=state.tracks.filter(t=>t.status==='auto').length,remaining=state.tracks.filter(t=>!isComplete(t.status)).length;notify(state.abort.signal.aborted?'분석을 취소했습니다.':`${processed}곡 분석 완료 · 자동 완료 ${automatic}곡 · 확인할 곡 ${remaining}곡${errors.length?' / '+errors.join(' / '):''}`,!!errors.length);const review=tracks.find(t=>!isComplete(t.status));if(review&&!state.abort.signal.aborted)select(review.id);}finally{setBusy(false);state.abort=null;}}
$('analyze-one').onclick=()=>analyze([current()]);$('analyze-all').onclick=()=>analyze(state.tracks.filter(t=>!isComplete(t.status)));
$('cancel').onclick=()=>{state.abort?.abort();notify('현재 작업을 취소하는 중…');};
function reviewedTracks(){if(!state.tracks.length)throw Error('음악과 자막을 먼저 불러오세요.');const pending=state.tracks.filter(t=>!isComplete(t.status));if(pending.length)throw Error(`확인할 곡이 ${pending.length}곡 남아 있어요. 전체 분석을 실행하거나 해당 곡의 노란 안내를 확인해주세요. 자동 완료 곡은 다시 확인하지 않아도 됩니다.`);if(state.project.length)throw Error(`복원할 음악 ${state.project.length}개가 아직 연결되지 않았습니다.`);return state.tracks.map(t=>({...t,cues:correctOpening(t.cues,{start:t.applied,end:t.appliedEnd,secondStart:t.appliedSecond},t.duration)}));}
function entryName(t,i,ext){return `${String(i+1).padStart(2,'0')}-${safeName(t.file.name)}${ext}`;}
async function combinedZip(tracks,gap,srt,sink,signal){let writes=Promise.resolve(),zipError;const zip=new Zip((err,data)=>{if(err){zipError=err;return;}writes=writes.then(()=>sink.write(data));writes.catch(()=>{});});const captions=new ZipPassThrough(`${dated}-playlist.srt`);zip.add(captions);captions.push(strToU8(srt),true);await writes;const music=new ZipPassThrough(`${dated}-playlist.wav`);zip.add(music);await exportWav(tracks,gap,{async write(data){if(zipError)throw zipError;music.push(data,false);await writes;}},notify,signal);music.push(new Uint8Array(),true);zip.end();await writes;if(zipError)throw zipError;}
$('export').onclick=async()=>{let sink;try{const tracks=reviewedTracks(),gap=getGap(),mode=$('export-mode').value,srt=formatSrt(mergeTimeline(tracks,gap));if(mode==='srt'){download(new Blob([srt],{type:'application/x-subrip;charset=utf-8'}),`${dated}-playlist.srt`);notify('통합 SRT를 저장했습니다.');return;}const total=tracks.reduce((n,t)=>n+outputFrames(t.duration),0)+outputFrames(gap)*Math.max(0,tracks.length-1);if(['combined','wav'].includes(mode))wavHeader(total);const estimate=mode==='individual'?tracks.reduce((n,t)=>n+t.file.size,0):mode==='subtitles'?tracks.reduce((n,t)=>n+t.raw.length*3,0):total*4+44;state.abort=new AbortController();setBusy(true);sink=await openSink(`${dated}-${mode==='wav'?'playlist.wav':mode==='combined'?'playlist.zip':mode==='individual'?'tracks.zip':'subtitles.zip'}`,estimate);audio.pause();state.preview=false;
 if(mode==='wav')await exportWav(tracks,gap,sink,notify,state.abort.signal);
 else if(mode==='combined')await combinedZip(tracks,gap,srt,sink,state.abort.signal);
 else{const entries=[];tracks.forEach((t,i)=>{if(mode==='individual')entries.push({name:entryName(t,i,'.'+t.file.name.split('.').pop().toLowerCase()),data:t.file});entries.push({name:entryName(t,i,'.srt'),data:formatSrt(t.cues)});});await exportZip(entries,sink,state.abort.signal);}
 if(state.abort.signal.aborted)throw new DOMException('취소되었습니다.','AbortError');await sink.close();sink=null;notify('내보내기를 완료했습니다. 음악과 자막은 브라우저에서만 처리했습니다.');
 }catch(e){if(sink)try{await sink.abort();}catch{}notify(e.name==='AbortError'?'내보내기를 취소했습니다.':e.message,e.name!=='AbortError');}finally{state.abort=null;setBusy(false);}};
$('save-project').onclick=()=>{if(!state.tracks.length&&!state.project.length){notify('저장할 작업이 없습니다.',true);return;}const data={version:2,app:'MusicStep-v1.4.2',gap:getGap(),tracks:[...state.tracks.map(t=>({name:t.file.name,size:t.file.size,srtName:t.srtName,srt:t.raw,start:t.applied,end:t.appliedEnd,secondStart:t.appliedSecond})),...state.project.map(t=>({...t,end:t.end??parseSrt(t.srt)[0].end,secondStart:t.secondStart??parseSrt(t.srt)[1]?.start??null}))]};download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`${dated}-project.json`);notify('적용한 시작·종료·둘째 시작과 자막을 로컬 JSON으로 저장했습니다. 음악 파일은 포함하지 않습니다.');};
$('load-project').onclick=()=>$('project-file').click();$('project-file').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>10*1024*1024)throw Error('프로젝트 JSON은 10MB 이하만 열 수 있습니다.');const p=validateProject(JSON.parse(await file.text()));if(state.tracks.length&&!confirm('현재 목록을 비우고 저장한 작업을 여시겠습니까? 저장하지 않은 작업은 사라집니다.'))return;state.tracks=[];state.unpaired=[];state.subtitles=[];state.project=p.tracks.map((t,restoreOrder)=>({...t,restoreOrder}));$('gap').value=p.gap;select(null);renderPairing();notify(`작업을 열었습니다. 저장한 음악 ${p.tracks.length}개를 다시 선택하세요. 파일명과 크기를 확인한 후 시작점을 복원합니다. 복원 순서는 저장된 곡 순서로 정렬됩니다.`);}catch(e){notify(e.message,true);}};
window.addEventListener('beforeunload',e=>{if(state.tracks.length||state.busy){e.preventDefault();e.returnValue='';}});
renderList();renderEditor();


