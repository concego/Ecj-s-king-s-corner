import { getText } from './i18n.js?v=bot-turn-action-2';
import { playSound, setAudioEnabled } from './audio.js';
import {
  RANK_BY_VALUE,
  SUIT_BY_ID,
  cardAccessibleName,
  createGame,
  cloneGame,
  moveSelected,
  drawCard,
  canPlaceCard,
  canMoveStack,
  hasLegalHandMove,
  hasLegalPileMove,
  updateBlockedStatus,
} from './game.js';

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const SAVED_GAME_KEY = 'ecj-kings-corner-game';
const SETTINGS_KEY = 'ecj-kings-corner-settings';
const SCOREBOARD_KEY = 'ecj-kings-corner-scoreboard';

let locale = localStorage.getItem('ecj-kings-corner-locale');
let settings = loadSettings();
let screen = locale ? 'menu' : 'language';
let previousScreen = 'menu';
let game = loadGame();
let history = [];
let selected = null;
let handFocusIndex = 0;
let boardFocus = { row: 1, column: 1 };
let mobileSection = 'board';
let selectedBotIds = loadSelectedBots();

function loadSelectedBots() {
  try {
    const saved = JSON.parse(localStorage.getItem('ecj-kings-corner-selected-bots') || '[]');
    return Array.isArray(saved) ? saved.filter((id) => ['lion', 'dog', 'fox'].includes(id)) : [];
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    return {
      soundEnabled: true,
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    };
  } catch {
    return { soundEnabled: true, highContrast: false, largeText: false, reducedMotion: false };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  setAudioEnabled(settings.soundEnabled);
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_GAME_KEY) || 'null');
    if (!saved?.hand || !saved?.stock || !saved?.foundations || !saved?.corners) return null;
    return {
      mode: 'training', score: 0, usedCardPoints: 0, drawnCardPoints: 0,
      invalidMoves: 0, stackBonuses: 0, cyclePenalties: 0, undoCount: 0,
      resultAwarded: false, scoreSaved: false, scoredKingIds: [], moveLog: [], turnActionCount: 0, ...saved,
    };
  } catch {
    return null;
  }
}

function saveGame() {
  if (game) localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(game));
}

function t(key, ...args) { return getText(locale || 'pt-BR', key, ...args); }

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
}

function announce(message, sound = null) {
  status.textContent = message;
  if (sound) playSound(sound);
}

function applySettings() {
  document.body.classList.toggle('high-contrast', settings.highContrast);
  document.body.classList.toggle('large-text', settings.largeText);
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  setAudioEnabled(settings.soundEnabled);
}

function cardSvg(card, back = false) {
  if (back) {
    return `<svg class="card-svg" viewBox="0 0 120 168" role="presentation" aria-hidden="true" focusable="false"><rect x="2" y="2" width="116" height="164" rx="8" fill="#174d70" stroke="#17212b" stroke-width="4"/><rect x="12" y="12" width="96" height="144" rx="5" fill="none" stroke="#ffffff" stroke-width="3"/><path d="M20 84h80M60 20v128" stroke="#ffffff" stroke-width="2" opacity=".8"/></svg>`;
  }
  const suit = SUIT_BY_ID[card.suit];
  const rank = RANK_BY_VALUE[card.rank];
  const tone = suit.color === 'red' ? 'card-red' : 'card-black';
  return `<svg class="card-svg" viewBox="0 0 120 168" role="presentation" aria-hidden="true" focusable="false"><rect x="2" y="2" width="116" height="164" rx="8" fill="#ffffff" stroke="#17212b" stroke-width="4"/><text class="${tone}" x="14" y="31" font-size="22">${escapeHtml(rank.short)}</text><text class="${tone}" x="14" y="54" font-size="22">${suit.symbol}</text><text class="${tone}" x="60" y="105" text-anchor="middle" font-size="52">${suit.symbol}</text><text class="${tone}" x="106" y="148" text-anchor="end" font-size="22" transform="rotate(180 106 148)">${escapeHtml(rank.short)} ${suit.symbol}</text></svg>`;
}

function screenShell(title, lead, content, narrow = true) {
  return `<div class="screen${narrow ? ' narrow' : ''}"><header><h1>${escapeHtml(title)}</h1>${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ''}</header>${content}</div>`;
}

function button(label, action, extra = '') {
  return `<button type="button" data-action="${action}" ${extra}>${escapeHtml(label)}</button>`;
}

function renderLanguage() {
  app.innerHTML = screenShell(t('languageTitle'), t('languageLead'), `<div class="panel button-list" aria-label="${escapeHtml(t('languageTitle'))}">
    ${button('Português (Brasil)', 'choose-language', 'data-locale="pt-BR"')}
    ${button('English', 'choose-language', 'data-locale="en"')}
  </div>`);
}

function renderMenu() {
  app.innerHTML = screenShell(t('menuTitle'), t('menuLead'), `<div class="panel button-list" aria-label="${escapeHtml(t('menuTitle'))}">
    ${button(t('startGame'), 'menu-start')}
    ${button(t('mural'), 'menu-mural', 'class="secondary"')}
    ${button(t('help'), 'menu-help', 'class="secondary"')}
    ${button(t('options'), 'menu-options', 'class="secondary"')}
    ${button(t('credits'), 'menu-credits', 'class="secondary"')}
    <p><strong>${escapeHtml(t('contact'))}:</strong> <a href="mailto:euconcego@gmail.com">euconcego@gmail.com</a></p>
  </div>`);
}

function toggleButton(key, label) {
  const on = settings[key];
  const state = on ? t('enabled') : t('disabled');
  return button(state, `toggle-${key}`, `class="secondary" aria-pressed="${on}" aria-label="${escapeHtml(`${label}: ${state}`)}"`);
}

function renderOptions() {
  const setting = (title, description, control) => `<div class="setting"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></div>${control}</div>`;
  app.innerHTML = screenShell(t('options'), t('accessibilityTitle'), `<div class="panel">
    <div class="setting-list">
      ${setting(t('language'), locale === 'pt-BR' ? 'Português (Brasil)' : 'English', `<div class="inline-actions">${button('Português (Brasil)', 'choose-language', 'data-locale="pt-BR" class="secondary"')}${button('English', 'choose-language', 'data-locale="en" class="secondary"')}</div>`)}
      ${setting(t('sounds'), t('soundsDescription'), toggleButton('soundEnabled', t('sounds')))}
      ${setting(t('highContrast'), t('highContrastDescription'), toggleButton('highContrast', t('highContrast')))}
      ${setting(t('largeText'), t('largeTextDescription'), toggleButton('largeText', t('largeText')))}
      ${setting(t('reducedMotion'), t('reducedMotionDescription'), toggleButton('reducedMotion', t('reducedMotion')))}
    </div>
    <div class="button-list">${button(t('backMainMenu'), 'back-menu', 'class="secondary"')}</div>
  </div>`);
}

