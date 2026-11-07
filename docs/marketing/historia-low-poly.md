# offly: história em low poly 3D (Reel de lançamento)

> Estado: **rascunho**. Ainda não consegui ler as legendas nem ver os dois Reels de referência
> (o Instagram bloqueia a leitura). O tom de voz abaixo é uma proposta minha, a partir do que foi
> descrito (Dreamcore, ganchos, voz calma e um pouco inquietante). Falta ajustá-lo à transcrição
> do primeiro Reel, ver a secção "O que falta".

## Ideia em uma linha

Um rapaz vive dentro de um mundo de cubos feito de ecrãs. Tenta sair, recai, cai fundo e só sai
quando aprende a esperar cinco minutos. Não há milagre: há uma pausa, depois outra.

Duração: **60 a 75 segundos**, vertical 9:16, 24 fps. Dá para cortar em 3 episódios de ~25 s.

## Personagem

- **Pedro**, 19 anos. Corpo de cubos arredondados, capuz cinzento, olhos que são dois quadrados
  que refletem a luz do ecrã (em cena de dia, os olhos ficam escuros e opacos).
- **O Feed**: não é um vilão com cara. É um corredor que nunca acaba, com cubos-ecrã a flutuar
  que se viram para o Pedro quando ele passa. Sem rosto, sem voz própria.
- **Offy** (o galo do mascote, versão Dreamcore): aparece só no fim, parado ao fundo, como uma
  memória de infância. Não fala.

## Estilo visual

- Low poly com planos grandes e arestas visíveis; paleta quase preto e branco, com **uma só cor
  de acento** (azul-frio do ecrã) que desaparece quando o Pedro melhora e dá lugar a luz de nascer
  do sol (âmbar suave). A cor conta a história sozinha.
- Câmara de cinema: lente longa, profundidade de campo curta, um pouco de grão e aberração
  cromática nas cenas do Feed; imagem limpa e estável nas cenas de recuperação.
- Luz: ray tracing (Cycles no Blender) com luz volumétrica do ecrã na poeira do quarto.
- Mundo de cubos: se preferires voxel puro, o MagicaVoxel exporta para o Blender.

## Estrutura e narração

Direção de voz entre parênteses retos. **Pausas** com `...` e `<break>`. Texto em português do
Brasil (muda para pt-PT se o público for português; diz-me qual).

### 1. Gancho (0 a 4 s)

*Plano 1:* câmara muito perto do rosto do Pedro, só o brilho azul nos olhos. Silêncio, um zumbido.

> [sussurro, calmo] São três da manhã... <break time="0.8s"/> e você ainda está aí.

### 2. O quarto-feed (4 a 16 s)

*Plano 2:* travelling para trás. O quarto é um corredor sem fim de ecrãs. O polegar do Pedro sobe,
sobe, sobe, e o corredor cresce.
*Plano 3:* relógio de parede de cubos: as horas passam de 3h para 4h para 5h em dois segundos.

> [voz plana] Você não decidiu ficar. <break time="0.6s"/> Só... não decidiu sair.

### 3. A primeira tentativa (16 a 28 s)

*Plano 4:* o Pedro larga o telemóvel na cama e vai à janela. Luz do dia, o azul some um instante.
*Plano 5:* cortes rápidos: copo de água, cadeira, janela. 3 segundos de paz.
*Plano 6:* o telemóvel vibra na cama. Câmara em plongée. O Pedro olha. Hesita.

> [voz mais baixa, quase para si] Dois minutos... <break time="0.5s"/> é o que dura a coragem.

### 4. A recaída (28 a 40 s)

*Plano 7:* ele volta a pegar. O corredor fecha-se atrás dele. O som sobe, depois **corta
para silêncio total**.
*Plano 8:* o Pedro sentado no chão, ecrã apagado no colo, cara de vergonha. Sem exagero.

> [cansada, sem julgar] E você voltou. <break time="1.0s"/> Todo mundo volta.

### 5. O ponto mais baixo (40 a 50 s)

