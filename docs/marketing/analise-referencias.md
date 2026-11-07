# Análise dos dois vídeos de referência

Vídeos analisados (ficheiros enviados, 360x640, vertical):

- **Vídeo A** — "escolhas.app": animação 2D com história e escolha do público (69 s).
- **Vídeo B** — "ACORDE JÁ / Motivacional" (@acordejaa): o vídeo Dreamcore da conta (37 s).

Como analisei: vi fotogramas a cada 2 a 2,5 s e transcrevi o áudio com reconhecimento de fala
automático. A transcrição pode ter erros pequenos; as frases do vídeo B estão corrigidas com as
legendas que aparecem no ecrã. Não analisei métricas (retenção, partilhas), só o que se vê e ouve.

---

## Vídeo A: o modelo do vídeo (história + escolha)

### Estrutura em 69 segundos

| Tempo | O que acontece | Função |
|---|---|---|
| 0 a 6 s | Cena já em andamento: urso preso numa porta, "O urso entalou na porta". Em seguida, prazo e meta: "15 dias para virar outra pessoa, antes do encontro com a Laura". | Gancho (imagem absurda) + aposta (prazo e objetivo) |
| 6 a 10 s | "Vocês escolheram o presente." | Liga ao episódio anterior: o público já mandou na história |
| 10 a 18 s | Salário cai (R$ 4,20 vira R$ 1.504) e o problema: "ele não sabe do que ela gosta". | Recurso e obstáculo |
| 18 a 21 s | "Leu a conversa inteira. Nada." | Primeira falha, em 3 palavras |
| 21 a 34 s | Tentativa 2: urso de R$ 89, maior que a porta. Tentativa 3: curso de joalheria, o colar ficou verde (carimbo "FOLHEADO"). | Regra de três: duas falhas cómicas |
| 34 a 43 s | "Aí ele lembrou onde trabalha": faz uma capinha com a foto da lua que ela mandou. R$ 12. | Solução pequena e pessoal, vence a cara |
| 43 a 51 s | Antes/depois do personagem lado a lado (Dia 1 e Dia 16). "Glow up, mais 3%". Ela responde em 10 s com 11 mensagens. | Recompensa e prova |
| 51 a 62 s | Ele não dorme, vai correr. Aos 4 minutos, para no meio-fio. O grupo da pelada manda mensagem: "amanhã você joga na linha". | Novo problema = gancho do próximo episódio |
| 61 a 65 s | Ecrã dividido "Corrida" contra "Restaurante": "Comenta uma palavra." | Participação do público decide o episódio seguinte |
| 65 a 69 s | "Quer aprender a fazer esses vídeos? Link na bio." | CTA comercial (é um vídeo-modelo de venda de curso) |

### O que o torna viral (e se copia como técnica, não como história)

1. **HUD fixo no topo durante o vídeo todo:** "DIAS RESTANTES 15" e "GLOW-UP 42%" (sobe para 45%).
   Dá a sensação de jogo e de progresso mensurável, e faz o espectador querer ver o número subir.
2. **Série com continuidade:** "Dia 16 de 30", "Dia 17". Quem gostou volta e quem chega a meio percebe o
   formato em 3 segundos.
3. **O público manda:** a escolha do presente e a escolha do próximo episódio vêm dos comentários.
   Gera comentários (alcance) e dá motivo para voltar.
4. **Regra de três:** falha, falha, acerto. Previsível de propósito, por isso confortável.
5. **A solução vence pela atenção, não pelo dinheiro** (capinha de R$ 12 contra urso de R$ 89).
   Isto é perfeito para o offly: pequeno e pessoal vence grande e caro.
6. **Cada cena fecha com um problema novo.** O vídeo acaba em suspensão (pelada, linha, 4 minutos),
   nunca em resolução.
7. **Legendas grandes, 1 a 3 palavras de cada vez**, sincronizadas com a voz. Branco com **uma palavra em
   cor** (amarelo ou vermelho) no sentido da frase. Autocolantes de texto ("NENHUMA PISTA", "FOLHEADO",
   "NA LINHA?!") reforçam a piada.
