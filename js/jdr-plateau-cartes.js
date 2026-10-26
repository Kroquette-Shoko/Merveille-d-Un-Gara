/* ============================================================
   Merveille d'Un'Gara — MAIN ET DECK sur le plateau (26/10/2026)
   Chargé par plateau.html APRÈS ses variables (me, isGM, CAMP, chars, el, toast, postMsg, send, makeWin…).

   Piles d'un personnage (table jdr.play_states, une ligne par personnage) :
     draw (pioche, [0] = dessus) · hand (main) · discard (défausse, dernier = dessus) · banished (bannies) · play (en jeu)
     · special (actions spéciales : cartes mises de côté qu'on peut jouer d'ailleurs que la main, ex. une chanson « redite »)
   Une carte en jeu = un exemplaire { u: identifiant unique, c: id de la carte }.
   Accès libre (choix du MJ) : tout joueur de la partie peut agir sur les piles des autres ; tout est noté dans la discussion.
   Les mains des autres joueurs sont montrées de dos (sauf au MJ).
   Conflits : chaque modification vérifie la « version » de la ligne ; si quelqu'un a modifié entre-temps,
   on relit et on rejoue l'action (jusqu'à 4 fois).
   ============================================================ */
const PC = (() => {
  const ZONES = { draw: 'Pioche', hand: 'Main', discard: 'Défausse', banished: 'Bannies', play: 'En jeu', special: 'Actions spéciales' };
  const HIS = { draw: 'sa pioche', hand: 'sa main', discard: 'sa défausse', banished: 'ses cartes bannies', play: 'ses cartes en jeu', special: 'ses actions spéciales' };
  const states = new Map();          // character_id → { character_id, char_name, owner_id, version, data }
  let cards = {};                    // id → carte
  let origins = [];                  // classes et spécialisations (pour savoir qui a accès à la magie)
  let cur = null;                    // personnage affiché dans le bandeau
  let open = true;                   // bandeau déplié
  try{ open = localStorage.getItem('jdr-tray-open') !== '0'; }catch(e){}
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const blank = () => ({ draw: [], hand: [], discard: [], banished: [], play: [], special: [] });
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
    try{ const { data: o } = await jdrSb.from('origins').select('name,data'); origins = o || []; }catch(e){ origins = []; }
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
    // fin de tour bloquée ou débloquée : le pion du personnage change (on peut / ne peut plus le déplacer)
    const ch = (n && n.character_id) || (o && o.character_id);
    if(ch && typeof items !== 'undefined') [...items.values()].filter(x => x.character_id === ch).forEach(renderItem);
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

  /* ---------- Fin de tour bloquée ----------
     « Fin de tour » avec plus de cartes en main que l'Anticipation : data.endLock = vrai tant que le joueur n'a pas défaussé l'excédent.
     Pendant ce temps, LE JOUEUR DE CE PERSONNAGE ne peut plus rien faire avec lui (jouer, piocher, déplacer son pion…).
     Le MJ et les autres joueurs ne sont pas bloqués. Dès que la main est à la bonne taille, le tour se termine tout seul. */
  const ownsChar = ch => chars.some(x => x.id === ch && x.owner_id === me.id);
  const antOf = ch => { const cd = charData(ch); const v = cd && cd.stats ? cd.stats.ant : undefined; return v === undefined || v === '' || v === null || isNaN(Number(v)) ? null : Math.max(0, Number(v)); };
  const excessOf = ch => { const st = states.get(ch), a = antOf(ch); return !st || a === null ? 0 : Math.max(0, st.data.hand.length - a); };
  const isLocked = ch => { const st = states.get(ch); return !!(st && st.data.endLock); };
  const blockedForMe = ch => !isGM && ownsChar(ch) && isLocked(ch);
  function guard(ch){ if(blockedForMe(ch)){ toast(`Fin de tour : défausse d'abord ${excessOf(ch)} carte${excessOf(ch) > 1 ? 's' : ''}.`); return false; } return true; }
  async function setEndLock(ch, on){ await mutate(ch, d => { if(!!d.endLock === !!on) return false; d.endLock = on ? true : null; }); }
  // appelé après chaque défausse : si l'excédent est parti, on termine le tour
  async function checkEndLock(ch){
    if(!isLocked(ch) || excessOf(ch) > 0) return;
    if(!(isGM || ownsChar(ch))) return;
    await setEndLock(ch, false);
    if(typeof TO !== 'undefined') await TO.finishTurn(ch);
  }

  /* ---------- Actions ---------- */
  async function prepare(ch){
    const c = chars.find(x => x.id === ch);
    let deck = c && Array.isArray(c.deck) ? c.deck : null;
    if(!deck){ const { data } = await jdrSb.from('characters').select('deck').eq('id', ch).maybeSingle(); deck = data && Array.isArray(data.deck) ? data.deck : null; }
    if(!deck){ toast('Deck introuvable : seul le joueur ou le MJ peut préparer ce deck.'); return; }
    const list = []; deck.forEach(e => { for(let i = 0; i < (Number(e.qty) || 0); i++) list.push({ u: uid(), c: e.card }); });
    if(!list.length){ toast('Le deck de ' + nameOf(ch) + ' est vide : construis-le depuis sa fiche.'); return; }
    if(await mutate(ch, d => { Object.assign(d, blank(), { draw: shuffle(list), pending: null }); })) log(`${nameOf(ch)} prépare son deck (${list.length} cartes mélangées)`);
  }
  async function draw(ch, n){
    if(!guard(ch)) return;
    // aucune carte nulle part (deck jamais préparé) : on prépare d'abord le deck construit
    const st0 = states.get(ch); const total = st0 ? Object.keys(ZONES).reduce((a, z) => a + st0.data[z].length, 0) + (st0.data.pending ? 1 : 0) : 0;
    if(!total){ await prepare(ch); if(!states.get(ch) || !states.get(ch).data.draw.length) return; }
    let reshuffled = false, risks = [], got = 0;
    const ok = await mutate(ch, d => { reshuffled = false; risks = []; got = 0;
      for(let i = 0; i < n; i++){
        if(!d.draw.length){ if(!d.discard.length) break; d.draw = shuffle(d.discard.splice(0)); reshuffled = true; }   // pioche vide : on remélange la défausse
        const c = d.draw.shift(); d.hand.push(c); got++; if(isRisk(c)) risks.push(cardName(c));
      } if(!got && !reshuffled) return false; });
    if(!ok){ toast('Plus aucune carte à piocher.'); return; }
    log(`${nameOf(ch)} pioche ${got} carte${got > 1 ? 's' : ''}${reshuffled ? ' (défausse remélangée dans la pioche)' : ''}${risks.length ? ' — Risque : ' + risks.map(r => '« ' + r + ' »').join(', ') : ''}`);
    if(risks.length) await autoRisk(ch);
  }
  // Livret : un Risque pioché s'active tout de suite → il est joué automatiquement (fenêtre vue par tous),
  // puis le suivant une fois le premier résolu.
  async function autoRisk(ch){
    const st = states.get(ch); if(!st || st.data.pending) return;
    const r = st.data.hand.find(isRisk); if(r) await play(ch, r.u, 'hand');
  }
  async function shuffleDraw(ch){ if(!guard(ch)) return; if(await mutate(ch, d => { shuffle(d.draw); })) log(`${nameOf(ch)} mélange sa pioche`); }
  async function rest(ch){
    let removed = 0, total = 0;
    const ok = await mutate(ch, d => { const all = Object.keys(ZONES).flatMap(z => d[z] || []);
      const keep = all.filter(c => !isRisk(c)); removed = all.length - keep.length; total = keep.length; if(d.pending){ all.push(d.pending.card); d.pending = null; } Object.assign(d, blank(), { draw: shuffle(keep) }); });
    if(ok) log(`${nameOf(ch)} se repose : toutes ses cartes reviennent dans la pioche (${total})${removed ? `, ${removed} Risque${removed > 1 ? 's' : ''} retiré${removed > 1 ? 's' : ''}` : ''}`);
  }
  // Déplacer un exemplaire d'une pile à une autre (éventuellement d'un personnage à un autre)
  async function move(from, to, pos){
    // joueur bloqué en fin de tour : il peut seulement défausser des cartes de sa main
    const discarding = from.ch === to.ch && from.z === 'hand' && to.z === 'discard';
    if(!discarding && (!guard(from.ch) || !guard(to.ch))) return;
    const verb = { hand: 'prend en main', discard: 'défausse', banished: 'bannit', play: 'met en jeu', special: 'met de côté (action spéciale)', draw: pos === 'bottom' ? 'remet sous la pioche' : 'remet sur la pioche' }[to.z];
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
    if(from.ch === to.ch) text = `${nameOf(to.ch)} ${verb} ${what}${from.z !== 'hand' ? ` (depuis ${HIS[from.z]})` : ''}`;
    else text = `${actor} déplace ${what} : ${whose(from.z)} de ${nameOf(from.ch)} → ${whose(to.z)} de ${nameOf(to.ch)}`;
    log(text, secret ? {} : { card: card.c });
    // une carte qui arrive « En jeu » est jouée : elle est montrée à toute la table (par défaut)
    if(to.z === 'play' && from.z !== 'play'){ const p = { card: card.c, who: nameOf(to.ch) }; reveal(p); send('reveal', p); }
    if(discarding) await checkEndLock(from.ch);
  }
  /* ---------- Jouer une carte : choix de l'effet, points d'action (PA), annulation ----------
     1. « Jouer » : la carte quitte la main et devient « en attente » (data.pending) ; elle s'affiche chez TOUT LE MONDE.
     2. Le joueur qui l'a jouée (ou le propriétaire, ou le MJ) clique sur l'effet qu'il résout :
        les PA de l'effet sont retirés des PA du tour (data.pa) ; pas assez de PA → message, rien ne se passe.
        La carte va ensuite à la défausse (ou reste « En jeu » si elle est persistante).
     3. « Annuler » : la carte revient d'où elle vient, aucun PA dépensé.
     PA restants : data.pa (vide = maximum, la caractéristique « Point d'action » de la fiche). Remis au maximum
     au début du tour du joueur, à chaque nouveau round et à chaque nouvelle scène (voir js/jdr-plateau-tours.js). */
  const paMax = ch => { const c = chars.find(x => x.id === ch); const v = c && c.data && c.data.stats ? Number(c.data.stats.pa) : NaN; return isNaN(v) ? null : Math.max(0, v); };
  const paLeft = ch => { const st = states.get(ch); const m = paMax(ch); const v = st && st.data.pa !== undefined && st.data.pa !== null ? Number(st.data.pa) : m; return v === null ? null : v; };
  function effectsOf(card){
    const out = [];
    const risk = card && card.type === 'Risque';   // un Risque subi ne coûte pas de PA
    (card && card.abilities || []).forEach((ab, i) => { const t = jdrAbilityText(ab); if(t) out.push({ key: 'a' + i, ab, text: t, pa: risk ? 0 : Number(ab.pa) || 0 }); });
    if(card && card.special && card.special.enabled && !card.special.rule){ const t = jdrAbilityText(card.special); if(t) out.push({ key: 'sp', ab: card.special, text: t, pa: Number(card.special.pa) || 0, name: card.special.name || 'Spécial' }); }
    if(!out.length) out.push({ key: 'x', ab: null, text: risk ? 'Subir le Risque' : 'Résoudre la carte', pa: 0 });
    return out;
  }
  async function play(ch, u, zone){
    zone = zone || 'hand';
    if(!guard(ch)) return;
    const st = states.get(ch); if(st && st.data.pending){ toast('Une carte de ' + nameOf(ch) + ' attend déjà son effet : résous-la ou annule-la d’abord.'); return; }
    const c = st && st.data[zone].find(x => x.u === u); if(!c) return;
    const ok = await mutate(ch, d => { if(d.pending) return false; const i = d[zone].findIndex(x => x.u === u); if(i < 0) return false;
      d.pending = { card: d[zone].splice(i, 1)[0], from: zone, by: me.id, at: Date.now() }; });
    if(!ok) return;
    log(isRisk(c) ? `${nameOf(ch)} subit le Risque « ${cardName(c)} »` : `${nameOf(ch)} joue « ${cardName(c)} »`, { card: c.c });
  }
  const canDecide = (ch, p) => isGM || (p && p.by === me.id) || chars.some(x => x.id === ch && x.owner_id === me.id);
  async function resolve(ch, key, force){
    const st = states.get(ch); const p = st && st.data.pending; if(!p) return;
    const card = cards[p.card.c]; const eff = effectsOf(card).find(e => e.key === key); if(!eff) return;
    const left = paLeft(ch);
    if(!force && left !== null && eff.pa > left){ paPopup(ch, eff, left); return; }
    const dest = card && card.persistent ? 'play' : 'discard';
    let after = left;
    const ok = await mutate(ch, d => { if(!d.pending || d.pending.card.u !== p.card.u) return false;
      d[dest].push(d.pending.card); d.pending = null;
      if(left !== null){ after = Math.max(0, left - eff.pa); d.pa = after; } });
    if(!ok) return;
    const what = eff.ab ? (eff.name ? `${eff.name} — ` : '') + eff.text : 'carte résolue';
    log(`${nameOf(ch)} résout « ${cardName(p.card)} » : ${what.length > 140 ? what.slice(0, 137) + '…' : what}${eff.pa ? ` (−${eff.pa} PA${after !== null ? `, reste ${after}` : ''})` : ''}${dest === 'play' ? ' — reste en jeu' : ''}`, { card: p.card.c });
    if(isRisk(p.card)) await autoRisk(ch);
  }
  async function cancel(ch){
    const st = states.get(ch); const p = st && st.data.pending; if(!p) return;
    const ok = await mutate(ch, d => { if(!d.pending) return false; const z = d.pending.from || 'hand'; (d[z] = d[z] || []).push(d.pending.card); d.pending = null; });
    if(ok) log(`${nameOf(ch)} annule « ${cardName(p.card)} » (la carte revient ${p.from === 'play' ? 'en jeu' : p.from === 'special' ? 'dans ses actions spéciales' : 'en main'})`);
  }
  function paPopup(ch, eff, left){
    document.getElementById('padlg')?.remove();
    const d = el('dialog', { class: 'dlg', id: 'padlg' }, el('div', { class: 'bd' },
      el('h2', { text: 'Pas assez de points d’action' }),
      el('p', { style: 'margin:0', text: `${nameOf(ch)} n’a plus que ${left} PA ce tour-ci, et cet effet en coûte ${eff.pa}.` }),
      el('p', { class: 'hint', style: 'margin:0', text: 'Choisis un autre effet, ou annule la carte : elle reviendra en main.' }),
      el('div', { class: 'row', style: 'justify-content:flex-end' },
        ...(isGM ? [el('button', { type: 'button', text: 'Résoudre quand même (MJ)', onclick: () => { d.close(); resolve(ch, eff.key, true); } })] : []),
        el('button', { type: 'button', class: 'primary', text: 'Compris', onclick: () => d.close() }))));
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0));
    document.body.append(d); d.showModal();
  }
  async function setPA(ch, v){ const m = paMax(ch); await mutate(ch, d => { d.pa = v === null ? null : Math.max(0, Math.min(m === null ? 99 : m, v)); }); }
  async function resetPA(ids){ for(const id of ids){ if(!states.has(id) || paMax(id) === null) continue; await mutate(id, d => { if(d.pa === null || d.pa === undefined) return false; d.pa = null; }); } }

  /* ---------- CONVERTIR DU MANA ----------
     Accès à la magie : la spécialisation du personnage décide (magie oui / non) ; sans spécialisation, sa classe
     (« aucune » = non ; « certaines » ou « toutes » = oui). Personnage sans classe connue : bouton affiché.
     Fenêtre : on choisit un sort (Sortilège) de sa main → il est banni et on gagne 2 × son coût en mana.
     Le montant reste modifiable (règles spéciales) ; on peut aussi gagner du mana sans bannir de carte. */
  const norm2 = t => String(t || '').trim().toLowerCase();
  function hasMagic(ch){
    const cd = charData(ch) || {};
    const spec = origins.find(o => o.data && o.data.kind === 'specialisation' && norm2(o.name) === norm2(cd.specialisation));
    if(spec) return spec.data.magic === true || spec.data.magic === 'true';
    const cls = origins.find(o => o.data && o.data.kind === 'classe' && norm2(o.name) === norm2(cd.classe));
    if(cls) return cls.data.magic !== 'aucune';
    return true;
  }
  const isSpell = c => cards[c.c] && cards[c.c].type === 'Sortilège';
  const manaCost = c => { const v = cards[c.c] && cards[c.c].mana; return v === null || v === undefined || v === '' || isNaN(Number(v)) ? 0 : Math.max(0, Number(v)); };
  function manaOf(ch){ const cd = charData(ch) || {}; const r = (cd.resources || []).find(x => /mana/i.test(x.name || '')); return r ? { cur: Number(r.val) || 0, max: Number(r.max) || 0 } : { cur: 0, max: 0 }; }
  async function gainMana(ch, n){
    const c = chars.find(x => x.id === ch); if(!c) return null;
    const d = structuredClone(c.data || {}); d.resources = Array.isArray(d.resources) ? d.resources : [];
    let r = d.resources.find(x => /mana/i.test(x.name || '')); if(!r){ r = { name: 'Mana', max: 0, val: 0 }; d.resources.push(r); }
    const before = Number(r.val) || 0, max = Number(r.max) || 0;
    r.val = max ? Math.min(max, before + n) : before + n;          // plafonné au maximum de la fiche (s'il y en a un)
    const { error } = await jdrSb.from('characters').update({ data: d }).eq('id', ch);
    if(error){ toast(jdrErrorText(error)); return null; }
    c.data = d;
    if(typeof items !== 'undefined') [...items.values()].filter(x => x.character_id === ch).forEach(renderItem);
    if(typeof renderHud === 'function') renderHud();
    return { before, after: r.val, max };
  }
  function openConvert(ch){
    if(!guard(ch)) return;
    const st = states.get(ch); const spells = st ? st.data.hand.filter(isSpell) : [];
    let picked = null, amount = 0, touched = false;
    document.getElementById('cvdlg')?.remove();
    const amt = el('input', { type: 'number', min: '0', max: '99', value: '0', style: 'width:5rem', 'aria-label': 'Mana gagné' });
    const preview = el('span', { class: 'hint' });
    const ok = el('button', { type: 'button', class: 'primary' });
    const refresh = () => { const m = manaOf(ch); const after = m.max ? Math.min(m.max, m.cur + amount) : m.cur + amount;
      preview.textContent = `Mana : ${m.cur}${m.max ? ' / ' + m.max : ''} → ${after}${m.max && m.cur + amount > m.max ? ' (maximum atteint)' : ''}`;
      ok.textContent = picked ? `Bannir « ${cardName(picked)} » et gagner ${amount} mana` : `Gagner ${amount} mana (sans bannir de carte)`;
      ok.disabled = !(amount > 0); };
    amt.addEventListener('input', () => { amount = Math.max(0, Math.min(99, Math.round(Number(amt.value) || 0))); touched = true; refresh(); });
    const grid = el('div', { class: 'pgrid' });
    spells.forEach(c => { const m = mini(ch, 'hand', c, { w: 110 }); m.draggable = false; m.classList.add('pick');
      m.addEventListener('click', () => { picked = picked && picked.u === c.u ? null : c;
        grid.querySelectorAll('.pick').forEach(x => x.classList.toggle('on', !!picked && x.dataset.u === picked.u));
        if(!touched || picked){ amount = picked ? 2 * manaCost(picked) : 0; amt.value = amount; touched = false; } refresh(); });
      grid.append(m); });
    if(!spells.length) grid.append(el('p', { class: 'hint', style: 'margin:0', text: 'Aucun sort (Sortilège) en main.' }));
    const d = el('dialog', { class: 'dlg', id: 'cvdlg', style: 'width:min(720px, calc(100vw - 24px))' },
      el('div', { class: 'bd' }, el('h2', { text: `Convertir du mana — ${nameOf(ch)}` }),
        el('p', { style: 'margin:0', text: 'Choisis le sort à bannir : tu gagnes le double de son coût en mana.' }), grid,
        el('div', { class: 'row', style: 'gap:8px;align-items:center;flex-wrap:wrap' }, document.createTextNode('Mana gagné :'), amt,
          el('span', { class: 'hint', text: '(modifiable pour les règles spéciales)' })), preview,
        el('div', { class: 'row', style: 'justify-content:flex-end' }, el('button', { type: 'button', text: 'Annuler', onclick: () => d.close() }), ok)));
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      if(picked){ const pu = picked.u; let gone = false;
        const done = await mutate(ch, x => { const i = x.hand.findIndex(c => c.u === pu); if(i < 0) return false; x.banished.push(x.hand.splice(i, 1)[0]); gone = true; });
        if(!done || !gone){ toast('Cette carte n’est plus dans la main.'); ok.disabled = false; return; } }
      const res = await gainMana(ch, amount); if(!res){ ok.disabled = false; return; }
      log(`${nameOf(ch)} ${picked ? `bannit « ${cardName(picked)} » et ` : ''}gagne ${amount} mana — mana : ${res.after}${res.max ? ' / ' + res.max : ''}`, picked ? { card: picked.c } : {});
      d.close();
    });
    d.addEventListener('close', () => setTimeout(() => d.remove(), 0));
    document.body.append(d); refresh(); d.showModal();
  }

  /* ---------- RISQUES ----------
     Les Risques viennent du DECK DES RISQUES de la campagne (40 cartes par défaut, table jdr.risk_decks) :
     on les tire avec jdr.risk_take (MJ et joueurs) ; quand ce deck est vide, il se régénère tout seul
     avec sa composition et se remélange. Les joueurs ne savent pas combien il en reste (seul le MJ le voit).
     - Pour qui : un ou plusieurs personnages ; Combien : N ; Où : mélangés dans la pioche, sur le dessus, ou en main
       (en main = piochés : ils s'activent tout de suite)
     - Fatigue (livret) : au début de chaque journée, autant de Risques que le niveau de fatigue → « Début de journée »
       (niveau gardé dans data.fatigue des piles du personnage)
     - MJ : composition du deck des Risques, cartes restantes, régénérer maintenant
     - Un Repos retire tous les Risques du deck du personnage (ils ne retournent pas dans le deck des Risques). */
  const riskCards = () => Object.values(cards).filter(c => c.type === 'Risque').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  async function takeRisks(n){
    const { data, error } = await jdrSb.rpc('risk_take', { p_campaign: CAMP, p_n: n });
    if(error){ toast(jdrErrorText(error)); return null; }
    if(data && data.regenerated && isGM) toast('Le deck des Risques était vide : il a été régénéré et remélangé.');   // pas annoncé aux joueurs (ils ne doivent pas savoir ce qu'il reste)
    return (data && data.cards) || [];
  }
  async function addRisks(ch, n, where){
    if(!(n > 0)) return;
    const ids = await takeRisks(n); if(!ids || !ids.length) return;
    const list = ids.map(id => ({ u: uid(), c: id }));
    const ok = await mutate(ch, d => { if(where === 'hand') d.hand.push(...list); else if(where === 'top') d.draw.unshift(...list); else d.draw = shuffle([...d.draw, ...list]); });
    if(!ok) return;
    const k = list.length;
    if(where === 'hand') log(`${nameOf(ch)} pioche ${k} Risque${k > 1 ? 's' : ''} — ${list.map(c => '« ' + cardName(c) + ' »').join(', ')}`);
    else log(`${nameOf(ch)} prend ${k} Risque${k > 1 ? 's' : ''} : ${k > 1 ? 'ils sont mélangés' : 'il est mélangé'} ${where === 'top' ? 'sur le dessus de' : 'dans'} sa pioche`);
    if(where === 'hand') await autoRisk(ch);
  }
  async function removeRisks(ch){
    let n = 0; const ok = await mutate(ch, d => { n = 0; Object.keys(ZONES).forEach(z => { const k = d[z].filter(c => !isRisk(c)); n += d[z].length - k.length; d[z] = k; }); if(!n) return false; });
    if(ok) log(`${myCharName()} retire ${n} Risque${n > 1 ? 's' : ''} du deck de ${nameOf(ch)}`); else toast(`Aucun Risque dans le deck de ${nameOf(ch)}.`);
  }
  const fatigueOf = ch => { const st = states.get(ch); return st ? Math.max(0, Number(st.data.fatigue) || 0) : 0; };
  // Deck des Risques (MJ seulement : les joueurs n'y ont pas accès)
  let riskDeck = null;
  async function loadRiskDeck(){
    if(!isGM) return null;
    const { data } = await jdrSb.from('risk_decks').select('cards,composition').eq('campaign_id', CAMP).maybeSingle();
    riskDeck = data || { cards: [], composition: null }; return riskDeck;
  }
  const DEFAULT_RISKS = { reussite_critique: 2, parade_parfaite: 2, guerison_surnaturel: 2, a_bout_de_souffle: 3, attirer_l_attention: 2, totalement_insignifiant: 2,
    un_truc_dans_l_oeil: 2, se_tordre_la_cheville: 2, se_decourager: 3, porter_la_poisse: 3, perte_d_energie: 2, perdre_la_main: 2, magie_sauvage: 3,
    main_glissante: 2, mauvaise_posture: 2, echec_critique: 3, deconcentration: 3 };
  async function saveComposition(comp, rebuild){
    const patch = { campaign_id: CAMP, composition: comp };
    if(rebuild){ const { data, error } = await jdrSb.rpc('risk_build', { p_comp: comp }); if(error){ toast(jdrErrorText(error)); return false; } patch.cards = data || []; }
    const { error } = await jdrSb.from('risk_decks').upsert(patch);
    if(error){ toast(jdrErrorText(error)); return false; }
    riskDeck = Object.assign(riskDeck || {}, patch); return true;
  }
  async function openRisks(preset){
    const w = makeWin('__risks', 'Risques'); w.tabs.hidden = true; w.el.classList.add('wide');
    const pcs = options(); const pick = new Set(preset ? [preset] : (cur ? [cur] : []));
    let n = 1, where = 'shuffle';
    if(isGM) await loadRiskDeck();
    const comp = Object.assign({}, (riskDeck && riskDeck.composition && Object.keys(riskDeck.composition).length) ? riskDeck.composition : DEFAULT_RISKS);
    let compDirty = false;
    const body = () => {
      const kids = [];
      kids.push(el('div', { class: 'au-sub', text: '1. Pour qui' }));
      const tbl = el('div', { class: 'rk-pcs' });
      pcs.forEach(([id, nm]) => {
        const c = el('input', { type: 'checkbox', 'aria-label': nm }); c.checked = pick.has(id); c.addEventListener('change', () => { c.checked ? pick.add(id) : pick.delete(id); total(); });
        const inDeck = riskCount(id);
        const fat = el('input', { type: 'number', min: '0', max: '6', value: fatigueOf(id), style: 'width:4rem', 'aria-label': 'Fatigue de ' + nm, title: 'Niveau de fatigue (0 à 6)' });
        fat.addEventListener('change', async () => { const v = Math.max(0, Math.min(6, Number(fat.value) || 0)); await mutate(id, d => { d.fatigue = v; }); log(`Fatigue de ${nm} : niveau ${v}`); });
        tbl.append(el('label', { class: 'rk-pc' }, c, el('span', { class: 'rk-n', text: nm }), el('span', { class: 'hint', text: inDeck ? `⚠ ${inDeck} Risque${inDeck > 1 ? 's' : ''} dans son deck` : 'aucun Risque dans son deck' }),
          el('span', { class: 'rk-f' }, document.createTextNode('Fatigue '), fat)));
      });
      kids.push(tbl, el('div', { class: 'row', style: 'gap:6px' },
        el('button', { type: 'button', text: 'Tout le monde', onclick: () => { pcs.forEach(([id]) => pick.add(id)); render2(); } }),
        el('button', { type: 'button', text: 'Personne', onclick: () => { pick.clear(); render2(); } })));
      kids.push(el('div', { class: 'au-sub', text: '2. Combien (tirés du deck des Risques)' }));
      const ni = el('input', { type: 'number', min: '1', max: '20', value: n, style: 'width:5rem', 'aria-label': 'Nombre de Risques' });
      ni.addEventListener('input', () => { n = Math.max(1, Math.min(20, Number(ni.value) || 1)); total(); });
      kids.push(el('div', { class: 'row', style: 'gap:6px;align-items:center' }, ni, document.createTextNode('Risque(s) par personnage coché')));
      kids.push(el('div', { class: 'au-sub', text: '3. Où' }));
      const ws = el('select', { 'aria-label': 'Où mettre les Risques' }, el('option', { value: 'shuffle', text: 'Mélangés dans sa pioche (prendre des risques)' }), el('option', { value: 'top', text: 'Sur le dessus de sa pioche' }), el('option', { value: 'hand', text: 'Piochés directement (activés tout de suite)' }));
      ws.value = where; ws.addEventListener('change', () => { where = ws.value; });
      kids.push(ws);
      if(isGM){
        kids.push(el('div', { class: 'au-sub', text: 'Deck des Risques (toi seul le vois)' }));
        const left = riskDeck && Array.isArray(riskDeck.cards) && riskDeck.composition ? riskDeck.cards.length : null;
        const tot = Object.values(comp).reduce((a, b) => a + (Number(b) || 0), 0);
        kids.push(el('p', { style: 'margin:0', text: left === null ? `Pas encore créé : il le sera au premier tirage (${tot} cartes).` : `${left} carte${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''} sur ${tot}. Quand il est vide, il se régénère tout seul.` }));
        const grid = el('div', { class: 'rk-grid' });
        riskCards().forEach(c => { const q = Number(comp[c.id]) || 0;
          const m = el('div', { class: 'rk-c' + (q ? ' on' : ''), title: 'Clic droit : agrandir' }); m.innerHTML = jdrCardHTML(c, { width: '110px' });
          m.addEventListener('contextmenu', e => { e.preventDefault(); jdrZoomCard(c); });
          const set = v => { comp[c.id] = Math.max(0, Math.min(20, v)); if(!comp[c.id]) delete comp[c.id]; compDirty = true; render2(); };
          grid.append(el('div', { class: 'rk-cw' }, m, el('div', { class: 'rk-s' },
            el('button', { type: 'button', text: '−', 'aria-label': 'Moins de ' + c.name, onclick: () => set(q - 1) }), el('span', { class: 'rk-q', text: String(q) }),
            el('button', { type: 'button', text: '+', 'aria-label': 'Plus de ' + c.name, onclick: () => set(q + 1) })))); });
        kids.push(grid, el('div', { class: 'row', style: 'gap:6px;align-items:center' },
          el('span', { style: 'font-weight:700', text: `Composition : ${tot} cartes` }),
          el('button', { type: 'button', class: compDirty ? 'primary' : '', text: 'Enregistrer la composition', disabled: !compDirty, title: 'Servira à la prochaine régénération', onclick: async () => { if(await saveComposition(comp, false)){ compDirty = false; toast('Composition enregistrée'); render2(); } } }),
          el('button', { type: 'button', text: '↻ Régénérer le deck maintenant', title: 'Remet toutes les cartes de la composition et remélange', onclick: async () => { if(await saveComposition(comp, true)){ compDirty = false; log('Le MJ régénère et remélange le deck des Risques'); render2(); } } }),
          el('button', { type: 'button', text: 'Composition par défaut (40)', onclick: () => { Object.keys(comp).forEach(k => delete comp[k]); Object.assign(comp, DEFAULT_RISKS); compDirty = true; render2(); } })));
      }
      return kids;
    };
    const okBtn = el('button', { type: 'button', class: 'primary' });
    const render2 = () => { const sc = w.body.scrollTop; w.body.replaceChildren(...body()); w.body.scrollTop = sc; total(); };
    const total = () => { okBtn.textContent = `Tirer ${n} Risque${n > 1 ? 's' : ''} × ${pick.size} personnage${pick.size > 1 ? 's' : ''}`; okBtn.disabled = !pick.size; };
    okBtn.addEventListener('click', async () => { okBtn.disabled = true; for(const ch of pick) await addRisks(ch, n, where); if(isGM) await loadRiskDeck(); render2(); });
    w.foot.replaceChildren(okBtn,
      el('button', { type: 'button', text: '🌅 Début de journée (fatigue)', title: 'Chaque personnage coché tire autant de Risques que son niveau de fatigue (mélangés dans sa pioche)', onclick: async () => {
        let any = false; for(const ch of pick){ const k = fatigueOf(ch); if(!k) continue; any = true; await addRisks(ch, k, 'shuffle'); }
        if(!any) toast('Aucun personnage coché n’a de fatigue.'); if(isGM) await loadRiskDeck(); render2(); } }),
      el('button', { type: 'button', class: 'danger', text: 'Retirer les Risques', title: 'Retire toutes les cartes Risque du deck des personnages cochés', onclick: async () => { for(const ch of pick) await removeRisks(ch); render2(); } }));
    w.foot.hidden = false; render2();
  }
  const riskCount = ch => { const st = states.get(ch); return st ? Object.keys(ZONES).reduce((a, z) => a + st.data[z].filter(isRisk).length, 0) : 0; };

  /* ---------- Cartes en attente : fenêtre montrée à toute la table ---------- */
  function renderPending(){
    let box = document.getElementById('pendings');
    if(!box){ box = el('div', { id: 'pendings', class: 'pendings', 'aria-live': 'polite' }); document.body.append(box); }
    const list = [...states.values()].filter(st => st.data.pending);
    box.replaceChildren(...list.map(st => {
      const ch = st.character_id, p = st.data.pending, card = cards[p.card.c]; const can = canDecide(ch, p);
      const left = paLeft(ch), max = paMax(ch);
      const cw = el('div', { class: 'pd-card', title: 'Agrandir' }); cw.innerHTML = card ? jdrCardHTML(card, { width: '200px' }) : `<div class="cmiss">${jdrEsc(p.card.c)}</div>`;
      cw.addEventListener('click', () => card && jdrZoomCard(card));
      const effs = effectsOf(card).map(e => { const short = left !== null && e.pa > left;
        const b = el('button', { type: 'button', class: 'pd-eff' + (short ? ' short' : ''), disabled: !can, title: can ? (short ? 'Pas assez de PA' : 'Résoudre cet effet') : 'Seul le joueur qui a joué la carte (ou le MJ) choisit' });
        if(e.name) b.append(el('b', { text: e.name }));
        const t = el('div', { class: 'pd-t' }); t.innerHTML = jdrRichText(e.text); b.append(t);
        b.addEventListener('click', () => resolve(ch, e.key)); return b; });
      return el('div', { class: 'pending' + (card && card.type === 'Risque' ? ' risk' : ''), role: 'dialog', 'aria-label': `${nameOf(ch)} joue ${card ? card.name : ''}` },
        el('div', { class: 'pd-h' }, el('b', { text: card && card.type === 'Risque' ? `⚠ ${nameOf(ch)} pioche un Risque : « ${card.name} »` : `${nameOf(ch)} joue « ${card ? card.name : p.card.c} »` }),
          el('span', { class: 'pd-pa', text: left !== null ? `${left} / ${max} PA` : 'PA non renseignés' })),
        el('div', { class: 'pd-b' }, cw, el('div', { class: 'pd-effs' },
          el('div', { class: 'hint', style: 'margin:0', text: can ? 'Clique sur l’effet que tu résous :' : `En attente du choix de ${nameOf(ch)}…` }), ...effs,
          el('button', { type: 'button', class: 'pd-cancel', disabled: !can, text: `Annuler (la carte revient ${p.from === 'play' ? 'en jeu' : p.from === 'special' ? 'dans les actions spéciales' : 'en main'})`, onclick: () => cancel(ch) }))));
    }));
    box.hidden = !list.length;
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
    // Bandeau, dans l'ordre : Main de [personnage] · Prendre le tour · Convertir du mana (si magie) · Piocher une carte · Fin de tour · ⋯
    const head = el('div', { class: 'trh' },
      el('button', { type: 'button', class: 'trtog', text: open ? '▾' : '▴', title: open ? 'Replier la main' : 'Déplier la main', 'aria-label': open ? 'Replier la main' : 'Déplier la main', onclick: () => { open = !open; try{ localStorage.setItem('jdr-tray-open', open ? '1' : '0'); }catch(e){} render(); } }),
      el('b', { text: 'Main de' }), sel);
    if(cur){
      const ctl = isGM || ownsChar(cur);             // prendre / finir le tour, convertir : le joueur du personnage ou le MJ
      const locked = isLocked(cur), ex = excessOf(cur);
      if(ctl) head.append(el('button', { type: 'button', class: 'primary', text: '▶ Prendre le tour', title: 'Pioche autant de cartes que l’Opportunisme et remet tous les PA', disabled: blockedForMe(cur),
        onclick: () => typeof TO !== 'undefined' && TO.takeTurn(cur) }));
      if(ctl && hasMagic(cur)) head.append(el('button', { type: 'button', text: '✦ Convertir du mana', title: 'Bannir un sort de la main pour gagner 2 × son coût en mana', disabled: blockedForMe(cur), onclick: () => openConvert(cur) }));
      head.append(el('button', { type: 'button', text: 'Piocher une carte', disabled: blockedForMe(cur), onclick: () => draw(cur, 1) }));
      if(ctl) head.append(el('button', { type: 'button', class: locked ? 'danger' : '', text: locked ? `Fin de tour : défausser ${ex}` : 'Fin de tour',
        title: 'Défausser jusqu’à garder autant de cartes que l’Anticipation, puis terminer le tour', onclick: () => typeof TO !== 'undefined' && TO.endTurn(cur) }));
      const more = el('button', { type: 'button', text: '⋯', title: 'Autres actions', 'aria-label': 'Autres actions' });
      more.addEventListener('click', e => menu(e.clientX, e.clientY, [
        ['Mélanger la pioche', () => shuffleDraw(cur)],
        ['Remettre les PA au maximum', () => setPA(cur, null)],
        '-',
        ['Préparer le deck (repartir de zéro)', () => confirmThen('Préparer le deck : toutes les piles de ' + nameOf(cur) + ' sont remises à zéro.', () => prepare(cur))],
        ['Repos (tout remélanger, retirer les Risques)', () => confirmThen('Repos : toutes les cartes reviennent dans la pioche et les Risques sont retirés.', () => rest(cur))],
        ['⚠ Risques… (ajouter, fatigue, retirer)', () => openRisks(cur)],
        '-',
        ['Fouiller la pioche', () => openPile(cur, 'draw')], ['Voir la défausse', () => openPile(cur, 'discard')],
        ['Voir les cartes bannies', () => openPile(cur, 'banished')], ['Voir les cartes en jeu', () => openPile(cur, 'play')], ['Voir les actions spéciales', () => openPile(cur, 'special')]]));
      head.append(more);
    }
    const body = el('div', { class: 'trb' });
    if(!cur || !st) body.classList.add('small');   // pas de cartes : bandeau compact
    if(!cur) body.append(el('p', { class: 'hint', style: 'margin:0', text: isGM ? 'Choisis un personnage pour voir et manipuler ses cartes.' : 'Aucun personnage dans cette partie.' }));
    else if(!st) body.append(el('div', { class: 'trempty' }, el('span', { text: 'Pas encore de cartes en jeu pour ' + nameOf(cur) + '.' }),
      el('button', { type: 'button', class: 'primary', text: 'Préparer le deck', onclick: () => prepare(cur) })));
    else {
      // ---- Bloc du personnage, avant la main : portrait (+ étoile des PA, triangle des actions spéciales) · Opp / Ant / En jeu · DECK
      const cd = charData(cur) || {}, stats = cd.stats || {};
      const statN = k => (stats[k] === undefined || stats[k] === '' || isNaN(Number(stats[k]))) ? '—' : Number(stats[k]);
      const av = el('div', { class: 'tme-av', title: nameOf(cur) });
      if(cd.portrait) av.append(el('img', { src: cd.portrait, alt: '' })); else av.append(el('span', { class: 'tme-ini', text: (nameOf(cur) || '?').trim().charAt(0).toUpperCase() }));
      const left = paLeft(cur), max = paMax(cur);
      const star = el('div', { class: 'tme-star', title: left === null ? 'Points d’action : non renseignés sur la fiche' : `Points d’action restants : ${left} sur ${max}` },
        el('span', { text: left === null ? '–' : String(left) }));
      const sp = d.special || [];
      const tri = el('button', { type: 'button', class: 'tme-tri' + (sp.length ? ' on' : ''), title: `Actions spéciales (${sp.length}) — cartes jouables depuis ailleurs que la main. Clic : voir ; glisse une carte ici pour la mettre de côté.`,
        'aria-label': `Actions spéciales : ${sp.length}`, onclick: () => openPile(cur, 'special') }, el('span', { text: String(sp.length) }));
      dropTarget(tri, cur, 'special');
      const ant = antOf(cur), over = ant !== null && d.hand.length > ant;
      const box = (cls, lab, val, extra) => el('div', { class: 'tme-st ' + cls }, el('small', { text: lab }), el('b', { text: String(val) }), ...(extra ? [extra] : []));
      const playBox = box('tme-play', 'En jeu', (d.play || []).length);
      playBox.title = 'Cartes persistantes (en jeu) — clic : voir ; glisse une carte ici pour la mettre en jeu';
      playBox.addEventListener('click', () => openPile(cur, 'play')); dropTarget(playBox, cur, 'play');
      const stack = el('div', { class: 'tme-stats' },
        Object.assign(box('', 'Opp', statN('opp')), { title: 'Opportunisme : cartes piochées en prenant le tour' }),
        Object.assign(box(over ? 'excess' : '', 'Ant', statN('ant')), { title: `Anticipation : cartes gardées en fin de tour — ${d.hand.length} en main${over ? ' (trop !)' : ''}` }),
        playBox);
      const pd = el('div', { class: 'pile tme-deck', title: 'Deck (pioche) — clic : fouiller ; dépose une carte ici pour la remettre dessus (Maj = dessous)' }, back(d.draw.length), el('small', { text: 'Deck' }));
      pd.addEventListener('click', () => openPile(cur, 'draw')); dropTarget(pd, cur, 'draw', 'top');
      const me2 = el('div', { class: 'tme' }, el('div', { class: 'tme-avw' }, av, star, tri), stack, pd);
      // main
      const hand = el('div', { class: 'hand' });
      if(handHidden(cur)) d.hand.forEach(() => hand.append(back()));
      else d.hand.forEach(c => hand.append(mini(cur, 'hand', c, { w: 112 })));
      if(!d.hand.length) hand.append(el('span', { class: 'hint', text: 'Main vide — « Prendre le tour » ou « Piocher une carte »' }));
      dropTarget(hand, cur, 'hand');
      // piles de droite
      const top = a => a.length ? a[a.length - 1] : null;
      const pile = (z, label) => { const a = d[z]; const t = top(a);
        const p = el('div', { class: 'pile', title: `${label} — clic : voir ; glisse une carte ici` });
        if(t && cards[t.c]){ const m = el('div', { class: 'ptop' }); m.innerHTML = jdrCardHTML(cards[t.c], { width: '58px' }); p.append(m); } else p.append(el('div', { class: 'pempty2' }));
        p.append(el('small', { text: `${label} (${a.length})` }));
        p.addEventListener('click', () => openPile(cur, z)); dropTarget(p, cur, z); return p; };
      body.append(me2, hand, el('div', { class: 'piles' }, pile('discard', 'Défausse'), pile('banished', 'Bannies')));
    }
    T.replaceChildren(head, body);
    // les cartes de la main se chevauchent juste assez pour tenir dans la largeur
    const H = T.querySelector('.hand'); if(H){ const kids = [...H.children].filter(k => k.matches('.pcard, .cback')); const n = kids.length;
      if(n > 1){ const cw = 112, room = H.clientWidth - 16; const gap = Math.min(6, (room - cw) / (n - 1) - cw); kids.forEach((k, i) => { k.style.marginLeft = i ? gap + 'px' : '0'; }); } }
    document.body.style.setProperty('--trayh', T.offsetHeight + 'px');
    renderPending();   // les joueurs connectés et le zoom se placent au-dessus
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
    if(z === 'hand' || z === 'play' || z === 'special') e.push(['Jouer (montrer à tous)', () => play(ch, c.u, z)]);
    if(z !== 'hand') e.push(['Prendre en main', () => go('hand')]);
    if(z !== 'discard') e.push(['Défausser', () => go('discard')]);
    if(z !== 'banished') e.push(['Bannir', () => go('banished')]);
    if(z !== 'play') e.push(['Mettre en jeu (reste posée)', () => go('play')]);
    if(z !== 'special') e.push(['Mettre de côté (action spéciale)', () => go('special')]);
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
    const list = z === 'discard' || z === 'banished' || z === 'play' || z === 'special' ? a.slice().reverse() : a;   // dessus en premier
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
  function dropOnBoard(raw){ const f = JSON.parse(raw); if(f.z === 'hand' || f.z === 'play' || f.z === 'special') play(f.ch, f.u, f.z); else move(f, { ch: f.ch, z: 'discard' }); }

  // Défausser plusieurs cartes de la main d'un coup (fin de tour : limite d'Anticipation)
  async function discardMany(ch, us){
    let names = [];
    const ok = await mutate(ch, d => { names = []; us.forEach(u => { const i = d.hand.findIndex(c => c.u === u); if(i >= 0){ const c = d.hand.splice(i, 1)[0]; d.discard.push(c); names.push(cardName(c)); } }); if(!names.length) return false; });
    if(ok) log(`${nameOf(ch)} défausse ${names.map(n => '« ' + n + ' »').join(', ')} (limite de main)`);
    if(ok) await checkEndLock(ch);
    return !!ok;
  }
  const stateOf = ch => states.get(ch) || null;
  return { load, render, onChange, reveal, dropOnBoard, openPile, draw, discardMany, stateOf, mini, nameOf, resetPA, openRisks, states,
    isLocked, blockedForMe, setEndLock, excessOf, get cards(){ return cards; } };
})();
