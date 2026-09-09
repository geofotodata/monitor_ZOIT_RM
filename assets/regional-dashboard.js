import {statuses,statusClass,escapeHtml as esc,validPublicActions,summarizeRegions} from './portal-model.js?v=20260909';
const ids=['san-jose-de-maipo','pirque','isla-de-maipo'];
const names=['San José de Maipo','Pirque','Isla de Maipo'];
const api='https://monitor-zoit-rm-public-api.monitor-zoit-rm.workers.dev';
const $=id=>document.getElementById(id);
const number=n=>Number(n).toLocaleString('es-CL',{maximumFractionDigits:1});
const state={regions:[],territory:'Todas',status:'Todas',mode:'count'};
async function json(url){const r=await fetch(url,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('Fuente no disponible');return r.json();}
async function loadRegion(id,i){
  const base={id,name:names[i],actions:null,source:'unavailable',publishedAt:null};
  try{const p=await json(api+'/api/territory?territory='+id);if(!validPublicActions(p.actions))throw Error('Registros no válidos');return {...base,actions:p.actions,source:'live',publishedAt:p.publication?.published_at};}
  catch{try{const p=await json('./data/'+id+'.json');if(!validPublicActions(p.actions))throw Error('Respaldo no válido');return {...base,actions:p.actions,source:'fallback'};}catch{return base;}}
}
const href=(id,status='Todas')=>'./'+id+'/'+(status==='Todas'?'':'?estado='+encodeURIComponent(status))+'#acciones';
function sourceLabel(r){
  if(r.source==='unavailable')return 'Datos no disponibles';
  if(r.source==='fallback')return 'Copia de respaldo · publicación no disponible';
  if(!r.publishedAt)return 'Versión publicada · fecha no disponible';
  const date=new Date(r.publishedAt);
  return Number.isNaN(date.getTime())?'Versión publicada · fecha no disponible':'Publicado: '+new Intl.DateTimeFormat('es-CL',{dateStyle:'medium',timeZone:'America/Santiago'}).format(date);
}
function render(){
  const summary=summarizeRegions(state.regions,state.territory);
  const regions=state.regions.filter(r=>state.territory==='Todas'||r.id===state.territory);
  const max=Math.max(1,...regions.map(r=>r.actions?.length||0));
  const selected=state.status==='Todas'?summary.total:summary.counts[state.status];
  $('regional-kpis').innerHTML=[['Todas','Acciones del plan',summary.total],...statuses.map(s=>[s,s,summary.counts[s]])].map(([s,label,count])=>`<button type="button" class="regional-kpi ${s==='Todas'?'total':statusClass(s)}" data-regional-status="${esc(s)}" aria-pressed="${state.status===s}"><span>${label}</span><strong>${summary.available?number(count):'—'}</strong><small>${s==='Todas'?'En los territorios seleccionados':summary.total?number(count/summary.total*100)+'% de los registros':'Sin base para calcular'}</small></button>`).join('');
  $('regional-selection').textContent=(summary.available?number(selected)+' acciones':'Sin registros disponibles')+' · '+(state.status==='Todas'?'todos los estados':state.status)+(summary.missing?' · '+summary.missing+' territorio(s) sin datos':'');
  document.querySelectorAll('[data-regional-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.regionalMode===state.mode)));
  $('regional-comparison').innerHTML=regions.map((r)=>{
    if(!validPublicActions(r.actions))return `<article class="regional-row"><h3>${r.name}</h3><p>Información temporalmente no disponible. No se contabiliza como cero.</p><a href="${href(r.id)}">Abrir portal ↗</a></article>`;
    const counts=summarizeRegions([r]).counts,total=r.actions.length;
    const base=state.mode==='percent'?total:max;
    return `<article class="regional-row"><div class="regional-row-heading"><div><h3><a href="${href(r.id,state.status)}">${r.name} ↗</a></h3><small>${esc(sourceLabel(r))}</small></div><span><strong>${state.status==='Todas'?total:counts[state.status]}</strong> ${state.status==='Todas'?'acciones':esc(state.status.toLowerCase())}</span></div>
      <div class="regional-bars" aria-label="Distribución de estados en ${r.name}">${statuses.map(s=>counts[s]?`<a class="regional-segment ${statusClass(s)} ${state.status!=='Todas'&&state.status!==s?'is-muted':''}" style="width:${counts[s]/base*100}%" href="${href(r.id,s)}" aria-label="${r.name}: ${counts[s]} acciones ${esc(s)}, ${number(counts[s]/total*100)} por ciento; consultar acciones" data-tip="${esc(s)} · ${counts[s]} acciones · ${number(counts[s]/total*100)}%"><span>${state.mode==='percent'?number(counts[s]/total*100)+'%':counts[s]}</span></a>`:'').join('')}</div>
      <div class="regional-counts">${statuses.map(s=>`<a class="${state.status===s?'is-selected':''}" href="${href(r.id,s)}"><i class="${statusClass(s)}" aria-hidden="true"></i>${esc(s)} <b>${counts[s]}</b></a>`).join('')}</div></article>`;
  }).join('');
  $('regional-scale').textContent=state.mode==='percent'?'Cada barra representa el 100% de las acciones de su territorio.':'Escala común de recuentos: 0 a '+max+' acciones. Los territorios conservan su cantidad real.';
  $('regional-source').textContent=state.regions.filter(r=>r.source==='live').length+' de 3 territorios consultados en la publicación del administrador. '+(state.regions.some(r=>r.source!=='live')?'Las fuentes alternativas o no disponibles se identifican en cada fila.':'Solo contenido publicado; no incluye borradores.');
}
export async function initRegionalDashboard(){
  $('regional-territory').addEventListener('change',e=>{state.territory=e.target.value;render();});
  $('regional-dashboard').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.regionalStatus){state.status=b.dataset.regionalStatus;render();document.querySelector('[data-regional-status="'+state.status+'"]').focus({preventScroll:true});}if(b.dataset.regionalMode){state.mode=b.dataset.regionalMode;render();}});
  state.regions=await Promise.all(ids.map(loadRegion));
  state.regions.forEach(r=>{const el=document.querySelector(`[data-card="${r.id}"] [data-territory-count]`);if(el)el.textContent=r.actions?.length??'—';});
  const summary=summarizeRegions(state.regions);
  $('regional-actions').textContent=summary.available?summary.total:'—';
  $('directory-state').textContent=summary.missing?'El total excluye territorios sin datos disponibles.':'Recuentos según las fuentes identificadas en el panorama regional.';
  render();
}
