import { dom } from './dom.js';
import { state } from './state.js';
import {
  fmtNumber,
  formatSec,
  makeStatCell,
  playerLabel,
  dedupeShareAwards,
  collectSoloAttempts,
  getAnswerTimestamp,
  awardKey
} from './helpers.js';
import { openPlayerModal, closePlayerModal } from './modal.js';

// feature flags
const HIDE_SHARE_AWARDS = true;
const HIDE_SOLO_SECTION = true;

export { closePlayerModal };

export function renderSummary(data, filename) {
  dom.summaryGrid.innerHTML = '';
  const meta = data?.meta || {};
  const cards = [
    { label: 'Zurnalo failas', value: filename || '-' },
    { label: 'Diena', value: meta.day || meta.date || '-' },
    { label: 'Zaidejai', value: Object.keys(state.players).length },
    { label: 'Pagrindiniai klausimai', value: data?.mainGame?.questions?.length || 0 },
    { label: 'Pinigu raundai', value: data?.miniGames?.money?.questions?.length || 0 },
    { label: 'Zemelapio raundai', value: data?.miniGames?.map?.questions?.length || 0 },
    // Solo count only if not hidden
    ...(HIDE_SOLO_SECTION ? [] : [{ label: 'Solo bandymai', value: collectSoloAttempts(data).length || 0 }]),
    { label: 'Komandu ivykiai', value: data?.miniGames?.teamBattle?.events?.length || 0 }
  ];

  cards.forEach((card) => {
    const div = document.createElement('div');
    div.className = 'summaryCard';
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = card.label;
    const value = document.createElement('div');
    value.className = 'value';
    value.textContent = typeof card.value === 'number' ? fmtNumber.format(card.value) : card.value;
    div.append(label, value);
    dom.summaryGrid.appendChild(div);
  });

  dom.summaryMeta.textContent = meta.addonVersion ? 'Papildinys v' + meta.addonVersion : 'Momentine kopija';
}

