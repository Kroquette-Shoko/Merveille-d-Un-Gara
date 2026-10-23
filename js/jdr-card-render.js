/* Merveille d'Un'Gara — rendu d'une carte (modèle D validé le 23/10/2026, styles dans css/jdr-ui.css).
   jdrCardHTML(card, { sheet, size: 'small' | '', locked })
   - sheet (facultatif) : la fiche du personnage. Si elle est fournie, les formules
     comme "2+corps" sont calculées avec ses caractéristiques : « 6 (2 + Corps) ».

   Disposition :
   - colonne de couleur à gauche : valeur (écusson), mana (sorts), composantes (sorts), persistance
   - bandeau du haut : nom, puis « Super-types · Type — Sous-type »
   - illustration cadrée, capacités, encadré « Spécial · <nom> » si la carte a une capacité spéciale
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
function jdrPrettyAbility(ab, sheet){
  const copy = Object.assign({}, ab, { effects: (ab.effects || []).map(e => Object.assign({}, e, { amount: jdrPrettyAmount(e.amount, sheet) })) });
  return jdrAbilityText(copy);
}

// { main: [lignes], special: [lignes] }
function jdrCardTextLines(card, sheet){
  const main = (card.abilities || []).map(ab => jdrPrettyAbility(ab, sheet)).filter(Boolean);
  if(card.text) main.push(card.text);
  const special = card.special && card.special.enabled ? [jdrPrettyAbility(card.special, sheet)].filter(Boolean) : [];
  return { main, special };
}

// Illustration cadrée (même calcul que Rimd'Orël) : l'image remplit le cadre (« cover »),
// puis déplacement en % du cadre, rotation, zoom et miroirs autour du centre.
// Appelée quand l'illustration est chargée : donne à l'image son vrai rapport largeur/hauteur
// pour qu'elle soit placée exactement comme dans le studio de l'éditeur (voir .artin img.sized).
function jdrArtSized(img){
  if(!img.naturalWidth || !img.naturalHeight) return;
  img.style.setProperty('--r', img.naturalWidth / img.naturalHeight);
  img.classList.add('sized');
}

function jdrArtHTML(c, esc){
  if(!c.image_url) return `<div class="art ph"></div>`;
  const a = c.art || {};
  const n = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
  const sc = Math.max(1, n(a.scale, 100)) / 100;
  const tr = `translate(${n(a.ox,0)}%,${n(a.oy,0)}%) rotate(${n(a.rot,0)}deg) scale(${(a.fx ? -1 : 1) * sc},${(a.fy ? -1 : 1) * sc})`;
  return `<div class="art"><div class="artin" style="transform:${tr}"><img src="${esc(c.image_url)}" alt="" draggable="false" loading="lazy" onload="jdrArtSized(this)"></div></div>`;
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
  const typeLine = [c.type, c.subtype].filter(Boolean).join(' — ');
  const sup = c.supertypes.join(', ');
  const comps = ['sonore','gestuelle','materielle'].filter(k => c.components[k]);
  const hasMana = c.mana !== null && c.mana !== '' && c.mana !== undefined;
  const { main, special } = jdrCardTextLines(c, opts.sheet);
  const art = jdrArtHTML(c, esc);
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
      ${special.length ? `<div class="spec"><div class="st">Spécial${c.special.name ? ' · ' + esc(c.special.name) : ''}</div>${special.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}
      ${c.footer ? `<div class="foot">${esc(c.footer)}</div>` : ''}
    </div>
  </div>`;
}

/* ============================================================
   FICHE DE CRÉATURE (type « Créature ») — maquette validée le 23/10/2026
   jdrCreatureHTML(card, { groups: {id: groupe}, width: '520px', wounds, armorCur, armorMagicCur })
   - groups : tableaux d'action de groupe (jdrLoadGroups) pour afficher celui de la créature
   - wounds / armorCur / armorMagicCur : état de suivi (sinon : intact, armure pleine)
   ============================================================ */