8. **Ritmo de corte:** mais de 16 mudanças de plano fortes em 69 s, ou seja, um corte a cada 3 a 4 s, com
   mudanças de cor de fundo (azul, roxo, vermelho) para cada tipo de cena (cidade, telemóvel, loja).
9. **Elementos de UI reais:** ecrã do banco, conversa de WhatsApp. O telemóvel dentro do vídeo dá
   credibilidade e é fácil de reproduzir.

### Estilo visual

2D plano, personagem tipo avatar com cabelo e barba bem desenhados, contornos escuros, fundos de uma só
cor com poucos objetos, moedas e corações como efeitos. Para o offly, o equivalente seria o **low poly 3D**
que já decidimos, mantendo o mesmo esqueleto de câmara e de HUD.

---

## Vídeo A: a linguagem (o que é para copiar)

**Números medidos:** 155 palavras em 69 s (cerca de **134 palavras por minuto**), 28 frases, cerca de
**5,5 palavras por frase**.

### Regras

1. **Frases telegráficas, sem verbo de ligação:** "Leu a conversa inteira. Nada." / "Primeira ideia, urso de R$ 89."
   Uma ideia por frase, sem "porque" nem "então".
2. **Números concretos em vez de adjetivos:** "R$ 4,20 para R$ 1.504", "10 segundos", "11 mensagens", "4 minutos".
   O número faz a piada e prova ao mesmo tempo.
3. **Pretérito e presente narrativo, terceira pessoa:** "Ele não conseguiu dormir. Foi correr." Um narrador
   que observa, sem sermão.
4. **Humor seco (deadpan):** o drama é dito sem emoção. "Colar de ouro, ficou verde." A graça vem do contraste.
5. **A voz fala com o público no plural:** "Vocês escolheram o presente." Cria comunidade.
6. **Uma frase-citação emocional por vídeo**, no ponto alto: "Ninguém nunca fez isso por mim." É a única
   frase sentimental e por isso pesa.
7. **Gancho no segundo 1 sem contexto:** começa pela imagem, o contexto vem depois.
8. **CTA em duas camadas:** 1) pergunta de participação ("Corrida ou restaurante? Comenta uma palavra."),
   2) pedido comercial, no fim e curto.

### Para o ElevenLabs (voz do vídeo A)

- Voz masculina jovem, direta, **sem entusiasmo de locutor**; sorriso pequeno na voz, não gritado.
- Ritmo médio (cerca de 134 ppm) com **frases a acabar em queda** (ponto final), sem subir no fim.
- Pausa curta (0,3 s) depois de cada ponto; pausa de 0,6 s antes da piada ("Colar de ouro, [pausa] ficou verde").
- A frase emocional ("Ninguém nunca fez isso por mim") sai mais baixa e mais lenta, como citação.

---

## Vídeo B: o vídeo Dreamcore da @acordejaa

### Estrutura

| Tempo | O que acontece |
|---|---|
| 0 a 23 s | Só música, sem texto. Imagens de um vídeo "satisfatório" (alguém pega num bloco de gelo e atira-o). |
| 23 a 34 s | Texto em letra pixelizada, branca, sobre imagens degradadas: "Meus parabéns, seu cérebro está no piloto automático. É isso que você quer ser? Só mais um zumbi que rola a tela atrás de dopamina? Por que, em vez de desperdiçar a sua vida assim, você só não..." |
| 34 a 36 s | "Acorda!", olho a abrir em fundo preto e "Nos siga para fugir do algoritmo". |

### O que funciona

- **Identidade fortíssima:** letra pixelizada, imagem granulada, música de memória, marca de água
  @acordejaa. Reconhece-se à primeira vista.
- **A virada final é boa:** a frase fica em suspenso ("você só não...") e o "Acorda!" corta a seco. O olho a
  abrir no fim é um selo de marca (liga ao nome e ao Offy).
- **Voz direta com segunda pessoa** ("seu cérebro", "você quer ser"): fala com a pessoa, não sobre ela.
- **Prova com ar de ciência:** o excerto de um artigo (Frontiers, uso excessivo de smartphone em adolescentes)
  dá peso visual ao argumento.

