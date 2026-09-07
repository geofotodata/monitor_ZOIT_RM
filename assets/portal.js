(() => {
  'use strict';
  const territoryId = document.body.dataset.territory;
  if (!territoryId) return;
  const publicApi = 'https://monitor-zoit-rm-public-api.monitor-zoit-rm.workers.dev';
  const state = { actions: [], query: '', status: 'Todas', line: 'Todas', page: 1, pageSize: 12 };
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const statusClass = (status) => ({ Terminada: 'done', 'En ejecución': 'doing', Pendiente: 'pending', 'Sin seguimiento': 'untracked' })[status] ?? 'untracked';

  function filteredActions() {
    const query = state.query.toLocaleLowerCase('es-CL');
    return state.actions.filter((action) => {
      const text = `${action.id} ${action.name} ${action.indicator} ${action.owner}`.toLocaleLowerCase('es-CL');
      return (state.status === 'Todas' || action.status === state.status) && (state.line === 'Todas' || action.line === state.line) && text.includes(query);
    });
  }

  function renderActions() {
    const filtered = filteredActions();
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = Math.min(state.page, pages);
    const visible = filtered.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
    $('results').innerHTML = `<strong>${filtered.length}</strong> acciones encontradas`;
    $('action-grid').innerHTML = visible.length ? visible.map((action) => `<details class="action-card"><summary><span class="status ${statusClass(action.status)}">${escapeHtml(action.status)}</span><small>Acción ${action.id}</small><h3>${escapeHtml(action.name)}</h3><p>${escapeHtml(action.line)}</p><strong>${action.status === 'Sin seguimiento' ? 'Avance no informado' : `${escapeHtml(action.progress)} de avance`}</strong></summary><div class="action-detail"><dl><div><dt>Responsable</dt><dd>${escapeHtml(action.owner || 'No informado')}</dd></div><div><dt>Indicador</dt><dd>${escapeHtml(action.indicator || 'No informado')}</dd></div><div><dt>Meta</dt><dd>${escapeHtml(action.goal || 'No informada')}</dd></div><div><dt>Medio de verificación</dt><dd>${escapeHtml(action.plannedVerifier || 'No informado')}</dd></div><div><dt>Presupuesto planificado</dt><dd>${escapeHtml(action.plannedBudget || 'No informado')}</dd></div><div><dt>Financiamiento</dt><dd>${escapeHtml(action.funding || 'No informado')}</dd></div></dl>${action.notes ? `<p class="note">${escapeHtml(action.notes)}</p>` : ''}</div></details>`).join('') : '<div class="empty"><strong>No hay resultados</strong><p>Modifica la búsqueda o elimina los filtros.</p></div>';
    $('pagination').innerHTML = pages > 1 ? `<button type="button" data-page="prev" ${state.page === 1 ? 'disabled' : ''}>← Anterior</button><span>Página <strong>${state.page}</strong> de ${pages}</span><button type="button" data-page="next" ${state.page === pages ? 'disabled' : ''}>Siguiente →</button>` : '';
  }

  function renderSummary(actions) {
    const statuses = ['Terminada', 'En ejecución', 'Pendiente', 'Sin seguimiento'];
    $('summary').innerHTML = `<article><span>Acciones del plan</span><strong>${actions.length}</strong><small>Registros publicados</small></article>${statuses.map((status) => `<button type="button" data-status="${escapeHtml(status)}"><span>${escapeHtml(status)}</span><strong>${actions.filter((action) => action.status === status).length}</strong><small>Consultar acciones →</small></button>`).join('')}`;
  }

  function renderGovernance(content) {
    $('governance-description').textContent = content.governanceDescription;
    $('governance-stats').innerHTML = content.governanceStats.map((stat) => `<article><span>${escapeHtml(stat.label)}</span><strong>${escapeHtml(stat.value)}</strong><small>${escapeHtml(stat.note)}</small></article>`).join('');
    $('governance-entities').innerHTML = content.governanceEntities.map((entity) => `<article><strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.category)}</span></article>`).join('');
    $('governance-notice').innerHTML = `<strong>${escapeHtml(content.governanceSource)}</strong><p>${escapeHtml(content.governanceNotice)}</p>`;
  }

  function renderDocuments(documents) {
    $('document-list').innerHTML = documents.length ? documents.map((document, index) => `<a class="document-card ${index === 0 ? 'primary-document' : ''}" href="${escapeHtml(document.href)}" target="_blank" rel="noreferrer"><span>${index === 0 ? 'Documento principal' : 'Antecedente'}</span><strong>${escapeHtml(document.title)}</strong><small>${escapeHtml(document.note)} ↗</small></a>`).join('') : '<div class="empty"><strong>No hay documentos publicados</strong><p>Los antecedentes se incorporarán después de validar su fuente.</p></div>';
  }

  async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error(`Solicitud no disponible (${response.status})`);
    return response.json();
  }

  async function renderMap(data, usePublishedMap) {
    if (!window.L) return;
    const map = L.map('map', { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    try {
      let geojson;
      if (usePublishedMap) {
        try { geojson = await fetchJson(`${publicApi}/api/map?territory=${encodeURIComponent(territoryId)}`); }
        catch { geojson = await fetchJson(`../data/${data.mapFile}`); }
      } else {
        geojson = await fetchJson(`../data/${data.mapFile}`);
      }
      const boundary = L.geoJSON(geojson, { style: { color: '#e63946', weight: 3, opacity: 0.95, fillColor: '#16826d', fillOpacity: 0.12 } }).addTo(map);
      L.control.layers({}, { 'Límite ZOIT': boundary }, { collapsed: false }).addTo(map);
      const bounds = boundary.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
    } catch {
      map.remove();
      $('map').innerHTML = '<p class="map-error">No fue posible cargar la cobertura territorial.</p>';
    }
  }

  async function loadPortal() {
    const staticData = await fetchJson(`../data/${territoryId}.json`);
    let data = staticData;
    let hasPublishedSnapshot = false;
    try {
      const published = await fetchJson(`${publicApi}/api/territory?territory=${encodeURIComponent(territoryId)}`);
      const publishedDocuments = (published.documents ?? []).map((document) => ({
        title: document.title,
        href: `${publicApi}/api/documents/${encodeURIComponent(document.id)}`,
        note: document.notes || (document.action_id ? `Acción ${document.action_id}` : 'Antecedente general'),
      }));
      data = {
        ...staticData,
        actions: Array.isArray(published.actions) && published.actions.length ? published.actions : staticData.actions,
        content: published.content ?? staticData.content,
        documents: [...staticData.documents, ...publishedDocuments],
      };
      hasPublishedSnapshot = true;
      if ($('publication-state') && published.publication?.published_at) {
        const date = new Date(published.publication.published_at);
        $('publication-state').textContent = `Versión publicada el ${new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`;
      }
    } catch {
      if ($('publication-state')) $('publication-state').textContent = `${staticData.freshness} · copia pública de respaldo`;
    }
    state.actions = data.actions;
    renderSummary(data.actions);
    const statuses = [...new Set(data.actions.map((action) => action.status))];
    const lines = [...new Set(data.actions.map((action) => action.line))].sort((a, b) => a.localeCompare(b, 'es-CL'));
    $('status').insertAdjacentHTML('beforeend', statuses.map((value) => `<option>${escapeHtml(value)}</option>`).join(''));
    $('line').insertAdjacentHTML('beforeend', lines.map((value) => `<option>${escapeHtml(value)}</option>`).join(''));
    renderActions(); renderGovernance(data.content); renderDocuments(data.documents); renderMap(data, hasPublishedSnapshot);
  }

  loadPortal().catch((error) => { $('action-grid').innerHTML = `<div class="empty"><strong>No fue posible cargar el portal</strong><p>${escapeHtml(error.message)}</p></div>`; });

  $('search').addEventListener('input', (event) => { state.query = event.target.value; state.page = 1; renderActions(); });
  $('status').addEventListener('change', (event) => { state.status = event.target.value; state.page = 1; renderActions(); });
  $('line').addEventListener('change', (event) => { state.line = event.target.value; state.page = 1; renderActions(); });
  $('clear').addEventListener('click', () => { state.query = ''; state.status = 'Todas'; state.line = 'Todas'; state.page = 1; $('search').value = ''; $('status').value = 'Todas'; $('line').value = 'Todas'; renderActions(); });
  $('summary').addEventListener('click', (event) => { const button = event.target.closest('[data-status]'); if (!button) return; state.status = button.dataset.status; state.page = 1; $('status').value = state.status; renderActions(); $('acciones').scrollIntoView({ behavior: 'smooth' }); });
  $('pagination').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (!button) return; state.page += button.dataset.page === 'next' ? 1 : -1; renderActions(); $('acciones').scrollIntoView({ behavior: 'smooth' }); });
})();
