"""
animate-creature.py — Blender headless animation clip generator for UD creatures.

Creates bone-level NLA animation clips (idle, walk, attack, hit, death, block, dodge)
for rigged GLB models that can't use Meshy's animation API (quadrupeds, spiders, etc.).

Usage:
  blender --background --python animate-creature.py -- input-rigged.glb output.glb quadruped
  blender --background --python animate-creature.py -- input.glb output.glb biped
  blender --background --python animate-creature.py -- input.glb output.glb --list-bones

Requires: Blender 4.0+ (brew install --cask blender)
"""

import sys
import math
import os

# ── Parse CLI args (after '--' separator) ────────────────────────────────

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

if len(argv) < 2:
    print("""
animate-creature.py — Blender headless animation generator

Usage:
  blender -b --python animate-creature.py -- <input.glb> <output.glb> <rig_type>

Rig types: biped, quadruped
Options:
  --list-bones    Print bone names and exit (no output file needed)
  --fps <N>       Animation FPS (default: 30)
""")
    sys.exit(1)

import bpy  # noqa: E402 — must import after args check so help works without Blender

INPUT_FILE = argv[0]
OUTPUT_FILE = argv[1] if len(argv) > 1 else None
RIG_TYPE = argv[2] if len(argv) > 2 else 'quadruped'
LIST_BONES = '--list-bones' in argv
FPS = 30

for i, a in enumerate(argv):
    if a == '--fps' and i + 1 < len(argv):
        FPS = int(argv[i + 1])

# ── Helpers ──────────────────────────────────────────────────────────────


