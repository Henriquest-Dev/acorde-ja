"""«Joaquim» — as cenas do filme. Cada função constrói a cena e a animação (tempo local em segundos)."""
import math
import random

import bpy

from cine import *  # noqa: F401,F403

SKIN_J = (0.27, 0.14, 0.085)
SKIN_M = (0.30, 0.16, 0.10)
SKIN_D = (0.29, 0.15, 0.09)
MAG = (1.0, 0.08, 0.45)
GRN = (0.1, 1.0, 0.3)
AMB = (1.0, 0.5, 0.08)
GOLD = (1.0, 0.72, 0.2)


def joaquim(clean=False):
    if clean:
        return person('joaquim', SKIN_J, (0.55, 0.47, 0.34), (0.1, 0.13, 0.22), (0.02, 0.015, 0.012))
    return person('joaquim', SKIN_J, (0.045, 0.05, 0.065), (0.03, 0.033, 0.045), (0.02, 0.015, 0.012), stubble=True)


def marta():
    return person('marta', SKIN_M, (0.7, 0.22, 0.2), (0.12, 0.16, 0.34), (0.03, 0.02, 0.015), scale=0.95, long_hair=True, sleeve=False)


def davi():
    return person('davi', SKIN_D, (0.9, 0.65, 0.1), (0.08, 0.2, 0.45), (0.02, 0.015, 0.012), scale=0.55, head=1.35, sleeve=False)


def flicker(l, t0, t1, lo, hi, step=0.12, seed=1):
    rnd = random.Random(seed)
    t = t0
    while t <= t1:
        energy(l, [(t, rnd.uniform(lo, hi))])
        t += step


# ---------------------------------------------------------------- 1 e 2b: quarto
def _bedroom():
    world((0.004, 0.005, 0.012), 1.0)
    box('floor', (0, 0, -0.05), (8, 8, 0.1), mat('floor', (0.05, 0.04, 0.04), 0.7), 0)
    box('wallb', (0, 1.95, 1.5), (8, 0.1, 3.4), mat('wall', (0.07, 0.08, 0.11), 0.9), 0)
    box('walll', (-2.3, 0, 1.5), (0.1, 8, 3.4), mat('wall', (0, 0, 0)), 0)
    box('bed', (0.3, 0.98, 0.22), (2.2, 1.9, 0.44), mat('mattress', (0.1, 0.11, 0.17), 0.9), 0.09, seg=5)
    box('blanket', (0.3, 1.25, 0.46), (2.24, 1.38, 0.1), mat('blanket', (0.07, 0.1, 0.22), 0.95), 0.05, seg=4)
    box('pillow', (-0.35, 1.62, 0.56), (0.72, 0.42, 0.17), mat('pillow', (0.4, 0.4, 0.45), 0.9), 0.08, seg=5)
    box('stand', (1.78, 1.58, 0.3), (0.5, 0.5, 0.6), mat('wood', (0.09, 0.05, 0.03), 0.5), 0.02)
    box('clock', (1.78, 1.36, 0.68), (0.34, 0.08, 0.15), mat('clockb', (0.01, 0.01, 0.012), 0.3), 0.02)
    text('03:07', (1.78, 1.315, 0.68), 0.1, mat('clockt', (1, 0.1, 0.05), emit=5, emit_color=(1, 0.12, 0.05)))
    # persiana: tiras de luar na parede
    for i in range(9):
        box(f'slat{i}', (2.7, 0.2, 1.2 + i * 0.2), (0.02, 3.2, 0.1), mat('slat', (0.02, 0.02, 0.02)), 0)
    area('moon', (4.6, -0.6, 2.7), (0, 1.0, 1.1), 520, (0.3, 0.45, 1.0), 0.25)
    area('fill', (-1, -3, 2.5), (0, 0, 1), 12, (0.3, 0.35, 0.6), 3)
    J = joaquim()
    pose(J, 0, at=(0, 0.16, 0))
    sit(J, 0, seat=0.42, lean=30)
    pose(J, 0, armL=(-38, -14, 0), armR=(-38, 14, 0), elbL=(-78, 0, 0), elbR=(-78, 0, 0), head=(26, 0, 0))
    face(J, 0, lid=0.55, brow=0.7, mouth=-0.3, gaze=(0, -1))
    Ph = phone(color=MAG, strength=5, light=3.5)
    Ph['root'].location = (0, -0.4, 0.83)
    Ph['root'].rotation_euler = (R(38), 0, 0)
    return J, Ph


def s1_escuro(D):
    J, Ph = _bedroom()
    breathe(J, 0, D, 4.0)
    flicker(Ph['light'], 0, D, 2.6, 4.2, 0.16, 3)
    rot(J['head'], 0, 26, 0, 0)
    rot(J['head'], 3.0, 29, 0, 4)
    rot(J['head'], D, 27, 0, -2)
    blink(J, 2.6, 0.55)
    blink(J, 5.0, 0.55)
    h = wpos(J['head'])
    tg = (h[0], h[1], h[2] + 0.02)
    cam = camera((1.5, -3.5, 0.7), tg, lens=34, fstop=2.0)
    cam_move(cam, [(0, (1.5, -3.5, 0.7), (0.15, 0.3, 1.0)), (D, (0.85, -2.3, 0.95), tg)], focus=[(0, 3.6), (D, 2.35)])


def s2b_olhos(D):
    J, Ph = _bedroom()
    flicker(Ph['light'], 0, D, 1.1, 2.0, 0.1, 5)
    face(J, 0, lid=0.6, brow=0.8, mouth=-0.3, gaze=(0, -1))
    for t, g in ((0.4, -0.6), (0.9, 0.5), (1.5, -0.4), (2.2, 0.6)):
        for s in 'LR':
            loc(J['pup' + s], t, x=g * J['hr'] * 0.08)
    face(J, 1.9, lid=0.5, brow=0.9, mouth=-0.3)
    face(J, 2.5, lid=0.18, brow=0.9, mouth=-0.3)
    face(J, 2.75, lid=0.62, brow=1.0, lift=0.6, mouth=-0.35)
    rot(J['head'], 0, 26, 0, 0)
    rot(J['head'], 2.5, 33, 0, 3)
    rot(J['head'], 2.8, 25, 0, 0)
    h = wpos(J['head'])
    tg = (h[0], h[1] - 0.2, h[2] + 0.1)
    cam = camera((0.3, -1.6, 0.6), tg, lens=70, fstop=2.8)
    cam_move(cam, [(0, (0.34, -1.7, 0.58), tg), (D, (0.2, -1.45, 0.62), tg)])


