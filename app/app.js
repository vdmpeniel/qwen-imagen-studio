'use strict';
const $ = s => document.querySelector(s);
const state = { refs: [], gallery: [], selected: null, job: null, ready: false, loading: false, modelsBusy: false, polling: false, deleting: false, checked: new Set(), hardware: null };
async function api(path, options = {}) {
  const r = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await r.json(); if (!r.ok) throw new Error(data.error || `Error ${r.status}`); return data;
}
function notice(message, error = false) { $('#notice').hidden = false; $('#notice').textContent = message; $('#notice').classList.toggle('error', error); }
function settings() { return { prompt: $('#prompt').value, width: +$('#width').value, height: +$('#height').value, steps: +$('#steps').value, count: +$('#count').value, seed: +$('#seed').value, compute: $('#compute').value, threads: +$('#threads').value, transparent: $('#transparent').checked, fastAttention: $('#fastAttention').checked }; }
// Loads the models for the selected device while the prompt is written, so the first image starts at once.
let warmTimer = null, warmedKey = null, pendingKey = null;
function warmEngine() {
  const s = settings(), key = JSON.stringify([s.compute, s.threads, s.fastAttention]);
  if (state.job || !state.hardware || key === warmedKey || key === pendingKey || !Number.isInteger(s.threads) || s.threads < 0 || s.threads > 128) return;
  clearTimeout(warmTimer); pendingKey = key;
  warmTimer = setTimeout(() => {
    pendingKey = null;
    if (state.job || JSON.stringify([$('#compute').value, +$('#threads').value, $('#fastAttention').checked]) !== key) return;
    warmedKey = key;
    api('/api/engine/warmup', { method: 'POST', body: JSON.stringify({ compute: s.compute, threads: s.threads, fastAttention: s.fastAttention }) }).catch(() => { warmedKey = null; });
  }, 700);
}
function persist() { try { localStorage.setItem('turbo.settings', JSON.stringify(settings())); } catch {} }
function refreshForm() {
  const s = settings(); $('#chars').textContent = `${s.prompt.length}/6000`;
  $('#canvasSize').textContent = `${s.width} × ${s.height}`; $('#megapixels').textContent = `${(s.width*s.height/1e6).toFixed(2)} MP`;
  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('active', +b.dataset.w === s.width && +b.dataset.h === s.height));
  $('#stepsHint').textContent = s.steps === 6 ? '6 pasos · configuración recomendada para Viggle v0.2.1.' : 'Modo experimental: usa 6 pasos para v0.2.1. Se conservan los nodos de entrenamiento al añadir pasos; menos de 4 no está recomendado.';
  $('#generate').disabled = !!state.job || !state.ready || state.modelsBusy;
  $('#generate').title = state.modelsBusy ? 'Espera a que terminen las descargas y la recarga de modelos.' : '';
  syncStatusActivity();
  $('#compute').disabled=!!state.job;$('#fastAttention').disabled=!!state.job;
  $('#computeHint').textContent={auto:'Automático usa GPU con una tarjeta dedicada, CPU + GPU con una GPU integrada y CPU si no hay GPU compatible.',cpu:'Todo el cálculo se realiza en CPU. Puede tardar varios minutos o más. Empieza con 512 × 512 y 6 pasos. 0 hilos = automático.',gpu:'Todo el cálculo se realiza en la GPU. Los pesos esperan en RAM y cada modelo pasa a la VRAM cuando se necesita.',hybrid:'La CPU interpreta el texto y las referencias; la GPU genera y decodifica la imagen. Para GPU integrada o con poca VRAM; con una GPU dedicada de 8 GB, GPU es algo más rápido.'}[$('#compute').value]+' Al cambiar el modo, los modelos se cargan de nuevo en segundo plano.';
  syncSelection();
  document.querySelectorAll('.gallery-delete, #deleteAll, #delete').forEach(b=>b.disabled=!!state.job||state.deleting||!state.gallery.length);
  persist(); warmEngine();
}
function syncStatusActivity(){const activity=state.modelsBusy||state.loading;$('#statusDot').hidden=activity;$('#statusSpinner').hidden=!activity;}
function setSettings(s) { for (const key of ['prompt','width','height','steps','count','seed','compute','threads']) if (s[key] !== undefined) $(`#${key}`).value = s[key]; $('#transparent').checked = s.transparent === true; if (typeof s.fastAttention === 'boolean') $('#fastAttention').checked = s.fastAttention; refreshForm(); }
function renderRefs() {
  $('#refs').replaceChildren(); $('#refCount').textContent = `${state.refs.length} / 2`; $('#refHint').hidden = !state.refs.length; $('#addSecond').hidden = state.refs.length !== 1;
  state.refs.forEach((src,i) => {
    const div = document.createElement('div'); div.className = 'ref';
    const img = document.createElement('img'); img.src = src; img.alt = `Referencia ${i+1}`;
    const nav = document.createElement('nav'); const label = document.createElement('span'); label.textContent = `Imagen ${i+1}`; nav.append(label);
    if (i) { const prev = document.createElement('button'); prev.type='button'; prev.textContent='←'; prev.title='Mover referencia a la izquierda'; prev.onclick=()=>{[state.refs[i-1],state.refs[i]]=[state.refs[i],state.refs[i-1]];renderRefs();}; nav.append(prev); }
    const remove = document.createElement('button'); remove.type='button'; remove.textContent='×'; remove.setAttribute('aria-label',`Quitar referencia ${i+1}`); remove.onclick=()=>{state.refs.splice(i,1);renderRefs();}; nav.append(remove);
    div.append(img,nav); $('#refs').append(div);
  });
}
async function addFiles(files) {
  try {
    for (const file of files) {
      if (state.refs.length >= 2) throw new Error('El modelo admite un máximo de 2 referencias.');
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 8*1024*1024) throw new Error('Usa PNG, JPG o WebP de hasta 8 MB.');
      // Decode and normalize uploads; limits decoded dimensions before inference.
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40000000) { bitmap.close(); throw new Error('La referencia excede 40 megapíxeles. Redúcela antes de subirla.'); }
      const scale = Math.min(1, 1536 / Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width*scale); canvas.height = Math.round(bitmap.height*scale);
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
      state.refs.push(canvas.toDataURL('image/png')); renderRefs();
    }
  } catch(e) { notice(e.message,true); }
  $('#files').value='';
}
$('#addSecond').onclick=()=>$('#files').click();
$('#files').onchange = e => addFiles(e.target.files);
const dz=$('#dropzone'); for(const event of ['dragenter','dragover']) dz.addEventListener(event,e=>{e.preventDefault();dz.classList.add('drag');});
for(const event of ['dragleave','drop']) dz.addEventListener(event,e=>{e.preventDefault();dz.classList.remove('drag');});
dz.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
document.querySelectorAll('.preset').forEach(b=>b.onclick=()=>{ $('#width').value=b.dataset.w;$('#height').value=b.dataset.h;refreshForm(); });
$('#swap').onclick=()=>{const w=$('#width').value;$('#width').value=$('#height').value;$('#height').value=w;refreshForm();};
$('#form').addEventListener('input',e=>{if(!e.target.matches('[data-number]'))refreshForm();});
$('#random').onclick=()=>{$('#seed').value=crypto.getRandomValues(new Uint32Array(1))[0]%2147483640;refreshForm();};
$('#recommended').onclick=()=>{$('#steps').value=6;refreshForm();};
const ideas = ['An elegant ceramic teapot shaped like a tiny house, lavender glaze, soft morning sunlight, minimalist product photography, warm cream background.', 'Un jardín botánico dentro de una estación espacial, helechos gigantes, ventanas hacia Saturno, fotografía cinematográfica, luz dorada.', 'An editorial photograph of a red fox in a snowy forest at sunrise, soft mist, detailed fur, warm backlight, natural colors.','Un cartel tipográfico que dice "IMAGINA", formas de papel tridimensionales en tonos lavanda y coral, composición editorial limpia.'];
let ideaIndex=0;$('#inspire').onclick=()=>{$('#prompt').value=ideas[ideaIndex++%ideas.length];refreshForm();};
$('#theme').onclick=()=>{document.body.classList.toggle('dark');try{localStorage.setItem('turbo.theme',document.body.classList.contains('dark')?'dark':'light');}catch{}};
function selectImage(item) {
  state.selected=item; $('#result').src=item.src;$('#result').hidden=false;$('#empty').hidden=true;$('#resultInfo').hidden=false;
  $('#resultTitle').textContent=item.prompt.length>85?item.prompt.slice(0,85)+'…':item.prompt;
  $('#resultMeta').textContent=`${item.width} × ${item.height} · ${item.steps} pasos · Semilla ${item.seed} · ${item.refsCount||0} referencias · v${item.modelVersion||'0.1'}${item.computeUsed?' · '+({cpu:'CPU',gpu:'GPU',hybrid:'CPU + GPU',external:'Motor externo'}[item.computeUsed]||item.computeUsed):''}${item.loraApplication==='merged'?' · LoRA fusionado':''}${item.seconds?' · '+item.seconds+' s':''}`;
  $('#download').href=item.src;$('#download').download=`qwen-imagen-${item.seed}.png`;
  $('#metadata').href=`/outputs/${item.id}.json`;$('#metadata').download=`qwen-imagen-${item.seed}.json`;
  document.querySelectorAll('.thumb').forEach(b=>b.classList.toggle('selected',b.dataset.id===item.id));
}
async function loadGallery(selectLatest=false) {
  state.gallery=await api('/api/gallery');$('#gallery').replaceChildren();$('#galleryCount').textContent=state.gallery.length;$('#galleryEmpty').hidden=!!state.gallery.length;
  state.gallery.forEach(item=>{
    const card=document.createElement('article');card.className='gallery-card';
    const b=document.createElement('button');b.className='thumb';b.dataset.id=item.id;b.title=item.prompt;
    const img=document.createElement('img');img.src=item.src;img.alt=item.prompt;img.loading='lazy';
    const div=document.createElement('div');div.textContent=item.width+' × '+item.height;
    const meta=document.createElement('span');meta.textContent=item.steps+' pasos · '+item.seed;div.append(meta);b.append(img,div);b.onclick=()=>selectImage(item);
    const remove=document.createElement('button');remove.className='gallery-delete';remove.textContent='Eliminar';remove.setAttribute('aria-label','Eliminar imagen con semilla '+item.seed);remove.onclick=()=>deleteImages(item);
    const label=document.createElement('label');label.className='image-selection';
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.imageId=item.id;checkbox.checked=state.checked.has(item.id);checkbox.setAttribute('aria-label','Seleccionar imagen con semilla '+item.seed);checkbox.onchange=()=>{if(checkbox.checked)state.checked.add(item.id);else state.checked.delete(item.id);syncSelection();};
    label.append(checkbox,document.createTextNode('Seleccionar'));card.append(label,b,remove);$('#gallery').append(card);
  });
  state.checked=new Set([...state.checked].filter(id=>state.gallery.some(item=>item.id===id)));
  if(state.selected&&!state.gallery.some(x=>x.id===state.selected.id))state.selected=null;
  if(!state.gallery.length){$('#result').hidden=true;$('#empty').hidden=false;$('#resultInfo').hidden=true;}
  refreshForm();
  if(state.gallery.length&&(selectLatest||!state.selected))selectImage(state.gallery[0]);
  else if(state.selected)selectImage(state.selected);
}
$('#reuse').onclick=async()=>{try{const item=state.selected;const refs=await api(`/api/references/${item.id}`);setSettings(item);state.refs=refs.slice(0,2);renderRefs();notice('Ajustes, semilla y referencias restaurados. Puedes repetir o modificar la creación.');$('#prompt').focus();}catch(e){notice(e.message,true);}};
$('#useRef').onclick=async()=>{try{if(state.refs.length>=2)throw new Error('Quita una referencia antes de añadir otra.');const r=await fetch(state.selected.src);await addFiles([new File([await r.blob()],'referencia.png',{type:'image/png'})]);notice('Imagen añadida a las referencias. Describe el cambio que quieres hacer.');}catch(e){notice(e.message,true);}};
async function deleteImages(item=null, ids=null) {
  if(state.job||state.deleting)return;
  const message=ids?'¿Eliminar las '+ids.length+' imágenes seleccionadas?':item?'¿Eliminar esta imagen de la biblioteca?':'¿Eliminar las '+state.gallery.length+' imágenes de la biblioteca?';
  if(!confirm(message))return;
  state.deleting=true;refreshForm();
  try{await api(ids?'/api/gallery/selection':item?'/api/gallery/'+item.id:'/api/gallery',{method:'DELETE',...(ids?{body:JSON.stringify({ids})}:{})});await loadGallery();notice(ids?'Imágenes seleccionadas eliminadas.':item?'Imagen eliminada de la biblioteca.':'Biblioteca vaciada.');}
  catch(e){notice(e.message,true);}
  finally{state.deleting=false;refreshForm();}
}
$('#delete').onclick=()=>{if(state.selected)deleteImages(state.selected);};
$('#deleteAll').onclick=()=>deleteImages();
$('#deleteSelected').onclick=()=>{if(state.checked.size)deleteImages(null,[...state.checked]);};
$('#selectAll').onchange=e=>{state.checked=new Set(e.target.checked?state.gallery.map(item=>item.id):[]);syncSelection();};
function syncSelection(){
  const blocked=!!state.job||state.deleting;
  $('#selectionCount').textContent=state.checked.size+' seleccionadas';
  $('#deleteSelected').disabled=blocked||!state.checked.size;
  const all=$('#selectAll');all.disabled=blocked||!state.gallery.length;all.checked=!!state.gallery.length&&state.checked.size===state.gallery.length;all.indeterminate=state.checked.size>0&&state.checked.size<state.gallery.length;
  document.querySelectorAll('[data-image-id]').forEach(box=>{box.checked=state.checked.has(box.dataset.imageId);box.disabled=blocked;box.closest('.gallery-card').classList.toggle('checked',box.checked);});
}

