﻿import { dom } from './dom.js';
import { state } from './state.js';
import { dedupeShareAwards } from './helpers.js';
import { renderSummary, renderPlayers, renderQuestions, renderMiniGames, closePlayerModal } from './renderers.js';

function setStatus(text, tone = 'muted') {
  if (!dom.statusMessage) return;
  dom.statusMessage.textContent = text;
  dom.statusMessage.style.color = tone === 'error' ? 'var(--danger)' : 'var(--muted)';
}

function resetView() {
  state.data = null;
  state.players = {};
  state.nameById.clear();

  dom.summaryGrid.innerHTML = '';
  dom.summaryMeta.textContent = '';
  dom.playerGrid.innerHTML = '';
  dom.playerGrid.className = '';

  dom.questionBody.innerHTML = '';
  dom.questionCount.textContent = '0';

  dom.miniContainer.innerHTML = '';
  dom.miniContainer.className = '';

  setStatus('Failas neįkeltas', 'muted');
  closePlayerModal();
}

function mapPlayers(rawPlayers) {
  const players = {};
  state.nameById.clear();

  Object.entries(rawPlayers || {}).forEach(([id, p]) => {
    const key = String(id).toLowerCase();
    const name = (p && (p.name || p.nickname || p.displayName)) || id;
    players[key] = {
      id: key,
      name,
      avatar: p?.avatar || p?.picture || '',
      finalScore: Number(p?.finalScore || p?.score || 0),
      lastSeen: p?.lastSeen || p?.lastActivity || null
    };
    if (name) state.nameById.set(key, name);
  });

  return players;
}

function ingestData(json, filename) {
  const ok =
    json &&
    typeof json === 'object' &&
    json.players &&
    typeof json.players === 'object' &&
    json.mainGame &&
    Array.isArray(json.mainGame.questions);

  if (!ok) {
    resetView();
    setStatus('Šis JSON failas neatitinka kq-logger žurnalo formato.', 'error');
    return;
  }

  state.data = json;
  state.players = mapPlayers(json.players);

  const sharesBlock = json.shares || {};
  if (!Array.isArray(sharesBlock.awards)) sharesBlock.awards = [];
  json.shares = sharesBlock;

  renderSummary(json, filename);
  renderPlayers(json);
  renderQuestions(json);
  renderMiniGames(json);

  setStatus('Įkeltas failas: ' + (filename || '–'), 'muted');
}

async function handleFile(file) {
  if (!file) return;

  resetView();
  setStatus('Nuskaitomas: ' + (file.name || '–') + '…', 'muted');

  try {
    const text = await file.text();
    const clean = text.replace(/^\uFEFF/, '').replace(/\u0000/g, '');
    const data = JSON.parse(clean);
    ingestData(data, file.name);
  } catch (err) {
    console.error(err);
    setStatus('Nepavyko nuskaityti JSON failo: ' + (file.name || '–'), 'error');
  }
}

function handleFiles(fileList) {
  if (!fileList || !fileList.length) return;
  const file = Array.from(fileList).find((f) => /\.json$/i.test(f.name));
  if (!file) {
    setStatus('Prašau pasirinkti .json failą', 'error');
    return;
  }
  handleFile(file);
}

function attachListeners() {
  if (dom.fileInput) {
    dom.fileInput.addEventListener('change', (ev) => {
      handleFiles(ev.target?.files);
      ev.target.value = '';
    });
  }

  if (dom.dropZone) {
    dom.dropZone.addEventListener('click', () => {
      dom.fileInput?.click();
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
      dom.dropZone.addEventListener(evt, (ev) => {
        if (evt === 'dragenter' || evt === 'dragover') {
          ev.preventDefault();
          dom.dropZone.classList.add('is-drag');
          return;
        }
        if (evt === 'dragleave') {
          ev.preventDefault();
          dom.dropZone.classList.remove('is-drag');
          return;
        }
        ev.preventDefault();
        dom.dropZone.classList.remove('is-drag');
      });
    });
    dom.dropZone.addEventListener('drop', (ev) => {
      const files = ev.dataTransfer?.files;
      if (files?.length) handleFiles(files);
    });
  }
}

// Auto-load JSON from GitHub
const AUTO_JSON_URL = 'https://raw.githubusercontent.com/Litas-dev/data/refs/heads/main/kqlog-2025-11-03-174801.json';

(async () => {
  try {
    const res = await fetch(AUTO_JSON_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    ingestData(data, AUTO_JSON_URL.split('/').pop());
  } catch (err) {
    console.error('Auto-load failed:', err);
  }
})();

attachListeners();
resetView();

