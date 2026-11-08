"""Episódio 2 (Yara): 19 cenas animadas a 30 fps, sincronizadas com a narração.

Uso (renderizar uma cena): python3 ep2.py <cena> <pasta> [amostras] [largura] [altura]
Uso (sonda de teste): PROBE=1 python3 ep2.py <pasta>   (um fotograma por cena)
"""
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector

import ep1
from anim import F, FPS, O, breathe, cam_path, energy, face_anim, flicker, key, loc, pop, rot, scale, vis
from cubes import aim, area_light, camera, character, cube, empty, mat, set_face, sun_logo, tear, text3d
from timeline2 import scene_times

R = math.radians
W, H, SAMPLES = 540, 960, 8
BLUE = (0.3, 0.55, 1.0)
WARM = (1.0, 0.76, 0.42)
CTX = {}


def D_of(name):
    return {n: b - a for n, a, b in scene_times()}[name]


# ------------------------------------------------------------------ personagens
def yara(scale_=1.0):
    P = character((0.04, 0.02, 0.012), (0.55, 0.55, 0.6), (0.12, 0.14, 0.22), (0.003, 0.0025, 0.0025), scale=scale_)
    for m_ in bpy.data.materials:
        if m_.use_nodes and m_.name.startswith(('skin', 'hair')):
            b_ = m_.node_tree.nodes.get('Principled BSDF')
            if b_:
                b_.inputs['Roughness'].default_value = 0.85
                if 'Specular IOR Level' in b_.inputs:
                    b_.inputs['Specular IOR Level'].default_value = 0.15
    head = P['head']
    hair = mat('hairY', (0.003, 0.0025, 0.0025), 0.95)
    cube('puff_top', (0, 0.1, 0.74), (0.95, 0.65, 0.45), hair, 0.2, parent=head)
    cube('puff_top2', (0, 0.05, 0.95), (0.7, 0.55, 0.3), hair, 0.15, parent=head)
    cube('puff_back', (0, 0.32, 0.42), (0.9, 0.4, 0.85), hair, 0.2, parent=head)
    for sx in (-1, 1):
        cube('puff_side', (sx * 0.43, 0.08, 0.4), (0.36, 0.6, 0.75), hair, 0.15, parent=head)
    gm = mat('glasses', (0.05, 0.05, 0.07), 0.3)
    for sx in (-1, 1):
        x = sx * 0.125
        cube('gt', (x, -0.275, 0.385), (0.17, 0.02, 0.02), gm, 0.005, parent=head)
        cube('gb', (x, -0.275, 0.215), (0.17, 0.02, 0.02), gm, 0.005, parent=head)
        cube('gl', (x - 0.085, -0.275, 0.30), (0.02, 0.02, 0.18), gm, 0.005, parent=head)
        cube('gr', (x + 0.085, -0.275, 0.30), (0.02, 0.02, 0.18), gm, 0.005, parent=head)
    cube('gbridge', (0, -0.275, 0.31), (0.09, 0.02, 0.02), gm, 0.005, parent=head)
    return P


def mom():
    P = character((0.09, 0.048, 0.03), (0.85, 0.5, 0.3), (0.3, 0.25, 0.4), (0.01, 0.008, 0.008))
    return P


def sit(p, hips=0.35):
    ep1.sit(p, hips)
    for s in ('L', 'R'):
        p['leg' + s].rotation_euler = (R(-90), 0, 0)