function renderCredits() {
  app.innerHTML = screenShell(t('creditsTitle'), '', `<div class="panel">
    <p><strong>${escapeHtml(t('teamCredit'))}</strong></p>
    <p>${escapeHtml(t('inspiredBy'))}</p>
    <p>${escapeHtml(t('independentProject'))}</p>
    <p><strong>${escapeHtml(t('contact'))}:</strong> <a href="mailto:euconcego@gmail.com">euconcego@gmail.com</a></p>
    <div class="button-list">${button(t('backMainMenu'), 'back-menu', 'class="secondary"')}</div>
  </div>`);
}

function renderHelp() {
  const keyboardList = ['helpKeyTab', 'helpKeyArrows', 'helpKeyEnter', 'helpKeyUndo', 'helpKeyEscape', 'helpKeyH', 'helpKeyScore', 'helpKeyPass']
    .map((key) => `<li>${escapeHtml(t(key))}</li>`).join('');
  const mobileList = ['helpMobileCards', 'helpMobileBoard', 'helpMobileStock', 'helpMobileSections']
    .map((key) => `<li>${escapeHtml(t(key))}</li>`).join('');
  app.innerHTML = screenShell(t('helpTitle'), '', `<div class="panel help-content">
    <section aria-labelledby="help-objective"><h2 id="help-objective">${escapeHtml(t('helpObjectiveHeading'))}</h2><p>${escapeHtml(t('helpObjective'))}</p></section>
    <section aria-labelledby="help-how"><h2 id="help-how">${escapeHtml(t('helpHowHeading'))}</h2><p>${escapeHtml(t('helpHow'))}</p></section>
    <section aria-labelledby="help-keys"><h2 id="help-keys">${escapeHtml(t('helpControlsHeading'))}</h2><h3>${escapeHtml(t('helpKeyboardHeading'))}</h3><ul>${keyboardList}</ul><h3>${escapeHtml(t('helpMobileHeading'))}</h3><ul>${mobileList}</ul></section>
    <section aria-labelledby="help-colors"><h2 id="help-colors">${escapeHtml(t('helpColorsHeading'))}</h2><p>${escapeHtml(t('helpColors'))}</p></section>
    <section aria-labelledby="help-record"><h2 id="help-record">${escapeHtml(t('helpRecordHeading'))}</h2><p>${escapeHtml(t('helpRecord'))}</p></section>
    <div class="button-list">${button(t('back'), 'back-help', 'class="secondary"')}</div>
  </div>`);
}

function renderGameMenu() {
  const disabled = game ? '' : 'disabled';
  const noSavedText = game ? '' : `<p class="legend">${escapeHtml(t('noSavedGame'))}</p>`;
  app.innerHTML = screenShell(t('gameMenuTitle'), '', `<div class="panel button-list">
    ${button(t('continueGame'), 'continue-game', disabled)}
    ${noSavedText}
    ${button(t('newGame'), 'new-game', 'class="secondary"')}
    ${button(t('backMainMenu'), 'back-menu', 'class="secondary"')}
  </div>`);
}

function renderNewGame() {
  app.innerHTML = screenShell(t('styleTitle'), '', `<div class="panel button-list">
    <fieldset>
      <legend><strong>${escapeHtml(t('styleTitle'))}</strong></legend>
      <div class="setting"><div><strong>${escapeHtml(t('classic'))}</strong><small>${escapeHtml(t('classicDescription'))}</small></div>${button(t('startClassic'), 'start-training')}</div>
      <div class="setting"><div><strong>${escapeHtml(t('recordSolo'))}</strong><small>${escapeHtml(t('recordSoloDescription'))}</small></div>${button(t('startRecordSolo'), 'start-record')}</div>
      <div class="setting"><div><strong>${escapeHtml(t('botsMode'))}</strong><small>${escapeHtml(t('botSelectionNote'))}</small></div>${button(t('botsMode'), 'open-bot-selection', 'class="secondary"')}</div>
    </fieldset>
    <div class="inline-actions">${button(t('back'), 'back-game-menu', 'class="secondary"')}</div>
  </div>`);
}

const BOT_IDS = ['lion', 'dog', 'fox'];

function renderBotSelection() {
  const options = BOT_IDS.map((id) => {
    const name = t(`bot${id[0].toUpperCase()}${id.slice(1)}`);
    const selectedNow = selectedBotIds.includes(id);
    const appearance = t(`bot${id[0].toUpperCase()}${id.slice(1)}Appearance`);
    const personality = t(`bot${id[0].toUpperCase()}${id.slice(1)}Personality`);
    const alt = t(`bot${id[0].toUpperCase()}${id.slice(1)}Alt`);
    return `<fieldset class="bot-option"><legend><strong>${escapeHtml(name)}</strong></legend><img class="bot-portrait" src="./assets/bots/${id}.webp" alt="" aria-hidden="true" role="presentation" width="240" height="240"><span class="sr-only" role="img" aria-label="${escapeHtml(alt)}"></span><p>${escapeHtml(personality)}</p><div class="inline-actions">${button(t('readBotAppearance', name, id), 'read-bot-appearance', `class="secondary" data-bot-id="${id}"`)}${button(selectedNow ? t('deselectBot', name) : t('selectBot', name), 'toggle-bot-selection', `class="${selectedNow ? '' : 'secondary'}" data-bot-id="${id}" aria-pressed="${selectedNow}"`)}</div></fieldset>`;
  }).join('');
  app.innerHTML = screenShell(t('botSelectionTitle'), t('botSelectionLead'), `<div class="panel bot-selection-list"><p class="legend">${escapeHtml(t('botSelectionCount', selectedBotIds.length))}</p>${options}<div class="inline-actions">${button(t('startBotMatch'), 'start-bot-match', `${selectedBotIds.length ? '' : 'disabled="disabled"'}`)}${button(t('back'), 'back-bot-selection', 'class="secondary"')}</div></div>`);
}

function toggleBotSelection(id) {
  if (!BOT_IDS.includes(id)) return;
  selectedBotIds = selectedBotIds.includes(id) ? selectedBotIds.filter((item) => item !== id) : [...selectedBotIds, id];
  localStorage.setItem('ecj-kings-corner-selected-bots', JSON.stringify(selectedBotIds));
  announce(t('botSelectionCount', selectedBotIds.length), 'confirm');
  render();
}

function readBotAppearance(id) {
  if (!BOT_IDS.includes(id)) return;
  const key = `bot${id[0].toUpperCase()}${id.slice(1)}Appearance`;
  announce(t(key));
}

function scoreboardEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(SCOREBOARD_KEY) || '[]');
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((entry) => Number.isFinite(Number(entry.score)))
      .sort((a, b) => Number(b.score) - Number(a.score))
      .slice(0, 3);
  } catch { return []; }
}

function scoreboardModeLabel(mode) {
  if (mode === 'record' || mode === 'Record solo' || mode === 'Solo record') return t('recordSolo');
  return mode || '';
}

