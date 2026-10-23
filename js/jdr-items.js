/* Merveille d'Un'Gara — équipement : modèle de données et affichage.
   Table jdr.items (sql/jdr-006). Une ligne = { id, name, data } ; data.kind = type d'objet.

   Champs communs (tous les types) :
     kind        'arme' | 'armure' | 'bouclier' | 'magique' | 'objet'
     size        taille dans l'inventaire, en cases (0, 1, 2, 3, 6, 9 — voir le mémo des tailles)
     properties  [{ id, name, value }] : mots-clés de catégorie « Propriété » (Légère, Lourde, Bruyant…)
     description texte libre
     image_url   adresse web de l'image ('' = aucune)
     image       { fit: 'cover' | 'contain', x, y } : cadrage — cover = remplit le cadre, contain = image entière ;
                 x, y = point de l'image gardé au centre, en % (50 = milieu)
   Arme :
     category    'Courante' | 'De guerre'
     reach       'Corps à corps' | 'Distance'
     range       portée (JDR_RANGES) ou '' si aucune
     damageType  type de dégât (JDR_DAMAGE_TYPES)
     attacks     { main: {text}, second: {cost, text}, third: {cost, text} }
                 cost = coût de l'attaque (ex. « Défausse 1 ») ; text = effet (ex. « 1 blessure légère et désarme »)
   Armure :
     category    'Légère' | 'Intermédiaire' | 'Lourde'
     armor, armorMagic, resistance  (nombres)
   Bouclier :
     armor, armorMagic, resistance, attack {cost, text}, damageType
   Objet magique :
     base        objet de base, texte libre (ex. « Armure légère (vêtement) »)
     slot        emplacement (JDR_ITEM_SLOTS)
     rarity      rareté (JDR_RARITIES)
     armor, armorMagic, resistance  bonus donnés (nombres, 0 = aucun)
     powers      [{ text, uses }] : pouvoirs ; uses = limite d'utilisation (ex. « 3 fois par jour »), vide = illimité
   Objet divers :
     category    catégorie (JDR_OBJECT_CATEGORIES)
     consumable  vrai si l'objet disparaît une fois utilisé
     effect      effet quand on l'utilise (texte libre, vide = aucun)
*/

const JDR_ITEM_KINDS = {
  arme:     { label: 'Arme',          plural: 'Armes',           color: '#9A2F27', ready: true },
  armure:   { label: 'Armure',        plural: 'Armures',         color: '#5E6B78', ready: true },
  bouclier: { label: 'Bouclier',      plural: 'Boucliers',       color: '#3A5BB8', ready: true },
  magique:  { label: 'Objet magique', plural: 'Objets magiques', color: '#7A3FA0', ready: true },
  objet:    { label: 'Objet',         plural: 'Objets',          color: '#3A7D8C', ready: true }
};
const JDR_WEAPON_CATEGORIES = ['Courante', 'De guerre'];
const JDR_WEAPON_REACH = ['Corps à corps', 'Distance'];
const JDR_ARMOR_CATEGORIES = ['Légère', 'Intermédiaire', 'Lourde'];
const JDR_ITEM_SLOTS = ['Armure', 'Main principale', 'Main secondaire', 'Deux mains', 'Tête', 'Cou', 'Dos', 'Mains', 'Bijou', 'Ceinture', 'Pieds', 'Aucun (transporté)'];
const JDR_RARITIES = ['Commune', 'Non-commune', 'Rare', 'Très rare', 'Légendaire'];
const JDR_OBJECT_CATEGORIES = ['Consommable', 'Outil', 'Munition', 'Nourriture', 'Matériel d\'aventure', 'Trésor', 'Autre'];
// Mémo des tailles (même liste que la fiche de personnage)
const JDR_ITEM_SIZES = [
  { n: 0, t: 'Minuscule' }, { n: 1, t: 'Petit' }, { n: 2, t: 'Moyen' },
  { n: 3, t: 'Large' }, { n: 6, t: 'Volumineux' }, { n: 9, t: 'Massif' }
];

