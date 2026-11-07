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


def cube(name, loc, size, material, bevel=0.03, rot=(0, 0, 0), parent=None, keep_scale=False):
    """Cubo com dimensões `size` (x, y, z) centrado em `loc`, com cantos arredondados."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    if not keep_scale:
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
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
    P = {'root': root}
    h = head_scale
    skin_m = s
    brow_m = ha
    white = mat('sclera', (0.95, 0.95, 0.97), 0.3)
    pupil = mat('pupil', (0.015, 0.015, 0.02), 0.2)
    mouth_m = mat('mouth', (0.25, 0.08, 0.08), 0.5)
    mouth_dark = mat('mouthdark', (0.04, 0.01, 0.01), 0.6)
    P['hips'] = empty('hips', (0, 0, 0.75), root)
    cube('torso', (0, 0, 0.375), (0.55, 0.3, 0.75), sh, 0.04, parent=P['hips'])
    P['neck'] = empty('neck', (0, 0, 0.75), P['hips'])
    P['head'] = empty('head', (0, 0, 0.0), P['neck'])
    cube('skull', (0, 0, 0.27 * h), (0.5 * h, 0.5 * h, 0.5 * h), s, 0.04, parent=P['head'])
    cube('hair', (0, 0.01, 0.55 * h), (0.54 * h, 0.54 * h, 0.14 * h), ha, 0.04, parent=P['head'])
    cube('hairback', (0, 0.1 * h, 0.3 * h), (0.54 * h, 0.3 * h, 0.5 * h), ha, 0.04, parent=P['head'])
    cube('fringe', (0, -0.26 * h, 0.52 * h), (0.54 * h, 0.05, 0.09 * h), ha, 0.02, parent=P['head'])
    F = {'h': h, 'white': white, 'pupil': pupil, 'skin': skin_m}
    fy = -0.255 * h
    for side, x in (('L', -0.125 * h), ('R', 0.125 * h)):
        F['eye' + side] = cube('eye' + side, (x, fy, 0.30 * h), (0.12 * h, 0.02, 0.14 * h), white, 0.012, parent=P['head'])
        F['pupil' + side] = cube('pupil' + side, (x, fy - 0.012, 0.30 * h), (0.06 * h, 0.02, 0.075 * h), pupil, 0.008, parent=P['head'])
        F['lid' + side] = cube('lid' + side, (x, fy - 0.02, 0.37 * h), (0.13 * h, 0.03, 1.0), skin_m, 0.0, parent=P['head'], keep_scale=True)
        F['brow' + side] = cube('brow' + side, (x, fy - 0.015, 0.43 * h), (0.15 * h, 0.025, 0.035 * h), brow_m, 0.008, parent=P['head'])
        F['tear' + side] = None
    F['mouthC'] = cube('mouthC', (0, fy - 0.005, 0.10 * h), (0.10 * h, 0.02, 0.028 * h), mouth_m, 0.006, parent=P['head'])
    F['mouthL'] = cube('mouthL', (-0.07 * h, fy - 0.005, 0.10 * h), (0.06 * h, 0.02, 0.028 * h), mouth_m, 0.006, parent=P['head'])
    F['mouthR'] = cube('mouthR', (0.07 * h, fy - 0.005, 0.10 * h), (0.06 * h, 0.02, 0.028 * h), mouth_m, 0.006, parent=P['head'])
    F['mouthO'] = cube('mouthO', (0, fy - 0.003, 0.10 * h), (0.10 * h, 0.02, 1.0), mouth_dark, 0.0, parent=P['head'], keep_scale=True)
    P['face'] = F
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


def set_face(P, brow=0.0, brow_lift=0.0, lid=0.0, gaze=(0.0, 0.0), smile=0.0, mouth_open=0.0, screen_eyes=False, blue=(0.3, 0.6, 1.0)):
    """Expressão do rosto.

    brow: -1 (zangado) a +1 (preocupado/triste); brow_lift: sobrancelhas para cima (surpresa);
    lid: 0 aberto a 1 fechado; gaze: (x, z) do olhar de -1 a 1; smile: -1 (tristeza) a +1 (sorriso);
    mouth_open: 0 a 1; screen_eyes: olhos fixos e azuis, a refletir um ecrã.
    """
    F = P['face']
    h = F['h']
    th = math.radians
    for side, sign in (('L', -1), ('R', 1)):
        # sobrancelha: ponta interior sobe quando preocupado
        F['brow' + side].rotation_euler = (0, th(sign * 26 * brow), 0)
        F['brow' + side].location.z = (0.43 + 0.07 * brow_lift + 0.02 * abs(brow)) * h
        # pálpebra: cobre a parte de cima do olho
        eh = 0.14 * h
        hgt = max(0.0001, lid * eh)
        F['lid' + side].scale = (0.13 * h, 0.03, hgt)
        F['lid' + side].location.z = (0.30 * h + eh / 2) - hgt / 2
        # olhar
        F['pupil' + side].location.x = (-0.125 if side == 'L' else 0.125) * h + gaze[0] * 0.028 * h
        F['pupil' + side].location.z = 0.30 * h + gaze[1] * 0.03 * h
        if screen_eyes:
            F['pupil' + side].data.materials[0] = mat('scr' + side, blue, 0.2, emit=6.0, emit_color=blue)
            F['pupil' + side].scale = (1.6, 1.0, 1.4)
            F['eye' + side].data.materials[0] = mat('scrw' + side, (0.05, 0.08, 0.16), 0.3)
    # boca: curva de sorriso com três segmentos
    ang = th(30) * smile
    F['mouthL'].rotation_euler = (0, ang, 0)
    F['mouthR'].rotation_euler = (0, -ang, 0)
    F['mouthL'].location.z = (0.10 + 0.02 * smile) * h
    F['mouthR'].location.z = (0.10 + 0.02 * smile) * h
    F['mouthC'].location.z = (0.10 - 0.012 * smile) * h
    op = max(0.0001, mouth_open * 0.12 * h)
    F['mouthO'].scale = (0.10 * h, 0.02, op)
    F['mouthO'].location.z = 0.10 * h - op / 2
    F['mouthO'].hide_render = mouth_open <= 0.01


def tear(P, side='R', z=0.2):
    """Pequena lágrima azul numa das faces."""
    F = P['face']
    h = F['h']
    x = (0.125 if side == 'R' else -0.125) * h
    return cube('tear', (x, -0.262 * h, z * h), (0.03, 0.02, 0.06), mat('tear', (0.5, 0.75, 1.0), 0.1, emit=2.0, emit_color=(0.5, 0.75, 1.0)), 0.008, parent=P['head'])


_FONT = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'


def text3d(body, loc, size=0.3, color=(1, 1, 1), emit=3.0, rot=(math.radians(90), 0, 0), extrude=0.02, align='CENTER'):
    """Texto 3D (movimento gráfico 2.5D) emissivo, com a fonte Inter Bold."""
    cu = bpy.data.curves.new('t', 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.font = bpy.data.fonts.load(_FONT)
    o = bpy.data.objects.new('text', cu)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(mat('txt', color, 0.4, emit=emit, emit_color=color))
    return o


def sun_logo(loc, size=0.5, color=(1, 1, 1), emit=4.0, rot=(math.radians(90), 0, 0)):
    """Sol a nascer feito de cubos (logótipo do offly)."""
    root = empty('sunlogo', loc)
    root.rotation_euler = rot
    m = mat('sunm', color, 0.4, emit=emit, emit_color=color)
    for i, deg in enumerate((-60, -30, 0, 30, 60)):
        a = math.radians(deg)
        r = size * 0.62
        cube('ray%d' % i, (math.sin(a) * r, 0, math.cos(a) * r + size * 0.1), (size * 0.07, size * 0.04, size * 0.2), m, size * 0.02, rot=(0, a, 0), parent=root)
    cube('sunbody', (0, 0, size * 0.18), (size * 0.62, size * 0.04, size * 0.36), m, size * 0.08, parent=root)
    cube('horizon', (0, 0, -0.02 * size), (size * 1.5, size * 0.04, size * 0.07), m, size * 0.03, parent=root)
    return root
