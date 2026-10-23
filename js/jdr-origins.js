/* Merveille d'Un'Gara — origines du personnage : peuples, classes, spécialisations, passés.
   Table jdr.origins (sql/jdr-007). Une ligne = { id, name, data } ; data.kind = type.

   Peuple (étape 3) :
     family       famille de peuples, facultatif (ex. « Elfes » pour Haut-elfe, Elfe sylvain…)
     size         taille du personnage : 'P' | 'M' | 'G' (sert à la charge sur la fiche)
     stats        { opp, ant, corps, esprit, charme, res, pa } : bonus ou malus (nombres)
     armor        bonus d'armure (nombre)
     abilities    [{ name, speed, cost, text, uses }] : capacités du peuple
                  speed = 'Passif' | 'Action' | 'Action libre' | 'Réaction' | 'Mouvement'
                  cost  = coût (ex. « Défausse 1 »), uses = limite (ex. « 3 fois par jour »)
     description  histoire, apparence, culture
   Classes, spécialisations, passés : étapes 4 et 5.
*/

const JDR_ORIGIN_KINDS = {
  peuple:         { label: 'Peuple',         plural: 'Peuples',         color: '#3A7D8C', ready: true },
  classe:         { label: 'Classe',         plural: 'Classes',         color: '#8A5A2B', ready: false },
  specialisation: { label: 'Spécialisation', plural: 'Spécialisations', color: '#6B4C9A', ready: false },
  passe:          { label: 'Passé',          plural: 'Passés',          color: '#5E6B78', ready: false }
};
const JDR_ABILITY_SPEEDS = ['Passif', 'Action', 'Action libre', 'Réaction', 'Mouvement'];
const JDR_CHAR_SIZES = { P: 'Petite', M: 'Moyenne', G: 'Grande' };

function jdrBlankOriginAbility(){ return { name: '', speed: 'Passif', cost: '', text: '', uses: '' }; }
function jdrBlankStats(){ return Object.fromEntries(JDR_STATS.map(s => [s.key, 0])); }
function jdrBlankOrigin(kind){
  kind = JDR_ORIGIN_KINDS[kind] ? kind : 'peuple';
  const base = { id: '', name: '', kind, description: '' };
  if(kind === 'peuple') return Object.assign(base, { family: '', size: 'M', stats: jdrBlankStats(), armor: 0, abilities: [jdrBlankOriginAbility()] });
  return base;
}
function jdrNormalizeOrigin(row){
  const d = (row && row.data) || {};
  const o = Object.assign(jdrBlankOrigin(d.kind), d);
  o.id = (row && row.id) || ''; o.name = (row && row.name) || '';
  const num = v => (v === '' || v === null || v === undefined || !isFinite(Number(v))) ? 0 : Number(v);
  if(o.kind === 'peuple'){
    o.stats = Object.assign(jdrBlankStats(), o.stats || {});
    Object.keys(o.stats).forEach(k => o.stats[k] = num(o.stats[k]));
    o.armor = num(o.armor);
    if(!JDR_CHAR_SIZES[o.size]) o.size = 'M';
    o.abilities = (Array.isArray(o.abilities) ? o.abilities : []).map(a => Object.assign(jdrBlankOriginAbility(), a || {}));
  }
  return o;
}
function jdrOriginData(o){ const d = structuredClone(o); delete d.id; delete d.name; delete d.updated_at; return d; }
function jdrOriginSummary(o){
  if(o.kind === 'peuple') return [o.family, 'Taille ' + (JDR_CHAR_SIZES[o.size] || '').toLowerCase()].filter(Boolean).join(' · ');
  return '';
}

// Fiche d'origine (aperçu de l'éditeur, plus tard : choix sur la fiche de personnage)
function jdrOriginHTML(o, opts = {}){
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const k = JDR_ORIGIN_KINDS[o.kind] || JDR_ORIGIN_KINDS.peuple;
  let body = '';
  if(o.kind === 'peuple'){
    const sign = v => (v > 0 ? '+' : '') + v;
    const stats = JDR_STATS.map(s => `<div class="${o.stats[s.key] ? '' : 'z'}"><b>${esc(sign(o.stats[s.key]))}</b><span>${esc(s.label)}</span></div>`).join('')
      + `<div class="${o.armor ? '' : 'z'}"><b>${esc(sign(o.armor))}</b><span>Armure</span></div>`;
    const abil = o.abilities.filter(a => a.name || a.text).map(a => `<div class="oa">
        <div class="oah"><b>${esc(a.name || 'Capacité')}</b>${a.speed && a.speed !== 'Passif' ? `<span class="ic">${esc(a.speed)}</span>` : '<span class="osp">Passif</span>'}${a.cost ? `<span class="ic">${esc(a.cost)}</span>` : ''}${a.uses ? `<span class="osp">${esc(a.uses)}</span>` : ''}</div>
        ${a.text ? `<p>${esc(a.text)}</p>` : ''}</div>`).join('');
    body = `<div class="im">${esc([o.family, 'Taille ' + (JDR_CHAR_SIZES[o.size] || '').toLowerCase()].filter(Boolean).join(' · '))}</div>
      <div class="ost">${stats}</div>
      ${abil || '<p class="ie">Aucune capacité renseignée.</p>'}`;
  }
  return `<div class="jitem jorig" style="--ik:${k.color}${opts.width ? ';width:' + opts.width : ''}">
    <div class="ih"><span class="ik">${esc(k.label)}</span><div class="in">${esc(o.name || 'Sans nom')}</div></div>
    <div class="ib">${body}${o.description ? `<p class="id">${esc(o.description)}</p>` : ''}</div>
  </div>`;
}
