/* Merveille d'Un'Gara — barre de navigation commune et outils d'interface.
   À charger après js/jdr-supabase.js.
   Usage dans une page :  const me = await jdrPage('bibliotheque', { requireLogin: true });  */

/* ---------- Organisation du site (26/10/2026) ----------
   Le menu n'a que 2 entrées : JOUEUR et MAÎTRE DU JEU.
   Chaque espace a une rangée d'onglets secondaires (groupes) affichée sous le menu.
   - pages : fichiers qui appartiennent à l'onglet (pour l'allumer), match : condition sur l'adresse (?type=…)
   - editorOnly : visible seulement pour le compte éditeur
   La fiche et le deck font partie de l'espace Joueur sans être des onglets :
   la fiche s'ouvre depuis « Mes personnages », le deck depuis le bouton de la fiche. */
const JDR_SECTIONS = [
  { id: 'joueur', label: 'Joueur', href: 'joueur.html',
    pages: ['joueur.html', 'creation-personnage.html', 'fiche-personnage.html', 'deck.html'],
    groups: [ { label: '', tabs: [
      { label: 'Mes personnages',      href: 'joueur.html',              pages: ['joueur.html', 'fiche-personnage.html', 'deck.html'] },
      { label: 'Créer un personnage',  href: 'creation-personnage.html', pages: ['creation-personnage.html'] },
      { label: 'Rejoindre une partie', href: 'joueur.html#rejoindre',    pages: [] }
    ] } ] },
  { id: 'mj', label: 'Maître du jeu', href: 'mj.html',
    pages: ['mj.html', 'campagnes.html', 'editeur-cartes.html', 'editeur-groupes.html', 'equipement.html', 'origines.html', 'mots-cles.html', 'bibliotheque.html'],
    groups: [
      { label: 'Parties', tabs: [
        { label: 'Héberger et gérer', href: 'campagnes.html', pages: ['campagnes.html'] }
      ] },
      { label: 'Éditeur', editorOnly: true, tabs: [
        { label: 'Cartes',            href: 'editeur-cartes.html',               pages: ['editeur-cartes.html'], match: q => q.get('type') !== 'Créature' },
        { label: 'Bestiaire',         href: 'editeur-cartes.html?type=Créature', pages: ['editeur-cartes.html'], match: q => q.get('type') === 'Créature' },
        { label: 'Actions de groupe', href: 'editeur-groupes.html',              pages: ['editeur-groupes.html'] },
        { label: 'Équipement',        href: 'equipement.html',                   pages: ['equipement.html'] },
        { label: 'Origines',          href: 'origines.html',                     pages: ['origines.html'] },
        { label: 'Mots-clés',         href: 'mots-cles.html',                    pages: ['mots-cles.html'] },
        { label: 'Bibliothèque',      href: 'bibliotheque.html',                 pages: ['bibliotheque.html'] }
      ] }
    ] }
];
function jdrCurrentFile(){ return location.pathname.split('/').pop() || 'index.html'; }

let JDR_IS_EDITOR = false;

const $id = id => document.getElementById(id);
function jdrEsc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function jdrToast(msg){
  let t = $id('jdr-toast');
  if(!t){ t = document.createElement('div'); t.id = 'jdr-toast'; t.className = 'toast'; t.hidden = true; document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2200);
}

// Pseudo du compte : lu dans le profil Rimd'Orël (lecture seule, aucune écriture dans "public")
async function jdrUsername(user){
  if(!jdrSb || !user) return '';
  try{
    const { data } = await jdrSb.schema('public').from('profiles').select('username').eq('id', user.id).maybeSingle();
    if(data && data.username) return data.username;
  }catch(e){}
  return (user.email || '').split('@')[0];
}

async function jdrRenderNav(current, me){
  const bar = document.createElement('header');
  bar.className = 'jdr-nav';
  // « current » (ancien identifiant de page) n'est plus utilisé : on se repère au nom du fichier
  const file = jdrCurrentFile(), q = new URLSearchParams(location.search);
  const sec = JDR_SECTIONS.find(s => s.pages.includes(file)) || null;
  const links = JDR_SECTIONS.map(s => `<a href="${s.href}" class="${sec === s ? 'on' : ''}"${sec === s ? ' aria-current="true"' : ''}>${s.label}</a>`).join('');
  bar.innerHTML = `<a class="brand" href="index.html">Merveille d'Un'Gara</a><nav aria-label="Navigation">${links}</nav><div class="who" id="jdr-who"></div>`;
  // Onglets secondaires de l'espace courant
  if(sec){
    const isOn = t => t.pages.includes(file) && (!t.match || t.match(q));
    const groups = sec.groups.filter(g => !g.editorOnly || JDR_IS_EDITOR).map(g => `<div class="sg">${g.label ? `<span class="sgl">${g.label}</span>` : ''}${
      g.tabs.map(t => `<a href="${t.href}" class="${isOn(t) ? 'on' : ''}"${isOn(t) ? ' aria-current="page"' : ''}>${t.label}</a>`).join('')}</div>`).join('');
    const sub = document.createElement('nav'); sub.className = 'jdr-subnav'; sub.setAttribute('aria-label', 'Pages de l’espace ' + sec.label);
    sub.innerHTML = groups; bar.append(sub);
  }
  document.body.prepend(bar);
  const who = $id('jdr-who');
  if(me){
    const name = await jdrUsername(me);
    who.innerHTML = `<span>${jdrEsc(name)}</span><button class="ghost" type="button" id="jdr-logout">Déconnexion</button>`;
    $id('jdr-logout').addEventListener('click', async () => { await jdrSb.auth.signOut(); location.href = 'connexion.html'; });
  } else {
    who.innerHTML = `<a href="connexion.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}">Se connecter</a>`;
  }
}

