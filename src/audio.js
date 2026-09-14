const soundFiles = {
  cardDraw: 'assets/sounds/card-draw.wav',
  cardSelect: 'assets/sounds/card-select.wav',
  cardPlay: 'assets/sounds/card-play.wav',
  cardCancel: 'assets/sounds/card-cancel.wav',
  stackMove: 'assets/sounds/stack-move.wav',
  confirm: 'assets/sounds/confirm.wav',
  cancel: 'assets/sounds/cancel.wav',
  menuFocus: 'assets/sounds/menu-focus.wav',
  menuOpen: 'assets/sounds/menu-open.wav',
  menuBack: 'assets/sounds/menu-back.wav',
  error: 'assets/sounds/error.wav',
  victory: 'assets/sounds/victory.wav',
};

const cache = new Map();
let enabled = true;

export function setAudioEnabled(value) {
  enabled = Boolean(value);
}

export function playSound(name) {
  if (!enabled || !soundFiles[name]) return;
  let audio = cache.get(name);
  if (!audio) {
    audio = new Audio(soundFiles[name]);
    audio.preload = 'auto';
    cache.set(name, audio);
  }
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Autoplay policies may block a sound before the first user interaction.
  });
}
