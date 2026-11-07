"""Animações do episódio 1 (30 fps). Cada função recebe a duração D da cena (segundos)."""
import math
import random

import bpy
from mathutils import Vector

import ep1
from anim import *
from cubes import CHARS, cube, mat, set_face, text3d, tear as make_tear, character

BLUE = (0.3, 0.55, 1.0)


def find_text(body):
    for o in bpy.data.objects:
        if o.type == 'FONT' and o.data.body == body:
            return o
    raise KeyError(body)


def push(p, d0, d1, D, side=0.3, up=0.05):
    """Aproxima a câmara do rosto: de `d0` a `d1` metros."""
    hp = ep1.head_pos(p)
    front = p['head'].matrix_world.to_3x3() @ Vector((0, -1, 0))
    right = p['head'].matrix_world.to_3x3() @ Vector((1, 0, 0))
    a = hp + front * d0 + right * side + Vector((0, 0, up))
    b = hp + front * d1 + right * (side * 0.4) + Vector((0, 0, up))
    cam_path([(0, tuple(a), tuple(hp)), (D, tuple(b), tuple(hp))], focus=[(0, d0), (D, d1)])


def a_s01(D):
    p = CHARS[0]
    t, k = 0.0, 0
    while t < D + 1:
        rot(p['armR'], t, x=-35)
        rot(p['armR'], t + 0.55, x=-80)
        rot(p['armR'], t + 1.0, x=-35)
        rot(p['head'], t, x=22)
        rot(p['head'], t + 0.55, x=30)
        rot(p['head'], t + 1.0, x=22)
        t += 1.5
    mt = mat('flyb', (0.62, 0.22, 0.2), 0.55)
    for i, (t0, end) in enumerate(((0.7, (-0.756, -0.05, 0.3)), (2.2, (-0.144, -0.05, 0.3)), (3.7, (-0.348, -0.05, 0.5)))):
        b = cube('fly%d' % i, (0.1, -0.12, 0.3), (0.2, 0.2, 0.2), mt, 0.015)
        vis(b, [(0, False), (t0 - 0.02, True)])
        loc(b, t0 - 0.02, x=0.1, y=-0.12, z=0.3)
        loc(b, t0 + 0.25, x=(0.1 + end[0]) / 2, y=-0.08, z=end[2] + 0.2)
        loc(b, t0 + 0.5, x=end[0], y=end[1], z=end[2])
    dust_drift('dust', D, 0.5)
    cam_path([(0, (1.1, -2.9, 0.62), (0, 0, 0.42)), (D, (0.75, -2.3, 0.55), (-0.1, 0, 0.45))], focus=[(0, 3.1), (D, 2.5)])
    face_anim(p, [(0, dict(smile=0.55, gaze=(-0.9, -0.5), brow=-0.05)), (3.0, dict(smile=0.9, gaze=(-0.8, -0.2), brow=-0.1, brow_lift=0.2))], D, blink_every=2.4)
    breathe(p, D, amp=0.01)


def a_s02(D):
    p = CHARS[0]
    r = p['root']
    z0 = r.location.z
    t = 0.0
    while t < D:
        loc(r, t, z=z0)
        loc(r, t + 0.3, z=z0 + 0.42)
        loc(r, t + 0.6, z=z0)
        # braços para cima e para fora (nunca à frente do rosto)
        rot(p['armL'], t, x=0, y=110, z=0)
        rot(p['armL'], t + 0.3, x=0, y=160, z=0)
        rot(p['armL'], t + 0.6, x=0, y=110, z=0)
        rot(p['armR'], t, x=0, y=-110, z=0)
        rot(p['armR'], t + 0.3, x=0, y=-160, z=0)
        rot(p['armR'], t + 0.6, x=0, y=-110, z=0)
        t += 0.6
    face_anim(p, [(0, dict(smile=1.0, mouth_open=0.7, brow_lift=0.4, gaze=(-0.4, 0.4)))], D, blink_every=2.0, talk=(0.2, D - 0.2))
    dust_drift('dust', D, 0.6)
    energy('sun', [(0, 1500), (D, 2200)])
    cam_path([(0, (1.0, -3.0, 0.85), (0, 0, 0.6)), (D, (0.1, -3.1, 0.8), (-0.1, 0, 0.7))], focus=[(0, 3.2), (D, 3.1)])