def clear_scene():
    """Remove all objects from the default scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)


def import_glb(path):
    """Import a GLB file and return the armature object."""
    bpy.ops.import_scene.gltf(filepath=path)
    for obj in bpy.context.scene.objects:
        if obj.type == 'ARMATURE':
            return obj
    return None


def export_glb(path):
    """Export the scene as GLB."""
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_animations=True,
        export_nla_strips=True,
        export_current_frame=False,
    )
    size_kb = os.path.getsize(path) / 1024
    print(f'  Written: {os.path.basename(path)} ({size_kb:.1f} KB)')


def find_bone(armature, *candidates):
    """Find the first matching bone name from candidates."""
    for name in candidates:
        if name in armature.pose.bones:
            return armature.pose.bones[name]
    return None


def secs_to_frame(seconds):
    """Convert seconds to frame number."""
    return int(seconds * FPS) + 1  # Blender frames are 1-based


def set_bone_keyframe(bone, frame, channel, value):
    """Set a keyframe on a bone's transform channel.

    channel: 'location', 'rotation_euler', 'rotation_quaternion', 'scale'
    value: tuple/list of floats
    """
    setattr(bone, channel, value)
    bone.keyframe_insert(data_path=channel, frame=frame)


def create_action(armature, name, start_sec, end_sec):
    """Create a new NLA action and make it active."""
    action = bpy.data.actions.new(name=name)
    # Blender 5.x renamed animation_data_ensure → animation_data_create
    if hasattr(armature, 'animation_data_ensure'):
        armature.animation_data_ensure()
    elif hasattr(armature, 'animation_data_create'):
        armature.animation_data_create()
    elif not armature.animation_data:
        armature.animation_data_create()
    armature.animation_data.action = action

    # Set frame range
    action.frame_range = (secs_to_frame(0), secs_to_frame(end_sec))
    return action


def push_to_nla(armature, action, name):
    """Push the current action to an NLA strip so it exports as a named clip."""
    track = armature.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(action.frame_range[0]), action)
    strip.name = name
    armature.animation_data.action = None


# ── Bone name resolution ─────────────────────────────────────────────────
# Maps standard names to possible bone names in different rigs.

BONE_ALIASES = {
    # Quadruped bones
    'hips':         ['hips', 'Hips', 'root', 'Root'],
    'spine':        ['spine', 'Spine', 'Spine01'],
    'chest':        ['chest', 'Spine2', 'Spine02', 'Chest'],
    'neck':         ['neck', 'Neck'],
    'head':         ['head', 'Head'],
    'leg_front_L':  ['leg_front_L', 'FrontLeg_L', 'Front_Upper_Leg_L', 'LeftFrontLeg', 'mixamorig:LeftArm'],
    'foot_front_L': ['foot_front_L', 'FrontFoot_L', 'Front_Lower_Leg_L', 'LeftFrontFoot', 'mixamorig:LeftHand'],
    'leg_front_R':  ['leg_front_R', 'FrontLeg_R', 'Front_Upper_Leg_R', 'RightFrontLeg', 'mixamorig:RightArm'],
    'foot_front_R': ['foot_front_R', 'FrontFoot_R', 'Front_Lower_Leg_R', 'RightFrontFoot', 'mixamorig:RightHand'],
    'leg_back_L':   ['leg_back_L', 'BackLeg_L', 'Back_Upper_Leg_L', 'LeftBackLeg', 'mixamorig:LeftUpLeg'],
    'foot_back_L':  ['foot_back_L', 'BackFoot_L', 'Back_Lower_Leg_L', 'LeftBackFoot', 'mixamorig:LeftFoot'],
    'leg_back_R':   ['leg_back_R', 'BackLeg_R', 'Back_Upper_Leg_R', 'RightBackLeg', 'mixamorig:RightUpLeg'],
    'foot_back_R':  ['foot_back_R', 'BackFoot_R', 'Back_Lower_Leg_R', 'RightBackFoot', 'mixamorig:RightFoot'],
    'tail_01':      ['tail_01', 'Tail', 'Tail01'],
    'tail_02':      ['tail_02', 'Tail1', 'Tail02'],
    'tail_03':      ['tail_03', 'Tail2', 'Tail03'],
    # Biped bones
    'shoulder_L':   ['shoulder_L', 'mixamorig:LeftShoulder', 'LeftShoulder'],
    'arm_upper_L':  ['arm_upper_L', 'mixamorig:LeftArm', 'LeftArm'],
    'arm_lower_L':  ['arm_lower_L', 'mixamorig:LeftForeArm', 'LeftForeArm'],
    'hand_L':       ['hand_L', 'mixamorig:LeftHand', 'LeftHand'],
    'shoulder_R':   ['shoulder_R', 'mixamorig:RightShoulder', 'RightShoulder'],
    'arm_upper_R':  ['arm_upper_R', 'mixamorig:RightArm', 'RightArm'],
    'arm_lower_R':  ['arm_lower_R', 'mixamorig:RightForeArm', 'RightForeArm'],
    'hand_R':       ['hand_R', 'mixamorig:RightHand', 'RightHand'],
    'leg_upper_L':  ['leg_upper_L', 'mixamorig:LeftUpLeg', 'LeftUpLeg'],
    'leg_lower_L':  ['leg_lower_L', 'mixamorig:LeftLeg', 'LeftLeg'],
    'foot_L':       ['foot_L', 'mixamorig:LeftFoot', 'LeftFoot'],
    'leg_upper_R':  ['leg_upper_R', 'mixamorig:RightUpLeg', 'RightUpLeg'],
    'leg_lower_R':  ['leg_lower_R', 'mixamorig:RightLeg', 'RightLeg'],
    'foot_R':       ['foot_R', 'mixamorig:RightFoot', 'RightFoot'],
}


def resolve_bone(armature, standard_name):
    """Find a bone by standard name, trying all known aliases."""
    aliases = BONE_ALIASES.get(standard_name, [standard_name])
    return find_bone(armature, *aliases)


# ── Animation presets ────────────────────────────────────────────────────

def rad(degrees):
    return math.radians(degrees)


def animate_quadruped(armature):
    """Generate all animation clips for a quadruped rig."""
    bones = {}
    for name in ['hips', 'spine', 'chest', 'neck', 'head',
                  'leg_front_L', 'foot_front_L', 'leg_front_R', 'foot_front_R',
                  'leg_back_L', 'foot_back_L', 'leg_back_R', 'foot_back_R',
                  'tail_01', 'tail_02', 'tail_03']:
        b = resolve_bone(armature, name)
        if b:
            b.rotation_mode = 'XYZ'
            bones[name] = b

    found = list(bones.keys())
    missing = [n for n in ['hips', 'spine', 'head'] if n not in bones]
    print(f'  Found bones: {", ".join(found)}')
    if missing:
        print(f'  WARNING: missing critical bones: {", ".join(missing)}')

    # ── idle (2.2s loop) ──────────────────────────────────────────────
    action = create_action(armature, 'idle', 0, 2.2)

    if 'spine' in bones:
        for t, rx in [(0, 0), (1.1, rad(3)), (2.2, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'head' in bones:
        for t, rx in [(0, 0), (0.8, rad(-2)), (1.6, rad(2)), (2.2, 0)]:
            set_bone_keyframe(bones['head'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'tail_01' in bones:
        for t, rz in [(0, 0), (0.7, rad(8)), (1.4, rad(-8)), (2.2, 0)]:
            set_bone_keyframe(bones['tail_01'], secs_to_frame(t), 'rotation_euler', (0, 0, rz))

    push_to_nla(armature, action, 'idle')

    # ── walk (1.0s loop) — diagonal gait ──────────────────────────────
    action = create_action(armature, 'walk', 0, 1.0)

    # Diagonal pair: front_L + back_R swing forward, then front_R + back_L
    step = rad(25)
    for pair, phase_offset in [
        (['leg_front_L', 'leg_back_R'], 0),
        (['leg_front_R', 'leg_back_L'], 0.5),
    ]:
        for leg_name in pair:
            if leg_name not in bones:
                continue
            t0 = phase_offset
            t1 = (phase_offset + 0.25) % 1.0
            t2 = (phase_offset + 0.5) % 1.0
            times = sorted(set([0, t0, t1, t2, 1.0]))
            for t in times:
                phase = ((t - phase_offset) % 1.0) / 1.0
                angle = math.sin(phase * 2 * math.pi) * step
                set_bone_keyframe(bones[leg_name], secs_to_frame(t), 'rotation_euler', (angle, 0, 0))

    # Spine compression with walk
    if 'spine' in bones:
        for t, rx in [(0, 0), (0.25, rad(2)), (0.5, 0), (0.75, rad(2)), (1.0, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))

    push_to_nla(armature, action, 'walk')

    # ── attack (0.52s) — head lunge ───────────────────────────────────
    action = create_action(armature, 'attack', 0, 0.52)

    if 'head' in bones:
        for t, rx in [(0, 0), (0.07, rad(15)), (0.22, rad(-35)), (0.40, rad(-10)), (0.52, 0)]:
            set_bone_keyframe(bones['head'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'neck' in bones:
        for t, rx in [(0, 0), (0.07, rad(8)), (0.22, rad(-20)), (0.40, rad(-5)), (0.52, 0)]:
            set_bone_keyframe(bones['neck'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'spine' in bones:
        for t, rx in [(0, 0), (0.10, rad(5)), (0.22, rad(-10)), (0.52, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    # Front legs brace
    for leg in ['leg_front_L', 'leg_front_R']:
        if leg in bones:
            for t, rx in [(0, 0), (0.07, rad(10)), (0.22, rad(-15)), (0.52, 0)]:
                set_bone_keyframe(bones[leg], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))

    push_to_nla(armature, action, 'attack')

    # ── hit (0.32s) — recoil ─────────────────────────────────────────
    action = create_action(armature, 'hit', 0, 0.32)

    if 'head' in bones:
        for t, rx in [(0, 0), (0.07, rad(20)), (0.20, rad(10)), (0.32, 0)]:
            set_bone_keyframe(bones['head'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'spine' in bones:
        for t, rx in [(0, 0), (0.07, rad(8)), (0.20, rad(4)), (0.32, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))

    push_to_nla(armature, action, 'hit')

    # ── death (1.1s) — collapse ───────────────────────────────────────
    action = create_action(armature, 'death', 0, 1.1)

    if 'hips' in bones:
        for t, rx, rz in [(0, 0, 0), (0.4, rad(10), rad(15)), (0.8, rad(25), rad(40)), (1.1, rad(35), rad(60))]:
            set_bone_keyframe(bones['hips'], secs_to_frame(t), 'rotation_euler', (rx, 0, rz))
    if 'spine' in bones:
        for t, rx in [(0, 0), (0.5, rad(15)), (1.1, rad(30))]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    # Legs go limp — splay outward
    for leg, sign in [('leg_front_L', 1), ('leg_front_R', -1), ('leg_back_L', 1), ('leg_back_R', -1)]:
        if leg in bones:
            for t, rx, rz in [(0, 0, 0), (0.6, rad(20), rad(15) * sign), (1.1, rad(40), rad(30) * sign)]:
                set_bone_keyframe(bones[leg], secs_to_frame(t), 'rotation_euler', (rx, 0, rz))
    if 'head' in bones:
        for t, rx in [(0, 0), (0.4, rad(-10)), (0.8, rad(20)), (1.1, rad(45))]:
            set_bone_keyframe(bones['head'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    # Tail goes limp
    for tail, delay in [('tail_01', 0.1), ('tail_02', 0.2), ('tail_03', 0.3)]:
        if tail in bones:
            for t, rz in [(0, 0), (delay + 0.4, rad(20)), (1.1, rad(45))]:
                t_clamped = min(t, 1.1)
                set_bone_keyframe(bones[tail], secs_to_frame(t_clamped), 'rotation_euler', (0, 0, rz))

    push_to_nla(armature, action, 'death')

    # ── block (0.22s) — brace ─────────────────────────────────────────
    action = create_action(armature, 'block', 0, 0.22)

    if 'head' in bones:
        for t, rx in [(0, 0), (0.22, rad(25))]:  # duck head
            set_bone_keyframe(bones['head'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'spine' in bones:
        for t, rx in [(0, 0), (0.22, rad(8))]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    # Front legs brace wider
    for leg, rz in [('leg_front_L', rad(10)), ('leg_front_R', rad(-10))]:
        if leg in bones:
            set_bone_keyframe(bones[leg], secs_to_frame(0), 'rotation_euler', (0, 0, 0))
            set_bone_keyframe(bones[leg], secs_to_frame(0.22), 'rotation_euler', (rad(-8), 0, rz))

    push_to_nla(armature, action, 'block')

    # ── dodge (0.32s) — lateral dart ──────────────────────────────────
    action = create_action(armature, 'dodge', 0, 0.32)

    if 'hips' in bones:
        for t, rz in [(0, 0), (0.08, rad(20)), (0.20, rad(25)), (0.32, 0)]:
            set_bone_keyframe(bones['hips'], secs_to_frame(t), 'rotation_euler', (0, 0, rz))
    if 'spine' in bones:
        for t, rz in [(0, 0), (0.10, rad(-10)), (0.20, rad(-12)), (0.32, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (0, 0, rz))
    # All legs lift briefly during jump
    for leg_name in ['leg_front_L', 'leg_front_R', 'leg_back_L', 'leg_back_R']:
        if leg_name in bones:
            for t, rx in [(0, 0), (0.08, rad(-15)), (0.20, rad(-12)), (0.32, 0)]:
                set_bone_keyframe(bones[leg_name], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))

    push_to_nla(armature, action, 'dodge')

    print(f'  Created 7 animation clips for quadruped rig')


def animate_biped(armature):
    """Generate animation clips for biped rigs (humanoids).

    Bipeds usually get animations from Meshy, but this provides a fallback
    for cases where Meshy's API fails or for UniRig-rigged models.
    """
    bones = {}
    for name in ['hips', 'spine', 'chest', 'neck', 'head',
                  'shoulder_L', 'arm_upper_L', 'arm_lower_L', 'hand_L',
                  'shoulder_R', 'arm_upper_R', 'arm_lower_R', 'hand_R',
                  'leg_upper_L', 'leg_lower_L', 'foot_L',
                  'leg_upper_R', 'leg_lower_R', 'foot_R']:
        b = resolve_bone(armature, name)
        if b:
            b.rotation_mode = 'XYZ'
            bones[name] = b

    found = list(bones.keys())
    print(f'  Found bones: {", ".join(found)}')

    # ── idle (2.4s loop) ──────────────────────────────────────────────
    action = create_action(armature, 'idle', 0, 2.4)

    if 'spine' in bones:
        for t, rx in [(0, 0), (1.2, rad(2)), (2.4, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'head' in bones:
        for t, ry in [(0, 0), (0.8, rad(3)), (1.6, rad(-3)), (2.4, 0)]:
            set_bone_keyframe(bones['head'], secs_to_frame(t), 'rotation_euler', (0, ry, 0))
    # Arms slight sway
    for arm, sign in [('arm_upper_L', 1), ('arm_upper_R', -1)]:
        if arm in bones:
            for t, rz in [(0, 0), (1.2, rad(2) * sign), (2.4, 0)]:
                set_bone_keyframe(bones[arm], secs_to_frame(t), 'rotation_euler', (0, 0, rz))

    push_to_nla(armature, action, 'idle')

    # ── walk (1.2s loop) ──────────────────────────────────────────────
    action = create_action(armature, 'walk', 0, 1.2)

    step = rad(30)
    arm_swing = rad(20)
    for t_frac in [0, 0.25, 0.5, 0.75, 1.0]:
        t = t_frac * 1.2
        f = secs_to_frame(t)
        phase = t_frac * 2 * math.pi

        # Legs: opposite phase
        if 'leg_upper_L' in bones:
            set_bone_keyframe(bones['leg_upper_L'], f, 'rotation_euler', (math.sin(phase) * step, 0, 0))
        if 'leg_upper_R' in bones:
            set_bone_keyframe(bones['leg_upper_R'], f, 'rotation_euler', (-math.sin(phase) * step, 0, 0))
        # Arms: counter-swing
        if 'arm_upper_L' in bones:
            set_bone_keyframe(bones['arm_upper_L'], f, 'rotation_euler', (-math.sin(phase) * arm_swing, 0, 0))
        if 'arm_upper_R' in bones:
            set_bone_keyframe(bones['arm_upper_R'], f, 'rotation_euler', (math.sin(phase) * arm_swing, 0, 0))
        # Hips rotate
        if 'hips' in bones:
            set_bone_keyframe(bones['hips'], f, 'rotation_euler', (0, math.sin(phase) * rad(5), 0))

    push_to_nla(armature, action, 'walk')

    # ── attack (0.65s) ────────────────────────────────────────────────
    action = create_action(armature, 'attack', 0, 0.65)

    if 'arm_upper_R' in bones:
        for t, rx in [(0, 0), (0.10, rad(-60)), (0.28, rad(45)), (0.50, rad(20)), (0.65, 0)]:
            set_bone_keyframe(bones['arm_upper_R'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'arm_lower_R' in bones:
        for t, rx in [(0, 0), (0.10, rad(-30)), (0.28, rad(15)), (0.65, 0)]:
            set_bone_keyframe(bones['arm_lower_R'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'spine' in bones:
        for t, ry in [(0, 0), (0.10, rad(15)), (0.28, rad(-20)), (0.65, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (0, ry, 0))

    push_to_nla(armature, action, 'attack')

    # ── hit (0.38s) ───────────────────────────────────────────────────
    action = create_action(armature, 'hit', 0, 0.38)

    if 'spine' in bones:
        for t, rx in [(0, 0), (0.07, rad(-10)), (0.20, rad(-5)), (0.38, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'head' in bones:
        for t, rx in [(0, 0), (0.07, rad(15)), (0.20, rad(8)), (0.38, 0)]:
            set_bone_keyframe(bones['head'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))

    push_to_nla(armature, action, 'hit')

    # ── death (1.2s) ──────────────────────────────────────────────────
    action = create_action(armature, 'death', 0, 1.2)

    if 'hips' in bones:
        for t, rx, rz in [(0, 0, 0), (0.4, rad(15), rad(10)), (0.8, rad(30), rad(25)), (1.2, rad(45), rad(40))]:
            set_bone_keyframe(bones['hips'], secs_to_frame(t), 'rotation_euler', (rx, 0, rz))
    if 'spine' in bones:
        for t, rx in [(0, 0), (0.5, rad(20)), (1.2, rad(35))]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'head' in bones:
        for t, rx in [(0, 0), (0.4, rad(-15)), (0.8, rad(20)), (1.2, rad(50))]:
            set_bone_keyframe(bones['head'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    # Arms go limp
    for arm, sign in [('arm_upper_L', 1), ('arm_upper_R', -1)]:
        if arm in bones:
            for t, rz in [(0, 0), (0.6, rad(25) * sign), (1.2, rad(50) * sign)]:
                set_bone_keyframe(bones[arm], secs_to_frame(t), 'rotation_euler', (0, 0, rz))
    # Legs buckle
    for leg in ['leg_upper_L', 'leg_upper_R']:
        if leg in bones:
            for t, rx in [(0, 0), (0.5, rad(30)), (1.2, rad(60))]:
                set_bone_keyframe(bones[leg], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    for leg in ['leg_lower_L', 'leg_lower_R']:
        if leg in bones:
            for t, rx in [(0, 0), (0.5, rad(-40)), (1.2, rad(-80))]:
                set_bone_keyframe(bones[leg], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))

    push_to_nla(armature, action, 'death')

    # ── block (0.28s) ─────────────────────────────────────────────────
    action = create_action(armature, 'block', 0, 0.28)

    # Raise left arm to block, right arm stays ready
    if 'arm_upper_L' in bones:
        for t, rx, rz in [(0, 0, 0), (0.28, rad(-70), rad(30))]:
            set_bone_keyframe(bones['arm_upper_L'], secs_to_frame(t), 'rotation_euler', (rx, 0, rz))
    if 'arm_lower_L' in bones:
        for t, rx in [(0, 0), (0.28, rad(-60))]:
            set_bone_keyframe(bones['arm_lower_L'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    if 'spine' in bones:
        for t, ry in [(0, 0), (0.28, rad(10))]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (0, ry, 0))

    push_to_nla(armature, action, 'block')

    # ── dodge (0.35s) ─────────────────────────────────────────────────
    action = create_action(armature, 'dodge', 0, 0.35)

    if 'hips' in bones:
        for t, ry in [(0, 0), (0.10, rad(25)), (0.22, rad(30)), (0.35, 0)]:
            set_bone_keyframe(bones['hips'], secs_to_frame(t), 'rotation_euler', (0, ry, 0))
    if 'spine' in bones:
        for t, rx in [(0, 0), (0.10, rad(10)), (0.22, rad(8)), (0.35, 0)]:
            set_bone_keyframe(bones['spine'], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))
    # Legs: quick crouch and push
    for leg in ['leg_upper_L', 'leg_upper_R']:
        if leg in bones:
            for t, rx in [(0, 0), (0.10, rad(20)), (0.22, rad(15)), (0.35, 0)]:
                set_bone_keyframe(bones[leg], secs_to_frame(t), 'rotation_euler', (rx, 0, 0))

    push_to_nla(armature, action, 'dodge')

    print(f'  Created 7 animation clips for biped rig')


# ── Main ─────────────────────────────────────────────────────────────────

print(f'\nanimate-creature: {os.path.basename(INPUT_FILE)} → {RIG_TYPE}')

clear_scene()
armature = import_glb(INPUT_FILE)

if not armature:
    print('  ERROR: No armature found in GLB. Is the model rigged?')
    sys.exit(1)

print(f'  Armature: {armature.name}')
print(f'  Bones: {len(armature.pose.bones)}')

if LIST_BONES:
    print('\n  Bone hierarchy:')
    for bone in armature.data.bones:
        depth = 0
        parent = bone.parent
        while parent:
            depth += 1
            parent = parent.parent
        print(f'    {"  " * depth}{bone.name}')
    sys.exit(0)

bpy.context.scene.render.fps = FPS

# Remove any existing animations (from the imported GLB) to start clean
if armature.animation_data:
    for track in armature.animation_data.nla_tracks:
        armature.animation_data.nla_tracks.remove(track)
    if armature.animation_data.action:
        armature.animation_data.action = None

# Select the armature and enter pose mode
bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode='POSE')

animators = {
    'quadruped': animate_quadruped,
    'biped': animate_biped,
}

animator = animators.get(RIG_TYPE)
if not animator:
    print(f'  ERROR: Unknown rig type "{RIG_TYPE}". Use: {", ".join(animators.keys())}')
    sys.exit(1)

animator(armature)

bpy.ops.object.mode_set(mode='OBJECT')

if OUTPUT_FILE:
    export_glb(OUTPUT_FILE)

print('  Done.')
