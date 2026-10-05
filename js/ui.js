export function byId(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elemento #${id} não encontrado em index.html.`);
  return element;
}

let toastTimer = null;

export function showToast(message, duration = 4200) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

export function prefersCoarsePointer() {
  return window.matchMedia('(pointer: coarse)').matches;
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
