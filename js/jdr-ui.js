/* Merveille d'Un'Gara — barre de navigation commune et outils d'interface.
   À charger après js/jdr-supabase.js.
   Usage dans une page :  const me = await jdrPage('bibliotheque', { requireLogin: true });  */

const JDR_PAGES = [
  { id: 'accueil',      href: 'index.html',            label: 'Accueil' },
  { id: 'fiche',        href: 'fiche-personnage.html', label: 'Fiche' },
  { id: 'deck',         href: 'deck.html',             label: 'Deck' },
  { id: 'bibliotheque', href: 'bibliotheque.html',     label: 'Bibliothèque' },
  { id: 'editeur',      href: 'editeur-cartes.html',   label: 'Éditeur de cartes', editorOnly: true },
  { id: 'groupes',      href: 'editeur-groupes.html',  label: 'Actions de groupe', editorOnly: true },
  { id: 'campagnes',    href: 'campagnes.html',        label: 'Campagnes' }
];

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
  const links = JDR_PAGES.filter(p => !p.editorOnly || JDR_IS_EDITOR)
    .map(p => `<a href="${p.href}" class="${p.id === current ? 'on' : ''}">${p.label}</a>`).join('');
  bar.innerHTML = `<a class="brand" href="index.html">Merveille d'Un'Gara</a><nav aria-label="Navigation">${links}</nav><div class="who" id="jdr-who"></div>`;
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

// Charge toutes les cartes : renvoie { list, byId }
async function jdrLoadCards(){
  const { data, error } = await jdrSb.from('cards').select('id,name,data,updated_at').order('name');
  if(error) throw error;
  const list = data.map(r => Object.assign(jdrNormalizeCard(r.data), { id: r.id, name: r.name, updated_at: r.updated_at }));
  return { list, byId: Object.fromEntries(list.map(c => [c.id, c])) };
}

// Charge les tableaux d'action de groupe : renvoie { list, byId }
async function jdrLoadGroups(){
  const { data, error } = await jdrSb.from('creature_groups').select('id,name,data').order('name');
  if(error) throw error;
  const list = data.map(r => Object.assign(jdrNormalizeGroup(r.data), { id: r.id, name: r.name }));
  return { list, byId: Object.fromEntries(list.map(g => [g.id, g])) };
}