def a_s03(D):
    kid, mom = CHARS[0], CHARS[1]
    mom, kid = CHARS[0], CHARS[1]  # a mãe é criada primeiro nesta cena
    t = 0.3
    while t < 3.2:
        rot(mom['armR'], t, x=0, y=-100, z=0)
        rot(mom['armR'], t + 0.25, x=0, y=-135, z=0)
        rot(mom['armR'], t + 0.5, x=0, y=-100, z=0)
        t += 0.5
    face_anim(mom, [(0, dict(smile=0.1, brow=0.45, gaze=(0.5, -0.4))), (3.4, dict(smile=0.35, brow=0.6, gaze=(0.5, -0.4)))], D, blink_every=2.6, talk=(0.4, 3.0))
    t = 0.0
    while t < D:
        rot(kid['armR'], t, x=-45)
        rot(kid['armR'], t + 0.5, x=-78)
        rot(kid['armR'], t + 1.0, x=-45)
        t += 1.4
    breathe(kid, D)
    breathe(mom, D)
    dust_drift('dust', D, 0.4)
    cam_path([(0, (0.9, -1.7, 0.95), (0.0, 1.9, 0.9)), (D, (0.6, -1.3, 0.95), (0.0, 2.0, 0.95))], focus=[(0, 3.4), (D, 3.0)])


def a_s04(D):
    p = CHARS[0]
    tb = O('tablet')
    hand = cube('hand', (-0.1, -0.2, 0.9), (0.18, 0.18, 0.7), mat('handm', (0.85, 0.62, 0.48), 0.6), 0.04)
    loc(hand, 0, z=1.0)
    loc(hand, 0.55, z=0.38)
    loc(hand, 0.9, z=0.38)
    loc(hand, 1.5, z=1.2)
    loc(tb, 0, x=-0.1, y=-0.2, z=0.9)
    loc(tb, 0.55, z=0.05)
    energy('sun', [(0, 320), (0.6, 320), (2.2, 40)])
    O('sun').data.color = (1.0, 0.7, 0.4)
    energy('tabletlight', [(0, 0), (0.6, 0), (2.2, 150)])
    face_anim(p, [(0, dict(brow_lift=0.2, smile=0.5, gaze=(-0.2, 0.3))), (0.7, dict(brow_lift=0.8, mouth_open=0.3, smile=0.1, gaze=(-0.8, -0.9))), (2.2, dict(brow=0.1, smile=0.0, gaze=(-0.8, -0.9), screen_eyes=True))], D, blink_every=2.0)
    rot(p['head'], 0, x=18)
    rot(p['head'], 0.8, x=28)
    rot(p['head'], D, x=30)
    cam_path([(0, (1.0, -2.6, 0.55), (0, 0, 0.38)), (D, (0.8, -2.2, 0.5), (-0.05, 0, 0.35))], focus=[(0, 2.8), (D, 2.4)])


def a_s05(D):
    p = CHARS[0]
    face_anim(p, [(0, dict(screen_eyes=True, smile=-0.05, gaze=(0, -0.6), brow=0.1)), (2.5, dict(screen_eyes=True, smile=-0.15, gaze=(0.1, -0.5), brow=0.25, lid=0.1))], D, blink_every=None)
    flicker('tabletlight', 0, D, 38, 70, 0.09)
    sway(p['head'], D, axis=2, amp=2.5, period=2.6)
    breathe(p, D, amp=0.006)
    push(p, 1.9, 1.4, D, side=0.3)


