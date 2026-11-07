"""Monta o vídeo: clipes por cena + cortes/fades + legendas pixel + áudio.

Uso: python3 assemble.py <pasta_cenas> <fps_frames> <saida.mp4> [largura altura]
  fps_frames: taxa dos fotogramas renderizados (10 = animática com passo 3; 30 = final)
"""
import glob
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from timeline import scene_times, video_len

HERE = os.path.dirname(os.path.abspath(__file__))
src, rfps, out = sys.argv[1], float(sys.argv[2]), sys.argv[3]
W = int(sys.argv[4]) if len(sys.argv) > 4 else 1080
H = int(sys.argv[5]) if len(sys.argv) > 5 else 1920
audio = os.environ.get('AUDIO', os.path.join(src, '..', 'audio_mix.wav'))
subs = os.environ.get('SUBS', os.path.join(src, '..', 'subs.ass'))

# fades nos cortes que saltam no tempo ou escurecem: (cena, fade_in_s, fade_out_s)
FADES = {'s06': (0, 0.5), 's07': (0.35, 0), 's14': (0, 0.25), 's15': (0.25, 0), 's20': (0, 0.0), 's21': (0.25, 0.8)}

clips = []
for name, a, b in scene_times():
    d = b - a
    frames = sorted(glob.glob(os.path.join(src, name, 'f*.png')))
    if not frames:
        print('sem fotogramas:', name)
        sys.exit(1)
    fin, fout = FADES.get(name, (0, 0))
    vf = [f'scale={W}:{H}:flags=lanczos', 'fps=30']
    if fin:
        vf.append(f'fade=t=in:st=0:d={fin}')
    if fout:
        vf.append(f'fade=t=out:st={max(0, d - fout):.3f}:d={fout}')
    vf.append('format=yuv420p')
    clip = os.path.join(src, f'{name}.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(rfps), '-pattern_type', 'glob', '-i', os.path.join(src, name, 'f*.png'),
                    '-vf', ','.join(vf), '-t', f'{d:.3f}', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-r', '30', clip], check=True)
    clips.append(clip)

lst = os.path.join(src, 'clips.txt')
open(lst, 'w').write(''.join(f"file '{c}'\n" for c in clips))
cat = os.path.join(src, 'all.mp4')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', cat], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', cat, '-i', audio,
                '-vf', f"subtitles={subs}:fontsdir={os.path.join(HERE, 'fonts')}", '-map', '0:v', '-map', '1:a',
                '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], check=True)
print('video', out, round(video_len(), 2), 's')
