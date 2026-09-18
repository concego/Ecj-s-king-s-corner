const SUITS = [
  { id: 'clubs', symbol: '♣', pt: 'paus', en: 'clubs', color: 'black' },
  { id: 'diamonds', symbol: '♦', pt: 'ouros', en: 'diamonds', color: 'red' },
  { id: 'hearts', symbol: '♥', pt: 'copas', en: 'hearts', color: 'red' },
  { id: 'spades', symbol: '♠', pt: 'espadas', en: 'spades', color: 'black' },
];

const RANKS = [
  { value: 1, pt: 'Ás', en: 'Ace', short: 'A' },
  { value: 2, pt: '2', en: '2', short: '2' },
  { value: 3, pt: '3', en: '3', short: '3' },
  { value: 4, pt: '4', en: '4', short: '4' },
  { value: 5, pt: '5', en: '5', short: '5' },
  { value: 6, pt: '6', en: '6', short: '6' },
  { value: 7, pt: '7', en: '7', short: '7' },
  { value: 8, pt: '8', en: '8', short: '8' },
  { value: 9, pt: '9', en: '9', short: '9' },
  { value: 10, pt: '10', en: '10', short: '10' },
  { value: 11, pt: 'Valete', en: 'Jack', short: 'J' },
  { value: 12, pt: 'Dama', en: 'Queen', short: 'Q' },
  { value: 13, pt: 'Rei', en: 'King', short: 'K' },
];

export const SUIT_BY_ID = Object.fromEntries(SUITS.map((suit) => [suit.id, suit]));
export const RANK_BY_VALUE = Object.fromEntries(RANKS.map((rank) => [rank.value, rank]));

export function cardName(card, locale = 'pt-BR') {
  const suit = SUIT_BY_ID[card.suit];
  const rank = RANK_BY_VALUE[card.rank];
  return `${locale === 'pt-BR' ? rank.pt : rank.en} ${suit.symbol}`;
}

export function cardAccessibleName(card, locale = 'pt-BR') {
  const suit = SUIT_BY_ID[card.suit];
  const rank = RANK_BY_VALUE[card.rank];
  const suitName = locale === 'pt-BR' ? suit.pt : suit.en;
  const rankName = locale === 'pt-BR' ? rank.pt : rank.en;
  return `${rankName} de ${suitName}`;
}

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit.id}-${rank.value}`, suit: suit.id, rank: rank.value });
    }
  }
  return deck;
}

export function shuffle(deck, random = Math.random) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createGame(modeOrRandom = 'training', maybeRandom = Math.random) {
  // Keep the old createGame(random) signature while allowing createGame(mode, random).
  const mode = typeof modeOrRandom === 'string' ? modeOrRandom : 'training';
  const random = typeof modeOrRandom === 'function' ? modeOrRandom : maybeRandom;
  const deck = shuffle(createDeck(), random);
  return {
    mode,
    hand: deck.splice(0, 7),
    stock: deck,
    foundations: [deck.splice(0, 1), deck.splice(0, 1), deck.splice(0, 1), deck.splice(0, 1)],
    corners: [[], [], [], []],
    moves: 0,
    draws: 0,
    status: 'playing',
    score: 0,
    usedCardPoints: 0,
    drawnCardPoints: 0,
    invalidMoves: 0,
    stackBonuses: 0,
    cyclePenalties: 0,
    undoCount: 0,
    resultAwarded: false,
    scoreSaved: false,
    moveLog: [],
  };
}

export function cloneGame(game) {
  return JSON.parse(JSON.stringify(game));
}

export function topCard(pile) {
  return pile.length ? pile[pile.length - 1] : null;
}

export function canPlaceCard(card, targetPile, targetType = 'foundation') {
  const target = topCard(targetPile);
  if (!target) return targetType === 'foundation' || card.rank === 13;
  const targetSuit = SUIT_BY_ID[target.suit];
  const cardSuit = SUIT_BY_ID[card.suit];
  return target.rank === card.rank + 1 && targetSuit.color !== cardSuit.color;
}

export function canMoveStack(sourcePile, targetPile, targetType = 'foundation') {
  const first = sourcePile[0];
  return Boolean(first) && canPlaceCard(first, targetPile, targetType);
}

export function sourcePile(game, source) {
  if (source.zone === 'foundation') return game.foundations[source.index];
  if (source.zone === 'corner') return game.corners[source.index];
  return game.hand;
}

export function destinationPile(game, destination) {
  if (destination.zone === 'foundation') return game.foundations[destination.index];
  return game.corners[destination.index];
}

export function destinationType(destination) {
  return destination.zone === 'corner' ? 'corner' : 'foundation';
}

export function moveSelected(game, source, destination) {
  const sourceIsHand = source.zone === 'hand';
  const sourceArray = sourcePile(game, source);
  const targetArray = destinationPile(game, destination);
  if (source.zone === destination.zone && source.index === destination.index) return false;
  if (!sourceArray.length) return false;
  // Copy board piles before clearing the source; otherwise splice() would also empty moving.
  const moving = sourceIsHand ? [sourceArray[source.index]] : [...sourceArray];
  if (!canMoveStack(moving, targetArray, destinationType(destination))) return false;

  if (sourceIsHand) sourceArray.splice(source.index, 1);
  else sourceArray.splice(0, sourceArray.length);
  targetArray.push(...moving);
  game.moves += 1;
  if (game.hand.length === 0) game.status = 'won';
  return true;
}

export function drawCard(game) {
  if (!game.stock.length || game.status !== 'playing') return null;
  const card = game.stock.pop();
  game.hand.push(card);
  game.draws += 1;
  return card;
}

export function hasLegalHandMove(game) {
  return game.hand.some((card) => {
    return [...game.foundations, ...game.corners].some((pile, index) => {
      const type = index >= game.foundations.length ? 'corner' : 'foundation';
      return canPlaceCard(card, pile, type);
    });
  });
}

export function hasLegalPileMove(game) {
  const piles = [
    ...game.foundations.map((pile, index) => ({ pile, zone: 'foundation', index })),
    ...game.corners.map((pile, index) => ({ pile, zone: 'corner', index })),
  ];
  return piles.some((source) => source.pile.length > 0 && piles.some((target) => {
    if (source.zone === target.zone && source.index === target.index) return false;
    return canMoveStack(source.pile, target.pile, target.zone);
  }));
}

export function updateBlockedStatus(game) {
  if (game.status !== 'playing') return;
  if (!game.stock.length && !hasLegalHandMove(game) && !hasLegalPileMove(game)) game.status = 'blocked';
}
