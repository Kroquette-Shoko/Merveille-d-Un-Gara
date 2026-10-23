/* Merveille d'Un'Gara — rendu d'une carte (modèle D validé le 23/10/2026, styles dans css/jdr-ui.css).
   jdrCardHTML(card, { sheet, size: 'small' | '', locked })
   - sheet (facultatif) : la fiche du personnage. Si elle est fournie, les formules
     comme "2+corps" sont calculées avec ses caractéristiques : « 6 (2 + Corps) ».

   Disposition :
   - colonne de couleur à gauche : valeur (écusson), mana (sorts), composantes (sorts), persistance
   - bandeau du haut : nom, puis « Super type · Type — sous-types »
   - illustration, capacités, encadré « Spécial · <nom> » pour les capacités marquées spéciales
   - couleur : celle de la classe (une seule classe), neutre sinon, violet sombre pour les Risques */

// "2+corps" → "2 + Corps" ; avec une fiche → "6 (2 + Corps)"
function jdrPrettyAmount(expr, sheet){
  const raw = String(expr ?? '').trim();
  if(!jdrFormulaUsesStats(raw)) return raw;
  const words = { opp:'Opportunisme', opportunisme:'Opportunisme', ant:'Anticipation', anticipation:'Anticipation',
    corps:'Corps', esprit:'Esprit', charme:'Charme', res:'Résistance', resistance:'Résistance', pa:"Points d'action", niveau:'Niveau' };
  const label = raw.replace(/\s*([+\-*/])\s*/g, ' $1 ').replace(/[a-zA-Zéè]+/g, w => words[jdrNorm(w)] || w);
  return sheet ? `${jdrEvalFormula(raw, sheet)} (${label})` : label;
}

// Texte d'une capacité, formules affichées lisiblement
function jdrPrettyAbility(ab, sheet, extraCost){
  const cost = [extraCost, ab.cost].filter(Boolean).join(', ');
  const copy = Object.assign({}, ab, { cost, effects: (ab.effects || []).map(e => Object.assign({}, e, { amount: jdrPrettyAmount(e.amount, sheet) })) });
  return jdrAbilityText(copy);
}

// { main: [lignes], special: [lignes] } — le coût en PA s'ajoute à la première capacité normale
function jdrCardTextLines(card, sheet){
  const pa = (card.pa !== null && card.pa !== '' && card.pa !== undefined && card.type !== 'Risque') ? `${card.pa} PA` : '';
  const main = [], special = [];
  let paUsed = false;
  (card.abilities || []).forEach(ab => {
    if(ab.special){ const t = jdrPrettyAbility(ab, sheet, ''); if(t) special.push(t); return; }
    const t = jdrPrettyAbility(ab, sheet, paUsed ? '' : pa);
    if(t){ main.push(t); if((ab.triggers || []).length) paUsed = true; }
  });
  if(card.text) main.push(card.text);
  if(pa && !paUsed) main.unshift(`Coût : ${pa}.`);
  return { main, special };
}

const JDR_COMP_ICONS = {
  sonore: '<path d="M4 10v4h4l5 4V6L8 10H4z"></path><path d="M16 9a4 4 0 0 1 0 6"></path><path d="M19 6a8 8 0 0 1 0 12"></path>',
  gestuelle: '<path d="M7 11V5a1.5 1.5 0 0 1 3 0v5"></path><path d="M10 10V4a1.5 1.5 0 0 1 3 0v6"></path><path d="M13 10V5a1.5 1.5 0 0 1 3 0v6"></path><path d="M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.6L7 14"></path>',
  materielle: '<path d="M12 3l7 6-7 12L5 9z"></path><path d="M5 9h14"></path>'
};
const JDR_COMP_LABEL = { sonore: 'Sonore', gestuelle: 'Gestuelle', materielle: 'Matérielle' };

function jdrCardHTML(card, opts = {}){
  const c = jdrNormalizeCard(card);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const col = JDR_CARD_COLORS[jdrCardColorKey(c)];
  const sup = jdrCardSuperType(c);
  const typeLine = [c.type, c.subtypes.join(', ')].filter(Boolean).join(' — ');
  const comps = c.type === 'Sort' ? ['sonore','gestuelle','materielle'].filter(k => c.components[k]) : [];
  const hasMana = c.type === 'Sort' && c.mana !== null && c.mana !== '' && c.mana !== undefined;
  const { main, special } = jdrCardTextLines(c, opts.sheet);
  const art = c.image_url
    ? `<div class="art" style="background-image:url('${esc(c.image_url).replace(/'/g, '%27')}')"></div>`
    : `<div class="art ph"></div>`;
  const cls = ['jcard', opts.size === 'small' ? 'small' : '', opts.locked ? 'locked' : ''].filter(Boolean).join(' ');
  const showVal = c.value !== null && c.value !== '' && c.value !== undefined;

  return `<div class="${cls}" data-card="${esc(c.id)}" title="${esc(c.name)}" style="--cc:${col.color};--ci:${col.ink}">
    <div class="col">
      ${showVal ? `<div class="vbox"><div class="val" aria-label="Valeur : ${esc(c.value)}">${esc(c.value)}</div><span class="vlab">Valeur</span></div>` : ''}
      ${hasMana ? `<div class="mana" aria-label="Coût en mana : ${esc(c.mana)}">${esc(c.mana)}</div>` : ''}
      ${comps.length ? `<div class="comps" aria-label="Composantes : ${comps.map(k => JDR_COMP_LABEL[k]).join(', ')}">${comps.map(k =>
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${JDR_COMP_ICONS[k]}</svg>`).join('')}</div>` : ''}
      ${c.persistent ? `<div class="pers" title="Carte persistante" aria-label="Carte persistante">⟳</div>` : ''}
    </div>
    <div class="main">
      <div class="head">
        <div class="name">${esc(c.name || 'Sans nom')}</div>
        <div class="type">${sup ? `<b>${esc(sup)}</b> · ` : ''}${esc(typeLine)}</div>
      </div>
      ${art}
      <div class="txt">${main.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      ${special.length ? `<div class="spec"><div class="st">Spécial${c.specialName ? ' · ' + esc(c.specialName) : ''}</div>${special.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
      ${c.footer ? `<div class="foot">${esc(c.footer)}</div>` : ''}
    </div>
  </div>`;
}
