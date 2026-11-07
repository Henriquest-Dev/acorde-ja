"""Episódio 1 do Pedro: 21 cenas (um fotograma-chave por cena), sincronizadas com a narração.

Uso: python3 ep1.py <pasta_de_saida> [s01 s02 ...]
"""
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import bpy
from mathutils import Vector
from cubes import *
from scenes import dust, room, wood_blocks

R = math.radians
W, H, SAMPLES = 540, 960, 28

SKIN = (0.88, 0.58, 0.4)


def start(day, world=(0.02, 0.03, 0.07), strength=0.12):
    reset(W, H, samples=SAMPLES)
    sun_and_world(strength, world)
    room(day)
    return bpy.context.scene


def window(color, strength=4.0, y=0.6):
    cube('window', (-3.33, y, 1.9), (0.04, 2.0, 1.4), mat('win', color, 0.4, emit=strength, emit_color=color), 0.01)


def kid():
    return character((0.92, 0.68, 0.52), (0.85, 0.3, 0.25), (0.2, 0.3, 0.5), (0.25, 0.14, 0.08), scale=0.62, head_scale=1.18)


def teen():
    return character(SKIN, (0.16, 0.18, 0.25), (0.07, 0.08, 0.14), (0.08, 0.05, 0.04))


def mom():
    return character((0.9, 0.66, 0.5), (0.85, 0.55, 0.2), (0.3, 0.25, 0.4), (0.15, 0.08, 0.05))


def friend(col):
    return character((0.9, 0.65, 0.48), col, (0.2, 0.25, 0.35), (0.12, 0.08, 0.05), scale=0.78, head_scale=1.1)


def sit(p, hips_z=None):
    for s in ('L', 'R'):
        p['leg' + s].rotation_euler = (R(-90), 0, 0)
    if hips_z is not None:
        p['hips'].location = (0, 0, hips_z)


def slab(name, loc, size, color, emit, parent=None, rot=(0, 0, 0)):
    return cube(name, loc, size, mat(name, color, 0.2, emit=emit, emit_color=color), 0.012, rot=rot, parent=parent)


def head_pos(p, local=(0, -0.25, 0.27)):
    bpy.context.view_layer.update()
    h = p['face']['h']
    return p['head'].matrix_world @ Vector((local[0], local[1] * h, local[2] * h))


def cam_on_face(p, dist=1.3, side=0.0, up=0.0, lens=50, fstop=2.0, focus=None):
    hp = head_pos(p)
    front = p['head'].matrix_world.to_3x3() @ Vector((0, -1, 0))
    right = p['head'].matrix_world.to_3x3() @ Vector((1, 0, 0))
    loc = hp + front * dist + right * side + Vector((0, 0, up))
    camera(tuple(loc), tuple(hp), lens=lens, dof_dist=focus or dist, fstop=fstop)


BLUE = (0.3, 0.55, 1.0)


# ---------------------------------------------------------------- INFÂNCIA
def s01():
    start(True, (0.9, 0.7, 0.45), 0.35)
    window((1.0, 0.8, 0.5), 5.0)
    aim(area_light('sun', (-3.2, -1.2, 2.2), (0, 0, 0), 1400, (1.0, 0.76, 0.42), 2.2), (0.1, 0, 0.3))
    aim(area_light('fill', (2.5, -3.0, 2.0), (0, 0, 0), 120, (1.0, 0.9, 0.75), 3.0), (0, 0, 0.4))
    p = kid()
    p['root'].location = (0.4, 0.1, 0)
    p['root'].rotation_euler = (0, 0, R(-38))
    sit(p, 0.14)
    p['armL'].rotation_euler = (R(-55), 0, R(8))
    p['armR'].rotation_euler = (R(-35), 0, R(-8))
    p['head'].rotation_euler = (R(22), 0, 0)
    set_face(p, smile=0.55, gaze=(-0.9, -0.5), brow=-0.05)
    wood_blocks(10, origin=(-0.45, -0.05), size=0.2)
    dust()
    camera((1.1, -2.9, 0.62), (0, 0, 0.42), lens=34, dof_dist=3.1, fstop=2.2)