function scoreboardResultLabel(result) {
  if (result === 'victory' || result === 'Vitória' || result === 'Victory') return t('scoreboardVictory');
  if (result === 'defeat' || result === 'Derrota' || result === 'Defeat') return t('scoreboardDefeat');
  return result || '';
}

function renderMural() {
  const entries = scoreboardEntries();
  const rows = entries.map((entry, index) => `<tr><th scope="row">${index + 1}</th><td>${escapeHtml(String(entry.score))}</td><td>${escapeHtml(scoreboardModeLabel(entry.mode))}</td><td>${escapeHtml(scoreboardResultLabel(entry.result))}</td></tr>`).join('');
  const table = entries.length ? `<div class="table-wrapper"><table><caption>${escapeHtml(t('scoreboardTitle'))}</caption><thead><tr><th scope="col">${escapeHtml(t('scoreboardPosition'))}</th><th scope="col">${escapeHtml(t('scoreboardPoints'))}</th><th scope="col">${escapeHtml(t('scoreboardMode'))}</th><th scope="col">${escapeHtml(t('scoreboardResult'))}</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p>${escapeHtml(t('scoreboardEmpty'))}</p>`;
  app.innerHTML = screenShell(t('scoreboardTitle'), t('scoreboardLead'), `<div class="panel">${table}<div class="button-list">${button(t('backToMenu'), 'back-menu', 'class="secondary"')}</div></div>`);
}

function boardPileAt(row, column) {
  const cells = {
    '0-0': { zone: 'corner', index: 0 },
    '0-1': { zone: 'foundation', index: 0 },
    '0-2': { zone: 'corner', index: 1 },
    '1-0': { zone: 'foundation', index: 3 },
    '1-2': { zone: 'foundation', index: 1 },
    '2-0': { zone: 'corner', index: 3 },
    '2-1': { zone: 'foundation', index: 2 },
    '2-2': { zone: 'corner', index: 2 },
  };
  const source = cells[`${row}-${column}`];
  if (!source) return null;
  return source.zone === 'foundation' ? game.foundations[source.index] : game.corners[source.index];
}

function pileButton(zone, index, name, pile, areaClass, row, column) {
  const top = pile[pile.length - 1];
  const isSelected = selected?.zone === zone && selected?.index === index;
  const isFocused = boardFocus.row === row && boardFocus.column === column;
  const label = boardCellAnnouncement(row, column);
  return `<div class="pile-button ${areaClass}${isSelected ? ' selected' : ''}${isFocused ? ' focused' : ''}${top ? '' : ' empty'}" role="gridcell" id="board-cell-${row}-${column}" data-action="select-pile" data-zone="${zone}" data-index="${index}" data-row="${row}" data-column="${column}" aria-selected="${isSelected}" aria-label="${escapeHtml(label)}">
    ${top ? cardSvg(top) : `<span>${escapeHtml(t('emptyPile'))}</span>`}
    <span class="pile-label" aria-hidden="true">${escapeHtml(name)}</span>
  </div>`;
}

function boardPositionName(row, column) {
  const names = {
    '0-0': locale === 'pt-BR' ? 'Noroeste' : 'Northwest',
    '0-1': locale === 'pt-BR' ? 'Norte' : 'North',
    '0-2': locale === 'pt-BR' ? 'Nordeste' : 'Northeast',
    '1-0': locale === 'pt-BR' ? 'Oeste' : 'West',
    '1-2': locale === 'pt-BR' ? 'Leste' : 'East',
    '2-0': locale === 'pt-BR' ? 'Sudoeste' : 'Southwest',
    '2-1': locale === 'pt-BR' ? 'Sul' : 'South',
    '2-2': locale === 'pt-BR' ? 'Sudeste' : 'Southeast',
  };
  return names[`${row}-${column}`] || (locale === 'pt-BR' ? 'Monte' : 'Draw pile');
}

function boardCellAnnouncement(row, column) {
  const position = boardPositionName(row, column);
  if (row === 1 && column === 1) return t('boardStock', position, game.stock.length);
  const pile = boardPileAt(row, column);
  if (!pile?.length) return t('boardEmpty', position);
  const first = cardAccessibleName(pile[0], locale);
  const last = cardAccessibleName(pile[pile.length - 1], locale);
  return pile.length === 1 ? t('boardCard', position, first) : t('boardRange', position, first, last, pile.length);
}

function syncNavigationDom() {
  const handZone = app.querySelector('[data-focus-zone="hand"]');
  if (handZone) {
    handZone.setAttribute('aria-activedescendant', game.hand.length ? `hand-card-${handFocusIndex}` : '');
    handZone.querySelectorAll('[data-action="select-hand"]').forEach((card, index) => {
      card.classList.toggle('focused', index === handFocusIndex);
    });
  }
  const boardZone = app.querySelector('[data-focus-zone="board"]');
  if (boardZone) {
    boardZone.removeAttribute('aria-activedescendant');
    boardZone.querySelectorAll('[role="gridcell"]').forEach((cell) => {
      const row = Number(cell.dataset.row);
      const column = Number(cell.dataset.column);
      const focused = row === boardFocus.row && column === boardFocus.column;
      cell.classList.toggle('focused', focused);
      cell.setAttribute('aria-label', boardCellAnnouncement(row, column));
    });
  }
}

function isRecordGame() { return game?.mode === 'record'; }
function botName(id) { return id ? t(`bot${id[0].toUpperCase()}${id.slice(1)}`) : ''; }
function isHumanTurn() { return game?.mode !== 'bots' || game.activeTurn === 0; }