export function renderPlayers(data) {
  const entries = Object.entries(state.players);
  const totalPlayers = entries.length;
  const countLabel = totalPlayers === 1 ? 'zaidejas' : 'zaidejai';
  dom.playerCount.textContent = `${totalPlayers} ${countLabel}`;

  if (!totalPlayers) {
    dom.playerGrid.className = 'emptyState';
    dom.playerGrid.textContent = 'Zaideju nera.';
    return;
  }

  dom.playerGrid.className = '';
  dom.playerGrid.classList.add('grid');
  dom.playerGrid.innerHTML = '';

  const mainQuestions = Array.isArray(data?.mainGame?.questions) ? data.mainGame.questions : [];
  const moneyQuestions = Array.isArray(data?.miniGames?.money?.questions) ? data.miniGames.money.questions : [];
  const mapQuestions = Array.isArray(data?.miniGames?.map?.questions) ? data.miniGames.map.questions : [];
  const soloAttemptsAll = collectSoloAttempts(data);
  const shareAwardsRaw = Array.isArray(data?.shares?.awards) ? data.shares.awards : [];
  const shareAwards = dedupeShareAwards(shareAwardsRaw);

  const questionSections = [
    { key: 'main', questions: mainQuestions },
    { key: 'money', questions: moneyQuestions },
    { key: 'map', questions: mapQuestions }
  ];

  const soloWins = new Map();
  const soloAttemptTotals = new Map();
  soloAttemptsAll.forEach((attempt) => {
    const userId = attempt?.userId;
    if (!userId) return;
    const key = String(userId).toLowerCase();
    soloAttemptTotals.set(key, (soloAttemptTotals.get(key) || 0) + 1);
    if (attempt?.ok) soloWins.set(key, (soloWins.get(key) || 0) + 1);
  });

  const sharePoints = new Map();
  const shareTotals = new Map();
  shareAwards.forEach((award) => {
    const key = awardKey(award?.userId, award?.name);
    if (!key) return;
    sharePoints.set(key, (sharePoints.get(key) || 0) + Number(award?.points || 0));
    shareTotals.set(key, (shareTotals.get(key) || 0) + Number(award?.shares || 0));
  });

  const firstAnswerCache = new Map();
  const findFirstAnswerTs = (playerId) => {
    if (firstAnswerCache.has(playerId)) return firstAnswerCache.get(playerId);
    let first = null;
    questionSections.forEach(({ questions }) => {
      questions.forEach((q) => {
        if (!Array.isArray(q?.answers)) return;
        q.answers.forEach((ans) => {
          if (ans?.userId !== playerId) return;
          const ts = getAnswerTimestamp(q, ans);
          if (ts && (!first || ts < first)) first = ts;
        });
      });
    });
    firstAnswerCache.set(playerId, first);
    return first;
  };

  const computeSectionStats = (questions, playerId, startTs) => {
    const stats = { answers: 0, corrects: 0, wrongs: 0 };
    if (!Array.isArray(questions)) return stats;
    questions.forEach((q) => {
      if (!Array.isArray(q?.answers)) return;
      const correctKey = q?.correctKey || null;
      q.answers.forEach((ans) => {
        if (ans?.userId !== playerId) return;
        const ts = getAnswerTimestamp(q, ans);
        if (startTs && ts && ts < startTs) return;
        stats.answers++;
        let ok = ans?.ok;
        if (ok == null && correctKey) ok = ans?.key === correctKey;
        if (ok === true) stats.corrects++;
        else if (ok === false) stats.wrongs++;
      });
    });
    return stats;
  };

  entries.sort(([, a], [, b]) => (b?.finalScore || 0) - (a?.finalScore || 0));

  entries.forEach(([id, player]) => {
    const card = document.createElement('div');
    card.className = 'playerCard';

    const header = document.createElement('div');
    header.className = 'playerHeader';

    const avatarBox = document.createElement('div');
    avatarBox.className = 'avatar';
    if (player?.avatar) {
      const img = document.createElement('img');
      img.src = player.avatar;
      img.alt = player?.name || id || 'Zaidejas';
      img.referrerPolicy = 'no-referrer';
      avatarBox.appendChild(img);
    } else {
      avatarBox.textContent = (player?.name || id || '?').charAt(0).toUpperCase();
    }

    const nameBlock = document.createElement('div');
    nameBlock.className = 'playerSummary';
    const title = document.createElement('strong');
    title.textContent = player?.name || id || 'Nezinomas zaidejas';
    const lastSeen = document.createElement('span');
    const seenDate = player?.lastSeen ? new Date(player.lastSeen) : null;
    lastSeen.textContent = seenDate ? 'Paskutini karta matytas ' + seenDate.toLocaleTimeString() : 'Paskutini karta matytas: -';
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = 'Spustelk, kad perziuretum statistika';
    nameBlock.append(title, lastSeen, hint);

    header.append(avatarBox, nameBlock);
    card.appendChild(header);

    const statsGrid = document.createElement('div');
    statsGrid.className = 'statsGrid';

    const idKey = String(id).toLowerCase();
    const soloAttempts = soloAttemptsAll.filter((attempt) => {
      if (!attempt?.userId) return false;
      return String(attempt.userId).toLowerCase() === idKey;
    });
    const firstAnswerTs = findFirstAnswerTs(id);
    const mainStats = computeSectionStats(mainQuestions, id, firstAnswerTs);
    const moneyStats = computeSectionStats(moneyQuestions, id, firstAnswerTs);
    const mapStats = computeSectionStats(mapQuestions, id, firstAnswerTs);
    const keyForAwards = awardKey(id, player?.name) || idKey;
    const sharePts = sharePoints.get(keyForAwards) || 0;
    const shareCnt = shareTotals.get(keyForAwards) || 0;
    const soloWinCount = soloWins.get(idKey) || 0;
    const soloAttemptCount = soloAttemptTotals.get(idKey) || 0;

    const totalAnswers = mainStats.answers + moneyStats.answers + mapStats.answers;
    const totalCorrect = mainStats.corrects + moneyStats.corrects + mapStats.corrects;
    const correctRate = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) + '%' : '-';

    [
      ['Galutinis rezultatas', player?.finalScore ?? 0],
      ['Is viso atsakymu', totalAnswers],
      ['Teisingu atsakymu', totalCorrect],
      ['Tikslumas', correctRate],
      ['Solo laimejimai', soloAttemptCount ? soloWinCount + '/' + soloAttemptCount : soloWinCount],
      ['Pasidalinta tasku', sharePts],
      ['Pasidalijimu kiekis', shareCnt]
    ].forEach(([label, value]) => statsGrid.appendChild(makeStatCell(label, value)));

    card.appendChild(statsGrid);

    const shareAwardsForPlayer = HIDE_SHARE_AWARDS
      ? []
      : shareAwards.filter((award) => {
          const key = awardKey(award?.userId, award?.name);
          return key && key === keyForAwards;
        });

    const modalData = {
      id,
      player,
      name: player?.name || id || 'Nezinomas zaidejas',
      avatar: player?.avatar || null,
      finalScore: player?.finalScore ?? 0,
      lastSeen: player?.lastSeen ? new Date(player.lastSeen) : null,
      totals: { main: mainStats, money: moneyStats, map: mapStats },
      aggregates: { totalScore: player?.finalScore ?? 0, totalAnswers, totalCorrect, correctRate, sharePts, shareCnt, soloWinCount, soloAttemptCount },
      shareAwards: shareAwardsForPlayer,
      soloAttempts
    };

    card.addEventListener('click', () => openPlayerModal(modalData));

    dom.playerGrid.appendChild(card);
  });

  // shares table gated by flag
  const shareSection = buildShareAwardsSection(shareAwards);
  if (!HIDE_SHARE_AWARDS && shareSection) {
    shareSection.style.gridColumn = '1 / -1';
    dom.playerGrid.appendChild(shareSection);
  }
}

