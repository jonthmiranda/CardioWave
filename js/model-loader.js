import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function normalizeModel(root, targetHeight) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) {
    throw new Error('O modelo 3D não contém geometria visível.');
  }
  root.position.sub(box.getCenter(new THREE.Vector3()));

  const wrapper = new THREE.Group();
  wrapper.name = 'heart-model';
  wrapper.add(root);
  wrapper.scale.setScalar(targetHeight / size.y);
  wrapper.updateMatrixWorld(true);
  return wrapper;
}

export async function loadHeartModel(url, { targetHeight }) {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return normalizeModel(gltf.scene, targetHeight);
}
