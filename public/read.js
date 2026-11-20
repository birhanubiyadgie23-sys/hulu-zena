const $=s=>document.querySelector(s);let fontSize=19;let speechText='';let speechActive=false;const speechSupported='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={ethiopia:'ኢትዮጵያ',world:'ዓለም',politics:'ፖለቲካ',business:'ንግድ',technology:'ቴክኖሎጂ',sports:'ስፖርት',economy:'ኢኮኖሚ'};
function date(v){return v?new Intl.DateTimeFormat('am-ET',{dateStyle:'long'}).format(new Date(v)):'';}
function renderRelated(items){if(!items?.length)return;$('#relatedGrid').innerHTML=items.map(a=>'<a class="related-card" href="/read.html?id='+encodeURIComponent(a.id)+'">'+'<img src="'+esc(a.image_url||'/news-placeholder.svg')+'" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'/news-placeholder.svg\'">'+'<b>'+esc(a.title)+'</b><small>'+esc(labels[a.category]||a.category)+' · '+esc(date(a.published_at))+'</small></a>').join('');$('#relatedSection').classList.remove('hidden');}
async function init(){const id=new URLSearchParams(location.search).get('id');if(!id){$('#readerStatus').textContent='ዜናው አልተገኘም።';return;}try{const r=await fetch('/api/news?id='+encodeURIComponent(id));const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.error||'Not found');const a=d.article;$('#readerStatus').classList.add('hidden');$('#article').classList.remove('hidden');$('#readerCategory').textContent=labels[a.category]||a.category;$('#readerTitle').textContent=a.title;$('#readerMeta').textContent=[a.source_name,date(a.published_at||a.fetched_at),a.language==='en'?'English':'አማርኛ'].filter(Boolean).join(' · ');$('#readerImage').src=a.image_url||'/news-placeholder.svg';$('#readerImage').onerror=()=>{$('#readerImage').onerror=null;$('#readerImage').src='/news-placeholder.svg';};$('#readerImage').classList.remove('hidden');$('#readerBody').textContent=a.summary_status==='ready'&&a.summary?a.summary:'የዜናው ማጠቃለያ ገና አልተዘጋጀም። በቂ መረጃ ሲገኝ በአማርኛ ይቀርባል።';speechText=(a.summary_status==='ready'&&a.summary)?(a.title+'. '+a.summary):'';setupSpeech();$('#sourceLink').href=a.original_url;renderRelated(d.related);}catch(e){$('#readerStatus').textContent='ይህን ዜና ማግኘት አልተቻለም። ከዋናው ድረገጽ ዜናውን ይምረጡ።';}}
function setupSpeech(){
 const buttons=['#speakPlay','#speakPause','#speakResume','#speakStop'];
 if(!speechSupported){$('#speakStatus').textContent='ይህ አሳሽ የድምፅ ንባብን አይደግፍም።';buttons.forEach(s=>$(s).disabled=true);return;}
 if(!speechText){$('#speakStatus').textContent='ለማንበብ የተዘጋጀ ማጠቃለያ የለም።';$('#speakPlay').disabled=true;return;}
 $('#speakStatus').textContent='የአማርኛ ድምፅ ካለ በአሳሽዎ ይነበባል።';
}
function setSpeechButtons(state){
 $('#speakPlay').disabled=state==='playing'||state==='paused';
 $('#speakPause').disabled=state!=='playing';
 $('#speakResume').disabled=state!=='paused';
 $('#speakStop').disabled=state==='idle';
}
$('#speakPlay').addEventListener('click',()=>{
 if(!speechSupported||!speechText)return;
 window.speechSynthesis.cancel();
 const voices=window.speechSynthesis.getVoices();
 const voice=voices.find(v=>/^am([_-]|$)/i.test(v.lang));
 if(!voice){$('#speakStatus').textContent='በዚህ መሣሪያ ላይ የአማርኛ ድምፅ አልተገኘም። የአሳሽዎን የቋንቋ/ድምፅ ቅንብር ያረጋግጡ።';return;}
 const utterance=new SpeechSynthesisUtterance(speechText);utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=0.92;
 utterance.onstart=()=>{speechActive=true;setSpeechButtons('playing');$('#speakStatus').textContent='በድምፅ እያነበበ ነው...';};
 utterance.onend=()=>{speechActive=false;setSpeechButtons('idle');$('#speakStatus').textContent='ንባቡ ተጠናቋል።';};
 utterance.onerror=()=>{speechActive=false;setSpeechButtons('idle');$('#speakStatus').textContent='የድምፅ ንባብ አልተሳካም።';};
 window.speechSynthesis.speak(utterance);
});
$('#speakPause').addEventListener('click',()=>{if(speechSupported&&window.speechSynthesis.speaking){window.speechSynthesis.pause();setSpeechButtons('paused');$('#speakStatus').textContent='ንባቡ ቆሟል።';}});
$('#speakResume').addEventListener('click',()=>{if(speechSupported&&window.speechSynthesis.paused){window.speechSynthesis.resume();setSpeechButtons('playing');$('#speakStatus').textContent='ንባቡ ቀጥሏል...';}});
$('#speakStop').addEventListener('click',()=>{if(speechSupported)window.speechSynthesis.cancel();speechActive=false;setSpeechButtons('idle');$('#speakStatus').textContent='ንባቡ ተቋርጧል።';});
window.addEventListener('beforeunload',()=>{if(speechSupported)window.speechSynthesis.cancel();});
$('#fontDown').addEventListener('click',()=>{fontSize=Math.max(16,fontSize-1);$('#readerBody').style.fontSize=fontSize+'px';});$('#fontUp').addEventListener('click',()=>{fontSize=Math.min(28,fontSize+1);$('#readerBody').style.fontSize=fontSize+'px';});$('#themeToggle').addEventListener('click',()=>{document.body.classList.toggle('reader-dark');$('#themeToggle').textContent=document.body.classList.contains('reader-dark')?'ብርሃን':'ጨለማ';});window.addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;$('#progressBar').style.width=(max>0?Math.min(100,scrollY/max*100):0)+'%';});init();