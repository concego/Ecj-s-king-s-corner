import { getText } from './i18n.js?v=klondike-2';
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
import {
  createKlondikeGame,
  drawKlondikeStock,
  klondikeCardName,
  moveKlondikeCards,
  klondikeSourceCards,
  tableauFaceUpStart,
} from './klondike.js?v=klondike-1';

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const SAVED_GAME_KEY = 'ecj-kings-corner-game';
const SETTINGS_KEY = 'ecj-kings-corner-settings';
const SCOREBOARD_KEY = 'ecj-kings-corner-scoreboard';
const SELECTED_BOTS_KEY = 'ecj-kings-corner-selected-bots';
const KLONDIKE_DRAW_COUNT_KEY = 'ecj-kings-corner-klondike-draw-count';
const BOT_DIALOGUE_PAUSE_MS = 3000;
const MATCH_END_DISPLAY_MS = 7000;
const BOT_STALL_ROUND_LIMIT = 3;
const MATCH_SCORE_VERSION = 2;
const MATCH_WIN_BONUS = 10;
const MATCH_LOSS_PENALTY = 5;
const PROFILE_AVATARS = [
  { id: 'hearts', symbol: '♥' },
  { id: 'diamonds', symbol: '♦' },
  { id: 'clubs', symbol: '♣' },
  { id: 'spades', symbol: '♠' },
];
const PROFILE_NAME_MAX_LENGTH = 24;
const PROFILE_GENDERS = ['unspecified', 'feminine', 'masculine', 'nonbinary', 'other'];

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
let selectedKlondikeDrawCount = loadKlondikeDrawCount();
let klondikeFocus = { row: 0, column: 0, cardIndex: 0 };
let matchEndTimer = null;