def s02():
    start(True, (1.0, 0.55, 0.3), 0.35)
    window((1.0, 0.55, 0.25), 5.0)
    aim(area_light('sun', (-3.2, -1.4, 1.2), (0, 0, 0), 1500, (1.0, 0.5, 0.2), 2.2), (0.1, 0, 0.4))
    aim(area_light('fill', (2.5, -3.0, 2.0), (0, 0, 0), 90, (1.0, 0.8, 0.6), 3.0), (0, 0, 0.6))
    p = kid()
    p['root'].location = (0.55, 0.0, 0.18)
    p['root'].rotation_euler = (0, 0, R(-25))
    p['armL'].rotation_euler = (R(-165), 0, R(14))
    p['armR'].rotation_euler = (R(-165), 0, R(-14))
    set_face(p, smile=1.0, mouth_open=0.7, brow_lift=0.4, gaze=(-0.4, 0.4))
    wood_blocks(14, origin=(-0.5, 0.0), size=0.22)
    for i in range(3):
        cube('top%d' % i, (-0.5 + (i - 1) * 0.23, 0.0, 0.22 * 4 + 0.11), (0.22, 0.22, 0.22), mat('t%d' % i, (0.82, 0.62, 0.35), 0.5), 0.015)
    dust(strength=8.0, color=(1.0, 0.65, 0.35))
    camera((1.0, -3.0, 0.85), (0.0, 0.0, 0.6), lens=34, dof_dist=3.2, fstop=2.4)


def s03():
    start(True, (0.85, 0.65, 0.45), 0.3)
    cube('doorL', (-0.62, 3.1, 1.2), (0.12, 0.14, 2.4), mat('dp', (0.5, 0.33, 0.2), 0.5), 0.02)
    cube('doorR', (0.62, 3.1, 1.2), (0.12, 0.14, 2.4), mat('dp2', (0.5, 0.33, 0.2), 0.5), 0.02)
    cube('lintel', (0, 3.1, 2.42), (1.36, 0.14, 0.12), mat('dp3', (0.5, 0.33, 0.2), 0.5), 0.02)
    cube('hall', (0, 3.45, 1.2), (1.2, 0.05, 2.4), mat('hall', (1.0, 0.8, 0.5), 0.4, emit=3.0, emit_color=(1.0, 0.8, 0.5)), 0.01)
    aim(area_light('hallight', (0, 2.2, 1.6), (0, 0, 0), 500, (1.0, 0.78, 0.45), 1.6), (0.3, 0, 0.6))
    aim(area_light('fill', (2.5, -3.0, 2.0), (0, 0, 0), 80, (1.0, 0.9, 0.75), 3.0), (0, 1, 0.8))
    m = mom()
    m['root'].location = (0, 2.7, 0)
    m['armR'].rotation_euler = (R(-100), 0, R(-10))
    set_face(m, smile=0.25, brow=0.45, gaze=(0.5, -0.4))
    p = kid()
    p['root'].location = (0.35, 0.3, 0)
    p['root'].rotation_euler = (0, 0, R(180))
    sit(p, 0.14)
    p['armL'].rotation_euler = (R(-55), 0, R(8))
    p['armR'].rotation_euler = (R(-45), 0, R(-8))
    wood_blocks(8, origin=(-0.2, 0.9), size=0.2)
    dust(n=40, area=(-1, 1, 0.5, 2.5, 0.2, 2.2))
    camera((0.9, -1.7, 0.95), (0.0, 1.9, 0.9), lens=32, dof_dist=3.4, fstop=2.4)


def s04():
    start(True, (0.5, 0.45, 0.4), 0.2)
    window((0.9, 0.6, 0.35), 2.0)
    aim(area_light('sun', (-3.2, -1.2, 2.0), (0, 0, 0), 300, (1.0, 0.7, 0.4), 2.2), (0.1, 0, 0.3))
    p = kid()
    p['root'].location = (0.4, 0.1, 0)
    p['root'].rotation_euler = (0, 0, R(-40))
    sit(p, 0.14)
    p['armL'].rotation_euler = (R(-40), 0, R(8))
    p['armR'].rotation_euler = (R(-40), 0, R(-8))
    p['head'].rotation_euler = (R(26), 0, 0)
    set_face(p, brow_lift=0.7, mouth_open=0.25, gaze=(-0.8, -0.9), smile=0.1)
    wood_blocks(8, origin=(-0.55, 0.1), size=0.2)
    slab('tablet', (-0.1, -0.2, 0.04), (0.5, 0.34, 0.04), BLUE, 7.0)
    aim(area_light('tabletlight', (-0.1, -0.5, 0.9), (0, 0, 0), 120, BLUE, 0.6), (0.4, 0.1, 0.5))
    camera((1.0, -2.6, 0.55), (0.0, 0.0, 0.38), lens=34, dof_dist=2.8, fstop=2.0)


