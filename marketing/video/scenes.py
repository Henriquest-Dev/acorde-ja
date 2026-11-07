"""Cenas do episódio 1. Cada função monta uma cena completa (devolve um dicionário com as peças animáveis)."""
import math
import random
import bpy
from cubes import *

R = math.radians


def wood_blocks(n, seed=3, origin=(0, 0), spread=0.7, size=0.22):
    rnd = random.Random(seed)
    cols = [(0.72, 0.5, 0.28), (0.55, 0.36, 0.2), (0.82, 0.62, 0.35), (0.62, 0.22, 0.2), (0.3, 0.5, 0.65)]
    out, stack = [], 0
    for i in range(n):
        layer = i // 4
        ix = i % 4
        x = origin[0] + (ix - 1.5) * size * 1.02 + rnd.uniform(-0.01, 0.01)
        y = origin[1] + rnd.uniform(-0.01, 0.01)
        z = size / 2 + layer * size
        if layer > 0 and ix in (0, 3):
            continue
        out.append(cube('block%d' % i, (x, y, z), (size, size, size), mat('b%d' % i, rnd.choice(cols), 0.55), 0.015))
    return out


def room(day=True):
    wall_c = (0.62, 0.5, 0.38) if day else (0.07, 0.08, 0.12)
    floor_c = (0.55, 0.36, 0.2) if day else (0.1, 0.09, 0.09)
    cube('floor', (0, 0, -0.05), (9, 9, 0.1), mat('floor', floor_c, 0.4), 0.02)
    cube('wall_back', (0, 3.2, 2), (9, 0.1, 4), mat('wallb', wall_c, 0.8), 0.02)
    cube('wall_left', (-3.4, 0, 2), (0.1, 9, 4), mat('wallL', wall_c, 0.8), 0.02)
    cube('rug', (0, 0.3, 0.012), (2.4, 2.0, 0.03), mat('rug', (0.7, 0.28, 0.25) if day else (0.12, 0.1, 0.16), 0.9), 0.012)


def dust(n=70, seed=5, area=(-2, 2, -1.5, 2.5, 0.2, 2.6), color=(1.0, 0.85, 0.55), strength=6.0):
    rnd = random.Random(seed)
    m = mat('dust', color, 0.5, emit=strength, emit_color=color)
    items = []
    for i in range(n):
        p = (rnd.uniform(area[0], area[1]), rnd.uniform(area[2], area[3]), rnd.uniform(area[4], area[5]))
        items.append(cube('dust%d' % i, p, (0.012, 0.012, 0.012), m, 0.002))
    return items


def scene_child(t=0.0):
    """Plano 1: o Pedro criança a empilhar blocos ao sol da tarde."""
    reset(540, 960, samples=28)
    sun_and_world(0.35, (0.9, 0.7, 0.45))
    room(day=True)
    # janela dourada à esquerda (luz de área forte a entrar)
    aim(area_light('sun', (-3.2, -1.2, 2.2), (0, 0, 0), 1400, (1.0, 0.76, 0.42), 2.2), (0.1, 0.0, 0.3))
    aim(area_light('fill', (2.5, -3.0, 2.0), (0, 0, 0), 120, (1.0, 0.9, 0.75), 3.0), (0.0, 0.0, 0.4))
    p = character((0.92, 0.68, 0.52), (0.85, 0.3, 0.25), (0.2, 0.3, 0.5), (0.25, 0.14, 0.08), scale=0.62, head_scale=1.18)
    p['root'].location = (0.4, 0.1, 0.0)
    p['root'].rotation_euler = (0, 0, R(-38))
    p['hips'].location = (0, 0, 0.14)
    for s in ('L', 'R'):
        p['leg' + s].rotation_euler = (R(-90), 0, 0)
    p['arm L'.replace(' ', '')].rotation_euler = (R(-55), 0, R(8))
    p['armR'].rotation_euler = (R(-35 + 10 * math.sin(t * 2)), 0, R(-8))
    p['head'].rotation_euler = (R(22), 0, 0)
    wood_blocks(10, origin=(-0.45, -0.05), size=0.2)
    dust()
    camera((1.1, -2.9, 0.62), (0.0, 0.0, 0.42), lens=34, dof_dist=3.1, fstop=2.2)
    return p


def scene_teen(t=0.0):
    """Plano 4: o Pedro adolescente curvado na cama, iluminado pelo ecrã."""
    reset(540, 960, samples=28)
    sun_and_world(0.12, (0.02, 0.03, 0.07))
    room(day=False)
    cube('bed', (-0.1, 1.7, 0.28), (2.4, 2.8, 0.56), mat('bed', (0.16, 0.18, 0.28), 0.9), 0.05)
    cube('pillow', (-0.1, 2.7, 0.66), (1.4, 0.5, 0.22), mat('pillow', (0.75, 0.78, 0.85), 0.9), 0.07)
    p = character((0.88, 0.58, 0.4), (0.16, 0.18, 0.25), (0.07, 0.08, 0.14), (0.08, 0.05, 0.04), scale=1.0)
    p['root'].location = (-0.1, 1.55, 0.56)
    p['root'].rotation_euler = (0, 0, 0)
    p['hips'].location = (0, 0, 0.0)
    for s in ('L', 'R'):
        p['leg' + s].rotation_euler = (R(-88), 0, 0)
    p['hips'].rotation_euler = (R(18), 0, 0)
    p['armL'].rotation_euler = (R(-92), 0, R(24))
    p['armR'].rotation_euler = (R(-92), 0, R(-24))
    p['head'].rotation_euler = (R(14), 0, 0)
    ph = cube('phone', (0, -0.1, 0.0), (0.24, 0.03, 0.46), mat('screen', (0.25, 0.55, 1.0), 0.2, emit=5.0, emit_color=(0.3, 0.6, 1.0)), 0.012)
    ph.parent = p['hips']
    ph.location = (0, -0.56, 0.8)
    ph.rotation_euler = (R(-12), 0, 0)
    aim(area_light('screenlight', (0.0, 0.55, 1.35), (0, 0, 0), 55, (0.3, 0.55, 1.0), 0.4), (-0.1, 1.5, 1.85))
    aim(area_light('moon', (3.0, 0.0, 3.5), (0, 0, 0), 25, (0.45, 0.55, 1.0), 3.0), (0, 1.5, 1.0))
    # estante com o último bloco de madeira, ao fundo, a apanhar a luz do poste
    cube('shelf', (2.2, 3.0, 1.2), (1.2, 0.35, 0.06), mat('shelf', (0.2, 0.15, 0.12), 0.6), 0.015)
    cube('lastblock', (2.2, 3.0, 1.35), (0.22, 0.22, 0.22), mat('lastb', (0.8, 0.6, 0.33), 0.5, emit=1.2, emit_color=(1.0, 0.7, 0.35)), 0.015)
    aim(area_light('streetlamp', (2.6, 2.0, 1.9), (0, 0, 0), 80, (1.0, 0.72, 0.4), 0.5), (2.2, 3.0, 1.3))
    camera((1.7, -1.6, 1.55), (-0.05, 1.5, 1.35), lens=38, dof_dist=3.3, fstop=2.0)
    return p