def a_s06(D):
    kid = CHARS[0]
    box = O('box')
    bl = [O('bl%d' % i) for i in range(3)]
    for o, dy in [(box, 0.0)] + [(b, 0.0) for b in bl]:
        y0 = o.location.y
        loc(o, 0.2, y=y0)
        loc(o, 2.3, y=y0 + 1.0)
    d = O('closetdoor')
    rot(d, 0, z=-35)
    rot(d, 1.6, z=-35)
    rot(d, 2.7, z=0)
    energy('hall', [(0, 170), (1.8, 160), (D, 5)])
    t = 0.0
    while t < D:
        rot(kid['armR'], t, x=-55)
        rot(kid['armR'], t + 0.4, x=-62)
        t += 0.8
    face_anim(kid, [(0, dict(screen_eyes=True, smile=-0.1, gaze=(0, -0.7)))], D, blink_every=None)
    cam_path([(0, (0.4, -2.3, 0.9), (0.4, 1.6, 0.5)), (D, (0.45, -1.8, 0.85), (0.5, 1.9, 0.5))], focus=[(0, 3.7), (D, 3.6)])


def a_s07(D):
    teen = CHARS[0]
    kid = ep1.kid()
    kid['root'].location = (0.15, 0.1, 0)
    kid['root'].rotation_euler = (0, 0, math.radians(-30))
    ep1.sit(kid, 0.14)
    kid['armL'].rotation_euler = (math.radians(-55), 0, math.radians(8))
    kid['armR'].rotation_euler = (math.radians(-35), 0, math.radians(-8))
    set_face(kid, smile=0.5, gaze=(-0.9, -0.5))
    for k in range(3):
        pass
    show_char(kid, [(0, True), (0.9, False)])
    show_char(teen, [(0, False), (0.9, True)])
    energy('dusk', [(0, 700), (0.8, 700), (1.0, 3000), (1.3, 260)])
    # calendário: os anos folheiam até 2026
    old = find_text('2026')
    old.hide_render = True
    years = [str(y) for y in range(2012, 2027)]
    step = (D - 0.5) / len(years)
    for i, y in enumerate(years):
        o = text3d(y, (-0.9, 3.08, 1.95), 0.32, (0.05, 0.05, 0.08), 0.0, extrude=0.01)
        t0 = 0.3 + i * step
        t1 = 0.3 + (i + 1) * step if i < len(years) - 1 else 999
        vis(o, [(0, False), (t0, True), (t1, False)])
    # dia e noite a passar pela janela
    energy('dusk', [(1.3, 260), (1.7, 40), (2.1, 260), (D, 40)])
    t = 1.0
    while t < D:
        rot(teen['armL'], t, x=-80)
        rot(teen['armL'], t + 0.25, x=-86)
        t += 0.5
    face_anim(teen, [(0.9, dict(lid=0.45, brow=0.25, smile=-0.25, gaze=(-0.2, -0.8))), (2.0, dict(lid=0.6, brow=0.35, smile=-0.35, gaze=(-0.2, -0.9)))], D, blink_every=1.8)
    face_anim(kid, [(0, dict(smile=0.5, gaze=(-0.9, -0.5)))], 0.9, blink_every=None)
    breathe(teen, D)
    cam_path([(0, (1.0, -3.5, 1.0), (0, 0.2, 0.75)), (D, (0.7, -2.7, 0.9), (0.05, 0.2, 0.75))])