def s05():
    start(True, (0.04, 0.05, 0.1), 0.1)
    p = kid()
    p['root'].location = (0, 0, 0)
    p['head'].rotation_euler = (R(12), 0, R(-8))
    set_face(p, screen_eyes=True, smile=-0.05, gaze=(0, -0.6), brow=0.1)
    aim(area_light('tabletlight', (0.0, -1.0, 0.5), (0, 0, 0), 55, BLUE, 0.7), tuple(head_pos(p)))
    aim(area_light('rim', (-1.5, 0.8, 1.6), (0, 0, 0), 40, (1.0, 0.7, 0.4), 1.0), tuple(head_pos(p)))
    cam_on_face(p, dist=1.9, side=0.3, up=0.05, lens=55, fstop=4.0)


def s06():
    start(True, (0.12, 0.1, 0.1), 0.1)
    cube('closet', (0, 3.1, 1.2), (1.8, 0.3, 2.4), mat('closetd', (0.03, 0.025, 0.025), 0.9), 0.02)
    cube('closetdoor', (0.55, 2.92, 1.2), (0.8, 0.07, 2.3), mat('cdoor', (0.5, 0.33, 0.2), 0.5), 0.02, rot=(0, 0, R(-35)))
    cube('box', (-0.15, 1.6, 0.2), (0.8, 0.55, 0.42), mat('box', (0.62, 0.48, 0.3), 0.8), 0.02)
    for i, c in enumerate(((0.72, 0.5, 0.28), (0.62, 0.22, 0.2), (0.3, 0.5, 0.65))):
        cube('bl%d' % i, (-0.4 + i * 0.25, 1.6, 0.48), (0.2, 0.2, 0.2), mat('bm%d' % i, c, 0.5), 0.015)
    aim(area_light('hall', (-1.0, 0.2, 2.0), (0, 0, 0), 160, (1.0, 0.75, 0.45), 1.5), (-0.1, 1.6, 0.3))
    p = kid()
    p['root'].location = (0.9, 1.0, 0)
    p['root'].rotation_euler = (0, 0, R(20))
    sit(p, 0.14)
    p['armL'].rotation_euler = (R(-55), 0, R(10))
    p['armR'].rotation_euler = (R(-55), 0, R(-10))
    p['head'].rotation_euler = (R(18), 0, 0)
    set_face(p, screen_eyes=True, smile=-0.1, gaze=(0, -0.7))
    slab('tablet', (0, -0.3, 0.45), (0.46, 0.04, 0.32), BLUE, 6.0, parent=p['hips'])
    aim(area_light('tabletlight', (1.4, 0.0, 0.6), (0, 0, 0), 60, BLUE, 0.6), tuple(head_pos(p)))
    camera((0.4, -2.3, 0.9), (0.4, 1.6, 0.5), lens=28, dof_dist=3.7, fstop=2.8)


# ---------------------------------------------------------------- OS ANOS
def night_room(moon=25):
    start(False, (0.02, 0.03, 0.07), 0.12)
    window((0.18, 0.25, 0.45), 1.2)
    cube('bed', (-0.1, 1.7, 0.28), (2.4, 2.8, 0.56), mat('bed', (0.16, 0.18, 0.28), 0.9), 0.05)
    cube('pillow', (-0.1, 2.7, 0.66), (1.4, 0.5, 0.22), mat('pillow', (0.75, 0.78, 0.85), 0.9), 0.07)
    cube('shelf', (-1.6, 3.0, 1.2), (1.2, 0.35, 0.06), mat('shelf', (0.2, 0.15, 0.12), 0.6), 0.015)
    cube('lastblock', (-1.6, 3.0, 1.35), (0.22, 0.22, 0.22), mat('lastb', (0.8, 0.6, 0.33), 0.5, emit=2.2, emit_color=(1.0, 0.7, 0.35)), 0.015)
    aim(area_light('moon', (3.0, 0.0, 3.5), (0, 0, 0), moon, (0.45, 0.55, 1.0), 3.0), (0, 1.5, 1.0))


