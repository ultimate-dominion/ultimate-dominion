// ==========================================================================
// creature-builder.js — Declarative skeleton → Three.js scene converter
//
// Converts existing creature skeleton definitions (normalized 0-1 coords)
// into Three.js scenes with MeshToonMaterial matching the creature's toon
// palette. Returns a bundle compatible with makeThreeDrawFn + renderAscii.
//
// Usage:
//   const bundle = buildCreature(spec);
//   const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, renderer);
//   bundle.playClip('idle');
// ==========================================================================

import * as THREE from 'three';
import { makeCreatureCamera, addCreatureLighting } from './three-bridge.js';

// --------------------------------------------------------------------------
// Toon gradient texture
// --------------------------------------------------------------------------

/**
 * Build a DataTexture for MeshToonMaterial.gradientMap from a palette array.
 * Each stop { r, g, b } becomes one pixel in a 1D texture.
 * NearestFilter is required — linear interpolation defeats toon banding.
 */
export function makeToonGradient(palette) {
  const data = new Uint8Array(palette.length * 4);
  palette.forEach(({ r, g, b }, i) => {
    data[i * 4]     = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  const tex = new THREE.DataTexture(data, palette.length, 1);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// --------------------------------------------------------------------------
// Material factory
// --------------------------------------------------------------------------

function makeMat(color, gradMap) {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradMap });
}

function paletteColor(palette, idx) {
  const c = palette[Math.min(idx, palette.length - 1)];
  return new THREE.Color(c.r / 255, c.g / 255, c.b / 255);
}

// --------------------------------------------------------------------------
// Geometry helpers
// --------------------------------------------------------------------------

/**
 * Create a tapered cylinder (cone-like) connecting two 3D points.
 * rTop / rBottom are world-unit radii at each end.
 */
function segmentMesh(p1, p2, rBottom, rTop, mat, segs = 8) {
  const dir = p2.clone().sub(p1);
  const len = dir.length();
  if (len < 0.001) return null;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, len, segs, 1),
    mat
  );
  mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/** Sphere at position with material. xScale/yScale/zScale for oblate shapes. */
function sphereMesh(pos, r, mat, xScale = 1, yScale = 1, zScale = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  mesh.position.copy(pos);
  mesh.scale.set(xScale, yScale, zScale);
  return mesh;
}

/** Cone oriented upward (for dorsal spines). tipY is the world Y of the tip. */
function coneMesh(basePos, height, radius, mat) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 6),
    mat
  );
  mesh.position.copy(basePos);
  mesh.position.y += height / 2;
  return mesh;
}

// --------------------------------------------------------------------------
// Coordinate conversion helpers
// --------------------------------------------------------------------------

/**
 * Convert a 0-1 normalized skeleton coordinate to 3D world units.
 * Creatures face LEFT (head at low x), so x maps from right to left.
 * y is inverted (0=top in canvas = positive y in world).
 */
function makeCoordFns(gridW, gridH, viewH = 2.2) {
  const aspect = gridW / gridH;
  const vW = viewH * aspect;
  const toX = nx => (nx - 0.5) * vW;
  const toY = ny => (0.5 - ny) * viewH;
  const toR = nr => nr * vW;          // radii scale with width
  const toV3 = (nx, ny, nz = 0) => new THREE.Vector3(toX(nx), toY(ny), nz);
  return { toX, toY, toR, toV3, vW, viewH };
}

// --------------------------------------------------------------------------
// Main builder
// --------------------------------------------------------------------------

/**
 * Build a complete Three.js creature bundle from a spec.
 *
 * @param {object} spec
 * @param {object[]} spec.palette     — toon stops [{r,g,b}], index 0=darkest
 * @param {number}   spec.gridW
 * @param {number}   spec.gridH
 * @param {object}   spec.body        — { spine: [{id,x,y,radius}, ...] }
 * @param {object[]} [spec.limbs]     — [{side:'near'|'far', positions:[[x,y],...], radius}]
 * @param {object}   [spec.tail]      — { startX,startY, points:[[x,y],...], baseRadius }
 * @param {object}   [spec.head]      — { x,y,radius, jawDrop, teethCount }
 * @param {object[]} [spec.accessories] — [{type:'spineRow', positions:[[x,y,height,radius],...]}]
 *
 * @returns {{ scene, camera, group, mixer, clips, playClip }}
 */
