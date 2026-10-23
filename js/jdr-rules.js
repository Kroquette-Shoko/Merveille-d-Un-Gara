/* ============================================================
   MERVEILLE D'UN'GARA — RÈGLES PARTAGÉES
   ============================================================
   Utilisé par : la fiche, l'éditeur de cartes, la bibliothèque, le deck.
   Ce fichier ne contacte pas le serveur : il ne contient que des règles.

   1. Données de référence (classes, spécialisations, caractéristiques…)
   2. Modèle d'une carte (format stocké dans jdr.cards.data)
   3. Déclencheurs et effets (même principe que Rimd'Orël : une capacité =
      des déclencheurs + des effets)
   4. Cartes → caractéristiques : modificateurs apportés par le deck
   5. Caractéristiques → cartes : formules ("2+corps") et prérequis
   6. Règles de construction du deck
   ============================================================ */

/* ---------- 1. Données de référence ---------- */

// Caractéristiques de la fiche (clés utilisées dans sheet.stats)
const JDR_STATS = [
  { key: 'opp',    label: 'Opportunisme' },
  { key: 'ant',    label: 'Anticipation' },
  { key: 'corps',  label: 'Corps' },
  { key: 'esprit', label: 'Esprit' },
  { key: 'charme', label: 'Charme' },
  { key: 'res',    label: 'Résistance' },
  { key: 'pa',     label: "Point d'action" }
];
const JDR_STAT_LABEL = Object.fromEntries(JDR_STATS.map(s => [s.key, s.label]));

const JDR_CLASSES = {
  'Acolyte':    ['Gardien', 'Druide', 'Prêtre'],
  'Combattant': ['Berserker', 'Guerrier', 'Moine'],
  'Éclaireur':  ['Barde', 'Chasseur', 'Voleur'],
  'Érudit':     ['Arcaniste', 'Mage', 'Sorcier']
};
const JDR_PASSES = ['Artiste','Brute','Voyageur','Roublard','Religieux','Cultiste','Artisan','Étudiant','Explorateur','Héros','Noble','Orphelin','Soldat','Pirate'];
const JDR_PEUPLES = ['Haut-elfe','Elfe sylvain','Elfe solaire','Elfe de Zaraë','Humain','Nain',"Nain d'Erd'Uof",'Halfelin','Gnome','Orc','Tieffelin','Céleste','Drakeïde','Sirène'];

// Manuel V1 : seuls ceux-ci peuvent lancer des sorts
const JDR_SPELL_CLASSES = ['Érudit'];
const JDR_SPELL_SPECS = ['Prêtre', 'Druide', 'Barde'];

// Listes validées le 23/10/2026
const JDR_CARD_TYPES = ['Manœuvre', 'Capacité', 'Sortilège', 'Risque', 'Passif', 'Exploit', 'Créature', 'Pacte', 'Grimoire'];
// Sous-type : 1 seul. Offensif / Défensif / Utilitaire pour tous les types ; les autres sont réservés à un type.
const JDR_SUBTYPES_COMMON = ['Offensif', 'Défensif', 'Utilitaire'];
const JDR_SUBTYPES_BY_TYPE = {
  'Passif':   ['Voie', 'Bénédiction', 'Passé'],
  'Risque':   ['Malus', 'Bonus'],
  'Créature': ['Familier', 'Monstre', 'Boss']
};
const JDR_SUBTYPES = [...JDR_SUBTYPES_COMMON, ...Object.values(JDR_SUBTYPES_BY_TYPE).flat()];
function jdrSubtypesFor(type){ return [...JDR_SUBTYPES_COMMON, ...(JDR_SUBTYPES_BY_TYPE[type] || [])]; }
// Super-types : plusieurs possibles
const JDR_SUPERTYPES = ['Posture','Malédiction','Aura','Rage','Chanson','Frappe','Piège','Piste','Poison','Arcane','Feu','Air','Eau','Terre','Éclosion','Enchantement','Illusion','Transmutation','Réaction','Évocation','Divination','Invocation'];
const JDR_DAMAGE_TYPES = ['contondant','perforant','tranchant','feu','froid','foudre','acide','poison','nécrotique','sacré','arcanique','psychique'];
const JDR_PHYSICAL_DAMAGE = ['contondant','perforant','tranchant'];
const JDR_RANGES = ['Soi','Contact','Allonge','Proche','Moyenne portée','Grande portée','Très grande portée'];

