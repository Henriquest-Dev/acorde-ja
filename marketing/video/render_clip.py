"""Renderiza um clipe da cena `scene_child` em passos de 2 fotogramas (12 fps de animação, 24 fps de saída)."""
import math, os, sys, time
sys.path.insert(0, '.')
import bpy
import scenes
out = sys.argv[sys.argv.index('--') + 1]
secs = float(sys.argv[sys.argv.index('--') + 2])
os.makedirs(out, exist_ok=True)
fps_anim = 12
n = int(secs * fps_anim)
for i in range(n):
    t = i / fps_anim
    p = scenes.scene_child(t)
    cam = bpy.context.scene.camera
    k = t / secs
    cam.location = (1.1 - 0.35 * k, -2.9 + 0.5 * k, 0.62 - 0.05 * k)
    aim(cam, (0.0 - 0.05 * k, 0.0, 0.42)) if False else None
    from cubes import aim
    aim(cam, (-0.05 * k, 0.0, 0.42))
    # blocos: o braço direito pousa um bloco; a cabeça acompanha
    p['armR'].rotation_euler = (math.radians(-35 - 18 * math.sin(t * 2.4)), 0, math.radians(-8))
    p['head'].rotation_euler = (math.radians(22 + 3 * math.sin(t * 2.4)), 0, 0)
    # poeira a subir devagar
    for o in bpy.data.objects:
        if o.name.startswith('dust'):
            o.location.z += 0.05 * t
            o.location.x += 0.02 * math.sin(t + hash(o.name) % 7)
    bpy.context.scene.render.filepath = f'{out}/f{i:04d}.png'
    s = time.time()
    bpy.ops.render.render(write_still=True)
    print('FRAME', i, n, round(time.time() - s, 1), flush=True)