export function buildCreature(spec) {
  const { palette, gridW, gridH, body, limbs = [], tail, head, accessories = [] } = spec;
  const { toX, toY, toR, toV3 } = makeCoordFns(gridW, gridH);

  // Palette indices (rough mapping to luminance bands)
  const iDeep   = 0;
  const iShadow = Math.floor(palette.length * 0.15);
  const iMid    = Math.floor(palette.length * 0.40);
  const iLight  = Math.floor(palette.length * 0.65);
  const iHi     = Math.floor(palette.length * 0.82);
  const iRim    = palette.length - 1;

  const gradMap = makeToonGradient(palette);
  const matDeep   = makeMat(paletteColor(palette, iDeep),   gradMap);
  const matShadow = makeMat(paletteColor(palette, iShadow), gradMap);
  const matMid    = makeMat(paletteColor(palette, iMid),    gradMap);
  const matLight  = makeMat(paletteColor(palette, iLight),  gradMap);
  const matHi     = makeMat(paletteColor(palette, iHi),     gradMap);
  const matRim    = makeMat(paletteColor(palette, iRim),    gradMap);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  addCreatureLighting(scene);

  // Root group — all creature geometry goes here for easy transforms
  const group = new THREE.Group();
  scene.add(group);

  // ---- Body spine -----------------------------------------------------------
  const spineNodes = body.spine;
  spineNodes.forEach((node, i) => {
    const pos = toV3(node.x, node.y, 0);
    const r = toR(node.radius);
    // Sphere at each spine node — oblate (wider in x, shallower in z)
    const isHead = node.id === 'head' || node.id === 'snout';
    const mat = isHead ? matLight : (i < 2 ? matMid : matMid);
    group.add(sphereMesh(pos, r, mat, isHead ? 1.5 : 1.3, 1.0, isHead ? 0.75 : 0.65));

    // Cylinder segment to next spine node
    if (i < spineNodes.length - 1) {
      const next = spineNodes[i + 1];
      const p2 = toV3(next.x, next.y, 0);
      const r2 = toR(next.radius);
      const seg = segmentMesh(pos, p2, r, r2, matMid);
      if (seg) group.add(seg);
    }
  });

  // ---- Belly plate (lighter underside) -------------------------------------
  if (spineNodes.length >= 4) {
    const s1 = spineNodes[Math.floor(spineNodes.length * 0.25)];
    const s2 = spineNodes[Math.floor(spineNodes.length * 0.75)];
    const bellyY = Math.max(s1.y, s2.y) + 0.04; // slightly below spine
    const bellyX = (s1.x + s2.x) / 2;
    const bellyR = toR((s1.radius + s2.radius) / 2 * 0.7);
    const bellyW = Math.abs(toX(s2.x) - toX(s1.x)) * 0.8;
    const belly = new THREE.Mesh(
      new THREE.CapsuleGeometry(bellyR * 0.5, bellyW, 8, 8),
      matLight
    );
    belly.position.set(toX(bellyX), toY(bellyY) - bellyR * 0.3, -bellyR * 0.1);
    belly.rotation.z = Math.PI / 2; // lay capsule on its side
    belly.scale.set(1, 0.5, 0.4);
    group.add(belly);
  }

  // ---- Limbs ---------------------------------------------------------------
  limbs.forEach(limb => {
    const zOff = limb.side === 'far' ? -0.06 : 0.10;
    const baseR = toR(limb.radius ?? 0.04);
    limb.positions.forEach((pos, i) => {
      const r = baseR * (1 - i * 0.18);
      const p = toV3(pos[0], pos[1], zOff);
      const mat = limb.side === 'far' ? matShadow : matMid;
      group.add(sphereMesh(p, r, mat, 1, 1, 0.75));

      if (i > 0) {
        const prev = limb.positions[i - 1];
        const p1 = toV3(prev[0], prev[1], zOff);
        const r1 = baseR * (1 - (i - 1) * 0.18);
        const seg = segmentMesh(p1, p, r1, r, mat);
        if (seg) group.add(seg);
      }
    });

    // Claw tips
    const last = limb.positions[limb.positions.length - 1];
    const clawMat = matLight;
    [-0.022, 0, 0.022].forEach(offset => {
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(toR(0.008), toR(0.032), 4),
        clawMat
      );
      tip.position.set(toX(last[0]) + offset, toY(last[1]) - toR(0.018), zOff);
      tip.rotation.z = Math.PI; // point downward
      group.add(tip);
    });
  });

  // ---- Tail ----------------------------------------------------------------
  if (tail && tail.points && tail.points.length >= 2) {
    const pts = tail.points;
    const baseR = toR(tail.baseRadius ?? 0.06);
    pts.forEach((pt, i) => {
      if (i === 0) return;
      const t = (i - 1) / (pts.length - 2);
      const r1 = baseR * (1 - (t * 0.85));
      const r2 = baseR * (1 - ((t + 1 / (pts.length - 1)) * 0.85));
      const p1 = toV3(pts[i - 1][0], pts[i - 1][1], 0);
      const p2 = toV3(pt[0], pt[1], 0);
      const seg = segmentMesh(p1, p2, r1, r2, i < pts.length * 0.5 ? matMid : matShadow);
      if (seg) group.add(seg);
    });

    // Barbed tip
    const tip = pts[pts.length - 1];
    const tipMesh = new THREE.Mesh(
      new THREE.ConeGeometry(toR(0.015), toR(0.065), 4),
      matRim
    );
    tipMesh.position.copy(toV3(tip[0], tip[1], 0));
    // Orient toward previous point
    if (pts.length >= 2) {
      const prev = pts[pts.length - 2];
      const dir = new THREE.Vector3(toX(tip[0]) - toX(prev[0]), toY(tip[1]) - toY(prev[1]), 0).normalize();
      tipMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    group.add(tipMesh);
  }

  // ---- Head (detailed override) -------------------------------------------
  if (head) {
    const hx = toX(head.x), hy = toY(head.y);
    const hr = toR(head.radius);

    // Upper jaw
    const upperJaw = new THREE.Mesh(
      new THREE.BoxGeometry(hr * 2.8, hr * 0.55, hr * 1.1),
      matLight
    );
    upperJaw.position.set(hx - hr * 0.5, hy + hr * 0.12, 0);
    upperJaw.rotation.z = 0.08; // slight downward angle toward snout
    group.add(upperJaw);

    // Lower jaw (dropped)
    const jawDrop = head.jawDrop ?? 0.18;
    const lowerJaw = new THREE.Mesh(
      new THREE.BoxGeometry(hr * 2.4, hr * 0.4, hr * 1.0),
      matMid
    );
    lowerJaw.position.set(hx - hr * 0.6, hy - hr * jawDrop, 0);
    lowerJaw.rotation.z = -0.15;
    group.add(lowerJaw);

    // Mouth cavity (dark interior)
    const maw = new THREE.Mesh(
      new THREE.BoxGeometry(hr * 2.2, hr * 0.3, hr * 0.9),
      matDeep
    );
    maw.position.set(hx - hr * 0.5, hy - hr * 0.04, 0.01);
    group.add(maw);

    // Teeth
    const teethCount = head.teethCount ?? 6;
    const toothMat = makeMat(new THREE.Color(0.99, 0.97, 0.92), gradMap); // near-white
    for (let t = 0; t < teethCount; t++) {
      const tx = hx - hr * 1.1 + (t / teethCount) * hr * 2.0;
      // upper teeth
      const upper = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.045, hr * 0.18, 4), toothMat);
      upper.position.set(tx, hy + hr * 0.02, 0.02);
      upper.rotation.z = Math.PI; // point downward
      group.add(upper);
      // lower teeth (every other)
      if (t % 2 === 0) {
        const lower = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.038, hr * 0.14, 4), toothMat);
        lower.position.set(tx + hr * 0.1, hy - hr * jawDrop + hr * 0.05, 0.02);
        group.add(lower);
      }
    }

    // Eye socket
    const eyeX = hx - hr * 0.42, eyeY = hy - hr * 0.14;
    const eyeR = hr * 0.38;
    const socketMat = makeMat(new THREE.Color(0.04, 0.02, 0.01), gradMap);
    group.add(sphereMesh(new THREE.Vector3(eyeX, eyeY, hr * 0.4), eyeR, socketMat, 1, 0.9, 0.5));

    // Iris — amber gold
    const irisMat = makeMat(new THREE.Color(1.0, 0.73, 0.07), gradMap);
    const iris = sphereMesh(new THREE.Vector3(eyeX, eyeY, hr * 0.44), eyeR * 0.72, irisMat, 1, 0.9, 0.3);
    group.add(iris);

    // Slit pupil
    const pupilMat = makeMat(new THREE.Color(0.03, 0.01, 0.0), gradMap);
    const pupil = new THREE.Mesh(
      new THREE.CylinderGeometry(eyeR * 0.12, eyeR * 0.12, eyeR * 0.8, 4),
      pupilMat
    );
    pupil.position.set(eyeX, eyeY, hr * 0.47);
    group.add(pupil);
  }

  // ---- Accessories (dorsal spines) ----------------------------------------
  accessories.forEach(acc => {
    if (acc.type === 'spineRow' && acc.positions) {
      acc.positions.forEach(([sx, sy, height, radius]) => {
        const pos = toV3(sx, sy, 0);
        pos.z += toR(0.02); // slightly in front of body
        const cone = coneMesh(pos, toR(height), toR(radius), matRim);
        group.add(cone);

        // Dark spine body
        const bodyRadius = toR(radius * 0.6);
        const bodyH = toR(height * 0.7);
        const darkCone = coneMesh(pos, bodyH, bodyRadius, matShadow);
        group.add(darkCone);
      });
    }
  });

  // ---- Camera + AnimationMixer --------------------------------------------
  const camera = makeCreatureCamera(gridW, gridH);
  const mixer = new THREE.AnimationMixer(group);

  // Build standard animation clips
  const clips = buildStandardClips(group, spineNodes, { toX, toY, toR });
  const actions = {};
  Object.entries(clips).forEach(([name, clip]) => {
    actions[name] = mixer.clipAction(clip);
  });

  // Start idle by default
  actions.idle?.play();
  let currentAction = actions.idle ?? null;

  function playClip(name, fadeTime = 0.15) {
    const next = actions[name];
    if (!next || next === currentAction) return;
    if (currentAction) currentAction.crossFadeTo(next, fadeTime, false);
    next.play();
    currentAction = next;
    // One-shot clips (hit, attack) fade back to idle
    if (name === 'hit' || name === 'attack') {
      const onFinish = () => {
        mixer.removeEventListener('finished', onFinish);
        playClip('idle', 0.2);
      };
      mixer.addEventListener('finished', onFinish);
    }
  }

  return { scene, camera, group, mixer, clips, playClip };
}