def a_s08(D):
    friends = CHARS[0:3]
    teen = CHARS[3]
    for i, f in enumerate(friends):
        t = 0.2 + 0.2 * i
        while t < 2.8:
            rot(f['armR'], t, y=-150 if i == 1 else -110)
            rot(f['armR'], t + 0.25, y=-120 if i == 1 else -80)
            t += 0.5
        face_anim(f, [(0, dict(smile=0.6, mouth_open=0.3, brow_lift=0.1))], 3.0, blink_every=2.2, talk=(0.3, 2.8) if i != 2 else None, seed=10 + i)
    for i, f in enumerate(friends):
        r = f['root']
        t0 = 3.0 + 0.25 * i
        rot(r, t0 - 0.01, z=90)
        rot(r, t0 + 0.5, z=-90)
        for s in ('armL', 'armR'):
            rot(f[s], t0 - 0.01, x=0)
            rot(f[s], t0 + 0.5, x=0)
            f[s].rotation_euler[1] = 0
        walk(f, t0 + 0.5, D, (-6.0, r.location.y))
    t = 0.8
    while t < 3.2:
        rot(teen['armR'], t, x=-120)
        rot(teen['armR'], t + 0.3, x=-148)
        rot(teen['armR'], t + 0.6, x=-120)
        t += 0.6
    rot(teen['armR'], 3.6, x=-85)
    face_anim(teen, [(0, dict(brow=0.4, smile=-0.2, gaze=(-0.1, -0.9), lid=0.15)), (3.0, dict(brow=0.7, smile=-0.45, gaze=(-0.1, -0.9), lid=0.3))], D, blink_every=2.4)
    breathe(teen, D)
    cam_path([(0, (0.4, -3.4, 1.25), (-0.8, 0.9, 0.9)), (D, (0.7, -3.0, 1.2), (-1.2, 0.9, 0.9))])


def a_s09(D):
    mom, teen = CHARS[0], CHARS[1]
    t = 0.2
    while t < D - 0.5:
        rot(mom['armR'], t, x=-40)
        rot(mom['armR'], t + 0.3, x=-70)
        rot(mom['armR'], t + 0.6, x=-40)
        t += 0.6
    face_anim(mom, [(0, dict(brow=0.5, smile=-0.1, gaze=(0.8, 0))), (2.5, dict(brow=0.8, smile=-0.3, gaze=(0.8, 0)))], D, blink_every=2.8, talk=(0.2, D - 0.4))
    face_anim(teen, [(0, dict(lid=0.4, smile=-0.1, brow=0.1, gaze=(0, -0.9), screen_eyes=True)), (2.5, dict(lid=0.5, smile=-0.2, brow=0.2, gaze=(0, -0.9), screen_eyes=True))], D, blink_every=None)
    ph = O('phone')
    t = 0.0
    while t < D:
        rot(ph, t, x=-12)
        rot(ph, t + 0.2, x=-20)
        t += 0.4
    # vapor dos pratos desaparece: o prato arrefece
    for pi, px in enumerate((-0.72, 0.72)):
        for k in range(4):
            s = cube('steam%d_%d' % (pi, k), (px + (k - 1.5) * 0.04, 1.2, 0.9), (0.05, 0.05, 0.05), mat('steam', (1, 1, 1), 0.5, emit=1.5), 0.01)
            t0 = k * 0.3
            vis(s, [(0, True), (2.0, False)])
            loc(s, 0, z=0.9 + 0.1 * k)
            loc(s, 1.0, z=1.15 + 0.1 * k)
            loc(s, 2.0, z=1.3 + 0.1 * k)
    breathe(teen, D)
    breathe(mom, D)
    cam_path([(0, (0.2, -3.0, 2.0), (0.0, 1.2, 1.0)), (D, (0.7, -2.7, 1.5), (0.1, 1.2, 0.95))])


def a_s10(D):
    teen = CHARS[0]
    old = find_text('9H 41MIN')
    old.hide_render = True
    vals = ['0H 00MIN', '1H 12MIN', '3H 05MIN', '5H 40MIN', '7H 18MIN', '9H 41MIN']
    for i, v in enumerate(vals):
        o = text3d(v, (0.05, 0.12, 1.26), 0.055, (1, 1, 1), 5.0, extrude=0.002)
        t0 = 0.2 + i * 0.5
        t1 = 0.2 + (i + 1) * 0.5 if i < len(vals) - 1 else 999
        vis(o, [(0, False), (t0, True), (t1, False)])
    ph = O('bigphone')
    loc(ph, 0, y=0.2)
    loc(ph, D, y=0.02)
    face_anim(teen, [(0, dict(brow=0.4, smile=-0.2, gaze=(0, -0.4))), (3.0, dict(brow=1.0, smile=-0.7, gaze=(0, -0.4), brow_lift=0.3))], D, blink_every=2.2)
    breathe(teen, D, amp=0.01)
    cam_path([(0, (0.05, -0.9, 1.52), (0.0, 1.4, 1.55)), (D, (0.05, -0.55, 1.55), (0.0, 1.4, 1.6))], focus=[(0, 1.05), (D, 0.75)])


