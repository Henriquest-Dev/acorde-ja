import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import bpy
from cine import *
out = sys.argv[1]
sc = reset(1200, 600, 40)
world((0.02, 0.022, 0.03), 1.0)
box('floor', (0, 0, -0.05), (12, 12, 0.1), mat('floor', (0.12, 0.12, 0.13), 0.6), 0)
J = person('joaquim', (0.27, 0.14, 0.085), (0.07, 0.08, 0.1), (0.05, 0.06, 0.09), (0.02, 0.015, 0.012), stubble=True)
face(J, 0, lid=0.6, brow=0.8, mouth=-0.5)
pose(J, 0, at=(-1.1, 0, 0), armL=(-20, 0, -8), armR=(-35, 0, 8), elbR=(-60, 0, 0))
W = person('marta', (0.30, 0.16, 0.10), (0.75, 0.3, 0.25), (0.15, 0.2, 0.4), (0.03, 0.02, 0.015), scale=0.95, long_hair=True, sleeve=False)
face(W, 0, lid=1, brow=0, mouth=0.8)
pose(W, 0, at=(-0.35, 0, 0))
C = person('davi', (0.29, 0.15, 0.09), (0.95, 0.75, 0.15), (0.1, 0.25, 0.5), (0.02, 0.015, 0.012), scale=0.55, head=1.35, sleeve=False)
face(C, 0, lid=1, lift=1, mouth=1)
pose(C, 0, at=(0.35, 0, 0), armL=(0, 0, -60), armR=(0, 0, 60))
Of = offy('offy', 'joy')
Of['root'].location = (1.0, 0, 1.3)
offy_face(Of, 0, 1, 1)
Ph = phone()
Ph['root'].location = (-1.1, -0.45, 1.05)
Ph['root'].rotation_euler = (R(-25), 0, 0)
area('key', (-2, -4, 3.5), (0, 0, 1), 260, (1, 0.93, 0.85), 3)
area('rim', (3, 3, 3), (0, 0, 1.2), 250, (0.5, 0.6, 1), 2)
camera((0.3, -3.3, 1.3), (0.3, 0, 1.15), lens=60, fstop=8)
sc.frame_set(1)
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
