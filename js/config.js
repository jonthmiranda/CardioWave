export const APP_VERSION = '0.1.0';

export const IMAGE_LIMITS = Object.freeze({
  acceptedTypes: Object.freeze(['image/jpeg', 'image/png', 'image/webp']),
  acceptedExtensions: Object.freeze(['jpg', 'jpeg', 'png', 'webp']),
  maxBytes: 25 * 1024 * 1024,
  recommendedLongSide: 1200,
  maxMegapixels: 60,
  portraitRatio: 1.15,
});

/**
 * Modelo anatômico 3D local. Deixe `url` como null para usar o coração
 * procedural provisório. Para usar um GLB/glTF próprio, coloque o arquivo em
 * assets/models/ e informe o caminho relativo e o crédito da licença.
 * Exemplo: { url: './assets/models/heart.glb', credit: 'Autor — CC BY 4.0' }
 */
export const HEART_MODEL = Object.freeze({
  url: null,
  credit: '',
  targetHeight: 6.4,
});
