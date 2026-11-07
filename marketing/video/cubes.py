"""Biblioteca mínima de cenas em cubos (estilo voxel polido) para o Blender (bpy).

Tudo é feito de cubos com bisel, materiais lisos e luz de ray tracing (Cycles).
"""
import math
import bpy
from mathutils import Vector


def reset(width=540, height=960, samples=48, fps=24):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.render.resolution_x, sc.render.resolution_y = width, height
    sc.render.resolution_percentage = 100
    sc.render.fps = fps
    sc.render.image_settings.file_format = 'PNG'
    sc.view_settings.view_transform = 'Filmic' if 'Filmic' in [v.identifier for v in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'AgX'
    return sc


def mat(name, color, rough=0.45, emit=0.0, emit_color=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    if emit > 0:
        b.inputs['Emission Color'].default_value = (*(emit_color or color), 1)
        b.inputs['Emission Strength'].default_value = emit
    return m


def cube(name, loc, size, material, bevel=0.03, rot=(0, 0, 0), parent=None):
    """Cubo com dimensões `size` (x, y, z) centrado em `loc`, com cantos arredondados."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    mod = o.modifiers.new('bevel', 'BEVEL')
    mod.width = bevel
    mod.segments = 3
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    if parent:
        e.parent = parent
    return e


def character(skin, shirt, pants, hair, scale=1.0, head_scale=1.0):
    """Personagem de cubos com articulações (pivôs). Frente = -Y.

    Rodar o pivô 'armL'/'armR' em X negativo levanta o braço para a frente; 'legL'/'legR' em
    X = -90 graus senta-o; 'head' em X positivo faz a cabeça cair para a frente.
    """
    root = empty('root')
    root.scale = (scale,) * 3
    s, sh, pa, ha = (mat('skin', skin, 0.55), mat('shirt', shirt, 0.7), mat('pants', pants, 0.7), mat('hair', hair, 0.8))
    eye_m = mat('eye', (0.015, 0.015, 0.02), 0.2)
    P = {'root': root}
    P['hips'] = empty('hips', (0, 0, 0.75), root)
    cube('torso', (0, 0, 0.375), (0.55, 0.3, 0.75), sh, 0.04, parent=P['hips'])
    P['neck'] = empty('neck', (0, 0, 0.75), P['hips'])
    P['head'] = empty('head', (0, 0, 0.0), P['neck'])
    h = head_scale
    cube('skull', (0, 0, 0.27 * h), (0.5 * h, 0.5 * h, 0.5 * h), s, 0.04, parent=P['head'])
    cube('hair', (0, 0.01, 0.55 * h), (0.54 * h, 0.54 * h, 0.14 * h), ha, 0.04, parent=P['head'])
    cube('fringe', (0, -0.26 * h, 0.44 * h), (0.54 * h, 0.06, 0.16 * h), ha, 0.03, parent=P['head'])
    cube('eyeL', (-0.12 * h, -0.255 * h, 0.3 * h), (0.09, 0.03, 0.09), eye_m, 0.01, parent=P['head'])
    cube('eyeR', (0.12 * h, -0.255 * h, 0.3 * h), (0.09, 0.03, 0.09), eye_m, 0.01, parent=P['head'])
    for side, x in (('L', -0.4), ('R', 0.4)):
        P['arm' + side] = empty('arm' + side, (x, 0, 0.7), P['hips'])
        cube('arm' + side + 'm', (0, 0, -0.34), (0.25, 0.25, 0.7), s, 0.04, parent=P['arm' + side])
        cube('sleeve' + side, (0, 0, -0.1), (0.27, 0.27, 0.22), sh, 0.04, parent=P['arm' + side])
    for side, x in (('L', -0.15), ('R', 0.15)):
        P['leg' + side] = empty('leg' + side, (x, 0, 0.0), P['hips'])
        cube('leg' + side + 'm', (0, 0, -0.375), (0.27, 0.29, 0.75), pa, 0.04, parent=P['leg' + side])
    return P


def sun_and_world(strength=0.6, color=(0.04, 0.05, 0.09)):
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (*color, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = strength
    bpy.context.scene.world = w


def area_light(name, loc, rot, energy, color, size=1.5):
    bpy.ops.object.light_add(type='AREA', location=loc, rotation=rot)
    l = bpy.context.active_object
    l.name = name
    l.data.energy = energy
    l.data.color = color
    l.data.size = size
    return l


def aim(obj, target):
    """Aponta uma luz ou câmara para um ponto (eixo -Z para o alvo)."""
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def camera(loc, target, lens=50, dof_dist=None, fstop=2.8):
    bpy.ops.object.camera_add(location=loc)
    c = bpy.context.active_object
    c.data.lens = lens
    direction = Vector(target) - Vector(loc)
    c.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    if dof_dist:
        c.data.dof.use_dof = True
        c.data.dof.focus_distance = dof_dist
        c.data.dof.aperture_fstop = fstop
    bpy.context.scene.camera = c
    return c
