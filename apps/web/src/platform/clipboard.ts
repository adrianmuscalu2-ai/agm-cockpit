export type ClipboardCopyMethod = 'clipboard' | 'fallback';

export async function copyPlainText(text: string): Promise<ClipboardCopyMethod> {
  try {
    await navigator.clipboard.writeText(text);
    return 'clipboard';
  } catch {
    fallbackCopy(text);
    return 'fallback';
  }
}

function fallbackCopy(content: string) {
  const area = document.createElement('textarea');
  area.value = content;
  area.setAttribute('readonly', 'true');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}
