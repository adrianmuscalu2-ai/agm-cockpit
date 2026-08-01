export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatPreview(value: string, placeholder: string) {
  return escapeHtml(value || placeholder).replace(/\n/g, '<br />');
}

export function formatInlinePreview(value: string) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}