// Taille maximale du deck selon le niveau (manuel V1, identique pour les 4 classes)
const JDR_DECK_MAX_BY_LEVEL = [0, 25,25,30,30,30,35,35,35,40,40,40,45,45,45,50];
const JDR_DECK_MIN = 25;

// Couleur de contour des cartes (modèle validé le 23/10/2026). ink = couleur du texte posé dessus.
const JDR_CARD_COLORS = {
  'Acolyte':    { color: '#C9A227', ink: '#1D1A16' },
  'Combattant': { color: '#B23A2E', ink: '#FFFFFF' },
  'Éclaireur':  { color: '#2E7D4F', ink: '#FFFFFF' },
  'Érudit':     { color: '#3A5BB8', ink: '#FFFFFF' },
  'Neutre':     { color: '#6B7280', ink: '#FFFFFF' },
  'Risque':     { color: '#3B2F4A', ink: '#FFFFFF' }
};
// Coloris d'une carte : Risque → violet ; une seule classe → sa couleur ; sinon (aucune ou plusieurs) → neutre
function jdrCardColorKey(card){
  if(card.type === 'Risque') return 'Risque';
  const classes = card.classes || [];
  return classes.length === 1 && JDR_CARD_COLORS[classes[0]] ? classes[0] : 'Neutre';
}

// « Réservée à » (options de deck) : la carte n'est jouable que par les personnages
// qui ont l'une de ces spécialisations / passés / peuples (ex. carte du passé de brute).
const JDR_RESTRICT_GROUPS = {
  'Spécialisations': Object.values(JDR_CLASSES).flat(),
  'Passés': JDR_PASSES,
  'Peuples': JDR_PEUPLES
};

/* ---------- Outils texte ---------- */

// Compare des noms sans tenir compte des majuscules ni des accents ("Eclaireur" = "Éclaireur")
function jdrNorm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
function jdrSplitList(s){ return String(s || '').split(/[\/,;]+/).map(x => x.trim()).filter(Boolean); }

/* ---------- 2. Modèle d'une carte ---------- */
/*
  {
    id: "trait_de_flamme",           // identifiant unique (minuscules, chiffres, _ -)
    -- Identité (colonne et bandeau de couleur) --
    name: "Trait de flamme",
    type: "Sortilège",               // 1 parmi JDR_CARD_TYPES
    subtype: "Offensif",             // 1 parmi jdrSubtypesFor(type) (ou vide)
    supertypes: ["Feu", "Évocation"],// plusieurs parmi JDR_SUPERTYPES
    restrict: ["Mage"],              // réservée à ces spécialisations / passés / peuples (vide = pas de restriction)
    classes: ["Érudit"],             // qui peut jouer la carte (vide = toutes) ; donne la couleur
    value: 3,                        // valeur (tests, résistance)
    mana: 2,                         // coût en mana de la carte (vide = aucun)
    components: { sonore:true, gestuelle:false, materielle:false },
    -- Illustration (même principe que Rimd'Orël : cadrage libre) --
    image_url: "https://…",
    art: { ox:0, oy:0, scale:100, rot:0, fx:false, fy:false },  // déplacement en % du cadre, zoom %, rotation °, miroirs
    -- Capacités --
    abilities: [ { pa:1, cost:"Défaussez 1", triggers:[{ trigger:"activated" }], effects:[ {...} ] } ],
    special: { enabled:false, name:"", mana:null, cost:"", triggers:[{ trigger:"freeAction" }], effects:[] },
    -- Options de deck --
    persistent:false, horsDeck:false, requirements:[{ stat:"corps", min:2 }], maxCopies:null,
    footer: "",                      // mention en bas de carte
    text: ""                         // ancien texte libre (conservé à l'affichage)
  }
*/
function jdrBlankArt(){ return { ox: 0, oy: 0, scale: 100, rot: 0, fx: false, fy: false }; }
function jdrBlankAbility(){ return { pa: null, cost: '', triggers: [{ trigger: 'activated' }], effects: [] }; }
function jdrBlankSpecial(){ return { enabled: false, name: '', mana: null, cost: '', triggers: [{ trigger: 'freeAction' }], effects: [] }; }
/* ---------- Créatures (type « Créature ») ----------
   Fiche paysage validée le 23/10/2026. Stockée dans card.creature ; le tableau d'action
   de groupe est préparé à part (table jdr.creature_groups) et attribué par son id. */
