/* ============================================================
   Merveille d'Un'Gara — TOURS ET SCÈNES sur le plateau (26/10/2026)
   Chargé par plateau.html après ses variables (me, isGM, CAMP, camp, chars, items, scene, journal,
   el, toast, send, postMsg, saveCamp, makeWin, wins, renderItem…) et après js/jdr-plateau-cartes.js (PC).

   Règles du livret appliquées :
   - Combat : chaque joueur et chaque adversaire a un tour par round ; les joueurs choisissent leur ordre,
     mais entre deux joueurs un adversaire doit jouer (alternance, désactivable).
   - Début du tour d'un joueur : il pioche autant que son Opportunisme (fait automatiquement).
   - Fin du tour : il défausse les cartes en trop pour garder au plus son Anticipation (il choisit lesquelles).
   - Scène : au début d'une scène, chacun pioche (comme un début de tour) ; à la fin, chacun défausse l'excédent.
   État : campaigns.turn (voir sql/jdr-014-tours.sql). Le MJ l'écrit directement ;
   un joueur passe par jdr.turn_player (il ne peut agir que pour son personnage).
   ============================================================ */
const TO = (() => {
  let turn = {};
  const T = () => Object.assign({ mode: null, round: 0, scene: 0, acted: [], foes: [], foesActed: [], current: null, last: null, strict: true, pcs: [] }, turn || {});
  const statsOf2 = id => { const c = chars.find(x => x.id === id); return (c && c.data && c.data.stats) || null; };
  const opp = id => { const s = statsOf2(id); return s ? Math.max(0, Number(s.opp) || 0) : 0; };
  const ant = id => { const s = statsOf2(id); return s && s.ant !== undefined && s.ant !== '' ? Math.max(0, Number(s.ant) || 0) : null; };
  const mine = id => chars.some(c => c.id === id && c.owner_id === me.id);
  const pcList = () => { const t = T(); const m = new Map((t.pcs || []).map(p => [p.id, p.name])); chars.forEach(c => { if(!m.has(c.id) && isGM) m.set(c.id, c.name || 'Sans nom'); }); return [...m.entries()].map(([id, name]) => ({ id, name })); };
  function isCurrent(it){ const c = T().current; if(!c) return false; return c.kind === 'pc' ? it.character_id === c.id : it.id === c.id; }

  /* ---------- Écriture (MJ) ---------- */
  async function setTurn(t, msg){
    turn = t; render(); refreshTokens();
    const ok = await saveCamp({ turn: t }); if(ok && msg) postMsg('system', msg); return ok;
  }
  function sceneFoes(){
    // adversaires = pions de la couche Pions qui ne sont ni des personnages, ni des PNJ contrôlés par un joueur
    return [...items.values()].filter(it => it.layer === 'tokens' && !it.character_id && !(it.data.journal && journal.get(it.data.journal) && journal.get(it.data.journal).controlled_by.length))
      .map(it => ({ id: it.id, name: it.data.name || 'Adversaire' }));
  }
  const pcsNow = () => chars.map(c => ({ id: c.id, name: c.name || 'Sans nom' }));
  async function startCombat(){
    const foes = sceneFoes();
    await setTurn(Object.assign(T(), { mode: 'combat', round: 1, acted: [], foes, foesActed: [], current: null, last: null, pcs: pcsNow() }),
      `⚔ Le combat commence (round 1) — ${foes.length} adversaire${foes.length > 1 ? 's' : ''}. Les joueurs choisissent qui commence.`);
    await PC.resetPA(pcsNow().map(p => p.id));
  }
  async function nextRound(){
    const t = T(); await setTurn(Object.assign(t, { round: (t.round || 0) + 1, acted: [], foesActed: [], current: null, last: null }), `⚔ Round ${(t.round || 0)} : chacun peut reprendre son tour.`);
    await PC.resetPA(pcList().map(p => p.id));
  }
  async function endCombat(){ await setTurn(Object.assign(T(), { mode: null, current: null, acted: [], foesActed: [] }), '⚔ Fin du combat.'); }
  async function foePlay(f){ const t = T(); if(t.current) return toast('Quelqu’un joue déjà : termine son tour d’abord.'); await setTurn(Object.assign(t, { current: { kind: 'foe', id: f.id, name: f.name } }), `${f.name} (adversaire) joue son tour`); }
  async function foeEnd(){ const t = T(); const c = t.current; if(!c || c.kind !== 'foe') return;
    await setTurn(Object.assign(t, { current: null, last: 'foe', foesActed: [...new Set([...(t.foesActed || []), c.id])] })); }
  async function newScene(){
    const t = T(); const n = (t.scene || 0) + 1; const pcs = pcsNow();
    await setTurn(Object.assign(t, { mode: 'scene', scene: n, acted: [], current: null, last: null, pcs }), `🎬 Scène ${n} : tout le monde pioche.`);
    await PC.resetPA(pcs.map(p => p.id));
    for(const p of pcs) await PC.draw(p.id, opp(p.id) || 1);
  }
  async function endScene(){
    postMsg('system', '🎬 Fin de scène : chacun défausse jusqu’à son Anticipation.'); send('discard-check', {}); checkMyHands();
  }
  async function forceDraw(ids, mode){
    for(const id of ids) await PC.draw(id, mode === 'opp' ? (opp(id) || 1) : 1);
  }
  async function gmMark(p, done){   // le MJ coche / décoche « a joué »
    const t = T(); const acted = new Set(t.acted || []); done ? acted.add(p.id) : acted.delete(p.id);
    const patch = { acted: [...acted] }; if(t.current && t.current.id === p.id && !done) patch.current = null;
    await setTurn(Object.assign(t, patch));
  }

  /* ---------- Joueur ---------- */
  async function takeTurn(id){
    const { data, error } = await jdrSb.rpc('turn_player', { p_campaign: CAMP, p_character: id, p_action: 'start' });
    if(error){ toast(jdrErrorText(error)); return; }
    turn = data; render(); refreshTokens();
    await PC.resetPA([id]);   // début du tour : PA au maximum
    const name = (pcList().find(p => p.id === id) || {}).name || 'Un joueur';
    postMsg('system', `▶ ${name} commence son tour`);
    if(T().mode === 'combat') await PC.draw(id, opp(id) || 1);   // début du tour : pioche (Opportunisme)
  }
  async function endTurn(id){
    const over = handExcess(id);
    if(over > 0) return discardPicker(id, over, () => endTurn(id));
    const { data, error } = await jdrSb.rpc('turn_player', { p_campaign: CAMP, p_character: id, p_action: 'end' });
    if(error){ toast(jdrErrorText(error)); return; }
    turn = data; render(); refreshTokens();
  }
  function handExcess(id){ const a = ant(id); const st = PC.stateOf(id); if(a === null || !st) return 0; return Math.max(0, st.data.hand.length - a); }
  function checkMyHands(){ chars.filter(c => c.owner_id === me.id).forEach(c => { const n = handExcess(c.id); if(n > 0) discardPicker(c.id, n); }); }

  // Choisir les cartes à défausser (fin de tour / de scène)
  function discardPicker(id, n, then){
    const st = PC.stateOf(id); if(!st) return;
    document.getElementById('dpick')?.remove();
    const chosen = new Set();
    const ok = el('button', { type: 'button', class: 'primary', text: `Défausser (0 / ${n})`, disabled: true });
    const grid = el('div', { class: 'pgrid' });
    st.data.hand.forEach(c => { const m = PC.mini(id, 'hand', c, { w: 110 }); m.draggable = false; m.classList.add('pick');
      m.addEventListener('click', () => { if(chosen.has(c.u)) chosen.delete(c.u); else if(chosen.size < n) chosen.add(c.u); m.classList.toggle('on', chosen.has(c.u));
        ok.textContent = `Défausser (${chosen.size} / ${n})`; ok.disabled = chosen.size !== n; });
      grid.append(m); });
    const d = el('dialog', { class: 'dlg', id: 'dpick', style: 'width:min(720px, calc(100vw - 24px))' },
      el('div', { class: 'bd' }, el('h2', { text: 'Limite de main' }),
        el('p', { style: 'margin:0', text: `${PC.nameOf(id)} a ${st.data.hand.length} cartes pour une Anticipation de ${ant(id)} : choisis ${n} carte${n > 1 ? 's' : ''} à défausser.` }),
        grid, el('div', { class: 'row', style: 'justify-content:flex-end' }, el('button', { type: 'button', text: 'Plus tard', onclick: () => d.close() }), ok)));
    ok.addEventListener('click', async () => { ok.disabled = true; if(await PC.discardMany(id, [...chosen])){ d.close(); d.remove(); if(then) then(); } else ok.disabled = false; });
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0));
    document.body.append(d); d.showModal();
  }

  /* ---------- Affichage : badge + fenêtre « Ordre du tour » ---------- */
  function badge(){
    let b = document.getElementById('turnb');
    const t = T();
    if(!t.mode){ if(b) b.hidden = true; return; }
    if(!b){ b = el('button', { type: 'button', id: 'turnb', class: 'turnb', title: 'Ouvrir l’ordre du tour' }); b.addEventListener('click', open); document.body.append(b); }
    b.hidden = false;
    const who = t.current ? `Au tour de : ${t.current.name}` : (t.mode === 'combat' ? nextHint(t) : 'Scène en cours');
    b.textContent = (t.mode === 'combat' ? `⚔ Round ${t.round}` : `🎬 Scène ${t.scene}`) + ' · ' + who;
  }
  function nextHint(t){
    const foesLeft = (t.foes || []).filter(f => !(t.foesActed || []).includes(f.id)).length;
    const pcsLeft = pcList().filter(p => !(t.acted || []).includes(p.id)).length;
    if(!foesLeft && !pcsLeft) return 'Round terminé';
    if(t.strict !== false && t.last === 'pc' && foesLeft) return 'À un adversaire de jouer';
    if(t.last === 'foe' && pcsLeft) return 'À un joueur de jouer';
    return pcsLeft ? 'À un joueur ou un adversaire' : 'Aux adversaires';
  }
  function open(){ const w = makeWin('__turn', 'Ordre du tour'); w.tabs.hidden = true; render(); }
  function render(){
    badge();
    const w = wins.get('__turn'); if(!w) return;
    const t = T(); const body = [];
    const head = !t.mode ? 'Aucun combat ni scène en cours' : t.mode === 'combat' ? `⚔ Combat — round ${t.round}` : `🎬 Scène ${t.scene}`;
    body.push(el('div', { class: 'to-h' }, el('b', { text: head }), t.mode === 'combat' ? el('span', { class: 'hint', text: t.current ? `${t.current.name} joue` : nextHint(t) }) : document.createTextNode('')));
    if(t.mode){
      body.push(el('div', { class: 'au-sub', text: 'Joueurs' }));
      pcList().forEach(p => {
        const acted = (t.acted || []).includes(p.id), now = t.current && t.current.kind === 'pc' && t.current.id === p.id;
        const row = el('div', { class: 'to-r' + (now ? ' now' : acted ? ' done' : '') }, el('span', { class: 'to-s', text: now ? '▶' : acted ? '✓' : '•' }), el('span', { class: 'to-n', text: p.name }));
        if(mine(p.id) || isGM){
          if(now) row.append(el('button', { type: 'button', class: 'primary', text: 'Fin du tour', onclick: () => endTurn(p.id) }));
          else if(!acted && !t.current) row.append(el('button', { type: 'button', text: mine(p.id) ? 'Je prends mon tour' : 'Prendre son tour', onclick: () => takeTurn(p.id) }));
        }
        if(isGM && !now) row.append(el('button', { type: 'button', class: 'to-x', text: acted ? '↺' : '✓', title: acted ? 'Remettre « à jouer »' : 'Marquer « a joué »', onclick: () => gmMark(p, !acted) }));
        body.push(row);
      });
    }
    if(t.mode === 'combat'){
      body.push(el('div', { class: 'au-sub', text: 'Adversaires' }));
      if(!(t.foes || []).length) body.push(el('p', { class: 'hint', style: 'margin:0', text: 'Aucun adversaire.' }));
      (t.foes || []).forEach(f => {
        const acted = (t.foesActed || []).includes(f.id), now = t.current && t.current.kind === 'foe' && t.current.id === f.id;
        const row = el('div', { class: 'to-r foe' + (now ? ' now' : acted ? ' done' : '') }, el('span', { class: 'to-s', text: now ? '▶' : acted ? '✓' : '•' }), el('span', { class: 'to-n', text: f.name }));
        if(isGM){
          if(now) row.append(el('button', { type: 'button', class: 'primary', text: 'Fin', onclick: foeEnd }));
          else if(!acted && !t.current) row.append(el('button', { type: 'button', text: 'Joue', onclick: () => foePlay(f) }));
          row.append(el('button', { type: 'button', class: 'to-x', text: '✕', title: 'Retirer du combat', onclick: () => setTurn(Object.assign(T(), { foes: T().foes.filter(x => x.id !== f.id) })) }));
        }
        row.addEventListener('dblclick', () => { const it = items.get(f.id); if(it) centerOn(it.data.x + it.data.w / 2, it.data.y + it.data.h / 2); });
        body.push(row);
      });
    }
    if(!isGM && t.mode){ const my = chars.filter(c => c.owner_id === me.id); if(!my.length) body.push(el('p', { class: 'hint', style: 'margin:0', text: 'Tu n’as pas de personnage dans cette partie.' })); }
    w.body.replaceChildren(...body);
    // actions du MJ
    const f = [];
    if(isGM){
      if(t.mode !== 'combat') f.push(el('button', { type: 'button', class: 'primary', text: '⚔ Commencer un combat', onclick: startCombat }));
      else f.push(el('button', { type: 'button', class: 'primary', text: 'Round suivant', onclick: nextRound }),
        el('button', { type: 'button', text: '+ Adversaires de la scène', title: 'Ajouter les pions adversaires de la scène qui ne sont pas encore dans le combat', onclick: () => { const have = new Set(T().foes.map(x => x.id)); const add = sceneFoes().filter(x => !have.has(x.id)); setTurn(Object.assign(T(), { foes: [...T().foes, ...add] })); toast(add.length ? add.length + ' adversaire(s) ajouté(s)' : 'Aucun nouvel adversaire'); } }),
        el('button', { type: 'button', class: 'danger', text: 'Terminer le combat', onclick: endCombat }));
      f.push(el('button', { type: 'button', text: '🎬 Nouvelle scène (tout le monde pioche)', onclick: newScene }),
        el('button', { type: 'button', text: 'Fin de scène / tour (défausse)', title: 'Chacun défausse jusqu’à son Anticipation', onclick: endScene }),
        el('button', { type: 'button', text: 'Faire piocher…', onclick: e => drawMenu(e.clientX, e.clientY) }));
      if(t.mode === 'combat'){ const c = el('input', { type: 'checkbox' }); c.checked = t.strict !== false; c.addEventListener('change', () => setTurn(Object.assign(T(), { strict: c.checked })));
        f.push(el('label', { class: 'chk', title: 'Un adversaire doit jouer entre deux joueurs (tant qu’il en reste)' }, c, document.createTextNode(' Alternance obligatoire'))); }
    }
    w.foot.replaceChildren(...f); w.foot.hidden = !f.length;
  }
  function drawMenu(x, y){
    const pcs = pcList(); const m = el('div', { class: 'ctx pcmenu', role: 'menu' }, el('div', { class: 'ch', text: 'Faire piocher' }));
    const add = (t, fn) => m.append(el('button', { type: 'button', text: t, onclick: () => { m.remove(); fn(); } }));
    add('Tout le monde : Opportunisme', () => forceDraw(pcs.map(p => p.id), 'opp'));
    add('Tout le monde : 1 carte', () => forceDraw(pcs.map(p => p.id), 'one'));
    m.append(el('div', { class: 'sep' }));
    pcs.forEach(p => { add(`${p.name} : Opportunisme (${opp(p.id) || 1})`, () => forceDraw([p.id], 'opp')); add(`${p.name} : 1 carte`, () => forceDraw([p.id], 'one')); });
    document.body.append(m); const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; m.style.top = Math.max(8, Math.min(y - r.height, innerHeight - r.height - 8)) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', function h(e){ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('pointerdown', h, true); } }, true), 0);
  }
  function refreshTokens(){ if(typeof items !== 'undefined') [...items.values()].forEach(renderItem); }

  /* ---------- Entrées ---------- */
  function init(){ turn = Object.assign({}, (camp && camp.turn) || {}); render(); }
  function onCamp(t){ const before = JSON.stringify(turn); turn = Object.assign({}, t || {}); if(JSON.stringify(turn) !== before){ render(); refreshTokens(); } }
  return { init, onCamp, render, open, isCurrent, checkMyHands, get state(){ return T(); } };
})();