function showJob(job) {state.job=job;$('#working').hidden=false;$('#workTitle').textContent=`Creando ${job.current||1} de ${job.total}`;$('#workMessage').textContent=job.message;$('#elapsed').textContent=`${Math.round((Date.now()-job.startedAt)/1000)} s`;$('#cancel').disabled=job.cancelRequested;$('#cancel').textContent=job.cancelRequested?'Esperando a que termine la imagen…':'Detener tras esta imagen';refreshForm();}
async function followJob(id) {
  if(state.polling)return;state.polling=true;
  try{while(true){const job=await api(`/api/jobs/${id}`);showJob(job);if(['completed','failed','cancelled'].includes(job.status)){state.job=null;$('#working').hidden=true;notice(job.message,job.status==='failed');await loadGallery(job.images.length>0);break;}await new Promise(r=>setTimeout(r,400));}}
  catch(e){state.job=null;$('#working').hidden=true;notice(`No se pudo consultar la generación: ${e.message}. Reconectando al motor…`,true);}
  finally{state.polling=false;refreshForm();}
}
$('#form').onsubmit=async e=>{e.preventDefault();if(state.job||state.modelsBusy)return;$('#generate').disabled=true;$('#notice').hidden=true;try{const job=await api('/api/jobs',{method:'POST',body:JSON.stringify({...settings(),refs:state.refs})});showJob(job);void followJob(job.id);}catch(e){notice(e.message,true);refreshForm();}};
$('#cancel').onclick=async()=>{if(!state.job)return;try{const job=await api(`/api/jobs/${state.job.id}/cancel`,{method:'POST',body:'{}'});showJob(job);}catch(e){notice(e.message,true);}};
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();if(state.ready&&!state.job&&!state.modelsBusy)$('#form').requestSubmit();}});
async function status() {let loading=false;try{const s=await api('/api/status');state.ready=s.ready;state.modelsBusy=!!s.modelsBusy;loading=!!s.compute?.loading;state.loading=loading;
if(s.compute?.hardware){const h=s.compute.hardware,first=!state.hardware;state.hardware=h;$('#hardwareInfo').textContent=h.cpuName+' · '+h.logicalCores+' hilos · '+h.ramGB+' GB RAM. '+(h.gpus.length?'GPU: '+h.gpus.map(g=>g.name+(g.integrated?' (integrada)':'')).join(', '):'Sin GPU compatible detectada. Puedes generar con CPU.');for(const o of $('#compute').options)o.disabled=!h.modes.includes(o.value);
$('#fastAttention').closest('label').hidden=!h.gpus.some(g=>/^cuda/i.test(g.id));
$('#engineInfo').textContent=s.model+' · '+(s.loraApplication==='merged'?'LoRA fusionado en los pesos (más rápido y con menos VRAM).':s.loraApplication==='runtime'?'LoRA aplicado en tiempo de ejecución.':'')+' Euler con el planificador Turbo, CFG 1 y sin prompt negativo, como requiere este modelo.';
if(first)warmEngine();}
const current=s.compute?.current;$('#status').classList.toggle('ready',s.ready&&!loading&&!state.modelsBusy);$('#status').lastChild.textContent=state.modelsBusy?' Descargando modelos…':s.ready?(loading?' Cargando modelos…':current?' Motor listo · '+({cpu:'CPU',gpu:'GPU',hybrid:'CPU + GPU'}[current.mode]):' Listo para generar'):' Detectando / desconectado';if(s.active&&!state.job){showJob(s.active);void followJob(s.active.id);}}catch{state.ready=false;state.modelsBusy=false;state.loading=false;$('#status').classList.remove('ready');$('#status').lastChild.textContent=' Servidor desconectado';}refreshForm();setTimeout(status,loading||state.modelsBusy?1500:5000);}