const JDR_DICE = ['D4', 'D6', 'D8', 'D10', 'D12', 'D20'];
const JDR_CREATURE_MAX_HEARTS = 3;          // 3 cœurs = 18 blessures légères
function jdrBlankCreature(){
  return {
    category: 'Bête', family: '',           // « Créature · Bête — Araignée »
    level: 0, groupDie: 'D4', group: '',    // group = id du tableau d'action de groupe
    hearts: 3, armor: 0, armorMagic: 0, res: 0, opres: 'D4',
    corps: 0, esprit: 0, charme: 0,
    movement: 'marche', speed: 'proche (9 m)',
    attacks: { primary: '', secondary: '', tertiary: '' },
    immuneAfflictions: '', immuneDamage: '', weakDamage: '',
    abilities: [ { name: '', text: '' } ]   // capacités de monstre
  };
}
function jdrNormalizeCreature(cr){
  const b = jdrBlankCreature();
  const o = Object.assign(b, cr || {});
  o.attacks = Object.assign(jdrBlankCreature().attacks, (cr && cr.attacks) || {});
  if(!Array.isArray(o.abilities)) o.abilities = [];
  o.hearts = Math.max(1, Math.min(JDR_CREATURE_MAX_HEARTS, Number(o.hearts) || 1));
  return o;
}
function jdrBlankGroup(){ return { id: '', name: '', rows: Array.from({ length: 6 }, () => ({ effect: '', bonus: '' })) }; }
function jdrNormalizeGroup(g){
  const o = Object.assign(jdrBlankGroup(), g || {});
  const rows = Array.isArray(o.rows) ? o.rows : [];
  o.rows = Array.from({ length: 6 }, (_, i) => Object.assign({ effect: '', bonus: '' }, rows[i] || {}));
  return o;
}
function jdrDieSize(d){ return Number(String(d || '').replace(/[^0-9]/g, '')) || 6; }