function loadSelectedBots() {
  try {
    const saved = JSON.parse(localStorage.getItem(SELECTED_BOTS_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((id) => ['lion', 'dog', 'fox'].includes(id)) : [];
  } catch {
    return [];
  }
}

function loadKlondikeDrawCount() {
  const saved = Number(localStorage.getItem(KLONDIKE_DRAW_COUNT_KEY));
  return [1, 3].includes(saved) ? saved : 3;
}

function defaultProfile() {
  return { displayName: '', gender: 'unspecified', avatar: 'hearts' };
}

function defaultSettings() {
  return { soundEnabled: true, highContrast: false, largeText: false, reducedMotion: false, profile: defaultProfile() };
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {};
    const savedProfile = saved.profile && typeof saved.profile === 'object' ? saved.profile : {};
    const profile = { ...defaultProfile(), ...savedProfile };
    return {
      ...defaultSettings(),
      ...saved,
      profile: {
        displayName: String(profile.displayName || '').trim().slice(0, PROFILE_NAME_MAX_LENGTH),
        gender: PROFILE_GENDERS.includes(profile.gender) ? profile.gender : 'unspecified',
        avatar: PROFILE_AVATARS.some((item) => item.id === profile.avatar) ? profile.avatar : 'hearts',
      },
    };
  } catch {
    return defaultSettings();
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  setAudioEnabled(settings.soundEnabled);
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_GAME_KEY) || 'null');
    if (!saved) return null;
    if (saved.mode === 'klondike') {
      if (!Array.isArray(saved.stock) || !Array.isArray(saved.waste) || !Array.isArray(saved.tableau) || saved.tableau.length !== 7 || !Array.isArray(saved.foundations) || saved.foundations.length !== 4 || saved.foundations.some((pile) => !Array.isArray(pile.cards))) return null;
      return {
        ...saved,
        drawCount: [1, 3].includes(Number(saved.drawCount)) ? Number(saved.drawCount) : 3,
        moves: Number(saved.moves) || 0,
        draws: Number(saved.draws) || 0,
        status: ['playing', 'won'].includes(saved.status) ? saved.status : 'playing',
      };
    }
    if (!saved?.hand || !saved?.stock || !saved?.foundations || !saved?.corners) return null;
    const loaded = {
      mode: 'training', score: 0, usedCardPoints: 0, drawnCardPoints: 0,
      invalidMoves: 0, stackBonuses: 0, cyclePenalties: 0, undoCount: 0,
      resultAwarded: false, scoreSaved: false, scoredKingIds: [], moveLog: [], turnActionCount: 0, botDialogueLog: [], botRoundCardPlays: 0, botNoProgressRounds: 0, botBlockReason: null, ...saved,
    };
    if (loaded.mode === 'bots' && Number(loaded.scoreVersion || 0) < MATCH_SCORE_VERSION && loaded.status === 'playing') {
      loaded.score = 0;
      loaded.usedCardPoints = 0;
      loaded.drawnCardPoints = 0;
      loaded.invalidMoves = 0;
      loaded.stackBonuses = 0;
      loaded.cyclePenalties = 0;
      loaded.scoredKingIds = [];
      loaded.moveLog = [];
      loaded.resultAwarded = false;
      loaded.botScoreSaved = false;
      loaded.botPlayers = (loaded.botPlayers || []).map((bot) => ({ ...bot, score: 0, scoredKingIds: [], moveLog: [] }));
    }
    loaded.scoreVersion = MATCH_SCORE_VERSION;
    return loaded;
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

function cancelPendingMatchMenuReturn() {
  if (matchEndTimer) window.clearTimeout(matchEndTimer);
  matchEndTimer = null;
  if (game && ['won', 'blocked'].includes(game.status)) {
    awardResultIfNeeded();
    if (game.mode === 'bots') saveBotScoreIfNeeded();
    else saveScoreIfNeeded();
    game = null;
    localStorage.removeItem(SAVED_GAME_KEY);
  }
}

function returnFinishedMatchToMenu() {
  if (matchEndTimer) window.clearTimeout(matchEndTimer);
  matchEndTimer = null;
  screen = 'menu';
  selected = null;
  mobileSection = 'board';
  game = null;
  localStorage.removeItem(SAVED_GAME_KEY);
  render();
}

function scheduleFinishedMatchReturn() {
  if (matchEndTimer) window.clearTimeout(matchEndTimer);
  matchEndTimer = window.setTimeout(() => {
    if (game && ['won', 'blocked'].includes(game.status) && screen === 'game') returnFinishedMatchToMenu();
  }, MATCH_END_DISPLAY_MS);
}

function finishSinglePlayerMatch() {
  if (!game || game.mode === 'bots' || !['won', 'blocked'].includes(game.status)) return;
  localStorage.removeItem(SAVED_GAME_KEY);
  announceResult();
  scheduleFinishedMatchReturn();
}

function botScoreStandings() {
  if (game?.mode !== 'bots') return [];
  const resultFor = (participantId) => {
    if (game.status === 'blocked') return t('botScoreBlocked');
    if (game.status !== 'won') return '';
    return (participantId === 'human' ? game.winnerId === 'human' : game.winnerId === participantId)
      ? t('botScoreVictory')
      : t('botScoreDefeat');
  };
  return [
    { id: 'human', name: settings.profile.displayName.trim() || t('you'), avatar: settings.profile.avatar, avatarLabel: profileAvatarLabel(settings.profile.avatar), score: Number(game.score) || 0, result: resultFor('human') },
    ...game.botPlayers.map((bot) => ({ id: bot.id, name: botName(bot.id), score: Number(bot.score) || 0, result: resultFor(bot.id) })),
  ].sort((a, b) => b.score - a.score);
}

function renderBotScores() {
  const standings = botScoreStandings();
  if (!standings.length) return '';
  const rows = standings.map((player, index) => {
    const avatar = player.id === 'human' ? `<span class="profile-match-avatar ${player.avatar}" aria-hidden="true">${profileAvatarSymbol(player.avatar)}</span>` : '';
    return `<li>${avatar}${escapeHtml(t('botScoreLine', index + 1, player.name, player.score, player.result, player.avatarLabel || ''))}</li>`;
  }).join('');
  return `<section class="bot-scoreboard" aria-labelledby="bot-scoreboard-heading"><h2 id="bot-scoreboard-heading">${escapeHtml(t('botScoreHeading', game.status))}</h2><ol>${rows}</ol></section>`;
}

function botScoreLines() {
  return botScoreStandings().map((player, index) => t('botScoreLine', index + 1, player.name, player.score, player.result, player.avatarLabel || ''));
}

function botScoreAnnouncement() {
  const lines = botScoreLines();
  return lines.length ? t('botScoreFinal', lines.join('. ')) : '';
}

function finishBotMatch(message, sound) {
  if (game?.mode !== 'bots') return;
  awardResultIfNeeded();
  saveBotScoreIfNeeded();
  localStorage.removeItem(SAVED_GAME_KEY);
  screen = 'game';
  selected = null;
  mobileSection = 'board';
  render();
  announce(`${message} ${botScoreAnnouncement()}`, sound);
  scheduleFinishedMatchReturn();
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
  const hasProfile = settings.profile.displayName || settings.profile.gender !== 'unspecified' || settings.profile.avatar !== 'hearts';
  const profileSummary = hasProfile ? `<p class="profile-menu-summary"><span class="profile-menu-avatar ${settings.profile.avatar}" aria-hidden="true">${profileAvatarSymbol()}</span>${escapeHtml(t('profileWelcome', settings.profile.displayName, settings.profile.gender))}</p>` : '';
  app.innerHTML = screenShell(t('menuTitle'), t('menuLead'), `<div class="panel button-list" aria-label="${escapeHtml(t('menuTitle'))}">
    ${profileSummary}
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

function settingRow(title, description, control) {
  return `<div class="setting"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></div>${control}</div>`;
}

function optionsBackButton() {
  return `<div class="button-list">${button(t('backToOptions'), 'back-options', 'class="secondary"')}</div>`;
}

function renderOptions() {
  const optionRow = (title, description, action) => settingRow(title, description, button(t('openOptionMenu', title), action, 'class="secondary"'));
  app.innerHTML = screenShell(t('options'), t('optionsLead'), `<div class="panel">
    <div class="setting-list">
      ${optionRow(t('accessibilityTitle'), t('accessibilityMenuDescription'), 'open-options-accessibility')}
      ${optionRow(t('sounds'), t('soundsMenuDescription'), 'open-options-sounds')}
      ${optionRow(t('language'), t('languageMenuDescription'), 'open-options-language')}
      ${optionRow(t('profileTitle'), t('profileMenuDescription'), 'open-options-profile')}
    </div>
    <div class="button-list">${button(t('backMainMenu'), 'back-menu', 'class="secondary"')}</div>
  </div>`);
}

function renderAccessibilityOptions() {
  app.innerHTML = screenShell(t('accessibilityTitle'), t('accessibilityLead'), `<div class="panel">
    <div class="setting-list">
      ${settingRow(t('highContrast'), t('highContrastDescription'), toggleButton('highContrast', t('highContrast')))}
      ${settingRow(t('largeText'), t('largeTextDescription'), toggleButton('largeText', t('largeText')))}
      ${settingRow(t('reducedMotion'), t('reducedMotionDescription'), toggleButton('reducedMotion', t('reducedMotion')))}
    </div>
    ${optionsBackButton()}
  </div>`);
}

function renderSoundOptions() {
  app.innerHTML = screenShell(t('sounds'), t('soundsMenuDescription'), `<div class="panel">
    <div class="setting-list">${settingRow(t('sounds'), t('soundsDescription'), toggleButton('soundEnabled', t('sounds')))}</div>
    ${optionsBackButton()}
  </div>`);
}

function renderLanguageOptions() {
  app.innerHTML = screenShell(t('language'), t('languageMenuDescription'), `<div class="panel">
    <div class="button-list">
      ${button('Português (Brasil)', 'choose-language', `class="${locale === 'pt-BR' ? '' : 'secondary'}" aria-pressed="${locale === 'pt-BR'}" data-locale="pt-BR"`)}
      ${button('English', 'choose-language', `class="${locale === 'en' ? '' : 'secondary'}" aria-pressed="${locale === 'en'}" data-locale="en"`)}
    </div>
    ${optionsBackButton()}
  </div>`);
}

function profileAvatarLabel(id) {
  return t(`profileAvatar${id[0].toUpperCase()}${id.slice(1)}`);
}

function profileAvatarSymbol(id = settings.profile.avatar) {
  return PROFILE_AVATARS.find((item) => item.id === id)?.symbol || PROFILE_AVATARS[0].symbol;
}

function profileGenderLabel(gender) {
  return t(`profileGender${gender[0].toUpperCase()}${gender.slice(1)}`);
}

function renderProfileOptions() {
  const avatarChoices = PROFILE_AVATARS.map((avatar) => `<label class="avatar-option">
    <input type="radio" name="profileAvatar" value="${avatar.id}" ${settings.profile.avatar === avatar.id ? 'checked' : ''}>
    <span class="avatar-option-symbol ${avatar.id}" aria-hidden="true">${avatar.symbol}</span>
    <span>${escapeHtml(profileAvatarLabel(avatar.id))}</span>
  </label>`).join('');
  app.innerHTML = screenShell(t('profileTitle'), t('profileLead'), `<div class="panel">
    <form id="profile-form" class="profile-form">
      <label class="profile-field"><span>${escapeHtml(t('profileDisplayName'))}</span><input type="text" name="profileName" maxlength="${PROFILE_NAME_MAX_LENGTH}" autocomplete="nickname" value="${escapeHtml(settings.profile.displayName)}" aria-describedby="profile-name-help"></label>
      <small id="profile-name-help">${escapeHtml(t('profileNameDescription'))}</small>
      <label class="profile-field"><span>${escapeHtml(t('profileGender'))}</span><select name="profileGender" aria-describedby="profile-gender-help">${PROFILE_GENDERS.map((gender) => `<option value="${gender}" ${settings.profile.gender === gender ? 'selected' : ''}>${escapeHtml(profileGenderLabel(gender))}</option>`).join('')}</select></label>
      <small id="profile-gender-help">${escapeHtml(t('profileGenderDescription'))}</small>
      <fieldset class="profile-avatar-fieldset"><legend>${escapeHtml(t('profileAvatar'))}</legend><p>${escapeHtml(t('profileAvatarDescription'))}</p><div class="avatar-grid">${avatarChoices}</div></fieldset>
      <p class="legend">${escapeHtml(t('profileLocalStorage'))}</p>
      <button type="submit">${escapeHtml(t('saveProfile'))}</button>
    </form>
    ${optionsBackButton()}
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
  if (game?.mode === 'klondike' && previousScreen === 'game') {
    const rules = ['klondikeHelpDeck', 'klondikeHelpTableau', 'klondikeHelpFoundations', 'klondikeHelpStock'];
    app.innerHTML = screenShell(t('helpTitle'), '', `<div class="panel help-content klondike-help">
      <section aria-labelledby="klondike-help-objective"><h2 id="klondike-help-objective">${escapeHtml(t('klondikeHelpObjectiveHeading'))}</h2><p>${escapeHtml(t('klondikeHelpObjective'))}</p></section>
      <section aria-labelledby="klondike-help-rules"><h2 id="klondike-help-rules">${escapeHtml(t('klondikeHelpRulesHeading'))}</h2><ul>${rules.map((key) => `<li>${escapeHtml(t(key))}</li>`).join('')}</ul></section>
      <section aria-labelledby="klondike-help-controls"><h2 id="klondike-help-controls">${escapeHtml(t('klondikeHelpControlsHeading'))}</h2><ul>${['klondikeHelpArrows', 'klondikeHelpEnter', 'helpKeyUndo', 'helpKeyEscape', 'helpKeyH'].map((key) => `<li>${escapeHtml(t(key))}</li>`).join('')}</ul></section>
      <div class="button-list">${button(t('back'), 'back-help', 'class="secondary"')}</div>
    </div>`);
    return;
  }
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
      <div class="setting"><div><strong>${escapeHtml(t('botsMode'))}</strong><small>${escapeHtml(t('botSelectionNote'))}</small></div>${button(t('botsMode'), 'open-bot-setup', 'class="secondary"')}</div>
      <div class="setting"><div><strong>${escapeHtml(t('klondikeTitle'))}</strong><small>${escapeHtml(t('klondikeDescription'))}</small></div>${button(t('klondikeTitle'), 'open-klondike-setup', 'class="secondary"')}</div>
    </fieldset>
    <div class="inline-actions">${button(t('back'), 'back-game-menu', 'class="secondary"')}</div>
  </div>`);
}

function renderKlondikeSetup() {
  app.innerHTML = screenShell(t('klondikeTitle'), t('klondikeDescription'), `<div class="panel">
    <fieldset class="klondike-draw-choice">
      <legend>${escapeHtml(t('klondikeDrawChoice'))}</legend>
      ${button(t('klondikeDrawOne'), 'set-klondike-draw-count', `class="${selectedKlondikeDrawCount === 1 ? '' : 'secondary'}" data-count="1" aria-pressed="${selectedKlondikeDrawCount === 1}"`)}
      ${button(t('klondikeDrawThree'), 'set-klondike-draw-count', `class="${selectedKlondikeDrawCount === 3 ? '' : 'secondary'}" data-count="3" aria-pressed="${selectedKlondikeDrawCount === 3}"`)}
    </fieldset>
    <div class="button-list">${button(t('startKlondike'), 'start-klondike')}${button(t('back'), 'back-klondike-setup', 'class="secondary"')}</div>
  </div>`);
}

const BOT_IDS = ['lion', 'dog', 'fox'];

function renderBotMatchSetup() {
  app.innerHTML = screenShell(t('botsMode'), t('botSelectionNote'), `<div class="panel button-list">
    <p class="legend">${escapeHtml(t('botSelectionCount', selectedBotIds.length))}</p>
    ${button(t('selectBots'), 'open-bot-selection')}
    ${button(t('startBotMatch'), 'start-bot-match', `${selectedBotIds.length ? 'class="secondary"' : 'class="secondary" disabled="disabled"'}`)}
    ${button(t('back'), 'back-bot-setup', 'class="secondary"')}
  </div>`);
}

function openBotMatchSetup() {
  selectedBotIds = [];
  localStorage.setItem(SELECTED_BOTS_KEY, '[]');
  screen = 'bot-match-setup';
  playSound('menuOpen');
  render();
}

function renderBotSelection() {
  const options = BOT_IDS.map((id, index) => {
    const name = t(`bot${id[0].toUpperCase()}${id.slice(1)}`);
    const selectedNow = selectedBotIds.includes(id);
    const personality = t(`bot${id[0].toUpperCase()}${id.slice(1)}Personality`);
    return `<div class="bot-option" role="row" aria-label="${escapeHtml(name)}" data-bot-option-index="${index}">
      <div class="bot-option-profile" role="rowheader"><img class="bot-portrait" src="./assets/bots/${id}.webp" alt="" aria-hidden="true" role="presentation" width="240" height="240"><div><strong>${escapeHtml(name)}</strong><p>${escapeHtml(personality)}</p></div></div>
      <div class="bot-option-cell" role="cell"><span class="bot-option-mobile-label">${escapeHtml(t('botPhysicalDescriptionColumn'))}</span>${button(t('readBotAppearance', name, id), 'read-bot-appearance', `class="secondary" data-bot-id="${id}"`)}</div>
      <div class="bot-option-cell" role="cell"><span class="bot-option-mobile-label">${escapeHtml(t('botSelectionColumn'))}</span>${button(selectedNow ? t('deselectBot', name) : t('selectBot', name), 'toggle-bot-selection', `class="${selectedNow ? '' : 'secondary'}" data-bot-id="${id}" aria-pressed="${selectedNow}"`)}</div>
    </div>`;
  }).join('');
  app.innerHTML = screenShell(t('botSelectionTitle'), t('botSelectionLead'), `<div class="panel bot-selection-list"><p class="legend">${escapeHtml(t('botSelectionCount', selectedBotIds.length))}</p><div class="bot-option-table" role="table" aria-label="${escapeHtml(t('botSelectionTitle'))}"><div class="bot-option-head" role="row"><span role="columnheader">${escapeHtml(t('botColumnName'))}</span><span role="columnheader">${escapeHtml(t('botPhysicalDescriptionColumn'))}</span><span role="columnheader">${escapeHtml(t('botSelectionColumn'))}</span></div><div role="rowgroup">${options}</div></div><div class="bot-selection-return">${button(t('back'), 'back-bot-selection', 'class="secondary"')}</div></div>`, false);
}

function toggleBotSelection(id) {
  if (!BOT_IDS.includes(id)) return;
  selectedBotIds = selectedBotIds.includes(id) ? selectedBotIds.filter((item) => item !== id) : [...selectedBotIds, id];
  localStorage.setItem(SELECTED_BOTS_KEY, JSON.stringify(selectedBotIds));
  announce(t('botSelectionCount', selectedBotIds.length), 'confirm');
  render();
}

function readBotAppearance(id) {
  if (!BOT_IDS.includes(id)) return;
  const key = `bot${id[0].toUpperCase()}${id.slice(1)}Appearance`;
  announce(t(key));
}

function canonicalScoreMode(mode) {
  const normalized = String(mode || '').trim().toLocaleLowerCase();
  if (['record', 'record solo', 'solo record'].includes(normalized)) return 'record';
  if (['bots', 'jogar contra bots', 'play against bots'].includes(normalized)) return 'bots';
  return null;
}

function migrateScoreEntry(entry) {
  const mode = canonicalScoreMode(entry.mode);
  let score = Number(entry.score);
  if (Number(entry.scoreVersion || 0) < MATCH_SCORE_VERSION) {
    const victory = ['victory', 'Vitória', 'Victory'].includes(entry.result);
    const defeat = ['defeat', 'Derrota', 'Defeat'].includes(entry.result);
    if (mode === 'bots' && victory) score = MATCH_WIN_BONUS;
    else if (mode === 'bots' && defeat) score = -MATCH_LOSS_PENALTY;
    else if (mode === 'record' && victory) score += MATCH_WIN_BONUS - 100;
    else if (mode === 'record' && defeat) score += 100 - MATCH_LOSS_PENALTY;
  }
  return { ...entry, mode: mode || entry.mode, score, scoreVersion: MATCH_SCORE_VERSION };
}

function topScoreboardEntries(entries) {
  return ['record', 'bots'].flatMap((mode) => entries
    .filter((entry) => entry.mode === mode)
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 3));
}

function scoreboardEntries() {
  try {
    const entries = JSON.parse(localStorage.getItem(SCOREBOARD_KEY) || '[]');
    if (!Array.isArray(entries)) return [];
    const validEntries = entries
      .filter((entry) => entry && Number.isFinite(Number(entry.score)) && canonicalScoreMode(entry.mode))
      .map(migrateScoreEntry);
    const sortedEntries = topScoreboardEntries(validEntries);
    if (JSON.stringify(sortedEntries) !== JSON.stringify(entries)) {
      localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(sortedEntries));
    }
    return sortedEntries;
  } catch { return []; }
}

function storeScoreboardEntries(newEntries) {
  const entries = topScoreboardEntries([...scoreboardEntries(), ...newEntries]);
  localStorage.setItem(SCOREBOARD_KEY, JSON.stringify(entries));
}

function storeScoreboardEntry(entry) {
  storeScoreboardEntries([entry]);
}

function scoreboardModeLabel(mode) {
  if (mode === 'record' || mode === 'Record solo' || mode === 'Solo record') return t('recordSolo');
  if (mode === 'bots' || mode === 'Jogar contra bots' || mode === 'Play against bots') return t('botsMode');
  return mode || '';
}

function scoreboardResultLabel(result) {
  if (result === 'victory' || result === 'Vitória' || result === 'Victory') return t('scoreboardVictory');
  if (result === 'defeat' || result === 'Derrota' || result === 'Defeat') return t('scoreboardDefeat');
  return result || '';
}

function renderMural() {
  const entries = scoreboardEntries();
  const sections = ['record', 'bots'].map((mode) => {
    const modeLabel = scoreboardModeLabel(mode);
    const modeEntries = entries.filter((entry) => entry.mode === mode);
    const rows = modeEntries.map((entry, index) => {
      const playerName = entry.botId && BOT_IDS.includes(entry.botId) ? botName(entry.botId) : entry.name || t('you');
      return `<tr><th scope="row">${index + 1}</th><td>${escapeHtml(playerName)}</td><td>${escapeHtml(String(entry.score))}</td><td>${escapeHtml(scoreboardResultLabel(entry.result))}</td></tr>`;
    }).join('');
    const table = modeEntries.length
      ? `<div class="table-wrapper"><table class="scoreboard-table"><caption>${escapeHtml(t('scoreboardTableCaption', modeLabel))}</caption><thead><tr><th scope="col">${escapeHtml(t('scoreboardPosition'))}</th><th scope="col">${escapeHtml(t('scoreboardParticipant'))}</th><th scope="col">${escapeHtml(t('scoreboardPoints'))}</th><th scope="col">${escapeHtml(t('scoreboardResult'))}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p>${escapeHtml(t('scoreboardModeEmpty', modeLabel))}</p>`;
    return `<section class="scoreboard-mode" aria-labelledby="scoreboard-mode-${mode}"><h2 id="scoreboard-mode-${mode}">${escapeHtml(modeLabel)}</h2>${table}</section>`;
  }).join('');
  app.innerHTML = screenShell(t('scoreboardTitle'), t('scoreboardLead'), `<div class="panel">${sections}<div class="button-list">${button(t('backToMenu'), 'back-menu', 'class="secondary"')}</div></div>`);
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

function klondikeSuitName(suit) {
  const details = SUIT_BY_ID[suit];
  return locale === 'pt-BR' ? details?.pt || suit : details?.en || suit;
}

function klondikeTopDescriptor(column) {
  if (column === 0) return { zone: 'stock' };
  if (column === 1) return { zone: 'waste', index: game.waste.length - 1, indexCard: game.waste.length - 1 };
  if (column >= 3) {
    const index = column - 3;
    return { zone: 'foundation', index, indexCard: game.foundations[index].cards.length - 1 };
  }
  return null;
}

function sameKlondikeSource(first, second) {
  return first?.zone === second?.zone && first?.index === second?.index && first?.indexCard === second?.indexCard;
}

function klondikeSourceAt(row, column, cardIndex = 0) {
  if (row === 0) return klondikeTopDescriptor(column);
  return { zone: 'tableau', index: column, indexCard: cardIndex };
}

function klondikePositionLabel(row, column, cardIndex = 0) {
  if (row === 0 && column === 0) return t('klondikeStockLabel', game.stock.length, game.drawCount);
  if (row === 0 && column === 1) {
    const top = game.waste[game.waste.length - 1];
    return top ? t('klondikeWasteTop', klondikeCardName(top, locale), game.waste.length) : t('klondikeWasteEmpty');
  }
  if (row === 0 && column >= 3) {
    const foundation = game.foundations[column - 3];
    const top = foundation.cards[foundation.cards.length - 1];
    const suit = klondikeSuitName(foundation.suit);
    return top ? t('klondikeFoundationTop', suit, klondikeCardName(top, locale), foundation.cards.length) : t('klondikeFoundationEmpty', suit);
  }
  const pile = game.tableau[column];
  if (!pile.length) return t('klondikeTableauEmpty', column + 1);
  const card = pile[cardIndex];
  if (!card?.faceUp) return t('klondikeTableauEmpty', column + 1);
  return t('klondikeTableauCard', column + 1, tableauFaceUpStart(pile), klondikeCardName(card, locale), pile.length - cardIndex);
}

function renderKlondikeTopSlot(column) {
  if (column === 2) return '<div class="klondike-top-gap" role="presentation" aria-hidden="true"></div>';
  const descriptor = klondikeTopDescriptor(column);
  const selectedNow = sameKlondikeSource(selected, descriptor);
  const focused = klondikeFocus.row === 0 && klondikeFocus.column === column;
  let content = '';
  let visibleLabel = '';
  if (column === 0) { content = game.stock.length ? cardSvg(null, true) : `<span>${escapeHtml(t('emptyPile'))}</span>`; visibleLabel = t('stock'); }
  else if (column === 1) { content = game.waste.length ? cardSvg(game.waste[game.waste.length - 1]) : `<span>${escapeHtml(t('emptyPile'))}</span>`; visibleLabel = t('klondikeWasteName'); }
  else {
    const foundation = game.foundations[column - 3];
    const top = foundation.cards[foundation.cards.length - 1];
    content = top ? cardSvg(top) : `<span>${escapeHtml(t('emptyPile'))}</span>`;
    visibleLabel = klondikeSuitName(foundation.suit);
  }
  const label = klondikePositionLabel(0, column);
  return `<button type="button" class="klondike-slot${focused ? ' focused' : ''}${selectedNow ? ' selected' : ''}" role="gridcell" id="klondike-focus-0-${column}-0" data-action="klondike-activate" data-row="0" data-column="${column}" data-card-index="0" aria-label="${escapeHtml(label)}" aria-pressed="${selectedNow}" aria-rowindex="1" aria-colindex="${column + 1}" tabindex="-1">${content}<span class="klondike-pile-label" aria-hidden="true">${escapeHtml(visibleLabel)}</span></button>`;
}

function renderKlondikeTableauColumn(column) {
  const pile = game.tableau[column];
  const faceUpStart = tableauFaceUpStart(pile);
  if (!pile.length) {
    const focused = klondikeFocus.row === 1 && klondikeFocus.column === column;
    return `<div class="klondike-column" role="gridcell" aria-label="${escapeHtml(t('klondikeTableauEmpty', column + 1))}"><button type="button" class="klondike-slot klondike-empty-column${focused ? ' focused' : ''}" id="klondike-focus-1-${column}-0" data-action="klondike-activate" data-row="1" data-column="${column}" data-card-index="0" aria-label="${escapeHtml(t('klondikeTableauEmpty', column + 1))}" aria-pressed="false" tabindex="-1">${escapeHtml(t('emptyPile'))}</button></div>`;
  }
  const backs = pile.slice(0, faceUpStart).map(() => `<span class="klondike-card-back" aria-hidden="true">${cardSvg(null, true)}</span>`).join('');
  const faceUpCards = pile.slice(faceUpStart).map((card, offset) => {
    const cardIndex = faceUpStart + offset;
    const focused = klondikeFocus.row === 1 && klondikeFocus.column === column && klondikeFocus.cardIndex === cardIndex;
    const source = { zone: 'tableau', index: column, indexCard: cardIndex };
    const selectedNow = sameKlondikeSource(selected, source);
    const label = klondikePositionLabel(1, column, cardIndex);
    return `<button type="button" class="klondike-card${focused ? ' focused' : ''}${selectedNow ? ' selected' : ''}" id="klondike-focus-1-${column}-${cardIndex}" data-action="klondike-activate" data-row="1" data-column="${column}" data-card-index="${cardIndex}" aria-label="${escapeHtml(label)}" aria-pressed="${selectedNow}" tabindex="-1">${cardSvg(card)}</button>`;
  }).join('');
  return `<div class="klondike-column" role="gridcell" aria-label="${escapeHtml(t('klondikeColumnLabel', column + 1, pile.length))}"><div class="klondike-card-stack">${backs}${faceUpCards}</div></div>`;
}

function renderKlondikeGame() {
  normalizeKlondikeFocus();
  const statusText = game.status === 'won' ? t('klondikeWonStatus') : t('klondikeInstructions');
  const activeId = klondikeFocus.row === 0
    ? `klondike-focus-0-${klondikeFocus.column}-0`
    : game.tableau[klondikeFocus.column].length
      ? `klondike-focus-1-${klondikeFocus.column}-${klondikeFocus.cardIndex}`
      : `klondike-focus-1-${klondikeFocus.column}-0`;
  const undoExtra = `class="secondary" aria-keyshortcuts="Control+Z" ${game.status !== 'playing' ? 'disabled' : ''}`;
  app.innerHTML = `<div class="screen klondike-screen">
    <header class="game-header"><div><h1>${escapeHtml(t('klondikeTitle'))}</h1><p class="game-status">${escapeHtml(statusText)}</p></div><div class="inline-actions klondike-controls">${button(t('undo'), 'undo', undoExtra)}${button(t('newGameShort'), 'new-game', 'class="secondary"')}${button(t('menu'), 'back-menu', 'class="secondary" aria-keyshortcuts="Escape"')}${button(t('help'), 'menu-help', 'class="secondary" aria-keyshortcuts="H"')}</div></header>
    <p class="klondike-summary">${escapeHtml(t('movesCount', game.moves))} — ${escapeHtml(t('klondikeDrawChoice'))}: ${game.drawCount}</p>
    <div class="klondike-board-scroll"><div class="klondike-board" role="grid" tabindex="0" data-focus-zone="klondike-board" aria-label="${escapeHtml(t('klondikeGridLabel'))}" aria-activedescendant="${activeId}">
      <div class="klondike-top-row" role="row">${Array.from({ length: 7 }, (_, column) => renderKlondikeTopSlot(column)).join('')}</div>
      <div class="klondike-tableau-row" role="row">${Array.from({ length: 7 }, (_, column) => renderKlondikeTableauColumn(column)).join('')}</div>
    </div></div>
  </div>`;
}

function renderGame() {
  if (game?.mode === 'klondike') { renderKlondikeGame(); return; }
  const names = [t('foundationNorth'), t('foundationEast'), t('foundationSouth'), t('foundationWest')];
  const corners = [t('cornerNorthWest'), t('cornerNorthEast'), t('cornerSouthEast'), t('cornerSouthWest')];
  const statusText = game.status === 'won' ? t('winnerStatus', game.winnerId === 'human' ? t('you') : botName(game.winnerId)) : game.status === 'blocked' ? t('blocked') : game.mode === 'bots' ? (game.activeTurn === 0 ? t('yourTurn') : t('botTurn', botName(game.activeBotId))) : t('instructions');
  const gameTitle = isRecordGame() ? t('recordGameTitle') : game.mode === 'bots' ? t('botsGameTitle') : t('gameTitle');
  const undoExtra = `class="secondary" aria-keyshortcuts="Control+Z" ${game.status !== 'playing' || game.mode === 'bots' ? 'disabled' : ''}`;
  const scoreText = isRecordGame() ? `<p class="game-score" aria-live="polite">${escapeHtml(t('scoreLabel', game.score))}</p>` : '';
  const botScores = game.mode === 'bots' ? renderBotScores() : '';
  const scoreDetails = isRecordGame() && game.status !== 'playing' ? `<p class="score-breakdown">${escapeHtml(t('scoreBreakdown', game.usedCardPoints, -game.drawnCardPoints, game.invalidMoves * 3, game.stackBonuses * 5, game.cyclePenalties * 5, game.undoCount * 10, game.status === 'won' ? t('scoreVictory') : t('scoreDefeat')))}</p>` : '';
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
  const mobileControls = `<section class="mobile-game-section controls-section${mobileSection === 'controls' ? '' : ' mobile-section-hidden'}" data-mobile-section="controls" aria-labelledby="controls-section-heading"><h2 id="controls-section-heading" class="mobile-section-title">${escapeHtml(t('controlsSection'))}</h2><div class="mobile-control-list">${game.mode === 'bots' && game.status === 'playing' && game.activeTurn === 0 ? button(t('passTurn'), 'pass-turn', 'class="secondary" aria-keyshortcuts="N"') : ''}${button(t('backMainMenu'), 'back-menu', 'class="secondary" aria-keyshortcuts="Escape"')}${button(t('help'), 'menu-help', 'class="secondary" aria-keyshortcuts="H"')}${isRecordGame() || game.mode === 'bots' ? button(t('checkScore'), 'check-score', 'class="secondary" aria-keyshortcuts="S"') : ''}${button(t('undo'), 'undo', undoExtra)}</div></section>`;
  const turnSummary = game.mode === 'bots' ? `<p class="game-turn">${escapeHtml(t('botMatchTurnHint'))}</p>` : '';
  const dialogueLog = game.mode === 'bots' && Array.isArray(game.botDialogueLog) ? game.botDialogueLog : [];
  const latestDialogue = dialogueLog.at(-1);
  const earlierDialogue = dialogueLog.slice(-3, -1);
  const botDialogue = latestDialogue
    ? `<section class="bot-dialogue" aria-labelledby="bot-dialogue-heading"><h2 id="bot-dialogue-heading">${escapeHtml(t('botDialogueHeading'))}</h2><p class="bot-dialogue-latest">${escapeHtml(t('botDialogueLabel', botName(latestDialogue.botId), latestDialogue.line))}</p>${earlierDialogue.length ? `<ul aria-label="${escapeHtml(t('botDialogueHistory'))}">${earlierDialogue.map((entry) => `<li>${escapeHtml(t('botDialogueLabel', botName(entry.botId), entry.line))}</li>`).join('')}</ul>` : ''}</section>`
    : '';
  const mobileNavigation = `<section class="mobile-section-navigation" aria-labelledby="mobile-navigation-heading"><h2 id="mobile-navigation-heading">${escapeHtml(t('sectionNavigation'))}</h2><nav class="mobile-section-nav-list" aria-label="${escapeHtml(t('sectionNavigation'))}">${button(t('boardSection'), 'mobile-section', `class="secondary" data-section="board" aria-controls="board-section-heading" aria-pressed="${mobileSection === 'board'}"`)}${button(t('handSection'), 'mobile-section', `class="secondary" data-section="hand" aria-controls="hand-section-heading" aria-pressed="${mobileSection === 'hand'}"`)}${button(t('controlsSection'), 'mobile-section', `class="secondary" data-section="controls" aria-controls="controls-section-heading" aria-pressed="${mobileSection === 'controls'}"`)}</nav></section>`;
  const currentSectionHeading = `<h2 id="mobile-current-section" class="mobile-current-section" tabindex="-1">${escapeHtml(t('currentSection', mobileSection === 'board' ? t('boardSection') : mobileSection === 'hand' ? t('handSection') : t('controlsSection')))}</h2>`;
  app.innerHTML = `<div class="screen">
    <header class="game-header"><div><h1>${escapeHtml(gameTitle)}</h1><p id="game-instructions" class="game-status">${escapeHtml(statusText)}</p>${botDialogue}${scoreText}${botScores}${scoreDetails}</div><div class="inline-actions desktop-controls">${game.mode === 'bots' && game.status === 'playing' && game.activeTurn === 0 ? button(t('passTurn'), 'pass-turn', 'class="secondary" aria-keyshortcuts="N" tabindex="-1"') : ''} ${button(t('undo'), 'undo', `${undoExtra} tabindex="-1"`)} ${button(t('newGameShort'), 'new-game', 'class="secondary" tabindex="-1"')} ${button(t('menu'), 'back-menu', 'class="secondary" tabindex="-1" aria-keyshortcuts="Escape"')}</div></header>
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
  if (screen !== 'bot-selection') return;
  const botOptions = [...app.querySelectorAll('.bot-option')];
  botOptions.forEach((option, index) => {
    option.addEventListener('keydown', (event) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const current = event.target.closest('button, a');
      if (!current || !option.contains(current)) return;
      event.preventDefault();
      event.stopPropagation();
      const currentOptions = focusableElements(option);
      const optionIndex = currentOptions.indexOf(current);
      let target = null;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const nextOption = botOptions[index + (event.key === 'ArrowDown' ? 1 : -1)];
        const nextOptions = nextOption ? focusableElements(nextOption) : [];
        target = nextOptions[optionIndex] || null;
      } else {
        target = currentOptions[optionIndex + (event.key === 'ArrowRight' ? 1 : -1)] || null;
      }
      if (!target) return;
      target.focus({ preventScroll: true });
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
    count: element.dataset.count,
    botId: element.dataset.botId,
  };
}

function restoreFocus(descriptor) {
  if (!descriptor) return focusFirstControl();
  if (descriptor.action === 'klondike-activate') {
    app.querySelector('[data-focus-zone="klondike-board"]')?.focus({ preventScroll: true });
    return;
  }
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
      && element.dataset.count === descriptor.count
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
  if (screen === 'options-accessibility') renderAccessibilityOptions();
  if (screen === 'options-sounds') renderSoundOptions();
  if (screen === 'options-language') renderLanguageOptions();
  if (screen === 'options-profile') renderProfileOptions();
  if (screen === 'credits') renderCredits();
  if (screen === 'help') renderHelp();
  if (screen === 'game-menu') renderGameMenu();
  if (screen === 'new-game') renderNewGame();
  if (screen === 'klondike-setup') renderKlondikeSetup();
  if (screen === 'bot-match-setup') renderBotMatchSetup();
  if (screen === 'bot-selection') renderBotSelection();
  if (screen === 'mural') renderMural();
  if (screen === 'game') renderGame();
  bindActions();
  bindKlondikeGrid();
  setupArrowNavigation();
  bindGameZones();
  restoreFocus(previousFocus);
}

function scoreMove(before, source, destination, moved) {
  if (!isRecordGame() && game?.mode !== 'bots') return;
  if (!game.scoredKingIds) game.scoredKingIds = [];
  const cardPoints = moved.reduce((sum, card) => sum + card.rank, 0);
  if (source.zone === 'hand') {
    game.usedCardPoints += cardPoints;
    game.score += cardPoints;
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
  if ((!isRecordGame() && game?.mode !== 'bots') || game.status !== 'playing') return;
  game.invalidMoves += 1;
  game.score -= 3;
}

function saveScoreIfNeeded() {
  if (!isRecordGame() || game.scoreSaved || !['won', 'blocked'].includes(game.status)) return;
  storeScoreboardEntry({ score: game.score, mode: 'record', name: settings.profile.displayName.trim(), result: game.status === 'won' ? 'victory' : 'defeat', scoreVersion: MATCH_SCORE_VERSION, date: new Date().toISOString() });
  game.scoreSaved = true;
}

function saveBotScoreIfNeeded() {
  if (game?.mode !== 'bots' || game.botScoreSaved || !['won', 'blocked'].includes(game.status)) return;
  const date = new Date().toISOString();
  const entries = [
    {
      mode: 'bots',
      name: settings.profile.displayName.trim(),
      score: Number(game.score) || 0,
      result: game.status === 'won' && game.winnerId === 'human' ? 'victory' : 'defeat',
      scoreVersion: MATCH_SCORE_VERSION,
      date,
    },
    ...game.botPlayers.map((bot) => ({
      mode: 'bots',
      botId: bot.id,
      score: Number(bot.score) || 0,
      result: game.status === 'won' && game.winnerId === bot.id ? 'victory' : 'defeat',
      scoreVersion: MATCH_SCORE_VERSION,
      date,
    })),
  ];
  storeScoreboardEntries(entries);
  game.botScoreSaved = true;
}

function awardResultIfNeeded() {
  if ((!isRecordGame() && game?.mode !== 'bots') || game.resultAwarded || !['won', 'blocked'].includes(game.status)) return;
  const humanWon = game.status === 'won' && (game.mode !== 'bots' || game.winnerId === 'human');
  game.score += humanWon ? MATCH_WIN_BONUS : -MATCH_LOSS_PENALTY;
  if (game.mode === 'bots') {
    game.botPlayers.forEach((bot) => {
      bot.score = (bot.score || 0) + (game.status === 'won' && game.winnerId === bot.id ? MATCH_WIN_BONUS : -MATCH_LOSS_PENALTY);
    });
  }
  game.resultAwarded = true;
  if (isRecordGame()) saveScoreIfNeeded();
}

function announceResult() {
  if (!isRecordGame() || !['won', 'blocked'].includes(game.status)) return;
  announce(t('resultScore', game.status === 'won' ? t('victory') : t('blocked'), game.score), game.status === 'won' ? 'victory' : 'error');
}

function checkScore() {
  if (game?.mode === 'bots') {
    announce(`${t('scoreLabel', game.score)}. ${t('botScoreCurrent', botScoreLines().join('. '))}`, 'confirm');
    return;
  }
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
      if (game.mode === 'bots' && isHumanTurn()) {
        game.turnActionCount = (game.turnActionCount || 0) + 1;
        if (source.zone === 'hand') game.botRoundCardPlays = (game.botRoundCardPlays || 0) + 1;
      }
      scoreMove(before, source, { zone, index }, movedCards);
      if (game.mode !== 'bots') updateBlockedStatus(game);
      if (game.mode === 'bots' && game.hand.length === 0) { game.status = 'won'; game.winnerId = 'human'; }
      awardResultIfNeeded();
      const moveSound = source.zone === 'hand' ? 'cardPlay' : 'stackMove';
      selected = null;
      saveScoreIfNeeded();
      saveGame();
      render();
      if (game.mode === 'bots' && game.status === 'won') finishBotMatch(t('winnerStatus', t('you')), 'victory');
      else if (['won', 'blocked'].includes(game.status)) finishSinglePlayerMatch();
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
  if ((isRecordGame() || game.mode === 'bots') && card.rank !== 13) {
    game.drawnCardPoints += card.rank;
    game.score -= card.rank;
  }
  if (game.mode !== 'bots') updateBlockedStatus(game);
  awardResultIfNeeded();
  saveScoreIfNeeded();
  saveGame();
  const finished = ['won', 'blocked'].includes(game.status);
  if (!finished) announce(t('cardDrawn'), 'cardDraw');
  render();
  if (finished) finishSinglePlayerMatch();
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

function countPlayableHandCards(hand, foundations, corners) {
  return hand.filter((card) =>
    foundations.some((pile) => canPlaceCard(card, pile, 'foundation'))
      || corners.some((pile) => canPlaceCard(card, pile, 'corner')),
  ).length;
}

// Mirror Record Solo point deltas; only Lion uses them to choose moves.
function botMoveScore(bot, source, destination, moved, destinationPile) {
  let scoreDelta = source.zone === 'hand' ? moved.reduce((sum, card) => sum + card.rank, 0) : 0;
  let kingIdToScore = null;
  const scoredKingIds = Array.isArray(bot.scoredKingIds) ? bot.scoredKingIds : [];
  if (source.zone !== 'hand' && destination.zone === 'corner' && !destinationPile.length
    && moved[0]?.rank === 13 && !scoredKingIds.includes(moved[0].id)) {
    scoreDelta += 13;
    kingIdToScore = moved[0].id;
  }
  if (source.zone !== 'hand' && moved.length >= 2 && destinationPile.length) scoreDelta += 5;
  const sourceKey = `${source.zone}:${source.index}`;
  const destinationKey = `${destination.zone}:${destination.index}`;
  const movedIds = moved.map((card) => card.id);
  const repeatedReturn = (bot.moveLog || []).some((entry) => entry.source === destinationKey
    && entry.destination === sourceKey && JSON.stringify(entry.movedIds) === JSON.stringify(movedIds));
  if (repeatedReturn) scoreDelta -= 5;
  const actionScoreDelta = scoreDelta;
  if (source.zone === 'hand' && bot.hand.length === 1) scoreDelta += MATCH_WIN_BONUS;
  return { scoreDelta, actionScoreDelta, kingIdToScore, movedIds };
}

function recordBotMoveScore(bot, move) {
  bot.score = (bot.score || 0) + move.actionScoreDelta;
  bot.scoredKingIds = Array.isArray(bot.scoredKingIds) ? bot.scoredKingIds : [];
  if (move.kingIdToScore && !bot.scoredKingIds.includes(move.kingIdToScore)) bot.scoredKingIds.push(move.kingIdToScore);
  bot.moveLog = Array.isArray(bot.moveLog) ? bot.moveLog : [];
  bot.moveLog.push({
    movedIds: [...move.movedIds],
    source: `${move.source.zone}:${move.source.index}`,
    destination: `${move.destination.zone}:${move.destination.index}`,
  });
}

function botMoves(bot) {
  const humanHand = game.hand;
  game.hand = bot.hand;
  const candidates = [];
  const piles = [
    ...game.foundations.map((pile, index) => ({ zone: 'foundation', index, pile })),
    ...game.corners.map((pile, index) => ({ zone: 'corner', index, pile })),
  ];
  const currentHandOptions = countPlayableHandCards(bot.hand, game.foundations, game.corners);

  game.hand.forEach((card, index) => {
    piles.forEach((target) => {
      if (!canPlaceCard(card, target.pile, target.zone)) return;
      const source = { zone: 'hand', index };
      const destination = { zone: target.zone, index: target.index };
      const trial = cloneGame(game);
      trial.hand = bot.hand.map((handCard) => ({ ...handCard }));
      moveSelected(trial, source, destination);
      candidates.push({
        source,
        destination,
        value: card.rank,
        removesHand: true,
        followUpOptions: countPlayableHandCards(trial.hand, trial.foundations, trial.corners),
        ...botMoveScore(bot, source, destination, [card], target.pile),
      });
    });
  });

  // A pile move is considered only when it creates additional legal plays
  // from this bot's hand. This rules out purposeless shuffling and reversals.
  piles.forEach((source) => piles.forEach((target) => {
    if (!source.pile.length || (source.zone === target.zone && source.index === target.index)
      || !canMoveStack(source.pile, target.pile, target.zone)) return;
    const moveSource = { zone: source.zone, index: source.index };
    const destination = { zone: target.zone, index: target.index };
    const trial = cloneGame(game);
    trial.hand = bot.hand.map((card) => ({ ...card }));
    if (!moveSelected(trial, moveSource, destination)) return;
    const followUpOptions = countPlayableHandCards(trial.hand, trial.foundations, trial.corners);
    if (followUpOptions <= currentHandOptions) return;
    candidates.push({
      source: moveSource,
      destination,
      value: source.pile.reduce((sum, card) => sum + card.rank, 0),
      removesHand: false,
      followUpOptions,
      sourceCount: source.pile.length,
      opensFoundation: source.zone === 'foundation',
      ...botMoveScore(bot, moveSource, destination, source.pile, target.pile),
    });
  }));
  game.hand = humanHand;
  return candidates;
}

function botPileName(zone, index) {
  if (zone === 'foundation') return [t('foundationNorth'), t('foundationEast'), t('foundationSouth'), t('foundationWest')][index];
  return [t('cornerNorthWest'), t('cornerNorthEast'), t('cornerSouthEast'), t('cornerSouthWest')][index];
}

function addBotDialogue(bot, event, roundMessages) {
  const lines = t('botDialogueLines', bot.id, event);
  if (!Array.isArray(lines) || !lines.length) return;
  const options = lines.map((line, index) => ({ line, index }))
    .filter((choice) => lines.length === 1 || choice.index !== bot.lastDialogueIndex);
  const choice = options[Math.floor(Math.random() * options.length)] || { line: lines[0], index: 0 };
  bot.lastDialogueIndex = choice.index;
  game.botDialogueLog = Array.isArray(game.botDialogueLog) ? game.botDialogueLog : [];
  game.botDialogueLog.push({ botId: bot.id, line: choice.line });
  game.botDialogueLog = game.botDialogueLog.slice(-6);
  roundMessages.push(t('botDialogueLabel', botName(bot.id), choice.line));
}

function chooseBotMove(bot, candidates) {
  const handMoves = candidates.filter((move) => move.removesHand);
  const pileMoves = candidates.filter((move) => !move.removesHand);
  if (bot.id === 'lion') {
    return [...candidates].sort((a, b) => b.scoreDelta - a.scoreDelta
      || b.followUpOptions - a.followUpOptions
      || Number(b.removesHand) - Number(a.removesHand)
      || b.value - a.value)[0];
  }
  if (bot.id === 'fox') {
    if (handMoves.length) return [...handMoves].sort((a, b) => b.followUpOptions - a.followUpOptions || a.value - b.value)[0];
    return [...pileMoves].sort((a, b) => b.followUpOptions - a.followUpOptions || Number(b.opensFoundation) - Number(a.opensFoundation) || a.value - b.value)[0];
  }
  if (handMoves.length) return handMoves[Math.floor(Math.random() * handMoves.length)];
  return [...pileMoves].sort((a, b) => a.sourceCount - b.sourceCount || a.value - b.value || a.source.index - b.source.index || a.destination.index - b.destination.index)[0];
}

function checkBotMatchBlocked() {
  if (game.status !== 'playing') return;
  if (game.stock.length) {
    game.botNoProgressRounds = 0;
    game.botRoundCardPlays = 0;
    return;
  }
  const humanHand = game.hand;
  const allHaveNoHandMoves = [null, ...game.botPlayers].every((participant) => {
    game.hand = participant ? participant.hand : humanHand;
    const noMoves = !hasLegalHandMove(game);
    game.hand = humanHand;
    return noMoves;
  });
  if (!allHaveNoHandMoves) {
    game.botNoProgressRounds = 0;
    game.botRoundCardPlays = 0;
    return;
  }
  if (!hasLegalPileMove(game)) {
    game.status = 'blocked';
    game.botBlockReason = 'no-moves';
    return;
  }
  if (game.botRoundCardPlays > 0) game.botNoProgressRounds = 0;
  else game.botNoProgressRounds = (game.botNoProgressRounds || 0) + 1;
  game.botRoundCardPlays = 0;
  if (game.botNoProgressRounds >= BOT_STALL_ROUND_LIMIT) {
    game.status = 'blocked';
    game.botBlockReason = 'stall';
  }
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

async function runBotTurn(turnIndex, initialSteps = 0) {
  if (game.status !== 'playing') return;

  // Complete bot turns in a bounded loop rather than depending on a chain of
  // delayed callbacks. A skipped/no-move turn must always advance to the next
  // participant and eventually restore the human turn.
  const turnMessages = [];
  const dialogueMessages = [];
  for (let currentTurn = turnIndex; currentTurn <= game.botPlayers.length && game.status === 'playing'; currentTurn += 1) {
    const bot = game.botPlayers[currentTurn - 1];
    game.activeTurn = currentTurn;
    game.activeBotId = bot.id;
    game.turnActionCount = 0;
    render();
    announce(t('botTurn', botName(bot.id)));

    const botMessageStart = turnMessages.length;
    let steps = currentTurn === turnIndex ? initialSteps : 0;
    let skipped = false;
    let lastAction = 'idle';
    while (game.status === 'playing') {
      const candidates = botMoves(bot);
      const handMoves = candidates.filter((move) => move.removesHand);
      const lionHasScoringPileMove = bot.id === 'lion' && candidates.some((move) => !move.removesHand && move.scoreDelta >= 0);

      if (!handMoves.length && !game.turnDrew && game.stock.length && !lionHasScoringPileMove) {
        const humanHand = game.hand;
        game.hand = bot.hand;
        const drawnCard = drawCard(game);
        bot.hand = game.hand;
        game.hand = humanHand;
        if (drawnCard && drawnCard.rank !== 13) bot.score = (bot.score || 0) - drawnCard.rank;
        game.turnDrew = true;
        game.turnActionCount = (game.turnActionCount || 0) + 1;
        lastAction = 'draw';
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

      const chosen = chooseBotMove(bot, candidates);
      if (!chosen) {
        turnMessages.push(t('botSkipped', botName(bot.id)));
        game.turnDrew = false;
        skipped = true;
        break;
      }

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
      recordBotMoveScore(bot, chosen);
      if (chosen.removesHand) game.botRoundCardPlays = (game.botRoundCardPlays || 0) + 1;
      game.turnActionCount = (game.turnActionCount || 0) + 1;

      if (!bot.hand.length) { game.status = 'won'; game.winnerId = bot.id; lastAction = 'win'; }
      const actionMessage = sourceCard
        ? t('botPlayedCard', botName(bot.id), cardAccessibleName(sourceCard, locale), destinationName)
        : t('botMovedPile', botName(bot.id), movedCount, destinationName);
      turnMessages.push(actionMessage);
      lastAction = sourceCard ? 'card' : 'pile';
      saveGame();
      render();
      if (game.status === 'won') break;
    }
    if (game.status === 'won' && game.winnerId === bot.id) lastAction = 'win';
    const botActionMessages = turnMessages.slice(botMessageStart);
    const dialogueCountBefore = dialogueMessages.length;
    addBotDialogue(bot, lastAction, dialogueMessages);
    saveGame();
    render();
    const latestDialogue = dialogueMessages.length > dialogueCountBefore ? dialogueMessages[dialogueMessages.length - 1] : null;
    const botTurnAnnouncement = [...botActionMessages, latestDialogue].filter(Boolean).join(' ');
    announce(botTurnAnnouncement, botActionMessages.length ? 'cardPlay' : 'confirm');
    await new Promise((resolve) => window.setTimeout(resolve, BOT_DIALOGUE_PAUSE_MS));
    if (!game || game.mode !== 'bots' || screen !== 'game') return;
    if (game.status === 'won') break;
    if (!skipped) game.turnDrew = false;
  }

  if (game.status === 'won') {
    finishBotMatch(t('winnerStatus', botName(game.winnerId)), 'victory');
    return;
  }

  game.activeTurn = 0;
  game.activeBotId = null;
  game.turnDrew = false;
  game.turnActionCount = 0;
  checkBotMatchBlocked();
  saveGame();
  if (game.status === 'blocked') {
    finishBotMatch(game.botBlockReason === 'stall' ? t('botStalled') : t('blocked'), 'error');
    return;
  }
  render();
  announce(t('yourTurn'), turnMessages.length ? 'cardPlay' : 'confirm');
}

function startGame(mode) {
  if (matchEndTimer) window.clearTimeout(matchEndTimer);
  matchEndTimer = null;
  game = createGame(mode);
  game.scoreVersion = MATCH_SCORE_VERSION;
  if (mode === 'bots') {
    game.botPlayers = selectedBotIds.map((id) => ({ id, hand: game.stock.splice(0, 7), score: 0, scoredKingIds: [], moveLog: [] }));
    game.activeTurn = 0; game.activeBotId = null; game.turnDrew = false; game.turnActionCount = 0; game.winnerId = null; game.botDialogueLog = [];
    game.botRoundCardPlays = 0; game.botNoProgressRounds = 0; game.botBlockReason = null;
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

function startKlondikeGame() {
  if (matchEndTimer) window.clearTimeout(matchEndTimer);
  matchEndTimer = null;
  game = createKlondikeGame({ drawCount: selectedKlondikeDrawCount });
  history = [];
  selected = null;
  klondikeFocus = { row: 0, column: 0, cardIndex: 0 };
  saveGame();
  screen = 'game';
  announce(t('gameSaved'), 'confirm');
  render();
  app.querySelector('[data-focus-zone="klondike-board"]')?.focus({ preventScroll: true });
}

function setKlondikeDrawCount(value) {
  const count = Number(value);
  if (![1, 3].includes(count)) return;
  selectedKlondikeDrawCount = count;
  localStorage.setItem(KLONDIKE_DRAW_COUNT_KEY, String(count));
  announce(t('klondikeDrawChoiceSaved', count), 'confirm');
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

function saveProfile(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const displayName = String(formData.get('profileName') || '').trim().slice(0, PROFILE_NAME_MAX_LENGTH);
  const requestedGender = String(formData.get('profileGender') || 'unspecified');
  const gender = PROFILE_GENDERS.includes(requestedGender) ? requestedGender : 'unspecified';
  const requestedAvatar = String(formData.get('profileAvatar') || 'hearts');
  const avatar = PROFILE_AVATARS.some((item) => item.id === requestedAvatar) ? requestedAvatar : 'hearts';
  settings = { ...settings, profile: { ...settings.profile, displayName, gender, avatar } };
  saveSettings();
  announce(t('profileSaved'), 'confirm');
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
      if (game?.mode === 'bots' && game.status === 'playing' && game.activeTurn > 0 && ['back-menu', 'new-game', 'menu-help'].includes(action)) {
        announce(t('botTurn', botName(game.activeBotId)));
        return;
      }
      if (action === 'choose-language') return chooseLanguage(element.dataset.locale);
      if (action === 'menu-start') { screen = 'game-menu'; playSound('menuOpen'); render(); return; }
      if (action === 'menu-mural') { screen = 'mural'; playSound('menuOpen'); render(); return; }
      if (action === 'menu-options') { screen = 'options'; playSound('menuOpen'); render(); return; }
      if (action === 'open-options-accessibility') { screen = 'options-accessibility'; playSound('menuOpen'); render(); return; }
      if (action === 'open-options-sounds') { screen = 'options-sounds'; playSound('menuOpen'); render(); return; }
      if (action === 'open-options-language') { screen = 'options-language'; playSound('menuOpen'); render(); return; }
      if (action === 'open-options-profile') { screen = 'options-profile'; playSound('menuOpen'); render(); return; }
      if (action === 'menu-help') { previousScreen = screen; screen = 'help'; playSound('menuOpen'); render(); return; }
      if (action === 'mobile-section') {
        mobileSection = element.dataset.section;
        render();
        app.querySelector('#mobile-current-section')?.focus({ preventScroll: true });
        return;
      }
      if (action === 'menu-credits') { screen = 'credits'; playSound('menuOpen'); render(); return; }
      if (action === 'back-help') {
        screen = previousScreen;
        playSound('menuBack');
        render();
        if (screen === 'game' && game?.mode === 'klondike' && game.status === 'won') scheduleFinishedMatchReturn();
        return;
      }
      if (action === 'back-options') { screen = 'options'; playSound('menuBack'); render(); return; }
      if (action === 'back-menu') { cancelPendingMatchMenuReturn(); screen = 'menu'; selected = null; playSound('menuBack'); render(); return; }
      if (action === 'back-game-menu') { screen = 'game-menu'; selected = null; playSound('menuBack'); render(); return; }
      if (action === 'continue-game' && game) { screen = 'game'; selected = null; playSound('menuOpen'); render(); if (game.mode === 'bots' && game.activeTurn > 0) runBotTurn(game.activeTurn, 0); return; }
      if (action === 'new-game') { screen = 'new-game'; selected = null; playSound('menuOpen'); render(); return; }
      if (action === 'open-klondike-setup') { screen = 'klondike-setup'; playSound('menuOpen'); render(); return; }
      if (action === 'back-klondike-setup') { screen = 'new-game'; playSound('menuBack'); render(); return; }
      if (action === 'set-klondike-draw-count') return setKlondikeDrawCount(element.dataset.count);
      if (action === 'start-klondike') return startKlondikeGame();
      if (action === 'klondike-activate') return activateKlondikePosition(Number(element.dataset.row), Number(element.dataset.column), Number(element.dataset.cardIndex));
      if (action === 'start-classic') return startClassic();
      if (action === 'start-training') return startClassic();
      if (action === 'start-record') return startRecordSolo();
      if (action === 'open-bot-setup') return openBotMatchSetup();
      if (action === 'open-bot-selection') { screen = 'bot-selection'; playSound('menuOpen'); render(); return; }
      if (action === 'toggle-bot-selection') return toggleBotSelection(element.dataset.botId);
      if (action === 'read-bot-appearance') return readBotAppearance(element.dataset.botId);
      if (action === 'save-bot-selection') { screen = 'new-game'; announce(t('botSelectionCount', selectedBotIds.length), 'confirm'); render(); return; }
      if (action === 'start-bot-match') return startBotMatch();
      if (action === 'pass-turn') return passHumanTurn();
      if (action === 'back-bot-selection') { screen = 'bot-match-setup'; render(); return; }
      if (action === 'back-bot-setup') { screen = 'new-game'; render(); return; }
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
  app.querySelector('#profile-form')?.addEventListener('submit', saveProfile);
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

function normalizeKlondikeFocus() {
  if (!game || game.mode !== 'klondike') return;
  if (klondikeFocus.row === 0) {
    klondikeFocus.column = Math.max(0, Math.min(6, Number(klondikeFocus.column) || 0));
    if (klondikeFocus.column === 2) klondikeFocus.column = 1;
    klondikeFocus.cardIndex = 0;
    return;
  }
  klondikeFocus.row = 1;
  klondikeFocus.column = Math.max(0, Math.min(6, Number(klondikeFocus.column) || 0));
  const pile = game.tableau[klondikeFocus.column];
  if (!pile?.length) { klondikeFocus.cardIndex = 0; return; }
  const firstFaceUp = tableauFaceUpStart(pile);
  klondikeFocus.cardIndex = Math.max(firstFaceUp, Math.min(pile.length - 1, Number(klondikeFocus.cardIndex) || firstFaceUp));
}

function klondikeFocusElementId() {
  normalizeKlondikeFocus();
  if (klondikeFocus.row === 0) return `klondike-focus-0-${klondikeFocus.column}-0`;
  return `klondike-focus-1-${klondikeFocus.column}-${klondikeFocus.cardIndex}`;
}

function syncKlondikeFocusDom() {
  const board = app.querySelector('[data-focus-zone="klondike-board"]');
  if (!board) return;
  const id = klondikeFocusElementId();
  board.setAttribute('aria-activedescendant', id);
  board.querySelectorAll('.focused').forEach((element) => element.classList.remove('focused'));
  const target = document.getElementById(id);
  target?.classList.add('focused');
  target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

function moveKlondikeFocus(direction) {
  normalizeKlondikeFocus();
  const before = { ...klondikeFocus };
  if (klondikeFocus.row === 0) {
    if (direction === 'ArrowLeft' || direction === 'ArrowRight') {
      const slots = [0, 1, 3, 4, 5, 6];
      const index = slots.indexOf(klondikeFocus.column);
      const next = Math.max(0, Math.min(slots.length - 1, index + (direction === 'ArrowRight' ? 1 : -1)));
      klondikeFocus.column = slots[next];
    } else if (direction === 'ArrowDown') {
      klondikeFocus.row = 1;
      klondikeFocus.cardIndex = tableauFaceUpStart(game.tableau[klondikeFocus.column]);
    }
  } else if (direction === 'ArrowLeft' || direction === 'ArrowRight') {
    const next = Math.max(0, Math.min(6, klondikeFocus.column + (direction === 'ArrowRight' ? 1 : -1)));
    klondikeFocus.column = next;
    klondikeFocus.cardIndex = tableauFaceUpStart(game.tableau[next]);
  } else if (direction === 'ArrowDown') {
    const pile = game.tableau[klondikeFocus.column];
    if (klondikeFocus.cardIndex < pile.length - 1) klondikeFocus.cardIndex += 1;
  } else if (direction === 'ArrowUp') {
    const pile = game.tableau[klondikeFocus.column];
    const firstFaceUp = tableauFaceUpStart(pile);
    if (klondikeFocus.cardIndex > firstFaceUp) klondikeFocus.cardIndex -= 1;
    else {
      klondikeFocus.row = 0;
      if (klondikeFocus.column === 2) klondikeFocus.column = 1;
      klondikeFocus.cardIndex = 0;
    }
  }
  normalizeKlondikeFocus();
  return before.row !== klondikeFocus.row || before.column !== klondikeFocus.column || before.cardIndex !== klondikeFocus.cardIndex;
}

function klondikeDestinationAt(row, column) {
  if (row === 1) return { zone: 'tableau', index: column };
  if (row === 0 && column >= 3) return { zone: 'foundation', index: column - 3 };
  return null;
}

function focusKlondikeBoard() {
  app.querySelector('[data-focus-zone="klondike-board"]')?.focus({ preventScroll: true });
}

function activateKlondikePosition(row, column, cardIndex = 0) {
  if (!game || game.mode !== 'klondike' || game.status !== 'playing') return;
  row = Number(row);
  column = Number(column);
  cardIndex = Number(cardIndex) || 0;
  klondikeFocus = { row, column, cardIndex };
  normalizeKlondikeFocus();
  focusKlondikeBoard();
  syncKlondikeFocusDom();
  if (row === 0 && column === 0) {
    const before = cloneGame(game);
    const result = drawKlondikeStock(game);
    if (!result.changed) { announce(t('klondikeNoCardsToDraw'), 'error'); return; }
    history.push(before);
    selected = null;
    saveGame();
    render();
    focusKlondikeBoard();
    announce(result.action === 'draw' ? t('klondikeDrawn', result.count) : t('klondikeRecycled', result.count), 'cardDraw');
    return;
  }
  const source = klondikeSourceAt(row, column, cardIndex);
  if (!source) { announce(t('klondikeChooseDestination'), 'error'); return; }
  const availableCards = klondikeSourceCards(game, source);
  if (!selected) {
    if (!availableCards.length) { announce(t('klondikePositionLabelUnavailable'), 'error'); return; }
    selected = source;
    render();
    focusKlondikeBoard();
    announce(`${klondikePositionLabel(row, column, cardIndex)}. ${t('selectDestination')}`, 'cardSelect');
    return;
  }
  if (sameKlondikeSource(selected, source)) {
    selected = null;
    render();
    focusKlondikeBoard();
    announce(t('selectionCancelled'), 'cardCancel');
    return;
  }
  const destination = klondikeDestinationAt(row, column);
  if (!destination) {
    if (availableCards.length) {
      selected = source;
      render();
      focusKlondikeBoard();
      announce(`${klondikePositionLabel(row, column, cardIndex)}. ${t('selectDestination')}`, 'cardSelect');
    } else announce(t('klondikeChooseDestination'), 'error');
    return;
  }
  const before = cloneGame(game);
  if (!moveKlondikeCards(game, selected, destination)) {
    syncKlondikeFocusDom();
    announce(t('invalidMove'), 'error');
    return;
  }
  history.push(before);
  selected = null;
  klondikeFocus = row === 1
    ? { row: 1, column, cardIndex: game.tableau[column].length ? game.tableau[column].length - 1 : 0 }
    : { row: 0, column, cardIndex: 0 };
  normalizeKlondikeFocus();
  saveGame();
  render();
  focusKlondikeBoard();
  if (game.status === 'won') {
    finishSinglePlayerMatch();
    announce(t('klondikeWonStatus'), 'victory');
  } else announce(t('moveMade'), 'cardPlay');
}

function bindKlondikeGrid() {
  if (screen !== 'game' || game?.mode !== 'klondike') return;
  const board = app.querySelector('[data-focus-zone="klondike-board"]');
  board?.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (moveKlondikeFocus(event.key)) {
        syncKlondikeFocusDom();
        announce(klondikePositionLabel(klondikeFocus.row, klondikeFocus.column, klondikeFocus.cardIndex));
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      activateKlondikePosition(klondikeFocus.row, klondikeFocus.column, klondikeFocus.cardIndex);
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
  if (screen === 'game' && game?.mode === 'bots' && game.status === 'playing' && game.activeTurn > 0 && ['escape', 'h'].includes(event.key.toLowerCase())) {
    event.preventDefault();
    announce(t('botTurn', botName(game.activeBotId)));
    return;
  }
  if (event.key === 'Escape' && (['options', 'credits', 'game-menu', 'new-game', 'klondike-setup', 'bot-match-setup', 'bot-selection', 'mural', 'help'].includes(screen) || screen.startsWith('options-'))) {
    event.preventDefault();
    const targetScreen = screen.startsWith('options-') ? 'options' : screen === 'new-game' ? 'game-menu' : screen === 'klondike-setup' ? 'new-game' : screen === 'bot-match-setup' ? 'new-game' : screen === 'bot-selection' ? 'bot-match-setup' : screen === 'help' ? previousScreen : 'menu';
    screen = targetScreen;
    render();
    if (targetScreen === 'game' && game?.mode === 'klondike' && game.status === 'won') scheduleFinishedMatchReturn();
    announce(targetScreen === 'menu' ? t('returnedMenu') : targetScreen === 'options' ? t('options') : t('gameMenuTitle'), 'menuBack');
    return;
  }
  if (!event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 'h') {
    event.preventDefault();
    previousScreen = screen;
    screen = 'help';
    render();
    return;
  }
  if (screen === 'game' && (isRecordGame() || game?.mode === 'bots') && !event.ctrlKey && !event.altKey && !event.metaKey && event.key.toLowerCase() === 's') {
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
      cancelPendingMatchMenuReturn();
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
