# ECJ King's Corner

Versão web, solo e bilíngue de **Kings in the Corner**, criada pela Equipe Euconcegojogar.

O projeto começa com uma partida clássica, controles por teclado e cartas desenhadas como SVG inline. A interface é desenvolvida com foco em **WCAG 2.2 nível AA**, sem depender de cor, som, mouse ou arrastar e soltar para transmitir ou executar uma ação.

## Estado atual

- Seleção inicial de idioma: Português (Brasil) e English.
- Menu inicial com iniciar jogo, opções e créditos.
- Opções de idioma, sons, alto contraste, texto ampliado e redução de movimento.
- Menu de jogo com continuar jogo e iniciar novo jogo.
- Seleção do estilo clássico.
- Tabuleiro funcional para a base do Kings in the Corner: mão, monte, quatro pilhas principais, quatro cantos, movimentos, compra, desfazer e salvamento local.
- Sons procedurais originais em WAV, gerados pelo script Python em `tools/generate_sounds.py`.

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
- a pilha focada é anunciada pela posição e pela carta ou intervalo de cartas;
- Enter no monte de compra compra uma carta;
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
- layout responsivo para diferentes tamanhos de tela.

## Créditos

- **Equipe Euconcegojogar**
- Inspirado nos jogos de cartas da **GMA Games**.
- Contato: [euconcego@gmail.com](mailto:euconcego@gmail.com)

Este projeto é uma criação independente e não é afiliado à GMA Games.
