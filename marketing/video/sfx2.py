"""Efeitos sonoros do episódio 2 (Yara), sincronizados com a narração real (130,12 s).

Uso: python3 sfx2.py saida.wav
"""
import sys

import numpy as np
from scipy.io import wavfile

import sfx
from sfx import SR, Bus, bell, bp, breath, door_close, env, heartbeat, hum, knock, notify, thump, tick, whoosh
from timeline2 import LEAD, video_len

# a classe Bus de sfx.py usa o tempo do episódio 1; reconfigurar o comprimento
sfx.video_len = video_len
sfx.LEAD = LEAD

rng = np.random.default_rng(11)


def glitch(b, t, dur=0.35, g=0.35):
    """Estalidos digitais: rajadas curtas de ruído em bandas altas e bipes quebrados."""
    n = int(dur * SR)
    x = np.zeros(n)
    pos = 0
    while pos < n:
        ln = int(rng.uniform(0.01, 0.06) * SR)
        seg = bp(rng.normal(0, 1, ln), 1800, 7000) * rng.uniform(0.4, 1.0)
        x[pos:pos + ln] += seg[: n - pos]
        pos += ln + int(rng.uniform(0.0, 0.04) * SR)
    tt = np.arange(n) / SR
    x += 0.25 * np.sign(np.sin(2 * np.pi * rng.uniform(300, 900) * tt)) * (rng.random(n) > 0.6)
    b.add(t, x, g)


def rewind(b, t0, t1, g=0.4):
    """Som de fita a rebobinar: ruído filtrado com varrimento ascendente."""
    n = int((t1 - t0) * SR)
    tt = np.arange(n) / SR
    x = bp(rng.normal(0, 1, n), 600, 5000) * (0.6 + 0.4 * np.sin(2 * np.pi * (6 + 20 * tt / (t1 - t0)) * tt))
    x *= np.minimum(tt / 0.2, 1) * np.minimum((t1 - t0 - tt) / 0.2, 1)
    b.add(t0, x, g)


def build():
    b = Bus()
    n = int((video_len() + 1) * SR)
    b.l = np.zeros(n)
    b.r = np.zeros(n)
    bell(b, 0.3, 523.25, 0.12)
    # o telemóvel acende e o zumbido azul começa
    notify(b, 16.6, 1480, 0.22)
    hum(b, 16.8, 45.8, 0.13)
    for t in (22.3, 23.6, 25.0, 26.4):
        notify(b, t, 1250, 0.12)
    for k, dt in enumerate((0, 0.12, 0.22)):
        tick(b, 25.6 + dt, 0.5 - 0.1 * k, 900)
    knock(b, 28.2)
    notify(b, 33.1, 1320, 0.2)
    notify(b, 34.0, 1420, 0.2)
    for i in range(8):
        tick(b, 38.2 + i * 0.36, 0.25 + 0.03 * i, 1700 + 120 * i)
    for t in (41.8, 42.9, 44.0, 45.0):
        whoosh(b, t, 0.35, 0.18)
    glitch(b, 45.7, 0.4, 0.3)
    # prova A: relógio, papel, batimento
    for i in range(8):
        tick(b, 47.0 + i, 0.4, 2200)
    whoosh(b, 46.4, 0.3, 0.14)
    heartbeat(b, 50.6, 55.0)
    whoosh(b, 54.8, 0.3, 0.2)
    thump(b, 57.4, 0.7, 55)
    glitch(b, 59.6, 0.35, 0.3)
    # corredor: quase silêncio
    hum(b, 60.2, 66.2, 0.05)
    # rebobinar
    rewind(b, 66.4, 70.3, 0.42)
    for i in range(12):
        tick(b, 66.6 + i * 0.3, 0.35, 2000 - 90 * i)
    glitch(b, 66.3, 0.5, 0.35)
    glitch(b, 70.0, 0.5, 0.35)
    bell(b, 70.6, 659.25, 0.18)
    notify(b, 73.6, 1760, 0.2)
    for t in (77.0, 78.6):
        whoosh(b, t, 0.4, 0.14)
    thump(b, 83.9, 0.55, 65)
    tick(b, 92.4, 0.6, 3000)
    thump(b, 92.5, 0.4, 90)
    for i in range(6):
        tick(b, 94.2 + i, 0.45, 2600)
    for k, t in enumerate((99.9, 100.9, 101.6)):
        bell(b, t, 659.25 * (1 + 0.12 * k), 0.12)
    breath(b, 104.2, True, 0.18)
    whoosh(b, 107.8, 2.3, 0.07)
    for f, dt in ((659.25, 0), (783.99, 0.1), (987.77, 0.2)):
        bell(b, 110.8 + dt, f, 0.16)
    door_close(b, 112.6)
    bell(b, 115.9, 523.25, 0.1)
    glitch(b, 122.1, 0.4, 0.3)
    bell(b, 128.6, 783.99, 0.18)
    return b


if __name__ == '__main__':
    b = build()
    stereo = np.stack([b.l, b.r], axis=1)
    stereo = stereo / max(1e-6, np.abs(stereo).max()) * 0.8
    wavfile.write(sys.argv[1], SR, (stereo * 32767).astype(np.int16))
    print('sfx2 ok', round(len(b.l) / SR, 1), 's')