function jdrBlankCard(){
  return {
    id: '', name: '', type: 'Manœuvre', subtype: '', supertypes: [], classes: [], restrict: [],
    value: 1, mana: null, components: { sonore: false, gestuelle: false, materielle: false },
    image_url: '', art: jdrBlankArt(),
    abilities: [], special: jdrBlankSpecial(),
    persistent: false, horsDeck: false, requirements: [], maxCopies: null, footer: '', text: ''
  };
}
// Complète une carte incomplète et convertit l'ancien format (sous-types multiples, access, origin, pa de carte)
function jdrNormalizeCard(c){
  c = c || {};
  const o = Object.assign(jdrBlankCard(), c);
  o.components = Object.assign(jdrBlankCard().components, c.components || {});
  o.art = Object.assign(jdrBlankArt(), c.art || {});
  const old = c.access || {};
  if(!Array.isArray(c.classes)) o.classes = Array.isArray(old.classes) ? old.classes.slice() : [];
  if(typeof c.subtype !== 'string') o.subtype = Array.isArray(c.subtypes) && c.subtypes.length ? c.subtypes[0] : '';
  if(!Array.isArray(c.supertypes)){
    o.supertypes = [...(old.specs || []), ...(old.passes || []), ...(old.peuples || [])];
    if(!o.supertypes.length && c.origin) o.supertypes = [c.origin];
  }
  // listes du 23/10/2026 : « Sort » → « Sortilège » ; anciens sous-types devenus super-types ;
  // spécialisations / passés / peuples rangés dans « Réservée à »
  if(o.type === 'Sort') o.type = 'Sortilège';
  if(!Array.isArray(o.restrict)) o.restrict = [];
  if(!Array.isArray(o.supertypes)) o.supertypes = [];
  const restrictAll = Object.values(JDR_RESTRICT_GROUPS).flat().map(jdrNorm);
  o.restrict = [...new Set([...o.restrict, ...o.supertypes.filter(x => restrictAll.includes(jdrNorm(x)))])];
  o.supertypes = o.supertypes.filter(x => !restrictAll.includes(jdrNorm(x)));
  const stIndex = JDR_SUPERTYPES.map(jdrNorm);
  const oldSub = Array.isArray(c.subtypes) ? c.subtypes : (o.subtype ? [o.subtype] : []);
  oldSub.forEach(x => { const i = stIndex.indexOf(jdrNorm(x)); if(i >= 0 && !o.supertypes.includes(JDR_SUPERTYPES[i])) o.supertypes.push(JDR_SUPERTYPES[i]); });
  if(o.subtype && !jdrSubtypesFor(o.type).includes(o.subtype)) o.subtype = '';
  ['requirements','abilities'].forEach(k => { if(!Array.isArray(o[k])) o[k] = []; });
  o.abilities = o.abilities.map(ab => Object.assign(jdrBlankAbility(), ab, { effects: Array.isArray(ab.effects) ? ab.effects : [] }));
  o.special = Object.assign(jdrBlankSpecial(), (c.special && typeof c.special === 'object') ? c.special : {});
  // ancien format : capacité cochée « spéciale » → zone spéciale ; pa de la carte → 1re capacité
  const oldSpec = o.abilities.findIndex(ab => ab.special === true);
  if(oldSpec >= 0 && !(c.special && c.special.enabled)){
    const ab = o.abilities.splice(oldSpec, 1)[0];
    o.special = Object.assign(jdrBlankSpecial(), { enabled: true, name: c.specialName || '', cost: ab.cost || '', triggers: ab.triggers, effects: ab.effects });
  }
  if(c.pa !== undefined && c.pa !== null && c.pa !== '' && o.abilities[0] && (o.abilities[0].pa === null || o.abilities[0].pa === undefined)) o.abilities[0].pa = c.pa;
  o.abilities.forEach(ab => { delete ab.special; });
  ['subtypes','access','origin','pa','specialName'].forEach(k => delete o[k]);
  if(o.type === 'Créature') o.creature = jdrNormalizeCreature(c.creature);
  return o;
}

/* ---------- 3. Déclencheurs et effets ---------- */

const JDR_TRIGGERS = {
  onPlay:        'Quand vous jouez cette carte',
  activated:     'Action',
  freeAction:    'Action libre',
  reaction:      'Réaction',
  complex:       'Action complexe',
  onDraw:        'Lorsque cette carte est piochée',
  onDiscardTest: 'Lorsque cette carte est défaussée pour un test',
  onTestFail:    'Lorsque vous ratez un test',
  startOfTurn:   'Au début de votre tour',
  endOfTurn:     'À la fin de chaque tour',
  onTakeRisk:    'Lorsque vous prenez un risque',
  onAffliction:  'Lorsque vous donnez une affliction',
  onDamaged:     'Lorsque vous subissez des dégâts',
  onKill:        'Lorsque vous tuez un adversaire',
  startOfDay:    'Au début de chaque journée',
  onRest:        'Lors de votre prochain repos',
  whileInPlay:   'Tant que cette carte est en jeu',
  whileInDeck:   'Tant que cette carte est dans votre deck'
};
// Déclencheurs dont les effets modifient en permanence les caractéristiques (voir partie 4)
const JDR_PASSIVE_TRIGGERS = ['whileInDeck'];