# ---------------------------------------------------------------- 2a: o ecrã (ponto de vista)
def s2a_ecra(D):
    world((0, 0, 0), 1)
    rnd = random.Random(4)
    scroll = empty('scroll', (0, 0, 0))
    cols = [(1.0, 0.1, 0.4), (0.7, 0.1, 0.9), (1.0, 0.25, 0.25), (0.9, 0.1, 0.65), (0.45, 0.1, 0.8)]
    for r in range(16):
        for c in range(3):
            col = rnd.choice(cols)
            m = mat(f'tile{r}_{c}', (0, 0, 0), emit=rnd.uniform(0.35, 0.9), emit_color=col)
            x, z = (c - 1) * 0.36, 1.5 - r * 0.5
            box(f'tile{r}_{c}', (x, 0, z), (0.32, 0.02, 0.45), m, 0.03, parent=scroll)
            # silhuetas desfocadas (formas abstractas) e selo 18+
            ball(f'blob{r}_{c}', (x + rnd.uniform(-0.06, 0.06), -0.02, z - 0.02), 0.09, mat(f'blobm{r % 3}', (0, 0, 0), emit=0.25, emit_color=tuple(v * 0.35 for v in col)), (1.3, 0.1, 1.2), parent=scroll, seg=12)
            if rnd.random() < 0.5:
                box(f'badge{r}_{c}', (x + 0.09, -0.02, z + 0.16), (0.1, 0.01, 0.06), mat('badge', (0, 0, 0), emit=1.6, emit_color=(1, 0.05, 0.05)), 0.02, parent=scroll)
                text('18+', (x + 0.09, -0.03, z + 0.16), 0.04, mat('badget', (0, 0, 0), emit=2.5, emit_color=(1, 1, 1)), parent=scroll)
    # deslizar: cada «só mais um» é um gesto
    z = 0.0
    K(scroll, 'location', 0, (0, 0, 0))
    for t in (0.35, 1.05, 1.7, 2.3):
        K(scroll, 'location', t, (0, 0, z))
        z += 1.5
        K(scroll, 'location', t + 0.38, (0, 0, z))
    # moldura do telemóvel e relógio a saltar
    dark = mat('bezel', (0.005, 0.005, 0.006), 0.4)
    for sx in (-1, 1):
        box(f'bz{sx}', (sx * 0.83, -0.05, 0.7), (0.6, 0.05, 4), dark, 0)
    box('bztop', (0, -0.05, 1.86), (2, 0.05, 0.36), dark, 0)
    tm = mat('status', (0, 0, 0), emit=2.5, emit_color=(1, 1, 1))
    for i, (txt, a, b) in enumerate((('03:07', 0, 1.05), ('03:52', 1.05, 1.7), ('04:26', 1.7, 2.3), ('05:10', 2.3, 99))):
        o = text(txt, (0, -0.08, 1.74), 0.085, tm)
        show(o, [(0, a == 0), (a, True), (b, False)])
    thumb = pill('thumb', 0.5, 0.075, mat('thumb', SKIN_J, 0.5), None, (0.3, -0.25, 0.1))
    thumb.rotation_euler = (0, R(-18), 0)
    for t in (0.35, 1.05, 1.7, 2.3):
        K(thumb, 'location', t, (0, 0, -0.12))
        K(thumb, 'location', t + 0.3, (-0.05, 0, 0.3))
        K(thumb, 'location', t + 0.55, (0, 0, -0.12))
    area('glow', (0.2, -1.4, 0.3), (0.3, -0.2, 0.2), 14, (1, 0.8, 0.75), 1)
    cam = camera((0, -2.5, 0.72), (0, 0, 0.72), lens=42, fstop=1.4)
    cam_move(cam, [(0, (0, -2.55, 0.72), (0, 0, 0.72)), (D, (0, -2.3, 0.72), (0, 0, 0.72))], focus=[(0, 2.85), (D, 2.6)])