# ------------------------------------------------------------------ cenário
def room(mood='warm'):
    """Quarto mobiliado e feminino. mood: warm | blue | gold."""
    reset_kwargs = dict()
    ep1.reset(W, H, samples=SAMPLES) if hasattr(ep1, 'reset') else None
    from cubes import reset, sun_and_world
    reset(W, H, samples=SAMPLES)
    world = {'warm': (0.9, 0.7, 0.55), 'blue': (0.02, 0.03, 0.08), 'gold': (1.0, 0.8, 0.5)}[mood]
    sun_and_world({'warm': 0.35, 'blue': 0.08, 'gold': 0.5}[mood], world)
    lilac, peach = (0.82, 0.68, 0.82), (0.95, 0.65, 0.55)
    cube('floor', (0, 0, -0.05), (9, 9, 0.1), mat('floor', (0.55, 0.38, 0.33), 0.45), 0.02)
    cube('wall_back', (0, 3.2, 2), (9, 0.1, 4), mat('wallb', lilac, 0.8), 0.02)
    cube('wall_left', (-3.4, 0, 2), (0.1, 9, 4), mat('wallL', lilac, 0.8), 0.02)
    cube('rug', (-0.3, 0.9, 0.012), (2.8, 2.2, 0.03), mat('rug', peach, 0.9), 0.012)
    # janela à esquerda
    ep1.window({'warm': (1.0, 0.8, 0.5), 'blue': (0.18, 0.25, 0.45), 'gold': (1.0, 0.7, 0.35)}[mood], {'warm': 5.0, 'blue': 1.2, 'gold': 7.0}[mood], y=0.6)
    # cama com colcha lilás e almofadas
    cube('bedframe', (2.1, 2.35, 0.25), (1.9, 1.8, 0.5), mat('bedf', (0.95, 0.93, 0.9), 0.7), 0.04)
    cube('blanket', (2.1, 2.0, 0.58), (1.85, 1.2, 0.14), mat('blank', (0.55, 0.42, 0.78), 0.9), 0.06)
    cube('pillowA', (1.7, 2.95, 0.7), (0.65, 0.35, 0.2), mat('pilA', (0.98, 0.85, 0.9), 0.9), 0.07)
    cube('pillowB', (2.5, 2.95, 0.7), (0.65, 0.35, 0.2), mat('pilB', (0.9, 0.95, 1.0), 0.9), 0.07)
    # secretária de estudo
    cube('desk', (-0.3, 0.65, 0.78), (2.3, 0.8, 0.08), mat('desk', (0.95, 0.9, 0.85), 0.45), 0.02)
    for x in (-1.35, 0.75):
        for y in (0.35, 0.95):
            cube('dleg', (x, y, 0.38), (0.08, 0.08, 0.76), mat('dlegm', (0.9, 0.85, 0.8), 0.6), 0.01)
    # candeeiro, planta, apostilas e caderno
    cube('lampbase', (0.55, 0.85, 0.86), (0.2, 0.2, 0.05), mat('lampb', (0.2, 0.2, 0.25), 0.4), 0.01)
    cube('lamparm', (0.55, 0.85, 1.12), (0.04, 0.04, 0.5), mat('lampa', (0.2, 0.2, 0.25), 0.4), 0.01)
    cube('lamphead', (0.5, 0.75, 1.4), (0.3, 0.22, 0.12), mat('lamph', (1.0, 0.85, 0.5), 0.3, emit=3.0, emit_color=(1.0, 0.85, 0.5)), 0.03)
    cube('pot', (-1.15, 0.85, 0.94), (0.2, 0.2, 0.2), mat('pot', (0.8, 0.4, 0.3), 0.7), 0.02)
    for i in range(3):
        cube('leaf', (-1.15 + 0.03 * i, 0.85, 1.12 + 0.05 * i), (0.14, 0.14, 0.2), mat('leaf', (0.3, 0.6, 0.35), 0.7), 0.03)
    for i, c in enumerate(((0.3, 0.45, 0.75), (0.9, 0.5, 0.45), (0.85, 0.75, 0.3))):
        cube('apost%d' % i, (0.2, 0.45, 0.86 + 0.06 * i), (0.55, 0.4, 0.05), mat('apm%d' % i, c, 0.6), 0.01)
    cube('notebook', (-0.45, 0.45, 0.855), (0.45, 0.32, 0.02), mat('nb', (1, 1, 1), 0.7), 0.005)
    # estante à esquerda com livros e caixas
    cube('shelf', (-3.2, 1.9, 1.0), (0.4, 1.5, 2.0), mat('shelfm', (0.97, 0.95, 0.92), 0.6), 0.02)
    cols = [(0.3, 0.45, 0.75), (0.9, 0.5, 0.45), (0.85, 0.75, 0.3), (0.45, 0.7, 0.5), (0.7, 0.4, 0.7)]
    for lvl in range(4):
        for i in range(5):
            cube('bk', (-3.05, 1.35 + i * 0.28, 0.35 + lvl * 0.5), (0.26, 0.18, 0.34), mat('bkm%d' % (i % 5), cols[(i + lvl) % 5], 0.6), 0.01)
    # pôsteres: offly, genéricos, cortiça
    cube('offly_poster', (1.0, 3.12, 2.15), (0.95, 0.04, 1.3), mat('opost', (0.03, 0.03, 0.04), 0.5), 0.02)
    sun_logo((1.0, 3.07, 2.1), 0.28)
    text3d('offly', (1.0, 3.07, 2.45), 0.16, (1, 1, 1), 3.5, extrude=0.008)
    text3d('Menos tela. Mais vida.', (1.0, 3.07, 1.65), 0.055, (0.8, 0.8, 0.8), 3.0, extrude=0.005)
    cube('post2', (-0.8, 3.12, 2.2), (0.8, 0.04, 1.1), mat('p2', (0.98, 0.78, 0.82), 0.6), 0.02)
    cube('p2a', (-0.8, 3.08, 2.3), (0.35, 0.02, 0.35), mat('p2a', (0.9, 0.45, 0.55), 0.6), 0.04)
    cube('p2b', (-0.65, 3.08, 1.95), (0.3, 0.02, 0.2), mat('p2b', (0.6, 0.5, 0.8), 0.6), 0.03)
    cube('post3', (-2.2, 3.12, 2.0), (0.6, 0.04, 0.85), mat('p3', (0.75, 0.88, 0.95), 0.6), 0.02)
    cube('p3a', (-2.2, 3.08, 2.1), (0.3, 0.02, 0.3), mat('p3a', (1.0, 0.85, 0.4), 0.6), 0.05)
    cube('cork', (-1.55, 3.12, 1.6), (0.7, 0.04, 0.55), mat('cork', (0.7, 0.5, 0.3), 0.8), 0.02)
    cube('calpaper', (-1.55, 3.08, 1.65), (0.45, 0.02, 0.35), mat('calp', (0.98, 0.98, 0.95), 0.7), 0.01)
    text3d('VESTIBULAR', (-1.55, 3.06, 1.78), 0.05, (0.7, 0.1, 0.15), 0.0, extrude=0.003)
    # fotografias e espelho
    for i, c in enumerate(((0.9, 0.7, 0.5), (0.6, 0.75, 0.9))):
        cube('photo%d' % i, (-2.7 + i * 0.35, 3.12, 1.0), (0.28, 0.03, 0.34), mat('pho%d' % i, c, 0.6), 0.01)
    cube('mirror', (-0.1, 3.12, 1.05), (0.55, 0.03, 0.85), mat('mirrorm', (0.8, 0.9, 1.0), 0.05), 0.02)
    # luzes de fita quentes
    sm = mat('string', (1.0, 0.8, 0.5), 0.3, emit=6.0, emit_color=(1.0, 0.8, 0.5))
    for i in range(14):
        cube('bulb%d' % i, (-2.9 + i * 0.45, 3.12, 3.35 + 0.05 * math.sin(i)), (0.05, 0.05, 0.05), sm, 0.01)
    # luzes
    key_e = {'warm': 1100, 'blue': 60, 'gold': 1600}[mood]
    aim(area_light('sun', (-3.2, -1.2, 2.2), (0, 0, 0), key_e, WARM, 2.2), (0.1, 0.8, 0.8))
    aim(area_light('fill', (2.5, -3.0, 2.0), (0, 0, 0), {'warm': 120, 'blue': 25, 'gold': 160}[mood], (1.0, 0.9, 0.8), 3.0), (0, 0.8, 0.9))
    aim(area_light('lamp', (0.3, 0.9, 2.2), (0, 0, 0), {'warm': 200, 'blue': 18, 'gold': 260}[mood], (1.0, 0.82, 0.55), 0.8), (-0.3, 0.8, 0.9))
    aim(area_light('screen', (-0.4, -0.2, 1.4), (0, 0, 0), 0.0, BLUE, 0.5), (-0.3, 1.4, 1.5))


def seated_yara(mood='warm', arms=-95):
    room(mood)
    p = yara()
    p['root'].location = (-0.3, 1.5, 0)
    sit(p, 0.35)
    p['armL'].rotation_euler = (R(arms), 0, R(10))
    p['armR'].rotation_euler = (R(arms), 0, R(-10))
    ph = cube('phone', (-1.05, 0.5, 0.86), (0.24, 0.44, 0.03), mat('phone_m', (0.04, 0.04, 0.06), 0.2, emit=0.4, emit_color=BLUE), 0.01)
    return p, ph


def hp(p):
    return ep1.head_pos(p)


def face_cam(p, d0, d1, D, side=0.25, up=0.05, lens=45):
    h = hp(p)
    front = p['head'].matrix_world.to_3x3() @ Vector((0, -1, 0))
    right = p['head'].matrix_world.to_3x3() @ Vector((1, 0, 0))
    a = h + front * d0 + right * side + Vector((0, 0, up))
    b = h + front * d1 + right * side * 0.3 + Vector((0, 0, up))
    camera(tuple(a), tuple(h), lens=lens, dof_dist=d0, fstop=3.2)
    cam_path([(0, tuple(a), tuple(h)), (D, tuple(b), tuple(h))], focus=[(0, d0), (D, d1)])


def wide_cam(a, b, ta, tb, D, lens=28, focus=3.6):
    camera(a, ta, lens=lens, dof_dist=focus, fstop=3.6)
    cam_path([(0, a, ta), (D, b, tb)], focus=[(0, focus), (D, focus * 0.85)])


def phone_close(ph, D, d0=1.2, d1=0.8, lens=45):
    c = Vector(ph.location)
    a = c + Vector((0.5, -d0, 0.5))
    b = c + Vector((0.25, -d1, 0.35))
    camera(tuple(a), tuple(c), lens=lens, dof_dist=d0, fstop=2.8)
    cam_path([(0, tuple(a), tuple(c)), (D, tuple(b), tuple(c))], focus=[(0, d0), (D, d1)])


