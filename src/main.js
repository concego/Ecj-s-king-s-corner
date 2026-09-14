import { getText } from './i18n.js';
import { playSound, setAudioEnabled } from './audio.js';
import {
  RANK_BY_VALUE,
  SUIT_BY_ID,
  cardAccessibleName,
  createGame,
  cloneGame,
  moveSelected,
  drawCard,
  updateBlockedStatus,
} from './game.js';

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const SAVED_GAME_KEY = 'ecj-kings-corner-game';
const SETTINGS_KEY = 'ecj-kings-corner-settings';

let locale = localStorage.getItem('ecj-kings-corner-locale');
let settings = loadSettings();
let screen = locale ? 'menu' : 'language';
let game = loadGame();
let history = [];
let selected = null;

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
    return saved?.hand && saved?.stock && saved?.foundations && saved?.corners ? saved : null;
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
    return `<svg class="card-svg" viewBox="0 0 120 168" aria-hidden="true" focusable="false"><rect x="2" y="2" width="116" height="164" rx="8" fill="#174d70" stroke="#17212b" stroke-width="4"/><rect x="12" y="12" width="96" height="144" rx="5" fill="none" stroke="#ffffff" stroke-width="3"/><path d="M20 84h80M60 20v128" stroke="#ffffff" stroke-width="2" opacity=".8"/></svg>`;
  }
  const suit = SUIT_BY_ID[card.suit];
  const rank = RANK_BY_VALUE[card.rank];
  const tone = suit.color === 'red' ? 'card-red' : 'card-black';
  return `<svg class="card-svg" viewBox="0 0 120 168" aria-hidden="true" focusable="false"><rect x="2" y="2" width="116" height="164" rx="8" fill="#ffffff" stroke="#17212b" stroke-width="4"/><text class="${tone}" x="14" y="31" font-size="22">${escapeHtml(rank.short)}</text><text class="${tone}" x="14" y="54" font-size="22">${suit.symbol}</text><text class="${tone}" x="60" y="105" text-anchor="middle" font-size="52">${suit.symbol}</text><text class="${tone}" x="106" y="148" text-anchor="end" font-size="22" transform="rotate(180 106 148)">${escapeHtml(rank.short)} ${suit.symbol}</text></svg>`;
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
    ${button(t('options'), 'menu-options', 'class="secondary"')}
    ${button(t('credits'), 'menu-credits', 'class="secondary"')}
    <p><strong>${escapeHtml(t('contact'))}:</strong> <a href="mailto:euconcego@gmail.com">euconcego@gmail.com</a></p>
  </div>`);
}

function toggleButton(key) {
  const on = settings[key];
  return button(on ? t('enabled') : t('disabled'), `toggle-${key}`, `class="secondary" aria-pressed="${on}"`);
}

function renderOptions() {
  const setting = (title, description, control) => `<div class="setting"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></div>${control}</div>`;
  app.innerHTML = screenShell(t('options'), t('accessibilityTitle'), `<div class="panel">
    <div class="setting-list">
      ${setting(t('language'), locale === 'pt-BR' ? 'Português (Brasil)' : 'English', `<div class="inline-actions">${button('Português (Brasil)', 'choose-language', 'data-locale="pt-BR" class="secondary"')}${button('English', 'choose-language', 'data-locale="en" class="secondary"')}</div>`)}
      ${setting(t('sounds'), t('soundsDescription'), toggleButton('soundEnabled'))}
      ${setting(t('highContrast'), t('highContrastDescription'), toggleButton('highContrast'))}
      ${setting(t('largeText'), t('largeTextDescription'), toggleButton('largeText'))}
      ${setting(t('reducedMotion'), t('reducedMotionDescription'), toggleButton('reducedMotion'))}
    </div>
    ${button(t('back'), 'back-menu', 'class="secondary"')}
  </div>`);
}

function renderCredits() {
  app.innerHTML = screenShell(t('creditsTitle'), '', `<div class="panel">
    <p><strong>${escapeHtml(t('teamCredit'))}</strong></p>
    <p>${escapeHtml(t('inspiredBy'))}</p>
    <p>${escapeHtml(t('independentProject'))}</p>
    <p><strong>${escapeHtml(t('contact'))}:</strong> <a href="mailto:euconcego@gmail.com">euconcego@gmail.com</a></p>
    ${button(t('back'), 'back-menu', 'class="secondary"')}
  </div>`);
}

function renderGameMenu() {
  const disabled = game ? '' : 'disabled';
  const noSavedText = game ? '' : `<p class="legend">${escapeHtml(t('noSavedGame'))}</p>`;
  app.innerHTML = screenShell(t('gameMenuTitle'), '', `<div class="panel button-list">
    ${button(t('continueGame'), 'continue-game', disabled)}
    ${noSavedText}
    ${button(t('newGame'), 'new-game', 'class="secondary"')}
    ${button(t('back'), 'back-menu', 'class="secondary"')}
  </div>`);
}

function renderNewGame() {
  app.innerHTML = screenShell(t('styleTitle'), '', `<div class="panel">
    <fieldset>
      <legend><strong>${escapeHtml(t('styleTitle'))}</strong></legend>
      <div class="setting">
        <div><strong>${escapeHtml(t('classic'))}</strong><small>${escapeHtml(t('classicDescription'))}</small></div>
        <span aria-label="${escapeHtml(t('classic'))}">✓</span>
      </div>
    </fieldset>
    <div class="inline-actions">
      ${button(t('startClassic'), 'start-classic')}
      ${button(t('back'), 'back-game-menu', 'class="secondary"')}
    </div>
  </div>`);
}

function pileButton(zone, index, name, pile, areaClass) {
  const top = pile[pile.length - 1];
  const isSelected = selected?.zone === zone && selected?.index === index;
  const label = t('pileLabel', name, top ? cardAccessibleName(top, locale) : '', pile.length);
  return `<button type="button" class="pile-button ${areaClass}${isSelected ? ' selected' : ''}${top ? '' : ' empty'}" data-action="select-pile" data-zone="${zone}" data-index="${index}" aria-pressed="${isSelected}" aria-label="${escapeHtml(label)}">
    ${top ? cardSvg(top) : `<span>${escapeHtml(t('emptyPile'))}</span>`}
    <span class="pile-label" aria-hidden="true">${escapeHtml(name)}</span>
  </button>`;
}

function renderGame() {
  const names = [t('foundationNorth'), t('foundationEast'), t('foundationSouth'), t('foundationWest')];
  const corners = [t('cornerNorthWest'), t('cornerNorthEast'), t('cornerSouthEast'), t('cornerSouthWest')];
  const statusText = game.status === 'won' ? t('victory') : game.status === 'blocked' ? t('blocked') : t('instructions');
  const hand = game.hand.map((card, index) => {
    const isSelected = selected?.zone === 'hand' && selected.index === index;
    const label = `${cardAccessibleName(card, locale)}, ${isSelected ? t('selected') : t('notSelected')}`;
    return `<button type="button" class="card-button${isSelected ? ' selected' : ''}" data-action="select-hand" data-index="${index}" aria-pressed="${isSelected}" aria-label="${escapeHtml(label)}">${cardSvg(card)}</button>`;
  }).join('');
  const stockLabel = t('stockLabel', game.stock.length);
  const stock = `<button type="button" class="pile-button area-stock" data-action="draw" aria-label="${escapeHtml(stockLabel)}" ${game.status !== 'playing' || !game.stock.length ? 'disabled' : ''}>${game.stock.length ? cardSvg(null, true) : `<span>${escapeHtml(t('emptyPile'))}</span>`}<span class="pile-label" aria-hidden="true">${escapeHtml(t('stock'))}</span></button>`;
  const board = `<div class="board" aria-label="${escapeHtml(t('gameTitle'))}">
    ${pileButton('corner', 0, corners[0], game.corners[0], 'area-nw')}
    ${pileButton('foundation', 0, names[0], game.foundations[0], 'area-north')}
    ${pileButton('corner', 1, corners[1], game.corners[1], 'area-ne')}
    ${pileButton('foundation', 3, names[3], game.foundations[3], 'area-west')}
    ${stock}
    ${pileButton('foundation', 1, names[1], game.foundations[1], 'area-east')}
    ${pileButton('corner', 3, corners[3], game.corners[3], 'area-sw')}
    ${pileButton('foundation', 2, names[2], game.foundations[2], 'area-south')}
    ${pileButton('corner', 2, corners[2], game.corners[2], 'area-se')}
  </div>`;
  app.innerHTML = `<div class="screen">
    <header class="game-header"><div><h1>${escapeHtml(t('gameTitle'))}</h1><p id="game-message" class="game-status" role="status" aria-live="polite">${escapeHtml(statusText)}</p></div><div class="inline-actions">${button(t('undo'), 'undo', 'class="secondary"')} ${button(t('newGameShort'), 'new-game', 'class="secondary"')} ${button(t('menu'), 'back-menu', 'class="secondary"')}</div></header>
    <div class="game-layout">
      ${board}
      <section class="hand-section panel" aria-labelledby="hand-heading"><h2 id="hand-heading">${escapeHtml(t('hand'))} <span class="legend">(${escapeHtml(t('cardsCount', game.hand.length))})</span></h2><div class="hand">${hand || `<p>${escapeHtml(t('victory'))}</p>`}</div></section>
      <p class="legend">${escapeHtml(t('movesCount', game.moves))} — ${escapeHtml(t('draw'))}: ${game.draws}</p>
    </div>
  </div>`;
}

function render() {
  applySettings();
  if (screen === 'language') renderLanguage();
  if (screen === 'menu') renderMenu();
  if (screen === 'options') renderOptions();
  if (screen === 'credits') renderCredits();
  if (screen === 'game-menu') renderGameMenu();
  if (screen === 'new-game') renderNewGame();
  if (screen === 'game') renderGame();
  app.focus({ preventScroll: true });
  bindActions();
}

function selectHand(index) {
  if (game.status !== 'playing') return;
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
  const pile = zone === 'foundation' ? game.foundations[index] : game.corners[index];
  if (selected) {
    const before = cloneGame(game);
    const moved = moveSelected(game, selected, { zone, index });
    if (moved) {
      history.push(before);
      const moveSound = selected?.zone === 'hand' ? 'cardPlay' : 'stackMove';
      selected = null;
      saveGame();
      announce(t('moveMade'), moveSound);
      if (game.status === 'won') announce(t('victory'), 'victory');
      render();
    } else {
      announce(zone === 'corner' && pile.length === 0 ? t('invalidCorner') : t('invalidMove'), 'error');
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
  if (selected) {
    selected = null;
    announce(t('selectionCancelled'), 'cardCancel');
    render();
    return;
  }
  const before = cloneGame(game);
  const card = drawCard(game);
  if (!card) {
    announce(t('stockEmpty'), 'error');
    return;
  }
  history.push(before);
  saveGame();
  announce(t('cardDrawn'), 'cardDraw');
  updateBlockedStatus(game);
  render();
}

function undo() {
  const previous = history.pop();
  if (!previous) {
    announce(t('nothingToUndo'), 'error');
    return;
  }
  game = previous;
  selected = null;
  saveGame();
  announce(t('moveMade'), 'cardCancel');
  render();
}

function startClassic() {
  game = createGame();
  history = [];
  selected = null;
  saveGame();
  screen = 'game';
  announce(t('gameSaved'), 'confirm');
  render();
}

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
      if (action === 'menu-options') { screen = 'options'; playSound('menuOpen'); render(); return; }
      if (action === 'menu-credits') { screen = 'credits'; playSound('menuOpen'); render(); return; }
      if (action === 'back-menu') { screen = 'menu'; selected = null; playSound('menuBack'); render(); return; }
      if (action === 'back-game-menu') { screen = 'game-menu'; selected = null; playSound('menuBack'); render(); return; }
      if (action === 'continue-game' && game) { screen = 'game'; selected = null; playSound('menuOpen'); render(); return; }
      if (action === 'new-game') { screen = 'new-game'; selected = null; playSound('menuOpen'); render(); return; }
      if (action === 'start-classic') return startClassic();
      if (action === 'toggle-soundEnabled') return toggleSetting('soundEnabled');
      if (action === 'toggle-highContrast') return toggleSetting('highContrast');
      if (action === 'toggle-largeText') return toggleSetting('largeText');
      if (action === 'toggle-reducedMotion') return toggleSetting('reducedMotion');
      if (action === 'select-hand') return selectHand(Number(element.dataset.index));
      if (action === 'select-pile') return selectPile(element.dataset.zone, Number(element.dataset.index));
      if (action === 'draw') return handleDraw();
      if (action === 'undo') return undo();
    });
    element.addEventListener('focus', () => playSound('menuFocus'));
  });
}

document.addEventListener('keydown', (event) => {
  if (screen !== 'game') return;
  if (event.key === 'Escape' && selected) {
    event.preventDefault();
    selected = null;
    announce(t('selectionCancelled'), 'cardCancel');
    render();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    handleDraw();
  }
});

render();
