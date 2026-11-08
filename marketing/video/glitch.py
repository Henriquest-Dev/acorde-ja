"""Efeito de falha de vídeo (glitch) para as transições: separação RGB, fatias deslocadas e linhas de varrimento."""
import random

import numpy as np
from PIL import Image


def glitch_frame(img, level, seed=0):
    """img: PIL RGB. level: 0 (nada) a 3 (muito forte). Devolve uma imagem nova."""
    if level <= 0:
        return img
    rnd = random.Random(seed)
    a = np.asarray(img).astype(np.float32)
    h, w, _ = a.shape
    out = a.copy()
    # separação de canais (RGB split)
    dx = int(3 + 6 * level + rnd.randint(0, 4))
    out[:, :, 0] = np.roll(a[:, :, 0], dx, axis=1)
    out[:, :, 2] = np.roll(a[:, :, 2], -dx, axis=1)
    # fatias horizontais deslocadas
    for _ in range(int(3 + 5 * level)):
        sh = rnd.randint(6, max(8, int(h * 0.07)))
        y = rnd.randint(0, h - sh)
        shift = rnd.choice((-1, 1)) * rnd.randint(int(w * 0.02), int(w * 0.12 * level + 6))
        out[y:y + sh] = np.roll(out[y:y + sh], shift, axis=1)
        if level >= 2 and rnd.random() < 0.5:
            tint = np.array(rnd.choice(((0, 255, 255), (255, 0, 255), (255, 255, 0))), dtype=np.float32)
            out[y:y + sh] = out[y:y + sh] * 0.7 + tint * 0.3
    # linhas de varrimento e tremor de brilho
    out[::4] *= 0.88
    out *= rnd.uniform(0.92, 1.1)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
