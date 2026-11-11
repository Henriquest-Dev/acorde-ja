"""Renderiza uma cena do «Joaquim».
Uso: python3 render.py <cena> <pasta> [amostras] [largura] [altura]
  STILLS="0.5,3.0"  -> só esses instantes (pré-visualização)
  FRAME_STEP=2      -> anima «a dois» (12 imagens por segundo)
Retoma: fotogramas que já existem não são refeitos.
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
import bpy
import cine
import shots

name, out = sys.argv[1], sys.argv[2]
samples = int(sys.argv[3]) if len(sys.argv) > 3 else 32
w = int(sys.argv[4]) if len(sys.argv) > 4 else 540
h = int(sys.argv[5]) if len(sys.argv) > 5 else 960
os.makedirs(out, exist_ok=True)
D, fn, shift = [(d, f, sh) for n, d, f, sh in shots.SHOTS if n == name][0]
sc = cine.reset(w, h, samples)
sc.render.threads_mode = 'FIXED'
sc.render.threads = int(os.environ.get('THREADS', '4'))
cine.SHIFT = shift
fn(D - (shift[1] if shift else 0))
sc.frame_start, sc.frame_end = 1, int(round(D * cine.FPS))
stills = os.environ.get('STILLS')
t = time.time()
if stills:
    for s in stills.split(','):
        sc.frame_set(cine.F(float(s)))
        sc.render.filepath = os.path.join(out, f'{name}_{float(s):05.2f}.png')
        bpy.ops.render.render(write_still=True)
else:
    sc.frame_step = int(os.environ.get('FRAME_STEP', '2'))
    sc.render.filepath = os.path.join(out, 'f')
    sc.render.use_overwrite = False
    bpy.ops.render.render(animation=True)
print('SHOT_DONE', name, round(time.time() - t, 1), 's', flush=True)
