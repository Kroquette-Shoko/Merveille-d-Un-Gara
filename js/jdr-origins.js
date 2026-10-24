/* Merveille d'Un'Gara — origines du personnage : peuples, classes, spécialisations, passés.
   Table jdr.origins (sql/jdr-007). Une ligne = { id, name, data } ; data.kind = type.

   Tous les types :
     description  histoire, apparence, rôle…
     image_url    adresse web de l'image ('' = aucune)
     image        { fit: 'cover' | 'contain', x, y } : cadrage (même principe que l'équipement)

   Peuple (étape 3) :
     family       famille de peuples, facultatif (ex. « Elfes » pour Haut-elfe, Elfe sylvain…)
     size         taille du personnage : 'P' | 'M' | 'G' (sert à la charge sur la fiche)
     stats        { opp, ant, corps, esprit, charme, res, pa } : bonus ou malus (nombres)
     armor        bonus d'armure (nombre)
     wounds       nombre de cases de points de vie apportées (nombre) — aussi pour la classe et le passé :
                  le personnage a peuple + classe + passé cases de points de vie (les blessures en retirent)
     abilities    [{ name, pa, cost, text, uses }] : capacités (aussi pour la classe, la spécialisation et le passé)
                  pa    = coût en points d'action (nombre) ; vide = capacité passive (aucun point d'action)
                  cost  = autre coût, facultatif (ex. « Défausse 1 »), uses = limite (ex. « 3 fois par jour »)

   Classe (étape 4) :
     color        couleur de la classe (contour des cartes de cette classe)
     stats, armor caractéristiques de la classe (comme le peuple)
     magic        accès à la magie : 'aucune' | 'certaines' (seulement certaines spécialisations) | 'toutes'
     specs        [identifiants] : spécialisations de la classe (choisies dans la fiche de la classe)
     mechanics    ancien champ (mécaniques principales), gardé en base mais plus affiché
     progression  15 lignes (niveaux 1 à 15) : { deck, text } = taille du deck + ce qui est gagné à ce niveau

   Spécialisation (étape 4) :
     classe       ancien champ : la classe se choisit maintenant depuis la classe (specs) ;
                  utilisé seulement si aucune classe ne liste cette spécialisation
     voies        [identifiants] : cartes « Voie » de la spécialisation (cartes Passif, sous-type Voie), plusieurs possibles
                  (ancien champ « voie » = une seule carte, converti automatiquement)
     magic        vrai si cette spécialisation peut lancer des sorts
     (pas de capacités ni de passif : le passif d'une spécialisation, c'est le travail de ses VOIES)
     improvements [{ level, text }] : améliorations de spécialisation (ex. niveaux 5, 10, 15)

   Passé (étape 5) :
     stats, armor caractéristiques du passé (comme le peuple)
     events       [texte] : événements possibles, pistes pour l'histoire du personnage (le livret en propose six)
     card         identifiant de la carte de passé (jdr.cards), '' = aucune
*/

const JDR_ORIGIN_KINDS = {
  peuple:         { label: 'Peuple',         plural: 'Peuples',         color: '#3A7D8C', ready: true },
  classe:         { label: 'Classe',         plural: 'Classes',         color: '#8A5A2B', ready: true },
  specialisation: { label: 'Spécialisation', plural: 'Spécialisations', color: '#6B4C9A', ready: true },
  passe:          { label: 'Passé',          plural: 'Passés',          color: '#5E6B78', ready: true }
};
const JDR_CHAR_SIZES = { P: 'Petite', M: 'Moyenne', G: 'Grande' };
const JDR_CLASS_MAGIC = { aucune: 'Aucune spécialisation ne lance de sorts', certaines: 'Seulement certaines spécialisations', toutes: 'Toutes les spécialisations' };
const JDR_MAX_LEVEL = 15;