# ---------------------------------------------------------------- 3: apostas
def s3_apostas(D):
    world((0.0, 0.004, 0.002), 1)
    box('floor', (0, 0, -0.05), (10, 10, 0.1), mat('floor', (0.02, 0.025, 0.02), 0.5), 0)
    box('table', (0, -0.5, 0.74), (1.7, 0.75, 0.07), mat('felt', (0.01, 0.12, 0.05), 0.9), 0.03)
    box('tleg', (0, -0.5, 0.36), (0.2, 0.2, 0.72), mat('wood', (0.05, 0.03, 0.02), 0.5), 0.02)
    J = joaquim()
    pose(J, 0, at=(0, 0.12, 0))
    sit(J, 0, seat=0.5, lean=16)
    pose(J, 0, armL=(-55, -10, 0), armR=(-55, 10, 0), elbL=(-55, 0, 0), elbR=(-55, 0, 0), head=(4, 0, 0))
    Ph = phone(color=GRN, strength=5, light=3)
    Ph['root'].location = (0, -0.42, 0.93)
    Ph['root'].rotation_euler = (R(50), 0, 0)
    # roleta gigante por trás, como um halo
    wheel = empty('wheel', (0, 1.5, 2.25))
    rm = mat('rred', (0.1, 0, 0), emit=1.7, emit_color=(1, 0.06, 0.04))
    bm = mat('rblk', (0.01, 0.01, 0.01), emit=0.25, emit_color=(0.3, 0.3, 0.35))
    gm = mat('rgrn', (0, 0.1, 0), emit=2.0, emit_color=GRN)
    rim = mat('rrim', (0.3, 0.2, 0.05), emit=1.1, emit_color=GOLD, metallic=1, rough=0.3)
    torus('wrim', (0, 0, 0), 1.12, 0.05, rim, rot=(R(90), 0, 0), parent=wheel)
    torus('wrim2', (0, 0, 0), 0.5, 0.03, rim, rot=(R(90), 0, 0), parent=wheel)
    n = 18
    for i in range(n):
        a = 2 * math.pi * i / n
        m = gm if i == 0 else (rm if i % 2 else bm)
        box(f'wedge{i}', (math.cos(a) * 0.81, 0, math.sin(a) * 0.81), (0.5, 0.05, 0.22), m, 0.02, rot=(0, -a, 0), parent=wheel)
    ballp = empty('ballp', (0, 1.44, 2.25))
    ball('rball', (0.98, 0, 0), 0.05, mat('rball', (1, 1, 1), emit=6), parent=ballp, seg=12)
    for t, v in ((0, 0), (3.2, 820), (5.3, 990), (D, 996)):
        rot(wheel, t, y=v)
        rot(ballp, t, y=-v * 1.3)
    glow = point('wglow', (0, 0.9, 2.2), 260, GRN, 0.6)
    flicker(glow, 0, 5.2, 200, 330, 0.14, 2)
    energy(glow, [(5.3, 260), (5.9, 30)])
    glow.data.keyframe_insert('color', frame=F(5.2))
    glow.data.color = (1, 0.1, 0.05)
    glow.data.keyframe_insert('color', frame=F(5.9))
    for mm, s0 in ((rm, 1.7), (gm, 2.0), (rim, 1.1)):
        emission(mm, [(5.2, s0), (6.0, s0 * 0.18)])
    # moedas a sair dele para a roleta
    coin = mat('coin', (0.8, 0.55, 0.1), 0.25, emit=1.6, emit_color=GOLD, metallic=1)
    rnd = random.Random(8)
    for i in range(15):
        o = cyl(f'coin{i}', (0, -0.2, 1.05), 0.055, 0.014, coin, rot=(R(90), 0, 0), verts=18)
        t0 = 0.5 + i * 0.3
        scl(o, 0, 0.001)
        scl(o, t0 - 0.02, 0.001)
        scl(o, t0, 1)
        K(o, 'location', t0, (rnd.uniform(-0.1, 0.1), -0.25, 1.05))
        K(o, 'location', t0 + 0.4, (rnd.uniform(-0.5, 0.5), 0.3, 2.0 + rnd.uniform(-0.2, 0.3)))
        K(o, 'location', t0 + 0.8, (0, 1.4, 2.25))
        K(o, 'rotation_euler', t0, (R(90), 0, 0))
        K(o, 'rotation_euler', t0 + 0.8, (R(90) + rnd.uniform(4, 9), rnd.uniform(3, 8), 0))
        scl(o, t0 + 0.7, 1)
        scl(o, t0 + 0.82, 0.001)
    # saldo a cair
    for txt, col, a, b in (('R$ 2.340', GRN, 0, 2.3), ('R$ 610', AMB, 2.3, 4.5), ('R$ 0', (1, 0.08, 0.05), 4.5, 99)):
        o = text(txt, (0, -0.9, 0.5), 0.15, mat('saldo' + txt, (0, 0, 0), emit=5, emit_color=col))
        show(o, [(0, a == 0), (a, True), (b, False)])
        if a:
            pop(o, a, 0.25)
    # rosto: euforia -> queda
    face(J, 0, lid=1.1, brow=-0.2, lift=0.8, mouth=0.6, gaze=(0, -0.6))
    face(J, 2.6, lid=1.1, brow=0.2, lift=0.6, mouth=0.2, gaze=(0, -0.6))
    face(J, 4.6, lid=1.0, brow=0.9, lift=0.5, mouth=-0.5, gaze=(0, -0.8))
    face(J, 6.0, lid=0.45, brow=1.0, mouth=-0.7, gaze=(0, -1))
    rot(J['head'], 4.8, 4, 0, 0)
    rot(J['head'], 6.2, 34, 0, 5)
    rot(J['spine'], 4.8, 16, 0, 0)
    rot(J['spine'], 6.4, 30, 0, 0)
    flicker(Ph['light'], 0, 5.0, 2, 4, 0.13, 6)
    energy(Ph['light'], [(5.2, 3), (6.0, 0.6)])
    area('rimcold', (-2.5, 1.0, 2.0), (0, 0.2, 1.2), 30, (0.2, 0.5, 0.4), 1.5)
    cam = camera((0, -3.5, 1.5), (0, 0.4, 1.55), lens=30, fstop=2.4)
    cam_move(cam, [(0, (0.25, -3.3, 1.2), (0, 0.5, 1.62)), (D, (-0.1, -2.5, 1.15), (0, 0.4, 1.42))], focus=[(0, 3.4), (D, 2.6)])


