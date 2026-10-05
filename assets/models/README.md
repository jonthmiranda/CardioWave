# Modelo anatômico 3D local

O CardioWave usa, por padrão, um coração **procedural provisório** (aproximação anatômica
gerada por código em `js/heart-geometry.js`). Para usar um modelo de melhor qualidade:

1. Obtenha um modelo de coração em formato **GLB** ou **glTF** com licença que permita o uso
   (por exemplo CC0 ou CC BY). Guarde a licença e o crédito do autor.
2. Salve o arquivo nesta pasta, por exemplo `assets/models/heart.glb`.
3. Edite `js/config.js`:

   ```js
   export const HEART_MODEL = Object.freeze({
     url: './assets/models/heart.glb',
     credit: 'Nome do autor — CC BY 4.0',
     targetHeight: 6.4,
   });
   ```

4. Inclua o caminho do arquivo em `PRECACHE_URLS` no `service-worker.js` e aumente a
   `CACHE_VERSION`, para que o modelo funcione offline.
5. Recarregue a página. O modelo é centralizado e redimensionado automaticamente.

Observações:

- Use GLB **sem** compressão Draco, Meshopt ou KTX2 (os decodificadores não estão incluídos).
- Se o arquivo não carregar, o aplicativo avisa e volta ao coração provisório.
- O crédito informado em `credit` aparece no selo do visualizador.
- Não use modelos remotos (links externos): o aplicativo bloqueia conexões externas por
  privacidade (política de segurança de conteúdo) e precisa funcionar offline.