def teen_on_bed(arms=-92, expr=None, lean=18, nod=14, phone=True, glow=55, face=True):
    p = teen()
    p['root'].location = (-0.1, 1.55, 0.56)
    sit(p, 0.0)
    p['hips'].rotation_euler = (R(lean), 0, 0)
    p['armL'].rotation_euler = (R(arms), 0, R(24))
    p['armR'].rotation_euler = (R(arms), 0, R(-24))
    p['head'].rotation_euler = (R(nod), 0, 0)
    if expr:
        set_face(p, **expr)
    if phone:
        ph = slab('phone', (0, -0.56, 0.8), (0.24, 0.03, 0.46), BLUE, 5.0, parent=p['hips'], rot=(R(-12), 0, 0))
    if glow:
        aim(area_light('screenlight', (0, 0.55, 1.35), (0, 0, 0), glow, BLUE, 0.4), tuple(head_pos(p)))
    return p


def s07():
    start(False, (0.06, 0.05, 0.07), 0.12)
    window((0.55, 0.32, 0.22), 2.5)
    cube('cal', (-0.9, 3.12, 1.9), (0.95, 0.04, 1.15), mat('cal', (0.9, 0.9, 0.88), 0.7), 0.01)
    text3d('2026', (-0.9, 3.08, 1.95), 0.32, (0.05, 0.05, 0.08), 0.0, extrude=0.01)
    text3d('NOVEMBRO', (-0.9, 3.08, 1.55), 0.1, (0.6, 0.1, 0.1), 0.0, extrude=0.01)
    aim(area_light('dusk', (-3.2, -1.2, 2.0), (0, 0, 0), 260, (1.0, 0.55, 0.3), 2.2), (0.1, 0, 0.5))
    p = teen()
    p['root'].location = (0.15, 0.1, 0)
    p['root'].rotation_euler = (0, 0, R(-30))
    sit(p, 0.0)
    p['hips'].rotation_euler = (R(12), 0, 0)
    p['armL'].rotation_euler = (R(-80), 0, R(22))
    p['armR'].rotation_euler = (R(-80), 0, R(-22))
    p['head'].rotation_euler = (R(25), 0, 0)
    set_face(p, lid=0.45, brow=0.25, smile=-0.25, gaze=(-0.2, -0.8))
    slab('phone', (0, -0.52, 0.72), (0.22, 0.03, 0.42), BLUE, 5.0, parent=p['hips'], rot=(R(-12), 0, 0))
    aim(area_light('screenlight', (0.9, -0.8, 1.2), (0, 0, 0), 45, BLUE, 0.4), tuple(head_pos(p)))
    camera((1.0, -3.5, 1.0), (0.0, 0.2, 0.75), lens=28, dof_dist=3.6, fstop=2.4)


def s08():
    start(False, (0.15, 0.17, 0.3), 0.5)
    bpy.data.objects.remove(bpy.data.objects['wall_left'])
    aim(area_light('dusk', (-3.5, -1.0, 2.5), (0, 0, 0), 700, (1.0, 0.6, 0.35), 3.0), (0, 0.8, 0.8))
    for i, (y, col) in enumerate(((0.0, (0.2, 0.5, 0.3)), (0.9, (0.7, 0.2, 0.2)), (1.8, (0.9, 0.8, 0.2)))):
        f = friend(col)
        f['root'].location = (-2.2, y - 0.3, 0)
        f['root'].rotation_euler = (0, 0, R(90))
        if i == 1:
            f['armR'].rotation_euler = (0, R(-150), 0)
        set_face(f, smile=0.6, mouth_open=0.3 if i == 1 else 0, brow_lift=0.1)
    cube('ball', (-1.7, 0.6, 0.12), (0.22, 0.22, 0.22), mat('ball', (0.95, 0.95, 0.95), 0.4), 0.05)
    p = teen()
    p['root'].location = (0.3, 0.9, 0)
    p['root'].rotation_euler = (0, 0, R(-25))
    sit(p, 0.0)
    p['hips'].rotation_euler = (R(15), 0, 0)
    p['armL'].rotation_euler = (R(-85), 0, R(24))
    p['armR'].rotation_euler = (R(-120), 0, R(-10))
    p['head'].rotation_euler = (R(22), 0, 0)
    set_face(p, brow=0.4, smile=-0.2, gaze=(-0.1, -0.9), lid=0.15)
    slab('phone', (0, -0.52, 0.72), (0.22, 0.03, 0.42), BLUE, 5.0, parent=p['hips'], rot=(R(-12), 0, 0))
    aim(area_light('screenlight', (1.5, 0.5, 1.2), (0, 0, 0), 40, BLUE, 0.4), tuple(head_pos(p)))
    camera((0.4, -3.4, 1.25), (-0.8, 0.9, 0.9), lens=26, dof_dist=4.4, fstop=2.8)