const JDR_TARGETS = {
  self:        'vous',
  selfAllies:  'vous et les alliés à votre contact',
  ally:        'un allié',
  allies:      'vos alliés',
  enemy:       'une créature adverse',
  enemies:     'les créatures adverses',
  any:         'une créature'
};

const JDR_DURATIONS = {
  instant:  '',
  turn:     "jusqu'à la fin de ce tour",
  nextTurn: "jusqu'à la fin de votre prochain tour",
  combat:   "jusqu'à la fin du combat",
  scene:    "jusqu'à la fin de la scène",
  day:      "jusqu'à votre prochain repos",
  permanent:'de façon permanente'
};

// Chaque effet : un libellé pour l'éditeur, ses champs, et une phrase générée
const JDR_EFFECTS = {
  damage:      { label: 'Infliger des dégâts',        fields: ['amount','damageType','target','opposeRes'] },
  wound:       { label: 'Infliger des blessures',     fields: ['amount','target'] },
  heal:        { label: 'Soigner des blessures',      fields: ['amount','target'] },
  armor:       { label: "Donner de l'armure",         fields: ['amount','magic','target'] },
  modifyStat:  { label: 'Modifier une caractéristique', fields: ['stat','amount','target','duration'] },
  resource:    { label: 'Gagner / perdre une ressource', fields: ['resource','amount','target'] },
  draw:        { label: 'Piocher',                    fields: ['amount'] },
  explore:     { label: 'Explorer',                   fields: ['amount'] },
  discard:     { label: 'Défausser',                  fields: ['amount'] },
  takeRisk:    { label: 'Prendre des risques',        fields: ['amount','target'] },
  banishRisk:  { label: 'Bannir un risque',           fields: ['amount','target'] },
  affliction:  { label: 'Donner une affliction',      fields: ['affliction','target','opposeRes','duration'] },
  extraReaction:{ label: 'Réaction supplémentaire',   fields: ['amount','duration'] },
  move:        { label: 'Se déplacer',                fields: ['amount','target'] },
  posture:     { label: 'Adopter cette posture',      fields: [] },
  recover:     { label: 'Récupérer une carte',        fields: ['from'] },
  custom:      { label: 'Texte libre',                fields: ['text'] }
};
const JDR_FROM = { discard: 'de votre défausse', deck: 'de votre deck', banned: 'parmi vos cartes bannies', otherDiscard: "de la défausse d'un autre joueur" };

function jdrBlankEffect(type){
  return { type: type || 'damage', amount: '1', damageType: 'contondant', target: 'enemy', opposeRes: false,
           magic: false, stat: 'corps', duration: 'instant', resource: 'Mana', affliction: '', from: 'discard', text: '' };
}

