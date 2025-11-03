// /js/modal.js
import { dom } from './dom.js';
import { fmtNumber, formatSec, playerLabel } from './helpers.js';

const HIDE_SHARE_AWARDS = true;
const HIDE_SOLO_SECTION = true;

/* ── one-time CSS: lock 4×4 and enlarge card text ─────────────────────────── */
(function injectFixedGridCSS () {
  if (document.getElementById('kq-fixed4x2-css')) return;
  const s = document.createElement('style');
  s.id = 'kq-fixed4x2-css';
  s.textContent = `
    .fixed4x2{ display:grid!important; grid-template-columns:repeat(4,minmax(0,1fr))!important; width:100% }
    .fixed4x2 > .statsCell{ min-width:0 }
    .fixed4x2 .label, .fixed4x2 .value{ font-size:1.3em; line-height:1.2; white-space:normal }
    /* Question-cards grid */
    .qsGrid{ display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; width:100% }
    @media (max-width:900px){ .qsGrid{ grid-template-columns:repeat(2,minmax(0,1fr)) } }
    @media (max-width:560px){ .qsGrid{ grid-template-columns:1fr } }
    .qsCard{ display:flex; flex-direction:column; justify-content:center; align-items:center }
    .qsTitle{ font-weight:600; opacity:.9; margin-bottom:6px; text-align:center }
    .qsNums{ display:flex; gap:16px; align-items:center; justify-content:center }
    .qsNum{ text-align:center; }
    .qsNum .n{ font-size:1.4em; line-height:1; font-weight:700 }
    .qsNum .t{ font-size:.85em; opacity:.7; margin-top:4px }
    /* kill any horizontal overflow inside the modal */
    .kq-modal-root, .kq-modal-root * { box-sizing:border-box }
    .kq-modal-root{ overflow-x:hidden!important; max-width:100%!important }
  `;
  document.head.appendChild(s);
})();

/* ── helpers ──────────────────────────────────────────────────────────────── */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* ── API ─────────────────────────────────────────────────────────────────── */
export function closePlayerModal() {
  if (!dom.playerModal) return;
  dom.playerModalBody.innerHTML = '';
  dom.playerModal.classList.remove('visible');
  document.body.style.overflow = '';
  document.body.style.overflowX = '';
  document.documentElement.style.overflowX = '';
}

