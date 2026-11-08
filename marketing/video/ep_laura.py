"""Vídeo da Laura (40 s, 30 fps): decide estudar para o vestibular, empilha os cadernos,
recebe uma notificação e, em vez de estudar, pega no telemóvel.

Uso: python3 ep_laura.py <pasta_saida> [amostras] [largura] [altura]
"""
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector

import ep1
from anim import F, FPS, O, breathe, cam_path, energy, face_anim, loc, pop, rot, vis
from cubes import aim, area_light, camera, character, cube, mat, set_face, sun_logo, text3d

R = math.radians
D = 40.0
BLUE = (0.3, 0.55, 1.0)


def build():
    ep1.start(True, (0.9, 0.7, 0.45), 0.35)
    ep1.window((1.0, 0.8, 0.5), 5.0)
    aim(area_light('sun', (-3.2, -1.2, 2.2), (0, 0, 0), 1200, (1.0, 0.76, 0.42), 2.2), (0.1, 0, 0.3))
    aim(area_light('fill', (2.5, -3.0, 2.0), (0, 0, 0), 120, (1.0, 0.9, 0.75), 3.0), (0, 0, 0.4))
    # cartaz «VESTIBULAR» na parede do fundo
    text3d('VESTIBULAR', (-0.1, 3.1, 2.75), 0.22, (1, 1, 1), 3.0, rot=(R(90), 0, 0), extrude=0.01)

    # mesa de estudo
    cube('desk', (0, 0.4, 0.78), (2.2, 0.8, 0.08), mat('desk', (0.45, 0.3, 0.18), 0.5), 0.02)
    for x in (-0.95, 0.95):
        for y in (0.1, 0.7):
            cube('dleg', (x, y, 0.38), (0.08, 0.08, 0.76), mat('dleg_m', (0.35, 0.22, 0.13), 0.6), 0.01)
    # livro de estudo na mesa
    cube('book', (-0.5, 0.3, 0.87), (0.55, 0.4, 0.06), mat('book', (0.15, 0.25, 0.5), 0.5), 0.01)

    # cadernos que a Laura empilha (começam escondidos)
    cols = [(0.85, 0.78, 0.45), (0.8, 0.35, 0.3), (0.35, 0.55, 0.7), (0.9, 0.9, 0.85)]
    notes = []
    for k, c in enumerate(cols):
        n = cube('note%d' % k, (0.6, 0.4, 0.86 + 0.055 * k), (0.5, 0.38, 0.05), mat('note_m%d' % k, c, 0.6), 0.012)
        vis(n, [(0, False), (4.0 + k * 2.4 + 1.0, True)])
        notes.append(n)

    # telemóvel deitado na mesa, e o aviso de notificação
    ph = cube('phone', (-0.85, 0.2, 0.86), (0.24, 0.44, 0.03), mat('phone_m', (0.04, 0.04, 0.06), 0.2, emit=0.4, emit_color=BLUE), 0.01)
    badge = cube('badge', (-0.85, 0.2, 1.05), (0.07, 0.07, 0.07), mat('badge_m', (1, 1, 1), 0.3, emit=6.0), 0.02)
    badge.scale = (0.001, 0.001, 0.001)

    # Laura, sentada atrás da mesa
    p = character((0.92, 0.7, 0.55), (0.95, 0.8, 0.25), (0.2, 0.25, 0.4), (0.2, 0.12, 0.07))
    p['root'].location = (0, 1.2, 0)
    ep1.sit(p, 0.35)
    for s in ('L', 'R'):
        p['leg' + s].rotation_euler = (R(-90), 0, 0)

    # luz do ecrã, que só se acende com a notificação
    light = area_light('phonelight', (-0.4, 0.5, 1.4), (0, 0, 0), 0.0, BLUE, 0.6)
    aim(light, (-0.2, 1.2, 1.5))
    camera((1.0, -3.1, 1.25), (0.0, 1.2, 1.2), lens=34, dof_dist=3.4, fstop=2.4)
    return p, ph, badge, notes


