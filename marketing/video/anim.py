"""Ferramentas de animação por keyframes (30 fps) para as cenas em cubos."""
import math
import random

import bpy
from mathutils import Euler, Vector

FPS = 30
R = math.radians


def F(t):
    return 1 + int(round(t * FPS))


def O(name):
    return bpy.data.objects[name]


def has(name):
    return name in bpy.data.objects


def key(o, path, t, v):
    setattr(o, path, v)
    o.keyframe_insert(data_path=path, frame=F(t))


def keys(o, path, seq):
    for t, v in seq:
        key(o, path, t, v)


def rot(o, t, x=None, y=None, z=None):
    """Roda em graus; `None` mantém o valor actual desse eixo."""
    e = list(o.rotation_euler)
    for i, v in enumerate((x, y, z)):
        if v is not None:
            e[i] = R(v)
    key(o, 'rotation_euler', t, tuple(e))


def loc(o, t, x=None, y=None, z=None):
    l = list(o.location)
    for i, v in enumerate((x, y, z)):
        if v is not None:
            l[i] = v
    key(o, 'location', t, tuple(l))


def scale(o, t, s):
    key(o, 'scale', t, (s, s, s) if isinstance(s, (int, float)) else tuple(s))


def vis(o, seq):
    """seq: [(t, visível)]."""
    for t, on in seq:
        o.hide_render = not on
        o.keyframe_insert(data_path='hide_render', frame=F(t))


def descendants(o):
    out = [o]
    for c in o.children:
        out += descendants(c)
    return out


def show_char(P, seq):
    for d in descendants(P['root']):
        if d.type == 'MESH':
            vis(d, seq)


def energy(name, seq):
    l = bpy.data.objects[name].data
    for t, v in seq:
        l.energy = v
        l.keyframe_insert(data_path='energy', frame=F(t))


def flicker(name, t0, t1, lo, hi, step=0.1, seed=1):
    rnd = random.Random(seed)
    t = t0
    seq = []
    while t <= t1:
        seq.append((t, rnd.uniform(lo, hi)))
        t += step
    energy(name, seq)


def cam_path(seq, focus=None):
    """seq: [(t, loc, target)]; interpola posição e rotação (look-at)."""
    cam = bpy.context.scene.camera
    if cam is None:
        from cubes import camera as _mk
        cam = _mk(seq[0][1], seq[0][2], lens=30, dof_dist=(focus[0][1] if focus else 3.0), fstop=3.2)
    prev = None
    for t, l, tg in seq:
        cam.location = l
        e = (Vector(tg) - Vector(l)).to_track_quat('-Z', 'Y').to_euler('XYZ', prev) if prev else (Vector(tg) - Vector(l)).to_track_quat('-Z', 'Y').to_euler()
        prev = e
        cam.rotation_euler = e
        cam.keyframe_insert(data_path='location', frame=F(t))
        cam.keyframe_insert(data_path='rotation_euler', frame=F(t))
    if focus:
        for t, d in focus:
            cam.data.dof.focus_distance = d
            cam.data.dof.keyframe_insert(data_path='focus_distance', frame=F(t))


def lerp3(a, b, k):
    return tuple(a[i] + (b[i] - a[i]) * k for i in range(3))


def breathe(P, dur, period=3.2, amp=0.014):
    """Respiração: a cabeça e o tronco sobem e descem de leve."""
    n = P['neck']
    z0 = n.location.z
    t = 0.0
    while t <= dur + period / 2:
        loc(n, t, z=z0)
        loc(n, t + period / 2, z=z0 + amp)
        t += period


def sway(o, dur, axis=2, amp=3.0, period=4.0):
    base = [math.degrees(v) for v in o.rotation_euler]
    t = 0.0
    k = 0
    while t <= dur + period / 2:
        v = list(base)
        v[axis] = base[axis] + amp * (1 if k % 2 == 0 else -1)
        rot(o, t, *v)
        t += period / 2
        k += 1


FACE_KEYS = ('mouthC', 'mouthL', 'mouthR', 'mouthO', 'eyeL', 'eyeR', 'lidL', 'lidR', 'browL', 'browR', 'pupilL', 'pupilR', 'spupilL', 'spupilR')