// À appeler au chargement de chaque page
async function jdrPage(current, opts = {}){
  const me = await jdrCurrentUser();
  if(me && jdrSb){
    try{ const { data } = await jdrSb.rpc('is_editor'); JDR_IS_EDITOR = data === true; }catch(e){}
  }
  await jdrRenderNav(current, me);
  if(opts.requireLogin && !me){
    location.href = 'connexion.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
    return null;
  }
  return me;
}

// Charge toutes les cartes : renvoie { list, byId } (charge aussi les mots-clés pour leur affichage)
async function jdrLoadCards(){
  const [{ data, error }] = await Promise.all([
    jdrSb.from('cards').select('id,name,data,updated_at').order('name'),
    jdrLoadKeywords().catch(err => { console.warn('[jdr] mots-clés non chargés :', err); })
  ]);
  if(error) throw error;
  const list = data.map(r => Object.assign(jdrNormalizeCard(r.data), { id: r.id, name: r.name, updated_at: r.updated_at }));
  const byId = Object.fromEntries(list.map(c => [c.id, c]));
  window.JDR_CARD_INDEX = byId;   // sert à l'affichage des pactes (couleur / nom à jour de la carte récompense)
  return { list, byId };
}

// Mots-clés (table jdr.keywords) → remplit JDR_KW, utilisé par l'affichage des cartes
async function jdrLoadKeywords(){
  const { data, error } = await jdrSb.from('keywords').select('id,name,data').order('name');
  if(error) throw error;
  const list = data.map(jdrNormalizeKeyword);
  JDR_KW = Object.fromEntries(list.map(k => [k.id, k]));
  return { list, byId: JDR_KW };
}

// Équipement (table jdr.items) : renvoie { list, byId } — nécessite js/jdr-items.js
async function jdrLoadItems(){
  const { data, error } = await jdrSb.from('items').select('id,name,data,updated_at').order('name');
  if(error) throw error;
  const list = data.map(r => Object.assign(jdrNormalizeItem(r), { updated_at: r.updated_at }));
  return { list, byId: Object.fromEntries(list.map(i => [i.id, i])) };
}

// Origines (table jdr.origins) : renvoie { list, byId } — nécessite js/jdr-origins.js
async function jdrLoadOrigins(){
  const { data, error } = await jdrSb.from('origins').select('id,name,data,updated_at').order('name');
  if(error) throw error;
  const list = data.map(r => Object.assign(jdrNormalizeOrigin(r), { updated_at: r.updated_at }));
  const byId = Object.fromEntries(list.map(o => [o.id, o]));
  // Magie des spécialisations (utilisée par jdrCanCastSpells : cartes Sortilège autorisées ou non)
  JDR_SPEC_MAGIC = Object.fromEntries(list.filter(o => o.kind === 'specialisation').map(o => [jdrNorm(o.name), !!o.magic]));
  jdrApplyOrigins(list);   // listes « Qui peut jouer cette carte » + couleurs des classes
  return { list, byId };
}

// Charge les tableaux d'action de groupe : renvoie { list, byId }
async function jdrLoadGroups(){
  const { data, error } = await jdrSb.from('creature_groups').select('id,name,data').order('name');
  if(error) throw error;
  const list = data.map(r => Object.assign(jdrNormalizeGroup(r.data), { id: r.id, name: r.name }));
  return { list, byId: Object.fromEntries(list.map(g => [g.id, g])) };
}


/* ---------- Duplication / identifiants (éditeurs) ----------
   Une copie reçoit un nom et un identifiant libres : « Nom (copie) », « Nom (copie 2) »… et nom_copie, nom_copie_2…
   À l'enregistrement d'un nouvel élément, si l'identifiant est déjà pris, on prend le suivant libre (_2, _3…)
   au lieu de bloquer : avant, l'enregistrement était refusé avec un message en haut de page qu'on ne voyait pas. */
function jdrUniqueId(base, taken){
  const set = new Set(taken); base = String(base || 'element').slice(0, 64);
  if(!set.has(base)) return base;
  for(let n = 2; ; n++){ const suf = '_' + n; const id = base.slice(0, 64 - suf.length) + suf; if(!set.has(id)) return id; }
}
function jdrCopyName(name, names){
  const set = new Set((names || []).map(jdrNorm));
  const root = String(name || '').replace(/\s*\(copie(?: \d+)?\)\s*$/, '');
  let n = 1, nm = root + ' (copie)';
  while(set.has(jdrNorm(nm))){ n++; nm = `${root} (copie ${n})`; }
  return nm;
}
// Affiche aussi le message à côté du bouton Enregistrer (barre collante) : #status-bar
function jdrStatusBar(t, bad){
  const s = document.getElementById('status-bar'); if(!s) return;
  s.textContent = t || ''; s.className = 'status' + (bad ? ' bad' : t ? ' good' : '');
}