def typing(p, D, t0=0.0, t1=None, amp=8):
    t1 = D if t1 is None else t1
    t = t0
    while t < t1:
        rot(p['armR'], t, x=-95)
        rot(p['armR'], t + 0.22, x=-95 - amp)
        rot(p['armR'], t + 0.44, x=-95)
        t += 0.55


# ------------------------------------------------------------------ cenas
def y01(D):
    p, ph = seated_yara('warm')
    ep1.dust_ = None
    from scenes import dust
    dust(n=50, area=(-2.2, 1.5, 0, 2.6, 0.3, 2.6))
    set_face(p, brow=0.1, smile=0.2, gaze=(0, -0.5))
    face_anim(p, [(0, dict(brow=0.1, smile=0.2, gaze=(0, -0.6))), (4.0, dict(brow=0.2, smile=0.3, gaze=(0.2, -0.4)))], D, blink_every=2.4)
    rot(p['head'], 0, x=18)
    rot(p['head'], 3.0, x=22)
    typing(p, D, 0.5, D - 0.5)
    breathe(p, D, amp=0.012)
    for o in bpy.data.objects:
        if o.name.startswith('dust'):
            z0, x0 = o.location.z, o.location.x
            loc(o, 0, z=z0, x=x0)
            loc(o, D, z=z0 + 0.4, x=x0 + 0.06)
    wide_cam((1.4, -3.5, 1.5), (0.6, -2.7, 1.45), (-0.3, 1.2, 1.3), (-0.3, 1.2, 1.4), D)
    return p


def y02(D):
    p, ph = seated_yara('warm')
    face_cam(p, 2.0, 1.5, D)
    face_anim(p, [(0, dict(brow=0.1, smile=0.25, gaze=(0, -0.2))), (2.2, dict(brow=0.15, smile=0.05, gaze=(0, -0.3), lid=0.2)), (3.4, dict(brow=0.3, smile=-0.15, lid=0.45, gaze=(0, -0.5)))], D, blink_every=2.2)
    rot(p['head'], 0, x=4)
    rot(p['head'], 2.6, x=-3)
    rot(p['head'], D, x=8)
    breathe(p, D, period=3.0, amp=0.02)
    return p


def y03(D):
    p, ph = seated_yara('warm')
    face_anim(p, [(0, dict(smile=0.05, brow=0.2, gaze=(0.6, 0.4))), (4.2, dict(smile=-0.15, brow=0.35, lid=0.2, gaze=(-0.8, -0.2)))], D, blink_every=2.4)
    rot(p['head'], 0, x=4, z=0)
    rot(p['head'], 3.5, x=4, z=0)
    rot(p['head'], 4.3, x=6, z=-45)
    # a câmara vai da Yara para o pôster do offly e volta
    cam_path([
        (0, (0.2, -2.8, 1.6), (-0.3, 1.5, 1.5)),
        (1.6, (0.9, -2.4, 1.9), (1.0, 3.0, 2.1)),
        (3.8, (1.0, -1.6, 2.0), (1.0, 3.0, 2.1)),
        (D, (0.4, -2.6, 1.7), (-0.3, 1.5, 1.6)),
    ], focus=[(0, 4.4), (1.6, 5.6), (3.8, 4.8), (D, 4.3)])
    breathe(p, D)
    return p


def y04(D):
    p, ph = seated_yara('warm')
    energy('screen', [(0, 0), (1.2, 0), (1.6, 55), (D, 80)])
    energy('sun', [(0, 1100), (D, 150)])
    energy('lamp', [(0, 200), (D, 40)])
    ph.hide_render = False
    face_anim(p, [(0, dict(smile=0.1, brow=0.2, gaze=(0.6, -0.3))), (1.8, dict(brow_lift=0.4, smile=0.0, gaze=(-1, -0.7))), (3.5, dict(screen_eyes=True, lid=0.25, smile=-0.1, gaze=(0, -0.9)))], D, blink_every=2.4)
    rot(p['head'], 0, x=4)
    rot(p['head'], 2.0, x=18)
    # calendário da cortiça a folhear
    cal = O('calpaper')
    for i, n in enumerate(range(30, 18, -1)):
        o = text3d(str(n), (-1.55, 3.06, 1.55), 0.12, (0.1, 0.1, 0.15), 0.0, extrude=0.004)
        t0 = 1.0 + i * 0.4
        vis(o, [(0, False), (t0, True), (t0 + 0.4, False)])
    wide_cam((0.4, -2.6, 1.55), (-0.1, -2.0, 1.5), (-0.5, 1.4, 1.2), (-0.7, 1.4, 1.3), D, lens=34, focus=3.5)
    breathe(p, D)
    return p


def minis(count, center, spread, seed=3):
    """Pequenos bonecos de cubos a dançar (os «bonequinhos» do Instagram)."""
    rnd = random.Random(seed)
    out = []
    cols = [(0.9, 0.4, 0.4), (0.4, 0.7, 0.9), (0.95, 0.8, 0.3)]
    for i in range(count):
        m = character((0.9, 0.65, 0.5), cols[i % 3], (0.2, 0.2, 0.4), (0.15, 0.1, 0.05), scale=0.14)
        m['root'].location = (center[0] + (i - (count - 1) / 2) * spread, center[1], center[2])
        m['root'].rotation_euler = (0, 0, 0)
        out.append(m)
    return out


def dance(m, t0, t1, rate=0.4, phase=0.0):
    z0 = m['root'].location.z
    t = t0 + phase
    k = 0
    while t < t1:
        loc(m['root'], t, z=z0)
        loc(m['root'], t + rate / 2, z=z0 + 0.04)
        rot(m['armL'], t, x=0, y=100)
        rot(m['armR'], t, x=0, y=-100)
        rot(m['armL'], t + rate / 2, x=0, y=150)
        rot(m['armR'], t + rate / 2, x=0, y=-150)
        t += rate
        k += 1


