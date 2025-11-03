import { state } from './state.js';

export const fmtNumber = new Intl.NumberFormat('lt-LT', { maximumFractionDigits: 2 });
export const fmtSeconds = new Intl.NumberFormat('lt-LT', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function formatSec(sec) {
  return Number.isFinite(sec) ? `${fmtSeconds.format(sec)} s` : '-';
}

export function makeStatCell(label, value) {
  const cell = document.createElement('div');
  cell.className = 'statsCell';
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  const numeric = Number(value);
  valueEl.textContent = Number.isFinite(numeric) ? fmtNumber.format(numeric) : (value != null ? value : '-');
  cell.append(labelEl, valueEl);
  return cell;
}

export function playerLabel(id) {
  const player = state.players[id] || null;
  return player?.name || id || 'Nezinomas zaidejas';
}

export function dedupeShareAwards(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  list.forEach((award) => {
    const key = [
      award?.userId ?? '',
      award?.name ?? '',
      Number(award?.t ?? award?.timestamp ?? award?.time ?? 0),
      Number(award?.shares ?? award?.appliedShares ?? award?.rawShares ?? 0),
      Number(award?.points ?? award?.score ?? 0)
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    result.push(award);
  });
  return result;
}

export function collectSoloAttempts(data) {
  const attempts = Array.isArray(data?.miniGames?.solo?.attempts) ? [...data.miniGames.solo.attempts] : [];
  if (Array.isArray(data?.miniGames?.solo?.history)) {
    data.miniGames.solo.history.forEach((entry) => {
      if (Array.isArray(entry?.attempts)) attempts.push(...entry.attempts);
    });
  }
  const seen = new Set();
  const result = [];
  attempts.forEach((attempt) => {
    const key = [
      attempt?.userId ?? '',
      Number(attempt?.t ?? attempt?.timestamp ?? attempt?.startedAt ?? 0)
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    result.push(attempt);
  });
  return result;
}

export function getAnswerTimestamp(question, answer) {
  const base = Number(question?.revealedAt || 0);
  const sec = Number(answer?.sec);
  if (!Number.isFinite(sec)) return base || null;
  return base + Math.max(0, sec * 1000);
}

export function awardKey(maybeId, maybeName) {
  if (maybeId != null && maybeId !== '') return String(maybeId).toLowerCase();
  if (maybeName) return String(maybeName).toLowerCase();
  return null;
}
