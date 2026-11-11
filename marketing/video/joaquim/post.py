"""Pós-produção do «Joaquim»: legendas (ASS), logótipo final (PNG) e efeitos sonoros (WAV).
Uso: python3 post.py <pasta_de_trabalho>   (lê timeline.json; escreve subs.ass, logo/, sfx.wav)
"""
import json
import math
import os
import re
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 24
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, '..', '..', '..', 'node_modules', '@expo-google-fonts', 'inter')
BOLD = os.path.join(FONT_DIR, '700Bold', 'Inter_700Bold.ttf')
MED = os.path.join(FONT_DIR, '500Medium', 'Inter_500Medium.ttf')
FIX = {'awfully.': 'offly.', 'Offly.': 'offly.', 'Pff,': '', '34': 'trinta e quatro', '90': 'noventa'}
LEAD = 1.0  # a narração começa 1 s depois do início do vídeo
EMPH = {'afundei', 'vergonha', 'filho', 'difícil', 'escuro', 'vídeos', 'apostas', 'recuperei', 'bebia', 'seis', 'amava', 'ajuda', 'offly', 'bloqueou', 'respirar', 'dias', 'durmo', 'presente', 'voltei', 'vida'}
GOLD = '&H003DC5FF&'  # BGR de #FFC53D
LOGO_T0 = 59.1
TOTAL = 63.4


def ts(t):
    return f'{int(t // 3600)}:{int(t % 3600 // 60):02d}:{t % 60:05.2f}'


def subs(tl, dst):
    words = [(s + LEAD, e + LEAD, FIX.get(w, w)) for s, e, w in tl if FIX.get(w, w)]
    out, cur = [], []
    for s, e, w in words:
        if cur and (len(cur) >= 3 or s - cur[-1][1] > 0.38 or re.search(r'[.?!,]$', cur[-1][2])):
            out.append(cur)
            cur = []
        cur.append((s, e, w))
    if cur:
        out.append(cur)
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: S,Inter,74,&H00FFFFFF&,&H00FFFFFF&,&H00101010&,&H96000000&,1,0,0,0,100,100,-1,0,1,5,3,2,60,60,400,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for i, c in enumerate(out):
        a = c[0][0] - 0.04
        b = min(c[-1][1] + 0.3, out[i + 1][0][0] - 0.04) if i + 1 < len(out) else c[-1][1] + 0.6
        if a >= LOGO_T0:  # o logótipo já mostra o texto final
            continue
        txt = ' '.join((('{\\c' + GOLD + '}' + w + '{\\c&H00FFFFFF&}') if re.sub(r'[^\wà-ú]', '', w.lower()) in EMPH else w) for _, _, w in c)
        lines.append(f'Dialogue: 0,{ts(max(0, a))},{ts(b)},S,,0,0,0,,{{\\fad(60,60)}}{txt}')
    open(dst, 'w', encoding='utf-8').write(head + '\n'.join(lines) + '\n')
    return len(lines)


