const editor=document.getElementById('editor-page'),usage=document.getElementById('usage-page');
const link=document.getElementById('usage-link'),back=document.getElementById('usage-back');
const originalTitle=document.title;
let wasUsage=false,editorScroll=0;
function route(){
 const showing=location.hash.startsWith('#usage');
 if(showing&&!wasUsage){editorScroll=scrollY;document.getElementById('audio').pause();}
 editor.hidden=showing;usage.hidden=!showing;
 for(const id of ['save-project','load-project'])document.getElementById(id).hidden=showing;
 link.setAttribute('aria-current',showing?'page':'false');
 document.title=showing?'사용법 · MusicStep':originalTitle;
 if(showing&&location.hash==='#usage'){scrollTo(0,0);document.getElementById('usage-title').focus({preventScroll:true});}
 else if(showing){document.getElementById(location.hash.slice(1))?.scrollIntoView();}
 else if(wasUsage){scrollTo(0,editorScroll);link.focus({preventScroll:true});}
 wasUsage=showing;
}
link.addEventListener('click',()=>{if(location.hash.startsWith('#usage')){scrollTo(0,0);document.getElementById('usage-title').focus({preventScroll:true});}});
back.addEventListener('click',()=>{if(location.hash!=='#usage')route();});
addEventListener('hashchange',route);
route();
