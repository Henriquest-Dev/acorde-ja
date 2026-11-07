import sys, time
sys.path.insert(0, '.')
import bpy
import scenes
name, out = sys.argv[sys.argv.index('--') + 1], sys.argv[sys.argv.index('--') + 2]
getattr(scenes, name)(0.0)
bpy.context.scene.render.filepath = out
t = time.time()
bpy.ops.render.render(write_still=True)
print('RENDER_SECONDS', round(time.time() - t, 1))
