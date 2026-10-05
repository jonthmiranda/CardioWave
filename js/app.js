import { initHomeScreen } from './home-screen.js';
import { byId, showToast } from './ui.js';
import { createViewerScreen } from './viewer-screen.js';

const VIEWER_HASH = '#/visualizador';

const screens = {
  home: { element: byId('screen-home'), title: 'CardioWave — ECG em 3D', heading: 'home-title' },
  viewer: { element: byId('screen-viewer'), title: 'Coração 3D — CardioWave', heading: 'viewer-title' },
};

let navigatedInApp = false;
let currentScreen = null;

const viewer = createViewerScreen({ onBack: goHome });
const home = initHomeScreen({ onExplore: () => navigate(VIEWER_HASH) });

function navigate(hash) {
  navigatedInApp = true;
  location.hash = hash;
}

function goHome() {
  if (navigatedInApp) {
    history.back();
    return;
  }
  history.replaceState(null, '', `${location.pathname}${location.search}`);
  render();
}

function render() {
  const next = location.hash === VIEWER_HASH ? 'viewer' : 'home';
  if (next === currentScreen) return;

  if (currentScreen === 'viewer') viewer.leave();
  currentScreen = next;

  for (const [name, screen] of Object.entries(screens)) {
    screen.element.hidden = name !== next;
  }
  document.title = screens[next].title;
  window.scrollTo(0, 0);

  const heading = byId(screens[next].heading);
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });

  if (next === 'viewer') viewer.enter();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./service-worker.js');
  } catch (error) {
    console.warn(`[CardioWave] Service Worker não registrado (${error.name}).`);
  }
}

window.addEventListener('hashchange', render);
window.addEventListener('pagehide', () => {
  viewer.destroy();
  home.destroy();
});
window.addEventListener('error', (event) => {
  console.error(`[CardioWave] Erro não tratado: ${event.message}`);
  showToast('Algo deu errado. Tente novamente.');
});
window.addEventListener('unhandledrejection', (event) => {
  console.error(`[CardioWave] Promessa rejeitada: ${event.reason?.message ?? 'sem detalhes'}`);
  showToast('Algo deu errado. Tente novamente.');
});
window.addEventListener('load', registerServiceWorker);

render();