// --------------------------------------------------------------------------
// Standard animation clips
// --------------------------------------------------------------------------

function buildStandardClips(group, spineNodes, { toX, toY, toR }) {
  const clips = {};

  // Idle: gentle breathing — scale group Y slightly
  {
    const times = [0, 1.2, 2.4];
    const vals  = [1, 1, 1,  1, 1.025, 1,  1, 1, 1];
    const track = new THREE.VectorKeyframeTrack(`${group.uuid}.scale`, times, vals);
    clips.idle = new THREE.AnimationClip('idle', 2.4, [track]);
  }

  // Attack: surge forward (-x) then snap back
  {
    const times = [0, 0.18, 0.42, 0.70];
    const vals  = [0,0,0,  -0.22,0.04,0,  -0.28,0.02,0,  0,0,0];
    const track = new THREE.VectorKeyframeTrack(`${group.uuid}.position`, times, vals);
    clips.attack = new THREE.AnimationClip('attack', 0.70, [track]);
  }

  // Hit: knockback +x then return
  {
    const times = [0, 0.08, 0.25];
    const vals  = [0,0,0,  0.15,0,0,  0,0,0];
    const track = new THREE.VectorKeyframeTrack(`${group.uuid}.position`, times, vals);
    clips.hit = new THREE.AnimationClip('hit', 0.25, [track]);
  }

  // Death: sink down + scale to zero
  {
    const times = [0, 0.6, 1.4];
    const posVals = [0,0,0,  0,-0.3,0,  0,-0.8,0];
    const scaleVals = [1,1,1,  0.9,0.6,0.9,  0,0,0];
    clips.death = new THREE.AnimationClip('death', 1.4, [
      new THREE.VectorKeyframeTrack(`${group.uuid}.position`, times, posVals),
      new THREE.VectorKeyframeTrack(`${group.uuid}.scale`, times, scaleVals),
    ]);
  }

  return clips;
}
