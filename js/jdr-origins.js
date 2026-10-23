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
     abilities    [{ name, speed, cost, text, uses }] : capacités du peuple
                  speed = 'Passif' | 'Action' | 'Action libre' | 'Réaction' | 'Mouvement'
                  cost  = coût (ex. « Défausse 1 »), uses = limite (ex. « 3 fois par jour »)

   Classe (étape 4) :
     color        couleur de la classe (contour des cartes de cette classe)
     stats, armor caractéristiques de la classe (comme le peuple)
     magic        accès à la magie : 'aucune' | 'certaines' (seulement certaines spécialisations) | 'toutes'
     mechanics    [{ name, text }] : mécaniques principales de la classe (ex. « Les auras »)
     progression  15 lignes (niveaux 1 à 15) : { deck, text } = taille du deck + ce qui est gagné à ce niveau

   Spécialisation (étape 4) :
     classe       identifiant de la classe (origine de type « classe »)
     magic        vrai si cette spécialisation peut lancer des sorts
     abilities    passif de base (même format que les capacités de peuple)
     improvements [{ level, text }] : améliorations de spécialisation (ex. niveaux 5, 10, 15)

   Passés : étape 5.
*/

const JDR_ORIGIN_KINDS = {
  peuple:         { label: 'Peuple',         plural: 'Peuples',         color: '#3A7D8C', ready: true },
  classe:         { label: 'Classe',         plural: 'Classes',         color: '#8A5A2B', ready: true },
  specialisation: { label: 'Spécialisation', plural: 'Spécialisations', color: '#6B4C9A', ready: true },
  passe:          { label: 'Passé',          plural: 'Passés',          color: '#5E6B78', ready: false }
};
const JDR_ABILITY_SPEEDS = ['Passif', 'Action', 'Action libre', 'Réaction', 'Mouvement'];
const JDR_CHAR_SIZES = { P: 'Petite', M: 'Moyenne', G: 'Grande' };
const JDR_CLASS_MAGIC = { aucune: 'Aucune spécialisation ne lance de sorts', certaines: 'Seulement certaines spécialisations', toutes: 'Toutes les spécialisations' };
const JDR_MAX_LEVEL = 15;

