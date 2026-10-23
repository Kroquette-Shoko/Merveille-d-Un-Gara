/* Merveille d'Un'Gara — équipement : modèle de données et affichage.
   Table jdr.items (sql/jdr-006). Une ligne = { id, name, data } ; data.kind = type d'objet.

   Champs communs (tous les types) :
     kind        'arme' | 'armure' | 'bouclier' | 'magique' | 'objet'
     size        taille dans l'inventaire, en cases (0, 1, 2, 3, 6, 9 — voir le mémo des tailles)
     properties  [{ id, name, value }] : mots-clés de catégorie « Propriété » (Légère, Lourde, Bruyant…)
     description texte libre
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
   Objets magiques et objets divers : étape 2.
*/

const JDR_ITEM_KINDS = {
  arme:     { label: 'Arme',          plural: 'Armes',           color: '#9A2F27', ready: true },
  armure:   { label: 'Armure',        plural: 'Armures',         color: '#5E6B78', ready: true },
  bouclier: { label: 'Bouclier',      plural: 'Boucliers',       color: '#3A5BB8', ready: true },
  magique:  { label: 'Objet magique', plural: 'Objets magiques', color: '#7A3FA0', ready: false },
  objet:    { label: 'Objet',         plural: 'Objets',          color: '#3A7D8C', ready: false }
};
const JDR_WEAPON_CATEGORIES = ['Courante', 'De guerre'];
const JDR_WEAPON_REACH = ['Corps à corps', 'Distance'];
const JDR_ARMOR_CATEGORIES = ['Légère', 'Intermédiaire', 'Lourde'];
// Mémo des tailles (même liste que la fiche de personnage)
const JDR_ITEM_SIZES = [
  { n: 0, t: 'Minuscule' }, { n: 1, t: 'Petit' }, { n: 2, t: 'Moyen' },
  { n: 3, t: 'Large' }, { n: 6, t: 'Volumineux' }, { n: 9, t: 'Massif' }
];

function jdrBlankAttack(){ return { cost: '', text: '' }; }
function jdrBlankItem(kind){
  kind = JDR_ITEM_KINDS[kind] ? kind : 'arme';
  const base = { id: '', name: '', kind, size: 1, properties: [], description: '' };
  if(kind === 'arme') return Object.assign(base, { size: 2, category: 'Courante', reach: 'Corps à corps', range: '', damageType: 'tranchant',
    attacks: { main: { text: '' }, second: jdrBlankAttack(), third: jdrBlankAttack() } });
  if(kind === 'armure') return Object.assign(base, { size: 6, category: 'Légère', armor: 0, armorMagic: 0, resistance: 0 });
  if(kind === 'bouclier') return Object.assign(base, { size: 2, armor: 0, armorMagic: 0, resistance: 0, attack: jdrBlankAttack(), damageType: 'contondant' });
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
  o.properties = (Array.isArray(o.properties) ? o.properties : []).filter(k => k && k.id)
    .map(k => ({ id: String(k.id), name: String(k.name || ''), value: String(k.value ?? '') }));
  ['armor','armorMagic','resistance'].forEach(k => { if(k in o) o[k] = num(o[k]); });
  if(o.kind === 'arme'){
    const a = o.attacks || {};
    o.attacks = { main: { text: String((a.main || {}).text || '') },
                  second: Object.assign(jdrBlankAttack(), a.second || {}), third: Object.assign(jdrBlankAttack(), a.third || {}) };
  }
  if(o.kind === 'bouclier') o.attack = Object.assign(jdrBlankAttack(), o.attack || {});
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
  }
  return `<div class="jitem" style="--ik:${k.color}${opts.width ? ';width:' + opts.width : ''}">
    <div class="ih"><span class="ik">${esc(k.label)}</span><div class="in">${esc(it.name || 'Sans nom')}</div></div>
    <div class="ib">
      ${body}
      ${props ? `<div class="ips">${props}</div>` : ''}
      ${it.description ? `<p class="id">${esc(it.description)}</p>` : ''}
      <div class="isz">Taille : ${esc(jdrSizeLabel(it.size || 0))}</div>
    </div>
  </div>`;
}