def a_s11(D):
    teen = CHARS[0]
    old = find_text('03:00')
    old.hide_render = True
    a = text3d('02:59', (1.35, 1.7, 0.78), 0.12, (1.0, 0.15, 0.1), 6.0, extrude=0.004)
    b = text3d('03:00', (1.35, 1.7, 0.78), 0.12, (1.0, 0.15, 0.1), 6.0, extrude=0.004)
    vis(a, [(0, True), (0.9, False)])
    vis(b, [(0, False), (0.9, True)])
    flicker('screenlight', 0, D, 30, 78, 0.12)
    t = 0.0
    while t < D:
        rot(teen['armL'], t, x=-92)
        rot(teen['armL'], t + 0.15, x=-96)
        rot(teen['armR'], t, x=-92)
        rot(teen['armR'], t + 0.15, x=-89)
        t += 0.3
    face_anim(teen, [(0, dict(screen_eyes=True, brow=0.55, smile=-0.35, gaze=(0, -0.8), lid=0.1)), (1.8, dict(screen_eyes=True, brow=0.7, smile=-0.4, gaze=(0, -0.8), lid=0.1))], D, blink_every=None)
    breathe(teen, D)
    cam_path([(0, (2.5, -0.9, 1.35), (0.35, 1.7, 1.0)), (D, (2.0, -0.6, 1.3), (0.15, 1.7, 1.05))])


def a_s12(D):
    teen = CHARS[0]
    rot(teen['head'], 0, z=0)
    rot(teen['head'], 0.25, z=0)
    rot(teen['head'], 0.8, z=55)
    face_anim(teen, [(0, dict(brow_lift=0.8, mouth_open=0.3, brow=0.5, gaze=(0, -0.5), screen_eyes=True)), (0.9, dict(brow=0.9, brow_lift=0.5, gaze=(-1, 0), lid=0.05)), (1.6, dict(brow=0.9, smile=0.5, gaze=(-1, 0), lid=0.05))], D, blink_every=1.6)
    t = 0.0
    while t < D:
        rot(teen['armL'], t, x=-20)
        rot(teen['armL'], t + 0.4, x=-24)
        t += 0.8
    breathe(teen, D, amp=0.01)
    hp = ep1.head_pos(teen)
    # a câmara acompanha a cabeça virada para a porta
    cam_path([(0, (hp.x + 1.2, hp.y - 1.8, hp.z + 0.1), tuple(hp)), (D, (hp.x + 0.2, hp.y - 1.6, hp.z + 0.15), (hp.x - 0.2, hp.y, hp.z))])


def a_s13(D):
    teen = CHARS[0]
    tremor(O('phone'), 0, D, amp=2.4, step=2)
    for i in range(6):
        o = O('screen%d' % i)
        l0 = tuple(o.location)
        hx, hy = -0.1, 1.45
        l1 = (hx + (l0[0] - hx) * 0.68, hy + (l0[1] - hy) * 0.68, l0[2])
        loc(o, 0, x=l0[0], y=l0[1])
        loc(o, D, x=l1[0], y=l1[1])
    t = 0.0
    while t < D:
        scale(teen['hips'], t, 1.0)
        scale(teen['hips'], t + 0.12, 1.025)
        scale(teen['hips'], t + 0.3, 1.0)
        t += 0.9
    energy('screenlight', [(0, 22), (0.12, 40), (0.3, 22), (0.9, 22), (1.02, 40), (1.2, 22), (1.8, 22), (1.92, 40), (2.1, 22), (2.7, 22), (2.82, 40), (3.0, 22)])
    for side in ('armL', 'armR'):
        z0 = math.degrees(teen[side].rotation_euler[2])
        rot(teen[side], 0.9, z=z0)
        rot(teen[side], 1.1, z=z0 * 1.9)
        rot(teen[side], 1.4, z=z0)
    face_anim(teen, [(0, dict(brow=1.0, lid=0.15, smile=-0.7, gaze=(0, -0.9), screen_eyes=True)), (2.0, dict(brow=1.0, lid=0.05, smile=-0.85, gaze=(0, -0.9), screen_eyes=True))], D, blink_every=None)
    push(teen, 1.9, 1.5, D, side=0.15, up=0.1)