def y05(D):
    p, ph = seated_yara('blue')
    energy('screen', [(0, 70), (D, 70)])
    flicker('screen', 0, D, 55, 90, 0.12)
    ph.location = (-0.35, 0.55, 0.86)
    ms = minis(3, (-0.35, 0.55, 0.9), 0.08)
    for i, m in enumerate(ms):
        dance(m, 0, D, 0.35 + 0.05 * i, 0.1 * i)
    # a caneta cai e rola
    pen = cube('pen', (0.4, 0.55, 0.88), (0.3, 0.025, 0.025), mat('pen', (0.9, 0.2, 0.3), 0.4), 0.006)
    loc(pen, 0, x=0.4, y=0.55, z=0.88)
    loc(pen, 4.2, x=0.4, y=0.55, z=0.88)
    loc(pen, 4.7, x=0.5, y=0.45, z=0.05)
    loc(pen, 6.5, x=1.3, y=0.3, z=0.04)
    # mãe à porta chama; Yara não olha
    door = cube('door', (-3.3, 0.9, 1.0), (0.08, 1.0, 2.0), mat('door', (0.55, 0.4, 0.3), 0.6), 0.02)
    cube('doorlight', (-3.28, 0.9, 1.0), (0.04, 0.9, 1.9), mat('dlm', (1.0, 0.8, 0.5), 0.3, emit=2.0, emit_color=(1.0, 0.8, 0.5)), 0.01)
    mm = mom()
    mm['root'].location = (-2.7, 0.9, 0)
    mm['root'].rotation_euler = (0, 0, R(90))
    vis(door, [(0, False), (5.0, True)])
    for d in bpy.data.objects:
        if d.name.startswith('doorlight'):
            vis(d, [(0, False), (5.0, True)])
    show_mom = [(0, False), (5.0, True)]
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.parent is not None:
            r = o
            while r.parent is not None:
                r = r.parent
            if r == mm['root']:
                vis(o, show_mom)
    set_face(mm, smile=-0.1, brow=0.4, gaze=(0.5, 0))
    face_anim(mm, [(0, dict(smile=-0.1, brow=0.4, gaze=(0.5, 0)))], D, blink_every=2.4, talk=(5.4, 7.2))
    t = 5.2
    while t < 8.0:
        rot(mm['armR'], t, x=0, y=-100, z=0)
        rot(mm['armR'], t + 0.25, x=0, y=-140, z=0)
        t += 0.5
    face_anim(p, [(0, dict(screen_eyes=True, lid=0.2, smile=-0.05, gaze=(0, -0.9)))], D, blink_every=None)
    rot(p['head'], 0, x=20)
    breathe(p, D)
    # câmara: do telemóvel (dançarinos) para a sala inteira com a mãe à porta
    cam_path([
        (0, (0.15, -0.6, 1.25), (-0.35, 0.55, 0.95)),
        (4.4, (0.1, -0.8, 1.25), (-0.35, 0.55, 0.95)),
        (5.2, (1.2, -3.0, 1.5), (-1.2, 1.0, 1.2)),
        (D, (1.0, -2.8, 1.5), (-1.4, 1.0, 1.2)),
    ], focus=[(0, 1.0), (4.4, 1.1), (5.2, 3.4), (D, 3.2)])
    return p


def y06(D):
    p, ph = seated_yara('blue')
    ph.location = (-0.35, 0.55, 0.86)
    energy('screen', [(0, 70), (D, 70)])
    # balões de mensagem das amigas
    msgs = [('bora estudar', 0.8), ('junto?', 1.6)]
    for txt, t0 in msgs:
        b = cube('bubble', (0.95, 0.5, 1.5 + 0.2 * (t0 > 1.0)), (0.62, 0.02, 0.14), mat('bubm', (0.95, 0.95, 1.0), 0.5, emit=1.2), 0.04)
        pop(b, t0, 0.3)
        tx = text3d(txt, (0.95, 0.48, 1.47 + 0.2 * (t0 > 1.0)), 0.06, (0.1, 0.1, 0.15), 0.0, extrude=0.003)
        pop(tx, t0 + 0.05, 0.3)
    v = text3d('visto', (1.25, 0.48, 1.35), 0.05, (0.5, 0.75, 1.0), 3.0, extrude=0.003)
    pop(v, 2.8, 0.3)
    # contador de tempo no celular
    for i, h in enumerate(('1H', '3H', '5H', '7H', '9H')):
        o = text3d('TEMPO NO CELULAR ' + h, (-1.0, 0.9, 2.6), 0.11, (0.5, 0.75, 1.0), 4.0, extrude=0.008)
        t0 = 3.4 + i * 0.55
        vis(o, [(0, False), (t0, True), (t0 + 0.55 if i < 4 else 999, False)])
    face_anim(p, [(0, dict(screen_eyes=True, lid=0.25, smile=-0.1, gaze=(0, -0.9))), (4.0, dict(screen_eyes=True, lid=0.4, smile=-0.25, brow=0.3, gaze=(0, -0.9)))], D, blink_every=None)
    rot(p['head'], 0, x=18)
    breathe(p, D)
    cam_path([(0, (0.5, -1.4, 1.5), (-0.25, 0.8, 1.4)), (D, (0.25, -1.1, 1.5), (-0.3, 0.9, 1.5))], focus=[(0, 1.6), (D, 1.3)])
    return p


def y07(D):
    p, ph = seated_yara('blue')
    # Yara deitada na cama, com a luz azul no rosto
    p['root'].location = (2.1, 2.7, 0.62)
    p['root'].rotation_euler = (0, 0, 0)
    p['hips'].location = (0, 0, 0)
    p['hips'].rotation_euler = (R(-28), 0, 0)
    for s in ('L', 'R'):
        p['leg' + s].rotation_euler = (R(-90), 0, 0)
    p['armL'].rotation_euler = (R(-85), 0, R(18))
    p['armR'].rotation_euler = (R(-85), 0, R(-18))
    p['head'].rotation_euler = (R(-20), 0, 0)
    ph.hide_render = True
    slab = ep1.slab('bphone', (0, -0.55, 0.85), (0.24, 0.03, 0.46), BLUE, 5.0, parent=p['hips'], rot=(R(-20), 0, 0))
    energy('screen', [(0, 0), (0, 0)])
    aim(area_light('face', (1.8, 1.6, 2.0), (0, 0, 0), 55, BLUE, 0.5), tuple(hp(p)))
    face_anim(p, [(0, dict(screen_eyes=True, lid=0.35, smile=-0.15, gaze=(0, -0.9))), (4.0, dict(screen_eyes=True, lid=0.55, smile=-0.3, brow=0.4, gaze=(0, -0.9)))], D, blink_every=None)
    breathe(p, D, period=4.0, amp=0.02)
    # calendário a perder folhas
    for i, n in enumerate(range(18, 0, -1)):
        o = text3d(str(n), (-1.55, 3.06, 1.55), 0.12, (0.1, 0.1, 0.15), 0.0, extrude=0.004)
        t0 = 0.3 + i * 0.4
        vis(o, [(0, False), (t0, True), (t0 + 0.4, False)])
    wide_cam((0.0, -1.6, 1.7), (0.8, -1.2, 1.6), (2.0, 2.4, 1.2), (2.1, 2.4, 1.15), D, lens=26, focus=4.0)
    return p


def exam_hall():
    from cubes import reset, sun_and_world
    reset(W, H, samples=SAMPLES)
    sun_and_world(0.08, (0.6, 0.62, 0.7))
    cube('floor', (0, 0, -0.05), (12, 12, 0.1), mat('hallf', (0.35, 0.35, 0.38), 0.5), 0.02)
    cube('wall', (0, 5.5, 2), (12, 0.1, 4), mat('hallw', (0.6, 0.62, 0.68), 0.8), 0.02)
    cube('wallL', (-4.2, 0, 2), (0.1, 12, 4), mat('hallwl', (0.58, 0.6, 0.66), 0.8), 0.02)
    for r in range(3):
        for c in range(5):
            x, y = -2.6 + c * 1.3, 1.2 + r * 1.5
            cube('dk', (x, y, 0.5), (0.8, 0.55, 0.05), mat('dkm', (0.75, 0.6, 0.45), 0.5), 0.01)
            cube('dkl', (x, y, 0.25), (0.06, 0.06, 0.5), mat('dkl', (0.3, 0.3, 0.35), 0.5), 0.01)
    cube('clockface', (2.2, 5.4, 2.6), (0.7, 0.04, 0.7), mat('clock', (0.95, 0.95, 0.95), 0.4), 0.15)
    hand1 = cube('hand1', (2.2, 5.37, 2.72), (0.04, 0.02, 0.3), mat('h1', (0.05, 0.05, 0.05), 0.4), 0.005)
    hand2 = cube('hand2', (2.2, 5.37, 2.66), (0.03, 0.02, 0.22), mat('h2', (0.05, 0.05, 0.05), 0.4), 0.005)
    aim(area_light('ceil', (0, 1.5, 3.8), (0, 0, 0), 120, (1.0, 0.98, 0.95), 4.0), (0, 2.0, 0.6))
    return hand1, hand2