def animate(p, ph, badge, notes):
    # 0 a 6 s: decidida, a olhar para o livro
    set_face(p, brow=0.1, smile=0.2, gaze=(0.0, -0.3))
    rot(p['head'], 0, x=-4)
    face_anim(p, [
        (0.0, dict(brow=0.1, smile=0.2, gaze=(0.0, -0.3))),
        (6.0, dict(brow=0.2, smile=0.25, gaze=(-0.4, -0.5))),
        (14.0, dict(brow=0.35, smile=0.1, gaze=(0.5, -0.2), lid=0.1)),
        (19.5, dict(brow=0.4, smile=0.0, gaze=(0.0, -0.3), lid=0.15)),
        (21.5, dict(brow_lift=0.6, brow=0.2, smile=-0.05, gaze=(-0.8, -0.6), mouth_open=0.25)),
        (26.0, dict(screen_eyes=True, lid=0.3, smile=-0.2, gaze=(0.0, -0.9), brow=0.4)),
        (34.0, dict(screen_eyes=True, lid=0.35, smile=-0.3, gaze=(0.0, -0.9), brow=0.5)),
    ], D, blink_every=2.6, seed=21)
    breathe(p, D, period=3.4, amp=0.01)

    # braço direito: empilha os cadernos (4 vezes)
    for k in range(4):
        t = 4.0 + k * 2.4
        rot(p['armR'], t, x=-40)
        rot(p['armR'], t + 0.6, x=-105)
        rot(p['armR'], t + 1.2, x=-105)
        rot(p['armR'], t + 1.9, x=-40)
    rot(p['armR'], 14.5, x=-40)

    # ao ler o aviso, o braço esquerdo vai até ao telemóvel
    rot(p['armL'], 0, x=-40)
    rot(p['armL'], 21.0, x=-40)
    rot(p['armL'], 22.5, x=-105, z=12)
    rot(p['armL'], 25.5, x=-95, z=14)
    rot(p['armL'], 29.0, x=-95, z=14)
    rot(p['armL'], 31.0, x=-40, z=0)

    # notificação: o distintivo aparece com um pop, e o ecrã ilumina a cara
    pop(badge, 20.0, 0.35, overshoot=1.2, final=1.0)
    energy('phonelight', [(0, 0), (20.4, 0), (20.7, 55), (25.5, 55), (26.5, 90), (40, 90)])
    # o telemóvel sobe da mesa para a mão, rodado para a cara
    loc(ph, 0, x=-0.85, y=0.2, z=0.86)
    loc(ph, 22.5, x=-0.85, y=0.2, z=0.86)
    loc(ph, 25.5, x=-0.55, y=0.6, z=1.15)
    loc(ph, 29.0, x=-0.55, y=0.6, z=1.15)
    rot(ph, 22.5, x=0, y=0, z=0)
    rot(ph, 25.5, x=-70, y=0, z=0)
    # os cadernos ficam na mesa
    rot(p['head'], 20.5, x=-4)
    rot(p['head'], 22.0, x=8, z=-10)
    rot(p['head'], 26.0, x=12, z=-10)

    # câmara: dá a volta lenta à mesa e aproxima-se da Laura no fim
    cam_path([
        (0.0, (1.0, -3.1, 1.25), (0.0, 1.2, 1.2)),
        (20.0, (0.6, -2.7, 1.35), (0.0, 1.2, 1.25)),
        (D, (0.3, -2.1, 1.45), (0.0, 1.3, 1.35)),
    ], focus=[(0, 3.4), (D, 2.4)])


def render(out, samples, w, h, frames=None):
    ep1.W, ep1.H, ep1.SAMPLES = w, h, samples
    p, ph, badge, notes = build()
    animate(p, ph, badge, notes)
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start = 1
    sc.frame_end = int(round(D * FPS)) if frames is None else frames
    sc.render.filepath = os.path.join(out, 'f')
    os.makedirs(out, exist_ok=True)
    sc.render.use_overwrite = False
    sc.render.use_persistent_data = True
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.03
    sc.cycles.max_bounces = 4
    sc.cycles.use_denoising = True
    sc.cycles.use_animated_seed = False
    sc.cycles.seed = 11
    t = time.time()
    bpy.ops.render.render(animation=True)
    print('LAURA_DONE', sc.frame_end, 'frames', round(time.time() - t, 1), 's', flush=True)


if __name__ == '__main__':
    out = sys.argv[1]
    samples = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 540
    h = int(sys.argv[4]) if len(sys.argv) > 4 else 960
    frames = int(os.environ['TEST_FRAMES']) if os.environ.get('TEST_FRAMES') else None
    render(out, samples, w, h, frames)