// Phrase lisible d'un effet (sert au texte de la carte)
function jdrEffectText(e){
  const t = JDR_TARGETS[e.target] || '';
  const n = String(e.amount ?? '').trim() || '1';
  const d = JDR_DURATIONS[e.duration] ? ' ' + JDR_DURATIONS[e.duration] : '';
  const res = e.opposeRes ? "S'oppose à la résistance de la cible : en cas de réussite, " : '';
  const plural = (v, s, p) => (String(v) === '1' ? s : p);
  // conjugaison selon la cible : « vous prenez », « un allié prend », « vos alliés prennent »
  const vb = (sg, vous, pl) => (e.target === 'self' || e.target === 'selfAllies') ? vous : (e.target === 'allies' || e.target === 'enemies') ? pl : sg;
  switch(e.type){
    case 'damage': {
      // accord : « 1 dégât feu », « 3 dégâts contondants » ; « à une créature » / « aux créatures »
      // noms (« de feu ») ou adjectifs accordés (« contondants », « sacrés »)
      const NOUNS = ['feu','froid','foudre','acide','poison'];
      const dt = !e.damageType ? '' : NOUNS.includes(e.damageType) ? 'de ' + e.damageType
        : (String(n) === '1' || /[sx]$/.test(e.damageType) ? e.damageType : e.damageType + 's');
      const to = t.startsWith('les ') ? 'aux ' + t.slice(4) : t.startsWith('le ') ? 'au ' + t.slice(3) : 'à ' + t.replace(' et les ', ' et aux ');
      return `${res}inflige ${n} dégât${plural(n,'','s')} ${dt} ${to}.`.replace(/\s+/g,' ');
    }
    case 'wound':    return `${cap(t)} ${vb('subit','subissez','subissent')} ${n} case${plural(n,'','s')} de blessure.`;
    case 'heal':     return `Soignez ${n} case${plural(n,'','s')} de blessure (${t}).`;
    case 'armor':    return `${cap(t)} ${vb('gagne','gagnez','gagnent')} ${n} point${plural(n,'','s')} d'armure${e.magic ? ' magique' : ''}${d}.`;
    case 'modifyStat': {
      const v = String(n).startsWith('-') ? n : '+' + n;
      return `${cap(t)} : ${JDR_STAT_LABEL[e.stat] || e.stat} ${v}${d}.`;
    }
    case 'resource': {
      const neg = String(n).startsWith('-');
      return `${cap(t)} ${neg ? vb('perd','perdez','perdent') : vb('gagne','gagnez','gagnent')} ${neg ? n.slice(1) : n} ${e.resource || 'ressource'}.`;
    }
    case 'draw':     return `Piochez ${n} carte${plural(n,'','s')}.`;
    case 'explore':  return `Explorez ${n} (mettez les ${n} carte${plural(n,'','s')} du dessus de votre deck dans votre défausse).`;
    case 'discard':  return `Défaussez ${n} carte${plural(n,'','s')}.`;
    case 'takeRisk': return `${cap(t)} ${vb('prend','prenez','prennent')} ${n} risque${plural(n,'','s')}.`;
    case 'banishRisk': return `Bannissez ${n} carte${plural(n,'','s')} Risque (${t}).`;
    case 'affliction': return `${res}${t} ${vb('gagne','gagnez','gagnent')} l'affliction ${e.affliction || '…'}${d}.`.replace(/^./, c => c.toUpperCase());
    case 'extraReaction': return `Vous disposez de ${n} réaction${plural(n,'','s')} supplémentaire${plural(n,'','s')}${d}.`;
    case 'move':     return `${cap(t)} ${vb('se déplace','vous déplacez','se déplacent')} de ${n} case${plural(n,'','s')}.`;
    case 'posture':  return 'Vous adoptez cette posture.';
    case 'recover':  return `Placez dans votre main une carte ${JDR_FROM[e.from] || ''}.`;
    case 'custom':   return e.text || '';
  }
  return '';
  function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
}

// Texte complet d'une capacité : "Action libre (Défaussez 1) : effet. effet."
// Coûts d'une capacité : « 1 PA », « 2 mana », autre coût
function jdrAbilityCosts(ab){
  const has = v => v !== null && v !== undefined && v !== '';
  return [has(ab.pa) ? `${ab.pa} PA` : '', has(ab.mana) ? `${ab.mana} mana` : '', ab.cost || ''].filter(Boolean).join(', ');
}
// « Action (1 PA, Défaussez 1) : effet. effet. »
function jdrAbilityText(ab){
  const trig = (ab.triggers || []).map(t => JDR_TRIGGERS[t.trigger]).filter(Boolean).join(' ou ');
  const costs = jdrAbilityCosts(ab);
  const body = (ab.effects || []).map(jdrEffectText).filter(Boolean).join(' ');
  if(trig) return `${trig}${costs ? ` (${costs})` : ''} : ${body}`;
  return costs ? `Coût : ${costs}. ${body}` : body;
}
function jdrCardText(card){
  const parts = (card.abilities || []).map(jdrAbilityText).filter(Boolean);
  if(card.special && card.special.enabled){ const t = jdrAbilityText(card.special); if(t) parts.push(t); }
  if(card.text) parts.push(card.text);
  return parts;
}