export function openPlayerModal(data) {
  if (!dom.playerModal) return;
  dom.playerModalBody.innerHTML = '';

  // mark modal root and block page X scroll
  dom.playerModal.classList.add('kq-modal-root');
  dom.playerModal.style.overflowX = 'hidden';
  if (dom.playerModalBody) dom.playerModalBody.style.overflowX = 'hidden';
  document.body.style.overflowX = 'hidden';
  document.documentElement.style.overflowX = 'hidden';

  if (dom.playerModalClose) dom.playerModalClose.onclick = closePlayerModal;

  /* Header */
  const header = el('div', 'playerModalHeader');
  header.style.display = 'grid';
  header.style.placeItems = 'center';
  header.style.minHeight = '150px';
  header.style.marginBottom = '10px';

  const center = el('div');
  center.style.display = 'flex';
  center.style.flexDirection = 'column';
  center.style.alignItems = 'center';
  center.style.gap = '14px';
  center.style.width = '100%';

  const avatar = el('div', 'avatar');
  avatar.style.margin = '0 auto';
  avatar.style.transform = 'scale(1.2)';           // +20%
  avatar.style.transformOrigin = 'center center';
  if (data?.avatar) {
    const img = document.createElement('img');
    img.src = data.avatar;
    img.alt = data?.name || 'Žaidėjas';
    img.referrerPolicy = 'no-referrer';
    avatar.appendChild(img);
  } else {
    avatar.textContent = (data?.name || '?').charAt(0).toUpperCase();
  }
  center.appendChild(avatar);

  const title = el('h2', null, data?.name || 'Žaidėjas');
  title.style.margin = '0';
  center.appendChild(title);

  header.appendChild(center);
  dom.playerModalBody.appendChild(header);

  /* 4×4 top cards */
  const tiles = el('div', 'statsGrid fixed4x2');
  const totals = data?.totals || {};
  const agg = data?.aggregates || {};

  const totalAnswers =
    (totals.main?.answers || 0) + (totals.money?.answers || 0) + (totals.map?.answers || 0);
  const totalCorrect =
    (totals.main?.corrects || 0) + (totals.money?.corrects || 0) + (totals.map?.corrects || 0);
  const correctRate = totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) + '%' : '-';

  const addTile = (label, value) => {
    const cell = el('div', 'statsCell');
    const lab = el('div', 'label', label);
    const val = el('div', 'value', String(value));
    cell.append(lab, val);
    tiles.appendChild(cell);
  };

  // Row 1
  addTile('Galutinis rezultatas', fmtNumber.format(data?.finalScore ?? agg.totalScore ?? 0));
  addTile('Iš viso atsakymų', fmtNumber.format(totalAnswers));
  addTile('Teisingų atsakymų', fmtNumber.format(totalCorrect));
  addTile('Pasidalijimų kiekis', fmtNumber.format(agg.shareCnt ?? 0));
  // Row 2
  addTile('Tikslumas', correctRate);
  addTile('Solo laimėjimai', fmtNumber.format(agg.soloWinCount ?? 0));
  addTile('Solo bandymai', fmtNumber.format(agg.soloAttemptCount ?? 0));
  addTile('Dalytų taškų', fmtNumber.format(agg.sharePts ?? 0));

  dom.playerModalBody.appendChild(tiles);

  /* Question statistics — CARD VIEW (no tables, no scroll) */
  const qSection = el('div', 'modalSection');
  qSection.append(el('h3', null, 'Klausimų statistika'));

  const qs = el('div', 'qsGrid');

  function qsCard(titleText, stats) {
    const card = el('div', 'statsCell qsCard');
    const t = el('div', 'qsTitle', titleText);

    const nums = el('div', 'qsNums');

    const mk = (n, label) => {
      const wrap = el('div', 'qsNum');
      const nEl = el('div', 'n', fmtNumber.format(n || 0));
      const tEl = el('div', 't', label);
      wrap.append(nEl, tEl);
      return wrap;
    };

    nums.append(
      mk(stats.answers || 0, 'Atsakymai'),
      mk(stats.corrects || 0, 'Teisingi'),
      mk(stats.wrongs || 0, 'Klaidos')
    );

    card.append(t, nums);
    return card;
  }

  qs.append(
    qsCard('Pagrindinis žaidimas', totals.main || {}),
    qsCard('Pinigų raundai', totals.money || {}),
    qsCard('Žemėlapio raundai', totals.map || {})
  );

  qSection.appendChild(qs);
  dom.playerModalBody.appendChild(qSection);

  /* Solo list — hidden (keep logic for future) */
  if (!HIDE_SOLO_SECTION) {
    const attempts = Array.isArray(data?.soloAttempts) ? data.soloAttempts.slice() : [];
    const soloSection = el('div', 'modalSection');
    soloSection.append(el('h3', null, 'Solo bandymai'));
    const list = el('div', 'qsGrid');
    attempts.forEach((a, i) => {
      const card = el('div', 'statsCell qsCard');
      card.append(
        el('div', 'qsTitle', `#${i + 1}`),
        (() => {
          const nums = el('div', 'qsNums');
          const mk = (n, label) => {
            const wrap = el('div', 'qsNum');
            wrap.append(el('div', 'n', String(n)), el('div', 't', label));
            return wrap;
          };
          nums.append(
            mk(a?.ok === true ? 'Laimėta' : a?.ok === false ? 'Nesėkmė' : 'Neaišku', 'Rezultatas'),
            mk(a?.sec ?? a?.secsTotal ?? '-', 'Laikas (s)')
          );
          return nums;
        })()
      );
      list.appendChild(card);
    });
    soloSection.appendChild(list);
    dom.playerModalBody.appendChild(soloSection);
  }

  /* mount */
  dom.playerModal.classList.add('visible');
  document.body.style.overflow = 'hidden';
  dom.playerModalBody.scrollTop = 0;

  /* interactions */
  dom.playerModal.addEventListener('click', (e) => {
    if (e.target === dom.playerModal) closePlayerModal();
  }, { once: true });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      closePlayerModal();
    }
  };
  document.addEventListener('keydown', onKey);
}
