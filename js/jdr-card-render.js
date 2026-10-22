/* Merveille d'Un'Gara — rendu d'une carte (dessinée en HTML/CSS, styles dans css/jdr-ui.css).
   jdrCardHTML(card, { sheet, size: 'small' | '', locked })
   - sheet (facultatif) : la fiche du personnage. Si elle est fournie, les formules
     comme "2+corps" sont calculées avec ses caractéristiques : « 6 (2 + Corps) ». */

// "2+corps" → "2 + Corps" ; avec une fiche → "6 (2 + Corps)"
function jdrPrettyAmount(expr, sheet){
  const raw = String(expr ?? '').trim();
  if(!jdrFormulaUsesStats(raw)) return raw;
  const words = { opp:'Opportunisme', opportunisme:'Opportunisme', ant:'Anticipation', anticipation:'Anticipation',
    corps:'Corps', esprit:'Esprit', charme:'Charme', res:'Résistance', resistance:'Résistance', pa:"Points d'action", niveau:'Niveau' };
  const label = raw.replace(/\s*([+\-*/])\s*/g, ' $1 ').replace(/[a-zA-Zéè]+/g, w => words[jdrNorm(w)] || w);
  return sheet ? `${jdrEvalFormula(raw, sheet)} (${label})` : label;
}

function jdrCardTextLines(card, sheet){
  const lines = (card.abilities || []).map(ab => {
    const copy = Object.assign({}, ab, { effects: (ab.effects || []).map(e => Object.assign({}, e, { amount: jdrPrettyAmount(e.amount, sheet) })) });
    return jdrAbilityText(copy);
  }).filter(Boolean);
  if(card.text) lines.push(card.text);
  return lines;
}

function jdrCardHTML(card, opts = {}){
  const c = jdrNormalizeCard(card);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const typeLine = [c.type, ...c.subtypes].filter(Boolean).join(' - ');
  const comps = c.type === 'Sort'
    ? ['sonore','gestuelle','materielle'].filter(k => c.components[k]).map(k => ({ sonore:'Sonore', gestuelle:'Gestuelle', materielle:'Matérielle' }[k]))
    : [];
  const lines = jdrCardTextLines(c, opts.sheet);
  const art = c.image_url
    ? `<div class="art" style="background-image:url('${esc(c.image_url).replace(/'/g, '%27')}')"></div>`
    : `<div class="art ph"></div>`;
  const cls = ['jcard', opts.size === 'small' ? 'small' : '', c.type === 'Risque' ? 'risk' : '', opts.locked ? 'locked' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}" data-card="${esc(c.id)}" title="${esc(c.name)}">
    ${art}
    ${c.type !== 'Risque' || c.value ? `<div class="val" aria-label="Valeur">${esc(c.value ?? '')}</div>` : ''}
    ${c.type === 'Sort' && c.mana !== null && c.mana !== '' ? `<div class="mana" aria-label="Coût en mana">${esc(c.mana)}</div>` : ''}
    ${c.persistent ? `<div class="pers" aria-label="Persistante" title="Carte persistante">⟳</div>` : ''}
    ${c.pa !== null && c.pa !== '' && c.type !== 'Risque' ? `<div class="pa" style="top:calc(46% - 9cqw);bottom:auto" aria-label="Coût en points d'action">${esc(c.pa)} PA</div>` : ''}
    <div class="face">
      <div class="banner"><span class="o">${esc(c.origin || (c.type === 'Risque' ? 'Carte risque' : c.type))}</span>${c.origin || c.subtypes.length ? `<span class="t">${esc(typeLine)}</span>` : ''}</div>
      <div class="name">${esc(c.name || 'Sans nom')}</div>
      ${comps.length ? `<div class="comp">Composantes : ${comps.join(' · ')}</div>` : ''}
      <div class="txt">${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      ${c.footer ? `<div class="foot">${esc(c.footer)}</div>` : ''}
    </div>
  </div>`;
}