def logo_frames(dst, dur):
    """Sol do offly a nascer, nome e lema. Fundo escuro quente com brilho."""
    os.makedirs(dst, exist_ok=True)
    fb = ImageFont.truetype(BOLD, 190)
    fm = ImageFont.truetype(MED, 58)
    cx, cy = W // 2, 800
    ease = lambda x: 0 if x <= 0 else 1 if x >= 1 else 1 - (1 - x) ** 3
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.sqrt((xx - cx) ** 2 + (yy - (cy + 40)) ** 2)
    for f in range(int(dur * FPS)):
        t = f / FPS
        k = ease(t / 0.8)          # sol
        kn = ease((t - 0.15) / 0.6)  # nome
        k1 = ease((t - 0.4) / 0.4)  # Menos tela.
        k2 = ease((t - 1.2) / 0.5)  # Mais vida.
        out = ease((dur - t) / 0.8)
        glow = np.exp(-(dist / (520 + 60 * math.sin(t * 0.8))) ** 2) * (0.55 * k)
        bg = np.zeros((H, W, 3), dtype=np.float32)
        bg[..., 0] = 10 + 255 * glow * 0.95
        bg[..., 1] = 7 + 255 * glow * 0.52
        bg[..., 2] = 5 + 255 * glow * 0.12
        im = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        s = 3.3
        rise = (1 - k) * 90
        a = int(255 * k)
        for deg in (-150, -120, -90, -60, -30):
            r = math.radians(deg)
            x1, y1 = cx + math.cos(r) * 27 * s * 2, cy + rise + math.sin(r) * 27 * s * 2
            x2, y2 = cx + math.cos(r) * 38 * s * 2, cy + rise + math.sin(r) * 38 * s * 2
            d.line([(x1, y1), (x2, y2)], fill=(255, 255, 255, a), width=int(4 * s * 2))
            for (x, y) in ((x1, y1), (x2, y2)):
                d.ellipse([x - 4 * s, y - 4 * s, x + 4 * s, y + 4 * s], fill=(255, 255, 255, a))
        R = 20 * s * 2
        d.pieslice([cx - R, cy + rise - R + 18, cx + R, cy + rise + R + 18], 180, 360, fill=(255, 255, 255, a))
        d.polygon([(cx - 42 * s * 2, cy + 46), (cx, cy + 22), (cx + 42 * s * 2, cy + 46), (cx, cy + 34)], fill=(255, 255, 255, int(255 * k)))
        tw = d.textlength('offly', font=fb)
        d.text((cx - tw / 2, cy + 110 + (1 - kn) * 30), 'offly', font=fb, fill=(255, 255, 255, int(255 * kn)))
        t1, t2 = 'Menos tela.', ' Mais vida.'
        w1, w2 = d.textlength(t1, font=fm), d.textlength(t2, font=fm)
        x0 = cx - (w1 + w2) / 2
        d.text((x0, cy + 370), t1, font=fm, fill=(235, 225, 215, int(255 * k1)))
        d.text((x0 + w1, cy + 370), t2, font=fm, fill=(255, 197, 61, int(255 * k2)))
        im = Image.alpha_composite(im.convert('RGBA'), layer).convert('RGB')
        if out < 1:
            im = Image.eval(im, lambda v: int(v * out))
        im.save(os.path.join(dst, f'l{f + 1:04d}.png'))