function renderGame() {
  const names = [t('foundationNorth'), t('foundationEast'), t('foundationSouth'), t('foundationWest')];
  const corners = [t('cornerNorthWest'), t('cornerNorthEast'), t('cornerSouthEast'), t('cornerSouthWest')];
  const statusText = game.status === 'won' ? t('winnerStatus', game.winnerId === 'human' ? t('you') : botName(game.winnerId)) : game.status === 'blocked' ? t('blocked') : game.mode === 'bots' ? (game.activeTurn === 0 ? t('yourTurn') : t('botTurn', botName(game.activeBotId))) : t('instructions');
  const gameTitle = isRecordGame() ? t('recordGameTitle') : game.mode === 'bots' ? t('botsGameTitle') : t('gameTitle');
  const undoExtra = `class="secondary" aria-keyshortcuts="Control+Z" ${game.status !== 'playing' || game.mode === 'bots' ? 'disabled' : ''}`;
  const scoreText = isRecordGame() ? `<p class="game-score" aria-live="polite">${escapeHtml(t('scoreLabel', game.score))}</p>` : '';
  const scoreDetails = isRecordGame() && game.status !== 'playing' ? `<p class="score-breakdown">${escapeHtml(t('scoreBreakdown', game.usedCardPoints, -game.drawnCardPoints, game.invalidMoves * 3, game.stackBonuses * 5, game.cyclePenalties * 5, game.undoCount * 10))}</p>` : '';
  handFocusIndex = game.hand.length ? Math.min(handFocusIndex, game.hand.length - 1) : 0;
  const hand = game.hand.map((card, index) => {
    const isSelected = selected?.zone === 'hand' && selected.index === index;
    const label = cardAccessibleName(card, locale);
    return `<div class="card-button${isSelected ? ' selected' : ''}${handFocusIndex === index ? ' focused' : ''}" role="option" id="hand-card-${index}" data-action="select-hand" data-index="${index}" aria-selected="${isSelected}" aria-label="${escapeHtml(label)}" tabindex="-1">${cardSvg(card)}</div>`;
  }).join('');
  const stockLabel = t('stockLabel', game.stock.length);
  const stock = `<div class="pile-button area-stock${game.status !== 'playing' || !game.stock.length ? ' empty' : ''}" role="gridcell" id="board-cell-1-1" data-action="draw" data-row="1" data-column="1" aria-disabled="${game.status !== 'playing' || !game.stock.length || (game.mode === 'bots' && (!isHumanTurn() || game.turnDrew))}" aria-label="${escapeHtml(stockLabel)}">${game.stock.length ? cardSvg(null, true) : `<span>${escapeHtml(t('emptyPile'))}</span>`}<span class="pile-label" aria-hidden="true">${escapeHtml(t('stock'))}</span></div>`;
  const board = `<div class="board" role="grid" tabindex="0" data-focus-zone="board" aria-label="${escapeHtml(gameTitle)}">
    ${pileButton('corner', 0, corners[0], game.corners[0], 'area-nw', 0, 0)}
    ${pileButton('foundation', 0, names[0], game.foundations[0], 'area-north', 0, 1)}
    ${pileButton('corner', 1, corners[1], game.corners[1], 'area-ne', 0, 2)}
    ${pileButton('foundation', 3, names[3], game.foundations[3], 'area-west', 1, 0)}
    ${stock}
    ${pileButton('foundation', 1, names[1], game.foundations[1], 'area-east', 1, 2)}
    ${pileButton('corner', 3, corners[3], game.corners[3], 'area-sw', 2, 0)}
    ${pileButton('foundation', 2, names[2], game.foundations[2], 'area-south', 2, 1)}
    ${pileButton('corner', 2, corners[2], game.corners[2], 'area-se', 2, 2)}
  </div>`;
  const boardSection = `<section class="mobile-game-section board-section${mobileSection === 'board' ? '' : ' mobile-section-hidden'}" data-mobile-section="board" aria-labelledby="board-section-heading"><h2 id="board-section-heading" class="mobile-section-title">${escapeHtml(t('boardSection'))}</h2>${board}</section>`;
  const handSection = `<section class="mobile-game-section hand-section-wrapper${mobileSection === 'hand' ? '' : ' mobile-section-hidden'}" data-mobile-section="hand" aria-labelledby="hand-section-heading"><h2 id="hand-section-heading" class="mobile-section-title">${escapeHtml(t('handSection'))}</h2><section class="hand-section panel" role="listbox" tabindex="0" data-focus-zone="hand" aria-labelledby="hand-heading" aria-activedescendant="${game.hand.length ? `hand-card-${handFocusIndex}` : ''}"><h3 id="hand-heading">${escapeHtml(t('hand'))} <span class="legend">(${escapeHtml(t('cardsCount', game.hand.length))})</span></h3><div class="hand">${hand || `<p>${escapeHtml(t('victory'))}</p>`}</div></section></section>`;
  const mobileControls = `<section class="mobile-game-section controls-section${mobileSection === 'controls' ? '' : ' mobile-section-hidden'}" data-mobile-section="controls" aria-labelledby="controls-section-heading"><h2 id="controls-section-heading" class="mobile-section-title">${escapeHtml(t('controlsSection'))}</h2><div class="mobile-control-list">${game.mode === 'bots' && game.status === 'playing' && game.activeTurn === 0 ? button(t('passTurn'), 'pass-turn', 'class="secondary" aria-keyshortcuts="N"') : ''}${button(t('backMainMenu'), 'back-menu', 'class="secondary" aria-keyshortcuts="Escape"')}${button(t('help'), 'menu-help', 'class="secondary" aria-keyshortcuts="H"')}${isRecordGame() ? button(t('checkScore'), 'check-score', 'class="secondary" aria-keyshortcuts="S"') : ''}${button(t('undo'), 'undo', undoExtra)}</div></section>`;
  const turnSummary = game.mode === 'bots' ? `<p class="game-turn">${escapeHtml(t('botMatchTurnHint'))}</p>` : '';
  const mobileNavigation = `<section class="mobile-section-navigation" aria-labelledby="mobile-navigation-heading"><h2 id="mobile-navigation-heading">${escapeHtml(t('sectionNavigation'))}</h2><nav class="mobile-section-nav-list" aria-label="${escapeHtml(t('sectionNavigation'))}">${button(t('boardSection'), 'mobile-section', `class="secondary" data-section="board" aria-controls="board-section-heading" aria-pressed="${mobileSection === 'board'}"`)}${button(t('handSection'), 'mobile-section', `class="secondary" data-section="hand" aria-controls="hand-section-heading" aria-pressed="${mobileSection === 'hand'}"`)}${button(t('controlsSection'), 'mobile-section', `class="secondary" data-section="controls" aria-controls="controls-section-heading" aria-pressed="${mobileSection === 'controls'}"`)}</nav></section>`;
  const currentSectionHeading = `<h2 id="mobile-current-section" class="mobile-current-section" tabindex="-1">${escapeHtml(t('currentSection', mobileSection === 'board' ? t('boardSection') : mobileSection === 'hand' ? t('handSection') : t('controlsSection')))}</h2>`;
  app.innerHTML = `<div class="screen">
    <header class="game-header"><div><h1>${escapeHtml(gameTitle)}</h1><p id="game-instructions" class="game-status">${escapeHtml(statusText)}</p>${scoreText}${scoreDetails}</div><div class="inline-actions desktop-controls">${game.mode === 'bots' && game.status === 'playing' && game.activeTurn === 0 ? button(t('passTurn'), 'pass-turn', 'class="secondary" aria-keyshortcuts="N" tabindex="-1"') : ''} ${button(t('undo'), 'undo', `${undoExtra} tabindex="-1"`)} ${button(t('newGameShort'), 'new-game', 'class="secondary" tabindex="-1"')} ${button(t('menu'), 'back-menu', 'class="secondary" tabindex="-1" aria-keyshortcuts="Escape"')}</div></header>
    <div class="game-layout">
      ${mobileNavigation}
      ${currentSectionHeading}
      ${turnSummary}
      ${boardSection}
      ${handSection}
      ${mobileControls}
      <p class="legend">${escapeHtml(t('movesCount', game.moves))} — ${escapeHtml(t('draw'))}: ${game.draws}</p>
    </div>
  </div>`;
}