def s09():
    start(False, (0.1, 0.08, 0.08), 0.15)
    cube('table', (0, 1.2, 0.72), (1.9, 1.1, 0.08), mat('table', (0.45, 0.3, 0.18), 0.5), 0.02)
    for x in (-0.85, 0.85):
        for y in (0.75, 1.65):
            cube('leg', (x, y, 0.35), (0.1, 0.1, 0.7), mat('tl', (0.35, 0.22, 0.13), 0.6), 0.01)
    for x, rot in ((-1.45, 90), (1.45, -90)):
        cube('chair', (x, 1.2, 0.22), (0.5, 0.55, 0.44), mat('chair', (0.3, 0.2, 0.14), 0.7), 0.03)
        cube('plate', (x * 0.5, 1.2, 0.78), (0.5, 0.5, 0.03), mat('plate', (0.92, 0.92, 0.9), 0.3), 0.01)
        cube('food', (x * 0.5, 1.2, 0.83), (0.22, 0.22, 0.08), mat('food', (0.55, 0.4, 0.2), 0.7), 0.02)
    aim(area_light('lamp', (0, 1.2, 2.8), (0, 0, 0), 120, (1.0, 0.75, 0.45), 1.2), (0, 1.2, 0.8))
    m = mom()
    m['root'].location = (-1.45, 1.2, 0.0)
    m['root'].rotation_euler = (0, 0, R(90))
    sit(m, 0.5)
    m['armR'].rotation_euler = (R(-40), 0, R(-15))
    set_face(m, mouth_open=0.5, brow=0.5, smile=-0.1, gaze=(0.8, 0))
    p = teen()
    p['root'].location = (1.45, 1.2, 0.0)
    p['root'].rotation_euler = (0, 0, R(-90))
    sit(p, 0.5)
    p['hips'].rotation_euler = (R(15), 0, 0)
    p['armL'].rotation_euler = (R(-75), 0, R(24))
    p['armR'].rotation_euler = (R(-75), 0, R(-24))
    p['head'].rotation_euler = (R(30), 0, 0)
    set_face(p, lid=0.4, smile=-0.1, brow=0.1, gaze=(0, -0.9), screen_eyes=True)
    slab('phone', (0, -0.5, 0.5), (0.22, 0.03, 0.42), BLUE, 5.0, parent=p['hips'], rot=(R(-12), 0, 0))
    aim(area_light('screenlight', (1.2, 1.0, 1.1), (0, 0, 0), 45, BLUE, 0.4), tuple(head_pos(p)))
    camera((0.2, -3.0, 2.0), (0.0, 1.2, 1.0), lens=26, dof_dist=4.2, fstop=3.0)


