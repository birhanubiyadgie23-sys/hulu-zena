const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const state={overview:null,articles:[],view:'overview'};
const labels={ethiopia:'Ethiopia',world:'World',politics:'Politics',business:'Business',technology:'Technology',sports:'Sports',economy:'Economy'};
const defaultCategories=[{slug:'ethiopia',name_am:'ኢትዮጵያ',name_en:'Ethiopia'},{slug:'world',name_am:'ዓለም',name_en:'World'},{slug:'politics',name_am:'ፖለቲካ',name_en:'Politics'},{slug:'business',name_am:'ንግድ',name_en:'Business'},{slug:'technology',name_am:'ቴክኖሎጂ',name_en:'Technology'},{slug:'sports',name_am:'ስፖርት',name_en:'Sports'},{slug:'economy',name_am:'ኢኮኖሚ',name_en:'Economy'}];
let categories=defaultCategories,editingCategory='';
const fileData=async file=>{if(!file)return '';if(file.size>1.2*1024*1024)throw new Error('ምስሉ ከ1.2MB በታች መሆን አለበት።');return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>s?new Date(s).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'—';
let toastTimer;
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000);}
async function api(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||'Request failed');return d;}
function showLogin(message=''){ $('#loginScreen').classList.remove('hidden');$('#loginError').textContent=message; }
function showApp(email){$('#loginScreen').classList.add('hidden');if(email)$('#adminEmail').textContent=email;}
function go(view){state.view=view;$$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));$$('.nav-link[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#sidebar').classList.remove('open');if(view==='articles')renderArticles();if(view==='categories')renderCategories();if(view==='sources')renderSources();if(view==='messages')renderMessages();if(view==='analytics')renderSyncs();if(view==='settings')fillProfile();}
$$('.nav-link[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
$('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#todayText').textContent=new Date().toLocaleDateString(undefined,{weekday:'short',year:'numeric',month:'short',day:'numeric'});
function renderChart(runs=[]){const values=[...runs].reverse().map(r=>Number(r.inserted_count)||0),max=Math.max(1,...values);const count=Math.max(values.length,1),points=values.map((v,i)=>{const x=48+(632*(i/Math.max(count-1,1))),y=190-(v/max)*145;return [x,y,v]});$('#chartLine').setAttribute('points',points.length?points.map(p=>p[0]+','+p[1]).join(' '):'48,190 680,190');$('#chartDots').innerHTML=points.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="5"><title>'+p[2]+' articles</title></circle>').join('');$('#chartLabels').innerHTML=points.map((p,i)=>'<text x="'+p[0]+'" y="212" text-anchor="middle">'+(i+1)+'</text>').join('');}
function renderActivity(runs=[]){$('#recentActivity').innerHTML=runs.length?runs.slice(0,5).map(r=>'<div class="activity-item"><span class="activity-icon">↻</span><div><b>News synchronization '+esc(r.status||'completed')+'</b><small>'+Number(r.inserted_count||0)+' new articles · '+Number(r.error_count||0)+' errors</small></div><time>'+esc(date(r.started_at))+'</time></div>').join(''):'<div class="empty-row">No recent activity recorded yet.</div>';}
function renderRecentArticles(){const rows=state.articles.slice(0,5);$('#recentArticles').innerHTML=rows.length?rows.map((a,i)=>'<tr><td>'+(i+1)+'</td><td class="title-cell">'+esc(a.title)+'</td><td>'+esc(labels[a.category]||a.category)+'</td><td>'+esc(a.language==='am'?'Amharic':'English')+'</td><td><span class="pill '+(a.is_published?'published':'hidden-status')+'">'+(a.is_published?'Published':'Hidden')+'</span></td><td><div class="row-actions"><button type="button" data-edit-article="'+a.id+'">አስተካክል</button><button data-toggle-article="'+a.id+'" data-current="'+a.is_published+'">'+(a.is_published?'Hide':'Publish')+'</button></div></td></tr>').join(''):'<tr><td colspan="6" class="empty-row">No articles found.</td></tr>';}
function renderOverview(d){const s=d.stats||{},runs=d.runs||[];$('#metricTotal').textContent=s.total??0;$('#metricPublished').textContent=s.published??0;$('#metricSources').textContent=(d.sources||[]).filter(x=>x.is_active).length;$('#metricAdded').textContent=runs.length?(runs[0].inserted_count??0):'—';renderChart(runs);renderActivity(runs);renderRecentArticles();$('#messageCount').textContent=(d.messages||[]).length;}
function renderArticles(){const term=($('#articleSearch').value||'').toLowerCase(),status=$('#articleStatus').value,cat=$('#articleCategory').value;const rows=state.articles.filter(a=>(a.title||'').toLowerCase().includes(term)&&(status==='all'||(status==='published')===Boolean(a.is_published))&&(cat==='all'||a.category===cat));$('#articleTable').innerHTML=rows.length?rows.map(a=>'<tr><td class="title-cell">'+esc(a.title)+'</td><td>'+esc(labels[a.category]||a.category)+'</td><td>'+esc(a.language==='am'?'Amharic':'English')+'</td><td><span class="pill '+(a.is_published?'published':'hidden-status')+'">'+(a.is_published?'Published':'Hidden')+'</span></td><td><div class="row-actions"><button type="button" data-edit-article="'+a.id+'">አስተካክል</button><button data-toggle-article="'+a.id+'" data-current="'+a.is_published+'">'+(a.is_published?'Hide':'Publish')+'</button><a class="soft-btn" href="'+esc(a.original_url||'#')+'" target="_blank" rel="noopener">Open ↗</a></div></td></tr>').join(''):'<tr><td colspan="5" class="empty-row">No matching articles.</td></tr>';}
function renderCategories(){const counts={};state.articles.forEach(a=>counts[a.category]=(counts[a.category]||0)+1);$('#categoryGrid').innerHTML=categories.map(cat=>'<article class="category-card"><b>'+esc(cat.name_am)+' · '+esc(cat.name_en)+'</b><strong>'+(counts[cat.slug]||0)+'</strong><small>'+esc(cat.slug)+'</small><div class="row-actions"><button type="button" data-edit-category="'+esc(cat.slug)+'">አስተካክል</button><button type="button" class="delete" data-delete-category="'+esc(cat.slug)+'">ሰርዝ</button></div></article>').join('');}
function renderSources(){const list=state.overview?.sources||[];$('#sourceList').innerHTML=list.length?list.map(s=>'<div class="source-row"><div><b>'+esc(s.name)+'</b><small>'+esc(labels[s.category]||s.category)+' · '+(s.language==='am'?'Amharic':'English')+' · '+(s.is_active?'Active':'Paused')+'<br>Last sync: '+esc(date(s.last_fetched_at))+(s.last_error?' · Error: '+esc(s.last_error):'')+'</small></div><div class="source-actions"><button data-toggle-source="'+s.id+'" data-current="'+s.is_active+'">'+(s.is_active?'Pause':'Activate')+'</button><button class="delete" data-delete-source="'+s.id+'">Delete</button></div></div>').join(''):'<div class="empty-row">No news sources configured.</div>';}
function renderMessages(){const list=state.overview?.messages||[];$('#messageList').innerHTML=list.length?list.map(m=>'<article class="message-card"><b>'+esc(m.name)+'</b><small>'+esc(m.email)+' · '+esc(date(m.created_at))+'</small><p>'+esc(m.message)+'</p></article>').join(''):'<article class="panel empty-row">No contact messages yet.</article>';}
function renderSyncs(){const runs=state.overview?.runs||[],added=runs.reduce((n,r)=>n+Number(r.inserted_count||0),0),errors=runs.reduce((n,r)=>n+Number(r.error_count||0),0);$('#syncCount').textContent=runs.length;$('#syncTotalAdded').textContent=added;$('#syncErrors').textContent=errors;$('#lastRunStatus').textContent=runs[0]?.status||'—';$('#lastRunTime').textContent=runs[0]?date(runs[0].started_at):'No sync history';$('#syncHistory').innerHTML=runs.length?runs.map(r=>'<div class="sync-row"><div><b>Sync #'+r.id+'</b><small>'+esc(date(r.started_at))+' · '+Number(r.inserted_count||0)+' added · '+Number(r.error_count||0)+' errors</small></div><span class="sync-status '+esc(r.status)+'">'+esc(r.status)+'</span></div>').join(''):'<div class="empty-row">No synchronization history yet.</div>';}
function fillProfile(){const p=state.overview?.profile||{},f=$('#profileForm');for(const [k,v] of Object.entries(p)){if(f.elements[k])f.elements[k].value=v||'';}$('#logoPreview').src=p.logo_url||'';$('#heroPreview').src=p.hero_bg_url||'';}
function renderFilters(){const options=categories.map(c=>'<option value="'+esc(c.slug)+'">'+esc(c.name_en)+'</option>').join('');$('#articleCategory').innerHTML='<option value="all">All categories</option>'+options;const editorCategory=$('#articleEditor')?.elements.category;if(editorCategory){const selected=editorCategory.value;editorCategory.innerHTML=options;editorCategory.value=categories.some(c=>c.slug===selected)?selected:(categories[0]?.slug||'ethiopia');}const sourceCategory=$('#sourceForm')?.elements.category;if(sourceCategory){const selected=sourceCategory.value;sourceCategory.innerHTML=options;sourceCategory.value=categories.some(c=>c.slug===selected)?selected:(categories[0]?.slug||'ethiopia');}}
async function loadData(){try{const [d,a]=await Promise.all([api('/api/admin'),api('/api/admin-articles')]);state.overview=d;state.articles=a.articles||[];try{categories=JSON.parse(d.profile?.categories||'[]');if(!Array.isArray(categories)||!categories.length)categories=defaultCategories;}catch{categories=defaultCategories;}showApp(d.email);renderOverview(d);renderFilters();if(state.view!=='overview')go(state.view);}catch(e){showLogin(e.message==='Authentication required'?'Please sign in to continue.':'');}}
async function sync(){const b=$('#syncNow');b.disabled=true;try{const r=await api('/api/sync',{method:'POST',body:'{}'});toast('Sync complete: '+Number(r.inserted||0)+' added, '+Number(r.errors||0)+' errors.');await loadData();}catch(e){toast(e.message);}finally{b.disabled=false;}}
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;$('#loginError').textContent='';try{const d=await api('/api/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(f)))});f.reset();showApp(d.email);await loadData();}catch(err){$('#loginError').textContent=err.message;}finally{b.disabled=false;}});
$('#logout').addEventListener('click',async()=>{try{await api('/api/admin?logout=1',{method:'POST',body:'{}'});}catch{}state.overview=null;state.articles=[];showLogin('You have signed out.');});
$('#syncNow').addEventListener('click',sync);$('#quickSync').addEventListener('click',sync);

const articleEditor=$('#articleEditor');
async function openArticleEditor(article=null){
 articleEditor.classList.add('open');
 articleEditor.reset();
 $('#articleEditorMessage').textContent=article?.id?'የዜናው ሙሉ መረጃ በመጫን ላይ...':'አዲስ ዜና ይጻፉ።';
 articleEditor.scrollIntoView({behavior:'smooth',block:'start'});
 try{
  if(article?.id){const detail=await api('/api/admin-articles?id='+encodeURIComponent(article.id));article=detail.article;}
  articleEditor.elements.id.value=article?.id||'';
  articleEditor.elements.title.value=article?.title||'';
  articleEditor.elements.content.value=article?.summary||article?.source_content||'';
  articleEditor.elements.category.value=article?.category||'ethiopia';
  articleEditor.elements.language.value=article?.language||'am';
  articleEditor.elements.image_url.value=article?.image_url||'';
  articleEditor.elements.is_published.checked=article?Boolean(article.is_published):true;
  $('#articleEditorMessage').textContent=article?'ዜናውን አስተካክለው ያስቀምጡ።':'አዲስ ዜና ይጻፉ።';
 }catch(error){articleEditor.classList.remove('open');toast('ዜናውን መክፈት አልተቻለም፦ '+error.message);}
}
$('#newArticle').addEventListener('click',()=>openArticleEditor());
$('#cancelArticleEdit').addEventListener('click',()=>{articleEditor.classList.remove('open');articleEditor.reset();});
articleEditor.addEventListener('submit',async e=>{
 e.preventDefault();
 const b=articleEditor.querySelector('button[type=submit]');b.disabled=true;
 const fd=new FormData(articleEditor),id=fd.get('id');
 const payload={title:fd.get('title'),content:fd.get('content'),category:fd.get('category'),language:fd.get('language'),image_url:fd.get('image_url'),is_published:fd.get('is_published')==='on'};
 try{
  await api(id?'/api/admin-articles?id='+encodeURIComponent(id):'/api/admin-articles',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});
  toast(id?'ዜናው ተስተካክሏል።':'አዲስ ዜና ታትሟል።');
  articleEditor.classList.remove('open');articleEditor.reset();await loadData();
 }catch(err){$('#articleEditorMessage').textContent=err.message;toast(err.message);}
 finally{b.disabled=false;}
});


$('#articleSearch').addEventListener('input',renderArticles);$('#articleStatus').addEventListener('change',renderArticles);$('#articleCategory').addEventListener('change',renderArticles);
$('#refreshArticles').addEventListener('click',loadData);$('#refreshMessages').addEventListener('click',loadData);
$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){go('articles');$('#articleSearch').value=e.currentTarget.value;renderArticles();}});
document.addEventListener('click',async e=>{const editArticle=e.target.closest('[data-edit-article]'),article=e.target.closest('[data-toggle-article]'),source=e.target.closest('[data-toggle-source]'),del=e.target.closest('[data-delete-source]');try{if(editArticle){const found=state.articles.find(a=>String(a.id)===editArticle.dataset.editArticle);if(found)await openArticleEditor(found);}if(article){await api('/api/admin-articles?id='+encodeURIComponent(article.dataset.toggleArticle),{method:'PATCH',body:JSON.stringify({is_published:article.dataset.current!=='true'})});toast('Article status updated.');await loadData();}if(source){await api('/api/admin?id='+encodeURIComponent(source.dataset.toggleSource),{method:'PATCH',body:JSON.stringify({is_active:source.dataset.current!=='true'})});toast('News source updated.');await loadData();}if(del&&confirm('Delete this news source?')){await api('/api/admin?id='+encodeURIComponent(del.dataset.deleteSource),{method:'DELETE',body:'{}'});toast('News source deleted.');await loadData();}}catch(err){toast(err.message);}});
$('#sourceForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button[type=submit]');b.disabled=true;$('#sourceMessage').textContent='';try{await api('/api/admin',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});e.currentTarget.reset();$('#sourceMessage').textContent='News source added successfully.';await loadData();go('sources');}catch(err){$('#sourceMessage').textContent=err.message;}finally{b.disabled=false;}});
$('#openSourceForm').addEventListener('click',()=>$('#sourceFormPanel').scrollIntoView({behavior:'smooth'}));
$('#passwordForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const form=e.currentTarget,button=form.querySelector('button[type=submit]');
 const message=$('#passwordMessage');button.disabled=true;message.textContent='';
 const values=Object.fromEntries(new FormData(form));
 try{
  await api('/api/admin?password=1',{method:'POST',body:JSON.stringify(values)});
  form.reset();message.textContent='ፓስወርዱ በተሳካ ሁኔታ ተቀይሯል።';toast('የአድሚን ፓስወርድ ተቀይሯል።');
 }catch(error){message.textContent=error.message;toast(error.message);}
 finally{button.disabled=false;}
});
$('#categoryForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button[type=submit]');b.disabled=true;try{const data=Object.fromEntries(new FormData(f));await api('/api/admin?categories=1',{method:'POST',body:JSON.stringify({action:'save',...data})});f.reset();editingCategory='';toast('ምድቡ ተቀምጧል።');await loadData();go('categories');}catch(err){$('#categoryMessage').textContent=err.message;}finally{b.disabled=false;}});
$('#resetCategory').addEventListener('click',()=>{ $('#categoryForm').reset();$('#categoryForm').elements.slug.readOnly=false;editingCategory=''; });
document.addEventListener('click',async e=>{const edit=e.target.closest('[data-edit-category]'),del=e.target.closest('[data-delete-category]');if(edit){const c=categories.find(x=>x.slug===edit.dataset.editCategory);if(c){editingCategory=c.slug;const f=$('#categoryForm');f.elements.slug.value=c.slug;f.elements.slug.readOnly=true;f.elements.name_am.value=c.name_am;f.elements.name_en.value=c.name_en;f.scrollIntoView({behavior:'smooth'});}}if(del&&confirm('ይህን ምድብ ማስወገድ ይፈልጋሉ?')){try{await api('/api/admin?categories=1',{method:'POST',body:JSON.stringify({action:'delete',slug:del.dataset.deleteCategory})});await loadData();go('categories');}catch(err){toast(err.message);}}});
async function uploadSettingsImage(input,name){const file=input.files?.[0];if(!file)return '';return await fileData(file);}
$('#logoUpload').addEventListener('change',async e=>{try{const data=await fileData(e.target.files[0]);$('#logoPreview').src=data;}catch(err){toast(err.message);e.target.value='';}});
$('#heroUpload').addEventListener('change',async e=>{try{const data=await fileData(e.target.files[0]);$('#heroPreview').src=data;}catch(err){toast(err.message);e.target.value='';}});
$('#profileForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button[type=submit]');b.disabled=true;$('#profileMessage').textContent='Saving…';try{const values=Object.fromEntries(new FormData(e.currentTarget));values.logo_url=await uploadSettingsImage($('#logoUpload'),'logo_url')||state.overview?.profile?.logo_url||'';values.hero_bg_url=await uploadSettingsImage($('#heroUpload'),'hero_bg_url')||state.overview?.profile?.hero_bg_url||'';await api('/api/admin?profile=1',{method:'POST',body:JSON.stringify(values)});$('#profileMessage').textContent='Website settings saved.';toast('Settings saved.');await loadData();}catch(err){$('#profileMessage').textContent=err.message;}finally{b.disabled=false;}});
loadData();
