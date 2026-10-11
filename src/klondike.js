import { createDeck, shuffle, SUIT_BY_ID } from './game.js';

export const KLONDIKE_SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
export const KLONDIKE_DRAW_CHOICES = [1, 3];

function suitColor(card) {
  return SUIT_BY_ID[card.suit]?.color || 'black';
}

export function createKlondikeGame({ drawCount = 3, random = Math.random } = {}) {
  const selectedDrawCount = KLONDIKE_DRAW_CHOICES.includes(Number(drawCount)) ? Number(drawCount) : 3;
  const deck = shuffle(createDeck(), random);
  const tableau = [];
  for (let column = 0; column < 7; column += 1) {
    const pile = deck.splice(0, column + 1);
    pile.forEach((card, index) => { card.faceUp = index === pile.length - 1; });
    tableau.push(pile);
  }
  deck.forEach((card) => { card.faceUp = false; });
  return {
    mode: 'klondike',
    drawCount: selectedDrawCount,
    stock: deck,
    waste: [],
    foundations: KLONDIKE_SUITS.map((suit) => ({ suit, cards: [] })),
    tableau,
    moves: 0,
    draws: 0,
    status: 'playing',
  };
}

export function cloneKlondikeGame(game) {
  return JSON.parse(JSON.stringify(game));
}

export function klondikeCardName(card, locale = 'pt-BR') {
  if (!card) return '';
  const suit = SUIT_BY_ID[card.suit];
  const rank = {
    1: locale === 'pt-BR' ? 'Ás' : 'Ace',
    11: locale === 'pt-BR' ? 'Valete' : 'Jack',
    12: locale === 'pt-BR' ? 'Dama' : 'Queen',
    13: locale === 'pt-BR' ? 'Rei' : 'King',
  }[card.rank] || String(card.rank);
  const suitName = locale === 'pt-BR' ? suit?.pt : suit?.en;
  return locale === 'pt-BR' ? `${rank} de ${suitName || card.suit}` : `${rank} of ${suitName || card.suit}`;
}

export function tableauFaceUpStart(pile) {
  const index = pile.findIndex((card) => card.faceUp);
  return index < 0 ? pile.length : index;
}

export function isValidKlondikeSequence(cards) {
  if (!Array.isArray(cards) || !cards.length || cards.some((card) => !card.faceUp)) return false;
  for (let index = 1; index < cards.length; index += 1) {
    const lower = cards[index];
    const upper = cards[index - 1];
    if (upper.rank !== lower.rank + 1 || suitColor(upper) === suitColor(lower)) return false;
  }
  return true;
}

export function canPlaceKlondikeOnTableau(cards, targetPile) {
  if (!isValidKlondikeSequence(cards)) return false;
  const first = cards[0];
  const target = targetPile[targetPile.length - 1];
  if (!target) return first.rank === 13;
  return target.rank === first.rank + 1 && suitColor(target) !== suitColor(first);
}

export function canPlaceKlondikeOnFoundation(card, foundation) {
  if (!card || !foundation || card.suit !== foundation.suit) return false;
  const top = foundation.cards[foundation.cards.length - 1];
  return top ? card.rank === top.rank + 1 : card.rank === 1;
}

export function drawKlondikeStock(game) {
  if (!game || game.mode !== 'klondike' || game.status !== 'playing') return { changed: false, action: 'none', count: 0 };
  if (game.stock.length) {
    const count = Math.min(game.drawCount, game.stock.length);
    for (let index = 0; index < count; index += 1) {
      const card = game.stock.pop();
      card.faceUp = true;
      game.waste.push(card);
    }
    game.draws += 1;
    game.moves += 1;
    return { changed: true, action: 'draw', count };
  }
  if (!game.waste.length) return { changed: false, action: 'empty', count: 0 };
  while (game.waste.length) {
    const card = game.waste.pop();
    card.faceUp = false;
    game.stock.push(card);
  }
  game.moves += 1;
  return { changed: true, action: 'recycle', count: game.stock.length };
}

function sourceCards(game, source) {
  if (source.zone === 'waste') {
    return game.waste.length && source.index === game.waste.length - 1 ? [game.waste[source.index]] : [];
  }
  if (source.zone === 'foundation') {
    const pile = game.foundations[source.index]?.cards || [];
    return pile.length && source.indexCard === pile.length - 1 ? [pile[source.indexCard]] : [];
  }
  if (source.zone === 'tableau') {
    const pile = game.tableau[source.index] || [];
    if (source.indexCard < tableauFaceUpStart(pile) || source.indexCard >= pile.length) return [];
    return pile.slice(source.indexCard);
  }
  return [];
}

function removeSourceCards(game, source, count) {
  if (source.zone === 'waste') return game.waste.splice(source.index, count);
  if (source.zone === 'foundation') return game.foundations[source.index].cards.splice(source.indexCard, count);
  if (source.zone === 'tableau') {
    const pile = game.tableau[source.index];
    const moving = pile.splice(source.indexCard, count);
    const top = pile[pile.length - 1];
    if (top && !top.faceUp) top.faceUp = true;
    return moving;
  }
  return [];
}

export function moveKlondikeCards(game, source, destination) {
  if (!game || game.mode !== 'klondike' || game.status !== 'playing' || !source || !destination) return false;
  if (source.zone === destination.zone && source.index === destination.index && source.indexCard === destination.indexCard) return false;
  const cards = sourceCards(game, source);
  if (!cards.length || !isValidKlondikeSequence(cards)) return false;
  if (destination.zone === 'tableau') {
    const target = game.tableau[destination.index];
    if (!target || !canPlaceKlondikeOnTableau(cards, target)) return false;
    const moving = removeSourceCards(game, source, cards.length);
    target.push(...moving);
  } else if (destination.zone === 'foundation') {
    if (cards.length !== 1) return false;
    const target = game.foundations[destination.index];
    if (!canPlaceKlondikeOnFoundation(cards[0], target)) return false;
    const moving = removeSourceCards(game, source, 1);
    target.cards.push(...moving);
  } else {
    return false;
  }
  game.moves += 1;
  if (game.foundations.every((foundation) => foundation.cards.length === 13)) game.status = 'won';
  return true;
}

export function klondikeSourceCards(game, source) {
  return sourceCards(game, source);
}
