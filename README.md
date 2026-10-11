# ECJ King's Corner

Versão web bilíngue e acessível de **Kings in the Corner**, criada pela Equipe Euconcegojogar.

- Teste online: [GitHub Pages](https://concego.github.io/Ecj-s-king-s-corner/)
- Release atual: [v0.2.0 — pré-release](https://github.com/concego/Ecj-s-king-s-corner/releases/tag/v0.2.0)

O jogo oferece três modos:

- **Treino solo**: pratique sem pontuação.
- **Record solo**: jogue uma partida pontuada e busque uma das três maiores marcas do Mural local.
- **Jogar contra bots**: enfrente de um a três adversários controlados pelo jogo. Você começa; não há moedas.

O objetivo das partidas é esvaziar a mão. A pontuação mede o desempenho, mas não determina o vencedor: alguém que perdeu pode terminar com mais pontos que quem venceu.

## Estado atual

- Interface em Português (Brasil) e English.
- Menu inicial com iniciar jogo, Mural, opções e créditos.
- Opções de idioma, sons, alto contraste, texto ampliado e redução de movimento.
- **Cachorro** é o bot mais fácil e distraído; **Leão** prioriza jogadas que dão mais pontos; **Raposa** é a mais difícil e busca deixar mais cartas jogáveis em seguida.
- Os bots só movem pilhas quando isso abre uma jogada com carta. Nas partidas contra bots, o bloqueio é detectado quando o monte acaba e ninguém consegue jogar cartas: é imediato se não houver movimento legal de pilha; caso contrário, ocorre após três rodadas completas sem cartas jogadas.
- Pontuação unificada nos modos Record solo e contra bots:
  - Jogar uma carta soma seu valor.
  - Comprar uma carta comum subtrai seu valor; comprar um Rei não desconta pontos. Jogar depois a carta comprada soma seu valor.
  - Mover um Rei do tabuleiro para um canto vazio soma +13 uma única vez por Rei.
  - Uma jogada inválida confirmada subtrai 3 pontos.
  - Mover uma pilha de pelo menos duas cartas para uma pilha ocupada soma 5 pontos.
  - Repetir o retorno exato de uma carta ou pilha subtrai 5 pontos.
  - Desfazer subtrai 10 pontos nos modos em que o recurso está disponível; desfazer fica desativado contra bots.
  - Vencer soma 10 pontos; perder ou ficar bloqueado subtrai 5.
- Nas partidas contra bots, cada participante tem sua própria pontuação. O Mural registra a pontuação final do jogador; os recordes antigos são adaptados ao sistema unificado.
- Mural acessível com as três maiores pontuações dos modos pontuados, salvo localmente neste dispositivo.
- Cartas desenhadas como SVG inline. A interface usa WCAG 2.2 AA como referência e não depende de cor, som, mouse ou arrastar e soltar para transmitir ou executar uma ação.
- Pilhas movimentadas preservam todas as cartas. Anúncios informam a primeira e a última carta e a quantidade total.
- Sons procedurais originais em WAV, gerados pelo script Python em `tools/generate_sounds.py`.
- Layout móvel responsivo com headings de navegação, seção atual e seleção rápida entre Tabuleiro, Mão e Controles.

## Controles

### Teclado

- `Tab`: alterna entre a mão e o tabuleiro.
- Setas: navegam pelas cartas da mão e pelas posições do tabuleiro, sem autowrap nas bordas.
- `Enter`: seleciona ou troca uma carta da mão; joga uma carta ou move uma pilha no tabuleiro; compra no monte.
- `Ctrl+Z`: desfaz a última jogada nos modos solo. Desfazer não está disponível contra bots.
- `Escape`: cancela uma seleção ou retorna ao menu principal.
- `H`: abre a ajuda.
- `S`: consulta a pontuação no Record solo ou na partida contra bots.
- `N`: passa a vez contra bots. Antes, faça uma jogada válida ou compre uma carta.

### Dispositivo móvel

- Toque duplo em cartas da mão, no monte e nas pilhas do tabuleiro para interagir.
- Os botões **Tabuleiro**, **Mão** e **Controles** trocam rapidamente de seção.
- Em uma partida contra bots, **Controles** oferece passar a vez. Também há opções para voltar ao menu e abrir a ajuda.
- Desfazer fica desativado durante partidas contra bots.

## Executar localmente

Como o projeto usa módulos JavaScript, sirva a pasta por um servidor HTTP local. Por exemplo:

```bash
python3 -m http.server 8000
```

Depois, abra `http://localhost:8000`.

## Gerar os sons

```bash
python3 tools/generate_sounds.py
```

O script usa apenas a biblioteca padrão do Python (`wave`, `math` e `struct`). Os sons são originais e foram gerados para este projeto; não há arquivos de áudio de terceiros.

## Acessibilidade

O projeto adota WCAG 2.2 AA como referência técnica. A interface inclui:

- Landmarks e headings semânticos.
- Foco visível e navegação principal por setas.
- No jogo, `Tab` alterna exclusivamente entre a mão e o tabuleiro.
- `Enter` seleciona cartas da mão ou joga no destino focado; no monte, compra uma carta.
- `H` abre a ajuda; `S` consulta a pontuação; `N` passa a vez contra bots.
- A pilha focada é anunciada pela posição e pela carta ou pelo intervalo de cartas.
- As setas param nas bordas do tabuleiro, sem autowrap.
- `Escape` retorna ao menu e `Ctrl+Z` desfaz nos modos solo.
- Alternativas à interação por arrastar e soltar e anúncios de estado com `aria-live`.
- Textos alternativos para cartas e pilhas.
- Opções de alto contraste, texto ampliado e redução de movimento.
- Sons opcionais, nunca usados como único feedback.
- Cartas diferenciadas por valor, naipe, texto e cor.
- Layout responsivo. No celular, a navegação rápida alterna entre Tabuleiro, Mão e Controles.

## Créditos

- **Equipe Euconcegojogar**
- Inspirado nos jogos de cartas da **GMA Games**.
- Contato: [euconcego@gmail.com](mailto:euconcego@gmail.com)

Este projeto é uma criação independente e não é afiliado à GMA Games.