# ---------------------------------------------------------------- 4: bar
def s4_bar(D):
    world((0.006, 0.003, 0.001), 1)
    box('floor', (0, 0, -0.05), (10, 10, 0.1), mat('floor', (0.03, 0.02, 0.015), 0.6), 0)
    box('wallb', (0, 1.75, 1.6), (9, 0.1, 3.6), mat('barwall', (0.05, 0.025, 0.02), 0.85), 0)
    box('counter', (0, -0.32, 1.0), (4.4, 0.62, 0.08), mat('counter', (0.07, 0.03, 0.012), 0.22), 0.03)
    box('cfront', (0, -0.6, 0.48), (4.4, 0.06, 0.98), mat('cfront', (0.025, 0.012, 0.008), 0.6), 0.01)
    rnd = random.Random(11)
    cols = [(0.9, 0.45, 0.05), (0.1, 0.5, 0.15), (0.6, 0.08, 0.05), (0.75, 0.7, 0.5), (0.2, 0.3, 0.6)]
    for s, z in enumerate((1.25, 1.85)):
        box(f'shelf{s}', (0, 1.58, z), (4.2, 0.26, 0.05), mat('shelf', (0.04, 0.02, 0.012), 0.5), 0.01)
        for i in range(13):
            x = -1.95 + i * 0.325 + rnd.uniform(-0.03, 0.03)
            col = rnd.choice(cols)
            h = rnd.uniform(0.24, 0.34)
            m = mat(f'bot{s}_{i}', tuple(c * 0.4 for c in col), 0.12, emit=rnd.uniform(0.12, 0.4), emit_color=col)
            cyl(f'bot{s}_{i}', (x, 1.58, z + 0.03 + h / 2), 0.05, h, m, verts=16)
            cyl(f'neck{s}_{i}', (x, 1.58, z + 0.03 + h + 0.05), 0.018, 0.11, m, verts=10)
    cyl('lamp', (0.1, -0.2, 2.5), 0.28, 0.24, mat('lamp', (0.02, 0.02, 0.02), 0.4), r2=0.06)
    ball('bulb', (0.1, -0.2, 2.4), 0.06, mat('bulb', (1, 0.7, 0.3), emit=12, emit_color=(1, 0.6, 0.2)), seg=12)
    spot('lampl', (0.1, -0.2, 2.38), (0.05, -0.1, 0), 1500, (1, 0.6, 0.25), 100, 0.6, 0.08)
    area('facefill', (0.6, -2.2, 1.7), (0, 0.2, 1.4), 45, (1, 0.6, 0.3), 1.5)
    area('backglow', (0, 1.2, 2.6), (0, 1.6, 1.5), 40, (1, 0.5, 0.15), 3)
    area('teal', (-3, -1.5, 1.8), (0, 0.2, 1.3), 28, (0.1, 0.5, 0.6), 1.2)
    J = joaquim()
    pose(J, 0, at=(0, 0.3, 0))
    sit(J, 0, seat=0.6, lean=20)
    pose(J, 0, armL=(-50, -8, 0), armR=(-50, 8, 0), elbL=(-62, 0, 0), elbR=(-62, 0, 0), head=(12, 0, 0))
    glass = mat('glass', (0.9, 0.95, 1.0), 0.03, transmission=1.0)
    liq = mat('liq', (0.5, 0.2, 0.02), 0.1, emit=1.4, emit_color=(1, 0.45, 0.05))
    gl = []
    xs = [0.2, -0.5, -0.82, 0.55, 0.88, -0.18]
    for i, x in enumerate(xs):
        g = empty(f'glass{i}', (x, -0.42 + (0.05 if i % 2 else -0.04), 1.045))
        cyl(f'glassm{i}', (0, 0, 0.065), 0.045, 0.13, glass, parent=g, verts=20)
        if i == 0:
            cyl(f'liq{i}', (0, 0, 0.04), 0.038, 0.06, liq, parent=g, verts=16)
        else:
            cyl(f'liq{i}', (0, 0, 0.018), 0.038, 0.012, liq, parent=g, verts=16)
        gl.append(g)
    # bebe o primeiro copo
    g0 = gl[0]
    K(g0, 'location', 1.5, (0.2, -0.46, 1.045))
    K(g0, 'location', 2.1, (0.09, -0.02, 1.47))
    K(g0, 'rotation_euler', 1.5, (0, 0, 0))
    K(g0, 'rotation_euler', 2.1, (R(55), 0, 0))
    K(g0, 'location', 2.5, (0.09, -0.02, 1.47))
    K(g0, 'rotation_euler', 2.5, (R(70), 0, 0))
    K(g0, 'location', 3.0, (0.22, -0.44, 1.045))
    K(g0, 'rotation_euler', 3.0, (0, 0, 0))
    for t, a, e, hd in ((1.5, -50, -62, 12), (2.1, -62, -128, -12), (2.5, -62, -132, -18), (3.0, -50, -62, 14)):
        rot(J['armR'], t, a, 2 if t in (2.1, 2.5) else 8, 0)
        rot(J['elbR'], t, e, 0, 0)
        rot(J['head'], t, hd, 0, 0)
    for i in range(1, 6):
        pop(gl[i], 3.2 + (i - 1) * 0.24, 0.22)
        scl(gl[i], 0, 0.001)
    # afunda
    face(J, 0, lid=0.6, brow=0.7, mouth=-0.3, gaze=(0.3, -0.8))
    face(J, 3.2, lid=0.5, brow=0.8, mouth=-0.2, gaze=(0, -0.8))
    face(J, 4.7, lid=0.2, brow=0.9, mouth=-0.5, gaze=(0, -1))
    rot(J['spine'], 3.1, 20, 0, 0)
    rot(J['spine'], D, 46, 0, 8)
    rot(J['head'], D, 30, 0, 18)
    cam = camera((1.0, -2.3, 1.6), (0, 0.1, 1.42), lens=40, fstop=2.0)
    cam_move(cam, [(0, (0.95, -2.4, 1.62), (0.05, 0.15, 1.5)), (D, (-0.4, -2.0, 1.5), (0, 0.0, 1.36))])


# ---------------------------------------------------------------- 5 e 6: o vazio
def _void(door_x, family=True):
    bg = world((0, 0, 0), 1)
    box('floor', (0, 2, -0.05), (40, 40, 0.1), mat('vfloor', (0.02, 0.02, 0.025), 0.22), 0)
    J = joaquim()
    pose(J, 0, at=(0, 0, 0), hips_z=0.2, spine=(34, 0, 0), legL=(-128, 0, 6), legR=(-128, 0, -6), kneeL=(118, 0, 0), kneeR=(118, 0, 0),
         armL=(-72, -22, 0), armR=(-72, 22, 0), elbL=(-38, 0, 0), elbR=(-38, 0, 0), head=(30, 0, 0))
    face(J, 0, lid=0.4, brow=1.0, mouth=-0.6, gaze=(0, -1))
    # porta ao fundo
    dy = 7.0
    box('dlight', (0, dy, 1.35), (1.3, 0.04, 2.7), mat('dlight', (0, 0, 0), emit=9, emit_color=(1, 0.72, 0.4)), 0)
    wallm = mat('vwall', (0.004, 0.004, 0.005), 0.9)
    box('dwl', (-5.65, dy - 0.05, 2), (10, 0.1, 6), wallm, 0)
    box('dwr', (5.65, dy - 0.05, 2), (10, 0.1, 6), wallm, 0)
    box('dwt', (0, dy - 0.05, 3.85), (1.3, 0.1, 2.3), wallm, 0)
    leaf = box('dleaf', (door_x, dy - 0.12, 1.35), (1.3, 0.06, 2.7), mat('dleafm', (0.001, 0.001, 0.001), 0.9), 0.01)
    dl = area('doorl', (0, dy - 0.6, 1.5), (0, 0, 0.6), 2600, (1, 0.7, 0.4), 1.0)
    fam = None
    if family:
        M = marta()
        C = davi()
        pose(M, 0, at=(-0.22, dy - 0.75, 0))
        pose(C, 0, at=(0.3, dy - 0.8, 0))
        fam = (M, C)
    # os três vícios a orbitar
    orb = empty('orbit', (0, 0, 0.75))
    Ph = phone('vph', MAG, 6, 5)
    Ph['root'].parent = orb
    Ph['root'].location = (0.95, 0, 0.1)
    Ph['root'].rotation_euler = (R(15), 0, R(90))
    chip = empty('chip', (-0.48, 0.82, 0.25), orb)
    cyl('chipm', (0, 0, 0), 0.12, 0.035, mat('chipm', (0, 0.1, 0), emit=2.2, emit_color=GRN), rot=(R(70), 0, 0), parent=chip, verts=20)
    cl = point('chipl', (0, 0, 0), 18, GRN, 0.1, chip)
    bot = empty('bot', (-0.48, -0.82, -0.05), orb)
    bmm = mat('vbot', (0.2, 0.08, 0), 0.15, emit=1.3, emit_color=AMB)
    cyl('botm', (0, 0, 0), 0.06, 0.26, bmm, parent=bot, verts=14)
    cyl('botn', (0, 0, 0.19), 0.02, 0.12, bmm, parent=bot, verts=10)
    bl = point('botl', (0, 0, 0), 18, AMB, 0.1, bot)
    return dict(J=J, leaf=leaf, dl=dl, fam=fam, orb=orb, ph=Ph, chip=chip, cl=cl, bot=bot, bl=bl, bg=bg, dy=dy)


