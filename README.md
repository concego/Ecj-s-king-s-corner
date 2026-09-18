# ECJ King's Corner

Versão web, solo e bilíngue de **Kings in the Corner**, criada pela Equipe Euconcegojogar.

- Teste online: [GitHub Pages](https://concego.github.io/Ecj-s-king-s-corner/)
- Release atual: [v0.1.0](https://github.com/concego/Ecj-s-king-s-corner/releases/tag/v0.1.0)

O projeto começa com uma partida clássica, controles por teclado e cartas desenhadas como SVG inline. A interface é desenvolvida com foco em **WCAG 2.2 nível AA**, sem depender de cor, som, mouse ou arrastar e soltar para transmitir ou executar uma ação.

## Estado atual

- Seleção inicial de idioma: Português (Brasil) e English.
- Menu inicial com iniciar jogo, opções e créditos.
- Opções de idioma, sons, alto contraste, texto ampliado e redução de movimento.
- Menu de jogo com continuar jogo e iniciar novo jogo.
- Seleção do estilo clássico.
- Tabuleiro funcional para a base do Kings in the Corner: mão, monte, quatro pilhas principais, quatro cantos, movimentos, compra, desfazer e salvamento local.
- Sons procedurais originais em WAV, gerados pelo script Python em `tools/generate_sounds.py`.
- Seção de ajuda acessível pela tecla `H`, com instruções separadas para teclado e dispositivos móveis.
- Layout móvel responsivo com headings de navegação, seção atual e seleção rápida entre Tabuleiro, Mão e Controles.

## Controles

### Teclado

- `Tab`: alterna entre a mão e o tabuleiro.
- Setas: navegam pelas cartas da mão e pelas posições do tabuleiro.
- `Enter`: seleciona ou troca uma carta da mão; joga cartas e move pilhas no tabuleiro; compra no monte.
- `Ctrl+Z`: desfaz a última jogada.
- `Escape`: cancela uma seleção ou retorna ao menu.
- `H`: abre a ajuda.

### Dispositivo móvel

- Toque duplo em cartas da mão, no monte e nas pilhas do tabuleiro para interagir.
- Os botões **Tabuleiro**, **Mão** e **Controles** trocam rapidamente de seção.
- **Controles** oferece voltar ao menu principal, abrir a ajuda e desfazer.

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

- landmarks e headings semânticos;
- foco visível e navegação principal por setas;
- no jogo, Tab alterna exclusivamente entre a mão e o tabuleiro;
- Enter seleciona cartas da mão ou joga no destino atualmente focado;
- Enter no monte de compra compra uma carta;
- H abre a seção de ajuda;
- a pilha focada é anunciada pela posição e pela carta ou intervalo de cartas;
- as setas param nas bordas do tabuleiro, sem autowrap;
- Escape retorna ao menu e Ctrl+Z desfaz;
- alternativa à interação por arrastar e soltar;
- anúncios de estado com `aria-live`;
- textos alternativos para cartas e pilhas;
- opção de alto contraste;
- opção de texto ampliado;
- opção de redução de movimento;
- sons opcionais, nunca usados como único feedback;
- diferenciação das cartas por valor, naipe, texto e cor;
- layout responsivo para diferentes tamanhos de tela;
- no celular, navegação rápida por headings e seletor de três seções: tabuleiro, mão e controles, com botões para voltar, ajuda e desfazer.

## Créditos

- **Equipe Euconcegojogar**
- Inspirado nos jogos de cartas da **GMA Games**.
- Contato: [euconcego@gmail.com](mailto:euconcego@gmail.com)

Este projeto é uma criação independente e não é afiliado à GMA Games.
