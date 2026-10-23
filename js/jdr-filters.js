/* Merveille d'Un'Gara — panneau de filtres des cartes (bibliothèque et deck).
   Même principe que Rimd'Orël : recherche texte, types en cases à cocher,
   listes déroulantes, intervalles de valeur et de mana, tri.

   const f = jdrFilters(document.getElementById('filters'), onChange, { showPlayable: true });
   f.apply(cards, ctx)  → cartes filtrées et triées
   ctx = { sheet, allowed(card) } : sert au filtre « Uniquement jouables par mon personnage » */

function jdrFilters(container, onChange, opts = {}){
  const S = { q:'', types:[], subtype:'', classe:'', supertype:'',
              vMin:'', vMax:'', mMin:'', mMax:'', persistent:false, horsDeck:false, playable:false, sort:'name' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const opt = (list, all) => `<option value="">${all}</option>` + list.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');

  container.innerHTML = `
    <div class="ff">
      <input type="search" data-k="q" placeholder="Rechercher (nom ou texte)…" aria-label="Rechercher">
      <div class="chips">${JDR_CARD_TYPES.map(t => `<label class="chip"><input type="checkbox" data-type="${esc(t)}">${esc(t)}</label>`).join('')}</div>
      <div class="grid2">
        <label class="f">Sous-type<select data-k="subtype">${opt(JDR_SUBTYPES, 'Tous')}</select></label>
        <label class="f">Classe<select data-k="classe">${opt(Object.keys(JDR_CLASSES), 'Toutes')}</select></label>
        <label class="f">Super-type<select data-k="supertype">${opt(JDR_SUPERTYPES, 'Tous')}</select></label>
        <label class="f">Trier par<select data-k="sort">
          <option value="name">Nom</option><option value="value">Valeur</option><option value="mana">Coût en mana</option><option value="pa">Coût en PA</option><option value="type">Type</option></select></label>
      </div>
      <div class="grid4">
        <label class="f">Valeur min<input type="number" data-k="vMin" min="0"></label>
        <label class="f">Valeur max<input type="number" data-k="vMax" min="0"></label>
        <label class="f">Mana min<input type="number" data-k="mMin" min="0"></label>
        <label class="f">Mana max<input type="number" data-k="mMax" min="0"></label>
      </div>
      <div class="row">
        <label class="chk"><input type="checkbox" data-k="persistent"> Persistantes</label>
        <label class="chk"><input type="checkbox" data-k="horsDeck"> Hors deck</label>
        ${opts.showPlayable ? '<label class="chk"><input type="checkbox" data-k="playable"> Jouables par mon personnage</label>' : ''}
        <button type="button" class="ghost" data-reset>Réinitialiser</button>
      </div>
    </div>`;

  container.querySelectorAll('[data-k]').forEach(i => {
    const ev = i.type === 'checkbox' || i.tagName === 'SELECT' ? 'change' : 'input';
    i.addEventListener(ev, () => { S[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; onChange(); });
  });
  container.querySelectorAll('[data-type]').forEach(i => i.addEventListener('change', () => {
    const t = i.dataset.type; i.closest('.chip').classList.toggle('on', i.checked);
    if(i.checked) S.types.push(t); else S.types = S.types.filter(x => x !== t); onChange();
  }));
  container.querySelector('[data-reset]').addEventListener('click', () => {
    Object.assign(S, { q:'', types:[], subtype:'', classe:'', supertype:'', vMin:'', vMax:'', mMin:'', mMax:'', persistent:false, horsDeck:false, playable:false, sort:'name' });
    container.querySelectorAll('[data-k]').forEach(i => { if(i.type === 'checkbox') i.checked = false; else i.value = i.dataset.k === 'sort' ? 'name' : ''; });
    container.querySelectorAll('[data-type]').forEach(i => { i.checked = false; i.closest('.chip').classList.remove('on'); });
    onChange();
  });

  // Une carte sans restriction sur un critère compte comme « disponible pour tous »
  const accessOk = (list, v) => !v || !list.length || list.map(jdrNorm).includes(jdrNorm(v));
  const n = v => (v === '' || v === null || v === undefined) ? null : Number(v);

  function matches(c, ctx){
    if(S.q){
      const q = jdrNorm(S.q);
      const hay = jdrNorm([c.name, c.type, c.subtype, ...c.supertypes, ...jdrCardText(c), c.footer].join(' '));
      if(!hay.includes(q)) return false;
    }
    if(S.types.length && !S.types.includes(c.type)) return false;
    if(S.subtype && c.subtype !== S.subtype) return false;
    if(!accessOk(c.classes, S.classe)) return false;
    if(S.supertype && !c.supertypes.map(jdrNorm).includes(jdrNorm(S.supertype))) return false;
    if(n(S.vMin) !== null && (Number(c.value) || 0) < n(S.vMin)) return false;
    if(n(S.vMax) !== null && (Number(c.value) || 0) > n(S.vMax)) return false;
    if(n(S.mMin) !== null && (c.mana === null || Number(c.mana) < n(S.mMin))) return false;
    if(n(S.mMax) !== null && (c.mana === null || Number(c.mana) > n(S.mMax))) return false;
    if(S.persistent && !c.persistent) return false;
    if(S.horsDeck && !c.horsDeck) return false;
    if(S.playable && ctx && ctx.allowed && !ctx.allowed(c)) return false;
    return true;
  }
  function apply(cards, ctx){
    const key = S.sort;
    const num = v => (v === null || v === undefined || v === '') ? 999 : Number(v);
    return cards.filter(c => matches(c, ctx)).sort((a, b) => {
      if(key === 'name') return a.name.localeCompare(b.name, 'fr');
      if(key === 'type') return a.type.localeCompare(b.type, 'fr') || a.name.localeCompare(b.name, 'fr');
      return num(a[key]) - num(b[key]) || a.name.localeCompare(b.name, 'fr');
    });
  }
  return { state: S, apply };
}