function focusableElements(group) {
  return [...group.querySelectorAll('button:not([disabled]), a[href]')];
}

function moveFocus(group, current, direction) {
  const items = focusableElements(group);
  const index = items.indexOf(current);
  if (index < 0) return null;
  if (group.classList.contains('board')) {
    const row = Number(current.dataset.row);
    const column = Number(current.dataset.column);
    const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[direction];
    if (!delta) return null;
    const destination = items.find((item) => Number(item.dataset.row) === row + delta[0] && Number(item.dataset.column) === column + delta[1]);
    return destination || current;
  }
  const vertical = group.classList.contains('button-list') || group.classList.contains('setting-list');
  const horizontal = group.classList.contains('inline-actions') || group.classList.contains('hand') || group.classList.contains('mobile-section-nav-list');
  if (vertical && (direction === 'ArrowUp' || direction === 'ArrowDown')) {
    const next = direction === 'ArrowDown' ? index + 1 : index - 1;
    return items[(next + items.length) % items.length];
  }
  if (horizontal && (direction === 'ArrowLeft' || direction === 'ArrowRight')) {
    const next = direction === 'ArrowRight' ? index + 1 : index - 1;
    return items[(next + items.length) % items.length];
  }
  return null;
}

function setupArrowNavigation() {
  const groups = app.querySelectorAll('.button-list, .setting-list, .inline-actions, .hand, .board, .mobile-section-nav-list');
  groups.forEach((group) => {
    const items = focusableElements(group);
    if (!items.length) return;
    items.forEach((item, index) => { item.tabIndex = index === 0 ? 0 : -1; });
    group.addEventListener('keydown', (event) => {
      const current = event.target.closest('button, a');
      if (!current || !group.contains(current)) return;
      const next = moveFocus(group, current, event.key);
      if (!next || next === current) return;
      event.preventDefault();
      event.stopPropagation();
      items.forEach((item) => { item.tabIndex = -1; });
      next.tabIndex = 0;
      next.focus({ preventScroll: true });
      playSound('menuFocus');
    });
  });
}

function focusFirstControl() {
  if (screen === 'game') {
    const desiredZone = isMobileLayout() && mobileSection === 'hand' ? 'hand' : 'board';
    const zone = app.querySelector(`[data-focus-zone="${desiredZone}"]`);
    if (zone && !zone.closest('.mobile-section-hidden')) zone.focus({ preventScroll: true });
    return;
  }
  const first = app.querySelector('[data-action]:not([disabled])');
  if (first) first.focus({ preventScroll: true });
  else app.focus({ preventScroll: true });
}

function focusDescriptor(element) {
  if (element?.dataset?.focusZone) return { focusZone: element.dataset.focusZone };
  if (!element?.dataset?.action) return null;
  return {
    action: element.dataset.action,
    locale: element.dataset.locale,
    zone: element.dataset.zone,
    index: element.dataset.index,
    botId: element.dataset.botId,
  };
}

function restoreFocus(descriptor) {
  if (!descriptor) return focusFirstControl();
  if (descriptor.focusZone) {
    const zone = app.querySelector(`[data-focus-zone="${descriptor.focusZone}"]`);
    if (zone) zone.focus({ preventScroll: true });
    else focusFirstControl();
    return;
  }
  const target = [...app.querySelectorAll('[data-action]')].find((element) => {
    return element.dataset.action === descriptor.action
      && element.dataset.locale === descriptor.locale
      && element.dataset.zone === descriptor.zone
      && element.dataset.index === descriptor.index
      && element.dataset.botId === descriptor.botId
      && !element.disabled;
  });
  if (target) target.focus({ preventScroll: true });
  else focusFirstControl();
}

function render() {
  const previousFocus = focusDescriptor(document.activeElement);
  applySettings();
  if (screen === 'language') renderLanguage();
  if (screen === 'menu') renderMenu();
  if (screen === 'options') renderOptions();
  if (screen === 'credits') renderCredits();
  if (screen === 'help') renderHelp();
  if (screen === 'game-menu') renderGameMenu();
  if (screen === 'new-game') renderNewGame();
  if (screen === 'bot-selection') renderBotSelection();
  if (screen === 'mural') renderMural();
  if (screen === 'game') renderGame();
  bindActions();
  setupArrowNavigation();
  bindGameZones();
  restoreFocus(previousFocus);
}

function scoreMove(before, source, destination, moved) {
  if (!isRecordGame()) return;
  if (!game.scoredKingIds) game.scoredKingIds = [];
  const cardPoints = moved.reduce((sum, card) => sum + card.rank, 0);
  if (source.zone === 'hand') {
    game.usedCardPoints += cardPoints;
    game.score += cardPoints;
    moved.filter((card) => card.rank === 13).forEach((card) => {
      if (!game.scoredKingIds.includes(card.id)) game.scoredKingIds.push(card.id);
    });
  }
  const destinationPilesBefore = before[destination.zone === 'foundation' ? 'foundations' : 'corners'];
  const destinationPileBefore = destinationPilesBefore[destination.index];
  if (source.zone !== 'hand' && destination.zone === 'corner' && destinationPileBefore.length === 0 && moved[0]?.rank === 13 && !game.scoredKingIds.includes(moved[0].id)) {
    game.score += 13;
    game.usedCardPoints += 13;
    game.scoredKingIds.push(moved[0].id);
  }
  if (source.zone !== 'hand' && moved.length >= 2 && destinationPileBefore.length > 0) {
    game.stackBonuses += 5;
    game.score += 5;
  }
  const sourceKey = `${source.zone}:${source.index}`;
  const destinationKey = `${destination.zone}:${destination.index}`;
  const movedIds = moved.map((card) => card.id);
  const repeatedReturn = game.moveLog.some((entry) => entry.source === destinationKey && entry.destination === sourceKey && JSON.stringify(entry.movedIds) === JSON.stringify(movedIds));
  if (repeatedReturn) {
    game.cyclePenalties += 5;
    game.score -= 5;
  }
  game.moveLog.push({ movedIds, source: sourceKey, destination: destinationKey });
}

function scoreInvalidMove() {
  if (!isRecordGame() || game.status !== 'playing') return;
  game.invalidMoves += 1;
  game.score -= 3;
}

function saveScoreIfNeeded() {
  if (!isRecordGame() || game.scoreSaved || !['won', 'blocked'].includes(game.status)) return;
  const entries = scoreboardEntries();
  entries.push({ score: game.score, mode: 'record', result: game.status === 'won' ? 'victory' : 'defeat', date: new Date().toISOString() });
  entries.sort((a, b) => Number(b.score) - Number(a.score));
  localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(entries.slice(0, 3)));
  game.scoreSaved = true;
}