### O que atrapalha (na minha leitura, sem métricas)

1. **Os primeiros 23 s são só um vídeo sem relação com a mensagem.** A maioria das pessoas decide em 2 a 3 s se
   fica. Se o texto só aparece aos 23 s, grande parte já saiu. É o maior problema deste vídeo.
2. **O tom insulta em vez de acolher:** "zumbi", "desperdiçar a sua vida". Quem está preso ao telemóvel já
   sente culpa; o vídeo A mostra que o público fica mais com o tom de quem observa com humor do que de quem
   julga. Para o offly, a promessa é ajuda, não vergonha.
3. **O argumento científico é mais fraco do que parece:** o artigo mostrado é um estudo pequeno de
   associação (o excerto destacado fala de sintomas associados ao uso excessivo). Convém não afirmar que
   o telemóvel "causa" o problema nem que "o cérebro está no piloto automático" como facto clínico.
4. **Não diz o que fazer:** "Acorda!" não leva a um passo concreto. O CTA é seguir a conta, e não o app.
5. **O vídeo de fundo parece material de terceiros** (um vídeo viral de gelo). Para uma marca, é mais seguro usar
   imagens próprias ou licenciadas.

---

## Como juntar os dois no offly

A ideia é manter o **Dreamcore como assinatura** (grão, pixel, música, olho, Offy) e usar a **estrutura do vídeo A
para os vídeos de história** (HUD, série, escolha do público, números, frases curtas).

### Esqueleto da série do Pedro (low poly 3D)

- **HUD fixo:** "DIA 3 DE 30" e "CONTROLO 42%" (sobe e desce com as vitórias e as recaídas).
- **Primeiros 2 s:** imagem forte sem contexto. Ex.: o Pedro com o dedo a meio centímetro do ecrã, às 3 da manhã.
- **Aposta clara em 6 s:** "O Pedro tem 30 dias para dormir antes das 23h."
- **Regra de três:** duas tentativas que falham com humor seco, a terceira pequena e pessoal.
- **Número concreto em cada cena:** "3h12 de ecrã", "4 minutos", "11 notificações".
- **Final em suspensão:** a recaída ou o novo desafio vira o gancho do próximo episódio.
- **Escolha do público:** "Comenta uma palavra: Corrida ou Cama?" decide o episódio seguinte.
- **Selo Dreamcore no fim:** o olho que abre e o Offy ao fundo.

### Primeiros 20 s da narração com a linguagem do vídeo A

> O Pedro dormiu duas horas. [pausa] O Pedro tem 30 dias para dormir antes das onze.
> Primeiro dia, [pausa] ele abre o telemóvel às 3 da manhã. Só para ver as horas.
> Três horas e doze minutos depois, [pausa] ainda são "só as horas".
> Primeira ideia, esconder o telemóvel na gaveta. [pausa curta] Ele abriu a gaveta.

(O tom é seco e observador. A emoção só entra na frase de citação, perto do fim.)

### Guião do tom para o ElevenLabs (resumo)

| Momento | Tom | Ritmo | Como escrever |
|---|---|---|---|
| Gancho | Seco, calmo | Normal | 1 frase, sem verbo de ligação |
| Piada | Deadpan | Pausa de 0,6 s antes do remate | Número concreto no fim |
| Recaída | Baixo, sem julgar | Mais lento | Frase curta e silêncio depois |
| Citação emocional | Quase sussurro | Lento | Uma só por vídeo |
| CTA | Normal, simpático | Rápido | Pergunta ao público primeiro |

---

## O que ainda falta definir

1. **Qual o vídeo principal a fazer primeiro:** a introdução do Pedro, com história e HUD (formato A).
2. **Quem narra:** voz de fora (como no A) ou o Pedro na primeira pessoa.
3. **Língua:** pt-BR ou pt-PT.
4. **Nome e cara do HUD:** sugiro "DIA X DE 30" e "CONTROLO %", mas é a marca que decide.
