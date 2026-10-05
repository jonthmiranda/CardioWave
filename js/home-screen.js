import { createImageInput } from './camera.js';
import { formatBytes } from './image-validation.js';
import { byId, prefersCoarsePointer } from './ui.js';

export function initHomeScreen({ onExplore }) {
  const errorBox = byId('input-error');
  const busyBox = byId('input-busy');
  const previewCard = byId('preview-card');
  const previewImage = byId('preview-image');
  const previewMeta = byId('preview-meta');
  const previewWarnings = byId('preview-warnings');

  if (!prefersCoarsePointer()) {
    byId('camera-note').textContent = 'Neste computador, “Fotografar ECG” abre o seletor de arquivos.';
  }

  function hideError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function renderWarnings(warnings) {
    previewWarnings.replaceChildren(
      ...warnings.map((warning) => {
        const item = document.createElement('li');
        item.textContent = warning.message;
        return item;
      }),
    );
    previewWarnings.hidden = warnings.length === 0;
  }

  function showPreview({ url, width, height, bytes, warnings }) {
    hideError();
    previewImage.src = url;
    previewMeta.textContent = `${width} × ${height} px · ${formatBytes(bytes)}`;
    renderWarnings(warnings);
    previewCard.hidden = false;
  }

  function clearPreview() {
    previewCard.hidden = true;
    previewImage.removeAttribute('src');
    previewMeta.textContent = '';
    renderWarnings([]);
  }

  const imageInput = createImageInput({
    dropZone: byId('drop-zone'),
    cameraButton: byId('btn-camera'),
    galleryButton: byId('btn-gallery'),
    cameraInput: byId('input-camera'),
    galleryInput: byId('input-gallery'),
    onSelect: showPreview,
    onError: showError,
    onBusyChange: (busy) => {
      busyBox.hidden = !busy;
      if (busy) hideError();
    },
  });

  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  byId('btn-replace').addEventListener('click', () => imageInput.openGallery(), { signal });
  byId('btn-remove').addEventListener(
    'click',
    () => {
      clearPreview();
      imageInput.clear();
    },
    { signal },
  );
  byId('btn-explore').addEventListener('click', onExplore, { signal });

  return {
    destroy() {
      lifecycle.abort();
      imageInput.destroy();
    },
  };
}
