"""
convert-fbx.py — Batch convert FBX files to GLB using Blender.

Usage (run from the glb/ directory):
  blender --background --python convert-fbx.py -- input.fbx
  blender --background --python convert-fbx.py -- *.fbx        # glob won't expand in blender, use the loop below
  blender --background --python convert-fbx.py -- /path/to/quaternius-monsters/

Run for a whole directory:
  for f in ~/Downloads/QuaterniusMonsters/*.fbx; do
    blender --background --python convert-fbx.py -- "$f"
  done

Or run all at once via the shell helper at the bottom of this file.
"""

import bpy
import sys
import os
import glob

def convert(fbx_path):
    out_path = os.path.splitext(fbx_path)[0] + '.glb'
    print(f'[convert] {fbx_path} → {out_path}')

    # Clear scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import FBX
    bpy.ops.import_scene.fbx(
        filepath=fbx_path,
        use_anim=True,          # include animations
        ignore_leaf_bones=True, # cleaner rig
        force_connect_children=False,
        automatic_bone_orientation=True,
    )

    # Export GLB — embed everything (no separate .bin/.png files)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format='GLB',
        export_animations=True,
        export_skins=True,
        export_apply=False,     # keep original transforms
        export_yup=True,        # Three.js expects Y-up
    )
    print(f'[convert] done → {out_path}')

# ---- main ---------------------------------------------------------------

argv = sys.argv
if '--' in argv:
    args = argv[argv.index('--') + 1:]
else:
    args = []

if not args:
    print('Usage: blender --background --python convert-fbx.py -- <file_or_dir>')
    sys.exit(1)

for arg in args:
    if os.path.isdir(arg):
        fbx_files = glob.glob(os.path.join(arg, '**', '*.fbx'), recursive=True)
        for f in fbx_files:
            convert(f)
    elif arg.endswith('.fbx') and os.path.isfile(arg):
        convert(arg)
    else:
        print(f'[convert] skipping {arg} (not an FBX file or directory)')
