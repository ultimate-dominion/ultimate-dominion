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
import { RIGS } from './creature-rigs.js';

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
  const {
    palette, gridW, gridH, body, limbs = [], tail, head,
    accessories = [], weapons = [],
    rig: rigName,
    skinColor, armorColor, weaponColor,
  } = spec;
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

  // Per-part color overrides — skin vs armor vs weapon can differ
  // skinColor  → near limbs, head, exposed flesh
  // armorColor → body segments, far limbs, clothing
  // weaponColor → weapon geometry
  function colorMat(rgb) {
    return makeMat(new THREE.Color(rgb[0]/255, rgb[1]/255, rgb[2]/255), gradMap);
  }
  const matSkin   = skinColor   ? colorMat(skinColor)   : matLight;
  const matArmor  = armorColor  ? colorMat(armorColor)  : matMid;
  const matWeapon = weaponColor ? colorMat(weaponColor) : matLight;
  const matWeaponEdge = makeMat(paletteColor(palette, iRim), gradMap); // bright edge highlight

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
    // Head uses skinMat (exposed flesh), body uses armorMat (clothing/scales)
    const mat = isHead ? matSkin : matArmor;
    group.add(sphereMesh(pos, r, mat, isHead ? 1.5 : 1.3, 1.0, isHead ? 0.75 : 0.65));

    // Cylinder segment to next spine node
    if (i < spineNodes.length - 1) {
      const next = spineNodes[i + 1];
      const p2 = toV3(next.x, next.y, 0);
      const r2 = toR(next.radius);
      const seg = segmentMesh(pos, p2, r, r2, matArmor);
      if (seg) group.add(seg);
    }
  });

  // ---- Belly plate (lighter underside) -------------------------------------
  if (spineNodes.length >= 4) {
    const s1 = spineNodes[Math.floor(spineNodes.length * 0.25)];
    const s2 = spineNodes[Math.floor(spineNodes.length * 0.75)];
    const bellyY = Math.max(s1.y, s2.y) + 0.04;
    const bellyX = (s1.x + s2.x) / 2;
    const bellyR = toR((s1.radius + s2.radius) / 2 * 0.7);
    const bellyW = Math.abs(toX(s2.x) - toX(s1.x)) * 0.8;
    const belly = new THREE.Mesh(
      new THREE.CapsuleGeometry(bellyR * 0.5, bellyW, 8, 8),
      matSkin  // belly = exposed skin color
    );
    belly.position.set(toX(bellyX), toY(bellyY) - bellyR * 0.3, -bellyR * 0.1);
    belly.rotation.z = Math.PI / 2;
    belly.scale.set(1, 0.5, 0.4);
    group.add(belly);
  }

  // ---- Limbs ---------------------------------------------------------------
  limbs.forEach(limb => {
    const zOff = limb.side === 'far' ? -0.06 : 0.10;
    const baseR = toR(limb.radius ?? 0.04);
    // near limbs = front-facing skin; far limbs = behind-body shadow/armor
    const limbMat = limb.side === 'far' ? matShadow : matSkin;
    limb.positions.forEach((pos, i) => {
      const r = baseR * (1 - i * 0.18);
      const p = toV3(pos[0], pos[1], zOff);
      group.add(sphereMesh(p, r, limbMat, 1, 1, 0.75));

      if (i > 0) {
        const prev = limb.positions[i - 1];
        const p1 = toV3(prev[0], prev[1], zOff);
        const r1 = baseR * (1 - (i - 1) * 0.18);
        const seg = segmentMesh(p1, p, r1, r, limbMat);
        if (seg) group.add(seg);
      }
    });

    // Claw tips
    const last = limb.positions[limb.positions.length - 1];
    const clawMat = matSkin;
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

  // ---- Weapons ---------------------------------------------------------------
  // Built after limbs so weapon group can find the hand tip position.
  // The weapon Group is named 'weapon' so animation tracks can target it.
  let weaponGroup = null;
  if (weapons.length > 0) {
    weaponGroup = _buildWeaponGroup(weapons[0], spec.limbs ?? [], {
      toX, toY, toR, toV3, matWeapon, matWeaponEdge, matShadow, matRim,
    });
    if (weaponGroup) group.add(weaponGroup);
  }

  // ---- Camera + AnimationMixer --------------------------------------------
  const camera = makeCreatureCamera(gridW, gridH);
  const mixer = new THREE.AnimationMixer(group);

  // Resolve rig — use named rig or fall back to legacy buildStandardClips
  const rig = rigName ? RIGS[rigName] : null;
  const clips = rig
    ? _buildRigClips(rig, weaponGroup)
    : _buildLegacyClips(group);

  const actions = {};
  Object.entries(clips).forEach(([name, clip]) => {
    const action = mixer.clipAction(clip);
    const clipDef = rig?.clips[name];
    if (clipDef) {
      action.loop = clipDef.loop === 'once' ? THREE.LoopOnce : THREE.LoopRepeat;
      action.clampWhenFinished = clipDef.clampWhenFinished ?? false;
    }
    actions[name] = action;
  });

  // Start idle by default
  actions.idle?.play();
  let currentAction = actions.idle ?? null;

  function playClip(name, fadeTime = 0.15) {
    const next = actions[name];
    if (!next || next === currentAction) return;
    if (currentAction) currentAction.crossFadeTo(next, fadeTime, false);
    // Reset one-shot clips so they play from the start
    if (next.loop === THREE.LoopOnce) {
      next.reset();
    }
    next.play();
    currentAction = next;

    const clipDef = rig?.clips[name];
    const shouldReturnToIdle = clipDef ? clipDef.returnToIdle : (name === 'hit' || name === 'attack');
    if (shouldReturnToIdle) {
      const onFinish = (e) => {
        if (e.action !== next) return;
        mixer.removeEventListener('finished', onFinish);
        playClip('idle', 0.22);
      };
      mixer.addEventListener('finished', onFinish);
    }
  }

  // Expose stances so callers can apply a random starting pose.
  // Usage: const s = bundle.stances[Math.floor(Math.random()*3)];
  //        bundle.group.position.set(...s.position);
  //        bundle.group.rotation.set(...s.rotation);
  //        bundle.group.scale.set(...s.scale);
  const stances = rig?.stances ?? [{ position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] }];

  return { scene, camera, group, mixer, clips, actions, playClip, weaponGroup, stances };
}

