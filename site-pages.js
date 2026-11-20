/* Small interactions for the About, What we do and Sustainability pages. */
(() => {
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- What we do: industry tabs ---------- */
  const tabs = $$('[data-industry-tab]');
  const panels = $$('[data-industry-panel]');
  const range = document.getElementById('range');

  function selectIndustry(id, { scroll = false, focus = false } = {}) {
    const tab = tabs.find(t => t.dataset.industryTab === id);
    if (!tab) return;
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(p => {
      const on = p.dataset.industryPanel === id;
      p.hidden = !on;
      if (on) { p.classList.remove('pr-flash'); void p.offsetWidth; p.classList.add('pr-flash'); }
    });
    if (focus) tab.focus();
    if (scroll && range) range.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      selectIndustry(tab.dataset.industryTab);
      history.replaceState(null, '', '#' + tab.dataset.industryTab);
    });
    tab.addEventListener('keydown', e => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      selectIndustry(next.dataset.industryTab, { focus: true });
    });
  });

  $$('[data-pick-industry]').forEach(el => el.addEventListener('click', e => {
    e.preventDefault();
    selectIndustry(el.dataset.pickIndustry, { scroll: true });
    if (el.dataset.pickGroup) selectGroup(el.dataset.pickGroup);
    history.replaceState(null, '', '#' + el.dataset.pickIndustry);
  }));

  /* stage filter inside an industry (e.g. textile: All / Pre-treatment / Dyeing).
     cms.js can rebuild these, so the tabs are looked up each time. */
  function selectGroup(id) {
    $$('[data-group-tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.groupTab === id)));
    $$('[data-group]').forEach(g => { g.hidden = id !== 'all' && g.dataset.group !== id; });
  }
  document.addEventListener('click', e => {
    const tab = e.target.closest('[data-group-tab]');
    if (tab) selectGroup(tab.dataset.groupTab);
  });

  /* textile spotlight: stage tabs */
  const stageTabs = $$('[data-stage-tab]');
  const stagePanels = $$('[data-stage-panel]');
  function selectStage(tab, focus = false) {
    stageTabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    stagePanels.forEach(p => { p.hidden = p.dataset.stagePanel !== tab.dataset.stageTab; });
    if (focus) tab.focus();
  }
  stageTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectStage(tab));
    tab.addEventListener('keydown', e => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      selectStage(stageTabs[(i + dir + stageTabs.length) % stageTabs.length], true);
    });
  });

  const fromHash = location.hash.slice(1);
  if (fromHash && tabs.some(t => t.dataset.industryTab === fromHash)) {
    selectIndustry(fromHash);
    if (range) requestAnimationFrame(() => range.scrollIntoView({ block: 'start' }));
  }

  /* ---------- Sustainability: hover sync between the wheel and the list ---------- */
  const light = (id, on) => $$(`[data-seg="${id}"]`).forEach(el => el.classList.toggle('is-on', on));
  $$('[data-seg]').forEach(el => {
    el.addEventListener('mouseenter', () => light(el.dataset.seg, true));
    el.addEventListener('mouseleave', () => light(el.dataset.seg, false));
    el.addEventListener('focusin', () => light(el.dataset.seg, true));
    el.addEventListener('focusout', () => light(el.dataset.seg, false));
  });
})();
