// Access control, admin settings, cloud playbooks and dynamic parser mapping.
/* Phase 4 access/cloud/mapping layer. Existing parser and playbook engines are retained. */
(()=>{
'use strict';
const ACCESS_KEY='soc-studio-access-v2', SETTINGS_KEY='soc-studio-settings-v2';
const defaults={version:2,features:{parser:true,workspace:true,library:true,apps:true,caseTools:true},playbookUrl:''};
let settings;try{const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');if(!saved||saved.version!==2){settings=JSON.parse(JSON.stringify(defaults));if(saved&&saved.playbookUrl)settings.playbookUrl=saved.playbookUrl;localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}else{settings={...defaults,...saved,features:{...defaults.features,...(saved.features||{})}}}}catch{settings=JSON.parse(JSON.stringify(defaults))}
let role='local';
const $id=id=>document.getElementById(id);
function persistSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}
function isAdmin(){return role==='admin'}
window.SOCStudioAccess={isAdmin};
function notifySafe(msg){if(typeof notify==='function')notify(msg);else alert(msg)}
function addNavAndSettings(){
 const nav=document.querySelector('.nav'); if(!nav)return;
 const adminBtn=document.createElement('button');adminBtn.type='button';adminBtn.id='admin-access-btn';adminBtn.innerHTML='<span class="ico">🔐</span> Admin login';nav.appendChild(adminBtn);
 adminBtn.onclick=()=>{if(isAdmin()){showAdminSettings();return} $id('access-overlay').classList.remove('hidden');$id('access-user').focus()};
 const jsonBtn=document.createElement('button');jsonBtn.type='button';jsonBtn.id='admin-json-nav';jsonBtn.className='hidden';jsonBtn.innerHTML='<span class="ico">{ }</span> Shared JSON';jsonBtn.onclick=()=>{if(!isAdmin())return;showAdminSettings();$id('shared-json-panel').scrollIntoView({behavior:'smooth',block:'start'});refreshSharedJson()};nav.appendChild(jsonBtn);
 const pill=document.querySelector('.user-meta');if(pill){pill.querySelector('strong').textContent='Local User';pill.querySelector('span').textContent='Read-only playbooks · Full tools';}
 const adminPage=$id('admin-page');
 const section=document.createElement('section');section.id='admin-settings-page';section.className='content hidden';
 section.innerHTML=`<div class="page-heading"><div><div class="eyebrow">Administrator controls</div><h1>Admin settings</h1><p>Manage local-user feature availability and inspect the shared playbook JSON stored in the GitHub project.</p></div><span class="role-chip">ADMIN</span></div>
 <section class="panel"><div class="panel-head"><div><h2>Feature availability for local users</h2><p>Enabled tools are available to local users. Playbook definitions remain read-only for them.</p></div></div><div class="panel-body"><div class="settings-grid" id="feature-toggles"></div></div></section>
 <section class="panel" id="shared-json-panel" style="margin-top:18px"><div class="panel-head"><div><h2>Shared playbooks JSON</h2><p>Read-only view of the central JSON file in your GitHub repository. Admin changes are committed through the secure API.</p></div><span class="tag blue">Read only</span></div><div class="panel-body"><div class="admin-actions"><button class="btn btn-primary" id="refresh-shared-json">Refresh from GitHub</button><button class="btn" id="merge-local-playbooks">Merge local custom playbooks</button><button class="btn" id="copy-shared-json">Copy JSON</button></div><p id="shared-json-status" class="helper" style="margin:10px 0"></p><textarea id="shared-json-preview" class="parser-textarea" readonly aria-label="Shared playbooks JSON" spellcheck="false" style="min-height:280px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace"></textarea><p class="helper">This preview cannot be edited here. The repository file is updated automatically when an administrator saves a playbook definition. The file must not contain secrets.</p></div></section>
 <section class="panel" style="margin-top:18px"><div class="panel-head"><div><h2>Admin session</h2><p>End the admin session and return to local-user access.</p></div></div><div class="panel-body"><button class="btn btn-danger" id="admin-logout">Log out admin</button></div></section>`;
 document.querySelector('main').appendChild(section);
 const defs=[['parser','Log parser','Allow local users to open the parser.'],['workspace','Playbook workspace','Use playbooks and customize case-specific values.'],['library','Playbook library','Browse and use playbooks; definitions are read-only.'],['apps','Threat-intelligence apps','Access the available investigation tools.'],['caseTools','Incident handoff & checklist','Allow access to incident handoff and checklist tools.']];
 $id('feature-toggles').innerHTML=defs.map(([k,n,d])=>`<label class="setting-row"><span><strong>${n}</strong><p>${d}</p></span><input type="checkbox" data-feature="${k}" ${settings.features[k]?'checked':''}></label>`).join('');
 $id('feature-toggles').querySelectorAll('[data-feature]').forEach(c=>c.onchange=()=>{settings.features[c.dataset.feature]=c.checked;persistSettings();applyRoleView();scheduleCentralSave();});
 $id('refresh-shared-json').onclick=refreshSharedJson;
 $id('merge-local-playbooks').onclick=mergeLegacyLocalPlaybooks;
 $id('copy-shared-json').onclick=async()=>{try{await navigator.clipboard.writeText($id('shared-json-preview').value);notifySafe('Shared JSON copied.')}catch{$id('shared-json-preview').focus();$id('shared-json-preview').select();notifySafe('Select and copy the JSON manually.')}};
 $id('admin-logout').onclick=()=>{role='local';sessionStorage.removeItem(ACCESS_KEY);sessionStorage.removeItem('soc-studio-admin-token');applyRoleView();showPage('workspace');notifySafe('Signed out. Local users retain read-only playbooks and enabled tools.')};
}
function showAdminSettings(){if(!isAdmin())return;$id('workspace-page').classList.add('hidden');$id('admin-page').classList.add('hidden');$id('library-page').classList.add('hidden');$id('apps-page').classList.add('hidden');$id('parser-page').classList.add('hidden');$id('admin-settings-page').classList.remove('hidden');$id('crumb-current').textContent='Admin settings';}
function applyRoleView(){
 const featureForPage={workspace:'workspace',library:'library',apps:'apps',parser:'parser'};
 document.querySelectorAll('[data-page]').forEach(b=>{
  const p=b.dataset.page;
  // The use-case builder is a write surface and remains administrator-only.
  const allowed=p==='admin'?isAdmin():(isAdmin()||settings.features[featureForPage[p]]!==false);
  b.classList.toggle('hidden',!allowed);
 });
 // Local users may export but cannot import definitions or create/edit/delete them.
 ['new-usecase-top','library-new','import-btn','folder-btn'].forEach(id=>{const el=$id(id);if(el)el.classList.toggle('hidden',!isAdmin())});
 const importFile=$id('import-file');if(importFile)importFile.disabled=!isAdmin();
 const settingsPage=$id('admin-settings-page');if(settingsPage)settingsPage.classList.toggle('hidden',!isAdmin());
 const builder=$id('admin-page');if(builder)builder.classList.toggle('hidden',!isAdmin());
 document.querySelectorAll('.toolkit-grid').forEach(el=>el.classList.toggle('hidden',settings.features.caseTools===false));
 const activePage=document.querySelector('[data-page].active')?.dataset.page;
 if(!isAdmin()&&(activePage==='admin'||(featureForPage[activePage]&&settings.features[featureForPage[activePage]]===false))){const fallback=['workspace','library','apps','parser'].find(p=>settings.features[p]!==false)||'parser';showPage(fallback)}
 const b=$id('admin-access-btn');if(b)b.innerHTML=isAdmin()?'<span class="ico">⚙</span> Admin settings':'<span class="ico">🔐</span> Admin login';
 const jsonNav=$id('admin-json-nav');if(jsonNav)jsonNav.classList.toggle('hidden',!isAdmin());
 const pill=document.querySelector('.user-meta');if(pill){pill.querySelector('strong').textContent=isAdmin()?'Administrator':'Local User';pill.querySelector('span').textContent=isAdmin()?'Full access':'Read-only playbooks · Full tools';}
 // Read-only mode hides edit/delete controls in the playbook library, without disabling normal playbook use.
 if(typeof renderLibrary==='function')renderLibrary();
}
$id('access-form').addEventListener('submit',async e=>{e.preventDefault();const u=$id('access-user').value.trim(),p=$id('access-pass').value,err=$id('access-error');err.classList.add('hidden');const cfg=window.SOC_STUDIO_CONFIG||{};try{if(cfg.apiBaseUrl){const res=await fetch(cfg.apiBaseUrl.replace(/\/$/,'')+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u,password:p})});const data=await res.json().catch(()=>({}));if(!res.ok||!data.token)throw new Error(data.error||'Admin login failed.');sessionStorage.setItem('soc-studio-admin-token',data.token);role='admin';sessionStorage.setItem(ACCESS_KEY,'admin');}else{throw new Error('Shared admin API is not configured. Set apiBaseUrl in src/js/config.js and deploy the API before signing in.');} $id('access-overlay').classList.add('hidden');$id('access-pass').value='';applyRoleView();showAdminSettings();await refreshSharedJson();notifySafe('Admin access granted.')}catch(ex){err.textContent=ex.message||'Could not sign in to the admin service.';err.classList.remove('hidden')}});
$id('access-cancel').onclick=()=>{$id('access-overlay').classList.add('hidden');role='local';applyRoleView();showPage('workspace')};
function normalizePlaybookUrl(raw){
 const value=String(raw||'').trim();
 if(!value)return '';
 try{
  const u=new URL(value);
  // Google Drive share links point to an HTML preview page. Convert common file-share formats.
  if((u.hostname==='drive.google.com'||u.hostname==='www.drive.google.com')&&u.pathname.startsWith('/file/d/')){
   const match=u.pathname.match(/^\/file\/d\/([^/]+)/);if(match)return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(match[1])}`;
  }
  if((u.hostname==='drive.google.com'||u.hostname==='www.drive.google.com')&&u.pathname==='/open'&&u.searchParams.get('id')){
   return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(u.searchParams.get('id'))}`;
  }
  // GitHub /blob/ links return an HTML viewer page. Convert them to raw file URLs.
  if((u.hostname==='github.com'||u.hostname==='www.github.com')&&u.pathname.split('/').length>=5){
   const parts=u.pathname.split('/').filter(Boolean);
   const blobIndex=parts.indexOf('blob');
   if(blobIndex===2 && parts.length>4){
    const owner=parts[0],repo=parts[1],ref=parts[3],filePath=parts.slice(4).join('/');
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
   }
  }
  return value;
 }catch{return value}
}
async function fetchCloudPlaybooks(){
 const status=$id('cloud-status');const rawUrl=(settings.playbookUrl||'').trim();const url=normalizePlaybookUrl(rawUrl);
 if(!url){status.textContent='No cloud URL configured. Paste a public Google Drive share link or direct JSON URL.';return}
 status.textContent='Fetching shared playbooks…';
 try{
  const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error('HTTP '+res.status);
  const responseText=await res.text();
  let data;try{data=JSON.parse(responseText)}catch(parseErr){
   if(/^\s*<!doctype html|^\s*<html|^\s*</i.test(responseText))throw new Error('The URL returned an HTML page instead of JSON (often a Drive preview/sign-in page). Make the file public and use a direct JSON URL. Google Drive may still block browser CORS; if so, host the JSON on a CORS-enabled static host.');
   throw new Error('Response is not valid JSON: '+parseErr.message);
  }
  const incoming=Array.isArray(data)?data:data.playbooks;
  if(!Array.isArray(incoming)||!incoming.every(p=>p&&p.name&&p.category&&p.description&&Array.isArray(p.fields)&&typeof p.template==='string'))throw new Error('JSON schema did not match playbook format.');
  // Do not overwrite local edits while running; retain built-ins and replace matching IDs/add shared entries.
  const valid=incoming.map((p,i)=>({...p,id:String(p.id||'CLOUD-'+i),fields:p.fields.map(f=>({key:String(f.key),value:String(f.value??'')})),recommendations:Array.isArray(p.recommendations)?p.recommendations:[]}));
  const ids=new Set(valid.map(p=>p.id));playbooks=playbooks.filter(p=>p.id.startsWith('PB-')&&!ids.has(p.id)).concat(valid);
  selectedId=playbooks.some(p=>p.id===selectedId)?selectedId:(playbooks[0]?.id||'');
  if(typeof renderList==='function')renderList();if(typeof renderFields==='function'&&typeof selected==='function'&&selected())renderFields();if(typeof renderLibrary==='function')renderLibrary();
  status.textContent=`Loaded ${valid.length} shared playbook(s) from the public URL.`;
  if(typeof savePlaybooks==='function')savePlaybooks();window.dispatchEvent(new Event('soc-playbooks-updated'));
 }catch(err){const msg=err instanceof TypeError&&/fetch/i.test(err.message)?'Browser fetch failed (often CORS or an inaccessible/private URL). Google Drive links may not support direct browser fetch; use a public JSON URL from a host that allows CORS.':err.message;status.textContent='Could not fetch JSON: '+msg}
}
function addUseCaseMapping(){
 const panel=document.createElement('section');panel.id='mapping-panel';panel.className='panel';
 panel.innerHTML=`<div class="panel-head"><div><h2>3. Use-case field mapping</h2><p>Select a playbook use case to map its field keys against parsed log fields in real time.</p></div><span class="tag blue">Dynamic mapping</span></div><div class="panel-body"><div class="form-field" style="max-width:600px;margin-bottom:14px"><label for="parser-usecase">Use-case name</label><select id="parser-usecase" class="search"></select><span class="helper">Matching uses normalized field names (case/punctuation-insensitive), with common aliases. Missing values stay clearly marked.</span></div><div class="parser-table-wrap"><table class="mapping-table"><thead><tr><th>Use-case field</th><th>Mapped log field</th><th>Current value / status</th></tr></thead><tbody id="mapping-body"><tr><td colspan="3">Parse logs and select a use case.</td></tr></tbody></table></div><div class="admin-actions"><button class="btn" id="copy-mapped-fields">Copy mapped fields</button></div></div>`;
 const parserPage=$id('parser-page');const results=$id('parser-results-panel');if(results)results.after(panel);else parserPage.appendChild(panel);
 const select=$id('parser-usecase');
 function refill(){const old=select.value;select.innerHTML=playbooks.map(p=>`<option value="${String(p.id).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${String(p.name).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('');if(playbooks.some(p=>p.id===old))select.value=old;update();}
 function norm(x){return String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
 const aliases={username:['user','accountname','principalname','subjectusername','targetusername','initiatedby'],hostname:['host','computer','device','devicename','machine'],sourceip:['srcip','src','clientip','sourceaddress','ipaddress','remoteip'],destinationip:['dstip','dst','destip','destinationaddress','remoteaddress'],eventtime:['timestamp','time','datetime','createddatetime','eventdatetime'],eventid:['eventcode','id','signatureid'],processname:['process','image','processpath'],commandline:['processcommandline','command'],domain:['fqdn','hostname','dnsquery'],filehash:['hash','sha256','md5','sha1']};
 function update(){
  const p=playbooks.find(x=>x.id===select.value);const body=$id('mapping-body');if(!p){body.innerHTML='<tr><td colspan="3">No use case selected.</td></tr>';return}
  const events=(typeof parserState!=='undefined'?parserState.events:[])||[];
  const fieldBag={};events.forEach(ev=>Object.assign(fieldBag,ev.fields||{},ev.normalized||{}));
  const keys=Object.keys(fieldBag);const normKeys={};keys.forEach(k=>{normKeys[norm(k)]=k});
  const mappings=p.fields.map(f=>{let k=normKeys[norm(f.key)];if(!k){const a=aliases[norm(f.key)]||[];k=keys.find(x=>a.includes(norm(x)))}return {key:f.key,source:k||'',value:k?String(fieldBag[k]??''):'',status:k?'Matched':'Missing in parsed logs'}});
  body.innerHTML=mappings.map(m=>`<tr><td><strong>${esc(m.key)}</strong></td><td>${m.source?esc(m.source):'—'}</td><td>${m.source?esc(m.value):'<span style="color:#d35d69">Missing in parsed logs</span>'}</td></tr>`).join('');
  $id('copy-mapped-fields').onclick=async()=>{const txt=mappings.map(m=>`${m.key}: ${m.source?m.value:'[MISSING]'}`).join('\n');try{await navigator.clipboard.writeText(txt);notifySafe('Mapped fields copied.')}catch{prompt('Copy mapped fields:',txt)}};
 }
 select.onchange=update;
 // Wrap parser rendering so map updates after each parse/filter refresh.
 if(typeof parserRender==='function'&&!parserRender.__mappingWrapped){const original=parserRender;const wrapped=function(...args){const result=original.apply(this,args);try{update()}catch{}return result};wrapped.__mappingWrapped=true;parserRender=wrapped}
 window.addEventListener('soc-playbooks-updated',refill);refill();
}

// Enforce read-only playbook definitions in the library UI for local users.
const _renderLibraryOriginal=window.renderLibrary;
if(typeof _renderLibraryOriginal==='function'){
 window.renderLibrary=function(){
  _renderLibraryOriginal();
  if(!isAdmin()){
   document.querySelectorAll('#library-list [data-edit],#library-list [data-delete]').forEach(el=>el.remove());
   document.querySelectorAll('#library-list .field-actions').forEach(row=>{if(!row.querySelector('[data-open]'))row.remove()});
  }
 };
}

addNavAndSettings();addUseCaseMapping();
if(sessionStorage.getItem(ACCESS_KEY)==='admin'){role='admin'}
applyRoleView();
// Shared source is loaded through the central API below; legacy external URL fetching is intentionally disabled.

// Central GitHub-backed JSON synchronization. GitHub credentials remain on the serverless API.
const CENTRAL_API=String((window.SOC_STUDIO_CONFIG||{}).apiBaseUrl||'').replace(/\/$/,'');
const CENTRAL_TOKEN_KEY='soc-studio-admin-token';
let centralBaseline=[];
const legacyLocalPlaybooks=(()=>{try{const a=JSON.parse(localStorage.getItem('soc-playbook-studio-v1')||'null');return Array.isArray(a)?a.map(p=>({...p,fields:Array.isArray(p.fields)?p.fields.map(f=>({...f})):[]})):JSON.parse(JSON.stringify(playbooks))}catch{return JSON.parse(JSON.stringify(playbooks))}})();
let centralSyncTimer=null,centralSyncInFlight=false,centralSyncPending=false;
function centralHeaders(){const h={'Content-Type':'application/json'};const t=sessionStorage.getItem(CENTRAL_TOKEN_KEY);if(t)h.Authorization='Bearer '+t;return h}
function playbookPayload(){return {format:'SOC Playbook Studio',version:1,updatedAt:new Date().toISOString(),settings:{features:{...settings.features}},playbooks:playbooks.map(p=>{const base=centralBaseline.find(x=>String(x.id)===String(p.id));return {...p,fields:(p.fields||[]).map(f=>({key:String(f.key),value:String(base?.fields?.find(b=>String(b.key)===String(f.key))?.value??'')})),recommendations:Array.isArray(p.recommendations)?p.recommendations:[]}})}}
function validCentralPlaybooks(data){const a=Array.isArray(data)?data:data?.playbooks;return Array.isArray(a)&&a.length>0&&a.every(p=>p&&p.id&&p.name&&p.category&&p.description&&Array.isArray(p.fields)&&typeof p.template==='string')?a:null}
function setSharedStatus(msg,isError=false){const el=$id('shared-json-status');if(el){el.textContent=msg;el.style.color=isError?'#d35d69':''}}
async function refreshSharedJson(){const preview=$id('shared-json-preview');if(!preview)return;if(!CENTRAL_API){preview.value='';setSharedStatus('Shared API is not configured. Set apiBaseUrl in src/js/config.js and deploy the Cloudflare Worker.',true);return}setSharedStatus('Loading the central JSON from GitHub…');try{const res=await fetch(CENTRAL_API+'/api/playbooks',{cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.error||('HTTP '+res.status));const incoming=validCentralPlaybooks(data);if(!incoming)throw new Error('The GitHub JSON does not match the expected playbook schema.');preview.value=JSON.stringify({format:data.format||'SOC Playbook Studio',version:data.version||1,updatedAt:data.updatedAt||null,settings:data.settings||{features:{...settings.features}},playbooks:incoming},null,2);if(data.settings&&data.settings.features){settings.features={...settings.features,...data.settings.features};persistSettings();document.querySelectorAll('#feature-toggles [data-feature]').forEach(c=>{c.checked=settings.features[c.dataset.feature]!==false});applyRoleView()}centralBaseline=incoming.map(p=>({...p,fields:p.fields.map(f=>({...f}))}));playbooks=incoming.map(p=>({...p,fields:p.fields.map(f=>({key:String(f.key),value:String(f.value??'')})),recommendations:Array.isArray(p.recommendations)?p.recommendations:[]}));selectedId=playbooks.some(p=>p.id===selectedId)?selectedId:(playbooks[0]?.id||'');if(typeof savePlaybooks==='function')savePlaybooks();if(typeof renderList==='function')renderList();if(typeof renderFields==='function'&&typeof selected==='function'&&selected())renderFields();if(typeof renderLibrary==='function')renderLibrary();window.dispatchEvent(new Event('soc-playbooks-updated'));setSharedStatus('Synced from GitHub · '+incoming.length+' playbooks'+(data.updatedAt?' · '+new Date(data.updatedAt).toLocaleString() :''));}catch(e){setSharedStatus('Could not load central JSON: '+e.message,true);if(CENTRAL_API)notifySafe('Shared playbooks could not be loaded from GitHub. Check the API status; this device may be showing a cached copy.')}}
async function pushSharedJson(){if(!CENTRAL_API){setSharedStatus('Not saved centrally: configure the shared API first.',true);notifySafe('Playbooks remain local because the shared API is not configured.');return}const token=sessionStorage.getItem(CENTRAL_TOKEN_KEY);if(!token){setSharedStatus('Not saved centrally: sign in as administrator through the shared API.',true);notifySafe('Admin API session missing. Sign in again.');return}if(centralSyncInFlight){centralSyncPending=true;return}centralSyncInFlight=true;setSharedStatus('Saving JSON to the GitHub repository…');try{const res=await fetch(CENTRAL_API+'/api/playbooks',{method:'PUT',headers:centralHeaders(),body:JSON.stringify(playbookPayload())});const data=await res.json().catch(()=>({}));if(!res.ok){if(res.status===401||res.status===403){sessionStorage.removeItem(CENTRAL_TOKEN_KEY);throw new Error('Admin session expired or permission denied. Please sign in again.')}throw new Error(data.error||('HTTP '+res.status))}centralBaseline=Array.isArray(data.playbooks)?data.playbooks.map(p=>({...p,fields:(p.fields||[]).map(f=>({...f}))})):centralBaseline;const preview=$id('shared-json-preview');if(preview)preview.value=JSON.stringify({format:'SOC Playbook Studio',version:1,updatedAt:data.updatedAt||null,settings:data.settings||{features:{...settings.features}},playbooks:data.playbooks||playbookPayload().playbooks},null,2);setSharedStatus('Saved to GitHub successfully'+(data.commit?' · commit '+data.commit.slice(0,7):'')+' · '+new Date().toLocaleString());}catch(e){setSharedStatus('GitHub save failed: '+e.message,true);notifySafe('Central save failed. Your local copy remains, but other devices will not receive this change until it is synced.')}finally{centralSyncInFlight=false;if(centralSyncPending){centralSyncPending=false;pushSharedJson()}}}
function scheduleCentralSave(){if(!CENTRAL_API)return;clearTimeout(centralSyncTimer);centralSyncTimer=setTimeout(()=>pushSharedJson(),500)}
function mergeLegacyLocalPlaybooks(){if(!isAdmin()){notifySafe('Only an administrator can migrate local playbooks.');return}if(!CENTRAL_API||!sessionStorage.getItem(CENTRAL_TOKEN_KEY)){notifySafe('Configure the shared API and sign in as administrator first.');return}const existing=new Set(playbooks.map(p=>String(p.id)));const legacy=legacyLocalPlaybooks.filter(p=>p&&p.id&&!String(p.id).startsWith('PB-')&&!existing.has(String(p.id))&&p.name&&p.category&&p.description&&Array.isArray(p.fields)&&typeof p.template==='string').map(p=>({...p,id:String(p.id),fields:p.fields.map(f=>({key:String(f.key),value:String(f.value??'')}))}));if(!legacy.length){notifySafe('No additional local custom playbooks were found to migrate.');return}if(!confirm(`Merge ${legacy.length} local custom playbook(s) into the shared GitHub library?`))return;playbooks.push(...legacy);if(typeof renderList==='function')renderList();if(typeof renderFields==='function'&&typeof selected==='function'&&selected())renderFields();if(typeof renderLibrary==='function')renderLibrary();window.dispatchEvent(new Event('soc-playbooks-updated'));scheduleCentralSave();notifySafe(`Queued ${legacy.length} local custom playbook(s) for shared sync.`)}
// Load the shared source first on each device; do not depend on that browser's stale localStorage.
if(CENTRAL_API){refreshSharedJson()}
// A successful builder form submission means create/edit changed a playbook definition.
const usecaseForm=$id('usecase-form');if(usecaseForm)usecaseForm.addEventListener('submit',()=>setTimeout(scheduleCentralSave,250));
const importInput=$id('import-file');if(importInput)importInput.addEventListener('change',()=>setTimeout(scheduleCentralSave,250));
if(typeof window.deletePlaybook==='function'&&!window.deletePlaybook.__centralWrapped){const oldDelete=window.deletePlaybook;const wrappedDelete=function(...args){const result=oldDelete.apply(this,args);setTimeout(scheduleCentralSave,0);return result};wrappedDelete.__centralWrapped=true;window.deletePlaybook=wrappedDelete;}let libraryCountBeforeDelete=null;document.addEventListener('pointerdown',e=>{if(e.target.closest('#library-list [data-delete]'))libraryCountBeforeDelete=playbooks.length});document.addEventListener('click',e=>{if(e.target.closest('#library-list [data-delete]')&&libraryCountBeforeDelete!==null&&playbooks.length<libraryCountBeforeDelete)setTimeout(scheduleCentralSave,100);libraryCountBeforeDelete=null});
// Existing browser demo login is not accepted as a central write credential.
if(sessionStorage.getItem(ACCESS_KEY)==='admin'&&!sessionStorage.getItem(CENTRAL_TOKEN_KEY)&&CENTRAL_API){role='local';sessionStorage.removeItem(ACCESS_KEY);applyRoleView()}
})();