def sfx(dst, cuts):
    sr = 48000
    n = int(TOTAL * sr)
    y = np.zeros((n, 2), dtype=np.float32)
    rng = np.random.default_rng(5)

    def add(t, sig, gain=1.0, pan=0.5):
        i = int(t * sr)
        sig = sig[: max(0, n - i)]
        y[i:i + len(sig), 0] += sig * gain * (1 - pan) * 2
        y[i:i + len(sig), 1] += sig * gain * pan * 2

    def env(d, a=0.01, r=0.3):
        t = np.arange(int(d * sr)) / sr
        return np.minimum(1, t / a) * np.exp(-t / r)

    def tone(f, d, r=0.3):
        t = np.arange(int(d * sr)) / sr
        return np.sin(2 * np.pi * f * t) * env(d, 0.005, r)

    def whoosh(d, up=True):
        m = int(d * sr)
        x = rng.standard_normal(m)
        k = np.linspace(0.02, 0.5, m) if up else np.linspace(0.5, 0.02, m)
        out = np.zeros(m)
        acc = 0.0
        for i in range(m):
            acc += k[i] * (x[i] - acc)
            out[i] = acc
        return out * np.sin(np.pi * np.arange(m) / m) ** 2

    # zumbido grave e batimento na parte escura
    dark_end = cuts['s6_virada'] + 6.0
    t = np.arange(int(dark_end * sr)) / sr
    drone = (np.sin(2 * np.pi * 48 * t) + 0.5 * np.sin(2 * np.pi * 72.5 * t + np.sin(t * 0.7))) * 0.05
    drone *= np.minimum(1, t / 3) * np.minimum(1, (dark_end - t) / 1.5)
    add(0, drone)
    tt = cuts['s5_perda']
    while tt < cuts['s6_virada'] + 3.5:
        add(tt, tone(52, 0.3, 0.09), 0.5)
        add(tt + 0.28, tone(46, 0.3, 0.08), 0.35)
        tt += 1.25
    for name in ('s2a_ecra', 's3_apostas', 's4_bar', 's5_perda'):
        add(cuts[name] - 0.25, whoosh(0.5), 0.35)
    for k, off in enumerate((0.35, 1.05, 1.7, 2.3)):  # deslizar no ecrã
        add(cuts['s2a_ecra'] + off, whoosh(0.3, k % 2 == 0), 0.22)
    for i in range(15):  # moedas
        add(cuts['s3_apostas'] + 0.5 + i * 0.3, tone(2200 + 300 * (i % 3), 0.12, 0.04), 0.07, 0.3 + 0.03 * i)
    add(cuts['s3_apostas'] + 6.1, tone(90, 1.2, 0.5), 0.5)
    for i in range(5):  # copos
        add(cuts['s4_bar'] + 3.2 + i * 0.24, tone(1500 + 110 * i, 0.25, 0.07) + 0.4 * tone(3100 + 200 * i, 0.25, 0.04), 0.1, 0.25 + 0.12 * i)
    add(cuts['s5_perda'] + 6.2, tone(70, 1.0, 0.35) + 0.3 * rng.standard_normal(int(1.0 * sr)) * env(1.0, 0.002, 0.05), 0.5)  # porta
    # o Offy aparece
    t0 = cuts['s6_virada'] + 6.25
    add(t0 - 0.9, whoosh(1.0), 0.5)
    for j, f in enumerate((523.25, 659.25, 783.99, 1046.5)):
        add(t0 + j * 0.09, tone(f, 1.6, 0.6) + 0.3 * tone(f * 2, 1.6, 0.4), 0.11, 0.35 + 0.1 * j)
    for i in range(10):  # escudo
        add(cuts['s7a_escudo'] + 0.25 + i * 0.26 + 0.42, tone(300 + 40 * (i % 4), 0.25, 0.06) + 0.3 * tone(1200, 0.25, 0.03), 0.16, 0.2 + 0.06 * i)
    m = int(4.4 * sr)  # respiração: sopro que sobe e desce
    br = whoosh(4.4) * 0.5
    add(cuts['s7b_respirar'], br[:m], 0.45)
    for i in range(30):  # dias
        add(cuts['s7c_dias'] + 0.15 + i * 0.075, tone(900 + i * 28, 0.08, 0.025), 0.07)
    add(cuts['s7c_dias'] + 2.4, tone(1318.5, 1.0, 0.4) + tone(1567.98, 1.0, 0.4), 0.09)
    t0 = cuts['s8_hoje']
    for j, f in enumerate((392.0, 523.25, 659.25)):
        add(t0 + 3.75 + j * 0.07, tone(f, 2.5, 1.0), 0.07)
    y = np.tanh(y * 1.2) / 1.2
    w = wave.open(dst, 'wb')
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())


if __name__ == '__main__':
    work = sys.argv[1]
    sys.path.insert(0, HERE)
    tl = json.load(open(os.path.join(work, 'words_el.json'), encoding='utf-8'))
    import shots as _sh  # só para as durações (não precisa do Blender a correr)
    durs = [(n, d) for n, d, _f, _s in _sh.SHOTS]
    cuts, t = {}, 0.0
    for n, d in durs:
        cuts[n] = t
        t += d
    print('subs', subs(tl, os.path.join(work, 'subs.ass')))
    sfx(os.path.join(work, 'sfx.wav'), cuts)
    print('sfx ok')
    logo_frames(os.path.join(work, 'logo'), TOTAL - LOGO_T0)
    print('logo ok')