export function renderQuestions(data) {
  const questions = Array.isArray(data?.mainGame?.questions) ? data.mainGame.questions : [];
  dom.questionCount.textContent = String(questions.length);
  dom.questionBody.innerHTML = '';

  if (!questions.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'emptyState';
    td.textContent = 'Klausimu nera.';
    tr.appendChild(td);
    dom.questionBody.appendChild(tr);
    return;
  }

  questions.forEach((q, index) => {
    const answers = Array.isArray(q?.answers) ? q.answers : [];
    const correctKey = q?.correctKey;
    const correctCount = answers.filter((ans) => ans?.ok === true || (correctKey && ans?.key === correctKey)).length;

    const first = q?.firstAnswer;
    const fastest = q?.fastestCorrect;

    const firstLabel = first?.userId ? `${playerLabel(first.userId)} (${formatSec(first.sec)})` : '-';
    const fastLabel = fastest?.userId ? `${playerLabel(fastest.userId)} (${formatSec(fastest.sec)})` : '-';

    const row = document.createElement('tr');
    [
      index + 1,
      q?.qid ?? '-',
      correctKey || '-',
      fmtNumber.format(answers.length),
      fmtNumber.format(correctCount),
      firstLabel,
      fastLabel
    ].forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    });

    dom.questionBody.appendChild(row);
  });
}

export function renderMiniGames(data) {
  const sections = [];
  const moneyRounds = Array.isArray(data?.miniGames?.money?.questions) ? data.miniGames.money.questions : [];
  const mapRounds = Array.isArray(data?.miniGames?.map?.questions) ? data.miniGames.map.questions : [];
  const soloAttempts = collectSoloAttempts(data);
  const teamEvents = Array.isArray(data?.miniGames?.teamBattle?.events) ? data.miniGames.teamBattle.events : [];

  if (moneyRounds.length) sections.push(buildMiniQuestionSection('Pinigu raundai', moneyRounds));
  if (mapRounds.length) sections.push(buildMiniQuestionSection('Zemelapio raundai', mapRounds));
  if (soloAttempts.length && !HIDE_SOLO_SECTION) sections.push(buildSoloSection(soloAttempts));
  if (teamEvents.length) sections.push(buildTeamSection(teamEvents));

  if (!sections.length) {
    dom.miniContainer.className = 'emptyState';
    dom.miniContainer.textContent = 'Mini zaidimu duomenu nera.';
    return;
  }

  dom.miniContainer.className = '';
  dom.miniContainer.innerHTML = '';
  sections.forEach((section) => dom.miniContainer.appendChild(section));
}