function awardResultIfNeeded() {
  if (!isRecordGame() || game.resultAwarded || !['won', 'blocked'].includes(game.status)) return;
  game.score += game.status === 'won' ? 100 : -100;
  game.resultAwarded = true;
  saveScoreIfNeeded();
}

function announceResult() {
  if (!isRecordGame() || !['won', 'blocked'].includes(game.status)) return;
  announce(t('resultScore', game.status === 'won' ? t('victory') : t('blocked'), game.score), game.status === 'won' ? 'victory' : 'error');
}

function checkScore() {
  if (!isRecordGame()) return;
  announce(t('scoreLabel', game.score), 'confirm');
}

function selectHand(index) {
  if (game.status !== 'playing' || !isHumanTurn()) return;
  if (selected?.zone === 'hand' && selected.index === index) {
    selected = null;
    announce(t('selectionCancelled'), 'cardCancel');
  } else {
    selected = { zone: 'hand', index };
    announce(`${cardAccessibleName(game.hand[index], locale)}. ${t('selectDestination')}`, 'cardSelect');
  }
  render();
}

function selectPile(zone, index) {
  if (game.status !== 'playing' || !isHumanTurn()) return;
  const pile = zone === 'foundation' ? game.foundations[index] : game.corners[index];
  if (selected) {
    const before = cloneGame(game);
    const source = { ...selected };
    const sourcePileBefore = source.zone === 'hand' ? before.hand : before[source.zone === 'foundation' ? 'foundations' : 'corners'][source.index];
    const movedCards = source.zone === 'hand' ? [sourcePileBefore[source.index]] : [...sourcePileBefore];
    const moved = moveSelected(game, selected, { zone, index });
    if (moved) {
      history.push(before);
      if (game.mode === 'bots' && isHumanTurn()) game.turnActionCount = (game.turnActionCount || 0) + 1;
      scoreMove(before, source, { zone, index }, movedCards);
      if (game.mode !== 'bots') updateBlockedStatus(game);
      if (game.mode === 'bots' && game.hand.length === 0) { game.status = 'won'; game.winnerId = 'human'; }
      awardResultIfNeeded();
      const moveSound = source.zone === 'hand' ? 'cardPlay' : 'stackMove';
      selected = null;
      saveScoreIfNeeded();
      saveGame();
      render();
      if (game.mode === 'bots' && game.status === 'won') announce(t('winnerStatus', t('you')), 'victory');
      else if (['won', 'blocked'].includes(game.status)) announceResult();
      else announce(boardCellAnnouncement(boardFocus.row, boardFocus.column), moveSound);
    } else {
      scoreInvalidMove();
      saveGame();
      announce(zone === 'corner' && pile.length === 0 ? t('invalidCorner') : t('invalidMove'), 'error');
      render();
    }
    return;
  }
  if (pile.length) {
    selected = { zone, index };
    announce(`${cardAccessibleName(pile[pile.length - 1], locale)}. ${t('selectDestination')}`, 'cardSelect');
    render();
  }
}

function handleDraw() {
  if (game.mode === 'bots' && (!isHumanTurn() || game.turnDrew)) { announce(t(game.turnDrew ? 'alreadyDrew' : 'notYourTurn'), 'error'); return; }
  selected = null;
  const before = cloneGame(game);
  const card = drawCard(game);
  if (!card) {
    announce(t('stockEmpty'), 'error');
    return;
  }
  history.push(before);
  if (game.mode === 'bots') {
    game.turnDrew = true;
    game.turnActionCount = (game.turnActionCount || 0) + 1;
  }
  if (isRecordGame() && card.rank !== 13) {
    game.drawnCardPoints += card.rank;
    game.score -= card.rank;
  }
  if (game.mode !== 'bots') updateBlockedStatus(game);
  awardResultIfNeeded();
  saveScoreIfNeeded();
  saveGame();
  if (game.status === 'blocked') announceResult();
  else announce(t('cardDrawn'), 'cardDraw');
  render();
}

function undo() {
  if (game?.status !== 'playing' || game.mode === 'bots') {
    announce(t('nothingToUndo'), 'error');
    return;
  }
  const previous = history.pop();
  if (!previous) {
    announce(t('nothingToUndo'), 'error');
    return;
  }
  const scoredKingIdsBeforeUndo = [...(game.scoredKingIds || [])];
  game = previous;
  game.scoredKingIds = [...new Set([...(game.scoredKingIds || []), ...scoredKingIdsBeforeUndo])];
  if (isRecordGame()) {
    game.undoCount = (game.undoCount || 0) + 1;
    game.score -= 10;
  }
  selected = null;
  saveGame();
  announce(t('moveMade'), 'cardCancel');
  render();
}

function botMoves(bot) {
  const humanHand = game.hand;
  game.hand = bot.hand;
  const candidates = [];
  game.hand.forEach((card, index) => {
    [...game.foundations.map((pile, i) => ({ zone: 'foundation', index: i, pile })), ...game.corners.map((pile, i) => ({ zone: 'corner', index: i, pile }))]
      .forEach((target) => { if (canPlaceCard(card, target.pile, target.zone)) candidates.push({ source: { zone: 'hand', index }, destination: { zone: target.zone, index: target.index }, value: card.rank, removesHand: true }); });
  });
  const piles = [...game.foundations.map((pile, index) => ({ zone: 'foundation', index, pile })), ...game.corners.map((pile, index) => ({ zone: 'corner', index, pile }))];
  piles.forEach((source) => piles.forEach((target) => {
    if (source.pile.length && !(source.zone === target.zone && source.index === target.index) && canMoveStack(source.pile, target.pile, target.zone)) {
      candidates.push({ source: { zone: source.zone, index: source.index }, destination: { zone: target.zone, index: target.index }, value: source.pile.reduce((n, card) => n + card.rank, 0), removesHand: false });
    }
  }));
  game.hand = humanHand;
  return candidates;
}

function botPileName(zone, index) {
  if (zone === 'foundation') return [t('foundationNorth'), t('foundationEast'), t('foundationSouth'), t('foundationWest')][index];
  return [t('cornerNorthWest'), t('cornerNorthEast'), t('cornerSouthEast'), t('cornerSouthWest')][index];
}

function checkBotMatchBlocked() {
  if (game.status !== 'playing' || game.stock.length || hasLegalPileMove(game)) return;
  const humanHand = game.hand;
  const allHaveNoHandMoves = [null, ...game.botPlayers].every((participant) => {
    game.hand = participant ? participant.hand : humanHand;
    const noMoves = !hasLegalHandMove(game);
    game.hand = humanHand;
    return noMoves;
  });
  if (allHaveNoHandMoves) game.status = 'blocked';
}