def a_s14(D):
    teen = CHARS[0]
    rot(teen['head'], 0, x=16)
    rot(teen['head'], D - 0.3, x=30)
    rot(teen['hips'], 0, x=18)
    rot(teen['hips'], D - 0.3, x=24)
    tr = make_tear(teen, 'R', 0.2)
    vis(tr, [(0, False), (0.9, True), (2.3, False)])
    z0 = tr.location.z
    loc(tr, 0.9, z=z0)
    loc(tr, 2.2, z=z0 - 0.35)
    energy('screenlight', [(0, 34), (D, 8)])
    face_anim(teen, [(0, dict(brow=1.0, lid=0.55, smile=-0.9, gaze=(0, -1))), (2.0, dict(brow=1.0, lid=0.8, smile=-1.0, gaze=(0, -1)))], D, blink_every=None)
    breathe(teen, D, period=4.0, amp=0.018)
    hp = ep1.head_pos(teen)
    cam_path([(0, (hp.x + 0.9, hp.y - 1.6, hp.z - 0.3), tuple(hp)), (D, (hp.x + 0.6, hp.y - 1.2, hp.z - 0.25), (hp.x, hp.y, hp.z - 0.05))], focus=[(0, 1.9), (D, 1.5)])


def a_s15(D):
    flicker('lamp', 0, D, 110, 170, 0.13, seed=4)
    dust_drift('dust', D, 0.3, 0.1)
    cam_path([(0, (0.1, 0.9, 1.35), (-1.6, 3.0, 1.32)), (D, (-0.9, 1.9, 1.38), (-1.6, 3.0, 1.34))], focus=[(0, 2.7), (D, 1.3)])


def a_s16(D):
    teen = CHARS[0]
    old = find_text('04:59')
    old.hide_render = True
    vals = ['04:59', '04:58', '04:57', '04:56', '04:55']
    for i, v in enumerate(vals):
        o = text3d(v, (0.05, 0.12, 1.15), 0.1, (1, 1, 1), 5.0, extrude=0.003)
        vis(o, [(0, i == 0), (i * 1.0 + 0.001 if i else 0.001, True), ((i + 1) * 1.0, False)] if i else [(0, True), (1.0, False)])
    logo = O('sunlogo')
    t = 0.0
    while t < D:
        scale(logo, t, 1.0)
        scale(logo, t + 0.5, 1.1)
        scale(logo, t + 1.0, 1.0)
        t += 1.0
    face_anim(teen, [(0, dict(brow=-0.15, lid=0.1, smile=-0.1, gaze=(0, -0.9))), (3.0, dict(brow=-0.3, lid=0.05, smile=-0.05, gaze=(0, -0.9)))], D, blink_every=2.6)
    breathe(teen, D, amp=0.012)
    cam_path([(0, (0.05, -0.85, 1.5), (0.0, 1.4, 1.55)), (D, (0.05, -0.6, 1.52), (0.0, 1.4, 1.58))], focus=[(0, 1.0), (D, 0.8)])