def s5_perda(D):
    V = _void(1.36)
    J, M, C = V['J'], V['fam'][0], V['fam'][1]
    rot(V['orb'], 0, z=20)
    rot(V['orb'], D, z=330)
    linear(V['orb'])
    energy(V['cl'], [(0.4, 18), (0.8, 110), (1.5, 18)])
    energy(V['ph']['light'], [(1.6, 5), (2.0, 40), (2.8, 5)])
    energy(V['bl'], [(2.8, 18), (3.1, 70), (3.7, 18)])
    breathe(J, 0, D, 3.0, 0.02)
    # a família espera, vira-se e sai
    face(M, 0, lid=0.9, brow=0.9, mouth=-0.5)
    face(C, 0, lid=1.0, brow=0.9, mouth=-0.4)
    pose(C, 0, armL=(0, 0, -25))
    for P_, x0 in ((M, -0.22), (C, 0.3)):
        rot(P_['root'], 2.6, z=0)
        rot(P_['root'], 3.3, z=180)
    walk(M, 3.3, 5.6, (-0.22, V['dy'] - 0.75), (-0.1, V['dy'] + 1.6), swing=22, step=0.4)
    walk(C, 3.4, 5.6, (0.3, V['dy'] - 0.8), (0.25, V['dy'] + 1.5), swing=26, step=0.3)
    # a porta quase fecha
    loc(V['leaf'], 3.9, x=1.36)
    loc(V['leaf'], 6.3, x=0.1)
    energy(V['dl'], [(3.9, 2600), (6.3, 260)])
    rot(J['head'], 3.0, 30, 0, 0)
    rot(J['head'], 5.5, 38, 0, 0)
    cam = camera((0, -2.6, 0.9), (0, 1.5, 0.9), lens=36, fstop=2.2)
    cam_move(cam, [(0, (0.5, -2.5, 1.5), (0, 1.2, 0.55)), (D, (0, -5.4, 2.6), (0, 2.0, 0.75))], focus=[(0, 2.9), (D, 5.9)])


def s6_virada(D):
    V = _void(0.1, family=False)
    J = V['J']
    V['dl'].data.energy = 260
    rot(V['orb'], 0, z=330)
    rot(V['orb'], D, z=470)
    linear(V['orb'])
    breathe(J, 0, D, 3.4, 0.02)
    # levanta a cabeça
    rot(J['head'], 1.1, 30, 0, 0)
    rot(J['head'], 2.6, 2, 0, 0)
    rot(J['spine'], 1.1, 34, 0, 0)
    rot(J['spine'], 3.0, 20, 0, 0)
    face(J, 1.0, lid=0.4, brow=1.0, mouth=-0.6, gaze=(0, -1))
    face(J, 2.6, lid=0.85, brow=0.9, mouth=-0.3, gaze=(0, 0))
    # pediu ajuda: a porta volta a abrir e alguém espera
    loc(V['leaf'], 3.7, x=0.1)
    loc(V['leaf'], 5.0, x=1.36)
    energy(V['dl'], [(3.7, 260), (5.0, 3000)])
    M = marta()
    pose(M, 0, at=(0, V['dy'] - 0.7, 0), armR=(-40, 0, 20), elbR=(-30, 0, 0))
    face(M, 0, lid=1, brow=0.4, mouth=0.5)
    show(M['root'], [(0, False), (4.0, True)])
    rot(J['head'], 4.2, 2, 0, 0)
    rot(J['head'], 4.9, -6, 0, 0)
    face(J, 4.9, lid=1.0, brow=0.6, lift=0.6, mouth=0.0, gaze=(0, 0.3))
    # o telemóvel muda: offly
    Ph2 = phone('ph2', (0.3, 0.45, 1.0), 5, 1.8)
    Ph2['root'].location = (0.0, -0.5, 0.62)
    Ph2['root'].rotation_euler = (R(40), 0, 0)
    show(Ph2['root'], [(0, False), (5.2, True)])
    pop(Ph2['root'], 5.2, 0.3)
    rot(J['armL'], 4.9, -72, -22, 0)
    rot(J['armR'], 4.9, -72, 22, 0)
    rot(J['armL'], 5.4, -58, -14, 0)
    rot(J['armR'], 5.4, -58, 14, 0)
    for o in (V['ph']['root'], V['chip'], V['bot']):
        scl(o, 5.3, 1)
        scl(o, 5.9, 0.001)
    energy(V['cl'], [(5.3, 18), (5.9, 0)])
    energy(V['bl'], [(5.3, 18), (5.9, 0)])
    energy(V['ph']['light'], [(5.3, 5), (5.9, 0)])
    Of = offy('offy', 'idle', 0.14, light=0)
    offy_face(Of, 0, 1, 0.6)
    show(Of['root'], [(0, False), (5.85, True)])
    pop(Of['body'], 5.85, 0.35)
    energy(Of['light'], [(5.8, 0), (6.2, 45)])
    K(Of['root'], 'location', 5.85, (0.0, -0.5, 0.75))
    K(Of['root'], 'location', 6.6, (0.3, -0.42, 1.05))
    K(Of['root'], 'location', D, (0.32, -0.42, 1.1))
    offy_color(Of, 6.2, 'idle')
    offy_color(Of, 6.8, 'joy')
    offy_face(Of, 6.8, 1, 1)
    face(J, 5.6, lid=1.0, brow=0.5, lift=0.8, mouth=0.0, gaze=(0, -0.5))
    face(J, 6.7, lid=1.0, brow=0.1, lift=0.6, mouth=0.6, gaze=(0.6, 0.2))
    rot(J['head'], 5.6, 14, 0, 0)
    rot(J['head'], 6.7, 2, 0, -14)
    b = V['bg']
    for t, c in ((5.0, (0, 0, 0)), (D, (0.012, 0.018, 0.05))):
        b.inputs['Color'].default_value = (*c, 1)
        b.inputs['Color'].keyframe_insert('default_value', frame=F(t))
    cam = camera((0.9, -2.4, 0.7), (0, 0, 0.75), lens=40, fstop=2.0)
    cam_move(cam, [(0, (1.0, -2.6, 0.6), (0, 0.2, 0.7)), (4.4, (0.75, -2.2, 0.75), (0, 0.2, 0.8)), (D, (0.55, -1.95, 0.85), (0.08, -0.1, 0.85))], focus=[(0, 2.8), (4.4, 2.4), (D, 2.05)])


