const $ = (s) => document.querySelector(s);
const grid = $('#newsGrid'); let category = 'all'; let language = 'am'; let currentArticles = [];
const labels = {ethiopia:['ኢትዮጵያ','Ethiopia'],world:['ዓለም','World'],politics:['ፖለቲካ','Politics'],business:['ንግድ','Business'],technology:['ቴክኖሎጂ','Technology'],sports:['ስፖርት','Sports'],economy:['ኢኮኖሚ','Economy']};
const ui = {am:{all:'ሁሉም',latest:'የቅርብ ጊዜ ዜናዎች',admin:'አድሚን',tagline:'ዓለምን በዜና ይወቁ!',hero:'ዜናውን ይከታተሉ።',hero2:'ዓለምን ይወቁ።',intro:'ከኢትዮጵያና ከዓለም የተመረጡ ዜናዎች፣ በአንድ ቦታ።',updates:'የቅርብ ጊዜ ዜናዎች',refresh:'↻ አድስ',read:'ሙሉ ዜናውን ያንብቡ ↗',search:'ዜና ፈልግ...',empty:'የፍለጋዎ ውጤት አልተገኘም።'},en:{all:'All',latest:'Latest News',admin:'Admin',tagline:'Know the world through news!',hero:'Stay informed.',hero2:'Know the world.',intro:'Selected news from Ethiopia and around the world, in one place.',updates:'Latest Updates',refresh:'↻ Refresh',read:'Read full story ↗',search:'Search news...',empty:'No matching stories found.'}};
const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText = (value) => value ? new Intl.DateTimeFormat(language==='am'?'am-ET':'en-US',{dateStyle:'medium'}).format(new Date(value)) : 'አዲስ';
const articleSummary = (a) => a.summary_status === 'ready' && a.summary ? a.summary : (language === 'am' ? 'የዜናው ማጠቃለያ ገና አልተዘጋጀም። ዋናውን ዘገባ ከምንጩ ያንብቡ።' : 'An editorial summary is not available yet. Read the original report from its source.');
async function loadNews(){
  $('#status').textContent=language==='am'?'ዜናዎች በመጫን ላይ...':'Loading news...'; grid.innerHTML='';
  try{
    const response=await fetch(`/api/news?category=${encodeURIComponent(category)}&language=all&limit=45`);
    const data=await response.json(); if(!response.ok||!data.ok) throw new Error(data.error||'load error');
    $('#status').textContent=data.articles.length?`${data.articles.length} ዜናዎች`:(language==='am'?'እስካሁን ዜና አልተገኘም። ዳታቤዙን ካዘጋጁ በኋላ ዜና ያዘምኑ።':'No news yet. Configure the database and run a sync.');
    currentArticles=data.articles; renderNews();
  }catch(e){$('#status').textContent=language==='am'?'ዜና ማምጣት አልተቻለም። ዳታቤዝና የአገልጋይ ቅንብር ያረጋግጡ።':'Could not load news. Check the database and server configuration.';}
}