function jdrBlankOriginAbility(){ return { name: '', pa: null, cost: '', text: '', uses: '' }; }
// Coût en PA d'une capacité : nombre ≥ 0, ou null (capacité passive)
function jdrAbilityPA(a){ const v = a && a.pa; return (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Math.max(0, Number(v)); }
function jdrBlankStats(){ return Object.fromEntries(JDR_STATS.map(s => [s.key, 0])); }
// Taille du deck par défaut : règle actuelle du jeu (JDR_DECK_MAX_BY_LEVEL), modifiable par classe
function jdrBlankProgression(){
  return Array.from({ length: JDR_MAX_LEVEL }, (_, i) => ({ deck: (typeof JDR_DECK_MAX_BY_LEVEL !== 'undefined' && JDR_DECK_MAX_BY_LEVEL[i + 1]) || 25, text: '' }));
}
function jdrBlankOrigin(kind){
  kind = JDR_ORIGIN_KINDS[kind] ? kind : 'peuple';
  const base = { id: '', name: '', kind, description: '', image_url: '', image: { fit: 'cover', x: 50, y: 50 } };
  if(kind === 'peuple') return Object.assign(base, { family: '', size: 'M', stats: jdrBlankStats(), armor: 0, wounds: 0, abilities: [jdrBlankOriginAbility()] });
  if(kind === 'classe') return Object.assign(base, { color: '#8A5A2B', stats: jdrBlankStats(), armor: 0, wounds: 0, abilities: [], magic: 'aucune', specs: [], mechanics: [], progression: jdrBlankProgression() });
  if(kind === 'specialisation') return Object.assign(base, { classe: '', voies: [], magic: false, abilities: [], improvements: [] });
  if(kind === 'passe') return Object.assign(base, { stats: jdrBlankStats(), armor: 0, wounds: 0, abilities: [], events: ['', '', '', '', '', ''], card: '' });
  return base;
}
function jdrNormalizeOrigin(row){
  const d = (row && row.data) || {};
  const o = Object.assign(jdrBlankOrigin(d.kind), d);
  o.id = (row && row.id) || ''; o.name = (row && row.name) || '';
  const num = v => (v === '' || v === null || v === undefined || !isFinite(Number(v))) ? 0 : Number(v);
  const arr = v => Array.isArray(v) ? v : [];
  o.image_url = String(o.image_url || '').trim();
  o.image = Object.assign({ fit: 'cover', x: 50, y: 50 }, o.image || {});
  if(!['cover','contain'].includes(o.image.fit)) o.image.fit = 'cover';
  ['x','y'].forEach(k => { o.image[k] = Math.max(0, Math.min(100, isFinite(Number(o.image[k])) ? Number(o.image[k]) : 50)); });
  if(o.kind === 'peuple' || o.kind === 'classe' || o.kind === 'passe'){
    o.stats = Object.assign(jdrBlankStats(), o.stats || {});
    Object.keys(o.stats).forEach(k => o.stats[k] = num(o.stats[k]));
    o.armor = num(o.armor);
    o.wounds = Math.max(0, num(o.wounds));
  }
  // Capacités (tous les types) ; l'ancien champ « speed » (vitesse) n'existe plus
  o.abilities = arr(o.abilities).map(a => { const x = Object.assign(jdrBlankOriginAbility(), a || {}); x.pa = jdrAbilityPA(x); delete x.speed; return x; });
  // Spécialisation : pas de passif (24/10/2026) — ce sont les voies qui le donnent
  if(o.kind === 'specialisation') o.abilities = [];
  if(o.kind === 'peuple' && !JDR_CHAR_SIZES[o.size]) o.size = 'M';
  if(o.kind === 'classe'){
    if(!JDR_CLASS_MAGIC[o.magic]) o.magic = 'aucune';
    o.color = /^#[0-9a-fA-F]{6}$/.test(o.color || '') ? o.color.toLowerCase() : '#8a5a2b';
    o.mechanics = arr(o.mechanics).map(m => ({ name: String((m && m.name) || ''), text: String((m && m.text) || '') }));
    o.specs = [...new Set(arr(o.specs).map(String).filter(Boolean))];
    const def = jdrBlankProgression();
    o.progression = def.map((r, i) => { const x = arr(o.progression)[i] || {}; return { deck: x.deck === undefined ? r.deck : num(x.deck), text: String(x.text || '') }; });
  }
  if(o.kind === 'passe'){ o.events = arr(o.events).map(e => String(e || '')); o.card = String(o.card || ''); }
  if(o.kind === 'specialisation'){
    o.classe = String(o.classe || ''); o.voies = [...new Set([...arr(o.voies), ...(o.voie ? [o.voie] : [])].map(String).filter(Boolean))]; delete o.voie; o.magic = !!o.magic;
    o.improvements = arr(o.improvements).map(m => ({ level: Math.max(1, Math.min(JDR_MAX_LEVEL, num(m && m.level) || 1)), text: String((m && m.text) || '') }))
      .sort((a, b) => a.level - b.level);
  }
  return o;
}
function jdrOriginData(o){ const d = structuredClone(o); delete d.id; delete d.name; delete d.updated_at; return d; }
// Classe d'une spécialisation : la classe qui la liste dans « specs » (sinon l'ancien champ « classe »)
function jdrSpecClass(spec, byId){
  const all = Object.values(byId || {});
  return all.find(c => c.kind === 'classe' && (c.specs || []).includes(spec.id)) || (byId && byId[spec.classe]) || null;
}
// Spécialisations d'une classe (liste « specs », plus les anciennes spécialisations qui pointent vers elle)
function jdrClassSpecs(classe, byId){
  const all = Object.values(byId || {});
  return all.filter(o => o.kind === 'specialisation' && ((classe.specs || []).includes(o.id) || (o.classe === classe.id && !all.some(c => c.kind === 'classe' && c.id !== classe.id && (c.specs || []).includes(o.id)))));
}
// byId : toutes les origines (pour afficher le nom de la classe d'une spécialisation)
function jdrOriginSummary(o, byId){
  if(o.kind === 'peuple') return [o.family, 'Taille ' + (JDR_CHAR_SIZES[o.size] || '').toLowerCase()].filter(Boolean).join(' · ');
  if(o.kind === 'classe') return o.magic === 'aucune' ? 'Sans magie' : o.magic === 'toutes' ? 'Magie : toutes les spécialisations' : 'Magie : certaines spécialisations';
  if(o.kind === 'passe'){ const n = o.events.filter(Boolean).length; return `${n} événement${n > 1 ? 's' : ''}${o.card ? ' · carte de passé' : ''}`; }
  if(o.kind === 'specialisation'){ const c = jdrSpecClass(o, byId); return [c ? c.name : 'Sans classe', o.magic ? 'lance des sorts' : '', o.voies.length ? `${o.voies.length} voie${o.voies.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · '); }
  return '';
}

// Fiche d'origine (aperçu de l'éditeur, plus tard : choix sur la fiche de personnage)
// opts : { width, byId, cards } — cards = cartes par identifiant (carte de passé, carte de voie)
function jdrOriginHTML(o, opts = {}){
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const k = JDR_ORIGIN_KINDS[o.kind] || JDR_ORIGIN_KINDS.peuple;
  const color = o.kind === 'classe' ? o.color : k.color;
  const sign = v => (v > 0 ? '+' : '') + v;
  const statsHTML = () => `<div class="ost">${JDR_STATS.map(s => `<div class="${o.stats[s.key] ? '' : 'z'}"><b>${esc(sign(o.stats[s.key]))}</b><span>${esc(s.label)}</span></div>`).join('')}<div class="${o.armor ? '' : 'z'}"><b>${esc(sign(o.armor))}</b><span>Armure</span></div><div class="${o.wounds ? '' : 'z'}"><b>${esc(sign(o.wounds || 0))}</b><span>Points de vie</span></div></div>`;
  const abilHTML = (list, empty) => (list || []).filter(a => a.name || a.text).map(a => `<div class="oa">
      <div class="oah"><b>${esc(a.name || 'Capacité')}</b>${jdrAbilityPA(a) !== null ? `<span class="ic">${esc(jdrAbilityPA(a))} PA</span>` : '<span class="osp">Passif</span>'}${a.cost ? `<span class="ic">${esc(a.cost)}</span>` : ''}${a.uses ? `<span class="osp">${esc(a.uses)}</span>` : ''}</div>
      ${a.text ? `<div class="p">${jdrRichText(a.text)}</div>` : ''}</div>`).join('') || `<p class="ie">${empty}</p>`;
  let body = '';
  if(o.kind === 'peuple'){
    body = `<div class="im">${esc([o.family, 'Taille ' + (JDR_CHAR_SIZES[o.size] || '').toLowerCase()].filter(Boolean).join(' · '))}</div>
      ${statsHTML()}${abilHTML(o.abilities, 'Aucune capacité renseignée.')}`;
  } else if(o.kind === 'classe'){
    const specs = jdrClassSpecs(o, opts.byId).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const rows = o.progression.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.deck)}</td><td>${esc(r.text) || '<span class="osp">—</span>'}</td></tr>`).join('');
    body = `<div class="im">Magie : ${esc(JDR_CLASS_MAGIC[o.magic].toLowerCase())}</div>
      ${statsHTML()}
      <div class="osec">Spécialisations</div>
      ${specs.length ? `<div class="ips">${specs.map(sp => `<span class="ip">${esc(sp.name)}</span>`).join('')}</div>` : '<p class="ie">Aucune spécialisation choisie.</p>'}
      ${o.abilities.some(a => a.name || a.text) ? `<div class="osec">Capacités de classe</div>${abilHTML(o.abilities, '')}` : ''}
      <div class="osec">Évolution du personnage</div>
      <table class="oprog"><thead><tr><th>Niv.</th><th>Deck</th><th>Gain</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else if(o.kind === 'specialisation'){
    const c = jdrSpecClass(o, opts.byId);
    const voies = o.voies.map(id => (opts.cards && opts.cards[id]) || { id, name: id, missing: true });
    // opts.hideVoies : ne pas lister les voies (l'assistant de création affiche déjà la voie choisie)
    const voiesHTML = opts.hideVoies ? '' : `<div class="osec">${voies.length > 1 ? 'Voies' : 'Voie'}</div>
      ${voies.length ? `<div class="ovoie">${voies.map(v => !v.missing && typeof jdrCardHTML === 'function'
          ? jdrCardHTML(v, { width: voies.length > 1 ? '170px' : '210px' })
          : `<div class="oa"><div class="oah"><b>${esc(v.name)}</b></div></div>`).join('')}</div>` : '<p class="ie">Aucune voie désignée.</p>'}`;
    const imp = o.improvements.filter(m => m.text).map(m => `<div class="oa"><div class="oah"><b>Niveau ${esc(m.level)}</b></div><p>${esc(m.text)}</p></div>`).join('');
    body = `<div class="im">${c ? 'Classe : ' + esc(c.name) : 'Classe non choisie'} · ${o.magic ? 'peut utiliser la magie (Sortilège)' : 'pas de magie (Sortilège)'}</div>
${voiesHTML}
      ${imp ? `<div class="osec">Améliorations de spécialisation</div>${imp}` : ''}`;
  }
  if(o.kind === 'passe'){
    const ev = o.events.filter(Boolean);
    const card = o.card ? ((opts.cards && opts.cards[o.card]) || { name: o.card }) : null;
    body = `${statsHTML()}
      ${o.abilities.some(a => a.name || a.text) ? `<div class="osec">Capacités du passé</div>${abilHTML(o.abilities, '')}` : ''}
      <div class="osec">Carte de passé</div>
      ${card ? `<div class="oa"><div class="oah"><b>${esc(card.name)}</b></div><p>Jouable seulement par les personnages qui ont ce passé.</p></div>` : '<p class="ie">Aucune carte de passé choisie.</p>'}
      <div class="osec">Événements possibles</div>
      ${ev.length ? `<ul class="oev">${ev.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="ie">Aucun événement renseigné.</p>'}`;
  }
  return `<div class="jitem jorig" style="--ik:${esc(color)}${opts.width ? ';width:' + opts.width : ''}">
    <div class="ih"><span class="ik">${esc(k.label)}</span><div class="in">${esc(o.name || 'Sans nom')}</div></div>
    ${o.image_url ? `<div class="iimg"><img src="${esc(o.image_url)}" alt="" loading="lazy" style="object-fit:${o.image.fit};object-position:${o.image.x}% ${o.image.y}%"></div>` : ''}
    <div class="ib">${body}${o.description ? `<p class="id">${esc(o.description)}</p>` : ''}</div>
  </div>`;
}