# ---------------------------------------------------------------- 7: bloquear, respirar, um dia de cada vez
def s7a_escudo(D):
    world((0.008, 0.012, 0.04), 1)
    box('floor', (0, 2, -0.05), (40, 40, 0.1), mat('vfloor', (0.03, 0.035, 0.06), 0.3), 0)
    J = joaquim()
    pose(J, 0, armL=(-4, 0, -6), armR=(-4, 0, 6), head=(-4, 0, 0))
    face(J, 0, lid=1.0, brow=-0.35, mouth=0.1)
    breathe(J, 0, D, 2.6)
    Of = offy('offy', 'idle', 0.13, light=40)
    offy_face(Of, 0, 1, 0.3)
    offy_float(Of, 0, D, (0.5, -0.15, 1.72), 0.03, 1.6)
    c = Vector((0, 0, 1.05))
    dm = mat('dome', (0.2, 0.4, 1.0), 0.1, emit=0.25, emit_color=(0.25, 0.5, 1.0), alpha=0.03)
    dome = ball('dome', tuple(c), 1.3, dm, seg=48)
    dome.visible_shadow = False
    area('key', (-2, -3, 3), tuple(c), 220, (0.6, 0.75, 1.0), 2.5)
    area('rim', (2.5, 2.5, 2.5), tuple(c), 260, (0.3, 0.45, 1.0), 1.5)
    rnd = random.Random(21)
    flash = mat('flash', (0, 0, 0), emit=5, emit_color=(0.45, 0.7, 1.0))
    kinds = [MAG, GRN, AMB]
    pulses = []
    for i in range(10):
        col = kinds[i % 3]
        st = Vector((rnd.uniform(-2.2, 1.6), -4.6, rnd.uniform(0.9, 3.0)))
        hit = c + (st - c).normalized() * 1.32
        m = mat(f'proj{i % 3}', (0, 0, 0), emit=6, emit_color=col)
        if i % 3 == 0:
            o = box(f'proj{i}', tuple(st), (0.2, 0.03, 0.3), m, 0.02)
        elif i % 3 == 1:
            o = cyl(f'proj{i}', tuple(st), 0.12, 0.04, m, rot=(R(80), 0, 0), verts=18)
        else:
            o = cyl(f'proj{i}', tuple(st), 0.06, 0.26, m, verts=12)
        t0 = 0.25 + i * 0.26
        scl(o, 0, 0.001)
        scl(o, t0 - 0.02, 0.001)
        scl(o, t0, 1)
        K(o, 'location', t0, tuple(st))
        K(o, 'location', t0 + 0.42, tuple(hit))
        K(o, 'rotation_euler', t0, tuple(o.rotation_euler))
        K(o, 'rotation_euler', t0 + 0.42, (o.rotation_euler[0] + 3, 2, 1))
        scl(o, t0 + 0.42, 1)
        scl(o, t0 + 0.5, 0.001)
        f = ball(f'flash{i}', tuple(hit), 0.11, flash, seg=12)
        f.visible_shadow = False
        scl(f, 0, 0.001)
        scl(f, t0 + 0.4, 0.001)
        scl(f, t0 + 0.47, 1.0)
        scl(f, t0 + 0.75, 0.001)
        pulses.append(t0 + 0.45)
    seq = [(0, 0.08)]
    for t in pulses:
        seq += [(t - 0.04, 0.08), (t, 0.7), (t + 0.2, 0.08)]
    emission(dm, seq)
    face(J, 2.4, lid=1.0, brow=-0.1, mouth=0.4)
    cam = camera((-1.7, -3.7, 1.5), (0, 0, 1.15), lens=34, fstop=2.8)
    cam_move(cam, [(0, (-1.9, -3.9, 1.45), (0, 0, 1.2)), (D, (-1.45, -3.3, 1.5), (0, 0, 1.2))])