function renderNews(){
  const term=($('#newsSearch')?.value||'').trim().toLocaleLowerCase();
  const items=currentArticles.filter(a=>(String(a.title||'')+' '+String(a.summary||'')+' '+String(a.source_name||'')).toLocaleLowerCase().includes(term));

  // Promote the newest available article into the main hero banner.
  const heroStory=items[0];
  const hero=$('.hero');
  if(hero&&heroStory){
    const heroTitle=hero.querySelector('h1');
    const heroSummary=hero.querySelector('p');
    const heroEyebrow=hero.querySelector('.eyebrow');
    const heroLink=hero.querySelector('.hero-cta');
    const heroNote=hero.querySelector('.hero-note');
    const numericId=/^\d+$/.test(String(heroStory.id));
    const originalUrl=String(heroStory.original_url||'');
    const destination=numericId?('/read.html?id='+encodeURIComponent(heroStory.id)):(/^https?:\/\//i.test(originalUrl)?originalUrl:'#newsGrid');
    if(heroEyebrow) heroEyebrow.textContent=(language==='am'?'የቅርብ ጊዜ ዋና ዜና':'LATEST TOP STORY')+' · '+String(heroStory.source_name||'HULU ZENA');
    if(heroTitle) heroTitle.textContent=heroStory.title||'';
    if(heroSummary) heroSummary.textContent=articleSummary(heroStory);
    if(heroLink){heroLink.href=destination;heroLink.textContent=ui[language].read;}
    if(heroLink&&!numericId&&destination!=='#newsGrid'){heroLink.target='_blank';heroLink.rel='noopener noreferrer';}
    else if(heroLink){heroLink.removeAttribute('target');heroLink.removeAttribute('rel');}
    if(heroNote) heroNote.textContent=String(heroStory.source_name||'HULU ZENA')+' · '+dateText(heroStory.published_at||heroStory.fetched_at);
  }

  const ticker=$('#tickerText'); if(ticker) ticker.textContent=items[0]?.title || (language==='am'?'አዲስ ዜና ሲገኝ እዚህ ይታያል':'Latest headlines will appear here');

  const trending=$('#trendingList');
  if(trending) trending.innerHTML=items.slice(0,5).map((story,i)=>'<div class="trending-item"><span class="trending-number">'+(i+1)+'</span><div><a href="'+(/^\\d+$/.test(String(story.id))?('/read.html?id='+encodeURIComponent(story.id)):escapeHtml(story.original_url))+'" '+(/^\\d+$/.test(String(story.id))?'':'target="_blank" rel="noopener noreferrer"')+'>'+escapeHtml(story.title)+'</a><small>'+escapeHtml(story.source_name||'HULU ZENA')+' · '+dateText(story.published_at||story.fetched_at)+'</small></div></div>').join('')||'<p class="muted">ታዋቂ ዜና የለም።</p>';
  if(!items.length){grid.innerHTML='<div class="empty-state">'+ui[language].empty+'</div>';return;}
  const card=a=>'<article class="news-card category-'+escapeHtml(a.category||'world')+'">'+'<img class="news-image" src="'+escapeHtml(a.image_url||'/news-placeholder.svg')+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src=\'/news-placeholder.svg\'">'+'<span class="category-tag">'+escapeHtml(labels[a.category]?.[language==='am'?0:1]||a.category)+'</span><h3>'+escapeHtml(a.title)+'</h3><p class="news-summary"><strong>'+(language==='am'?'ዋና ትኩረት፦ ':'Key point: ')+'</strong>'+escapeHtml(articleSummary(a))+'</p><div class="card-meta"><span>'+escapeHtml(a.source_name||'News source')+' · '+escapeHtml(a.language==='en'?'English':'አማርኛ')+'</span><span>'+dateText(a.published_at||a.fetched_at)+'</span></div><a class="read-link" href="'+(/^\d+$/.test(String(a.id))?('/read.html?id='+encodeURIComponent(a.id)):escapeHtml(a.original_url))+'" '+(/^\d+$/.test(String(a.id))?'':'target="_blank" rel="noopener noreferrer"')+'>'+ui[language].read+'</a></article>';
  grid.innerHTML=items.length>1?'<div class="featured-story">'+card(items[0])+'<div class="featured-label">TOP STORY • '+(language==='am'?'ዋና ዜና':'TOP STORY')+'</div></div><div class="news-list">'+items.slice(1).map(card).join('')+'</div>':card(items[0]);
}

$('#newsSearch')?.addEventListener('input',renderNews);

$('#categories').addEventListener('click',e=>{const b=e.target.closest('button[data-category]');if(!b)return;category=b.dataset.category;document.querySelectorAll('#categories button').forEach(x=>x.classList.toggle('active',x===b));$('#feedTitle').textContent=category==='all'?ui[language].latest:`${labels[category]?.[language==='am'?0:1]||category} ${language==='am'?'ዜናዎች':'News'}`;loadNews();});
$('#refresh').addEventListener('click',loadNews);
$('#languageToggle').addEventListener('click',()=>{language=language==='am'?'en':'am';localStorage.setItem('hulu-zena-language',language);$('#newsSearch').placeholder=ui[language].search;document.documentElement.lang=language;$('#languageToggle').textContent=language==='am'?'English':'አማርኛ';$('#feedTitle').textContent=category==='all'?ui[language].latest:`${labels[category]?.[language==='am'?0:1]||category} ${language==='am'?'ዜናዎች':'News'}`;document.querySelector('.tagline').textContent=ui[language].tagline;document.querySelector('.hero h1').innerHTML=`${ui[language].hero}<br><em>${ui[language].hero2}</em>`;document.querySelector('.hero p').textContent=ui[language].intro;document.querySelector('.section-head .eyebrow').textContent=language==='am'?'LATEST UPDATES':'LATEST UPDATES';$('#refresh').textContent=ui[language].refresh;document.querySelectorAll('#categories button').forEach(b=>{const c=b.dataset.category;b.textContent=c==='all'?ui[language].all:labels[c]?.[language==='am'?0:1]||c;});loadNews();});
if(localStorage.getItem('hulu-zena-language') === 'en') $('#languageToggle').click(); else loadNews(); 