function jdrBlankAttack(){ return { cost: '', text: '' }; }
function jdrBlankItemImage(){ return { fit: 'cover', x: 50, y: 50 }; }
function jdrBlankItem(kind){
  kind = JDR_ITEM_KINDS[kind] ? kind : 'arme';
  const base = { id: '', name: '', kind, size: 1, properties: [], description: '', image_url: '', image: jdrBlankItemImage() };
  if(kind === 'arme') return Object.assign(base, { size: 2, category: 'Courante', reach: 'Corps à corps', range: '', damageType: 'tranchant',
    attacks: { main: { text: '' }, second: jdrBlankAttack(), third: jdrBlankAttack() } });
  if(kind === 'armure') return Object.assign(base, { size: 6, category: 'Légère', armor: 0, armorMagic: 0, resistance: 0 });
  if(kind === 'bouclier') return Object.assign(base, { size: 2, armor: 0, armorMagic: 0, resistance: 0, attack: jdrBlankAttack(), damageType: 'contondant' });
  if(kind === 'magique') return Object.assign(base, { base: '', slot: 'Bijou', rarity: 'Non-commune', armor: 0, armorMagic: 0, resistance: 0, powers: [{ text: '', uses: '' }] });
  if(kind === 'objet') return Object.assign(base, { category: 'Matériel d\'aventure', consumable: false, effect: '' });
  return base;
}
// Complète un objet lu en base (champs manquants, mauvais types)
function jdrNormalizeItem(row){
  const d = (row && row.data) || row || {};
  const o = Object.assign(jdrBlankItem(d.kind), d);
  o.id = row && row.id ? row.id : (o.id || '');
  o.name = row && row.name ? row.name : (o.name || '');
  const num = v => (v === '' || v === null || v === undefined || !isFinite(Number(v))) ? 0 : Number(v);
  o.size = Math.max(0, num(o.size));
  o.image_url = String(o.image_url || '').trim();
  o.image = Object.assign(jdrBlankItemImage(), o.image || {});
  if(!['cover','contain'].includes(o.image.fit)) o.image.fit = 'cover';
  ['x','y'].forEach(k => { o.image[k] = Math.max(0, Math.min(100, isFinite(Number(o.image[k])) ? Number(o.image[k]) : 50)); });
  o.properties = (Array.isArray(o.properties) ? o.properties : []).filter(k => k && k.id)
    .map(k => ({ id: String(k.id), name: String(k.name || ''), value: String(k.value ?? '') }));
  ['armor','armorMagic','resistance'].forEach(k => { if(k in o) o[k] = num(o[k]); });
  if(o.kind === 'arme'){
    const a = o.attacks || {};
    o.attacks = { main: { text: String((a.main || {}).text || '') },
                  second: Object.assign(jdrBlankAttack(), a.second || {}), third: Object.assign(jdrBlankAttack(), a.third || {}) };
  }
  if(o.kind === 'bouclier') o.attack = Object.assign(jdrBlankAttack(), o.attack || {});
  if(o.kind === 'magique') o.powers = (Array.isArray(o.powers) ? o.powers : []).map(p => ({ text: String((p && p.text) || ''), uses: String((p && p.uses) || '') }));
  if(o.kind === 'objet') o.consumable = !!o.consumable;
  return o;
}
// Données à enregistrer en base (sans id ni name, qui sont des colonnes)
function jdrItemData(it){ const d = structuredClone(it); delete d.id; delete d.name; delete d.updated_at; return d; }

function jdrSizeLabel(n){
  const s = JDR_ITEM_SIZES.slice().reverse().find(x => n >= x.n) || JDR_ITEM_SIZES[0];
  return `${n} case${n > 1 ? 's' : ''} (${s.t.toLowerCase()})`;
}
// Ligne de résumé d'un objet (liste, recherche)
function jdrItemSummary(it){
  if(it.kind === 'arme') return [it.category, it.reach, it.damageType].filter(Boolean).join(' · ');
  if(it.kind === 'armure') return `${it.category} · Armure ${it.armor}`;
  if(it.kind === 'bouclier') return `Armure ${it.armor}`;
  if(it.kind === 'magique') return [it.slot, it.rarity].filter(Boolean).join(' · ');
  if(it.kind === 'objet') return [it.category, it.consumable ? 'consommable' : ''].filter(Boolean).join(' · ');
  return JDR_ITEM_KINDS[it.kind] ? JDR_ITEM_KINDS[it.kind].label : '';
}