def s7b_respirar(D):
    world((0.004, 0.02, 0.012), 1)
    box('floor', (0, 2, -0.05), (40, 40, 0.1), mat('gfloor', (0.02, 0.05, 0.03), 0.4), 0)
    J = joaquim()
    pose(J, 0, hips_z=0.2, spine=(4, 0, 0), legL=(-86, -38, 0), legR=(-86, 38, 0), kneeL=(125, 0, 0), kneeR=(125, 0, 0),
         armL=(-34, -16, 0), armR=(-34, 16, 0), elbL=(-40, 0, 0), elbR=(-40, 0, 0), head=(-3, 0, 0))
    face(J, 0, lid=0.08, brow=0.15, mouth=0.35)
    ringm = mat('ring', (0, 0, 0), emit=2.5, emit_color=(0.15, 1.0, 0.45))
    ring = torus('ring', (0, 0.9, 0.95), 1.0, 0.025, ringm, rot=(R(90), 0, 0))
    ring2 = torus('ring2', (0, 0.95, 0.95), 1.0, 0.012, ringm, rot=(R(90), 0, 0))
    Of = offy('offy', 'calm', 0.15, light=55)
    offy_face(Of, 0, 0.12, 0.5)
    for t, s in ((0, 0.72), (D * 0.5, 1.08), (D, 0.74)):
        scl(ring, t, s)
        scl(ring2, t, s * 1.18)
        scl(J['spine'], t, 1 + (s - 0.72) * 0.11)
        scl(Of['body'], t, 0.9 + (s - 0.72) * 0.45)
        rot(J['head'], t, -3 - (s - 0.72) * 14, 0, 0)
    offy_float(Of, 0, D, (0.62, -0.45, 0.78), 0.03, 3.4)
    area('key', (-1.5, -3, 2.5), (0, 0, 0.8), 130, (0.75, 1.0, 0.8), 2.5)
    area('rim', (1.5, 3, 2.5), (0, 0, 0.9), 200, (0.2, 1.0, 0.5), 1.5)
    leaves(16, (-1.6, -1.2, 1.2), (1.6, 0.8, 2.8), 0, D, seed=5, color=(0.2, 0.6, 0.15), fall=3.0)
    cam = camera((0, -3.0, 0.8), (0.1, 0, 0.8), lens=38, fstop=2.4)
    cam_move(cam, [(0, (-0.25, -3.2, 0.72), (0.12, 0, 0.82)), (D, (-0.1, -2.75, 0.8), (0.12, 0, 0.84))])


def s7c_dias(D):
    world((0.012, 0.01, 0.006), 1)
    box('wall', (0, 0.12, 1.5), (12, 0.1, 8), mat('cwall', (0.035, 0.03, 0.028), 0.8), 0)
    box('floor', (0, -2, -0.05), (12, 8, 0.1), mat('cfloor', (0.03, 0.026, 0.024), 0.35), 0)
    dark = mat('day0', (0.06, 0.055, 0.05), 0.5)
    gold = mat('day1', (0.6, 0.4, 0.05), 0.3, emit=0.8, emit_color=(1.0, 0.6, 0.1))
    i = 0
    for r in range(5):
        for c in range(6):
            x, z = (c - 2.5) * 0.3, 2.05 - r * 0.3
            box(f'd{i}', (x, 0, z), (0.25, 0.05, 0.25), dark, 0.03)
            g = box(f'g{i}', (x, -0.03, z), (0.25, 0.05, 0.25), gold, 0.03)
            t0 = 0.15 + i * 0.075
            scl(g, 0, 0.001)
            scl(g, t0 - 0.02, 0.001)
            scl(g, t0 + 0.09, 1.12)
            scl(g, t0 + 0.16, 1.0)
            i += 1
    tm = mat('ctext', (0, 0, 0), emit=5, emit_color=(1, 0.95, 0.85))
    text('DIA', (-0.52, -0.05, 2.62), 0.26, tm)
    nums = [1, 4, 9, 15, 22, 30, 45, 60, 75, 90]
    for k, n in enumerate(nums):
        a = 0.15 + k * 0.25
        b = 0.15 + (k + 1) * 0.25 if k < len(nums) - 1 else 99
        o = text(str(n), (0.38, -0.05, 2.62), 0.36 if n == 90 else 0.3, mat('cnum', (0, 0, 0), emit=6, emit_color=GOLD))
        show(o, [(0, k == 0 and a == 0), (a, True), (b, False)])
        if n == 90:
            pop(o, a, 0.3)
    Of = offy('offy', 'joy', 0.15, light=50)
    offy_face(Of, 0, 1, 1)
    offy_float(Of, 0, D, (0.62, -0.8, 0.82), 0.06, 0.7, bounce=True)
    area('key', (-1, -4, 3), (0, 0, 1.5), 180, (1, 0.9, 0.75), 3)
    cam = camera((-0.5, -3.3, 1.6), (0, 0, 1.6), lens=38, fstop=4)
    cam_move(cam, [(0, (-0.6, -3.0, 1.55), (0, 0, 1.6)), (D, (0.35, -3.7, 1.7), (0.05, 0, 1.6))])