def s10():
    night_room()
    p = teen_on_bed(expr=dict(brow=0.9, lid=0.0, smile=-0.6, gaze=(0, -0.4), brow_lift=0.3), phone=False, glow=0)
    ph = cube('bigphone', (0.05, 0.15, 1.2), (0.32, 0.03, 0.58), mat('pscreen', (0.02, 0.02, 0.04), 0.2, emit=0.3, emit_color=(0.2, 0.3, 0.6)), 0.03)
    text3d('9H 41MIN', (0.05, 0.12, 1.26), 0.055, (1, 1, 1), 5.0, extrude=0.002)
    text3d('POR DIA', (0.05, 0.12, 1.1), 0.028, (0.5, 0.75, 1.0), 4.0, extrude=0.002)
    aim(area_light('screenlight', (0.05, -0.2, 1.3), (0, 0, 0), 60, BLUE, 0.8), tuple(head_pos(p)))
    camera((0.05, -0.85, 1.5), (0.0, 1.4, 1.55), lens=40, dof_dist=1.0, fstop=2.0)


# ---------------------------------------------------------------- O FUNDO
def s11():
    night_room(moon=12)
    cube('night', (1.35, 1.9, 0.35), (0.5, 0.5, 0.7), mat('nightst', (0.2, 0.15, 0.12), 0.6), 0.03)
    cube('clock', (1.35, 1.78, 0.82), (0.42, 0.14, 0.2), mat('clockb', (0.04, 0.04, 0.05), 0.4), 0.02)
    text3d('03:00', (1.35, 1.7, 0.78), 0.12, (1.0, 0.15, 0.1), 6.0, extrude=0.004)
    p = teen_on_bed(expr=dict(screen_eyes=True, brow=0.55, smile=-0.35, gaze=(0, -0.8), lid=0.1))
    camera((2.5, -0.9, 1.35), (0.35, 1.7, 1.0), lens=26, dof_dist=3.4, fstop=2.2)


def s12():
    night_room(moon=12)
    cube('door', (-3.3, 0.6, 1.0), (0.08, 1.0, 2.0), mat('door', (0.2, 0.14, 0.1), 0.6), 0.02)
    cube('doorlight', (-3.28, 0.6, 0.02), (0.1, 1.0, 0.03), mat('dl', (1.0, 0.75, 0.4), 0.3, emit=8.0, emit_color=(1.0, 0.75, 0.4)), 0.005)
    aim(area_light('hallspill', (-2.6, 0.6, 0.15), (0, 0, 0), 60, (1.0, 0.75, 0.4), 0.8), (0, 1.5, 0.3))
    p = teen_on_bed(arms=-20, lean=5, nod=0, phone=False, glow=0, expr=dict(brow=0.9, smile=0.5, gaze=(-1, 0), lid=0.05))
    p['head'].rotation_euler = (0, 0, R(55))
    aim(area_light('face', (1.2, -0.8, 1.6), (0, 0, 0), 35, (0.5, 0.6, 1.0), 0.8), tuple(head_pos(p)))
    cam_on_face(p, dist=2.3, side=0.5, up=0.15, lens=34, fstop=2.4)


def s13():
    night_room(moon=8)
    p = teen_on_bed(lean=20, nod=12, expr=dict(brow=1.0, lid=0.15, smile=-0.7, gaze=(0, -0.9), screen_eyes=True), glow=22)
    hx, hy = -0.1, 1.45
    for i, a in enumerate((-80, -50, -20, 20, 50, 80)):
        ang = R(a)
        px, py = hx + math.sin(ang) * 1.5, hy - math.cos(ang) * 0.9 - 0.2
        s = slab('screen%d' % i, (px, py, 1.1 + 0.25 * (i % 2)), (0.5, 0.03, 0.9), BLUE, 0.7, rot=(R(-8), 0, math.atan2(hx - px, -(hy - py))))
    cam_on_face(p, dist=1.9, side=0.15, up=0.1, lens=40, fstop=2.8)


def s14():
    night_room(moon=6)
    p = teen_on_bed(lean=18, nod=16, arms=-75, expr=dict(brow=1.0, lid=0.55, smile=-0.9, gaze=(0, -1)), glow=34)
    p['phone'] = None
    tear(p, 'R', 0.2)
    hp = head_pos(p)
    camera((hp.x + 0.9, hp.y - 1.6, hp.z - 0.3), tuple(hp), lens=40, dof_dist=1.9, fstop=2.8)


def s15():
    night_room(moon=14)
    aim(area_light('lamp', (-1.0, 1.2, 2.2), (0, 0, 0), 150, (1.0, 0.7, 0.4), 0.6), (-1.6, 3.0, 1.35))
    dust(n=60, area=(-2.4, -0.8, 2.0, 3.0, 1.0, 1.9), strength=8.0, color=(1.0, 0.75, 0.4))
    camera((0.1, 0.9, 1.35), (-1.6, 3.0, 1.32), lens=50, dof_dist=2.7, fstop=1.6)


