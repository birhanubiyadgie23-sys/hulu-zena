const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
async function loadProfile(){
  try{
    const response=await fetch('/api/admin?public=1');
    if(!response.ok) return;
    const data=await response.json(),profile=data.profile||{};
    const about=$('#aboutText');
    if(about) about.textContent=profile.about_am||'ሁሉ ዜና የኢትዮጵያንና የዓለምን ወቅታዊ ዜናዎች በአንድ ቦታ ለማቅረብ የተዘጋጀ የዜና መድረክ ነው።';
    const socials=$('#socialLinks');
    if(socials){const names=['facebook','telegram','youtube','instagram','tiktok'];socials.innerHTML=names.filter(name=>profile[name]).map(name=>{try{const url=new URL(profile[name]);if(url.protocol!=='https:')return '';return '<a href="'+escapeHtml(url.href)+'" target="_blank" rel="noopener noreferrer">'+name[0].toUpperCase()+name.slice(1)+'</a>';}catch{return '';}}).join('');}
    const email=$('#contactEmail');
    if(email&&profile.contact_email){const link=document.createElement('a');link.href='mailto:'+profile.contact_email;link.textContent=profile.contact_email;email.replaceChildren(document.createTextNode('ኢሜይል፦ '),link);}
  }catch{}
}
async function api(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed');return data;}
$('#contactForm')?.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]'),status=$('#contactStatus');
  button.disabled=true;status.textContent='በመላክ ላይ...';
  try{await api('/api/admin?contact=1',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();status.textContent='መልዕክትዎ ተቀብለናል።';}
  catch(error){status.textContent=error.message||'መልዕክቱን መላክ አልተቻለም።';}
  finally{button.disabled=false;}
});
loadProfile();