// --------------------------------------------------------------------------
// Rig-based animation clips
// --------------------------------------------------------------------------

/**
 * Build AnimationClips from a rig definition.
 * Tracks targeting 'weapon.*' are skipped if no weaponGroup exists.
 */
function _buildRigClips(rig, weaponGroup) {
  const clips = {};
  for (const [clipName, clipDef] of Object.entries(rig.clips)) {
    const tracks = [];
    for (const t of clipDef.tracks) {
      if (t.path.startsWith('weapon') && !weaponGroup) continue;
      tracks.push(new THREE.VectorKeyframeTrack(t.path, t.times, t.values));
    }
    clips[clipName] = new THREE.AnimationClip(clipName, clipDef.duration, tracks);
  }
  return clips;
}

/**
 * Legacy clips for creatures without a rig (fallback).
 * Fixed to use '.' prefix paths so Three.js PropertyBinding resolves to root.
 */
function _buildLegacyClips() {
  const clips = {};
  clips.idle = new THREE.AnimationClip('idle', 2.4, [
    new THREE.VectorKeyframeTrack('.scale', [0, 1.2, 2.4], [1,1,1, 1,1.025,1, 1,1,1]),
  ]);
  clips.attack = new THREE.AnimationClip('attack', 0.65, [
    new THREE.VectorKeyframeTrack('.position', [0, 0.18, 0.38, 0.65], [0,0,0, -0.18,0.04,0, -0.26,0.02,0, 0,0,0]),
  ]);
  clips.block = new THREE.AnimationClip('block', 0.28, [
    new THREE.VectorKeyframeTrack('.position', [0, 0.28], [0,0,0, 0.18,0,0]),
  ]);
  clips.hit = new THREE.AnimationClip('hit', 0.28, [
    new THREE.VectorKeyframeTrack('.position', [0, 0.08, 0.28], [0,0,0, 0.20,0,0, 0,0,0]),
  ]);
  clips.death = new THREE.AnimationClip('death', 1.20, [
    new THREE.VectorKeyframeTrack('.position', [0, 0.5, 1.20], [0,0,0, 0,-0.2,0, 0,-0.7,0]),
    new THREE.VectorKeyframeTrack('.scale',    [0, 0.6, 1.20], [1,1,1, 0.9,0.7,0.9, 0,0,0]),
  ]);
  return clips;
}

