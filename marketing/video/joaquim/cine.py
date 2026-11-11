"""Biblioteca de cena «cinema» para o Blender (bpy): personagens arredondadas com rosto animável,
o Offy luminoso, adereços, luz e câmara com profundidade de campo. Render Cycles (CPU)."""
import math
import os
import random

import bmesh
import bpy
from mathutils import Vector

R = math.radians
FPS = 24
_MATS = {}
FONT = None
FONT_PATHS = [
    os.path.join(os.path.dirname(__file__), '..', '..', '..', 'node_modules', '@expo-google-fonts', 'inter', '700Bold', 'Inter_700Bold.ttf'),
    os.path.join(os.path.dirname(__file__), '..', 'fonts', 'PixelifySans.ttf'),
]


def F(t):
    return 1 + int(round(t * FPS))


def reset(w=540, h=960, samples=32):
    global FONT
    _MATS.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    c = sc.cycles
    c.device = 'CPU'
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.04
    c.use_denoising = True
    c.max_bounces = 4
    c.diffuse_bounces = 2
    c.glossy_bounces = 2
    c.transmission_bounces = 3
    c.transparent_max_bounces = 6
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 4.0
    c.seed = 7
    c.use_animated_seed = False
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.fps = FPS
    sc.render.image_settings.file_format = 'PNG'
    sc.render.use_persistent_data = True
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    FONT = None
    for p in FONT_PATHS:
        if os.path.exists(p):
            FONT = bpy.data.fonts.load(os.path.abspath(p))
            break
    return sc


def world(color=(0.01, 0.01, 0.015), strength=1.0):
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (*color, 1)
    bg.inputs['Strength'].default_value = strength
    bpy.context.scene.world = w
    return bg


def mat(name, color, rough=0.5, emit=0.0, emit_color=None, metallic=0.0, transmission=0.0, alpha=1.0):
    if name in _MATS:
        return _MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metallic
    if transmission:
        b.inputs['Transmission Weight'].default_value = transmission
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    if emit > 0:
        b.inputs['Emission Color'].default_value = (*(emit_color or color), 1)
        b.inputs['Emission Strength'].default_value = emit
    _MATS[name] = m
    return m


def bsdf(m):
    return m.node_tree.nodes['Principled BSDF']


def _finish(o, name, m, parent, smooth=True):
    o.name = name
    if smooth:
        bpy.ops.object.shade_smooth()
    if m is not None:
        o.data.materials.append(m)
    if parent is not None:
        o.parent = parent
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.empty_display_size = 0.05
    if parent is not None:
        o.parent = parent
    return o