def paper_with_letters(center, D, float_from=3.0, steady=False):
    """Folha de prova com letras; flutuam e separam-se (A) ou ficam paradas (B)."""
    cx, cy, cz = center
    cube('paper', (cx, cy, cz), (0.62, 0.45, 0.02), mat('paper', (0.98, 0.98, 0.96), 0.7), 0.004)
    rnd = random.Random(8)
    letters = []
    for i in range(18):
        ch = rnd.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
        x0, y0 = cx - 0.24 + (i % 6) * 0.095, cy - 0.12 + (i // 6) * 0.1
        o = text3d(ch, (x0, y0, cz + 0.02), 0.07, (0.1, 0.1, 0.12), 0.0, rot=(0, 0, 0), extrude=0.004)
        letters.append((o, x0, y0, rnd))
    if not steady:
        for o, x0, y0, rnd2 in letters:
            loc(o, 0, x=x0, y=y0, z=cz + 0.02)
            loc(o, float_from, x=x0, y=y0, z=cz + 0.02)
            loc(o, D, x=x0 + rnd2.uniform(-0.6, 0.6), y=y0 + rnd2.uniform(-0.5, 0.5), z=cz + 0.4 + rnd2.uniform(0, 0.5))
            rot(o, float_from, z=0)
            rot(o, D, x=rnd2.uniform(-60, 60), z=rnd2.uniform(-90, 90))
    return letters


def y08(D):
    h1, h2 = exam_hall()
    p = yara()
    p['root'].location = (0.0, 2.7, 0.0)
    sit(p, 0.3)
    p['armL'].rotation_euler = (R(-92), 0, R(12))
    p['armR'].rotation_euler = (R(-92), 0, R(-12))
    p['head'].rotation_euler = (R(18), 0, 0)
    face_anim(p, [(0, dict(smile=0.0, brow=0.3, gaze=(0, -0.9))), (3.0, dict(brow=0.8, brow_lift=0.3, smile=-0.4, gaze=(0, -0.9), lid=0.0)), (6.0, dict(brow=1.0, smile=-0.7, gaze=(0, -0.6), lid=0.1))], D, blink_every=2.4)
    paper_with_letters((0.0, 2.1, 0.55), D, float_from=3.0)
    rot(h2, 0, y=0)
    rot(h2, D, y=720)
    breathe(p, D, amp=0.01)
    cam_path([(0, (0.6, 0.2, 1.7), (0.0, 2.3, 0.9)), (D, (0.2, 0.9, 1.3), (0.0, 2.1, 0.6))], focus=[(0, 2.3), (D, 1.3)])
    return p


def y09(D):
    h1, h2 = exam_hall()
    p = yara()
    p['root'].location = (0.0, 2.7, 0.0)
    sit(p, 0.3)
    p['armL'].rotation_euler = (R(-92), 0, R(12))
    p['armR'].rotation_euler = (R(-92), 0, R(-12))
    face_anim(p, [(0, dict(brow=1.0, smile=-0.7, gaze=(0, -0.5))), (1.4, dict(brow=0.9, smile=-0.8, lid=0.4, gaze=(1, 0)))], D, blink_every=None)
    # levanta-se e sai
    loc(p['root'], 0, y=2.7)
    loc(p['root'], 1.2, y=2.7)
    loc(p['root'], 3.2, y=-2.0)
    from anim import walk
    p['hips'].location = (0, 0, 0.3)
    loc(p['hips'], 0, z=0.3)
    loc(p['hips'], 1.2, z=0.3)
    loc(p['hips'], 1.6, z=0.75)
    for s in ('L', 'R'):
        rot(p['leg' + s], 0, x=-90)
        rot(p['leg' + s], 1.2, x=-90)
        rot(p['leg' + s], 1.6, x=0)
    # impresso: nome em branco e carimbo
    cube('form', (0.0, 1.0, 0.0), (0.9, 0.02, 1.2), mat('form', (0.98, 0.98, 0.96), 0.7), 0.01)
    form = O('form')
    form.location = (0.6, 4.2, 1.0)
    form.rotation_euler = (0, 0, 0)
    text3d('NOME:', (0.35, 4.15, 1.45), 0.08, (0.1, 0.1, 0.12), 0.0, extrude=0.004)
    cube('blank', (0.62, 4.15, 1.4), (0.5, 0.01, 0.015), mat('blk', (0.1, 0.1, 0.12), 0.5), 0.003)
    st = text3d('REPROVADA', (0.6, 4.1, 0.95), 0.12, (0.85, 0.1, 0.1), 3.0, extrude=0.01)
    pop(st, 3.0, 0.35)
    cam_path([(0, (0.9, 0.2, 1.6), (0.0, 2.6, 1.0)), (2.4, (0.8, 1.0, 1.5), (0.1, 2.5, 1.0)), (D, (0.5, 1.8, 1.3), (0.6, 4.2, 1.0))], focus=[(0, 2.6), (D, 2.4)])
    return p


def y10(D):
    from cubes import reset, sun_and_world
    reset(W, H, samples=SAMPLES)
    sun_and_world(0.06, (0.5, 0.55, 0.65))
    cube('floor', (0, 3, -0.05), (4, 14, 0.1), mat('cf', (0.7, 0.7, 0.72), 0.4), 0.02)
    cube('wallL', (-2, 3, 1.6), (0.1, 14, 3.2), mat('cwl', (0.88, 0.9, 0.95), 0.8), 0.02)
    cube('wallR', (2, 3, 1.6), (0.1, 14, 3.2), mat('cwr', (0.88, 0.9, 0.95), 0.8), 0.02)
    cube('end', (0, 10, 1.6), (4, 0.1, 3.2), mat('cend', (0.95, 0.95, 1.0), 0.5, emit=1.5, emit_color=(0.8, 0.9, 1.0)), 0.02)
    for i in range(5):
        cube('door%d' % i, (-1.95, 2 + i * 2.0, 1.0), (0.05, 0.9, 2.0), mat('cdr%d' % i, (0.45, 0.5, 0.6), 0.6), 0.02)
    cube('bench', (-1.3, 2.4, 0.3), (0.5, 1.6, 0.06), mat('bench', (0.5, 0.4, 0.3), 0.6), 0.02)
    cube('benchb', (-1.5, 2.4, 0.6), (0.06, 1.6, 0.5), mat('benchb', (0.5, 0.4, 0.3), 0.6), 0.02)
    aim(area_light('ceilc', (0, 3, 3.0), (0, 0, 0), 90, (0.85, 0.9, 1.0), 3.0), (0, 3, 0.5))
    p = yara()
    p['root'].location = (-1.25, 2.4, 0.31)
    p['root'].rotation_euler = (0, 0, R(90))
    sit(p, 0.0)
    p['hips'].rotation_euler = (R(25), 0, 0)
    p['armL'].rotation_euler = (R(-75), 0, R(20))
    p['armR'].rotation_euler = (R(-75), 0, R(-20))
    p['head'].rotation_euler = (R(30), 0, 0)
    ep1.slab('darkphone', (0, -0.52, 0.5), (0.22, 0.03, 0.42), (0.02, 0.02, 0.03), 0.05, parent=p['hips'], rot=(R(-12), 0, 0))
    face_anim(p, [(0, dict(smile=-0.5, lid=0.5, brow=0.8, gaze=(0, -0.9))), (4.0, dict(smile=-0.6, lid=0.65, brow=0.9, gaze=(0, -0.9)))], D, blink_every=3.0)
    breathe(p, D, period=4.0, amp=0.012)
    cam_path([(0, (1.3, -1.0, 1.4), (-1.2, 2.4, 0.9)), (D, (0.4, 0.4, 1.2), (-1.2, 2.4, 0.95))], focus=[(0, 3.6), (D, 2.4)])
    return p


def y11(D):
    from cubes import reset, sun_and_world
    reset(W, H, samples=SAMPLES)
    sun_and_world(0.02, (0, 0, 0))
    cube('face', (0, 0, 1.6), (1.6, 0.06, 1.6), mat('cface', (0.95, 0.95, 0.97), 0.3, emit=1.2, emit_color=(0.9, 0.95, 1.0)), 0.3)
    sun_logo((0, -0.05, 1.6), 0.2, color=(0.1, 0.1, 0.12), emit=0.0)
    h = cube('chand', (0, -0.06, 1.6), (0.05, 0.03, 0.6), mat('chm', (0.05, 0.05, 0.07), 0.4), 0.01)
    hm = cube('chand2', (0, -0.06, 1.6), (0.07, 0.03, 0.4), mat('chm2', (0.05, 0.05, 0.07), 0.4), 0.01)
    # origens dos ponteiros no centro: usar pivô
    pv1 = empty('pv1', (0, -0.07, 1.6)); h.parent = pv1; h.location = (0, 0, 0.3)
    pv2 = empty('pv2', (0, -0.07, 1.6)); hm.parent = pv2; hm.location = (0, 0, 0.2)
    rot(pv1, 0, y=0)
    rot(pv1, D, y=-1440)
    rot(pv2, 0, y=0)
    rot(pv2, D, y=-120)
    for i, n in enumerate(range(30, 0, -1)):
        o = text3d('DIA %d' % n, (0, -0.12, 0.45), 0.2, (0.5, 0.75, 1.0), 3.0, extrude=0.01)
        t0 = i * (D / 30)
        vis(o, [(0, False), (t0, True), (t0 + D / 30, False)])
    aim(area_light('key', (0, -2.5, 2.0), (0, 0, 0), 120, (1, 1, 1), 2.0), (0, 0, 1.4))
    camera((0, -3.4, 1.3), (0, 0, 1.2), lens=34, dof_dist=3.4, fstop=4.0)
    cam_path([(0, (0, -3.4, 1.3), (0, 0, 1.2)), (D, (0, -2.6, 1.3), (0, 0, 1.3))])


def y12(D):
    p, ph = seated_yara('warm')
    ph.location = (-0.35, 0.55, 0.86)
    ph.hide_render = True
    ep1.slab('phone2', (-0.35, 0.55, 1.15), (0.26, 0.03, 0.48), (0.02, 0.02, 0.03), 0.1, rot=(R(-70), 0, 0))
    ph2 = O('phone2')
    sl = sun_logo((-0.35, 0.51, 1.19), 0.14)
    pop(sl, 2.4, 0.5)
    bar = cube('pbar', (-0.35, 0.5, 1.0), (0.18, 0.01, 0.015), mat('pbm', (1, 1, 1), 0.3, emit=4.0), 0.003)
    scale(bar, 0, (0.001, 1, 1))
    scale(bar, 2.2, (0.001, 1, 1))
    scale(bar, 4.8, (1, 1, 1))
    face_anim(p, [(0, dict(smile=0.2, brow=0.3, gaze=(-0.5, -0.5))), (3.0, dict(smile=0.4, brow=0.1, brow_lift=0.2, gaze=(-0.4, -0.5)))], D, blink_every=2.4)
    rot(p['head'], 0, x=10)
    typing(p, D, 0.0, 0.0)
    breathe(p, D)
    from scenes import dust
    dust(n=40, area=(-2, 1.5, 0.3, 2.5, 0.4, 2.4))
    wide_cam((0.9, -2.0, 1.55), (0.3, -1.4, 1.5), (-0.3, 1.0, 1.35), (-0.35, 0.9, 1.35), D, lens=30, focus=2.6)
    return p


def bars_scene(D, mode):
    """Gráficos do offly em 3D: 'compare' (celular vs estudo) ou 'week' (dias da semana)."""
    p, ph = seated_yara('warm')
    ph.hide_render = True
    # ecrã grande do telemóvel em 3D por trás da secretária
    cube('screen_bg', (-0.3, 0.45, 1.5), (1.5, 0.03, 1.1), mat('sbg', (0.03, 0.03, 0.05), 0.2, emit=0.2), 0.05)
    if mode == 'compare':
        a_ = cube('bar_phone', (-0.8, 0.42, 1.3), (1.0, 0.04, 0.2), mat('bpm', (0.5, 0.75, 1.0), 0.3, emit=3.0, emit_color=BLUE), 0.01)
        b_ = cube('bar_study', (-0.8, 0.42, 1.0), (1.0, 0.04, 0.2), mat('bsm', (1.0, 0.85, 0.5), 0.3, emit=3.0, emit_color=(1.0, 0.8, 0.4)), 0.01)
        text3d('CELULAR', (-0.95, 0.4, 1.5), 0.07, (0.5, 0.75, 1.0), 3.0, extrude=0.004, align='LEFT')
        text3d('ESTUDO', (-0.95, 0.4, 1.2), 0.07, (1.0, 0.85, 0.5), 3.0, extrude=0.004, align='LEFT')
        z1, z2 = 1.3, 1.0
        for bar, w, z in ((a_, 1.2, z1), (b_, 0.12, z2)):
            key(bar, 'scale', 0.0, (0.001, 1, 1))
            key(bar, 'scale', 0.8, (0.001, 1, 1))
            key(bar, 'scale', 3.8, (w, 1, 1))
            key(bar, 'location', 0.0, (-1.0, 0.42, z))
            key(bar, 'location', 0.8, (-1.0, 0.42, z))
            key(bar, 'location', 3.8, (-1.0 + w / 2, 0.42, z))
        face_anim(p, [(0, dict(smile=0.1, brow=0.3, gaze=(-0.5, -0.4))), (4.0, dict(smile=-0.4, brow=0.9, lid=0.2, gaze=(-0.3, -0.4))), (7.0, dict(smile=-0.1, brow=0.6, lid=0.1, gaze=(-0.2, -0.3)))], D, blink_every=2.4)
    else:
        for i in range(7):
            hgt = [0.25, 0.3, 0.2, 0.3, 0.35, 0.4, 0.9][i]
            bar = cube('wbar%d' % i, (-1.0 + i * 0.28, 0.42, 1.05), (0.18, 0.04, 1.0), mat('wb%d' % i, (0.5, 0.75, 1.0) if i < 6 else (1.0, 0.5, 0.45), 0.3, emit=3.0, emit_color=BLUE if i < 6 else (1.0, 0.45, 0.4)), 0.01)
            key(bar, 'scale', 0.0, (1, 1, 0.001))
            key(bar, 'scale', 0.4 + i * 0.25, (1, 1, 0.001))
            key(bar, 'scale', 0.4 + i * 0.25 + 0.5, (1, 1, hgt))
            key(bar, 'location', 0.0, (-1.0 + i * 0.28, 0.42, 1.0))
            key(bar, 'location', 0.4 + i * 0.25, (-1.0 + i * 0.28, 0.42, 1.0))
            key(bar, 'location', 0.4 + i * 0.25 + 0.5, (-1.0 + i * 0.28, 0.42, 1.0 + hgt / 2))
        t = text3d('DOMINGO, 22H', (-0.3, 0.38, 1.8), 0.1, (1.0, 0.5, 0.45), 4.0, extrude=0.006)
        pop(t, 3.0, 0.4)
        face_anim(p, [(0, dict(smile=0.0, brow=0.4, gaze=(-0.5, -0.3))), (3.0, dict(smile=-0.5, brow=0.9, lid=0.2, gaze=(-0.3, -0.3)))], D, blink_every=2.4)
    rot(p['head'], 0, x=6)
    breathe(p, D)
    wide_cam((0.6, -2.4, 1.6), (0.2, -1.8, 1.55), (-0.3, 0.8, 1.4), (-0.3, 0.7, 1.4), D, lens=28, focus=3.0)
    return p


def y13(D):
    return bars_scene(D, 'compare')


def y14(D):
    return bars_scene(D, 'week')


def y15(D):
    p, ph = seated_yara('warm')
    ph.hide_render = True
    cube('screen_bg', (-0.3, 0.45, 1.5), (1.4, 0.03, 1.1), mat('sbg', (0.03, 0.03, 0.05), 0.2, emit=0.2), 0.05)
    # grelha de ícones; o da rede social fica bloqueado (cadeado)
    cols = [(0.9, 0.45, 0.45), (0.45, 0.7, 0.95), (0.95, 0.8, 0.35), (0.5, 0.8, 0.55), (0.75, 0.55, 0.85), (0.95, 0.6, 0.35)]
    for i in range(6):
        ic = cube('icon%d' % i, (-0.8 + (i % 3) * 0.28, 0.42, 1.65 - (i // 3) * 0.28), (0.2, 0.03, 0.2), mat('ic%d' % i, cols[i], 0.4, emit=1.2, emit_color=cols[i]), 0.05)
        pop(ic, 0.2 + i * 0.12, 0.3)
    lock = cube('lock', (-0.8, 0.39, 1.65), (0.12, 0.03, 0.1), mat('lockm', (1, 1, 1), 0.3, emit=4.0), 0.02)
    pop(lock, 2.0, 0.3)
    text3d('FOCO', (0.2, 0.4, 1.7), 0.1, (1.0, 0.85, 0.5), 3.0, extrude=0.006)
    # temporizador 25:00 a contar
    for i, tt in enumerate(('25:00', '24:59', '24:58', '24:57', '24:56')):
        o = text3d(tt, (0.2, 0.4, 1.4), 0.2, (1, 1, 1), 5.0, extrude=0.01)
        t0 = 3.0 + i * 1.0
        vis(o, [(0, False), (t0, True), (t0 + 1.0 if i < 4 else 999, False)])
    # cartão no espelho
    card = cube('card', (-0.1, 3.08, 1.2), (0.3, 0.02, 0.2), mat('cardm', (1.0, 0.95, 0.6), 0.6), 0.01)
    vis(card, [(0, False), (6.4, True)])
    ct = text3d('HOJE: 1 TEMA', (-0.1, 3.05, 1.2), 0.045, (0.15, 0.12, 0.1), 0.0, extrude=0.003)
    vis(ct, [(0, False), (6.4, True)])
    for i in range(4):
        v = text3d('v', (-0.2 + i * 0.1, 3.05, 1.05), 0.06, (0.25, 0.6, 0.35), 2.0, extrude=0.004)
        vis(v, [(0, False), (7.0 + i * 0.6, True)])
    face_anim(p, [(0, dict(smile=0.2, brow=0.2, gaze=(-0.5, -0.4))), (4.0, dict(smile=0.35, brow=-0.1, gaze=(0, -0.3))), (7.0, dict(smile=0.5, brow=0.0, gaze=(0.6, 0.0)))], D, blink_every=2.4)
    rot(p['head'], 0, x=6)
    rot(p['head'], 6.0, x=6, z=0)
    rot(p['head'], 6.8, x=0, z=22)
    breathe(p, D)
    cam_path([
        (0, (0.5, -2.2, 1.6), (-0.3, 0.8, 1.45)),
        (5.5, (0.2, -1.8, 1.6), (-0.1, 0.8, 1.5)),
        (6.8, (0.9, -2.4, 1.5), (-0.1, 3.0, 1.15)),
        (D, (0.5, -1.6, 1.4), (-0.1, 3.0, 1.15)),
    ], focus=[(0, 3.0), (5.5, 2.6), (6.8, 5.2), (D, 4.6)])
    return p


def y16(D):
    h1, h2 = exam_hall()
    p = yara()
    p['root'].location = (0.0, 2.7, 0.0)
    sit(p, 0.3)
    p['armL'].rotation_euler = (R(-92), 0, R(12))
    p['armR'].rotation_euler = (R(-92), 0, R(-12))
    p['head'].rotation_euler = (R(16), 0, 0)
    face_anim(p, [(0, dict(smile=0.1, brow=0.2, gaze=(0, -0.9))), (3.0, dict(smile=0.25, brow=0.0, gaze=(0, -0.9))), (8.0, dict(smile=0.7, brow_lift=0.3, gaze=(0, 0.2)))], D, blink_every=2.8)
    paper_with_letters((0.0, 2.1, 0.55), D, steady=True)
    t = 3.0
    while t < 7.2:
        rot(p['armR'], t, x=-92)
        rot(p['armR'], t + 0.25, x=-100)
        rot(p['armR'], t + 0.5, x=-92)
        t += 0.5
    rot(h2, 0, y=0)
    rot(h2, D, y=60)
    st = text3d('APROVADA', (0.0, 2.1, 1.45), 0.2, (0.95, 0.85, 0.4), 4.0, rot=(R(90), 0, 0), extrude=0.01)
    pop(st, 8.4, 0.5)
    breathe(p, D, amp=0.012)
    cam_path([(0, (0.5, 0.4, 1.7), (0.0, 2.3, 0.9)), (7.5, (0.2, 1.0, 1.3), (0.0, 2.1, 0.6)), (D, (0.0, 0.0, 1.5), (0.0, 2.3, 1.1))], focus=[(0, 2.4), (7.5, 1.3), (D, 2.5)])
    return p


def y17(D):
    p, ph = seated_yara('gold')
    mm = mom()
    mm['root'].location = (-2.7, 0.9, 0)
    mm['root'].rotation_euler = (0, 0, R(90))
    cube('door', (-3.3, 0.9, 1.0), (0.08, 1.0, 2.0), mat('door', (0.55, 0.4, 0.3), 0.6), 0.02)
    set_face(mm, smile=0.8, brow_lift=0.2, gaze=(0.5, 0))
    face_anim(mm, [(0, dict(smile=0.8, gaze=(0.5, 0)))], D, blink_every=2.5)
    face_anim(p, [(0, dict(smile=0.4, brow=0.1, gaze=(-0.3, 0.2))), (2.0, dict(smile=1.0, brow_lift=0.3, mouth_open=0.3, gaze=(-0.5, 0.3)))], D, blink_every=2.4)
    rot(p['head'], 0, x=0, z=0)
    rot(p['head'], 2.0, x=-4, z=-35)
    energy('sun', [(0, 900), (D, 1900)])
    breathe(p, D)
    from scenes import dust
    dust(n=60, area=(-2.4, 1.5, 0.2, 2.6, 0.3, 2.5), strength=8.0, color=(1.0, 0.8, 0.45))
    wide_cam((1.5, -3.2, 1.5), (0.5, -2.5, 1.45), (-1.2, 1.0, 1.3), (-1.3, 1.0, 1.3), D, lens=26, focus=3.6)
    return p


def y18(D):
    p, ph = seated_yara('gold')
    face_cam(p, 2.0, 1.45, D, side=0.2)
    face_anim(p, [(0, dict(smile=0.4, brow=0.15, gaze=(0, 0.1))), (2.6, dict(smile=0.55, brow_lift=0.15, gaze=(0, 0.1)))], D, blink_every=2.6)
    rot(p['head'], 0, x=0)
    rot(p['head'], 3.0, x=-4)
    breathe(p, D, amp=0.015)
    energy('sun', [(0, 1600), (D, 2200)])
    from scenes import dust
    dust(n=40, area=(-1.5, 1.2, 0.3, 1.5, 0.6, 2.4), strength=8.0, color=(1.0, 0.8, 0.45))
    return p


def y19(D):
    """Cartão final: A contra B, com o olho do Offy. (Os dois ecrãs são compostos na montagem.)"""
    from cubes import reset, sun_and_world
    reset(W, H, samples=SAMPLES)
    sun_and_world(0.0, (0, 0, 0))
    cube('floor', (0, 0, -1), (9, 4, 0.1), mat('fl', (0.01, 0.01, 0.01), 0.3), 0.01)
    white = (1, 1, 1)
    sun_logo((0, 0, 0.35), 0.5)
    text3d('offly', (0, 0, -0.35), 0.28, white, 3.0)
    text3d('Menos tela. Mais vida.', (0, 0, -0.65), 0.1, (0.75, 0.75, 0.75), 2.0)
    cube('offy_eye', (0, 0, 1.0), (0.9, 0.06, 0.55), mat('ew', (0.95, 0.95, 0.97), 0.3, emit=2.5, emit_color=white), 0.22)
    pup = cube('offy_pupil', (0.04, -0.04, 0.98), (0.3, 0.05, 0.3), mat('ep', (0.01, 0.01, 0.015), 0.2), 0.13)
    cube('offy_spark', (0.11, -0.075, 1.08), (0.06, 0.02, 0.06), mat('es', white, 0.2, emit=8.0), 0.01)
    for name, t in (('offy_eye', 0.2),):
        pop(O(name), t, 0.4)
    for nm in ('offy_eye', 'offy_pupil', 'offy_spark'):
        o = O(nm)
        s0 = tuple(o.scale)
        scale(o, 2.0, s0)
        scale(o, 2.1, (s0[0], s0[1], 0.1))
        scale(o, 2.25, s0)
        scale(o, 4.5, s0)
        scale(o, 4.6, (s0[0], s0[1], 0.1))
        scale(o, 4.75, s0)
    aim(area_light('soft', (0, -3, 1.5), (0, 0, 0), 40, (1, 1, 1), 3.0), (0, 0, 0.5))
    camera((0, -5.0, 0.4), (0, 0, 0.4), lens=50)


SCENES = {f'y{i:02d}': globals()[f'y{i:02d}'] for i in range(1, 20)}


def render(name, out, samples, w, h):
    global W, H, SAMPLES
    W, H, SAMPLES = w, h, samples
    ep1.W, ep1.H, ep1.SAMPLES = w, h, samples
    D = D_of(name)
    SCENES[name](D)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start = 1
    sc.frame_end = int(round(D * FPS))
    sc.render.filepath = os.path.join(out, 'f')
    os.makedirs(out, exist_ok=True)
    sc.render.use_overwrite = False
    sc.render.use_persistent_data = True
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.05
    sc.cycles.max_bounces = 3
    sc.cycles.diffuse_bounces = 2
    sc.cycles.glossy_bounces = 1
    sc.cycles.transmission_bounces = 1
    sc.cycles.use_denoising = os.environ.get('DENOISE', '1') == '1'
    try:
        sc.cycles.denoising_quality = os.environ.get('DQ', 'FAST')
    except Exception:
        pass
    sc.cycles.use_animated_seed = False
    sc.cycles.seed = 11
    sc.frame_step = int(os.environ.get('FRAME_STEP', '1'))
    t = time.time()
    bpy.ops.render.render(animation=True)
    print('SCENE_DONE', name, sc.frame_end, 'frames', round(time.time() - t, 1), 's', flush=True)


if __name__ == '__main__':
    if os.environ.get('PROBE'):
        out = sys.argv[1]
        W, H, SAMPLES = 270, 480, 4
        ep1.W, ep1.H, ep1.SAMPLES = 270, 480, 4
        os.makedirs(out, exist_ok=True)
        names = sys.argv[2:] or list(SCENES)
        for n in names:
            try:
                D = D_of(n)
                SCENES[n](D)
                sc = bpy.context.scene
                sc.cycles.use_denoising = False
                sc.frame_set(F(D * 0.55))
                sc.render.filepath = os.path.join(out, n + '.png')
                bpy.ops.render.render(write_still=True)
                print('PROBE_OK', n, flush=True)
            except Exception as e:
                import traceback
                traceback.print_exc()
                print('PROBE_FAIL', n, repr(e), flush=True)
    else:
        render(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 8, int(sys.argv[4]) if len(sys.argv) > 4 else 540, int(sys.argv[5]) if len(sys.argv) > 5 else 960)
