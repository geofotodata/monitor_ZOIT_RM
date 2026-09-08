// Shared, source-grounded calculations for the public portal.
export const statuses = ['Terminada', 'En ejecución', 'Pendiente', 'Sin seguimiento'];
export const statusClass = (status) => ({ Terminada: 'done', 'En ejecución': 'doing', Pendiente: 'pending' })[status] || 'untracked';
export const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CL').replace(/\s+/g, ' ').trim();
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
export function progressValue(value) {
  const clean = String(value ?? '').trim().replace(/%$/, '').trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(clean)) return null;
  const number = Number(clean.replace(',', '.'));
  return number >= 0 && number <= 100 ? number : null;
}
export function safeHref(value) {
  try {
    const url = new URL(String(value), 'https://portal.example/');
    return ['https:', 'http:'].includes(url.protocol) ? escapeHtml(value) : '#';
  } catch { return '#'; }
}
export function linkedActions(entity, actions) {
  // Only exact normalized names in the responsible field count; no inferred aliases.
  return actions.filter((action) => String(action.owner ?? '').split(/[\/;\n]/).some((owner) => normalize(owner) === normalize(entity.name)));
}
export function actorCategory(entity) {
  return /acciones? vinculad/.test(normalize(entity.category)) ? 'Sin clasificación sectorial' : (entity.category || 'Sin clasificación sectorial');
}
export function filterActions(actions, filters) {
  const query = normalize(filters.query);
  return actions.filter((a) => (filters.status === 'Todas' || a.status === filters.status)
    && (filters.line === 'Todas' || a.line === filters.line)
    && (!filters.actorIds || filters.actorIds.includes(a.id))
    && normalize([a.name, a.owner, a.indicator, a.line, a.id, `ACC-${String(a.id).padStart(3, '0')}`].join(' ')).includes(query));
}
export function groupActions(actions, field) {
  const grouped = new Map();
  actions.forEach((action) => { const key = action[field] || 'Sin información'; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(action); });
  return [...grouped].map(([name, items]) => ({ name, items }));
}