const numberPresets={width:[512,768,1024,1152,1344,1536,2048],height:[512,768,864,1024,1152,1344,1536,2048],steps:[4,5,6,7,8,12,20,30,40],threads:[0,2,4,8,12,16,24,32],seed:[-1,0,42,12345,424242]};
const numberLabels={width:'Ancho',height:'Alto',steps:'Pasos',seed:'Semilla',threads:'Hilos de CPU'};
function closeNumberMenus(){document.querySelectorAll('.number-options').forEach(menu=>menu.hidden=true);document.querySelectorAll('.number-combo input').forEach(input=>input.setAttribute('aria-expanded','false'));}
for(const [key,values] of Object.entries(numberPresets)){
  const input=$('#'+key), wrapper=document.createElement('div');wrapper.className='number-combo';input.before(wrapper);wrapper.append(input);
  input.setAttribute('role','combobox');input.setAttribute('aria-label',numberLabels[key]);input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls',key+'-options');input.setAttribute('aria-autocomplete','list');
  const toggle=document.createElement('button');toggle.type='button';toggle.className='number-toggle';toggle.textContent='⌄';toggle.setAttribute('aria-label','Opciones de '+numberLabels[key].toLowerCase());
  const menu=document.createElement('div');menu.id=key+'-options';menu.className='number-options';menu.role='listbox';menu.setAttribute('aria-label','Valores de '+numberLabels[key].toLowerCase());menu.hidden=true;
  function open(){closeNumberMenus();menu.hidden=false;input.setAttribute('aria-expanded','true');menu.querySelectorAll('[role=option]').forEach(option=>option.setAttribute('aria-selected',String(option.dataset.value===input.value)));}
  toggle.onclick=()=>{if(menu.hidden)open();else closeNumberMenus();};
  input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open();menu.firstElementChild.focus();}if(e.key==='Escape')closeNumberMenus();});
  input.addEventListener('input',closeNumberMenus);
  for(const n of values){const option=document.createElement('button');option.type='button';option.role='option';option.dataset.value=n;option.textContent=key==='threads'?(n===0?'Automático (0)':n+' hilos'):key==='seed'?(n===-1?'Aleatoria (−1)':'Semilla '+n):key==='steps'?(n===6?'6 · Turbo v0.2.1':n+' pasos'):n+' px';option.onclick=()=>{input.value=n;closeNumberMenus();input.focus();refreshForm();};menu.append(option);}
  menu.addEventListener('keydown',e=>{const options=[...menu.children],i=options.indexOf(document.activeElement);if(e.key==='Escape'){closeNumberMenus();input.focus();}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();options[(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length].focus();}});
  wrapper.append(toggle,menu);
}
document.addEventListener('click',e=>{if(!e.target.closest('.number-combo'))closeNumberMenus();});