def box(name, loc, size, m, bevel=0.02, rot=(0, 0, 0), parent=None, seg=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = min(bevel, min(size) * 0.49)
        mod.segments = seg
    return _finish(o, name, m, parent)


def pill(name, length, radius, m, parent=None, loc=(0, 0, 0)):
    """Cápsula a pender para -Z a partir de `loc` (o pai é a articulação)."""
    return box(name, (loc[0], loc[1], loc[2] - length / 2), (radius * 2, radius * 2, length + radius), m, bevel=radius * 0.98, parent=parent, seg=5)


def ball(name, loc, r, m, scale=(1, 1, 1), parent=None, seg=28, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2, rotation=rot)
    o = bpy.context.active_object
    o.scale = scale
    return _finish(o, name, m, parent)


def cyl(name, loc, r, depth, m, rot=(0, 0, 0), parent=None, verts=28, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object
    if bevel > 0:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
    o = _finish(o, name, m, parent)
    for p in o.data.polygons:
        p.use_smooth = True
    try:
        o.data.use_auto_smooth = True
    except Exception:
        mod = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
    return o


def torus(name, loc, major, minor, m, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot, major_segments=40, minor_segments=10)
    return _finish(bpy.context.active_object, name, m, parent)


def cut(o, keep):
    """Remove os vértices para os quais keep(co) é falso."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co)], context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    return o


def text(body, loc, size, m, rot=(R(90), 0, 0), parent=None, extrude=0.0, align='CENTER', name=None):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.data.body = body
    o.data.size = size
    o.data.align_x = align
    o.data.align_y = 'CENTER'
    o.data.extrude = extrude
    if FONT:
        o.data.font = FONT
    o.name = name or ('txt_' + body[:8])
    o.data.materials.append(m)
    if parent is not None:
        o.parent = parent
    return o


# ------------------------------------------------------------------ luz e câmara
def aim(o, target):
    o.rotation_euler = (Vector(target) - Vector(o.location)).to_track_quat('-Z', 'Y').to_euler()


def area(name, loc, target, energy, color=(1, 1, 1), size=1.0, parent=None):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.active_object
    l.name = name
    l.data.energy = energy
    l.data.color = color
    l.data.size = size
    aim(l, target)
    if parent is not None:
        l.parent = parent
    return l


def point(name, loc, energy, color=(1, 1, 1), radius=0.1, parent=None):
    bpy.ops.object.light_add(type='POINT', location=loc)
    l = bpy.context.active_object
    l.name = name
    l.data.energy = energy
    l.data.color = color
    l.data.shadow_soft_size = radius
    if parent is not None:
        l.parent = parent
    return l


def spot(name, loc, target, energy, color=(1, 1, 1), angle=50, blend=0.4, radius=0.1):
    bpy.ops.object.light_add(type='SPOT', location=loc)
    l = bpy.context.active_object
    l.name = name
    l.data.energy = energy
    l.data.color = color
    l.data.spot_size = R(angle)
    l.data.spot_blend = blend
    l.data.shadow_soft_size = radius
    aim(l, target)
    return l


def sun(name, rot_deg, strength, color=(1, 1, 1), angle=3):
    bpy.ops.object.light_add(type='SUN', rotation=tuple(R(a) for a in rot_deg))
    l = bpy.context.active_object
    l.name = name
    l.data.energy = strength
    l.data.color = color
    l.data.angle = R(angle)
    return l


def camera(loc, target, lens=40, fstop=2.0):
    bpy.ops.object.camera_add(location=loc)
    c = bpy.context.active_object
    c.data.lens = lens
    c.data.sensor_fit = 'VERTICAL'
    c.data.sensor_height = 36
    aim(c, target)
    c.data.dof.use_dof = True
    c.data.dof.aperture_fstop = fstop
    c.data.dof.focus_distance = (Vector(target) - Vector(loc)).length
    bpy.context.scene.camera = c
    return c


def cam_move(cam, seq, focus=None):
    """seq: [(t, loc, target)]. O foco segue a distância ao alvo, salvo `focus` [(t, dist)]."""
    prev = None
    for t, l, tg in seq:
        cam.location = l
        q = (Vector(tg) - Vector(l)).to_track_quat('-Z', 'Y')
        e = q.to_euler('XYZ', prev) if prev else q.to_euler()
        prev = e
        cam.rotation_euler = e
        cam.keyframe_insert('location', frame=F(t))
        cam.keyframe_insert('rotation_euler', frame=F(t))
        if not focus:
            cam.data.dof.focus_distance = (Vector(tg) - Vector(l)).length
            cam.data.dof.keyframe_insert('focus_distance', frame=F(t))
    for t, d in focus or []:
        cam.data.dof.focus_distance = d
        cam.data.dof.keyframe_insert('focus_distance', frame=F(t))


# ------------------------------------------------------------------ keyframes
def K(o, path, t, v):
    setattr(o, path, v)
    o.keyframe_insert(path, frame=F(t))


def rot(o, t, x=None, y=None, z=None):
    e = list(o.rotation_euler)
    for i, v in enumerate((x, y, z)):
        if v is not None:
            e[i] = R(v)
    K(o, 'rotation_euler', t, tuple(e))


def loc(o, t, x=None, y=None, z=None):
    l = list(o.location)
    for i, v in enumerate((x, y, z)):
        if v is not None:
            l[i] = v
    K(o, 'location', t, tuple(l))


def scl(o, t, s):
    K(o, 'scale', t, (s, s, s) if isinstance(s, (int, float)) else tuple(s))


def show(o, seq):
    """seq: [(t, visível)] — aplica ao objecto e aos filhos."""
    objs = [o] + list(o.children_recursive)
    for t, on in seq:
        for x in objs:
            x.hide_render = not on
            x.keyframe_insert('hide_render', frame=F(t))


def pop(o, t, dur=0.3, final=1.0, over=1.2):
    scl(o, t, 0.001)
    scl(o, t + dur * 0.6, final * over)
    scl(o, t + dur, final)


def energy(l, seq):
    for t, e in seq:
        l.data.energy = e
        l.data.keyframe_insert('energy', frame=F(t))


def emission(m, seq):
    """seq: [(t, força)] ou [(t, força, cor)]."""
    b = bsdf(m)
    for it in seq:
        b.inputs['Emission Strength'].default_value = it[1]
        b.inputs['Emission Strength'].keyframe_insert('default_value', frame=F(it[0]))
        if len(it) > 2:
            b.inputs['Emission Color'].default_value = (*it[2], 1)
            b.inputs['Emission Color'].keyframe_insert('default_value', frame=F(it[0]))


def wpos(o):
    bpy.context.view_layer.update()
    return tuple(o.matrix_world.translation)


def linear(o):
    """Interpolação linear em todas as curvas do objecto (rotações contínuas)."""
    ad = o.animation_data
    if not ad or not ad.action:
        return
    try:
        fcs = ad.action.fcurves
    except Exception:
        fcs = []
        for layer in ad.action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    fcs.extend(bag.fcurves)
    for fc in fcs:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


# ------------------------------------------------------------------ personagem
def person(name, skin, top, bottom, hair, scale=1.0, head=1.0, long_hair=False, stubble=False, shoe=(0.04, 0.04, 0.05), sleeve=True, hair_rough=0.6):
    """Personagem arredondada virada para -Y. Devolve o dicionário de articulações."""
    mskin = mat(name + '_skin', skin, 0.55)
    mtop = mat(name + '_top', top, 0.75)
    mbot = mat(name + '_bot', bottom, 0.8)
    mhair = mat(name + '_hair', hair, hair_rough)
    mshoe = mat(name + '_shoe', shoe, 0.5)
    mwhite = mat('eye_white', (0.92, 0.92, 0.9), 0.25)
    mdark = mat('eye_dark', (0.012, 0.01, 0.01), 0.12)
    mshine = mat('eye_shine', (1, 1, 1), 0.2, emit=1.5)
    mmouth = mat('mouth', (0.07, 0.02, 0.02), 0.5)
    P = {'name': name}
    root = empty(name, (0, 0, 0))
    hips = empty(name + '_hips', (0, 0, 0.90), root)
    spine = empty(name + '_spine', (0, 0, 0), hips)
    box(name + '_pelvis', (0, 0, 0.0), (0.37, 0.23, 0.22), mbot, 0.09, parent=hips, seg=5)
    box(name + '_torso', (0, 0, 0.30), (0.42, 0.25, 0.54), mtop, 0.11, parent=spine, seg=5)
    cyl(name + '_neckm', (0, 0, 0.59), 0.06, 0.1, mskin, parent=spine, verts=16)
    neck = empty(name + '_neck', (0, 0, 0.60), spine)
    hd = empty(name + '_head', (0, 0, 0.0), neck)
    hr = 0.175 * head
    cz = hr * 1.02
    ball(name + '_skull', (0, 0, cz), hr, mskin, (1, 0.96, 1.06), hd, seg=40)
    for sx in (-1, 1):
        ball(name + '_ear', (sx * hr * 0.97, 0.01, cz - 0.01), hr * 0.2, mskin, (0.5, 1, 1.2), hd, seg=14)
    ball(name + '_nose', (0, -hr * 0.97, cz - hr * 0.1), hr * 0.13, mat(name + '_nose', tuple(c * 0.93 for c in skin), 0.5), (1, 0.8, 0.9), hd, seg=14)
    # cabelo: calota que cobre o topo e a nuca
    h = ball(name + '_hairm', (0, 0.006, cz + 0.004), hr * 1.045, mhair, (1.01, 0.99, 1.07), hd, seg=40)
    cut(h, lambda co: co.z > hr * 0.22 or (co.y > hr * 0.18 and co.z > -hr * 0.55))
    if long_hair:
        ball(name + '_hairb', (0, hr * 0.5, cz - hr * 0.55), hr * 0.95, mhair, (1.05, 0.62, 1.45), hd, seg=24)
    P['stubble'] = None
    if stubble:
        s = ball(name + '_stubble', (0, -0.002, cz), hr * 1.012, mat(name + '_stub', tuple(c * 0.45 for c in skin), 0.8), (1, 0.96, 1.06), hd, seg=40)
        cut(s, lambda co: co.z < -hr * 0.25 and co.y < hr * 0.35)
        P['stubble'] = s
        P['bags'] = [ball(name + '_bag', (sx * hr * 0.36, -hr * 0.9, cz - hr * 0.08), hr * 0.16, mat(name + '_bagm', tuple(c * 0.6 for c in skin), 0.7), (1.1, 0.4, 0.55), hd, seg=12) for sx in (-1, 1)]
    # olhos
    for side, sx in (('L', -1), ('R', 1)):
        eye = empty(f'{name}_eye{side}', (sx * hr * 0.36, -hr * 0.86, cz + hr * 0.1), hd)
        ball(f'{name}_white{side}', (0, 0, 0), hr * 0.2, mwhite, (1, 0.55, 1.15), eye, seg=20)
        pup = ball(f'{name}_pup{side}', (0, -hr * 0.085, 0), hr * 0.115, mdark, (1, 0.5, 1.1), eye, seg=16)
        ball(f'{name}_shine{side}', (hr * 0.04, -hr * 0.05, hr * 0.05), hr * 0.03, mshine, parent=pup, seg=8)
        brow = box(f'{name}_brow{side}', (sx * hr * 0.36, -hr * 0.9, cz + hr * 0.42), (hr * 0.34, hr * 0.1, hr * 0.085), mhair, hr * 0.04, parent=hd)
        P['eye' + side], P['pup' + side], P['brow' + side] = eye, pup, brow
    P['brow_z'] = cz + hr * 0.42
    # boca: meio toro (arco). escala Y local: 1 = sorriso, 0.15 = neutra, -0.8 = triste
    m = torus(name + '_mouth', (0, -hr * 0.9, cz - hr * 0.42), hr * 0.24, hr * 0.045, mmouth, rot=(R(90), 0, 0), parent=hd)
    cut(m, lambda co: co.y <= 0.0005)
    m.scale = (1, 0.15, 1)
    P['mouth'] = m
    # braços
    for side, sx in (('L', -1), ('R', 1)):
        sh = empty(f'{name}_arm{side}', (sx * 0.245, 0, 0.5), spine)
        pill(f'{name}_upper{side}', 0.27, 0.06, mtop, sh)
        el = empty(f'{name}_elb{side}', (0, 0, -0.27), sh)
        pill(f'{name}_fore{side}', 0.24, 0.052, mtop if sleeve else mskin, el)
        hand = ball(f'{name}_hand{side}', (0, 0, -0.27), 0.058, mskin, (1, 1, 1.1), el, seg=16)
        P['arm' + side], P['elb' + side], P['hand' + side] = sh, el, hand
    # pernas
    for side, sx in (('L', -1), ('R', 1)):
        lg = empty(f'{name}_leg{side}', (sx * 0.1, 0, -0.02), hips)
        pill(f'{name}_thigh{side}', 0.40, 0.078, mbot, lg)
        kn = empty(f'{name}_knee{side}', (0, 0, -0.40), lg)
        pill(f'{name}_shin{side}', 0.38, 0.066, mbot, kn)
        box(f'{name}_shoe{side}', (0, -0.05, -0.43), (0.125, 0.26, 0.1), mshoe, 0.045, parent=kn, seg=4)
        P['leg' + side], P['knee' + side] = lg, kn
    P.update(root=root, hips=hips, spine=spine, neck=neck, head=hd, hr=hr, cz=cz, mats=dict(skin=mskin, top=mtop, bottom=mbot, hair=mhair))
    root.scale = (scale, scale, scale)
    return P


def face(P, t, lid=1.0, brow=0.0, lift=0.0, mouth=0.15, gaze=None):
    """lid 1 = olhos abertos, 0.08 = fechados. brow>0 = triste (pontas internas para cima), <0 = zangado."""
    hr = P['hr']
    for side, sx in (('L', -1), ('R', 1)):
        scl(P['eye' + side], t, (1, 1, lid))
        b = P['brow' + side]
        rot(b, t, y=-sx * brow * 22)
        loc(b, t, z=P['brow_z'] + lift * hr * 0.12 - (1 - min(1, lid)) * hr * 0.1)
        if gaze is not None:
            loc(P['pup' + side], t, x=gaze[0] * hr * 0.08, z=gaze[1] * hr * 0.08)
    scl(P['mouth'], t, (1 if abs(mouth) > 0.3 else 0.8, mouth, 1))


def blink(P, t, lid=1.0):
    for side in ('L', 'R'):
        e = P['eye' + side]
        scl(e, t - 0.08, (1, 1, lid))
        scl(e, t, (1, 1, 0.08))
        scl(e, t + 0.12, (1, 1, lid))


def pose(P, t, **kw):
    """kw: nome_da_articulação=(rx, ry, rz) em graus; hips_z / root=(x,y,z) para posição."""
    for k, v in kw.items():
        if k == 'hips_z':
            loc(P['hips'], t, z=v)
        elif k == 'at':
            K(P['root'], 'location', t, tuple(v))
        elif k == 'turn':
            rot(P['root'], t, z=v)
        else:
            rot(P[k], t, *v)


def sit(P, t, seat=0.5, lean=18, knees=90):
    """Sentado num assento à altura `seat`, inclinado para a frente `lean` graus."""
    pose(P, t, hips_z=seat + 0.1, spine=(lean, 0, 0), legL=(-88, 0, 4), legR=(-88, 0, -4), kneeL=(knees, 0, 0), kneeR=(knees, 0, 0))


def breathe(P, t0, t1, period=3.4, amp=0.012):
    t = t0
    i = 0
    while t <= t1 + period:
        scl(P['spine'], t, (1 + (amp if i % 2 else 0), 1 + (amp * 2 if i % 2 else 0), 1 + (amp if i % 2 else 0)))
        t += period / 2
        i += 1


def walk(P, t0, t1, a, b, swing=30, step=0.32):
    """Anda de `a` a `b` (x, y) com balanço de pernas e braços."""
    K(P['root'], 'location', t0, (a[0], a[1], 0))
    K(P['root'], 'location', t1, (b[0], b[1], 0))
    n = max(1, int((t1 - t0) / step))
    for i in range(n + 1):
        t = t0 + (t1 - t0) * i / n
        s = swing if i % 2 == 0 else -swing
        if i == n:
            s = 0
        rot(P['legL'], t, x=-s)
        rot(P['legR'], t, x=s)
        rot(P['kneeL'], t, x=max(0, s) * 0.9)
        rot(P['kneeR'], t, x=max(0, -s) * 0.9)
        rot(P['armL'], t, x=s * 0.8)
        rot(P['armR'], t, x=-s * 0.8)
        loc(P['hips'], t, z=0.90 + (0.02 if i % 2 else 0))
    linear(P['root'])


# ------------------------------------------------------------------ Offy
OFFY = {
    'idle': (0.25, 0.32, 0.95), 'joy': (1.0, 0.62, 0.08), 'calm': (0.12, 0.75, 0.32), 'think': (0.1, 0.55, 0.9),
}


def offy(name='offy', color='idle', r=0.16, light=30.0):
    col = OFFY[color]
    m = bpy.data.materials.new(name + '_m')
    m.use_nodes = True
    b = bsdf(m)
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = 0.35
    b.inputs['Emission Color'].default_value = (*col, 1)
    b.inputs['Emission Strength'].default_value = 0.45
    mc = bpy.data.materials.new(name + '_c')
    mc.use_nodes = True
    bc = bsdf(mc)
    bc.inputs['Base Color'].default_value = (*[c * 0.7 for c in col], 1)
    bc.inputs['Emission Color'].default_value = (*[c * 0.8 for c in col], 1)
    bc.inputs['Emission Strength'].default_value = 0.3
    ink = mat('offy_ink', (0.01, 0.01, 0.012), 0.2)
    root = empty(name, (0, 0, 0))
    body = empty(name + '_b', (0, 0, 0), root)
    orb = ball(name + '_orb', (0, 0, 0), r, m, (1, 1, 1), body, seg=40)
    orb.visible_shadow = False
    for deg in (-150, -120, -90, -60, -30):
        a = R(deg)
        x, z = math.cos(a) * r * 0.42, -math.sin(a) * r * 0.42 + r * 0.72
        c = ball(name + '_ray', (x, r * 0.1, z), r * 0.19, mc, (0.62, 0.5, 1.15), body, seg=14, rot=(0, R(-(deg + 90)), 0))
        c.visible_shadow = False
    eyes = []
    for sx in (-1, 1):
        e = ball(name + '_eye', (sx * r * 0.36, -r * 0.9, r * 0.12), r * 0.115, ink, (1, 0.5, 1.3), body, seg=14)
        ball(name + '_sh', (r * 0.03, -r * 0.05, r * 0.06), r * 0.03, mat('eye_shine', (1, 1, 1), 0.2, emit=1.5), parent=e, seg=8)
        eyes.append(e)
    mo = torus(name + '_mouth', (0, -r * 0.93, -r * 0.22), r * 0.18, r * 0.04, ink, rot=(R(90), 0, 0), parent=body)
    cut(mo, lambda co: co.y <= 0.0005)
    mo.scale = (1, 0.6, 1)
    lp = point(name + '_light', (0, 0, 0), light, col, radius=r * 0.9, parent=body)
    return dict(root=root, body=body, orb=orb, m=m, mc=mc, eyes=eyes, mouth=mo, light=lp, r=r)


def offy_color(Of, t, color, strength=0.45):
    col = OFFY[color] if isinstance(color, str) else color
    for mm, k, s in ((Of['m'], 1.0, strength), (Of['mc'], 0.8, strength * 0.55)):
        b = bsdf(mm)
        for inp in ('Base Color', 'Emission Color'):
            b.inputs[inp].default_value = (*[c * (k if inp == 'Emission Color' else k * 0.9) for c in col], 1)
            b.inputs[inp].keyframe_insert('default_value', frame=F(t))
        b.inputs['Emission Strength'].default_value = s
        b.inputs['Emission Strength'].keyframe_insert('default_value', frame=F(t))
    Of['light'].data.color = col
    Of['light'].data.keyframe_insert('color', frame=F(t))


def offy_face(Of, t, eyes=1.0, mouth=0.6):
    for e in Of['eyes']:
        scl(e, t, (1, 0.5, 1.3 * eyes))
    scl(Of['mouth'], t, (1, mouth, 1))


def offy_float(Of, t0, t1, base, amp=0.04, period=2.2, bounce=False):
    t = t0
    i = 0
    while t <= t1 + period:
        z = base[2] + (amp if i % 2 else -amp)
        K(Of['root'], 'location', t, (base[0], base[1], z))
        if bounce:
            scl(Of['body'], t, (1.05, 1.05, 0.93) if i % 2 == 0 else (0.97, 0.97, 1.06))
        t += period / 2
        i += 1


# ------------------------------------------------------------------ adereços
def phone(name='phone', color=(1.0, 0.1, 0.5), strength=6.0, light=12.0):
    """Telemóvel com o ecrã virado para +Y local (para o rosto de quem o segura)."""
    root = empty(name, (0, 0, 0))
    box(name + '_body', (0, 0, 0), (0.078, 0.011, 0.158), mat('phone_body', (0.02, 0.02, 0.025), 0.3, metallic=0.6), 0.008, parent=root)
    ms = bpy.data.materials.new(name + '_screen')
    ms.use_nodes = True
    b = bsdf(ms)
    b.inputs['Base Color'].default_value = (0, 0, 0, 1)
    b.inputs['Emission Color'].default_value = (*color, 1)
    b.inputs['Emission Strength'].default_value = strength
    box(name + '_scr', (0, 0.0062, 0), (0.07, 0.001, 0.148), ms, 0.0, parent=root)
    bpy.ops.object.light_add(type='AREA', location=(0, 0.02, 0))
    l = bpy.context.active_object
    l.name = name + '_light'
    l.data.energy = light
    l.data.color = color
    l.data.shape = 'RECTANGLE'
    l.data.size = 0.07
    l.data.size_y = 0.15
    l.rotation_euler = (R(90), 0, 0)  # emite para +Y
    l.parent = root
    return dict(root=root, screen=ms, light=l)


def phone_color(Ph, t, color, strength=6.0, light=12.0):
    emission(Ph['screen'], [(t, strength, color)])
    Ph['light'].data.color = color
    Ph['light'].data.keyframe_insert('color', frame=F(t))
    energy(Ph['light'], [(t, light)])


def leaves(n, area_min, area_max, t0, t1, seed=1, color=(0.25, 0.5, 0.12), fall=1.6):
    """Folhas a cair devagar (pequenas placas)."""
    rnd = random.Random(seed)
    m = mat('leaf', color, 0.6)
    for i in range(n):
        x = rnd.uniform(area_min[0], area_max[0])
        y = rnd.uniform(area_min[1], area_max[1])
        z = rnd.uniform(area_min[2], area_max[2])
        o = ball(f'leaf{i}', (x, y, z), 0.035, m, (1, 0.12, 0.55), seg=8)
        d = t1 - t0
        K(o, 'location', t0, (x, y, z))
        K(o, 'location', t1, (x + rnd.uniform(-0.5, 0.5), y + rnd.uniform(-0.3, 0.3), z - fall * rnd.uniform(0.6, 1.2) * d / 6))
        K(o, 'rotation_euler', t0, (rnd.uniform(0, 6), rnd.uniform(0, 6), 0))
        K(o, 'rotation_euler', t1, (rnd.uniform(6, 14), rnd.uniform(6, 14), rnd.uniform(0, 6)))
