(() => {
  'use strict';
  const territoryId = document.body.dataset.territory;
  if (!territoryId) return;
  const publicApi = 'https://monitor-zoit-rm-public-api.monitor-zoit-rm.workers.dev';
  const state = { actions: [], documents: [], query: '', status: 'Todas', line: 'Todas', page: 1, pageSize: 12 };
  const $ = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const statusClass = (status) => ({ Terminada: 'done', 'En ejecución': 'doing', Pendiente: 'pending', 'Sin seguimiento': 'untracked' })[status] ?? 'untracked';
  const statusLabel = (status) => ({ Terminada: 'Terminadas', 'En ejecución': 'En ejecución', Pendiente: 'Pendientes', 'Sin seguimiento': 'Sin seguimiento' })[status] ?? status;
  const parseProgress = (value) => {
    const parsed = Number(String(value ?? '').replace('%', '').replace(/\./g, '').replace(',', '.').trim());
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
  };
  const percentage = (value, total) => total ? `${(value / total * 100).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%` : '0%';

  function filteredActions() {
    const query = state.query.toLocaleLowerCase('es-CL');
    return state.actions.filter((action) => {
      const text = `${action.id} ${action.name} ${action.indicator} ${action.owner}`.toLocaleLowerCase('es-CL');
      return (state.status === 'Todas' || action.status === state.status) && (state.line === 'Todas' || action.line === state.line) && text.includes(query);
    });
  }

  function renderActionDocuments(actionId) {
    const documents = state.documents.filter((document) => Number(document.action_id) === Number(actionId));
    if (!documents.length) return '';
    return `<div class="action-documents"><strong>Verificadores publicados</strong>${documents.map((document) => `<a href="${escapeHtml(document.href)}" target="_blank" rel="noreferrer"><span>${escapeHtml(document.title)}</span><small>${escapeHtml(document.note || document.file_name || 'Abrir documento')} ↗</small></a>`).join('')}</div>`;
  }

  function renderActions() {
    const filtered = filteredActions();
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.page = Math.min(state.page, pages);
    const visible = filtered.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
    $('results').innerHTML = `<strong>${filtered.length}</strong> ${filtered.length === 1 ? 'acción encontrada' : 'acciones encontradas'}`;
    $('action-grid').innerHTML = visible.length ? visible.map((action) => {
      const progress = action.status === 'Sin seguimiento' ? null : parseProgress(action.progress);
      const progressLabel = progress === null ? 'Avance no informado' : `${escapeHtml(action.progress)} de avance`;
      return `<details class="action-card"><summary><div class="card-top"><span class="status ${statusClass(action.status)}">${escapeHtml(action.status)}</span><span class="action-number">Acción ${action.id}</span></div><h3>${escapeHtml(action.name)}</h3><p class="action-line">${escapeHtml(action.line)}</p><div class="action-progress"><div><strong>${progressLabel}</strong><span aria-hidden="true">＋</span></div>${progress === null ? '<div class="progress-track is-empty"><i></i></div>' : `<div class="progress-track" role="progressbar" aria-label="Avance informado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div>`}</div></summary><div class="action-detail"><dl><div><dt>Responsable</dt><dd>${escapeHtml(action.owner || 'No informado')}</dd></div><div><dt>Indicador</dt><dd>${escapeHtml(action.indicator || 'No informado')}</dd></div><div><dt>Meta</dt><dd>${escapeHtml(action.goal || 'No informada')}</dd></div><div><dt>Medio de verificación</dt><dd>${escapeHtml(action.plannedVerifier || 'No informado')}</dd></div><div><dt>Presupuesto planificado</dt><dd>${escapeHtml(action.plannedBudget || 'No informado')}</dd></div><div><dt>Financiamiento</dt><dd>${escapeHtml(action.funding || 'No informado')}</dd></div></dl>${renderActionDocuments(action.id)}${action.notes ? `<p class="note">${escapeHtml(action.notes)}</p>` : ''}</div></details>`;
    }).join('') : '<div class="empty"><strong>No hay resultados</strong><p>Modifica la búsqueda o elimina los filtros.</p></div>';
    $('pagination').innerHTML = pages > 1 ? `<button type="button" data-page="prev" ${state.page === 1 ? 'disabled' : ''}>← Anterior</button><span>Página <strong>${state.page}</strong> de ${pages}</span><button type="button" data-page="next" ${state.page === pages ? 'disabled' : ''}>Siguiente →</button>` : '';
    document.querySelectorAll('[data-status]').forEach((button) => {
      const selected = button.dataset.status === state.status;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function renderSummary(actions) {
    const statuses = ['Terminada', 'En ejecución', 'Pendiente', 'Sin seguimiento'];
    const totals = statuses.map((status) => ({ status, count: actions.filter((action) => action.status === status).length }));
    $('summary').innerHTML = `<article class="metric-card metric-total"><span>Acciones del plan</span><strong>${actions.length}</strong><small>Registros publicados</small></article>${totals.map(({ status, count }) => `<button class="metric-card metric-${statusClass(status)}" type="button" data-status="${escapeHtml(status)}" aria-label="${statusLabel(status)}: ${count} acciones, ${percentage(count, actions.length)} del plan"><span>${statusLabel(status)}</span><strong>${count}</strong><small>${percentage(count, actions.length)} del plan <b aria-hidden="true">→</b></small></button>`).join('')}`;
    $('status-distribution').innerHTML = `<div class="distribution-copy"><strong>Distribución del estado informado</strong><span>Cada segmento representa su proporción dentro del plan.</span></div><div class="distribution-track">${totals.filter(({ count }) => count > 0).map(({ status, count }) => `<button type="button" class="segment ${statusClass(status)}" data-status="${escapeHtml(status)}" style="width:${count / actions.length * 100}%" aria-label="Filtrar ${statusLabel(status)}: ${count} acciones"></button>`).join('')}</div><div class="distribution-legend">${totals.map(({ status, count }) => `<button type="button" data-status="${escapeHtml(status)}"><i class="${statusClass(status)}" aria-hidden="true"></i><span>${statusLabel(status)}</span><strong>${count}</strong></button>`).join('')}</div>`;
  }

  function renderGovernance(content) {
    $('governance-description').textContent = content.governanceDescription;
    $('governance-stats').innerHTML = content.governanceStats.map((stat) => `<article><span>${escapeHtml(stat.label)}</span><strong>${escapeHtml(stat.value)}</strong><small>${escapeHtml(stat.note)}</small></article>`).join('');
    $('governance-entities').innerHTML = content.governanceEntities.map((entity) => `<article><strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.category)}</span></article>`).join('');
    $('governance-notice').innerHTML = `<strong>${escapeHtml(content.governanceSource)}</strong><p>${escapeHtml(content.governanceNotice)}</p>`;
  }

  function renderDocuments(documents) {
    $('document-list').innerHTML = documents.length ? documents.map((document, index) => `<a class="document-card ${index === 0 ? 'primary-document' : ''}" href="${escapeHtml(document.href)}" target="_blank" rel="noreferrer"><span>${index === 0 ? 'Documento principal' : document.document_category === 'governance-minute' ? 'Acta de gobernanza' : document.action_id ? `Acción ${escapeHtml(document.action_id)}` : 'Antecedente general'}</span><strong>${escapeHtml(document.title)}</strong><small>${escapeHtml(document.note)} ↗</small></a>`).join('') : '<div class="empty"><strong>No hay documentos publicados</strong><p>Los antecedentes se incorporarán después de validar su fuente.</p></div>';
  }

  async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error(`Solicitud no disponible (${response.status})`);
    return response.json();
  }

  async function renderMap(data, usePublishedMap) {
    if (!window.L) return;
    const map = L.map('map', { scrollWheelZoom: false, keyboard: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    try {
      let geojson;
      if (usePublishedMap) {
        try { geojson = await fetchJson(`${publicApi}/api/map?territory=${encodeURIComponent(territoryId)}`); }
        catch { geojson = await fetchJson(`../data/${data.mapFile}`); }
      } else {
        geojson = await fetchJson(`../data/${data.mapFile}`);
      }
      const territoryColor = getComputedStyle(document.body).getPropertyValue('--territory').trim() || '#096b73';
      const boundary = L.geoJSON(geojson, { style: { color: territoryColor, weight: 4, opacity: 1, fillColor: territoryColor, fillOpacity: 0.18 } }).bindTooltip(`Límite ZOIT ${data.name}`, { sticky: true, direction: 'top' }).addTo(map);
      L.control.layers({}, { 'Límite ZOIT': boundary }, { collapsed: false }).addTo(map);
      const bounds = boundary.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
    } catch {
      map.remove();
      $('map').innerHTML = '<p class="map-error">No fue posible cargar la cobertura territorial.</p>';
    }
  }

  function selectStatus(status) {
    state.status = status;
    state.page = 1;
    $('status').value = status;
    renderActions();
    $('acciones').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function enableSectionNavigation() {
    if (!('IntersectionObserver' in window)) return;
    const links = [...document.querySelectorAll('.section-nav a')];
    const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => {
        const active = link.getAttribute('href') === `#${visible.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-28% 0px -62% 0px', threshold: [0, 0.1, 0.5] });
    sections.forEach((section) => observer.observe(section));
  }

  async function loadPortal() {
    const staticData = await fetchJson(`../data/${territoryId}.json`);
    let data = staticData;
    let hasPublishedSnapshot = false;
    try {
      const published = await fetchJson(`${publicApi}/api/territory?territory=${encodeURIComponent(territoryId)}`);
      const publishedDocuments = (published.documents ?? []).map((document) => ({
        action_id: document.action_id,
        document_category: document.document_category,
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
    state.documents = data.documents;
    renderSummary(data.actions);
    const statuses = [...new Set(data.actions.map((action) => action.status))];
    const lines = [...new Set(data.actions.map((action) => action.line))].sort((a, b) => a.localeCompare(b, 'es-CL'));
    $('status').insertAdjacentHTML('beforeend', statuses.map((value) => `<option>${escapeHtml(value)}</option>`).join(''));
    $('line').insertAdjacentHTML('beforeend', lines.map((value) => `<option>${escapeHtml(value)}</option>`).join(''));
    renderActions(); renderGovernance(data.content); renderDocuments(data.documents); renderMap(data, hasPublishedSnapshot); enableSectionNavigation();
  }

  loadPortal().catch((error) => { $('action-grid').innerHTML = `<div class="empty"><strong>No fue posible cargar el portal</strong><p>${escapeHtml(error.message)}</p></div>`; });

  $('search').addEventListener('input', (event) => { state.query = event.target.value; state.page = 1; renderActions(); });
  $('status').addEventListener('change', (event) => { state.status = event.target.value; state.page = 1; renderActions(); });
  $('line').addEventListener('change', (event) => { state.line = event.target.value; state.page = 1; renderActions(); });
  $('clear').addEventListener('click', () => { state.query = ''; state.status = 'Todas'; state.line = 'Todas'; state.page = 1; $('search').value = ''; $('status').value = 'Todas'; $('line').value = 'Todas'; renderActions(); });
  $('summary').addEventListener('click', (event) => { const button = event.target.closest('[data-status]'); if (button) selectStatus(button.dataset.status); });
  $('status-distribution').addEventListener('click', (event) => { const button = event.target.closest('[data-status]'); if (button) selectStatus(button.dataset.status); });
  $('pagination').addEventListener('click', (event) => { const button = event.target.closest('[data-page]'); if (!button) return; state.page += button.dataset.page === 'next' ? 1 : -1; renderActions(); $('acciones').scrollIntoView({ behavior: 'smooth' }); });
})();
