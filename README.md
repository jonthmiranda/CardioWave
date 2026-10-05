# CardioWave — ECG em 3D (MVP educativo)

PWA em JavaScript puro que, ao final do MVP, transforma o traçado de uma foto de ECG em um coração 3D
em movimento. **Uso educativo e demonstrativo: não é um dispositivo médico, não faz diagnóstico e a
animação é um modelo ilustrativo simplificado.** As imagens são processadas somente no aparelho.

## Estado do desenvolvimento

| Etapa | Conteúdo | Situação |
|------|----------|----------|
| 1 | Estrutura do PWA, interface mobile-first e cena 3D | **Concluída (esta entrega)** |
| 2 | Modelo anatômico, animação elétrica e mecânica | Pendente |
| 3 | Importação, pré-processamento e extração do ECG | Pendente |
| 4 | Sincronização real entre sinal e animação | Pendente |
| 5 | PWA final, tratamento de erros, testes e documentação | Pendente |

### O que a Etapa 1 já faz

- Tela inicial com **Fotografar ECG** (câmera traseira em celulares), **Importar imagem**, arrastar e soltar,
  validação (JPEG, PNG, WebP, até 25 MB), pré-visualização e avisos de qualidade (baixa resolução,
  imagem vertical, imagem muito grande).
- Visualizador 3D com coração procedural (quatro câmaras, aurículas, aorta e ramos, tronco pulmonar e
  artérias pulmonares, veias cavas, quatro veias pulmonares e artérias coronárias), luzes, sombras,
  rotação automática, **pausar rotação**, **restaurar câmera**, arrastar/pinça/zoom e teclado.
- PWA instalável e com cache offline; Three.js empacotado localmente (nenhum CDN).
- Carregador de modelo GLB/glTF local, pronto para substituir o coração provisório.
- Painel do ECG reservado (ainda sem traçado): o gráfico entra na Etapa 3/4.

O que **ainda não existe** de propósito: extração do ECG, propagação elétrica e sincronização.
A tela atual não simula nenhum dado de ECG.

## Como executar localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install          # só para testes e para reconstruir o vendor; o app não precisa
npm start            # servidor em http://localhost:8080  (PORT=3000 npm start para outra porta)
```

Também funciona com qualquer servidor estático (`python3 -m http.server 8080`). Abra pelo
`http://localhost`, não pelo arquivo (`file://`), porque módulos ES e Service Worker exigem HTTP.

## Testes automatizados

```bash
npm test
```

Cobrem validação de imagens, ruído procedural, geometria do coração (câmaras, vasos ancorados,
vértices válidos, liberação de memória), cálculo de enquadramento da câmera, normalização de modelos
GLB e a integridade do PWA (todo arquivo usado está no cache offline, manifest e ícones válidos,
hash da política de segurança, ausência de recursos externos).

## Publicar no GitHub Pages

1. Crie um repositório e envie **o conteúdo desta pasta** (inclui `vendor/` e `.nojekyll`; `node_modules/` é ignorado).
2. Em *Settings → Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Abra `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/` (HTTPS, necessário para câmera e instalação).

Todos os caminhos são relativos, então funciona em subpasta. **Ao alterar qualquer arquivo
publicado, aumente `CACHE_VERSION` em `service-worker.js`**; senão celulares que já abriram o app
podem continuar com a versão antiga em cache.

## Instalar como PWA

- **Android (Chrome):** menu ⋮ → *Instalar app* (ou *Adicionar à tela inicial*).
- **iPhone/iPad (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.
- **Computador (Chrome/Edge):** ícone de instalação na barra de endereço.

Depois de aberto uma vez com internet, o app abre offline.

## Estrutura

```
index.html              estrutura das telas, política de segurança (CSP) e import map
manifest.json           configuração do PWA
service-worker.js       cache offline (CACHE_VERSION)
css/styles.css          tema escuro, mobile-first
js/app.js               inicialização, navegação por hash (#/visualizador), registro do Service Worker
js/home-screen.js       tela inicial: pré-visualização, erros, avisos
js/camera.js            entrada de imagem: câmera, galeria, arrastar e soltar
js/image-validation.js  regras de validação e avisos de qualidade (testável sem navegador)
js/viewer-screen.js     tela 3D: estados de carregamento/erro e botões
js/heart-scene.js       cena Three.js: renderer, luzes, câmera, controles, ciclo de vida
js/heart-geometry.js    coração procedural (aproximação anatômica)
js/model-loader.js      carregador de GLB/glTF local
js/three-utils.js       liberação de geometrias, materiais e texturas
js/noise.js             ruído determinístico usado na geometria
js/config.js            limites de imagem e modelo 3D
js/ui.js                utilitários de interface
assets/icons/           ícones do PWA      assets/models/  modelos 3D locais (veja o README da pasta)
vendor/three/           Three.js 0.186.1 minificado (licença MIT incluída)
samples/                imagens SINTÉTICAS de teste da Etapa 1
tests/                  testes automatizados
tools/                  servidor local, geradores de ícones e imagens, build do vendor
```

## Trocar o modelo anatômico

Veja `assets/models/README.md`. Resumo: coloque um `.glb` em `assets/models/`, ajuste `HEART_MODEL`
em `js/config.js`, inclua o arquivo em `PRECACHE_URLS` e aumente `CACHE_VERSION`.

## Privacidade

Nada é enviado a servidores. A política de segurança (CSP) do `index.html` bloqueia conexões a
domínios externos. Imagens ficam apenas em memória (URL temporária do navegador) e são liberadas ao
trocar ou remover; nada é gravado no aparelho.

## Limitações conhecidas (Etapa 1)

- O coração é uma **aproximação anatômica procedural**, não um modelo clínico. Septos, valvas e
  anatomia interna não são representados.
- A câmera direta (`capture`) depende do navegador; no computador o botão abre o seletor de arquivos.
- Fotos HEIC do iPhone são convertidas para JPEG pelo Safari ao serem escolhidas na galeria em
  muitos casos, mas arquivos `.heic` enviados diretamente são recusados.
- Em celulares muito antigos a montagem inicial do coração pode levar alguns segundos.
- Testes visuais foram feitos em Chromium com renderização por software; teste em aparelho real.

## Sugestões (não implementadas, aguardam aprovação)

- Rótulos opcionais das estruturas anatômicas (átrios, ventrículos, aorta etc.).
- Cache de geometria para abrir o visualizador mais rápido em celulares fracos.

## Licenças

Three.js — MIT (`vendor/three/LICENSE`). O código do CardioWave é do projeto do autor.