def a_s17(D):
    teen = CHARS[0]
    face_anim(teen, [(0, dict(brow=0.6, lid=0.1, smile=-0.2, gaze=(0, -0.5))), (2.2, dict(brow=0.35, lid=0.3, smile=0.05, gaze=(0, -0.4))), (D - 0.2, dict(brow=0.15, lid=0.4, smile=0.15, gaze=(0, -0.3)))], D, blink_every=2.4)
    energy('screenlight', [(0, 30), (D, 4)])
    energy('rim', [(0, 40), (D, 220)])
    rot(teen['head'], 0, x=8)
    rot(teen['head'], 1.0, x=3)
    rot(teen['head'], 2.2, x=9)
    rot(teen['head'], 3.4, x=3)
    rot(teen['head'], D, x=6)
    breathe(teen, D, period=2.2, amp=0.02)
    hp = ep1.head_pos(teen)
    front = teen['head'].matrix_world.to_3x3() @ Vector((0, -1, 0))
    right = teen['head'].matrix_world.to_3x3() @ Vector((1, 0, 0))
    a = hp + front * 1.7 + right * 0.4 + Vector((0, 0, 0.05))
    b = hp + front * 1.45 + right * -0.1 + Vector((0, 0, 0.0))
    cam_path([(0, tuple(a), tuple(hp)), (D, tuple(b), tuple(hp))], focus=[(0, 1.7), (D, 1.45)])


def a_s18(D):
    teen = CHARS[0]
    ph = O('phone')
    # o telemóvel desce da mão para a cama, virado para baixo
    ph.rotation_euler = (math.radians(-80), 0, math.radians(10))
    loc(ph, 0, x=0.0, y=0.95, z=1.2)
    rot(ph, 0, x=-80, z=10)
    loc(ph, 0.6, x=0.0, y=0.95, z=1.2)
    loc(ph, 1.5, x=0.5, y=1.2, z=0.585)
    rot(ph, 1.5, x=0, z=20)
    sl = bpy.data.objects.new('blueglow', bpy.data.lights.new('blueglow', 'AREA'))
    bpy.context.collection.objects.link(sl)
    sl.location = (0.0, 0.7, 1.3)
    sl.data.energy = 50
    sl.data.color = BLUE
    sl.data.size = 0.4
    sl.rotation_euler = (Vector((-0.1, 1.5, 1.8)) - sl.location).to_track_quat('-Z', 'Y').to_euler()
    energy('blueglow', [(0, 50), (1.3, 50), (1.6, 0)])
    energy('moonbeam', [(0, 30), (1.2, 40), (2.6, 900)])
    rot(teen['head'], 0, x=6)
    rot(teen['head'], 1.6, x=-3)
    rot(teen['head'], D, x=-2)
    face_anim(teen, [(0, dict(smile=-0.1, lid=0.2, brow=0.3, gaze=(-0.2, -0.6))), (1.8, dict(smile=0.3, lid=0.3, brow=0.2, gaze=(-0.5, -0.2))), (3.0, dict(smile=0.45, lid=0.35, brow=0.1, gaze=(-0.6, 0.0)))], D, blink_every=2.2)
    breathe(teen, D, period=3.6, amp=0.02)
    cam_path([(0, (2.3, -0.9, 1.4), (-0.1, 1.6, 0.9)), (D, (1.9, -1.2, 1.35), (-0.1, 1.6, 0.95))])


def a_s19(D):
    teen = CHARS[0]
    ghost = CHARS[1]
    txt = find_text('DIA 1 DE 30')
    pop(txt, 0.3, 0.5)
    z0 = txt.location.z
    loc(txt, 0.8, z=z0)
    loc(txt, 2.5, z=z0 + 0.06)
    loc(txt, D, z=z0)
    t = 0.0
    while t < D:
        rot(ghost['armR'], t, x=-35)
        rot(ghost['armR'], t + 0.5, x=-75)
        rot(ghost['armR'], t + 1.0, x=-35)
        t += 1.4
    # o fantasma da criança desvanece-se
    gm = None
    for o in descendants(ghost['root']):
        if o.type == 'MESH' and o.data.materials:
            gm = o.data.materials[0]
            break
    if gm:
        al = gm.node_tree.nodes['Principled BSDF'].inputs['Alpha']
        for t, v in ((0, 0.0), (0.6, 0.3), (3.4, 0.3), (D, 0.0)):
            al.default_value = v
            al.keyframe_insert(data_path='default_value', frame=F(t))
    face_anim(ghost, [(0, dict(smile=0.6, gaze=(-0.6, -0.5)))], D, blink_every=2.0, seed=8)
    face_anim(teen, [(0, dict(smile=0.15, lid=0.25, brow=0.3, gaze=(-1, 0.3))), (2.5, dict(smile=0.35, lid=0.2, brow=0.25, gaze=(-1, 0.4)))], D, blink_every=2.6)
    rot(teen['head'], 0, x=-6)
    rot(teen['head'], D, x=-12)
    breathe(teen, D, period=3.6, amp=0.012)
    cam_path([(0, (1.6, -2.4, 1.5), (-1.5, 0.6, 1.3)), (D, (1.1, -1.9, 1.45), (-1.7, 0.6, 1.3))])


