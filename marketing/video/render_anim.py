"""Renderiza uma cena animada (30 fps) como sequência de PNG.

Uso: python3 render_anim.py <cena> <pasta> [amostras] [largura] [altura]
Retoma: fotogramas já existentes não são renderizados de novo.
"""
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import bpy
import ep1
import ep1_anim
from anim import FPS
from timeline import SCENES, scene_times

name, out = sys.argv[1], sys.argv[2]
samples = int(sys.argv[3]) if len(sys.argv) > 3 else 12
width = int(sys.argv[4]) if len(sys.argv) > 4 else 540
height = int(sys.argv[5]) if len(sys.argv) > 5 else 960
ep1.W, ep1.H, ep1.SAMPLES = width, height, samples
os.makedirs(out, exist_ok=True)

ep1.SCENES[name]()
start, end = [(a, b) for n, a, b in scene_times() if n == name][0]
D = end - start
ep1_anim.ANIM[name](D)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start = 1
sc.frame_end = int(round(D * FPS))
sc.render.filepath = os.path.join(out, 'f')
sc.render.use_overwrite = False
sc.render.use_persistent_data = True
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.03
sc.cycles.max_bounces = 4
sc.cycles.diffuse_bounces = 3
sc.cycles.glossy_bounces = 2
sc.cycles.transmission_bounces = 2
sc.cycles.use_animated_seed = False
sc.frame_step = int(os.environ.get('FRAME_STEP', '1'))
sc.cycles.use_denoising = os.environ.get('DENOISE', '1') == '1'
sc.cycles.seed = 11
sc.render.film_transparent = False
t = time.time()
bpy.ops.render.render(animation=True)
print('SCENE_DONE', name, sc.frame_end, 'step', sc.frame_step, 'frames', round(time.time() - t, 1), 's', flush=True)
