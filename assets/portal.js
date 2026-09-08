// Cambio UI: interactive public portals. Drafts and private storage never enter this client.
import { statuses, statusClass, normalize, escapeHtml as esc, progressValue, safeHref, linkedActions, actorCategory, filterActions, groupActions } from './portal-model.js';
const $ = (id) => document.getElementById(id);
const api = 'https://monitor-zoit-rm-public-api.monitor-zoit-rm.workers.dev';
const territoryId = document.body.dataset.territory;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const num = (n) => Number(n).toLocaleString('es-CL');
const code = (id) => 'ACC-' + String(id).padStart(3, '0');
const pct = (n, total) => total ? num(Math.round(n / total * 1000) / 10) + '%' : '0%';
const statusLabel = (s) => ({Terminada:'Terminadas',Pendiente:'Pendientes'})[s] || s;
const scrollTo = (id) => $(id)?.scrollIntoView({behavior:reduceMotion.matches?'instant':'smooth', block:'start'});
const state = {actions:[], documents:[], data:null, query:'', status:'Todas', line:'Todas', view:'line', page:1, actorIds:null, actorName:'', actorQuery:'', actorFilter:'Todas', actorView:window.matchMedia('(max-width: 760px)').matches?'directory':'network', selectedActor:null, expanded:new Set(), zoom:1, positions:new Map(), docQuery:'', docType:'all'};
async function fetchJson(url) {
  const response = await fetch(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(9000)});
  if (!response.ok) throw new Error('Información no disponible');
  return response.json();
}
const badge = (s) => '<span class="status ' + statusClass(s) + '"><i aria-hidden="true"></i>' + esc(s) + '</span>';
function distribution(actions, mini=false) {
  return '<div class="' + (mini?'mini-distribution':'distribution-track') + '" aria-hidden="true">' + statuses.map(s=>{
    const count=actions.filter(a=>a.status===s).length;
    return count ? '<span class="' + statusClass(s) + '" style="width:'+count/actions.length*100+'%"></span>':'';
  }).join('')+'</div>';
}
function progress(action) {
  const value=action.status==='Sin seguimiento'?null:progressValue(action.progress);
  return '<div class="action-progress"><span>'+ (value===null?'Avance no informado':num(value)+'% de avance informado') + '</span><div class="progress-track '+(value===null?'is-empty':'')+'" '+(value===null?'':'role="progressbar" aria-label="Avance informado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+value+'"')+'><i style="width:'+(value??0)+'%"></i></div></div>';
}
function card(action, compact=false) {
  const evidence=state.documents.filter(d=>Number(d.action_id)===action.id).length;
  return '<button type="button" class="action-card '+(compact?'compact':'')+'" data-action="'+action.id+'"><div class="card-top"><span class="action-number">'+code(action.id)+'</span>'+badge(action.status)+'</div><h3>'+esc(action.name)+'</h3><p class="action-owner">'+esc(action.owner||'Responsable no informado')+'</p>'+progress(action)+'<div class="card-bottom"><span>'+(evidence?evidence+' respaldo'+(evidence===1?'':'s'):'Consultar ficha')+'</span><span aria-hidden="true">↗</span></div></button>';
}
function syncUrl() {
  const u=new URL(location.href);
  for(const [key,value,empty] of [['q',state.query,''],['estado',state.status,'Todas'],['linea',state.line,'Todas'],['vista',state.view,'line']]) {
    if(value===empty) u.searchParams.delete(key); else u.searchParams.set(key,value);
  }
  history.replaceState(null,'',u);
}
function renderActions() {
  const filtered=filterActions(state.actions,state);
  $('results').innerHTML='<strong>'+filtered.length+'</strong> de '+state.actions.length+' acciones'+(state.actorName?' · Responsable: '+esc(state.actorName):'');
  $('active-actor').innerHTML=state.actorIds?'<button class="filter-chip selected" id="remove-actor" type="button">Responsable: '+esc(state.actorName)+' <span aria-hidden="true">×</span></button>':'';
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===state.view)));
  document.querySelectorAll('[data-status]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.status===state.status)));
  $('expand-groups').hidden=state.view!=='line'||!filtered.length;
  const groups=groupActions(filtered,'line');
  $('expand-groups').textContent=groups.every(g=>state.expanded.has(g.name))?'Contraer grupos':'Expandir grupos';
  $('action-grid').className=state.view==='status'?'status-board':state.view==='list'?'action-list':'action-groups';
  $('pagination').innerHTML='';
  if(!filtered.length) {
    $('action-grid').innerHTML='<div class="empty"><span aria-hidden="true">⌕</span><h3>No encontramos coincidencias</h3><p>Prueba otra palabra o restablece los filtros.</p><button class="secondary" data-reset type="button">Ver todas las acciones</button></div>';
  } else if(state.view==='line') {
    $('action-grid').innerHTML=groups.map((g,i)=>'<details class="action-group" data-group="'+esc(g.name)+'" '+(state.expanded.has(g.name)?'open':'')+'><summary><span class="group-index">'+String(i+1).padStart(2,'0')+'</span><div><h3>'+esc(g.name)+'</h3><span>'+g.items.length+' acciones en esta selección</span></div>'+distribution(g.items,true)+'<span class="group-count">'+g.items.length+'</span><span class="group-chevron" aria-hidden="true">⌄</span></summary><div class="group-cards">'+g.items.map(a=>card(a)).join('')+'</div></details>').join('');
    $('action-grid').querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)state.expanded.add(d.dataset.group);else state.expanded.delete(d.dataset.group);$('expand-groups').textContent=groups.every(g=>state.expanded.has(g.name))?'Contraer grupos':'Expandir grupos';}));
  } else if(state.view==='status') {
    $('action-grid').innerHTML=statuses.map(s=>{const items=filtered.filter(a=>a.status===s);return '<section class="status-column"><div class="column-header">'+badge(s)+'<strong>'+items.length+'</strong></div><div class="column-cards">'+(items.length?items.map(a=>card(a)).join(''):'<p class="column-empty">Sin acciones en este estado.</p>')+'</div></section>';}).join('');
  } else {
    const pages=Math.max(1,Math.ceil(filtered.length/12)); state.page=Math.min(state.page,pages);
    $('action-grid').innerHTML=filtered.slice((state.page-1)*12,state.page*12).map(a=>card(a,true)).join('');
    if(pages>1)$('pagination').innerHTML='<button class="secondary" type="button" data-page="-1" '+(state.page===1?'disabled':'')+'>← Anterior</button><span>Página '+state.page+' de '+pages+'</span><button class="secondary" type="button" data-page="1" '+(state.page===pages?'disabled':'')+'>Siguiente →</button>';
  }
}
function renderSummary() {
  $('hero-count').textContent=state.actions.length;
  $('hero-lines').textContent=new Set(state.actions.map(a=>a.line)).size;
  $('hero-actors').textContent=state.data.content.governanceEntities.length;
  $('summary').innerHTML='<article class="metric-card total"><span>Total del plan</span><strong>'+state.actions.length+'</strong><small>Acciones registradas</small></article>'+statuses.map(s=>{
    const count=state.actions.filter(a=>a.status===s).length;
    return '<button type="button" class="metric-card '+statusClass(s)+'" data-status="'+esc(s)+'" aria-pressed="false"><span>'+statusLabel(s)+'</span><strong>'+count+'</strong><small>'+pct(count,state.actions.length)+' del plan <b aria-hidden="true">↗</b></small><span class="metric-tip">Ver '+count+' acciones · '+statusLabel(s).toLowerCase()+'</span></button>';
  }).join('');
  $('status-distribution').innerHTML='<div><strong>Distribución del estado informado</strong><span>'+state.actions.length+' acciones · selecciona un estado para explorar</span></div>'+distribution(state.actions)+'<div class="distribution-legend">'+statuses.map(s=>'<button data-status="'+esc(s)+'" type="button" aria-pressed="false">'+badge(s)+'<strong>'+state.actions.filter(a=>a.status===s).length+'</strong></button>').join('')+'</div>';
}
function resetActions() { Object.assign(state,{query:'',status:'Todas',line:'Todas',actorIds:null,actorName:'',page:1}); $('search').value='';$('status').value='Todas';$('line').value='Todas';syncUrl();renderActions(); }
let previousActionUrl=null;
function openAction(id) {
  const action=state.actions.find(a=>a.id===Number(id));if(!action)return;
  const dialog=$('action-dialog');
  if(!dialog.open)previousActionUrl=location.href;
  $('dialog-code').textContent=code(action.id)+' / '+state.data.name;
  const fields=[['Responsable',action.owner],['Indicador',action.indicator],['Meta',action.goal],['Medio de verificación planificado',action.plannedVerifier],['Verificador informado',action.existingVerifier],['Presupuesto planificado',action.plannedBudget],['Financiamiento',action.funding],['Presupuesto ejecutado informado',action.executedBudget],['Fuente de evidencia',action.evidenceSource]];
  const documents=state.documents.filter(d=>Number(d.action_id)===action.id);
  $('dialog-body').innerHTML=badge(action.status)+'<h2 id="dialog-title">'+esc(action.name)+'</h2><p class="dialog-line">'+esc(action.line)+'</p>'+progress(action)+'<dl class="detail-fields">'+fields.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+esc(value||'No informado en la fuente')+'</dd></div>').join('')+(Array.isArray(action.planned)&&action.planned.some(Boolean)?'<details class="detail-schedule"><summary>Programación y ejecución informadas</summary><div class="schedule-scroll"><table><thead><tr><th>Registro de la fuente</th>'+action.planned.map((_,i)=>'<th>Periodo '+(i+1)+'</th>').join('')+'</tr></thead><tbody><tr><th>Planificado</th>'+action.planned.map(v=>'<td>'+esc(v||'No informado')+'</td>').join('')+'</tr><tr><th>Logrado</th>'+action.planned.map((_,i)=>'<td>'+esc(action.achieved?.[i]||'No informado')+'</td>').join('')+'</tr></tbody></table></div></details>':'')+(action.notes?'<div class="note"><strong>Notas publicadas</strong><p>'+esc(action.notes)+'</p></div>':'')+'<section class="action-documents"><h3>Documentos de respaldo</h3>'+(documents.length?documents.map(d=>'<a href="'+safeHref(d.href)+'" target="_blank" rel="noreferrer">'+esc(d.title)+' ↗</a>').join(''):'<p>Aún no hay archivos publicados vinculados a esta acción. La descripción del medio de verificación no equivale a un archivo adjunto.</p>')+'</section><a class="text-link" href="'+safeHref(state.data.sourceHref)+'" target="_blank" rel="noreferrer">Consultar fuente del plan ↗</a>';
  $('copy-state').textContent='';
  const u=new URL(location.href);u.searchParams.set('accion',action.id);u.hash='acciones';history.replaceState(null,'',u);
  if(!dialog.open)dialog.showModal();
  document.body.classList.add('dialog-open');$('dialog-close').focus();
}
function renderDocuments() {
  const docs=state.documents.filter(d=>(state.docType==='all'||(d.document_category||'general')===state.docType)&&normalize([d.title,d.note, d.action_id?code(d.action_id):''].join(' ')).includes(normalize(state.docQuery)));
  $('document-count').textContent=docs.length+' documento'+(docs.length===1?'':'s')+' disponible'+(docs.length===1?'':'s');
  $('document-list').innerHTML=docs.length?docs.map((d,i)=>'<a class="document-card" href="'+safeHref(d.href)+'" target="_blank" rel="noreferrer"><span class="document-icon" aria-hidden="true">↗</span><div><span class="kicker">'+(d.document_category==='governance-minute'?'Acta de gobernanza':d.action_id?'Verificador · '+code(d.action_id):'Documentación general')+'</span><h3>'+esc(d.title)+'</h3><p>'+esc(d.note||'Documento publicado')+'</p><small>'+(d.size?num(Math.round(d.size/1024))+' KB · ':'')+'Abrir documento ↗</small></div></a>').join(''):'<div class="empty"><h3>Sin documentos para esta selección</h3><p>Prueba otra búsqueda o tipo de documento.</p></div>';
}
function actorMatches() {return state.data.content.governanceEntities.map((e,id)=>({...e,id})).filter(e=>(state.actorFilter==='Todas'||actorCategory(e)===state.actorFilter)&&normalize(e.name).includes(normalize(state.actorQuery)));}
function categoryIndex(entity) {return [...new Set(state.data.content.governanceEntities.map(actorCategory))].indexOf(actorCategory(entity))%5;}
function renderActorDetail() {
  const entity=state.data.content.governanceEntities[state.selectedActor];
  if(!entity) {$('actor-detail').innerHTML='<span class="detail-symbol" aria-hidden="true">◎</span><p class="kicker">Explora la gobernanza</p><h3>Cada actor tiene un lugar.</h3><p>Selecciona una entidad para ver su categoría y las coincidencias con responsables de acciones.</p><div class="selection-hint">También puedes recorrer el directorio con el teclado.</div>';return;}
  const linked=linkedActions(entity,state.actions);
  $('actor-detail').innerHTML='<span class="actor-avatar tone-'+categoryIndex(entity)+'">'+esc(entity.name.split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join(''))+'</span><p class="kicker">Entidad identificada</p><h3>'+esc(entity.name)+'</h3><span class="category-label tone-'+categoryIndex(entity)+'">'+esc(actorCategory(entity))+'</span>'+(actorCategory(entity)!==entity.category?'<p>Referencia de la fuente: '+esc(entity.category)+'.</p>':'')+'<div class="actor-related"><strong>'+linked.length+'</strong><span>acciones con coincidencia exacta<br>en el campo responsable</span></div>'+(linked.length?'<button type="button" id="actor-actions" class="primary">Explorar estas acciones ↗</button><div class="actor-action-links">'+linked.slice(0,3).map(a=>'<button type="button" data-action="'+a.id+'"><small>'+code(a.id)+'</small>'+esc(a.name)+'</button>').join('')+'</div>':'<p class="data-caption">Sin coincidencias exactas en los responsables publicados. Esto no implica ausencia de participación; las abreviaturas pueden diferir.</p>')+'<small class="data-caption">Categorías conservadas según la fuente. No se infiere influencia ni representatividad.</small>';
}
let networkScale=1, lastDragEnd=0;
function fitNetwork() {
  if($('network-panel').hidden)return;
  networkScale=Math.max(.28,($('network-viewport').clientWidth-4)/940)*state.zoom;
  const scene=$('network-scene');
  if(scene)scene.style.transform='scale('+networkScale+')';
  $('actor-network').style.width=940*networkScale+'px';$('actor-network').style.height=690*networkScale+'px';
}
function networkPath(x,y) {return 'M470,345 Q'+(x<470?400:540)+','+y+' '+x+','+y;}
function renderActors() {
  const all=state.data.content.governanceEntities, categories=[...new Set(all.map(actorCategory))], entities=actorMatches();
  $('actor-filters').innerHTML=['Todas',...categories].map((c,i)=>'<button type="button" class="filter-chip '+(state.actorFilter===c?'selected':'')+'" data-actor-category="'+esc(c)+'" aria-pressed="'+(state.actorFilter===c)+'">'+(i?'<i class="tone-'+((i-1)%5)+'"></i>':'')+esc(c)+' <b>'+(c==='Todas'?all.length:all.filter(e=>actorCategory(e)===c).length)+'</b></button>').join('');
  $('actor-count').textContent=entities.length+' de '+all.length+' entidades · selecciona para explorar';
  if(!entities.some(e=>e.id===state.selectedActor))state.selectedActor=null;
  document.querySelectorAll('[data-actor-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.actorView===state.actorView)));
  $('network-panel').hidden=state.actorView!=='network';$('actor-directory').hidden=state.actorView!=='directory';
  $('actor-directory').innerHTML=entities.length?entities.map(e=>'<button type="button" class="actor-tile '+(e.id===state.selectedActor?'selected':'')+'" data-actor="'+e.id+'" aria-pressed="'+(e.id===state.selectedActor)+'"><span class="actor-avatar tone-'+categoryIndex(e)+'">'+esc(e.name.split(' ').filter(Boolean).map(w=>w[0]).slice(0,2).join(''))+'</span><span><strong>'+esc(e.name)+'</strong><small>'+esc(actorCategory(e))+'</small></span><span aria-hidden="true">↗</span></button>').join(''):'<div class="empty"><h3>No hay coincidencias</h3><p>Prueba otra entidad o categoría.</p></div>';
  const rows=Math.ceil(entities.length/4), gap=Math.min(85,560/Math.max(1,rows-1));
  const nodes=entities.map((e,i)=>{
    const col=i%4,row=Math.floor(i/4),pos=state.positions.get(e.id)||{x:[95,285,655,845][col],y:rows===1?345:65+row*gap}; return {...e,...pos};
  });
  $('actor-network').innerHTML='<div id="network-scene" class="network-scene"><svg class="network-edges" viewBox="0 0 940 690" aria-hidden="true">'+nodes.map(e=>'<path data-edge="'+e.id+'" d="'+networkPath(e.x,e.y)+'" class="'+(e.id===state.selectedActor?'selected':'')+'"/>').join('')+'</svg><div class="network-hub"><span>ENTIDADES</span><strong>Plan ZOIT</strong><small>'+esc(state.data.name)+'</small></div>'+nodes.map(e=>'<button type="button" class="actor-node tone-'+categoryIndex(e)+' '+(e.id===state.selectedActor?'selected':'')+'" data-actor="'+e.id+'" aria-pressed="'+(e.id===state.selectedActor)+'" title="'+esc(e.name)+'" style="left:'+e.x+'px;top:'+e.y+'px"><i aria-hidden="true"></i><span>'+esc(e.name)+'</span></button>').join('')+(!nodes.length?'<p class="network-empty">Sin entidades para este filtro.</p>':'')+'</div>';
  renderActorDetail();fitNetwork();
}
function selectActor(id) {
  state.selectedActor=Number(id);
  document.querySelectorAll('[data-actor]').forEach(b=>{const active=Number(b.dataset.actor)===state.selectedActor;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('[data-edge]').forEach(e=>e.classList.toggle('selected',Number(e.dataset.edge)===state.selectedActor));
  renderActorDetail();
  if(window.matchMedia('(max-width: 900px)').matches){scrollTo('actor-detail');$('actor-detail').focus({preventScroll:true});}
}
function initGovernance() {
  const content=state.data.content;
  $('governance-description').textContent=content.governanceDescription||'';
  $('governance-stats').innerHTML=(content.governanceStats||[]).map(s=>'<article><span>'+esc(s.label)+'</span><strong>'+esc(s.value)+'</strong><small>'+esc(s.note)+'</small></article>').join('');
  $('governance-notice').innerHTML='<strong>'+esc(content.governanceSource||'Fuente del plan')+'</strong><p>'+esc(content.governanceNotice||'Representantes personales no informados.')+'</p>';
  renderActors();
  new ResizeObserver(fitNetwork).observe($('network-viewport'));
  // Cambio UI: keyboard alternative to dragging; Enter keeps native node selection.
  $('actor-network').addEventListener('keydown',e=>{
    const node=e.target.closest('.actor-node');
    const delta={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,-15],ArrowDown:[0,15]}[e.key];
    if(!node||!delta)return;
    e.preventDefault();const id=Number(node.dataset.actor);
    const x=Math.max(85,Math.min(855,parseFloat(node.style.left)+delta[0]));
    const y=Math.max(30,Math.min(655,parseFloat(node.style.top)+delta[1]));
    node.style.left=x+'px';node.style.top=y+'px';state.positions.set(id,{x,y});
    $('actor-network').querySelector('[data-edge="'+id+'"]').setAttribute('d',networkPath(x,y));
  });
  $('actor-network').addEventListener('pointerdown',e=>{
    const node=e.target.closest('.actor-node');if(!node||e.button!==0)return;
    const id=Number(node.dataset.actor),start={x:e.clientX,y:e.clientY,left:parseFloat(node.style.left),top:parseFloat(node.style.top)};let moved=false;
    node.setPointerCapture(e.pointerId);
    const move=(ev)=>{const dx=(ev.clientX-start.x)/networkScale,dy=(ev.clientY-start.y)/networkScale;if(Math.abs(dx)+Math.abs(dy)<5&&!moved)return;moved=true;node.classList.add('dragging');const x=Math.max(85,Math.min(855,start.left+dx)),y=Math.max(30,Math.min(655,start.top+dy));node.style.left=x+'px';node.style.top=y+'px';state.positions.set(id,{x,y});$('actor-network').querySelector('[data-edge="'+id+'"]').setAttribute('d',networkPath(x,y));};
    const end=()=>{node.classList.remove('dragging');if(moved)lastDragEnd=Date.now();node.removeEventListener('pointermove',move);node.removeEventListener('pointerup',end);node.removeEventListener('pointercancel',end);};
    node.addEventListener('pointermove',move);node.addEventListener('pointerup',end);node.addEventListener('pointercancel',end);
  });
}
async function renderMap() {
  if(!window.L){$('map-state').textContent='El mapa no pudo iniciarse. Recarga para reintentar.';return;}
  const map=window.L.map('map',{scrollWheelZoom:false});
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  window.L.control.scale({imperial:false}).addTo(map);
  try {
    let geojson,live=false;
    try {if(!state.published?.publication?.map_published)throw Error('Sin cobertura publicada');geojson=await fetchJson(api+'/api/map?territory='+territoryId);live=true;}
    catch {geojson=await fetchJson('../data/'+state.data.mapFile);}
    const color=getComputedStyle(document.body).getPropertyValue('--territory').trim();
    const label=document.createElement('span');label.textContent='Límite ZOIT '+state.data.name;
    const layer=window.L.geoJSON(geojson,{style:{color,weight:3,fillColor:color,fillOpacity:.2}}).bindTooltip(label,{sticky:true}).addTo(map);
    const bounds=layer.getBounds(); const fit=()=>{if(bounds.isValid())map.fitBounds(bounds,{padding:[24,24],animate:!reduceMotion.matches});};fit();
    $('map-fit').onclick=fit;
    $('map-layer').onchange=(e)=>{if(e.target.checked)layer.addTo(map);else map.removeLayer(layer);};
    $('map-opacity').oninput=(e)=>layer.setStyle({fillOpacity:Number(e.target.value)/100});
    const content=state.data.content;
    $('map-source').textContent=live?(content.mapSource||state.data.mapSource):state.data.mapSource;
    $('map-area').textContent=live?(content.mapArea||state.data.mapArea):state.data.mapArea;
    $('map-state').textContent=live?'Cobertura de la versión publicada':'Cobertura de respaldo · fuente versionada';
    new ResizeObserver(()=>map.invalidateSize()).observe($('map'));
  } catch {map.remove();$('map').innerHTML='<div class="empty"><h3>Cobertura no disponible</h3><p>Recarga el portal para reintentar.</p></div>';$('map-state').textContent='No se pudo cargar la geometría.';}
}
function navigation() {
  const links=[...document.querySelectorAll('.section-nav a')],sections=links.map(l=>document.querySelector(l.hash));
  let ticking=false;
  window.addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{let active=sections[0];sections.forEach(s=>{if(s.getBoundingClientRect().top<=180)active=s;});links.forEach(l=>{if(l.hash==='#'+active.id)l.setAttribute('aria-current','location');else l.removeAttribute('aria-current');});ticking=false;});},{passive:true});
}
async function loadPortal() {
  const fallback=await fetchJson('../data/'+territoryId+'.json');state.data=fallback;
  try {
    const published=await fetchJson(api+'/api/territory?territory='+territoryId);
    if(!Array.isArray(published.actions)||!published.actions.length)throw Error('Sin registros');
    state.published=published;
    state.data={...fallback,actions:published.actions,content:{...fallback.content,...published.content},documents:[...fallback.documents,...(published.documents||[]).map(d=>({...d,href:api+'/api/documents/'+encodeURIComponent(d.id),note:d.notes||'Documento publicado por el moderador'}))]};
    $('publication-state').textContent='Publicación · '+new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(published.publication.published_at));
  } catch {$('publication-state').textContent='Copia pública de respaldo · última publicación no disponible';document.body.classList.add('is-fallback');}
  state.actions=state.data.actions;state.documents=state.data.documents;
  const params=new URL(location.href).searchParams;
  const lines=[...new Set(state.actions.map(a=>a.line))];
  state.query=params.get('q')||'';state.status=statuses.includes(params.get('estado'))?params.get('estado'):'Todas';state.line=lines.includes(params.get('linea'))?params.get('linea'):'Todas';state.view=['line','status','list'].includes(params.get('vista'))?params.get('vista'):'line';
  $('search').value=state.query;
  $('status').insertAdjacentHTML('beforeend',statuses.map(s=>'<option>'+esc(s)+'</option>').join(''));
  $('line').insertAdjacentHTML('beforeend',lines.map(l=>'<option>'+esc(l)+'</option>').join(''));
  $('status').value=state.status;$('line').value=state.line;
  state.expanded.add(state.line==='Todas'?lines[0]:state.line);
  renderSummary();renderActions();initGovernance();renderDocuments();navigation();
  const mapObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){mapObserver.disconnect();renderMap();}},{rootMargin:'300px'});
  mapObserver.observe($('mapa'));
  if(params.has('accion'))openAction(params.get('accion'));
  if(location.hash==='#documentacion')scrollTo('documentos');
}
async function loadDirectory() {
  const ids=['san-jose-de-maipo','pirque','isla-de-maipo'];
  const results=await Promise.allSettled(ids.map(id=>fetchJson(api+'/api/territory?territory='+id)));
  let total=0,live=0;
  results.forEach((result,i)=>{const el=document.querySelector('[data-card="'+ids[i]+'"] [data-territory-count]');if(result.status==='fulfilled'&&Array.isArray(result.value.actions)){el.textContent=result.value.actions.length;live++;}total+=Number(el.textContent);});
  $('regional-actions').textContent=total;
  $('directory-state').textContent=live===3?'Recuentos de las últimas publicaciones de los tres territorios.':live+' de 3 territorios consultados en vivo; el resto muestra la copia pública de respaldo.';
}
if(territoryId) {
  loadPortal().catch(()=>{$('action-grid').innerHTML='<div class="empty"><h3>No fue posible cargar las acciones</h3><p>Recarga la página para reintentar.</p></div>';$('publication-state').textContent='Información temporalmente no disponible';});
  $('territory-switch').addEventListener('change',e=>{const allowed=['san-jose-de-maipo','pirque','isla-de-maipo'];if(allowed.includes(e.target.value))location.href='../'+e.target.value+'/'+location.hash;});
  $('search').addEventListener('input',e=>{state.query=e.target.value;state.page=1;syncUrl();renderActions();});
  for(const id of ['status','line'])$(id).addEventListener('change',e=>{state[id]=e.target.value;state.page=1;if(id==='line')state.expanded.add(e.target.value);syncUrl();renderActions();});
  $('clear').addEventListener('click',resetActions);
  $('expand-groups').addEventListener('click',()=>{const groups=groupActions(filterActions(state.actions,state),'line');const all=groups.every(g=>state.expanded.has(g.name));groups.forEach(g=>all?state.expanded.delete(g.name):state.expanded.add(g.name));renderActions();});
  $('actor-search').addEventListener('input',e=>{state.actorQuery=e.target.value;renderActors();});
  $('network-more').onclick=()=>{state.zoom=Math.min(1.8,state.zoom+.2);fitNetwork();};
  $('network-less').onclick=()=>{state.zoom=Math.max(.6,state.zoom-.2);fitNetwork();};
  $('network-reset').onclick=()=>{state.zoom=1;state.positions.clear();renderActors();};
  $('document-search').addEventListener('input',e=>{state.docQuery=e.target.value;renderDocuments();});
  $('document-type').addEventListener('change',e=>{state.docType=e.target.value;renderDocuments();});
  $('dialog-close').onclick=()=>$('action-dialog').close();
  $('action-dialog').addEventListener('click',e=>{if(e.target===$('action-dialog')){const r=$('action-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('action-dialog').close();}});
  $('action-dialog').addEventListener('close',()=>{document.body.classList.remove('dialog-open');const u=new URL(previousActionUrl||location.href);u.searchParams.delete('accion');history.replaceState(null,'',u);});
  $('copy-action').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('copy-state').textContent='Enlace copiado';}catch{$('copy-state').textContent='Copia la dirección desde la barra del navegador.';}};
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.action)openAction(b.dataset.action);
    else if(b.dataset.status){state.status=b.dataset.status;state.page=1;$('status').value=state.status;syncUrl();renderActions();scrollTo('acciones');}
    else if(b.dataset.view){state.view=b.dataset.view;syncUrl();renderActions();}
    else if(b.dataset.page){state.page+=Number(b.dataset.page);renderActions();scrollTo('acciones');}
    else if(b.hasAttribute('data-reset')||b.id==='remove-actor')resetActions();
    else if(b.dataset.actorCategory){state.actorFilter=b.dataset.actorCategory;state.positions.clear();renderActors();}
    else if(b.dataset.actorView){state.actorView=b.dataset.actorView;renderActors();}
    else if(b.hasAttribute('data-actor')&&Date.now()-lastDragEnd>200)selectActor(b.dataset.actor);
    else if(b.id==='actor-actions'){const entity=state.data.content.governanceEntities[state.selectedActor];resetActions();state.actorIds=linkedActions(entity,state.actions).map(a=>a.id);state.actorName=entity.name;groupActions(filterActions(state.actions,state),'line').forEach(g=>state.expanded.add(g.name));renderActions();scrollTo('acciones');}
  });
} else if(document.body.dataset.directory)loadDirectory();
