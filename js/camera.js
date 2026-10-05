import { assessImage, validateFile } from './image-validation.js';

const READ_ERROR_MESSAGE =
  'Não foi possível ler a imagem. O arquivo pode estar corrompido ou ser grande demais para este aparelho.';

async function decodeImage(url) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return { width: image.naturalWidth, height: image.naturalHeight };
}

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

export function createImageInput({
  dropZone,
  cameraButton,
  galleryButton,
  cameraInput,
  galleryInput,
  onSelect,
  onError,
  onBusyChange,
}) {
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  let currentUrl = null;
  let processing = false;
  let dragDepth = 0;

  function releaseCurrent() {
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }

  async function handleFiles(files) {
    if (files.length === 0 || processing) return;
    processing = true;
    onBusyChange(true);
    let pendingUrl = null;
    try {
      const [file] = files;
      const check = validateFile(file);
      if (!check.ok) {
        onError(check.message);
        return;
      }
      pendingUrl = URL.createObjectURL(file);
      const dimensions = await decodeImage(pendingUrl);
      const warnings = assessImage(dimensions);
      if (files.length > 1) {
        warnings.push({
          code: 'multiple-files',
          message: 'Foram enviados vários arquivos; somente o primeiro foi usado.',
        });
      }
      releaseCurrent();
      currentUrl = pendingUrl;
      pendingUrl = null;
      onSelect({ url: currentUrl, ...dimensions, bytes: file.size, warnings });
    } catch (error) {
      console.warn(`[CardioWave] Falha ao decodificar a imagem (${error.name}).`);
      onError(READ_ERROR_MESSAGE);
    } finally {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
      processing = false;
      onBusyChange(false);
    }
  }

  function bindInput(input) {
    input.addEventListener(
      'change',
      () => {
        const files = Array.from(input.files ?? []);
        input.value = '';
        handleFiles(files);
      },
      { signal },
    );
  }

  bindInput(cameraInput);
  bindInput(galleryInput);
  cameraButton.addEventListener('click', () => cameraInput.click(), { signal });
  galleryButton.addEventListener('click', () => galleryInput.click(), { signal });

  dropZone.addEventListener(
    'dragenter',
    (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth += 1;
      dropZone.classList.add('is-dragover');
    },
    { signal },
  );
  dropZone.addEventListener(
    'dragover',
    (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    { signal },
  );
  dropZone.addEventListener(
    'dragleave',
    () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) dropZone.classList.remove('is-dragover');
    },
    { signal },
  );
  dropZone.addEventListener(
    'drop',
    (event) => {
      event.preventDefault();
      dragDepth = 0;
      dropZone.classList.remove('is-dragover');
      handleFiles(Array.from(event.dataTransfer?.files ?? []));
    },
    { signal },
  );

  const blockStrayDrop = (event) => {
    if (hasFiles(event)) event.preventDefault();
  };
  window.addEventListener('dragover', blockStrayDrop, { signal });
  window.addEventListener('drop', blockStrayDrop, { signal });

  return {
    openGallery: () => galleryInput.click(),
    clear: releaseCurrent,
    destroy() {
      lifecycle.abort();
      releaseCurrent();
    },
  };
}