*Plano 9:* ele abre o offly. O ecrã mostra só uma coisa: **um relógio a contar 5 minutos**.
Nada de pontuação, nada de rede.
*Plano 10:* close-up. O Pedro aguenta o impulso: dedos a tremer, depois parados. Os cubos-ecrã
lá fora tremem, depois afastam-se um passo.

> [respiração, devagar] Cinco minutos. <break time="0.8s"/> Só cinco. <break time="0.8s"/> Aguenta.

### 6. A virada (50 a 62 s)

*Plano 11:* o relógio chega a zero. O Pedro respira. Primeira luz âmbar entra pela janela.
*Plano 12:* ele abre a janela, os ecrãs ficam para trás, pequenos, num quarto que volta a ter
paredes.
*Plano 13:* plano geral: rua de cubos ao amanhecer, o Pedro caminha. Ao fundo, parado, o **Offy**.

> [calor, mais firme] Não foi um milagre. <break time="0.7s"/> Foi um dia. <break time="0.6s"/> E depois outro.

### 7. Fecho (62 a 70 s)

*Plano 14:* ecrã preto, o sol do logótipo nasce. Texto: **offly. Menos tela. Mais vida.**

> [suave] offly. <break time="0.5s"/> Menos tela. <break time="0.4s"/> Mais vida.

## Guia de narração para o ElevenLabs

Isto é uma proposta. Ajusta ao ouvido e depois à transcrição do Reel de referência.

**Voz:** feminina ou masculina, grave e próxima, sem tom de locutor. Uma voz de quem conta um
segredo, não de quem dá uma ordem.

**Ritmo:** lento (cerca de 120 a 130 palavras por minuto), com pausas mais longas do que parece
natural. O silêncio é metade do efeito.

**Emoção por bloco:** gancho = sussurro calmo, 2 = voz plana (cansaço), 3 = quase para si,
4 = cansada mas sem julgar, 5 = respiração e firmeza, 6 = calor, 7 = suave.

**Técnica:**
- Modelo **v3**: aceita etiquetas de áudio como `[sussurro]`, `[suspiro]`, `[pausa]`. Verifica na
  interface os nomes exatos que o modelo aceita, porque mudam entre versões.
- Modelos mais antigos (multilingual v2): usa `...` e `<break time="0.8s"/>` para as pausas.
- Gera cada bloco **em separado** e junta no editor: dá controlo sobre o tempo de cada pausa.
- Regras de escrita: frases curtas, uma ideia por linha, sem exclamações, números por extenso
  ("cinco minutos", não "5 min"), nada de siglas.
- Definições de partida: estabilidade média-baixa (mais emoção), semelhança alta, estilo baixo.
  Testa 3 versões da mesma frase e escolhe.

## Música e som

- Zumbido grave e constante nas cenas do Feed; **corta para silêncio** na recaída (plano 7).
- Piano seco ou sintetizador muito simples na virada; sem música épica.
- Sons de ecrã (notificações, scroll) mais altos do que a voz, para incomodarem.

## Cuidados

- Mostra a recaída com respeito: nada de humilhação, nada de comédia à custa dele.
- Sem promessas médicas ("cura", "vício tratado"). O offly é uma ferramenta de autocontrolo.
- No fim do vídeo ou na legenda, uma linha de apoio: quem sentir que perdeu o controlo pode
  falar com um profissional de saúde.
- Se o Reel mostrar o ecrã do offly, usa o app real (ou diz que é ilustrativo).

## O que falta

1. **A transcrição do primeiro Reel** (cola aqui o texto das legendas): com ela, ajusto o
   vocabulário, o ritmo das frases e o tipo de gancho ao tom que gostaste.
2. **O que gostaste no segundo Reel** (planos de câmara, ritmo, estilo dos cubos). Só consegui
   ler que é um perfil identificado como gerado por IA; não consegui ver as imagens.
3. Variante de língua (pt-BR ou pt-PT) e quem conta a história (voz de fora ou o próprio Pedro).
4. Como queres produzir: Blender (mais controlo, mais trabalho) ou geradores de vídeo por IA a
   partir de imagens-chave (mais rápido, menos consistente entre planos).