function jdrBlankOriginAbility(){ return { name: '', speed: 'Passif', cost: '', text: '', uses: '' }; }
function jdrBlankStats(){ return Object.fromEntries(JDR_STATS.map(s => [s.key, 0])); }
// Taille du deck par défaut : règle actuelle du jeu (JDR_DECK_MAX_BY_LEVEL), modifiable par classe
function jdrBlankProgression(){
  return Array.from({ length: JDR_MAX_LEVEL }, (_, i) => ({ deck: (typeof JDR_DECK_MAX_BY_LEVEL !== 'undefined' && JDR_DECK_MAX_BY_LEVEL[i + 1]) || 25, text: '' }));
}
function jdrBlankOrigin(kind){
  kind = JDR_ORIGIN_KINDS[kind] ? kind : 'peuple';
  const base = { id: '', name: '', kind, description: '', image_url: '', image: { fit: 'cover', x: 50, y: 50 } };
  if(kind === 'peuple') return Object.assign(base, { family: '', size: 'M', stats: jdrBlankStats(), armor: 0, abilities: [jdrBlankOriginAbility()] });
  if(kind === 'classe') return Object.assign(base, { color: '#8A5A2B', stats: jdrBlankStats(), armor: 0, magic: 'aucune', mechanics: [{ name: '', text: '' }], progression: jdrBlankProgression() });
  if(kind === 'specialisation') return Object.assign(base, { classe: '', magic: false, abilities: [jdrBlankOriginAbility()], improvements: [] });
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
  if(o.kind === 'peuple' || o.kind === 'classe'){
    o.stats = Object.assign(jdrBlankStats(), o.stats || {});
    Object.keys(o.stats).forEach(k => o.stats[k] = num(o.stats[k]));
    o.armor = num(o.armor);
  }
  if(o.kind === 'peuple' || o.kind === 'specialisation')
    o.abilities = arr(o.abilities).map(a => Object.assign(jdrBlankOriginAbility(), a || {}));
  if(o.kind === 'peuple' && !JDR_CHAR_SIZES[o.size]) o.size = 'M';
  if(o.kind === 'classe'){
    if(!JDR_CLASS_MAGIC[o.magic]) o.magic = 'aucune';
    if(!/^#[0-9a-fA-F]{6}$/.test(o.color || '')) o.color = '#8A5A2B';
    o.mechanics = arr(o.mechanics).map(m => ({ name: String((m && m.name) || ''), text: String((m && m.text) || '') }));
    const def = jdrBlankProgression();
    o.progression = def.map((r, i) => { const x = arr(o.progression)[i] || {}; return { deck: x.deck === undefined ? r.deck : num(x.deck), text: String(x.text || '') }; });
  }
  if(o.kind === 'specialisation'){
    o.classe = String(o.classe || ''); o.magic = !!o.magic;
    o.improvements = arr(o.improvements).map(m => ({ level: Math.max(1, Math.min(JDR_MAX_LEVEL, num(m && m.level) || 1)), text: String((m && m.text) || '') }))
      .sort((a, b) => a.level - b.level);
  }
  return o;
}
function jdrOriginData(o){ const d = structuredClone(o); delete d.id; delete d.name; delete d.updated_at; return d; }
// byId : toutes les origines (pour afficher le nom de la classe d'une spécialisation)
function jdrOriginSummary(o, byId){
  if(o.kind === 'peuple') return [o.family, 'Taille ' + (JDR_CHAR_SIZES[o.size] || '').toLowerCase()].filter(Boolean).join(' · ');
  if(o.kind === 'classe') return o.magic === 'aucune' ? 'Sans magie' : o.magic === 'toutes' ? 'Magie : toutes les spécialisations' : 'Magie : certaines spécialisations';
  if(o.kind === 'specialisation'){ const c = byId && byId[o.classe]; return [c ? c.name : (o.classe ? o.classe : 'Classe non choisie'), o.magic ? 'lance des sorts' : ''].filter(Boolean).join(' · '); }
  return '';
}

// Fiche d'origine (aperçu de l'éditeur, plus tard : choix sur la fiche de personnage)
// opts : { width, byId }
function jdrOriginHTML(o, opts = {}){
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const k = JDR_ORIGIN_KINDS[o.kind] || JDR_ORIGIN_KINDS.peuple;
  const color = o.kind === 'classe' ? o.color : k.color;
  const sign = v => (v > 0 ? '+' : '') + v;
  const statsHTML = () => `<div class="ost">${JDR_STATS.map(s => `<div class="${o.stats[s.key] ? '' : 'z'}"><b>${esc(sign(o.stats[s.key]))}</b><span>${esc(s.label)}</span></div>`).join('')}<div class="${o.armor ? '' : 'z'}"><b>${esc(sign(o.armor))}</b><span>Armure</span></div></div>`;
  const abilHTML = (list, empty) => (list || []).filter(a => a.name || a.text).map(a => `<div class="oa">
      <div class="oah"><b>${esc(a.name || 'Capacité')}</b>${a.speed && a.speed !== 'Passif' ? `<span class="ic">${esc(a.speed)}</span>` : '<span class="osp">Passif</span>'}${a.cost ? `<span class="ic">${esc(a.cost)}</span>` : ''}${a.uses ? `<span class="osp">${esc(a.uses)}</span>` : ''}</div>
      ${a.text ? `<p>${esc(a.text)}</p>` : ''}</div>`).join('') || `<p class="ie">${empty}</p>`;
  let body = '';
  if(o.kind === 'peuple'){
    body = `<div class="im">${esc([o.family, 'Taille ' + (JDR_CHAR_SIZES[o.size] || '').toLowerCase()].filter(Boolean).join(' · '))}</div>
      ${statsHTML()}${abilHTML(o.abilities, 'Aucune capacité renseignée.')}`;
  } else if(o.kind === 'classe'){
    const mech = o.mechanics.filter(m => m.name || m.text).map(m => `<div class="oa"><div class="oah"><b>${esc(m.name || 'Mécanique')}</b></div>${m.text ? `<p>${esc(m.text)}</p>` : ''}</div>`).join('');
    const rows = o.progression.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.deck)}</td><td>${esc(r.text) || '<span class="osp">—</span>'}</td></tr>`).join('');
    body = `<div class="im">Magie : ${esc(JDR_CLASS_MAGIC[o.magic].toLowerCase())}</div>
      ${statsHTML()}
      ${mech ? `<div class="osec">Mécaniques principales</div>${mech}` : ''}
      <div class="osec">Évolution du personnage</div>
      <table class="oprog"><thead><tr><th>Niv.</th><th>Deck</th><th>Gain</th></tr></thead><tbody>${rows}</tbody></table>`;
  } else if(o.kind === 'specialisation'){
    const c = opts.byId && opts.byId[o.classe];
    const imp = o.improvements.filter(m => m.text).map(m => `<div class="oa"><div class="oah"><b>Niveau ${esc(m.level)}</b></div><p>${esc(m.text)}</p></div>`).join('');
    body = `<div class="im">${c ? 'Classe : ' + esc(c.name) : 'Classe non choisie'} · ${o.magic ? 'peut lancer des sorts' : 'ne lance pas de sorts'}</div>
      <div class="osec">Passif de base</div>${abilHTML(o.abilities, 'Aucun passif renseigné.')}
      ${imp ? `<div class="osec">Améliorations de spécialisation</div>${imp}` : ''}`;
  }
  return `<div class="jitem jorig" style="--ik:${esc(color)}${opts.width ? ';width:' + opts.width : ''}">
    <div class="ih"><span class="ik">${esc(k.label)}</span><div class="in">${esc(o.name || 'Sans nom')}</div></div>
    ${o.image_url ? `<div class="iimg"><img src="${esc(o.image_url)}" alt="" loading="lazy" style="object-fit:${o.image.fit};object-position:${o.image.x}% ${o.image.y}%"></div>` : ''}
    <div class="ib">${body}${o.description ? `<p class="id">${esc(o.description)}</p>` : ''}</div>
  </div>`;
}