def s16():
    night_room(moon=14)
    p = teen_on_bed(phone=False, glow=0, lean=14, nod=14, expr=dict(brow=-0.15, lid=0.1, smile=-0.1, gaze=(0, -0.9)))
    cube('bigphone', (0.05, 0.15, 1.2), (0.32, 0.03, 0.58), mat('pscreen2', (0.01, 0.01, 0.015), 0.2), 0.03)
    text3d('04:59', (0.05, 0.12, 1.15), 0.1, (1, 1, 1), 5.0, extrude=0.003)
    sun_logo((0.05, 0.12, 1.33), 0.11)
    aim(area_light('screenlight', (0.05, -0.2, 1.3), (0, 0, 0), 40, (0.8, 0.85, 1.0), 0.8), tuple(head_pos(p)))
    camera((0.05, -0.85, 1.5), (0.0, 1.4, 1.55), lens=40, dof_dist=1.0, fstop=2.0)


def s17():
    night_room(moon=60)
    p = teen_on_bed(lean=8, nod=8, arms=-80, phone=False, expr=dict(brow=0.35, lid=0.3, smile=0.05, gaze=(0, -0.4)), glow=22)
    aim(area_light('rim', (-2.5, 0.8, 1.9), (0, 0, 0), 120, (0.6, 0.7, 1.0), 1.2), tuple(head_pos(p)))
    cam_on_face(p, dist=1.7, side=0.3, up=0.05, lens=45, fstop=2.4)


def s18():
    night_room(moon=30)
    aim(area_light('moonbeam', (-3.0, 0.4, 2.4), (0, 0, 0), 900, (0.65, 0.75, 1.0), 1.2), (0.3, 1.6, 0.6))
    p = teen_on_bed(lean=0, nod=6, arms=-30, phone=False, glow=0, expr=dict(smile=0.3, lid=0.3, brow=0.2, gaze=(-0.5, -0.2)))
    cube('phone', (0.5, 1.2, 0.585), (0.24, 0.46, 0.03), mat('phoneback', (0.03, 0.03, 0.05), 0.3), 0.012, rot=(0, 0, R(20)))
    camera((2.3, -0.9, 1.4), (-0.1, 1.6, 0.9), lens=34, dof_dist=3.2, fstop=2.2)


# ---------------------------------------------------------------- FECHO
def s19():
    start(False, (0.03, 0.04, 0.08), 0.15)
    window((0.5, 0.6, 0.85), 3.0)
    cube('moon', (-3.6, 0.6, 2.2), (0.5, 0.05, 0.5), mat('moon', (1, 1, 1), 0.3, emit=12.0, emit_color=(0.85, 0.9, 1.0)), 0.1)
    aim(area_light('moonlight', (-3.0, 0.6, 2.4), (0, 0, 0), 600, (0.65, 0.75, 1.0), 1.5), (-0.5, 0.6, 0.6))
    p = teen()
    p['root'].location = (-2.3, 0.6, 0)
    p['root'].rotation_euler = (0, 0, R(-80))
    p['armL'].rotation_euler = (R(-8), 0, 0)
    p['armR'].rotation_euler = (R(-8), 0, 0)
    p['head'].rotation_euler = (R(-6), 0, 0)
    set_face(p, smile=0.3, lid=0.2, brow=0.3, gaze=(-1, 0.3))
    g = kid()
    g['root'].location = (-0.7, 1.0, 0)
    g['root'].rotation_euler = (0, 0, R(-70))
    sit(g, 0.14)
    set_face(g, smile=0.6, gaze=(-0.6, -0.5))
    ghost = mat('ghost', (1.0, 0.85, 0.6), 0.5, emit=0.9, emit_color=(1.0, 0.85, 0.6))
    ghost.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.3
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.parent and (o.parent == g['root'] or o.parent.parent == g['root'] or (o.parent.parent and o.parent.parent.parent == g['root'])):
            o.data.materials.clear()
            o.data.materials.append(ghost)
    wood_blocks(8, origin=(-0.9, 0.5), size=0.2)
    text3d('DIA 1 DE 30', (-1.3, 0.3, 2.35), 0.22, (1, 1, 1), 4.0, extrude=0.012)
    camera((1.6, -2.4, 1.5), (-1.5, 0.6, 1.3), lens=26, dof_dist=4.0, fstop=2.6)