const JDR_CREATURE_COLOR = '#5B4636';
function jdrCreatureHTML(card, opts = {}){
  const c = jdrNormalizeCard(card);
  const cr = jdrNormalizeCreature(c.creature);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const dash = v => (String(v ?? '').trim() ? esc(v) : '—');
  const none = v => (String(v ?? '').trim() ? esc(v) : '<span style="color:#8A8478">aucune</span>');
  const kind = ['Créature', [cr.category, cr.family].filter(Boolean).join(' — ')].filter(Boolean).join(' · ');
  const grp = opts.groups && cr.group ? opts.groups[cr.group] : null;
  const g = grp ? jdrNormalizeGroup(grp) : null;
  const size = jdrDieSize(cr.groupDie);
  const wounds = Math.max(0, Math.min(cr.hearts * 6, Number(opts.wounds) || 0));

  const att = [['Principale', cr.attacks.primary], ['Secondaire', cr.attacks.secondary], ['Tertiaire', cr.attacks.tertiary]]
    .map(([k, v]) => `<div class="kv ${String(v || '').trim() ? '' : 'off'}"><b>${k}</b><span>${dash(v)}</span></div>`).join('');
  const abil = cr.abilities.filter(a => (a.name || a.text)).map(a =>
    `<div class="bx"><div class="bt"><span>Capacité${a.name ? ' · ' + esc(a.name) : ''}</span></div><p>${esc(a.text)}</p></div>`).join('');
  const group = g
    ? `<div class="bx"><div class="bt"><span>Action de groupe · ${esc(g.name)}</span><small>lancer le dé de groupe (${esc(cr.groupDie)})</small></div>
        ${g.rows.map((r, i) => `<div class="gr ${i < size ? '' : 'off'}"><i>${i + 1}</i><span>${dash(r.effect)}</span><em>${esc(r.bonus)}</em></div>`).join('')}
        ${size < 6 ? `<p class="gnote">Grisé : résultat accessible seulement si une créature du groupe a un dé plus grand.</p>` : ''}</div>`
    : `<div class="bx"><div class="bt"><span>Action de groupe</span></div><p style="color:#8A8478">Aucun tableau attribué.</p></div>`;
  const hearts = Array.from({ length: cr.hearts }, (_, h) =>
    `<div class="heart">${Array.from({ length: 6 }, (_, i) => `<span class="${h * 6 + i < wounds ? 'on' : ''}"></span>`).join('')}</div>`).join('');
  const bar = (name, max, cur, color) => {
    cur = Math.max(0, Math.min(max, cur ?? max));
    return `<div class="bar" style="--bc:${color}"><div class="bh"><b>${name}</b><strong>${max ? `${cur} / ${max}` : ''}</strong></div>
      ${max ? `<div class="cells">${Array.from({ length: max }, (_, i) => `<span class="${i < cur ? 'on' : ''}"></span>`).join('')}</div>` : '<span class="none">Aucune</span>'}</div>`;
  };

  return `<div class="jcrea ${opts.locked ? 'locked' : ''}" data-card="${esc(c.id)}" title="${esc(c.name)}" style="--cc:${JDR_CREATURE_COLOR};${opts.width ? `--cw:${esc(opts.width)};` : ''}">
    <div class="ch">
      <div style="flex:1;min-width:0"><div class="k">${esc(kind)}</div><div class="n">${esc(c.name || 'Sans nom')}</div></div>
      <div class="badges">
        <div class="bdg"><div class="lvl">${esc(cr.level)}</div><small>Niveau</small></div>
        <div class="bdg"><div class="die">${esc(cr.groupDie)}</div><small>Dé de groupe</small></div>
      </div>
    </div>
    <div class="cb">
      <div class="c1">${jdrArtHTML(c, esc)}
        <div class="def"><div><b>${esc(cr.res)}</b><span>Résistance</span></div><div><b>${esc(cr.opres)}</b><span>OpRes</span></div></div>
      </div>
      <div class="c2">
        <div class="stats"><div><b>${esc(cr.corps)}</b>Corps</div><div><b>${esc(cr.esprit)}</b>Esprit</div><div><b>${esc(cr.charme)}</b>Charme</div></div>
        <div class="pills"><span><b>Déplacement</b> ${dash(cr.movement)}</span><span><b>Vitesse</b> ${dash(cr.speed)}</span></div>
        <div><div class="sh">Attaques</div>${att}</div>
        <div><div class="sh">Résistances</div>
          <div class="kv w"><b>Immunité aux afflictions</b><span>${none(cr.immuneAfflictions)}</span></div>
          <div class="kv w"><b>Immunité aux dégâts</b><span>${none(cr.immuneDamage)}</span></div>
          <div class="kv w"><b>Faiblesse aux dégâts</b><span>${none(cr.weakDamage)}</span></div>
        </div>
      </div>
      <div class="c3">${abil}${group}</div>
    </div>
    <div class="trk">
      <div><span class="tt">Blessures</span> <span style="color:#6B655A;font-size:calc(12 * var(--u))">${wounds} / ${cr.hearts * 6}</span><div class="hearts">${hearts}</div></div>
      <div class="bars">${bar('Armure', Number(cr.armor) || 0, opts.armorCur, '#0f6b72')}${bar('Armure magique', Number(cr.armorMagic) || 0, opts.armorMagicCur, '#a5761d')}</div>
    </div>
  </div>`;
}

// Point d'entrée commun : une créature est dessinée avec sa fiche, le reste avec la carte
const jdrCardHTMLClassic = jdrCardHTML;
jdrCardHTML = function(card, opts = {}){
  if(card && card.type === 'Créature') return jdrCreatureHTML(card, opts);
  return jdrCardHTMLClassic(card, opts);
};