// --------------------------------------------------------------------------
// Weapon geometry
// --------------------------------------------------------------------------

/**
 * Build a weapon Group positioned at the weapon hand tip.
 * The Group is named 'weapon' so animation tracks can target it.
 * Grip is at the Group's local origin — rotation animates around grip point.
 */
function _buildWeaponGroup(weaponSpec, limbSpecs, { toX, toY, toR, toV3, matWeapon, matWeaponEdge, matShadow, matRim }) {
  const { type = 'axe', hand = 'near', size = 0.15 } = weaponSpec;
  const s = toR(size);

  // Find the weapon hand's tip position from limb specs
  const handLimb = limbSpecs.find(l => l.side === hand);
  if (!handLimb || !handLimb.positions?.length) return null;

  const tip = handLimb.positions[handLimb.positions.length - 1];
  const zOff = hand === 'near' ? 0.12 : -0.08;
  const handPos = toV3(tip[0], tip[1], zOff);

  const wGroup = new THREE.Group();
  wGroup.name = 'weapon';
  wGroup.position.copy(handPos);

  if (type === 'axe') {
    // Handle: from grip (y=0) upward
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.055, s * 0.07, s * 1.15, 6),
      matWeapon
    );
    handle.position.set(0, s * 0.575, 0);
    wGroup.add(handle);

    // Axe head: box offset to one side (cutting edge left = toward player)
    const axeHead = new THREE.Mesh(
      new THREE.BoxGeometry(s * 0.75, s * 0.28, s * 0.14),
      matWeapon
    );
    axeHead.position.set(-s * 0.18, s * 1.08, 0);
    wGroup.add(axeHead);

    // Cutting edge highlight — bright rim to catch the glow in ASCII
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(s * 0.08, s * 0.32, s * 0.16),
      matWeaponEdge
    );
    edge.position.set(-s * 0.54, s * 1.08, 0);
    wGroup.add(edge);

    // Back spike (rear of axe head)
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(s * 0.06, s * 0.22, 4),
      matWeapon
    );
    spike.position.set(s * 0.40, s * 1.05, 0);
    spike.rotation.z = -Math.PI / 2;
    wGroup.add(spike);

  } else if (type === 'sword') {
    // Blade: thin cylinder from grip upward
    const blade = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.03, s * 0.05, s * 1.4, 6),
      matWeapon
    );
    blade.position.set(0, s * 0.7, 0);
    wGroup.add(blade);

    // Crossguard
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(s * 0.55, s * 0.08, s * 0.12),
      matShadow
    );
    guard.position.set(0, s * 0.18, 0);
    wGroup.add(guard);

    // Blade tip highlight
    const tip2 = new THREE.Mesh(
      new THREE.ConeGeometry(s * 0.03, s * 0.18, 4),
      matWeaponEdge
    );
    tip2.position.set(0, s * 1.47, 0);
    wGroup.add(tip2);

  } else if (type === 'staff') {
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.045, s * 0.055, s * 1.5, 6),
      matWeapon
    );
    pole.position.set(0, s * 0.75, 0);
    wGroup.add(pole);

    // Orb at top
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(s * 0.14, 8, 6),
      matRim  // bright glow-triggering color
    );
    orb.position.set(0, s * 1.56, 0);
    wGroup.add(orb);

  } else if (type === 'spear') {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.04, s * 0.05, s * 1.6, 6),
      matWeapon
    );
    shaft.position.set(0, s * 0.8, 0);
    wGroup.add(shaft);

    const speartip = new THREE.Mesh(
      new THREE.ConeGeometry(s * 0.07, s * 0.28, 4),
      matWeaponEdge
    );
    speartip.position.set(0, s * 1.74, 0);
    wGroup.add(speartip);

  } else if (type === 'claw') {
    // Just the claw tip cluster — 3 curved spikes
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(
        new THREE.ConeGeometry(s * 0.055, s * 0.35, 4),
        matWeaponEdge
      );
      claw.position.set(i * s * 0.18, s * 0.22, 0.02);
      claw.rotation.z = i * 0.22;
      wGroup.add(claw);
    }
  }

  return wGroup;
}
