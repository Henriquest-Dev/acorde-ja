# Episódio 1: "Eu lembro de quando brincava" (o Pedro)

- **Narrador:** o próprio Pedro, em primeira pessoa, em português do Brasil.
- **Tom:** drama de filme, com memória e perda. Voz baixa, íntima, quase sem música. O humor fica para
  os episódios seguintes; aqui é ferida, nostalgia e uma decisão.
- **Duração:** cerca de 65 s, vertical 9:16.
- **Imagem:** mundo de cubos polidos, estilo Minecraft, com luz de ray tracing (Blender Cycles). O mesmo
  quarto atravessa 15 anos: é isso que dói.
- **Ideia visual central:** a **luz**. Infância = luz dourada do sol e poeira no ar. Vício = azul frio do
  ecrã, quarto cada vez mais escuro. No fim, a primeira luz da lua entra quando ele pousa o telemóvel.

## Roteiro plano a plano

| Tempo | Plano e câmara | Voz do Pedro (tom) | Som |
|---|---|---|---|
| 0 a 8 | Preto. Sobe uma luz dourada: o chão de um quarto, o Pedro criança (cubos pequenos) a empilhar blocos de madeira. Câmara baixa, à altura do chão, com poeira no ar. | "Eu lembro de quando bastava um chão e um punhado de blocos." *(suave, nostálgico, quase sorrindo)* | Risos de crianças distantes e abafados, caixa de música |
| 8 a 18 | Travelling lento à volta do castelo de blocos, que cresce. Voz da mãe fora de campo. O Pedro não ouve. | "O dia inteiro cabia numa tarde. *(pausa)* E a tarde... nunca acabava." | A voz da mãe ("Pedro, o almoço!") longe, com eco |
| 18 a 28 | Uma mão põe um retângulo azul-claro no chão, entre os blocos. A luz dourada recua; o azul toma o rosto da criança. Os blocos saem de foco. | "Aí me deram uma tela. *(pausa 0,6 s)* Só pra eu ficar quieto. *(pausa)* Eu fiquei. *(pausa 0,8 s, mais baixo)* Fiquei tão quieto... que esqueci de sair." | A caixa de música desafina e para; só um zumbido |
| 28 a 42 | **Corte de ligação:** o mesmo ponto de câmara, o mesmo chão. Ao fundo, o calendário de cubos folheia (2012...2026), a janela alterna dia e noite. Os blocos desaparecem, cobertos de pó. Agora o Pedro adolescente está curvado na cama, rosto iluminado de azul, olhos quadrados. O quarto escurece. | "Os anos passaram por cima de mim. *(pausa)* Eu nem vi. Tava no feed." *(plano, vazio)* "Hoje são nove horas e quarenta e um minutos de tela por dia. *(pausa curta)* Eu vi o relatório." | Relógio a acelerar, cliques de notificação, a música de caixa muito distante e deformada |
| 42 a 52 | Close nas mãos: ele tenta pousar o telemóvel e a mão não solta. Os ecrãs-cubo no quarto inclinam-se para ele. Numa prateleira, **um único bloco de madeira** pega a luz dourada do poste lá fora. | "Eu tento largar. *(pausa 0,8 s)* A mão não deixa." *(pausa 1 s, voz a falhar um pouco)* "E o pior... é que ninguém me prendeu. *(pausa)* Eu entreguei." | Silêncio quase total; respiração; um bloco que bate de leve |
| 52 a 62 | Ele olha o bloco. O telemóvel vibra. O Pedro vira-o com o ecrã para baixo, pela primeira vez. O azul apaga-se; entra a luz da lua pela janela. Painel: `DIA 1 DE 30`. | "Hoje é o dia um. *(pausa 1 s)* Se você também esqueceu como se brinca... *(pausa)* fica comigo. *(firme, baixo)* Eu sou o Pedro. E eu vou sair dessa." | Entra uma nota de piano; as risadas do início voltam, nítidas |
| 62 a 66 | Preto. O sol do logótipo nasce; o olho do Offy abre. Legenda: `COMENTE UMA PALAVRA: BLOCO ou RUA`. | "Comenta uma palavra. Amanhã eu faço o que você escolher." *(mais simples, humano)* | Piano resolve; fim em silêncio |

**Texto da voz:** cerca de 150 palavras. A 134 palavras por minuto cabe em cerca de 65 s com as pausas.

## O que torna isto "dramático"

1. **Uma imagem de contraste:** o mesmo chão, o mesmo quarto, 15 anos depois. O espectador faz a comparação sozinho.
2. **A luz conta a história:** dourado para azul para escuro para lua. Sem precisar de explicar.
3. **O som corta:** a caixa de música desafina quando chega a tela e volta nítida no fim.
4. **Uma única frase que dói:** "Ninguém me prendeu. Eu entreguei." É a frase que as pessoas vão citar.
5. **O objeto-símbolo:** o último bloco de madeira na prateleira. Volta nos episódios seguintes.
6. **A decisão no fim:** não promete cura, só um primeiro dia. Honesto e esperançoso.

## Mecânicas de série (mantidas)

- Painel `DIA 1 DE 30` só no ato final (aparece como momento de viragem, não como HUD constante).
- Pergunta ao público no fim (`BLOCO` ou `RUA`), que decide o episódio 2.
- O olho do Offy, no fim e escondido em 1 plano (rever para encontrar).

## Texto limpo para o ElevenLabs

Voz masculina jovem, grave e próxima, **sem tom de locutor**. Gera cada bloco separado.

```
Eu lembro de quando bastava um chão e um punhado de blocos.
```
```
O dia inteiro cabia numa tarde. <break time="0.7s"/> E a tarde... nunca acabava.
```
```
Aí me deram uma tela. <break time="0.6s"/> Só pra eu ficar quieto. <break time="0.7s"/> Eu fiquei. <break time="0.9s"/>
Fiquei tão quieto... que esqueci de sair.
```
```
Os anos passaram por cima de mim. <break time="0.6s"/> Eu nem vi. Tava no feed.
Hoje são nove horas e quarenta e um minutos de tela por dia. <break time="0.5s"/> Eu vi o relatório.
```
```
Eu tento largar. <break time="0.9s"/> A mão não deixa. <break time="1.0s"/>
E o pior... é que ninguém me prendeu. <break time="0.7s"/> Eu entreguei.
```
```
Hoje é o dia um. <break time="1.0s"/> Se você também esqueceu como se brinca... <break time="0.6s"/> fica comigo.
Eu sou o Pedro. E eu vou sair dessa.
```
```
Comenta uma palavra. Amanhã eu faço o que você escolher.
```

No modelo v3 testa `[sussurro]` na frase "Eu entreguei" e `[suspiro]` antes de "A mão não deixa" (confirma os nomes
na interface). Definições de partida: estabilidade baixa (mais emoção), semelhança alta, estilo baixo.

## Cuidados

- Não culpabilizar os pais: a frase "me deram uma tela" é uma memória, não uma acusação.
- Sem promessas médicas. Na legenda: "Se sentir que perdeu o controlo do uso do celular, procure um profissional de saúde."
- O dado "9h41" é do personagem. Não o apresentar como estatística real.

## Como é produzido

As imagens são geradas em código com o Blender (módulo `bpy`, motor Cycles com ray tracing), em
`marketing/video/`. Personagem de cubos polidos com bisel, luz de área e desfoque de câmara. O estado atual
e o tempo de renderização estão em `marketing/video/README.md`.