function passHumanTurn() {
  if (game?.mode !== 'bots' || game.status !== 'playing' || !isHumanTurn()) return;
  const hasLegalAction = hasLegalHandMove(game) || hasLegalPileMove(game);
  const didSomething = (game.turnActionCount || 0) > 0 || game.turnDrew;
  if (!didSomething && (game.stock.length > 0 || hasLegalAction)) {
    announce(t('mustActBeforePass'), 'error');
    return;
  }
  selected = null;
  mobileSection = 'board';
  game.activeTurn = 1;
  game.activeBotId = game.botPlayers[0].id;
  game.turnDrew = false;
  game.turnActionCount = 0;
  saveGame(); render();
  runBotTurn(1, 0);
}

function runBotTurn(turnIndex, initialSteps = 0) {
  if (game.status !== 'playing') return;

  // Complete bot turns in a bounded loop rather than depending on a chain of
  // delayed callbacks. A skipped/no-move turn must always advance to the next
  // participant and eventually restore the human turn.
  const turnMessages = [];
  for (let currentTurn = turnIndex; currentTurn <= game.botPlayers.length && game.status === 'playing'; currentTurn += 1) {
    const bot = game.botPlayers[currentTurn - 1];
    game.activeTurn = currentTurn;
    game.activeBotId = bot.id;
    game.turnActionCount = 0;
    render();
    announce(t('botTurn', botName(bot.id)));

    let steps = currentTurn === turnIndex ? initialSteps : 0;
    let skipped = false;
    while (game.status === 'playing') {
      const allCandidates = botMoves(bot);
      const handMoves = allCandidates.filter((move) => move.removesHand);
      // The Dog prioritizes hand-card plays and never samples pile movements
      // randomly. If it has no playable card and the stock is exhausted, it
      // uses the smallest legal pile movement as a deliberate fallback.
      const dogPileMoves = bot.id === 'dog' && !handMoves.length && !game.stock.length
        ? allCandidates.filter((move) => !move.removesHand).sort((a, b) => {
          const piles = game.foundations.concat(game.corners);
          const aLength = piles[a.source.index + (a.source.zone === 'corner' ? 4 : 0)].length;
          const bLength = piles[b.source.index + (b.source.zone === 'corner' ? 4 : 0)].length;
          return aLength - bLength || a.value - b.value
            || a.source.zone.localeCompare(b.source.zone) || a.source.index - b.source.index
            || a.destination.zone.localeCompare(b.destination.zone) || a.destination.index - b.destination.index;
        })
        : [];
      const candidates = bot.id === 'dog' ? (handMoves.length ? handMoves : dogPileMoves) : allCandidates;

      if (!handMoves.length && !game.turnDrew && game.stock.length) {
        const humanHand = game.hand;
        game.hand = bot.hand;
        drawCard(game);
        bot.hand = game.hand;
        game.hand = humanHand;
        game.turnDrew = true;
        game.turnActionCount = (game.turnActionCount || 0) + 1;
        turnMessages.push(`${botName(bot.id)}. ${t('cardDrawn')}`);
        saveGame();
        render();
        steps += 1;
        continue;
      }

      const dogSkips = bot.id === 'dog' && game.turnActionCount > 0 && candidates.length > 0 && Math.random() < 0.28;
      if (!candidates.length || dogSkips || steps >= 14) {
        turnMessages.push(t('botSkipped', botName(bot.id)));
        game.turnDrew = false;
        skipped = true;
        break;
      }

      let chosen;
      if (bot.id === 'lion') chosen = [...candidates].sort((a, b) => b.value - a.value || Number(b.removesHand) - Number(a.removesHand))[0];
      else if (bot.id === 'fox') chosen = [...candidates].sort((a, b) => Number(b.removesHand) - Number(a.removesHand) || b.value - a.value)[0];
      else chosen = candidates[Math.floor(Math.random() * candidates.length)];

      const sourceCard = chosen.source.zone === 'hand' ? bot.hand[chosen.source.index] : null;
      const movedCount = chosen.source.zone === 'hand' ? 1 : game[chosen.source.zone === 'foundation' ? 'foundations' : 'corners'][chosen.source.index].length;
      const destinationName = botPileName(chosen.destination.zone, chosen.destination.index);
      const humanHand = game.hand;
      game.hand = bot.hand;
      const moved = moveSelected(game, chosen.source, chosen.destination);
      bot.hand = game.hand;
      game.hand = humanHand;
      steps += 1;
      if (!moved) continue;
      game.turnActionCount = (game.turnActionCount || 0) + 1;

      if (!bot.hand.length) { game.status = 'won'; game.winnerId = bot.id; }
      const actionMessage = sourceCard
        ? t('botPlayedCard', botName(bot.id), cardAccessibleName(sourceCard, locale), destinationName)
        : t('botMovedPile', botName(bot.id), movedCount, destinationName);
      turnMessages.push(actionMessage);
      saveGame();
      render();
      if (game.status === 'won') break;
    }
    if (game.status === 'won') break;
    if (!skipped) game.turnDrew = false;
  }

  if (game.status === 'won') {
    announce(t('winnerStatus', botName(game.winnerId)), 'victory');
    return;
  }

  game.activeTurn = 0;
  game.activeBotId = null;
  game.turnDrew = false;
  game.turnActionCount = 0;
  checkBotMatchBlocked();
  saveGame();
  render();
  if (game.status === 'blocked') announce(t('blocked'), 'error');
  else announce([...turnMessages, t('yourTurn')].join(' '), turnMessages.length ? 'cardPlay' : 'confirm');
}

function startGame(mode) {
  game = createGame(mode);
  if (mode === 'bots') {
    game.botPlayers = selectedBotIds.map((id) => ({ id, hand: game.stock.splice(0, 7) }));
    game.activeTurn = 0; game.activeBotId = null; game.turnDrew = false; game.turnActionCount = 0; game.winnerId = null;
  }
  history = [];
  selected = null;
  mobileSection = 'board';
  saveGame();
  screen = 'game';
  announce(t('gameSaved'), 'confirm');
  render();
}

function startClassic() { startGame('training'); }
function startRecordSolo() { startGame('record'); }
function startBotMatch() { if (!selectedBotIds.length) return; startGame('bots'); }

function chooseLanguage(value) {
  locale = value;
  localStorage.setItem('ecj-kings-corner-locale', locale);
  settings = { ...settings };
  saveSettings();
  if (screen === 'language') screen = 'menu';
  announce(t('languageChanged'), 'confirm');
  render();
}

function toggleSetting(key) {
  settings[key] = !settings[key];
  saveSettings();
  announce(t(key === 'soundEnabled' ? 'sounds' : key), key === 'soundEnabled' ? 'confirm' : null);
  render();
}