// Fiche d'objet (aperçu de l'éditeur, futures listes de l'équipement)
function jdrItemHTML(it, opts = {}){
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const k = JDR_ITEM_KINDS[it.kind] || JDR_ITEM_KINDS.arme;
  const props = (it.properties || []).map(p => {
    const def = (typeof JDR_KW !== 'undefined' && JDR_KW[p.id]) || {};
    const label = typeof jdrKeywordLabel === 'function' ? jdrKeywordLabel(p) : (p.name || p.id);
    return `<span class="ip" title="${esc(def.text || '')}">${esc(label)}</span>`;
  }).join('');
  const att = (lab, a, withCost) => (a && (a.text || a.cost))
    ? `<div class="ia"><span class="il">${lab}</span><span>${withCost && a.cost ? `<b class="ic">${esc(a.cost)}</b> ` : ''}${esc(a.text) || '—'}</span></div>` : '';
  let body = '';
  if(it.kind === 'arme'){
    const meta = [it.category, it.reach, it.damageType, it.range ? 'Portée : ' + it.range.toLowerCase() : ''].filter(Boolean);
    body = `<div class="im">${meta.map(esc).join(' · ')}</div>
      <div class="iatt">${att('Principale', it.attacks.main, false)}${att('Secondaire', it.attacks.second, true)}${att('Tertiaire', it.attacks.third, true)}</div>`;
    if(!it.attacks.main.text && !it.attacks.second.text && !it.attacks.third.text) body += `<p class="ie">Aucune attaque renseignée.</p>`;
  } else if(it.kind === 'armure' || it.kind === 'bouclier'){
    const vals = [['Armure', it.armor], ['Armure magique', it.armorMagic], ['Résistance', it.resistance]];
    body = `${it.kind === 'armure' ? `<div class="im">Armure ${esc((it.category || '').toLowerCase())}</div>` : ''}
      <div class="iv">${vals.map(([l, v]) => `<div><b>${esc(v)}</b><span>${l}</span></div>`).join('')}</div>
      ${it.kind === 'bouclier' ? `<div class="iatt">${att('Attaque', it.attack, true)}</div>${it.attack && it.attack.text ? `<div class="im">${esc(it.damageType)}</div>` : ''}` : ''}`;
  } else if(it.kind === 'magique'){
    const meta = [it.base, it.slot && it.slot !== 'Aucun (transporté)' ? 'Emplacement : ' + it.slot.toLowerCase() : '', it.rarity ? it.rarity.toLowerCase() : ''].filter(Boolean);
    const bon = [['Armure', it.armor], ['Armure magique', it.armorMagic], ['Résistance', it.resistance]].filter(([, v]) => v);
    const pw = (it.powers || []).filter(p => p.text);
    body = `<div class="im">${meta.map(esc).join(' · ')}</div>
      ${bon.length ? `<div class="iv">${bon.map(([l, v]) => `<div><b>${v > 0 ? '+' : ''}${esc(v)}</b><span>${l}</span></div>`).join('')}</div>` : ''}
      ${pw.length ? `<div class="iatt">${pw.map(p => `<div class="ia ipw"><span>${esc(p.text)}${p.uses ? ` <b class="ic">${esc(p.uses)}</b>` : ''}</span></div>`).join('')}</div>` : `<p class="ie">Aucun pouvoir renseigné.</p>`}`;
  } else if(it.kind === 'objet'){
    body = `<div class="im">${esc(it.category)}${it.consumable ? (it.category === 'Consommable' ? ' (disparaît une fois utilisé)' : ' · consommable (disparaît une fois utilisé)') : ''}</div>
      ${it.effect ? `<div class="iatt"><div class="ia"><span class="il">Effet</span><span>${esc(it.effect)}</span></div></div>` : ''}`;
  }
  return `<div class="jitem" style="--ik:${k.color}${opts.width ? ';width:' + opts.width : ''}">
    <div class="ih"><span class="ik">${esc(k.label)}</span><div class="in">${esc(it.name || 'Sans nom')}</div></div>
    ${it.image_url ? `<div class="iimg"><img src="${esc(it.image_url)}" alt="" loading="lazy" style="object-fit:${it.image.fit};object-position:${it.image.x}% ${it.image.y}%"></div>` : ''}
    <div class="ib">
      ${body}
      ${props ? `<div class="ips">${props}</div>` : ''}
      ${it.description ? `<p class="id">${esc(it.description)}</p>` : ''}
      <div class="isz">Taille : ${esc(jdrSizeLabel(it.size || 0))}</div>
    </div>
  </div>`;
}
