# GLB Assets

Test geometry for the ASCII creature pipeline.

## Current files (Three.js examples — for pipeline testing only)
- `Soldier.glb` — skinned biped, walk/run/idle
- `Horse.glb` — skinned quadruped, gallop
- `dungeon_warkarma.glb` — dungeon scene

## TODO: Replace with Quaternius Ultimate Monsters Pack
Download from: https://quaternius.com/packs/ultimatemonsters.html
- CC0 license — 50+ animated fantasy monsters in glTF format
- Drop GLBs (or convert FBX→GLB via Blender) into this directory
- Add entries to `viewer.html` CREATURES array with `type: 'glb', glbFile: 'glb/filename.glb'`

## FBX → GLB conversion (one-liner via Blender CLI)
```bash
blender --background --python-expr "
import bpy
bpy.ops.import_scene.fbx(filepath='INPUT.fbx')
bpy.ops.export_scene.gltf(filepath='OUTPUT.glb', export_format='GLB')
"
```
