import sys, time, math
sys.path.insert(0, '.')
import bpy
from cubes import *
sc = reset(540, 960, samples=48)
sun_and_world(0.25, (0.03, 0.04, 0.08))
# quarto
floor = cube('floor', (0, 0, -0.05), (7, 7, 0.1), mat('floor', (0.12, 0.1, 0.1), 0.5), 0.02)
wall = cube('wall', (0, 3.5, 2), (7, 0.1, 4), mat('wall', (0.09, 0.1, 0.14), 0.8), 0.02)
cube('bed', (-1.7, 1.6, 0.3), (2.0, 2.6, 0.6), mat('bed', (0.18, 0.2, 0.3), 0.9), 0.05)
cube('pillow', (-1.7, 2.5, 0.7), (1.2, 0.5, 0.2), mat('pillow', (0.8, 0.8, 0.85), 0.9), 0.06)
p = character((0.85, 0.62, 0.5), (0.35, 0.37, 0.4), (0.1, 0.12, 0.2), (0.12, 0.07, 0.05), loc=(0.1, 0.6, 0.0))
# senta o Pedro: tronco inclinado e braços a segurar o telemóvel
p['root'].rotation_euler = (0, 0, math.radians(-12))
for k in ('torso', 'head', 'hair', 'fringe', 'eyeL', 'eyeR'):
    pass
phone = cube('phone', (0.1, -0.05, 1.25), (0.22, 0.03, 0.42), mat('screen', (0.2, 0.5, 1.0), 0.2, emit=9.0, emit_color=(0.25, 0.55, 1.0)), 0.012, parent=p['root'])
phone.rotation_euler = (math.radians(-18), 0, 0)
p['armL'].rotation_euler = (math.radians(-60), 0, 0); p['armL'].location = (-0.3, -0.25, 1.15)
p['armR'].rotation_euler = (math.radians(-60), 0, 0); p['armR'].location = (0.3, -0.25, 1.15)
p['head'].rotation_euler = (math.radians(18), 0, 0)
area_light('screenlight', (0.1, -0.7, 1.5), (math.radians(90), 0, 0), 140, (0.35, 0.6, 1.0), 0.6)
area_light('moon', (3, -2, 4), (math.radians(60), 0, math.radians(40)), 40, (0.5, 0.6, 1.0), 3)
camera((1.4, -2.6, 1.55), (0.1, 0.4, 1.35), lens=45, dof_dist=3.0, fstop=2.0)
sc.render.filepath = '/tmp/claude-0/-home-user-acorde-ja/135674b4-0c05-5116-be40-89e603f49e33/scratchpad/test_frame.png'
t = time.time()
bpy.ops.render.render(write_still=True)
print('RENDER_SECONDS', round(time.time() - t, 1))
