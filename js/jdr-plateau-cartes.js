/* ============================================================
   Merveille d'Un'Gara — MAIN ET DECK sur le plateau (26/10/2026)
   Chargé par plateau.html APRÈS ses variables (me, isGM, CAMP, chars, el, toast, postMsg, send, makeWin…).

   Piles d'un personnage (table jdr.play_states, une ligne par personnage) :
     draw (pioche, [0] = dessus) · hand (main) · discard (défausse, dernier = dessus) · banished (bannies) · play (en jeu)
   Une carte en jeu = un exemplaire { u: identifiant unique, c: id de la carte }.
   Accès libre (choix du MJ) : tout joueur de la partie peut agir sur les piles des autres ; tout est noté dans la discussion.
   Les mains des autres joueurs sont montrées de dos (sauf au MJ).
   Conflits : chaque modification vérifie la « version » de la ligne ; si quelqu'un a modifié entre-temps,
   on relit et on rejoue l'action (jusqu'à 4 fois).
   ============================================================ */
const PC = (() => {
  const ZONES = { draw: 'Pioche', hand: 'Main', discard: 'Défausse', banished: 'Bannies', play: 'En jeu' };
  const states = new Map();          // character_id → { character_id, char_name, owner_id, version, data }
  let cards = {};                    // id → carte
  let cur = null;                    // personnage affiché dans le bandeau
  let open = true;                   // bandeau déplié
  try{ open = localStorage.getItem('jdr-tray-open') !== '0'; }catch(e){}
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const blank = () => ({ draw: [], hand: [], discard: [], banished: [], play: [] });
  const norm = r => Object.assign({}, r, { data: Object.assign(blank(), r.data || {}) });
  const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cardName = c => (cards[c.c] && cards[c.c].name) || c.c;
  const isRisk = c => cards[c.c] && cards[c.c].type === 'Risque';
  const nameOf = ch => { const st = states.get(ch); const c = chars.find(x => x.id === ch); return (c && c.name) || (st && st.char_name) || 'Personnage'; };
  const charData = ch => { const c = chars.find(x => x.id === ch); return c ? (c.data || {}) : null; };
  const handHidden = ch => { const st = states.get(ch); const c = chars.find(x => x.id === ch); const owner = (c && c.owner_id) || (st && st.owner_id); return !isGM && owner !== me.id; };

  /* ---------- Chargement ---------- */
  async function load(){
    try{ const c = await jdrLoadCards(); cards = c.byId; }catch(e){ toast('Cartes non chargées : ' + jdrErrorText(e)); }
    const { data, error } = await jdrSb.from('play_states').select('*').eq('campaign_id', CAMP);
    if(error){ toast('Piles indisponibles : ' + jdrErrorText(error)); return; }
    (data || []).forEach(r => states.set(r.character_id, norm(r)));
    const mine = chars.filter(c => c.owner_id === me.id);
    let saved = null; try{ saved = localStorage.getItem('jdr-tray-char-' + CAMP); }catch(e){}
    cur = (saved && (chars.some(c => c.id === saved) || states.has(saved))) ? saved : (mine[0] ? mine[0].id : null);
    render();
  }
  function onChange({ eventType, new: n, old: o }){
    if(eventType === 'DELETE'){ if(o) states.delete(o.character_id); }
    else { const was = states.get(n.character_id); if(was && was.version > n.version) return; states.set(n.character_id, norm(n)); }
    render(); refreshWins();
  }

  /* ---------- Écriture (avec contrôle de version) ---------- */
  async function ensure(ch){
    if(states.has(ch)) return states.get(ch);
    const { data, error } = await jdrSb.from('play_states').insert({ character_id: ch, campaign_id: CAMP }).select().single();
    if(error){ const { data: d2 } = await jdrSb.from('play_states').select('*').eq('character_id', ch).maybeSingle(); if(d2){ states.set(ch, norm(d2)); return states.get(ch); } toast(jdrErrorText(error)); return null; }
    states.set(ch, norm(data)); return states.get(ch);
  }
  // fn(data) modifie une copie ; renvoie false pour annuler. Renvoie la valeur de fn (ou null si échec).
  async function mutate(ch, fn){
    for(let tries = 0; tries < 4; tries++){
      const st = await ensure(ch); if(!st) return null;
      const d = structuredClone(st.data); const res = fn(d); if(res === false) return null;
      const { data, error } = await jdrSb.from('play_states').update({ data: d, version: st.version + 1 }).eq('character_id', ch).eq('version', st.version).select();
      if(error){ toast(jdrErrorText(error)); return null; }
      if(data && data.length){ states.set(ch, norm(data[0])); render(); refreshWins(); return res === undefined ? true : res; }
      const { data: fresh } = await jdrSb.from('play_states').select('*').eq('character_id', ch).maybeSingle();   // quelqu'un a modifié : on relit
      if(fresh) states.set(ch, norm(fresh));
    }
    toast('Trop de modifications en même temps : réessaie.'); return null;
  }
  const log = (text, data) => postMsg('action', text, data);

  /* ---------- Actions ---------- */
  async function prepare(ch){
    const c = chars.find(x => x.id === ch);
    let deck = c && Array.isArray(c.deck) ? c.deck : null;
    if(!deck){ const { data } = await jdrSb.from('characters').select('deck').eq('id', ch).maybeSingle(); deck = data && Array.isArray(data.deck) ? data.deck : null; }
    if(!deck){ toast('Deck introuvable : seul le joueur ou le MJ peut préparer ce deck.'); return; }
    const list = []; deck.forEach(e => { for(let i = 0; i < (Number(e.qty) || 0); i++) list.push({ u: uid(), c: e.card }); });
    if(!list.length){ toast('Le deck de ' + nameOf(ch) + ' est vide : construis-le depuis sa fiche.'); return; }
    if(await mutate(ch, d => { Object.assign(d, blank(), { draw: shuffle(list) }); })) log(`${nameOf(ch)} prépare son deck (${list.length} cartes mélangées)`);
  }
  async function draw(ch, n){
    // aucune carte nulle part (deck jamais préparé) : on prépare d'abord le deck construit
    const st0 = states.get(ch); const total = st0 ? Object.values(st0.data).reduce((a, z) => a + z.length, 0) : 0;
    if(!total){ await prepare(ch); if(!states.get(ch) || !states.get(ch).data.draw.length) return; }
    let reshuffled = false, risks = [], got = 0;
    const ok = await mutate(ch, d => { reshuffled = false; risks = []; got = 0;
      for(let i = 0; i < n; i++){
        if(!d.draw.length){ if(!d.discard.length) break; d.draw = shuffle(d.discard.splice(0)); reshuffled = true; }   // pioche vide : on remélange la défausse
        const c = d.draw.shift(); d.hand.push(c); got++; if(isRisk(c)) risks.push(cardName(c));
      } if(!got && !reshuffled) return false; });
    if(!ok){ toast('Plus aucune carte à piocher.'); return; }
    log(`${nameOf(ch)} pioche ${got} carte${got > 1 ? 's' : ''}${reshuffled ? ' (défausse remélangée dans la pioche)' : ''}${risks.length ? ' — Risque : ' + risks.map(r => '« ' + r + ' »').join(', ') : ''}`);
  }
  async function shuffleDraw(ch){ if(await mutate(ch, d => { shuffle(d.draw); })) log(`${nameOf(ch)} mélange sa pioche`); }
  async function rest(ch){
    let removed = 0, total = 0;
    const ok = await mutate(ch, d => { const all = [...d.draw, ...d.hand, ...d.discard, ...d.banished, ...d.play];
      const keep = all.filter(c => !isRisk(c)); removed = all.length - keep.length; total = keep.length; Object.assign(d, blank(), { draw: shuffle(keep) }); });
    if(ok) log(`${nameOf(ch)} se repose : toutes ses cartes reviennent dans la pioche (${total})${removed ? `, ${removed} Risque${removed > 1 ? 's' : ''} retiré${removed > 1 ? 's' : ''}` : ''}`);
  }
  // Déplacer un exemplaire d'une pile à une autre (éventuellement d'un personnage à un autre)
  async function move(from, to, pos){
    const verb = { hand: 'prend en main', discard: 'défausse', banished: 'bannit', play: 'met en jeu', draw: pos === 'bottom' ? 'remet sous la pioche' : 'remet sur la pioche' }[to.z];
    let card = null;
    if(from.ch === to.ch){
      const ok = await mutate(from.ch, d => { const i = d[from.z].findIndex(c => c.u === from.u); if(i < 0) return false; card = d[from.z].splice(i, 1)[0];
        if(to.z === 'draw' && pos !== 'bottom') d.draw.unshift(card); else d[to.z].push(card); });
      if(!ok) return;
    } else {
      const ok = await mutate(from.ch, d => { const i = d[from.z].findIndex(c => c.u === from.u); if(i < 0) return false; card = d[from.z].splice(i, 1)[0]; });
      if(!ok) return;
      const ok2 = await mutate(to.ch, d => { if(to.z === 'draw' && pos !== 'bottom') d.draw.unshift(card); else d[to.z].push(card); });
      if(!ok2){ await mutate(from.ch, d => { d[from.z].push(card); }); return; }   // échec : la carte revient d'où elle vient
    }
    const secret = (to.z === 'hand' && from.z === 'draw') || (to.z === 'draw' && from.z === 'hand');   // reste caché
    const what = secret ? 'une carte' : `« ${cardName(card)} »`;
    const actor = myCharName();
    const whose = z => ZONES[z].toLowerCase();
    let text;
    if(from.ch === to.ch) text = `${nameOf(to.ch)} ${verb} ${what}${from.z !== 'hand' ? ` (depuis sa ${whose(from.z)})` : ''}`;
    else text = `${actor} déplace ${what} : ${whose(from.z)} de ${nameOf(from.ch)} → ${whose(to.z)} de ${nameOf(to.ch)}`;
    log(text, secret ? {} : { card: card.c });
    // une carte qui arrive « En jeu » est jouée : elle est montrée à toute la table (par défaut)
    if(to.z === 'play' && from.z !== 'play'){ const p = { card: card.c, who: nameOf(to.ch) }; reveal(p); send('reveal', p); }
  }
  async function play(ch, u, zone){
    const st = states.get(ch); const c = st && st.data[zone || 'hand'].find(x => x.u === u); if(!c) return;
    const card = cards[c.c]; const dest = card && card.persistent ? 'play' : 'discard';
    const ok = await mutate(ch, d => { const i = d[zone || 'hand'].findIndex(x => x.u === u); if(i < 0) return false; d[dest].push(d[zone || 'hand'].splice(i, 1)[0]); });
    if(!ok) return;
    log(`${nameOf(ch)} joue « ${cardName(c)} »${dest === 'play' ? ' (reste en jeu)' : ''}`, { card: c.c });
    const p = { card: c.c, who: nameOf(ch) }; reveal(p); send('reveal', p);
  }
  function myCharName(){ const c = chars.find(x => x.owner_id === me.id); return isGM ? 'Le MJ' : (c ? c.name : 'Quelqu’un'); }

  /* ---------- Carte jouée : montrée en grand chez tout le monde ---------- */
  function reveal(p){
    const card = cards[p.card]; if(!card) return;
    let r = document.getElementById('reveal');
    if(!r){ r = el('div', { id: 'reveal', class: 'reveal', title: 'Cliquer pour agrandir' }); r.addEventListener('click', () => { if(r._card) jdrZoomCard(r._card); r.hidden = true; }); document.body.append(r); }
    r._card = card; r.innerHTML = `<div class="rv-h">${jdrEsc(p.who)} joue</div>` + jdrCardHTML(card, { width: '210px' });
    r.hidden = false; clearTimeout(r._t); r._t = setTimeout(() => { r.hidden = true; }, 6000);
  }

  /* ---------- Bandeau (main toujours visible) ---------- */
  const back = (n, title) => el('div', { class: 'cback', title: title || '' }, el('span', { text: n === undefined ? '' : String(n) }));
  function mini(ch, z, c, opts = {}){
    const card = cards[c.c];
    const w = el('div', { class: 'pcard', draggable: 'true', 'data-u': c.u, title: card ? card.name + ' — double-clic : agrandir ; clic droit : actions' : c.c });
    w.innerHTML = card ? jdrCardHTML(card, { width: (opts.w || 96) + 'px' }) : `<div class="cmiss">${jdrEsc(c.c)}</div>`;
    w.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-pcard', JSON.stringify({ ch, z, u: c.u })); e.dataTransfer.effectAllowed = 'move'; w.classList.add('dragging'); });
    w.addEventListener('dragend', () => w.classList.remove('dragging'));
    w.addEventListener('dblclick', () => card && jdrZoomCard(card));
    w.addEventListener('contextmenu', e => { e.preventDefault(); cardMenu(ch, z, c, e.clientX, e.clientY); });
    return w;
  }
  function dropTarget(node, ch, z, pos){
    node.addEventListener('dragover', e => { if([...e.dataTransfer.types].includes('text/x-pcard')){ e.preventDefault(); node.classList.add('over'); } });
    node.addEventListener('dragleave', () => node.classList.remove('over'));
    node.addEventListener('drop', e => { node.classList.remove('over'); const raw = e.dataTransfer.getData('text/x-pcard'); if(!raw) return; e.preventDefault(); e.stopPropagation();
      const f = JSON.parse(raw); if(f.ch === ch && f.z === z && z !== 'draw') return; move(f, { ch, z }, e.shiftKey ? 'bottom' : pos); });
  }
  function options(){
    const ids = new Map();
    chars.forEach(c => ids.set(c.id, c.name || 'Sans nom'));
    states.forEach((s, id) => { if(!ids.has(id)) ids.set(id, s.char_name || 'Personnage'); });
    return [...ids.entries()];
  }
  function render(){
    const T = document.getElementById('tray'); if(!T) return;
    T.classList.toggle('closed', !open);
    const opts = options();
    if(!cur && opts.length && !isGM) cur = opts[0][0];
    const st = cur ? states.get(cur) : null; const d = st ? st.data : blank();
    const sel = el('select', { 'aria-label': 'Cartes de quel personnage' }, el('option', { value: '', text: isGM ? '— choisir un personnage —' : '— personnage —' }),
      ...opts.map(([id, n]) => el('option', { value: id, text: n + (chars.some(c => c.id === id && c.owner_id === me.id) ? ' (moi)' : '') })));
    sel.value = cur || '';
    sel.addEventListener('change', () => { cur = sel.value || null; try{ localStorage.setItem('jdr-tray-char-' + CAMP, cur || ''); }catch(e){} render(); });
    const cd = cur ? charData(cur) : null; const stats = (cd && cd.stats) || {};
    const opp = Number(stats.opp) || 0, ant = Number(stats.ant);
    const head = el('div', { class: 'trh' },
      el('button', { type: 'button', class: 'trtog', text: open ? '▾' : '▴', title: open ? 'Replier la main' : 'Déplier la main', 'aria-label': open ? 'Replier la main' : 'Déplier la main', onclick: () => { open = !open; try{ localStorage.setItem('jdr-tray-open', open ? '1' : '0'); }catch(e){} render(); } }),
      el('b', { text: 'Main de' }), sel,
      cur ? el('span', { class: 'trc', text: `${d.hand.length} en main${!isNaN(ant) && cd ? ` · limite ${ant} (Anticipation)` : ''}`, style: !isNaN(ant) && cd && d.hand.length > ant ? 'color:#ff9b8f' : '' }) : document.createTextNode(''));
    if(cur){
      head.append(
        el('button', { type: 'button', class: 'primary', text: opp ? `Piocher ${opp}` : 'Piocher', title: opp ? 'Piocher autant que l’Opportunisme' : 'Piocher 1 carte', onclick: () => draw(cur, opp || 1) }),
        el('button', { type: 'button', text: '+1', title: 'Piocher 1 carte', onclick: () => draw(cur, 1) }),
        el('button', { type: 'button', text: 'Mélanger', title: 'Mélanger la pioche', onclick: () => shuffleDraw(cur) }));
      const more = el('button', { type: 'button', text: '⋯', title: 'Autres actions', 'aria-label': 'Autres actions' });
      more.addEventListener('click', e => menu(e.clientX, e.clientY, [
        ['Préparer le deck (repartir de zéro)', () => confirmThen('Préparer le deck : toutes les piles de ' + nameOf(cur) + ' sont remises à zéro.', () => prepare(cur))],
        ['Repos (tout remélanger, retirer les Risques)', () => confirmThen('Repos : toutes les cartes reviennent dans la pioche et les Risques sont retirés.', () => rest(cur))],
        ['Fouiller la pioche', () => openPile(cur, 'draw')], ['Voir la défausse', () => openPile(cur, 'discard')],
        ['Voir les cartes bannies', () => openPile(cur, 'banished')], ['Voir les cartes en jeu', () => openPile(cur, 'play')]]));
      head.append(more);
    }
    const body = el('div', { class: 'trb' });
    if(!cur || !st) body.classList.add('small');   // pas de cartes : bandeau compact
    if(!cur) body.append(el('p', { class: 'hint', style: 'margin:0', text: isGM ? 'Choisis un personnage pour voir et manipuler ses cartes.' : 'Aucun personnage dans cette partie.' }));
    else if(!st) body.append(el('div', { class: 'trempty' }, el('span', { text: 'Pas encore de cartes en jeu pour ' + nameOf(cur) + '.' }),
      el('button', { type: 'button', class: 'primary', text: 'Préparer le deck', onclick: () => prepare(cur) })));
    else {
      // pile de pioche
      const pd = el('div', { class: 'pile', title: 'Pioche — clic : fouiller ; dépose une carte ici pour la remettre dessus (Maj = dessous)' }, back(d.draw.length), el('small', { text: 'Pioche' }));
      pd.addEventListener('click', () => openPile(cur, 'draw')); dropTarget(pd, cur, 'draw', 'top');
      // main
      const hand = el('div', { class: 'hand' });
      if(handHidden(cur)) d.hand.forEach(() => hand.append(back()));
      else d.hand.forEach(c => hand.append(mini(cur, 'hand', c, { w: 112 })));
      if(!d.hand.length) hand.append(el('span', { class: 'hint', text: 'Main vide — clique sur « Piocher »' }));
      dropTarget(hand, cur, 'hand');
      // piles de droite
      const top = a => a.length ? a[a.length - 1] : null;
      const pile = (z, label) => { const a = d[z]; const t = top(a);
        const p = el('div', { class: 'pile', title: `${label} — clic : voir ; glisse une carte ici` });
        if(t && cards[t.c]){ const m = el('div', { class: 'ptop' }); m.innerHTML = jdrCardHTML(cards[t.c], { width: '58px' }); p.append(m); } else p.append(el('div', { class: 'pempty2' }));
        p.append(el('small', { text: `${label} (${a.length})` }));
        p.addEventListener('click', () => openPile(cur, z)); dropTarget(p, cur, z); return p; };
      body.append(pd, hand, el('div', { class: 'piles' }, pile('play', 'En jeu'), pile('discard', 'Défausse'), pile('banished', 'Bannies')));
    }
    T.replaceChildren(head, body);
    // les cartes de la main se chevauchent juste assez pour tenir dans la largeur
    const H = T.querySelector('.hand'); if(H){ const kids = [...H.children].filter(k => k.matches('.pcard, .cback')); const n = kids.length;
      if(n > 1){ const cw = 112, room = H.clientWidth - 16; const gap = Math.min(6, (room - cw) / (n - 1) - cw); kids.forEach((k, i) => { k.style.marginLeft = i ? gap + 'px' : '0'; }); } }
    document.body.style.setProperty('--trayh', T.offsetHeight + 'px');   // les joueurs connectés et le zoom se placent au-dessus
  }
  function confirmThen(text, fn){
    const m = el('div', { class: 'ctx', style: 'max-width:300px' }, el('div', { class: 'ch', text: 'Confirmer' }), el('p', { style: 'margin:4px 10px 8px;font-size:.9rem', text }),
      el('button', { type: 'button', class: 'dang', text: 'Oui, continuer', onclick: () => { m.remove(); fn(); } }), el('button', { type: 'button', text: 'Annuler', onclick: () => m.remove() }));
    const r = document.getElementById('tray').getBoundingClientRect(); m.style.left = (r.left + 40) + 'px'; m.style.bottom = (innerHeight - r.top + 8) + 'px';
    document.body.append(m); setTimeout(() => document.addEventListener('pointerdown', function h(e){ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('pointerdown', h, true); } }, true), 0);
  }
  // Petit menu générique (réutilise le style du menu clic droit)
  function menu(x, y, entries, title){
    document.querySelectorAll('.pcmenu').forEach(n => n.remove());
    const m = el('div', { class: 'ctx pcmenu', role: 'menu' });
    if(title) m.append(el('div', { class: 'ch', text: title }));
    entries.forEach(e => { if(e === '-') return m.append(el('div', { class: 'sep' }));
      m.append(el('button', { type: 'button', class: e[2] || '', text: e[0], onclick: () => { m.remove(); e[1](); } })); });
    document.body.append(m); const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', function h(e){ if(!m.contains(e.target)){ m.remove(); document.removeEventListener('pointerdown', h, true); } }, true), 0);
  }
  function cardMenu(ch, z, c, x, y){
    const card = cards[c.c]; const go = (tz, pos) => move({ ch, z, u: c.u }, { ch, z: tz }, pos);
    const e = [];
    if(z === 'hand' || z === 'play') e.push(['Jouer (montrer à tous)', () => play(ch, c.u, z)]);
    if(z !== 'hand') e.push(['Prendre en main', () => go('hand')]);
    if(z !== 'discard') e.push(['Défausser', () => go('discard')]);
    if(z !== 'banished') e.push(['Bannir', () => go('banished')]);
    if(z !== 'play') e.push(['Mettre en jeu (reste posée)', () => go('play')]);
    e.push(['Remettre sur la pioche', () => go('draw', 'top')], ['Remettre sous la pioche', () => go('draw', 'bottom')]);
    const others = options().filter(([id]) => id !== ch);
    if(others.length){ e.push('-'); others.forEach(([id, n]) => e.push([`Donner à ${n} (sa main)`, () => move({ ch, z, u: c.u }, { ch: id, z: 'hand' })])); }
    if(card){ e.push('-', ['Agrandir', () => jdrZoomCard(card)]); }
    menu(x, y, e, card ? card.name : c.c);
  }

  /* ---------- Fenêtre d'une pile (la sienne ou celle d'un autre joueur) ---------- */
  const pileWins = new Map();
  function openPile(ch, z){
    const key = `__pile:${ch}:${z}`;
    const w = makeWin(key, `${ZONES[z]} de ${nameOf(ch)}`);
    w.el.classList.add('wide'); pileWins.set(key, { w, ch, z }); w.tabs.hidden = true;
    renderPile(key);
  }
  function renderPile(key){
    const p = pileWins.get(key); if(!p) return; if(!wins.has(key)){ pileWins.delete(key); return; }
    const { w, ch, z } = p; const st = states.get(ch); const a = st ? st.data[z] : [];
    w.head.querySelector('b').textContent = `${ZONES[z]} de ${nameOf(ch)} (${a.length})`;
    const grid = el('div', { class: 'pgrid' });
    const hidden = z === 'hand' && handHidden(ch);
    const list = z === 'discard' || z === 'banished' || z === 'play' ? a.slice().reverse() : a;   // dessus en premier
    list.forEach(c => grid.append(hidden ? back() : mini(ch, z, c, { w: 120 })));
    if(!a.length) grid.append(el('p', { class: 'hint', style: 'margin:0', text: 'Pile vide — glisse une carte ici.' }));
    dropTarget(grid, ch, z, 'top');
    w.body.replaceChildren(el('p', { class: 'hint', style: 'margin:0', text: (z === 'draw' ? 'Ordre de la pioche : la première carte est celle du dessus. ' : 'La première carte est celle du dessus. ') + 'Glisse les cartes vers une autre pile (du bandeau ou d’une autre fenêtre), ou clic droit pour les actions.' }), grid);
    const f = [];
    if(z === 'draw') f.push(el('button', { type: 'button', text: 'Mélanger', onclick: () => shuffleDraw(ch) }), el('button', { type: 'button', text: 'Piocher 1', onclick: () => draw(ch, 1) }));
    if(z === 'discard') f.push(el('button', { type: 'button', text: 'Remélanger dans la pioche', onclick: async () => { if(await mutate(ch, d => { d.draw = shuffle([...d.draw, ...d.discard.splice(0)]); })) log(`${nameOf(ch)} remélange sa défausse dans sa pioche`); } }));
    w.foot.replaceChildren(...f); w.foot.hidden = !f.length;
  }
  function refreshWins(){ [...pileWins.keys()].forEach(renderPile); }

  /* ---------- Carte glissée sur le plateau = jouée ---------- */
  function dropOnBoard(raw){ const f = JSON.parse(raw); if(f.z === 'hand' || f.z === 'play') play(f.ch, f.u, f.z); else move(f, { ch: f.ch, z: 'discard' }); }

  // Défausser plusieurs cartes de la main d'un coup (fin de tour : limite d'Anticipation)
  async function discardMany(ch, us){
    let names = [];
    const ok = await mutate(ch, d => { names = []; us.forEach(u => { const i = d.hand.findIndex(c => c.u === u); if(i >= 0){ const c = d.hand.splice(i, 1)[0]; d.discard.push(c); names.push(cardName(c)); } }); if(!names.length) return false; });
    if(ok) log(`${nameOf(ch)} défausse ${names.map(n => '« ' + n + ' »').join(', ')} (limite de main)`);
    return !!ok;
  }
  const stateOf = ch => states.get(ch) || null;
  return { load, render, onChange, reveal, dropOnBoard, openPile, draw, discardMany, stateOf, mini, nameOf, states, get cards(){ return cards; } };
})();
