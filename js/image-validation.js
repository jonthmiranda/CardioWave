import { IMAGE_LIMITS } from './config.js';

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function extensionOf(name = '') {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

export function validateFile({ type = '', size = 0, name = '' }, limits = IMAGE_LIMITS) {
  if (size === 0) {
    return { ok: false, code: 'empty', message: 'O arquivo está vazio. Escolha outra imagem.' };
  }
  const typeAccepted = limits.acceptedTypes.includes(type.toLowerCase());
  const extensionAccepted = type === '' && limits.acceptedExtensions.includes(extensionOf(name));
  if (!typeAccepted && !extensionAccepted) {
    const hint = /heic|heif/i.test(type) ? ' Fotos HEIC precisam ser convertidas para JPEG.' : '';
    return {
      ok: false,
      code: 'type',
      message: `Formato não suportado. Use uma imagem JPEG, PNG ou WebP.${hint}`,
    };
  }
  if (size > limits.maxBytes) {
    return {
      ok: false,
      code: 'size',
      message: `A imagem tem ${formatBytes(size)}, acima do limite de ${formatBytes(limits.maxBytes)}.`,
    };
  }
  return { ok: true };
}

export function assessImage({ width, height }, limits = IMAGE_LIMITS) {
  const warnings = [];
  const longSide = Math.max(width, height);
  const megapixels = (width * height) / 1e6;

  if (longSide < limits.recommendedLongSide) {
    warnings.push({
      code: 'low-resolution',
      message: `Resolução baixa (${width} × ${height} px). O traçado pode ficar impreciso; fotografe mais perto ou com maior resolução.`,
    });
  }
  if (height > width * limits.portraitRatio) {
    warnings.push({
      code: 'portrait',
      message: 'A imagem está na vertical. ECGs costumam ser horizontais; confira a orientação.',
    });
  }
  if (megapixels > limits.maxMegapixels) {
    warnings.push({
      code: 'very-large',
      message: `Imagem muito grande (${megapixels.toFixed(0)} megapixels). O processamento pode ser lento em celulares.`,
    });
  }
  return warnings;
}