/* ---------- 4. Cartes → caractéristiques ---------- */
/*
  Une carte modifie les caractéristiques du personnage quand elle a une capacité
  déclenchée par "Tant que cette carte est dans votre deck" (whileInDeck) avec un
  effet "Modifier une caractéristique" ciblant "vous".
  Exemple : une malédiction "Tant que cette carte est dans votre deck : Charme -1".
  Les autres modifications (une posture jouée, une aura…) seront appliquées par le
  moteur de partie, pendant le jeu.
*/
function jdrDeckStatModifiers(deck, cardsById, sheet){
  const mods = {}; const sources = {};
  JDR_STATS.forEach(s => { mods[s.key] = 0; sources[s.key] = []; });
  (deck || []).forEach(entry => {
    const card = cardsById[entry.card]; if(!card) return;
    const qty = Number(entry.qty) || 0; if(!qty) return;
    (card.abilities || []).forEach(ab => {
      if(!(ab.triggers || []).some(t => JDR_PASSIVE_TRIGGERS.includes(t.trigger))) return;
      (ab.effects || []).forEach(e => {
        if(e.type !== 'modifyStat' || (e.target && e.target !== 'self') || !(e.stat in mods)) return;
        const v = jdrEvalFormula(e.amount, sheet, {}) * qty;
        if(!v) return;
        mods[e.stat] += v; sources[e.stat].push({ card: card.name, value: v });
      });
    });
  });
  return { mods, sources };
}
// Caractéristiques de base + modificateurs du deck
function jdrEffectiveStats(sheet, deck, cardsById){
  const base = Object.assign({}, (sheet && sheet.stats) || {});
  const { mods, sources } = jdrDeckStatModifiers(deck, cardsById, sheet);
  const total = {};
  JDR_STATS.forEach(s => { total[s.key] = (Number(base[s.key]) || 0) + mods[s.key]; });
  return { base, mods, total, sources };
}

/* ---------- 5. Caractéristiques → cartes ---------- */

// Évalue "2+corps", "esprit*2", "niveau" avec les valeurs du personnage.
// Seuls les chiffres, + - * / ( ) et les noms de caractéristiques sont acceptés.
function jdrEvalFormula(expr, sheet, extraStats){
  if(typeof expr === 'number') return expr;
  let s = jdrNorm(expr);
  if(!s) return 0;
  const stats = Object.assign({}, (sheet && sheet.stats) || {}, extraStats || {});
  const vars = {
    opportunisme: stats.opp, opp: stats.opp, anticipation: stats.ant, ant: stats.ant,
    corps: stats.corps, esprit: stats.esprit, charme: stats.charme,
    resistance: stats.res, res: stats.res, pa: stats.pa, niveau: sheet && sheet.level
  };
  s = s.replace(/[a-z]+/g, w => (w in vars ? '(' + (Number(vars[w]) || 0) + ')' : 'NaN'));
  if(!/^[0-9+\-*/(). ]*$/.test(s) || /NaN/.test(s)) return 0;
  try{ const v = Function('"use strict";return (' + s + ')')(); return Number.isFinite(v) ? Math.floor(v) : 0; }
  catch(e){ return 0; }
}
// Une formule contient-elle une caractéristique ? (pour l'afficher "2 + Corps")
function jdrFormulaUsesStats(expr){ return /[a-z]/i.test(String(expr || '')); }

// Le personnage peut-il lancer des sorts ?
function jdrCanCastSpells(sheet){
  const classes = jdrSplitList(sheet && sheet.classe).map(jdrNorm);
  const specs = jdrSplitList(sheet && sheet.specialisation).map(jdrNorm);
  return classes.some(c => JDR_SPELL_CLASSES.map(jdrNorm).includes(c)) ||
         specs.some(s => JDR_SPELL_SPECS.map(jdrNorm).includes(s));
}

