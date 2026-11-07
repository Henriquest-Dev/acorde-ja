"""Gera legendas ASS (1 a 3 palavras de cada vez, com a palavra-chave em azul) a partir das palavras com tempos.

Uso: python3 subs.py words.json saida.ass [largura altura]
"""
import json
import re
import sys

LEAD = 1.5
FIX = {'Abrir': 'Abri', 'Abre': 'Abri', 'para': 'pra', 'Para': 'Pra', 'celular': 'celular'}
EMPH = {'tela', 'quieto', 'nunca', 'relatório', 'mão', 'entreguei', 'bloco', 'lua', 'Pedro', 'dia', 'feliz', 'sair', 'aguentei',
        'menti', 'manhã', 'relógio', 'comigo', 'dessa', 'rua', 'tarde', 'esfriava', 'prendeu'}
BLUE = '&H00FFB04D&'  # BGR de azul-claro (#4DB0FF)


def clean(w):
    w = w.strip()
    return FIX.get(w, w)


def chunks(words, max_words=3, max_gap=0.35):
    cur = []
    for s, e, w in words:
        w = clean(w)
        if not w:
            continue
        if cur and (len(cur) >= max_words or s - cur[-1][1] > max_gap or re.search(r'[.?!]$', cur[-1][2])):
            yield cur
            cur = []
        cur.append((s, e, w))
    if cur:
        yield cur


def ts(t):
    h, m = int(t // 3600), int(t % 3600 // 60)
    return f'{h}:{m:02d}:{t % 60:05.2f}'


def main(src, dst, w=1080, h=1920):
    words = json.load(open(src))
    head = f'''[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter,{int(h * 0.048)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,{max(3, int(h * 0.0035))},2,2,60,60,{int(h * 0.19)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    lines = []
    cs = list(chunks(words))
    for i, ch in enumerate(cs):
        start = ch[0][0] + LEAD
        end = ch[-1][1] + LEAD + 0.12
        if i + 1 < len(cs):
            end = min(end, cs[i + 1][0][0] + LEAD - 0.02)
        text = ' '.join(('{\\c' + BLUE + '}' + x[2].upper() + '{\\c&HFFFFFF&}') if x[2].strip('.,?!').lower() in {e.lower() for e in EMPH} else x[2].upper() for x in ch)
        text = '{\\fad(60,60)}' + text.replace('.', '').replace(',', '')
        lines.append(f'Dialogue: 0,{ts(start)},{ts(end)},Cap,,0,0,0,,{text}')
    open(dst, 'w').write(head + '\n'.join(lines) + '\n')
    print(len(lines), 'legendas')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], *(int(x) for x in sys.argv[3:5]))
