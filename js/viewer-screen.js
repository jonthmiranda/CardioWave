import { HEART_MODEL } from './config.js';
import { byId, prefersCoarsePointer, showToast } from './ui.js';

const HINT_DURATION_MS = 7000;

function describeError(error) {
  if (error?.name === 'WebGLUnavailableError') {
    return 'Não foi possível iniciar os gráficos 3D (WebGL). Atualize o navegador ou ative a aceleração por hardware e tente novamente.';
  }
  if (error instanceof TypeError && /import|fetch/i.test(error.message)) {
    return 'Não foi possível carregar o visualizador 3D. Verifique a conexão e tente novamente.';
  }
  return 'Não foi possível iniciar o visualizador 3D. Tente novamente.';
}

export function createViewerScreen({ onBack }) {
  const stage = byId('heart-stage');
  const loading = byId('viewer-loading');
  const errorBox = byId('viewer-error');
  const errorMessage = byId('viewer-error-message');
  const hint = byId('camera-hint');
  const badge = byId('model-badge');
  const rotationLabel = byId('btn-rotation-label');
  const rotationIcon = byId('btn-rotation-icon');

  const lifecycle = new AbortController();
  const { signal } = lifecycle;

  let scene = null;
  let pendingScene = null;
  let active = false;
  let hintShown = false;
  let hintTimer = null;

  function showLoading() {
    errorBox.hidden = true;
    loading.hidden = false;
  }

  function showError(message) {
    loading.hidden = true;
    errorMessage.textContent = message;
    errorBox.hidden = false;
  }

  function hideOverlays() {
    loading.hidden = true;
    errorBox.hidden = true;
  }

  function syncRotationButton() {
    const rotating = scene?.autoRotate ?? false;
    rotationLabel.textContent = rotating ? 'Pausar rotação' : 'Retomar rotação';
    rotationIcon.setAttribute('href', rotating ? '#i-pause' : '#i-play');
  }

  function syncBadge(modelInfo) {
    badge.textContent = modelInfo.label;
    if (modelInfo.notice) showToast(modelInfo.notice, 6000);
  }

  function showHintOnce() {
    if (hintShown) return;
    hintShown = true;
    hint.textContent = prefersCoarsePointer()
      ? 'Arraste para girar · pinça para ampliar'
      : 'Arraste para girar · role para ampliar · botão direito para mover';
    hint.hidden = false;
    hintTimer = setTimeout(() => {
      hint.hidden = true;
    }, HINT_DURATION_MS);
  }

  async function createScene() {
    const { HeartScene } = await import('./heart-scene.js');
    const instance = new HeartScene(stage, {
      model: HEART_MODEL,
      onContextLost: () =>
        showError('O sistema interrompeu os gráficos 3D. Aguarde um instante: a imagem deve voltar sozinha.'),
      onContextRestored: () => {
        hideOverlays();
        syncRotationButton();
      },
    });
    try {
      await instance.init();
    } catch (error) {
      instance.dispose();
      throw error;
    }
    return instance;
  }

  async function enter() {
    active = true;
    showLoading();
    try {
      pendingScene ??= createScene();
      scene ??= await pendingScene;
      pendingScene = null;
      if (!active) return;
      hideOverlays();
      syncBadge(scene.modelInfo);
      syncRotationButton();
      scene.start();
      showHintOnce();
    } catch (error) {
      pendingScene = null;
      console.error(`[CardioWave] Falha no visualizador 3D (${error?.name}): ${error?.message}`);
      if (active) showError(describeError(error));
    }
  }

  function leave() {
    active = false;
    scene?.stop();
  }

  function destroy() {
    active = false;
    clearTimeout(hintTimer);
    lifecycle.abort();
    scene?.dispose();
    scene = null;
  }

  byId('btn-back').addEventListener('click', onBack, { signal });
  byId('btn-retry').addEventListener('click', enter, { signal });
  byId('btn-rotation').addEventListener(
    'click',
    () => {
      if (!scene) return;
      scene.setAutoRotate(!scene.autoRotate);
      syncRotationButton();
    },
    { signal },
  );
  byId('btn-reset-camera').addEventListener('click', () => scene?.resetCamera(), { signal });
  document.addEventListener(
    'visibilitychange',
    () => {
      if (!active || !scene) return;
      if (document.hidden) scene.stop();
      else scene.start();
    },
    { signal },
  );

  return { enter, leave, destroy };
}