# ---------------------------------------------------------------- 8: nascer do sol
def s8_hoje(D):
    world((0.6, 0.45, 0.38), 0.5)
    sky = box('sky', (0, 110, 30), (400, 1, 90), None, 0)
    sm = bpy.data.materials.new('skym')
    sm.use_nodes = True
    nt = sm.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    em = nt.nodes.new('ShaderNodeEmission')
    ramp.color_ramp.elements[0].position = 0.14
    ramp.color_ramp.elements[0].color = (1.0, 0.36, 0.08, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.16, 0.34, 0.8, 1)
    mid = ramp.color_ramp.elements.new(0.3)
    mid.color = (1.0, 0.62, 0.38, 1)
    em.inputs['Strength'].default_value = 1.0
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    sky.data.materials.append(sm)
    sky.visible_shadow = False
    box('ground', (0, 10, -0.05), (120, 120, 0.1), mat('grass', (0.07, 0.17, 0.035), 0.95), 0)
    ball('hill', (9, 34, -5), 14, mat('hill', (0.05, 0.13, 0.03), 0.95), (1.8, 1, 0.55), seg=32)
    ball('hill2', (-16, 44, -6), 16, mat('hill', (0, 0, 0)), (1.6, 1, 0.5), seg=32)
    s = ball('sun', (-5, 80, 7.5), 6.0, mat('sun', (0, 0, 0), emit=1.5, emit_color=(1.0, 0.42, 0.08)), seg=32)
    s.visible_shadow = False
    sl = sun('sunl', (0, 0, 0), 3.0, (1.0, 0.62, 0.32), 4)
    sl.location = (-5, 80, 9)
    aim(sl, (0, 0, 0.8))
    area('fill', (1.5, -5, 3.5), (0, 0, 1.2), 300, (1.0, 0.86, 0.74), 5)
    rnd = random.Random(31)
    for tx, ty, sc_ in ((-2.7, 3.6, 1.0), (3.3, 6.5, 1.3), (-5.5, 11, 1.5)):
        cyl(f'trunk{tx}', (tx, ty, 1.1 * sc_), 0.13 * sc_, 2.2 * sc_, mat('trunk', (0.07, 0.04, 0.02), 0.8), verts=12)
        for k in range(7):
            ball(f'canopy{tx}_{k}', (tx + rnd.uniform(-0.8, 0.8) * sc_, ty + rnd.uniform(-0.6, 0.6) * sc_, (2.5 + rnd.uniform(-0.2, 0.9)) * sc_), rnd.uniform(0.55, 0.9) * sc_,
                 mat(f'leafm{k % 3}', (0.06 + 0.03 * (k % 3), 0.22 + 0.06 * (k % 3), 0.04), 0.8), seg=16)
    fcols = [(1, 0.8, 0.1), (1, 0.35, 0.3), (1, 1, 1), (0.6, 0.4, 1)]
    for i in range(46):
        x, y = rnd.uniform(-4, 4), rnd.uniform(-2.5, 7)
        ball(f'flower{i}', (x, y, 0.06), 0.045, mat(f'fl{i % 4}', fcols[i % 4], 0.5), seg=8)
        cyl(f'stem{i}', (x, y, 0.02), 0.008, 0.08, mat('stem', (0.05, 0.2, 0.03), 0.8), verts=5)
    J = joaquim(clean=True)
    M = marta()
    C = davi()
    pose(J, 0, armL=(-3, 0, -6), armR=(-3, 0, 6), head=(-6, 0, 0))
    face(J, 0, lid=0.78, brow=0.1, mouth=0.5, gaze=(0, 0.2))
    blink(J, 0.9, 0.78)
    face(J, 1.6, lid=0.92, brow=0.0, lift=0.25, mouth=0.85, gaze=(0.8, 0))
    breathe(J, 0, 1.8, 2.8)
    # o filho corre para ele
    rot(C['root'], 0, z=-90)
    face(C, 0, lid=1.0, lift=1, mouth=1.0)
    walk(C, 0.7, 2.5, (3.0, -0.35), (0.52, -0.3), swing=42, step=0.2)
    rot(C['armL'], 2.5, 0, 0, 0)
    rot(C['armR'], 2.5, 0, 0, 0)
    rot(C['armL'], 2.8, -110, 0, -30)
    rot(C['armR'], 2.8, -110, 0, 30)
    loc(C['hips'], 2.5, z=0.9)
    loc(C['hips'], 2.75, z=1.12)
    loc(C['hips'], 3.0, z=0.9)
    # o Joaquim ajoelha-se e abre os braços
    rot(J['root'], 1.5, z=0)
    rot(J['root'], 2.3, z=52)
    loc(J['hips'], 1.7, z=0.90)
    loc(J['hips'], 2.5, z=0.52)
    for k, a, b in (('legL', 0, -92), ('kneeL', 0, 92), ('legR', 0, 8), ('kneeR', 0, 100)):
        rot(J[k], 1.7, a, 0, 0)
        rot(J[k], 2.5, b, 0, 0)
    rot(J['spine'], 1.7, 0, 0, 0)
    rot(J['spine'], 2.5, 12, 0, 0)
    for side, sg in (('L', -1), ('R', 1)):
        rot(J['arm' + side], 1.7, -3, 0, sg * 6)
        rot(J['arm' + side], 2.4, -50, sg * 55, 0)
        rot(J['arm' + side], 2.95, -72, sg * 4, 0)
        rot(J['elb' + side], 2.4, -15, 0, 0)
        rot(J['elb' + side], 2.95, -55, 0, 0)
    rot(J['head'], 2.5, -6, 0, 0)
    rot(J['head'], 3.2, 6, 0, 12)
    face(J, 3.2, lid=0.12, brow=0.3, lift=0.2, mouth=1.0)
    face(J, 5.0, lid=0.12, brow=0.3, lift=0.2, mouth=1.0)
    face(J, 5.6, lid=1.0, brow=0.0, lift=0.5, mouth=1.0, gaze=(0, 0.4))
    # a Marta chega devagar
    rot(M['root'], 0, z=-90)
    face(M, 0, lid=1.0, brow=0.3, lift=0.4, mouth=0.9)
    walk(M, 1.4, 4.4, (3.9, 0.35), (1.25, 0.2), swing=22, step=0.42)
    rot(M['root'], 4.2, z=-90)
    rot(M['root'], 4.9, z=-55)
    rot(M['armR'], 4.4, 0, 0, 0)
    rot(M['armR'], 5.2, -55, 0, 10)
    rot(M['head'], 4.4, 0, 0, 0)
    rot(M['head'], 5.2, 12, 0, 0)
    Of = offy('offy', 'joy', 0.15, light=25)
    offy_face(Of, 0, 1, 1)
    offy_float(Of, 0, D, (-0.3, -0.3, 1.9), 0.08, 0.9, bounce=True)
    leaves(26, (-2.5, -1.5, 1.8), (3.0, 3, 4.2), 0, D, seed=9, color=(0.5, 0.42, 0.06), fall=2.2)
    cam = camera((0.3, -1.6, 1.62), (0, 0, 1.62), lens=40, fstop=2.0)
    cam_move(cam, [(0, (0.28, -1.55, 1.66), (0.0, 0, 1.63)), (1.5, (0.34, -1.75, 1.62), (0.02, 0, 1.6)), (4.2, (-0.2, -4.6, 1.5), (0.55, 0, 0.95)), (D, (-0.75, -5.6, 2.1), (0.55, 0, 1.05))],
             focus=[(0, 1.6), (1.5, 1.8), (4.2, 4.7), (D, 5.8)])


# (nome, duração final, função, atraso): atraso = (t0, dt) -> os instantes >= t0 passam dt segundos mais tarde.
# Durações acertadas à narração do ElevenLabs (60,4 s, a começar ao segundo 1,0).
SHOTS = [
    ('s1_escuro', 7.3, s1_escuro, None),
    ('s2a_ecra', 2.8, s2a_ecra, None),
    ('s2b_olhos', 4.3, s2b_olhos, (1.8, 1.2)),
    ('s3_apostas', 8.2, s3_apostas, (4.4, 0.8)),
    ('s4_bar', 5.5, s4_bar, None),
    ('s5_perda', 6.6, s5_perda, None),
    ('s6_virada', 7.2, s6_virada, (5.1, 0.4)),
    ('s7a_escudo', 3.1, s7a_escudo, None),
    ('s7b_respirar', 4.4, s7b_respirar, None),
    ('s7c_dias', 3.3, s7c_dias, None),
    ('s8_hoje', 7.0, s8_hoje, (0.6, 1.0)),
]