def s20():
    start(False, (0.3, 0.2, 0.15), 0.4)
    cube('sunrise', (0, 2.2, 1.4), (6, 0.05, 4), mat('sunr', (1.0, 0.6, 0.3), 0.4, emit=3.5, emit_color=(1.0, 0.6, 0.3)), 0.01)
    p = teen()
    p['root'].location = (0, 0, 0)
    set_face(p, smile=0.5, brow_lift=0.2, brow=0.1, lid=0.0, gaze=(0.1, 0.1))
    F = p['face']
    for side, x in (('L', -0.125), ('R', 0.125)):
        cube('spark' + side, (x + 0.02, -0.285, 0.34), (0.022, 0.01, 0.022), mat('sp', (1, 1, 1), 0.2, emit=6.0), 0.004, parent=p['head'])
    aim(area_light('key', (1.2, -1.8, 2.2), (0, 0, 0), 120, (1.0, 0.85, 0.65), 1.2), tuple(head_pos(p)))
    aim(area_light('rim', (-1.2, 1.5, 2.0), (0, 0, 0), 300, (1.0, 0.6, 0.3), 1.2), tuple(head_pos(p)))
    cam_on_face(p, dist=1.7, side=0.1, up=0.05, lens=50, fstop=2.0)


def s21():
    reset(W, H, samples=SAMPLES)
    sun_and_world(0.0, (0, 0, 0))
    cube('floor', (0, 0, -1), (9, 4, 0.1), mat('fl', (0.01, 0.01, 0.01), 0.3), 0.01)
    white = (1, 1, 1)
    # olho do Offy
    cube('offy_eye', (0, 0, 3.15), (0.9, 0.06, 0.55), mat('ew', (0.95, 0.95, 0.97), 0.3, emit=2.5, emit_color=white), 0.22)
    cube('offy_pupil', (0.04, -0.04, 3.13), (0.3, 0.05, 0.3), mat('ep', (0.01, 0.01, 0.015), 0.2), 0.13)
    cube('offy_spark', (0.11, -0.075, 3.23), (0.06, 0.02, 0.06), mat('es', white, 0.2, emit=8.0), 0.01)
    sun_logo((0, 0, 2.3), 0.55)
    text3d('COMENTE UMA PALAVRA', (0, 0, 1.7), 0.14, white, 4.0)
    cube('divider', (0, 0, 0.95), (0.012, 0.012, 1.0), mat('dv', white, 0.4, emit=3.0), 0.003)
    text3d('BLOCO', (-0.6, 0, 0.9), 0.26, (1.0, 0.8, 0.45), 4.0)
    text3d('RUA', (0.6, 0, 0.9), 0.26, (0.55, 0.75, 1.0), 4.0)
    text3d('offly', (0, 0, 0.1), 0.24, white, 3.0)
    text3d('Menos tela. Mais vida.', (0, 0, -0.2), 0.1, (0.75, 0.75, 0.75), 2.0)
    aim(area_light('soft', (0, -3, 2.0), (0, 0, 0), 40, (1, 1, 1), 3.0), (0, 0, 1.5))
    camera((0, -6.0, 1.55), (0, 0, 1.55), lens=50)


SCENES = {f's{i:02d}': globals()[f's{i:02d}'] for i in range(1, 22)}

if __name__ == '__main__':
    out = sys.argv[1]
    which = sys.argv[2:] or list(SCENES)
    os.makedirs(out, exist_ok=True)
    for name in which:
        t = time.time()
        try:
            SCENES[name]()
            bpy.context.scene.render.filepath = f'{out}/{name}.png'
            bpy.ops.render.render(write_still=True)
            print('OK', name, round(time.time() - t, 1), flush=True)
        except Exception as e:  # noqa: BLE001
            import traceback
            traceback.print_exc()
            print('FAIL', name, e, flush=True)
