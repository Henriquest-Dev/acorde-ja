"""Linha do tempo do episódio 1, sincronizada com a narração real (82,83 s).

Tempos de `NARR` em segundos da narração. No vídeo, tudo desloca `LEAD` (silêncio inicial com música).
"""
LEAD = 0.0
TAIL = 0.0
NARR_LEN = 82.83

# (cena, início, fim, frase-chave da legenda, efeitos sonoros)
SCENES = [
    ('s01', 0.0, 6.2, 'um chão e um punhado de blocos', 'risos distantes'),
    ('s02', 6.2, 9.0, 'a tarde nunca acabava', 'palmas de criança'),
    ('s03', 9.0, 14.5, 'eu fingia que não ouvia', 'voz da mãe ao longe'),
    ('s04', 14.5, 17.7, 'me deram uma tela', 'zumbido do ecrã a entrar'),
    ('s05', 17.7, 21.9, 'esqueci de sair', 'zumbido grave constante'),
    ('s06', 21.9, 25.2, 'a caixa foi pro armário', 'porta do armário a fechar'),
    ('s07', 25.2, 28.0, 'os anos passaram', 'relógio a acelerar'),
    ('s08', 28.0, 33.5, 'mais tarde virou nunca', 'amigos a chamar, a afastar'),
    ('s09', 33.5, 37.5, 'o prato esfriava', 'talheres, silêncio'),
    ('s10', 37.5, 42.4, 'eu vi o relatório', 'contador a subir'),
    ('s11', 42.4, 44.9, 'três da manhã', 'tic-tac, batida na porta'),
    ('s12', 44.9, 48.2, 'eu menti', 'batida na porta'),
    ('s13', 48.2, 51.5, 'a mão não deixa', 'batimento cardíaco'),
    ('s14', 51.5, 54.9, 'eu entreguei', 'silêncio quase total'),
    ('s15', 54.9, 58.0, 'o último bloco', 'caixa de música volta'),
    ('s16', 58.0, 62.6, 'só um relógio', 'tic-tac do relógio'),
    ('s17', 62.6, 67.0, 'mas eu aguentei', 'respiração'),
    ('s18', 67.0, 70.9, 'a lua entrou pela janela', 'telemóvel pousado, silêncio'),
    ('s19', 70.9, 75.5, 'fica comigo', 'caixa de música afinada'),
    ('s20', 75.5, 78.2, 'eu vou sair dessa', 'tom de abertura'),
    ('s21', 78.2, NARR_LEN, 'bloco ou rua?', 'nota final'),
]


def video_len():
    return NARR_LEN + LEAD + TAIL


def scene_times():
    """Devolve (cena, início, fim) no tempo do vídeo; s01 começa em 0."""
    out = []
    for i, (name, a, b, *_rest) in enumerate(SCENES):
        start = 0.0 if i == 0 else a + LEAD
        end = b + LEAD
        out.append((name, start, end))
    return out
