// ==========================================================================
// three-bridge.js — WebGL→2D canvas bridge for creature ASCII pipeline
//
// Usage:
//   const renderer = createThreeRenderer(512, 342);
//   const drawFn = makeThreeDrawFn(scene, camera, renderer);
//   renderAscii(ctx, drawFn, 0, 0, w, h, opts);
// ==========================================================================

import * as THREE from 'three';

/**
 * Create a Three.js WebGLRenderer configured for ASCII pipeline use.
 * preserveDrawingBuffer:true is non-negotiable — without it ctx.drawImage
 * gets a blank canvas on Firefox and some Chrome versions.
 */
export function createThreeRenderer(w = 512, h = 512) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,  // REQUIRED for drawImage to work
    alpha: false,
  });
  renderer.setSize(w, h);
  renderer.setPixelRatio(1);            // Keep at 1 — no benefit from 2x for ASCII sampling
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.shadowMap.enabled = false;   // ASCII pipeline doesn't use shadow maps
  // Don't attach to DOM — this renderer is offscreen only
  return renderer;
}

/**
 * Wrap a Three.js scene+camera into a drawFn compatible with renderAscii.
 * The returned function renders the 3D scene and copies the result into the
 * provided 2D canvas context via drawImage.
 */
export function makeThreeDrawFn(scene, camera, threeRenderer) {
  return function drawFn(ctx, w, h) {
    // Resize renderer only when dimensions change
    const sz = threeRenderer.getSize(new THREE.Vector2());
    if (sz.x !== w || sz.y !== h) {
      threeRenderer.setSize(w, h);
      _updateCameraAspect(camera, w, h);
    }
    threeRenderer.render(scene, camera);
    // Copy WebGL framebuffer → 2D context — works same-origin in browser
    ctx.drawImage(threeRenderer.domElement, 0, 0, w, h);
  };
}

/**
 * Create an orthographic camera sized to a creature's grid dimensions.
 * Orthographic matches the 2D drawing style — no perspective foreshortening.
 * The camera is positioned at z=5 looking toward origin.
 *
 * @param {number} gridW — creature grid width (e.g. 12 for basilisk)
 * @param {number} gridH — creature grid height (e.g. 8 for basilisk)
 * @param {number} [viewH=2.2] — world-unit height of the view
 */
export function makeCreatureCamera(gridW = 7, gridH = 5, viewH = 2.2) {
  const aspect = gridW / gridH;
  const vH = viewH;
  const vW = vH * aspect;
  const camera = new THREE.OrthographicCamera(
    -vW / 2, vW / 2,
     vH / 2, -vH / 2,
    0.01, 100
  );
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * Standard creature lighting — single key directional + soft ambient.
 * Matches the lx/ly/lz model in renderAscii so the 3D render and ASCII
 * lighting direction are consistent.
 */
export function addCreatureLighting(scene) {
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 2.0, 3.0);   // upper-right, toward viewer
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-1, -0.5, 2);    // lower-left fill
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  return { key, fill };
}

// ---- helpers ----------------------------------------------------------------

function _updateCameraAspect(camera, w, h) {
  if (camera.isOrthographicCamera) {
    const currentH = camera.top - camera.bottom;
    const currentW = camera.right - camera.left;
    const newW = currentH * (w / h);
    camera.left  = -newW / 2;
    camera.right =  newW / 2;
    camera.updateProjectionMatrix();
  } else if (camera.isPerspectiveCamera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