function buildShareAwardsSection(awards) {
  if (HIDE_SHARE_AWARDS) return null;
  if (!Array.isArray(awards) || !awards.length) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'miniSection';

  const header = document.createElement('div');
  header.className = 'miniHeader';
  const h = document.createElement('h3');
  h.textContent = 'Dalijimosi apdovanojimai';
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = `${awards.length} irasu`;
  header.append(h, chip);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'tableWrap';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['#', 'Zaidejas', 'Pasidalijimai', 'Taskai', 'Laikas'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  awards
    .slice()
    .sort((a, b) => {
      const at = a?.t ?? a?.timestamp ?? 0;
      const bt = b?.t ?? b?.timestamp ?? 0;
      return bt - at;
    })
    .forEach((award, index) => {
      const tr = document.createElement('tr');
      const stamp = award?.t ?? award?.timestamp;
      const when = stamp ? new Date(stamp).toLocaleTimeString() : '-';
      [
        index + 1,
        playerLabel(award?.userId) || award?.name || '-',
        fmtNumber.format(Number(award?.shares || 0)),
        fmtNumber.format(Number(award?.points || 0)),
        when
      ].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

  table.append(thead, tbody);
  tableWrap.appendChild(table);
  wrapper.append(header, tableWrap);
  return wrapper;
}

function buildMiniQuestionSection(title, rounds) {
  const wrapper = document.createElement('div');
  wrapper.className = 'miniSection';

  const header = document.createElement('div');
  header.className = 'miniHeader';
  const h = document.createElement('h3');
  h.textContent = title;
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = `${rounds.length} raund${rounds.length === 1 ? 'as' : 'ai'}`;
  header.append(h, chip);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'tableWrap';
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['#', 'Klausimo ID', 'Teisingas variantas', 'Atsakymai', 'Teisingi atsakymai'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  rounds.forEach((round, index) => {
    const answers = Array.isArray(round?.answers) ? round.answers : [];
    const correctKey = round?.correctKey;
    const correctCount = answers.filter((ans) => ans?.ok === true || (correctKey && ans?.key === correctKey)).length;

    const tr = document.createElement('tr');
    [
      index + 1,
      round?.qid ?? '-',
      correctKey || '-',
      fmtNumber.format(answers.length),
      fmtNumber.format(correctCount)
    ].forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  tableWrap.appendChild(table);
  wrapper.append(header, tableWrap);
  return wrapper;
}

function buildSoloSection(attempts) {
  const wrapper = document.createElement('div');
  wrapper.className = 'miniSection';

  const header = document.createElement('div');
  header.className = 'miniHeader';
  const h = document.createElement('h3');
  h.textContent = 'Solo bandymai';
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = `${attempts.length} irasu`;
  header.append(h, chip);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'tableWrap';
  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  ['#', 'Zaidejas', 'Rezultatas', 'Laikas'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  attempts
    .slice()
    .sort((a, b) => {
      const at = a?.t ?? a?.timestamp ?? a?.startedAt ?? 0;
      const bt = b?.t ?? b?.timestamp ?? b?.startedAt ?? 0;
      return bt - at;
    })
    .forEach((attempt, index) => {
      const tr = document.createElement('tr');
      const label = attempt?.ok === true ? 'Laimeta' : attempt?.ok === false ? 'Nesekme' : 'Neaisku';
      [
        index + 1,
        playerLabel(attempt?.userId) || attempt?.name || '-',
        label,
        formatSec(attempt?.sec ?? attempt?.secsTotal)
      ].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

  table.append(thead, tbody);
  tableWrap.appendChild(table);
  wrapper.append(header, tableWrap);
  return wrapper;
}

function buildTeamSection(events) {
  const wrapper = document.createElement('div');
  wrapper.className = 'miniSection';
  const header = document.createElement('div');
  header.className = 'miniHeader';
  const h = document.createElement('h3');
  h.textContent = 'Komandu kovos juosta';
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = `${events.length} ivyk${events.length === 1 ? 'is' : 'iai'}`;
  header.append(h, chip);

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';
  events.forEach((ev) => {
    const item = document.createElement('div');
    item.style.background = 'rgba(21,26,38,0.85)';
    item.style.border = '1px solid rgba(36,42,58,0.8)';
    item.style.borderRadius = '10px';
    item.style.padding = '8px 10px';
    const time = new Date(ev?.t || ev?.timestamp || Date.now());
    const stamp = document.createElement('div');
    stamp.style.color = 'var(--muted)';
    stamp.style.fontSize = '11px';
    stamp.textContent = time.toLocaleTimeString();
    const body = document.createElement('div');
    body.style.fontSize = '13px';
    body.textContent = ev?.type || JSON.stringify(ev);
    item.append(stamp, body);
    list.appendChild(item);
  });
  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'emptyState';
    empty.textContent = 'Komandu kovu nera.';
    list.appendChild(empty);
  }
  wrapper.append(header, list);
  return wrapper;
}
