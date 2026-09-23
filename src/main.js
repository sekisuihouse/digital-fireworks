/**
 * digital-fireworks エントリポイント
 * =========================================================================
 *   STEP 1  花火玉をつくる（直径6cmの円に直径1cmの珠を6色で配置）
 *   STEP 2  打ち上げる    （設計した玉をそのまま夜空でシミュレーション）
 *   STEP 3  ギャラリー    （保存した玉の一覧・みんなの花火）
 */
import { qs, qsa, setActive } from './core/dom.js';
import { uiIcon } from './components/icons.js';
import { showToast } from './components/toast.js';
import * as store from './app/state.js';
import * as storage from './storage/storage.js';
import {
  mountShellEditor,
  handleEditorKey,
  openPresets,
  newShell,
} from './shell-editor/shell-editor.js';
import { mountGallery, render as renderGallery } from './gallery/gallery.js';
import * as player from './player/player.js';
import { setSoundEnabled } from './fireworks-engine/audio.js';
import { cloneShell } from './types/shell.js';

let editorApi = null;
let currentScreen = 'editor';

function showScreen(name) {
  currentScreen = name;
  for (const s of qsa('.screen')) s.classList.toggle('is-active', s.dataset.screen === name);
  setActive(qsa('.tab'), qs(`.tab[data-screen="${name}"]`));
  if (name === 'gallery') renderGallery();
  if (name === 'editor') editorApi?.refreshSize();
}

function buildTopbar() {
  const undoBtn = qs('#btn-undo');
  const redoBtn = qs('#btn-redo');
  undoBtn.innerHTML = uiIcon('undo') + '<span>もどす</span>';
  redoBtn.innerHTML = uiIcon('redo') + '<span>やりなおす</span>';
  undoBtn.addEventListener('click', () => store.undo());
  redoBtn.addEventListener('click', () => store.redo());

  const soundBtn = qs('#btn-sound');
  const syncSound = () => {
    soundBtn.innerHTML = uiIcon(store.state.sound ? 'sound' : 'mute');
    soundBtn.classList.toggle('is-off', !store.state.sound);
    soundBtn.title = store.state.sound ? 'おとを けす' : 'おとを だす';
    setSoundEnabled(store.state.sound);
  };
  soundBtn.addEventListener('click', () => {
    store.setView({ sound: !store.state.sound });
    syncSound();
  });
  syncSound();

  const newBtn = qs('#btn-new');
  newBtn.innerHTML = uiIcon('brush') + '<span>あたらしく</span>';
  newBtn.addEventListener('click', () => newShell());

  for (const tab of qsa('.tab')) {
    tab.addEventListener('click', () => showScreen(tab.dataset.screen));
  }
}

function boot() {
  if (!storage.isStorageAvailable()) {
    showToast('この ブラウザでは ほぞんが つかえません', 'warn', 4000);
  }

  // 下書きの復元（リロードしても作りかけが消えない）
  const draft = storage.loadDraft();
  if (draft && draft.pellets.length) store.setShell(draft, { dirty: true });

  buildTopbar();

  editorApi = mountShellEditor(qs('#screen-editor'), { onSaved: () => renderGallery() });

  mountGallery(qs('#screen-gallery'), {
    onGoEditor: () => showScreen('editor'),
    onEdit: (rec) => {
      // 同じ id のまま読み込む -> 「ほぞん」で上書き更新になる
      store.setShell(cloneShell(rec.shell));
      showScreen('editor');
      showToast(`「${rec.name}」を ひらきました`, 'info');
    },
  });

  document.addEventListener('keydown', (e) => {
    if (player.isOpen()) return;
    if (currentScreen !== 'editor') return;
    if (qs('.modal-backdrop')) return;
    handleEditorKey(e);
  });

  // はじめての人にはおてほんを見せる（打ち上げ中や別のダイアログ中には割り込まない）
  const firstRun = !draft?.pellets.length && storage.listShells().length === 0;
  if (firstRun) {
    setTimeout(() => {
      if (player.isOpen() || qs('.modal-backdrop')) return;
      if (store.state.shell.pellets.length) return;
      openPresets();
    }, 450);
  }

  showScreen('editor');
  document.body.classList.remove('is-loading');

  // デバッグ用フック
  window.digitalFireworks = { store, storage, player, showScreen };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
