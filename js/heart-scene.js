import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildProceduralHeart } from './heart-geometry.js';
import { loadHeartModel } from './model-loader.js';
import { disposeObject3D } from './three-utils.js';

const VERTICAL_FOV = 34;
const HOME_AZIMUTH = 0.42;
const HOME_ELEVATION = 0.1;
const FIT_MARGIN = 1.24;
const TARGET_DROP = 0.05;
const RESET_DURATION_MS = 800;
const IDLE_RESUME_MS = 2500;
const BACKGROUND = 0x04070f;

const PROCEDURAL_LABEL = 'Modelo provisório · aproximação anatômica';

export class WebGLUnavailableError extends Error {
  constructor(cause) {
    super('WebGL indisponível neste navegador ou dispositivo.', { cause });
    this.name = 'WebGLUnavailableError';
  }
}

export function computeFitDistance({ verticalFovDeg, aspect, halfWidth, halfHeight, margin = FIT_MARGIN }) {
  const vertical = THREE.MathUtils.degToRad(verticalFovDeg) / 2;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return Math.max(halfHeight / Math.tan(vertical), halfWidth / Math.tan(horizontal)) * margin;
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function createGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(61, 232, 255, 0.42)');
  gradient.addColorStop(0.45, 'rgba(91, 140, 255, 0.14)');
  gradient.addColorStop(1, 'rgba(61, 232, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class HeartScene {
  constructor(container, { model = null, onContextLost = null, onContextRestored = null } = {}) {
    this.container = container;
    this.modelConfig = model;
    this.onContextLost = onContextLost;
    this.onContextRestored = onContextRestored;

    this.modelInfo = { kind: 'procedural', label: PROCEDURAL_LABEL, notice: null };
    this.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.reducedMotion = !this.autoRotate;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.heart = null;
    this.heartBounds = new THREE.Box3();
    this.dust = null;

    this.rafId = 0;
    this.lastTime = 0;
    this.interacting = false;
    this.lastInteractionEnd = -Infinity;
    this.userMoved = false;
    this.tween = null;
    this.resizeObserver = null;
    this.disposed = false;
    this.lifecycle = new AbortController();
  }

  async init() {
    this.#createRenderer();
    this.#createScene();
    await this.#loadHeart();
    this.#createStage();
    this.#createControls();
    this.#observeResize();
    this.resize();
    this.#applyHomeView();
  }

  start() {
    if (this.rafId || this.disposed) return;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.#frame);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    if (enabled) this.lastInteractionEnd = -Infinity;
  }

  resetCamera() {
    const home = this.#homePose();
    this.tween = {
      startedAt: performance.now(),
      fromPosition: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPosition: home.position,
      toTarget: home.target,
    };
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.#updateDistanceLimits();
    if (!this.userMoved && !this.tween) this.#applyHomeView();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.lifecycle.abort();
    this.resizeObserver?.disconnect();
    this.controls?.dispose();
    if (this.scene) disposeObject3D(this.scene);
    this.scene?.environment?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
  }

  #createRenderer() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (error) {
      throw new WebGLUnavailableError(error);
    }
    const { renderer } = this;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(BACKGROUND, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;

    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Coração em 3D. Arraste para girar; use as setas do teclado para mover a visão.');
    const { signal } = this.lifecycle;
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault();
        this.stop();
        this.onContextLost?.();
      },
      { signal },
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.start();
        this.onContextRestored?.();
      },
      { signal },
    );
    this.container.prepend(canvas);
  }

  #createScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(BACKGROUND, 0.016);

    this.camera = new THREE.PerspectiveCamera(VERTICAL_FOV, 1, 0.1, 120);
    this.scene.add(this.camera);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(environment, 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    disposeObject3D(environment);
    pmrem.dispose();

    this.scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x2a0a14, 0.5));

    const key = new THREE.DirectionalLight(0xfff0e4, 2.8);
    key.position.set(4.5, 7, 6.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 24;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.03;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0x4fd8ff, 2.2);
    rim.position.set(-6, 3, -5);
    this.scene.add(rim);

    const warmRim = new THREE.DirectionalLight(0xff4d6d, 1.1);
    warmRim.position.set(6, -2, -5);
    this.scene.add(warmRim);

    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7);
    fill.position.set(-1.5, 1.5, 2);
    fill.target.position.set(0, 0, -4);
    this.camera.add(fill, fill.target);
  }

  async #loadHeart() {
    const { url, credit, targetHeight } = this.modelConfig ?? {};
    if (url) {
      try {
        const group = await loadHeartModel(url, { targetHeight });
        this.heart = { group, dispose: () => disposeObject3D(group) };
        this.modelInfo = { kind: 'model', label: credit ? `Modelo 3D · ${credit}` : 'Modelo 3D local', notice: null };
      } catch (error) {
        console.warn(`[CardioWave] Modelo 3D local indisponível (${error.name}); usando o coração provisório.`);
        this.modelInfo.notice = 'Não foi possível carregar o modelo 3D local. Usando o coração provisório.';
      }
    }
    this.heart ??= buildProceduralHeart();
    this.scene.add(this.heart.group);
    this.heartBounds.setFromObject(this.heart.group);
  }

  #createStage() {
    const floorY = this.heartBounds.min.y - 0.55;

    const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.ShadowMaterial({ opacity: 0.42 }));
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = floorY;
    shadowCatcher.receiveShadow = true;
    this.scene.add(shadowCatcher);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(6.2, 64),
      new THREE.MeshBasicMaterial({
        map: createGlowTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = floorY + 0.01;
    this.scene.add(glow);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x3de8ff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const [inner, outer, opacity] of [[3.9, 3.93, 0.34], [5.2, 5.22, 0.16]]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 160), ringMaterial.clone());
      ring.material.opacity = opacity;
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = floorY + 0.02;
      this.scene.add(ring);
    }
    ringMaterial.dispose();

    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = 4 + Math.random() * 7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.8;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.scene.add(this.dust);
  }

  #createControls() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.85;
    controls.screenSpacePanning = true;
    controls.autoRotateSpeed = 1.4;
    controls.minPolarAngle = 0.05;
    controls.maxPolarAngle = Math.PI - 0.05;
    controls.listenToKeyEvents(this.renderer.domElement);

    controls.addEventListener('start', () => {
      this.interacting = true;
      this.userMoved = true;
      this.tween = null;
    });
    controls.addEventListener('end', () => {
      this.interacting = false;
      this.lastInteractionEnd = performance.now();
    });
    this.controls = controls;
  }

  #observeResize() {
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  #heartExtent() {
    const size = this.heartBounds.getSize(new THREE.Vector3());
    return { halfHeight: size.y / 2, halfWidth: Math.hypot(size.x, size.z) / 2.2 };
  }

  #fitDistance() {
    return computeFitDistance({ verticalFovDeg: VERTICAL_FOV, aspect: this.camera.aspect, ...this.#heartExtent() });
  }

  #homePose() {
    const target = this.heartBounds.getCenter(new THREE.Vector3());
    target.y -= this.heartBounds.getSize(new THREE.Vector3()).y * TARGET_DROP;
    const distance = this.#fitDistance();
    const position = new THREE.Vector3(
      Math.sin(HOME_AZIMUTH) * Math.cos(HOME_ELEVATION),
      Math.sin(HOME_ELEVATION),
      Math.cos(HOME_AZIMUTH) * Math.cos(HOME_ELEVATION),
    )
      .multiplyScalar(distance)
      .add(target);
    return { position, target };
  }

  #applyHomeView() {
    const home = this.#homePose();
    this.camera.position.copy(home.position);
    this.controls.target.copy(home.target);
    this.camera.lookAt(home.target);
    this.controls.update();
  }

  #updateDistanceLimits() {
    if (!this.controls) return;
    const fit = this.#fitDistance();
    this.controls.minDistance = fit * 0.3;
    this.controls.maxDistance = fit * 2.4;
  }

  #updateTween(now) {
    if (!this.tween) return;
    const progress = Math.min((now - this.tween.startedAt) / RESET_DURATION_MS, 1);
    const eased = easeInOutCubic(progress);
    this.camera.position.lerpVectors(this.tween.fromPosition, this.tween.toPosition, eased);
    this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, eased);
    if (progress === 1) {
      this.tween = null;
      this.userMoved = false;
      this.lastInteractionEnd = now;
    }
  }

  #frame = (now) => {
    this.rafId = requestAnimationFrame(this.#frame);
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.#updateTween(now);
    this.controls.autoRotate =
      this.autoRotate && !this.interacting && !this.tween && now - this.lastInteractionEnd > IDLE_RESUME_MS;
    this.controls.update(delta);
    if (!this.reducedMotion) this.dust.rotation.y += delta * 0.015;
    this.renderer.render(this.scene, this.camera);
  };
}