def a_s20(D):
    p = CHARS[0]
    r = p['root']
    r.rotation_euler = (0, 0, 0)
    hp = ep1.head_pos(p)
    front = p['head'].matrix_world.to_3x3() @ Vector((0, -1, 0))
    right = p['head'].matrix_world.to_3x3() @ Vector((1, 0, 0))
    a = hp + front * 1.8 + right * 0.1 + Vector((0, 0, 0.05))
    b = hp + front * 1.45 + right * 0.0 + Vector((0, 0, 0.05))
    cam_path([(0, tuple(a), tuple(hp)), (D, tuple(b), tuple(hp))], focus=[(0, 1.8), (D, 1.45)])
    rot(r, 0, z=-55)
    rot(r, 0.15, z=-55)
    rot(r, 1.2, z=0)
    face_anim(p, [(0, dict(smile=0.0, lid=0.3, brow=0.3, gaze=(-0.8, 0.0))), (1.2, dict(smile=0.2, lid=0.1, brow=0.2, gaze=(0, 0.1))), (2.0, dict(smile=0.55, brow_lift=0.2, brow=0.1, lid=0.0, gaze=(0.1, 0.1)))], D, blink_every=2.0)
    for side in ('L', 'R'):
        sp = O('spark' + side)
        t = 0.0
        while t < D:
            scale(sp, t, 1.0)
            scale(sp, t + 0.5, 1.4)
            scale(sp, t + 1.0, 1.0)
            t += 1.0
    energy('rim', [(0, 300), (D, 650)])
    breathe(p, D, period=3.0, amp=0.012)


def a_s21(D):
    items = [('offy_eye', 0.2), ('offy_pupil', 0.3), ('offy_spark', 0.4), ('sunlogo', 0.6)]
    for name, t in items:
        pop(O(name), t, 0.4)
    texts = [find_text(b) for b in ('COMENTE UMA PALAVRA', 'BLOCO', 'RUA', 'offly', 'Menos tela. Mais vida.')]
    for i, o in enumerate(texts):
        pop(o, 1.0 + i * 0.35, 0.35)
    pop(O('divider'), 1.3, 0.4)
    t = 2.4
    for name in ('offy_eye', 'offy_pupil', 'offy_spark'):
        o = O(name)
        s0 = tuple(o.scale)
        scale(o, 2.4, s0)
        scale(o, 2.5, (s0[0], s0[1], 0.1))
        scale(o, 2.65, s0)
        scale(o, 3.8, s0)
        scale(o, 3.9, (s0[0], s0[1], 0.1))
        scale(o, 4.05, s0)
    logo = O('sunlogo')
    t = 1.0
    while t < D:
        scale(logo, t, 1.0)
        scale(logo, t + 0.5, 1.06)
        scale(logo, t + 1.0, 1.0)
        t += 1.0
    for o in texts[1:3]:
        z0 = o.location.z
        loc(o, 1.8, z=z0)
        loc(o, 3.0, z=z0 + 0.03)
        loc(o, D, z=z0)


ANIM = {f's{i:02d}': globals()[f'a_s{i:02d}'] for i in range(1, 22)}