function bindActions() {
  app.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', () => {
      const action = element.dataset.action;
      if (action === 'choose-language') return chooseLanguage(element.dataset.locale);
      if (action === 'menu-start') { screen = 'game-menu'; playSound('menuOpen'); render(); return; }
      if (action === 'menu-mural') { screen = 'mural'; playSound('menuOpen'); render(); return; }
      if (action === 'menu-options') { screen = 'options'; playSound('menuOpen'); render(); return; }
      if (action === 'menu-help') { previousScreen = screen; screen = 'help'; playSound('menuOpen'); render(); return; }
      if (action === 'mobile-section') {
        mobileSection = element.dataset.section;
        render();
        app.querySelector('#mobile-current-section')?.focus({ preventScroll: true });
        return;
      }
      if (action === 'menu-credits') { screen = 'credits'; playSound('menuOpen'); render(); return; }
      if (action === 'back-help') { screen = previousScreen; playSound('menuBack'); render(); return; }
      if (action === 'back-menu') { screen = 'menu'; selected = null; playSound('menuBack'); render(); return; }
      if (action === 'back-game-menu') { screen = 'game-menu'; selected = null; playSound('menuBack'); render(); return; }
      if (action === 'continue-game' && game) { screen = 'game'; selected = null; playSound('menuOpen'); render(); if (game.mode === 'bots' && game.activeTurn > 0) runBotTurn(game.activeTurn, 0); return; }
      if (action === 'new-game') { screen = 'new-game'; selected = null; playSound('menuOpen'); render(); return; }
      if (action === 'start-classic') return startClassic();
      if (action === 'start-training') return startClassic();
      if (action === 'start-record') return startRecordSolo();
      if (action === 'open-bot-selection') { screen = 'bot-selection'; playSound('menuOpen'); render(); return; }
      if (action === 'toggle-bot-selection') return toggleBotSelection(element.dataset.botId);
      if (action === 'read-bot-appearance') return readBotAppearance(element.dataset.botId);
      if (action === 'save-bot-selection') { screen = 'new-game'; announce(t('botSelectionCount', selectedBotIds.length), 'confirm'); render(); return; }
      if (action === 'start-bot-match') return startBotMatch();
      if (action === 'pass-turn') return passHumanTurn();
      if (action === 'back-bot-selection') { screen = 'new-game'; render(); return; }
      if (action === 'toggle-soundEnabled') return toggleSetting('soundEnabled');
      if (action === 'toggle-highContrast') return toggleSetting('highContrast');
      if (action === 'toggle-largeText') return toggleSetting('largeText');
      if (action === 'toggle-reducedMotion') return toggleSetting('reducedMotion');
      if (action === 'select-hand') return selectHand(Number(element.dataset.index));
      if (action === 'select-pile') {
        boardFocus = { row: Number(element.dataset.row), column: Number(element.dataset.column) };
        return selectPile(element.dataset.zone, Number(element.dataset.index));
      }
      if (action === 'draw') return handleDraw();
      if (action === 'check-score') return checkScore();
      if (action === 'undo') return undo();
    });
    element.addEventListener('focus', () => playSound('menuFocus'));
  });
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 48rem)').matches;
}

function focusGameZone(zone) {
  let target = app.querySelector(`[data-focus-zone="${zone}"]`);
  if (!target) return;
  const section = target.closest('[data-mobile-section]');
  if (isMobileLayout() && section?.classList.contains('mobile-section-hidden')) {
    mobileSection = zone;
    render();
    target = app.querySelector(`[data-focus-zone="${zone}"]`);
  }
  target?.focus({ preventScroll: true });
}

function announceBoardFocus() {
  announce(boardCellAnnouncement(boardFocus.row, boardFocus.column));
}

function bindGameZones() {
  if (screen !== 'game') return;
  const handZone = app.querySelector('[data-focus-zone="hand"]');
  const boardZone = app.querySelector('[data-focus-zone="board"]');
  handZone?.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      focusGameZone('board');
      announceBoardFocus();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (!game.hand.length) return;
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      handFocusIndex = (handFocusIndex + direction + game.hand.length) % game.hand.length;
      event.preventDefault();
      event.stopPropagation();
      syncNavigationDom();
      return;
    }
    if (event.key === 'Enter' && game.hand.length) {
      event.preventDefault();
      event.stopPropagation();
      selectHand(handFocusIndex);
    }
  });
  boardZone?.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      focusGameZone('hand');
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      const delta = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
      const nextRow = Math.max(0, Math.min(2, boardFocus.row + delta[0]));
      const nextColumn = Math.max(0, Math.min(2, boardFocus.column + delta[1]));
      const changed = nextRow !== boardFocus.row || nextColumn !== boardFocus.column;
      boardFocus = { row: nextRow, column: nextColumn };
      event.preventDefault();
      event.stopPropagation();
      if (changed) {
        syncNavigationDom();
        announceBoardFocus();
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      const target = document.querySelector(`#board-cell-${boardFocus.row}-${boardFocus.column}`);
      if (!target) return;
      if (target.dataset.action === 'draw') {
        handleDraw();
        return;
      }
      selectPile(target.dataset.zone, Number(target.dataset.index));
    }
  });
}

function handleArrowKeyOutsideGroup(event) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return false;
  const current = document.activeElement;
  const currentGroup = current?.closest('.button-list, .setting-list, .inline-actions, .hand, .board, .mobile-section-nav-list, [data-focus-zone]');
  if (currentGroup && app.contains(currentGroup)) return false;
  const firstGroup = app.querySelector('.button-list, .setting-list, .inline-actions, .hand, .board');
  if (!firstGroup) return false;
  const items = focusableElements(firstGroup);
  if (!items.length) return false;
  const first = items[0];
  first.tabIndex = 0;
  first.focus({ preventScroll: true });
  const next = moveFocus(firstGroup, first, event.key);
  if (next && next !== first) {
    items.forEach((item) => { item.tabIndex = -1; });
    next.tabIndex = 0;
    next.focus({ preventScroll: true });
  }
  event.preventDefault();
  playSound('menuFocus');
  return true;
}

document.addEventListener('keydown', (event) => {
  if (handleArrowKeyOutsideGroup(event)) return;
  if (event.key === 'Escape' && ['options', 'credits', 'game-menu', 'new-game', 'bot-selection', 'mural', 'help'].includes(screen)) {
    event.preventDefault();
    const targetScreen = screen === 'new-game' ? 'game-menu' : screen === 'bot-selection' ? 'new-game' : screen === 'help' ? previousScreen : 'menu';
    screen = targetScreen;
    render();
    announce(targetScreen === 'menu' ? t('returnedMenu') : t('gameMenuTitle'), 'menuBack');
    return;
  }
  if (!event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'h') {
    event.preventDefault();
    previousScreen = screen;
    screen = 'help';
    render();
    return;
  }
  if (screen === 'game' && isRecordGame() && !event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    checkScore();
    return;
  }
  if (screen !== 'game') return;
  if (game?.mode === 'bots' && game.status === 'playing' && isHumanTurn() && !event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'n') { event.preventDefault(); passHumanTurn(); return; }
  if (event.key === 'Escape') {
    event.preventDefault();
    if (selected) {
      selected = null;
      announce(t('selectionCancelled'), 'cardCancel');
      render();
    } else {
      screen = 'menu';
      render();
      announce(t('returnedMenu'), 'menuBack');
    }
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  }
});

render();
