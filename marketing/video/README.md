# Vídeos do offly em cubos (Blender + ray tracing)

Cenas geradas em código com o módulo `bpy` (Blender 5.2) e o motor **Cycles** (ray tracing, CPU).
Personagem de cubos com bisel e materiais lisos, luz de área, desfoque de câmara e partículas de pó.

## Ficheiros

| Ficheiro | O que faz |
|---|---|
| `cubes.py` | Biblioteca: cubos polidos, personagem articulado (pivôs), luzes, câmara |
| `scenes.py` | Cenas do episódio 1 (`scene_child`, `scene_teen`) |
| `render_still.py` | Renderiza um fotograma de uma cena |
| `render_clip.py` | Renderiza um clipe (animação em passos de 2 fotogramas, 12 fps, saída a 24 fps) |

## Como correr

```bash
pip install bpy            # Blender como módulo Python (cerca de 400 MB)
cd marketing/video
python3 render_still.py -- scene_child /tmp/child.png
python3 render_clip.py  -- /tmp/clip 3          # 3 segundos
ffmpeg -framerate 12 -i /tmp/clip/f%04d.png -vf "fps=24,format=yuv420p" -c:v libx264 -crf 18 clip.mp4
```

## Estado e custo de renderização (medido)

- 540x960, 28 amostras com redução de ruído: **cerca de 17 s por fotograma** em 4 núcleos de CPU.
- 65 s a 12 fps de animação = 780 fotogramas = **cerca de 3,7 horas** só para o episódio 1 neste ambiente.
- Para 1080x1920 o custo sobe cerca de 4 vezes. Com uma GPU (ou várias máquinas em paralelo) desce muito.
- Feito: plano 1 (criança com blocos) e plano 4 (adolescente com o telemóvel), ambos como imagem fixa,
  e um clipe de teste do plano 1.
- Falta: os restantes planos, o corte de ligação entre as duas épocas, calendário, ecrãs-cubo, legendas,
  painel, o Offy, música e voz (a narração vem do ElevenLabs, não é gerada aqui).