// La carte est-elle autorisée pour ce personnage ? Renvoie { ok, reasons[] }
function jdrCardAllowed(card, sheet, effectiveStats){
  const reasons = [];
  const c = jdrNormalizeCard(card);
  if(c.type === 'Risque') reasons.push('Les cartes Risque ne se mettent pas dans un deck.');
  const has = (list, value) => {
    const wanted = list.map(jdrNorm);
    return jdrSplitList(value).map(jdrNorm).some(v => wanted.includes(v));
  };
  if(c.classes.length && !has(c.classes, sheet.classe)) reasons.push('Classe : ' + c.classes.join(', '));
  // super-types qui sont des spécialisations / passés / peuples : le personnage doit en avoir un
  const inGroup = g => c.restrict.filter(x => JDR_RESTRICT_GROUPS[g].map(jdrNorm).includes(jdrNorm(x)));
  [['Spécialisations','specialisation','Spécialisation'],['Passés','passe','Passé'],['Peuples','peuple','Peuple']].forEach(([g, field, label]) => {
    const need = inGroup(g);
    if(need.length && !has(need, sheet[field])) reasons.push(`${label} : ${need.join(', ')}`);
  });
  // Un sort sans classe ni spécialisation imposée demande de savoir lancer des sorts
  if(c.type === 'Sortilège' && !c.classes.length && !inGroup('Spécialisations').length && !jdrCanCastSpells(sheet))
    reasons.push('Sort : réservé aux Érudits, Prêtres, Druides et Bardes');
  const stats = effectiveStats || (sheet && sheet.stats) || {};
  c.requirements.forEach(r => {
    if((Number(stats[r.stat]) || 0) < Number(r.min)) reasons.push(`${JDR_STAT_LABEL[r.stat] || r.stat} ${r.min} minimum`);
  });
  return { ok: reasons.length === 0, reasons };
}

/* ---------- 6. Construction du deck ---------- */

function jdrDeckLimits(sheet){
  const lvl = Math.max(1, Math.min(15, Number(sheet && sheet.level) || 1));
  return { min: JDR_DECK_MIN, max: JDR_DECK_MAX_BY_LEVEL[lvl], level: lvl };
}

// Vérifie un deck complet. Renvoie { count, horsDeck, limits, errors[], warnings[] }
function jdrValidateDeck(deck, cardsById, sheet){
  const limits = jdrDeckLimits(sheet);
  const eff = jdrEffectiveStats(sheet, deck, cardsById).total;
  let count = 0, horsDeck = 0; const errors = [], warnings = [];
  (deck || []).forEach(entry => {
    const card = cardsById[entry.card];
    const qty = Number(entry.qty) || 0;
    if(!card){ warnings.push(`Carte introuvable (${entry.card}) : elle a peut-être été supprimée.`); return; }
    if(card.horsDeck){ horsDeck += qty; if(qty > 1) errors.push(`${card.name} : une carte hors deck ne peut être prise qu'une fois.`); }
    else count += qty;
    if(card.maxCopies && qty > card.maxCopies) errors.push(`${card.name} : ${card.maxCopies} exemplaire(s) maximum.`);
    const a = jdrCardAllowed(card, sheet, eff);
    if(!a.ok) errors.push(`${card.name} : ${a.reasons.join(' · ')}`);
  });
  if(count < limits.min) errors.push(`Le deck doit contenir au moins ${limits.min} cartes (actuellement ${count}).`);
  if(count > limits.max) errors.push(`Au niveau ${limits.level}, le deck contient au plus ${limits.max} cartes (actuellement ${count}).`);
  return { count, horsDeck, limits, errors, warnings, valid: errors.length === 0 };
}

// Identifiant de carte à partir de son nom ("Frappe brutale" → "frappe_brutale")
function jdrSlug(name){
  return jdrNorm(name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'carte';
}