try{if(localStorage.getItem('turbo.theme')==='dark')document.body.classList.add('dark');const saved=JSON.parse(localStorage.getItem('turbo.settings')||'null');if(saved)setSettings(saved);}catch{}
try{if(localStorage.getItem('turbo.modelVersion')!=='0.2.1'){$('#steps').value=6;localStorage.setItem('turbo.modelVersion','0.2.1');}}catch{}
refreshForm();loadGallery().catch(e=>notice(e.message,true));status();

/* ---------------- Model manager ---------------- */
const models={open:false,data:null,applying:false,confirm:null,hadPending:false,timer:null};
const sizeLabel=bytes=>bytes==null?'—':bytes>=1024**3?(bytes/1024**3).toFixed(2)+' GB':Math.max(1,Math.round(bytes/1024**2))+' MB';
const downloadStateLabel={queued:'En cola',downloading:'Descargando',verifying:'Verificando',converting:'Convirtiendo LoRA',done:'Instalado',cancelled:'Cancelada',error:'Error'};
function modelMessage(text,error=false){const box=$('#modelsNotice');box.hidden=!text;box.textContent=text||'';box.classList.toggle('error',!!error);}
function modelBadge(text,kind=''){const span=document.createElement('span');span.className='model-badge'+(kind?' '+kind:'');span.textContent=text;return span;}
function activeItem(role){return models.data?models.data.items.find(item=>item.role===role&&item.active)||null:null;}
function selectionItems(selection){
  if(!models.data||!selection)return [];
  const byId=new Map(models.data.items.map(item=>[item.id,item]));
  const required=[selection.textEncoder,selection.mmproj,selection.vae,selection.diffusion].map(id=>byId.get(id)).filter(Boolean);
  const diffusion=byId.get(selection.diffusion);
  if(!diffusion||diffusion.kind!=='merged'){
    const lora=byId.get(selection.lora);if(lora)required.push(lora);
  }
  return required;
}
function modelActionButton(label,variant,onclick,disabled=false){const b=document.createElement('button');b.type='button';b.className=variant;b.textContent=label;b.disabled=disabled;b.onclick=onclick;return b;}
function renderModels(){
  const data=models.data,body=$('#modelsBody');if(!data)return;
  body.replaceChildren();
  for(const role of data.roles){
    const group=document.createElement('section');group.className='models-group';
    const head=document.createElement('div');head.className='models-group-head';
    const title=document.createElement('h3');title.textContent=role.label;
    const hint=document.createElement('p');hint.className='hint';hint.textContent=role.hint;
    head.append(title,hint);group.append(head);
    if(role.id==='lora'&&activeItem('diffusion')?.kind==='merged'){
      const note=document.createElement('p');note.className='models-note';note.textContent='El modelo de difusión activo ya lleva el LoRA fusionado, así que esta pieza no se aplica.';group.append(note);
    }
    for(const item of data.items.filter(entry=>entry.role===role.id))group.append(modelRow(item,role));
    body.append(group);
  }
  renderModelsFooter();
}
function modelRow(item,role){
  const data=models.data,state=item.state;
  const busy=models.applying||!!data.jobActive||!!data.downloading;
  const loraBlocked=role.id==='lora'&&activeItem('diffusion')?.kind==='merged';
  const row=document.createElement('div');row.className='model-row'+(item.installed?'':' missing')+(item.active?' is-active':'');
  const info=document.createElement('div');info.className='model-info';
  const name=document.createElement('div');name.className='model-name';const strong=document.createElement('strong');strong.textContent=item.label;name.append(strong);
  if(item.active)name.append(modelBadge('Activa','active'));
  if(data.pending?.[role.id]===item.id)name.append(modelBadge('Pendiente','pending'));
  if(item.installed&&!item.active)name.append(modelBadge('Instalada'));
  if(item.local)name.append(modelBadge('Local'));
  if(!item.installed&&!item.downloadable)name.append(modelBadge('No descargable','warn'));
  const detail=document.createElement('small');detail.textContent=item.detail;info.append(name,detail);
  if(state&&['queued','downloading','verifying','converting','error'].includes(state.state)){
    const line=document.createElement('div');line.className='model-progress-line';
    const text=document.createElement('span');text.textContent=downloadStateLabel[state.state]+(state.state==='downloading'&&state.total?' · '+sizeLabel(state.received)+' de '+sizeLabel(state.total):'');
    line.append(text);
    const bar=document.createElement('div');bar.className='model-progress'+(state.state==='error'?' error':'');
    const fill=document.createElement('i');fill.style.width=state.total?Math.min(100,Math.round(state.received/state.total*100))+'%':'0%';bar.append(fill);line.append(bar);
    if(state.error){const err=document.createElement('small');err.className='model-error';err.textContent=state.error;line.append(err);}
    info.append(line);
  }
  const size=document.createElement('span');size.className='model-size';size.textContent=sizeLabel(item.bytes);
  const actions=document.createElement('div');actions.className='model-actions';
  if(models.confirm===item.id){
    const question=document.createElement('span');question.className='model-confirm-text';question.textContent=item.local?'¿Borrar el fusionado y su prueba?':'¿Borrar del disco?';
    actions.append(question,modelActionButton('Sí, borrar','secondary danger',()=>deleteModel(item)),modelActionButton('No','secondary',()=>{models.confirm=null;renderModels();}));
  }else if(state&&['queued','downloading'].includes(state.state)){
    actions.append(modelActionButton('Cancelar descarga','secondary',()=>cancelModel(item)));
  }else if(state&&['verifying','converting'].includes(state.state)){
    actions.append(modelActionButton('Verificando…','secondary',()=>{},true));
  }else if(item.active&&item.installed){
    // The active variant is shown by its badge and offers no actions.
  }else if(!item.installed&&item.downloadable){
    actions.append(modelActionButton('Descargar','secondary',()=>downloadModel(item),!item.canDownload));
  }else if(item.installed){
    const activate=modelActionButton('Activar','secondary',()=>activateModel(item),busy||loraBlocked);
    if(loraBlocked)activate.title='El modelo de difusión activo ya lleva el LoRA fusionado.';
    else if(busy)activate.title='Espera a que terminen la operación en curso.';
    const remove=modelActionButton('Borrar','secondary danger',()=>{models.confirm=item.id;renderModels();},busy||!item.canDelete);
    if(item.deleteBlock)remove.title=item.deleteBlock;
    actions.append(activate,remove);
  }
  row.append(info,size,actions);return row;
}
function renderModelsFooter(){
  const data=models.data;if(!data)return;
  const selection=data.pending||data.selection,required=selectionItems(selection);
  const missing=required.filter(item=>!item.installed);
  const total=required.reduce((sum,item)=>sum+(item.bytes||0),0),missingBytes=missing.reduce((sum,item)=>sum+(item.bytes||0),0);
  const disk=data.disk?` · ${sizeLabel(data.disk.freeBytes)} libres en disco`:'';
  $('#modelsDisk').textContent=data.ramGB?`${data.ramGB} GB de RAM${disk}`:disk.replace(/^ · /,'');
  $('#modelsSummary').textContent=`${data.pending?'Configuración pendiente':'Configuración activa'}: ${sizeLabel(total)}${missing.length?` · ${missing.length} archivo(s) por descargar (${sizeLabel(missingBytes)})`:' · todo instalado'}${disk}`;
  $('#modelsCancel').textContent='Cerrar';
}
async function refreshModels(){
  try{
    const data=await api('/api/models');models.data=data;if(!models.applying){state.modelsBusy=!!(data.downloading||data.pending);refreshForm();}
    if(data.pending)models.hadPending=true;
    else if(models.hadPending){
      models.hadPending=false;
      if(models.open)modelMessage('Modelos verificados. La nueva configuración está activa y el motor se ha recargado.');
      warmedKey=null;
    }
    if(models.open)renderModels();
  }catch(error){if(models.open)modelMessage(error.message,true);}
}
function scheduleModelPoll(delay=1500){
  clearTimeout(models.timer);
  models.timer=setTimeout(async()=>{
    if(!models.open)return;
    await refreshModels();
    const busy=models.data?.downloading||models.data?.pending||models.applying;
    scheduleModelPoll(busy?1200:5000);
  },delay);
}
async function openModels(){
  if(models.open)return;
  models.open=true;models.confirm=null;models.hadPending=false;modelMessage('');
  const dialog=$('#modelsDialog');
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  $('#modelsBody').replaceChildren(Object.assign(document.createElement('p'),{className:'hint',textContent:'Cargando el catálogo de modelos…'}));
  await refreshModels();
  scheduleModelPoll(1200);
}
function closeModels(){
  if(models.applying)return;
  models.open=false;clearTimeout(models.timer);models.confirm=null;
  const dialog=$('#modelsDialog');
  if(dialog.open)dialog.close();else dialog.removeAttribute('open');
}
async function downloadModel(item){
  try{await api('/api/models/download',{method:'POST',body:JSON.stringify({id:item.id})});state.modelsBusy=true;refreshForm();modelMessage(`Descargando ${item.short}. Puedes seguir usando la app; continuará en segundo plano.`);await refreshModels();scheduleModelPoll(600);}
  catch(error){modelMessage(error.message,true);}
}
async function cancelModel(item){
  try{await api('/api/models/cancel',{method:'POST',body:JSON.stringify({id:item.id})});modelMessage(`Descarga de ${item.short} cancelada. El archivo parcial se conserva para reanudarla.`);await refreshModels();}
  catch(error){modelMessage(error.message,true);}
}
async function deleteModel(item){
  try{
    await api('/api/models/delete',{method:'POST',body:JSON.stringify({id:item.id})});models.confirm=null;modelMessage(`${item.short} se borró del disco.`);await refreshModels();
  }
  catch(error){modelMessage(error.message,true);}
}
async function activateModel(item){
  if(!models.data||models.applying)return;
  models.applying=true;models.confirm=null;modelMessage(`Activando ${item.short}…`);renderModels();
  try{
    const selection={...models.data.selection,[item.role]:item.id};
    const result=await api('/api/models/select',{method:'POST',body:JSON.stringify({selection})});
    if(result.pending){
      models.hadPending=true;state.modelsBusy=true;refreshForm();
      modelMessage(`Faltan ${result.downloads.length} archivo(s). ${item.short} se activará automáticamente cuando terminen las descargas.`);
    }else{
      warmedKey=null;
      modelMessage(result.restarted?`${item.short} activado. El motor se está recargando.`:`${item.short} activado.`);
      if(result.restarted){state.modelsBusy=true;refreshForm();}else warmEngine();
    }
    await refreshModels();
  }catch(error){modelMessage(error.message,true);}
  finally{models.applying=false;renderModels();scheduleModelPoll(800);}
}
$('#models').onclick=openModels;
$('#modelsClose').onclick=closeModels;
$('#modelsCancel').onclick=closeModels;
$('#modelsDialog').addEventListener('close',()=>{models.open=false;clearTimeout(models.timer);models.confirm=null;});
$('#modelsDialog').addEventListener('cancel',event=>{if(models.applying)event.preventDefault();});
$('#modelsDialog').addEventListener('click',event=>{if(event.target===$('#modelsDialog'))closeModels();});

