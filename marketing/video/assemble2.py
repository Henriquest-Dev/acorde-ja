"""Montagem do episódio 2 (Yara): glitches nas mudanças de área, painel A/B final, legendas pixel e áudio.

Uso: python3 assemble2.py <pasta_cenas> <saida.mp4> [largura altura]
Espera <pasta_cenas>/yNN/fNNNN.png (30 fps), <pasta_cenas>/../subs.ass e <pasta_cenas>/../audio_mix.wav
"""
import glob
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from glitch import glitch_frame
from timeline2 import scene_times, video_len

HERE = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1]
out = sys.argv[2]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 1080
H = int(sys.argv[4]) if len(sys.argv) > 4 else 1920
FPS = 30
subs = os.path.join(src, '..', 'subs.ass')
audio = os.path.join(src, '..', 'audio_mix.wav')

# mudanças de área com glitch: (cena que sai, nível)
GLITCH = {'y07': 1, 'y09': 1, 'y10': 3, 'y11': 3, 'y15': 1, 'y16': 1, 'y18': 2}

frames = {n: sorted(glob.glob(os.path.join(src, n, 'f*.png'))) for n, _, _ in scene_times()}
work = os.path.join(src, '_seq')
shutil.rmtree(work, ignore_errors=True)
os.makedirs(work)
tmp = os.path.join(src, '_glitch')
shutil.rmtree(tmp, ignore_errors=True)
os.makedirs(tmp)

seq = []  # (caminho)
cache = {}


def put(path, level=0, seed=0, flip=None):
    if level <= 0:
        seq.append(path)
        return
    p = os.path.join(tmp, 'g%05d.png' % len(seq))
    glitch_frame(Image.open(path).convert('RGB'), level, seed).save(p)
    seq.append(p)


def panel_frame(k):
    """Ecrã dividido A (azul) contra B (dourado) com letras pixel."""
    fa, fb = frames['y07'], frames['y17']
    ia = Image.open(fa[k % len(fa)]).convert('RGB')
    ib = Image.open(fb[k % len(fb)]).convert('RGB')
    w, h = ia.size
    canvas = Image.new('RGB', (w, h), (0, 0, 0))
    ph = h // 2 - 4
    for i, im in enumerate((ia, ib)):
        crop = im.crop((0, int(h * 0.18), w, int(h * 0.18) + ph)).resize((w, ph))
        canvas.paste(crop, (0, i * (ph + 8)))
    d = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(os.path.join(HERE, 'fonts', 'PixelifySans.ttf'), int(h * 0.06))
    for i, ch in enumerate(('A', 'B')):
        d.text((int(w * 0.05), i * (ph + 8) + int(h * 0.02)), ch, font=font, fill=(255, 255, 255), stroke_width=4, stroke_fill=(0, 0, 0))
    return canvas


names = [n for n, _, _ in scene_times()]
for si, name in enumerate(names):
    fl = frames[name]
    n = len(fl)
    lvl = GLITCH.get(name, 0)
    if name == 'y19':
        split_n = int(4.5 * FPS)
        for k in range(n):
            if k < split_n:
                p = os.path.join(tmp, 'p%05d.png' % k)
                panel_frame(k).save(p)
                seq.append(p)
            else:
                lv = 2 if k < split_n + 4 else 0
                put(fl[k], lv, seed=k)
        continue
    for k, f in enumerate(fl):
        # saída: últimos fotogramas com «travamento» (repetição) e glitch crescente
        tail = n - k
        if lvl and tail <= 8 and name != 'y10':
            pat = [-8, -7, -7, -8, -6, -6, -5, -5]
            idx = n + pat[8 - tail]
            put(fl[max(0, idx)], lvl, seed=k)
        elif lvl and name == 'y10' and tail <= 20:
            # rebobinar: reproduz ao contrário os últimos fotogramas
            idx = n - 20 + (tail - 1)
            put(fl[max(0, idx)], lvl, seed=k)
        elif si > 0 and GLITCH.get(names[si - 1], 0) and k < 6:
            put(f, max(1, GLITCH[names[si - 1]] - k // 2), seed=k)
        else:
            put(f)

# o resultado tem de ter exactamente a duração da narração
target = int(round(video_len() * FPS))
seq = seq[:target] + [seq[-1]] * max(0, target - len(seq))
for i, p in enumerate(seq):
    d = os.path.join(work, 'f%05d.png' % (i + 1))
    try:
        os.symlink(os.path.abspath(p), d)
    except FileExistsError:
        pass

vf = f"scale={W}:{H}:flags=lanczos,unsharp=5:5:0.5:5:5:0.0,fade=t=in:st=0:d=0.4,fade=t=out:st={video_len() - 0.9:.2f}:d=0.9,subtitles={subs}:fontsdir={os.path.join(HERE, 'fonts')}"
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(FPS), '-i', os.path.join(work, 'f%05d.png'), '-i', audio,
                '-vf', vf, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], check=True)
print('video', out, round(video_len(), 2), 's', len(seq), 'frames')