def _face_key(P, t, expr):
    from cubes import set_face
    set_face(P, **expr)
    for k in FACE_KEYS:
        o = P['face'][k]
        o.keyframe_insert(data_path='location', frame=F(t))
        o.keyframe_insert(data_path='rotation_euler', frame=F(t))
        o.keyframe_insert(data_path='scale', frame=F(t))
        o.keyframe_insert(data_path='hide_render', frame=F(t))


def face_anim(P, seq, dur, blink_every=3.0, talk=None, seed=3):
    """Animação do rosto: seq = [(t, expr)], com piscadelas e fala (mouth_open) opcionais.

    talk = (t0, t1) mistura aberturas de boca rápidas por cima da expressão base.
    """
    rnd = random.Random(seed)
    seq = sorted(seq, key=lambda x: x[0])

    def base_at(t):
        cur = seq[0][1]
        for tt, ex in seq:
            if tt <= t:
                cur = ex
        return cur

    events = {round(t, 3): dict(ex) for t, ex in seq}
    if blink_every:
        t = 0.8 + rnd.uniform(0, 0.8)
        while t < dur - 0.3:
            b = dict(base_at(t))
            for dt, lid in ((0.0, b.get('lid', 0.0)), (0.07, 1.0), (0.17, b.get('lid', 0.0))):
                e = dict(b)
                e['lid'] = lid
                events[round(t + dt, 3)] = e
            t += blink_every + rnd.uniform(-0.6, 0.8)
    if talk:
        t = talk[0]
        while t < talk[1]:
            b = dict(base_at(t))
            b['mouth_open'] = rnd.choice((0.15, 0.4, 0.7, 0.3, 0.55))
            events[round(t, 3)] = b
            t += rnd.uniform(0.12, 0.2)
        b = dict(base_at(talk[1]))
        events[round(talk[1] + 0.05, 3)] = b
    for t in sorted(events):
        _face_key(P, t, events[t])


def tremor(o, t0, t1, amp=2.0, step=2, seed=5):
    rnd = random.Random(seed)
    base = list(o.rotation_euler)
    f = F(t0)
    end = F(t1)
    while f <= end:
        o.rotation_euler = (base[0] + R(rnd.uniform(-amp, amp)), base[1] + R(rnd.uniform(-amp, amp)), base[2] + R(rnd.uniform(-amp, amp)))
        o.keyframe_insert(data_path='rotation_euler', frame=f)
        f += step
    o.rotation_euler = tuple(base)


def walk(P, t0, t1, to_xy, swing=32, step=0.28):
    """Anda em linha recta até `to_xy`, com pernas e braços a balançar."""
    r = P['root']
    loc(r, t0)
    loc(r, t1, x=to_xy[0], y=to_xy[1])
    t = t0
    k = 0
    while t <= t1:
        s = swing if k % 2 == 0 else -swing
        rot(P['legL'], t, x=s)
        rot(P['legR'], t, x=-s)
        rot(P['armL'], t, x=-s * 0.7)
        rot(P['armR'], t, x=s * 0.7)
        t += step
        k += 1
    rot(P['legL'], t1 + 0.3, x=0)
    rot(P['legR'], t1 + 0.3, x=0)


def dust_drift(prefix='dust', dur=5.0, rise=0.35, sway_amt=0.12, seed=9):
    rnd = random.Random(seed)
    for o in bpy.data.objects:
        if o.name.startswith(prefix):
            z0, x0 = o.location.z, o.location.x
            loc(o, 0, z=z0, x=x0)
            loc(o, dur / 2, z=z0 + rise * 0.5, x=x0 + rnd.uniform(-sway_amt, sway_amt))
            loc(o, dur, z=z0 + rise, x=x0 + rnd.uniform(-sway_amt, sway_amt))


def pop(o, t, dur=0.35, overshoot=1.18, final=1.0):
    scale(o, t - 0.01, 0.001)
    scale(o, t + dur * 0.6, final * overshoot)
    scale(o, t + dur, final)


def seq_text(make, items, dur_each):
    """Cria uma sequência de textos (um de cada vez). items: [(texto, t_inicio)]; devolve os objectos."""
    objs = []
    for i, (txt, t0) in enumerate(items):
        o = make(txt)
        t1 = items[i + 1][1] if i + 1 < len(items) else 9999
        vis(o, [(0, t0 <= 0.001), (max(t0, 0.001), True), (t1, False)] if t0 > 0.001 else [(0, True), (t1, False)])
        objs.append(o)
    return objs
