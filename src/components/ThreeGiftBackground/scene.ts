import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const GIFT_MODEL_URL = "/models/holiday/present-a-cube.glb";
const VIEW_HEIGHT = 10;
const GIFT_SIZE = 1.65;
const GIFT_RADIUS = GIFT_SIZE * 0.58;
const MAX_PIXEL_RATIO = 1.5;
const EXIT_CHANCE = 0.32;

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function boundaryFor(halfExtent: number, direction: -1 | 1) {
  const exitsViewport = Math.random() < EXIT_CHANCE;
  const distance = exitsViewport
    ? randomBetween(GIFT_RADIUS * 0.75, GIFT_RADIUS * 1.25)
    : -randomBetween(GIFT_RADIUS * 0.18, GIFT_RADIUS * 0.52);

  return direction * (halfExtent + distance);
}

function disposeMaterial(material: THREE.Material) {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

export function initializeGiftBackground(root: HTMLElement) {
  if (root.dataset.initialized === "true") return;
  root.dataset.initialized = "true";

  const canvas = root.querySelector<HTMLCanvasElement>("[data-three-gift-canvas]");
  if (!canvas) return;

  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "low-power"
  }); } catch { delete root.dataset.initialized; return; }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.z = 10;

  const hemisphereLight = new THREE.HemisphereLight(0xfff5e5, 0x491a24, 2.2);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 3.4);
  directionalLight.position.set(-3, 5, 8);
  scene.add(hemisphereLight, directionalLight);

  let halfWidth = VIEW_HEIGHT / 2;
  let halfHeight = VIEW_HEIGHT / 2;
  let horizontalMin = -halfWidth;
  let horizontalMax = halfWidth;
  let verticalMin = -halfHeight;
  let verticalMax = halfHeight;
  let gift: THREE.Group | null = null;
  let disposed = false;
  let previousFrameTime = performance.now();

  const velocity = new THREE.Vector2(randomBetween(1, 1.35), randomBetween(0.72, 1.05));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function resetBoundaries() {
    horizontalMin = boundaryFor(halfWidth, -1);
    horizontalMax = boundaryFor(halfWidth, 1);
    verticalMin = boundaryFor(halfHeight, -1);
    verticalMax = boundaryFor(halfHeight, 1);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function resize() {
    const width = Math.max(root.clientWidth, 1);
    const height = Math.max(root.clientHeight, 1);
    const aspect = width / height;

    halfHeight = VIEW_HEIGHT / 2;
    halfWidth = halfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    resetBoundaries();
    render();
  }

  function animate(time: DOMHighResTimeStamp) {
    if (!gift) return;

    const delta = Math.min((time - previousFrameTime) / 1000, 0.05);
    previousFrameTime = time;
    gift.position.x += velocity.x * delta;
    gift.position.y += velocity.y * delta;

    gift.rotation.x += delta * 0.38;
    gift.rotation.y += delta * 0.56;
    gift.rotation.z += delta * 0.16;

    if (velocity.x > 0 && gift.position.x >= horizontalMax) {
      gift.position.x = horizontalMax;
      velocity.x = -randomBetween(1, 1.35);
      horizontalMin = boundaryFor(halfWidth, -1);
    } else if (velocity.x < 0 && gift.position.x <= horizontalMin) {
      gift.position.x = horizontalMin;
      velocity.x = randomBetween(1, 1.35);
      horizontalMax = boundaryFor(halfWidth, 1);
    }

    if (velocity.y > 0 && gift.position.y >= verticalMax) {
      gift.position.y = verticalMax;
      velocity.y = -randomBetween(0.72, 1.05);
      verticalMin = boundaryFor(halfHeight, -1);
    } else if (velocity.y < 0 && gift.position.y <= verticalMin) {
      gift.position.y = verticalMin;
      velocity.y = randomBetween(0.72, 1.05);
      verticalMax = boundaryFor(halfHeight, 1);
    }

    render();
  }

  function updateAnimationState() {
    const shouldAnimate = !document.hidden && !reducedMotion.matches && !disposed && gift !== null;

    renderer.setAnimationLoop(shouldAnimate ? animate : null);
    if (shouldAnimate) {
      previousFrameTime = performance.now();
    }
    render();
  }

  function handleVisibilityChange() {
    updateAnimationState();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  reducedMotion.addEventListener("change", updateAnimationState);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  void new GLTFLoader().loadAsync(GIFT_MODEL_URL).then((gltf) => {
    if (disposed) {
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(disposeMaterial);
      });
      return;
    }

    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z);

    model.position.sub(center);
    model.scale.setScalar(1 / largestDimension);

    gift = new THREE.Group();
    gift.scale.setScalar(GIFT_SIZE);
    gift.rotation.set(0.35, -0.4, 0.18);
    gift.add(model);
    scene.add(gift);

    gift.position.set(
      randomBetween(-halfWidth * 0.55, halfWidth * 0.55),
      randomBetween(-halfHeight * 0.55, halfHeight * 0.55),
      0
    );

    root.dataset.sceneReady = "true";
    resetBoundaries();
    render();
    updateAnimationState();
  }).catch(() => { dispose(); });

  function dispose() {
    if (disposed) return;
    disposed = true;
    delete root.dataset.initialized;
    delete root.dataset.sceneReady;

    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    reducedMotion.removeEventListener("change", updateAnimationState);
    document.removeEventListener("visibilitychange", handleVisibilityChange);

    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(disposeMaterial);
    });

    renderer.dispose();
  }

  resize();
  return dispose;
}
