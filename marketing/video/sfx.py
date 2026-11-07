"""Efeitos sonoros sintetizados (sem direitos de autor) para o episódio 1, sincronizados com a narração.

Uso: python3 sfx.py saida.wav   (48 kHz, estéreo, mesma duração do vídeo)
Os tempos estão em segundos da narração; o vídeo desloca LEAD.
"""
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

from timeline import LEAD, video_len

SR = 48000
rng = np.random.default_rng(7)


def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-t / d)


def lp(x, f):
    return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)


def hp(x, f):
    return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)


class Bus:
    def __init__(self):
        self.l = np.zeros(int((video_len() + 1) * SR))
        self.r = np.zeros_like(self.l)

    def add(self, t, x, gain=1.0, pan=0.0):
        i = int((t + LEAD) * SR)
        if i < 0 or i >= len(self.l):
            return
        n = min(len(x), len(self.l) - i)
        self.l[i:i + n] += x[:n] * gain * (1 - max(0, pan))
        self.r[i:i + n] += x[:n] * gain * (1 + min(0, pan))


def knock(b, t):
    for k, dt in enumerate((0.0, 0.22, 0.44)):
        n = int(0.35 * SR)
        tt = np.arange(n) / SR
        x = np.sin(2 * np.pi * (95 - 20 * tt) * tt) * env(n, 0.002, 0.07) + lp(rng.normal(0, 1, n), 700) * env(n, 0.001, 0.02) * 0.6
        b.add(t + dt, x, 0.9 - 0.1 * k, pan=-0.4)


def tick(b, t, g=0.5, pitch=2200):
    n = int(0.06 * SR)
    x = bp(rng.normal(0, 1, n), pitch * 0.7, pitch * 1.4) * env(n, 0.0005, 0.012)
    b.add(t, x, g)


def hum(b, t0, t1, g=0.18):
    n = int((t1 - t0) * SR)
    tt = np.arange(n) / SR
    fade = np.minimum(tt / 1.5, 1) * np.minimum((t1 - t0 - tt) / 1.5, 1)
    x = (np.sin(2 * np.pi * 55 * tt) + 0.5 * np.sin(2 * np.pi * 110.5 * tt) + 0.15 * np.sin(2 * np.pi * 220 * tt)) * (1 + 0.15 * np.sin(2 * np.pi * 0.3 * tt))
    b.add(t0, x * fade * g)


def whoosh(b, t, dur=0.5, g=0.35, pan=0.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    x = rng.normal(0, 1, n)
    x = bp(x, 400, 5000) * np.sin(np.pi * tt / dur) ** 2
    b.add(t, x, g, pan)


def thump(b, t, g=0.8, f=60):
    n = int(0.5 * SR)
    tt = np.arange(n) / SR
    b.add(t, np.sin(2 * np.pi * (f - 15 * tt) * tt) * env(n, 0.003, 0.12), g)


def heartbeat(b, t0, t1):
    t = t0
    gap = 0.95
    while t < t1:
        thump(b, t, 0.7, 55)
        thump(b, t + 0.2, 0.45, 50)
        t += gap
        gap = max(0.6, gap - 0.03)


def notify(b, t, f=1320, g=0.3):
    n = int(0.4 * SR)
    tt = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 1.5 * tt)) * env(n, 0.003, 0.09)
    b.add(t, x, g)
    b.add(t + 0.13, x, g * 0.7)


def door_close(b, t):
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    x = lp(rng.normal(0, 1, n), 380) * env(n, 0.002, 0.09) * 1.5 + np.sin(2 * np.pi * 70 * tt) * env(n, 0.002, 0.16)
    b.add(t, x, 0.9)


def breath(b, t, inhale=True, g=0.25):
    n = int(1.0 * SR)
    tt = np.arange(n) / SR
    sh = np.sin(np.pi * tt) ** 2 if inhale else np.exp(-tt * 2.5) * np.minimum(tt / 0.2, 1)
    x = bp(rng.normal(0, 1, n), 500, 3500) * sh
    b.add(t, x, g)


def bell(b, t, f=659.25, g=0.28):
    n = int(3.5 * SR)
    tt = np.arange(n) / SR
    x = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt * 3) + 0.25 * np.sin(2 * np.pi * f * 5.4 * tt) * np.exp(-tt * 6)) * env(n, 0.003, 1.1)
    b.add(t, x, g)


def build():
    b = Bus()
    # infância: cenas suaves, quase sem efeitos
    whoosh(b, 5.9, 0.4, 0.15)
    bell(b, 0.2, 523.25, 0.12)
    # tela chega: zumbido e notificações
    hum(b, 14.5, 25.0, 0.16)
    notify(b, 15.2, 1480, 0.18)
    door_close(b, 24.5)
    # anos: relógio a acelerar, notificações, swipes
    for i in range(14):
        tick(b, 25.3 + i * (0.42 - 0.02 * i), 0.3 + 0.02 * i)
    for t in (26.5, 29.0, 31.0, 34.0, 36.2, 38.4):
        notify(b, t, 1200 + 80 * (int(t) % 3), 0.22)
    for t in (34.4, 35.1, 35.9, 36.6):
        whoosh(b, t, 0.25, 0.2)
    whoosh(b, 32.0, 1.0, 0.18, pan=-0.6)
    hum(b, 33.0, 42.3, 0.14)
    for i in range(10):
        tick(b, 38.0 + i * 0.25, 0.25 + 0.03 * i, 1800 + 120 * i)
    # três da manhã
    for i in range(3):
        tick(b, 42.7 + i * 1.0, 0.45, 1500)
    knock(b, 44.0)
    knock(b, 45.2)
    # a mão não deixa
    hum(b, 48.2, 54.0, 0.2)
    heartbeat(b, 48.3, 54.1)
    # silêncio em «Eu entreguei» (54,2 a 54,9)
    whoosh(b, 54.7, 0.5, 0.15)
    bell(b, 55.4, 392.0, 0.14)
    # temporizador
    for i in range(6):
        tick(b, 60.7 + i * 1.0, 0.55, 2600)
    breath(b, 63.0, True, 0.2)
    breath(b, 64.5, False, 0.2)
    thump(b, 68.0, 0.7, 70)
    bell(b, 68.2, 659.25, 0.16)
    # fecho: caixa de música afinada e nota final
    for k, f in enumerate((523.25, 659.25, 783.99, 659.25)):
        bell(b, 71.2 + k * 0.7, f, 0.14)
    bell(b, 75.9, 523.25, 0.2)
    bell(b, 82.0, 783.99, 0.18)
    return b


if __name__ == '__main__':
    b = build()
    stereo = np.stack([b.l, b.r], axis=1)
    stereo = stereo / max(1e-6, np.abs(stereo).max()) * 0.8
    wavfile.write(sys.argv[1], SR, (stereo * 32767).astype(np.int16))
    print('sfx ok', round(len(b.l) / SR, 1), 's')
