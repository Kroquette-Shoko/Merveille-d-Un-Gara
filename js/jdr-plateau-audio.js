/* ============================================================
   Merveille d'Un'Gara — AUDIO du plateau (26/10/2026) : 3 pistes
   1. Musique  (lecteur YouTube)   2. Ambiance (lecteur YouTube)   3. Bruitages (fichiers envoyés par le MJ)
   Chargé par plateau.html après ses variables (me, isGM, CAMP, camp, el, toast, send, saveCamp, upload…).

   Synchronisation : le MJ écrit l'état dans campaigns.audio (voir sql/jdr-013-audio.sql) ;
   chaque navigateur le reçoit en temps réel et règle son lecteur : même vidéo, même position
   (position = pos + temps écoulé depuis « at » si la piste joue). Un joueur qui arrive en cours de route
   est donc calé sur les autres.
   Bruitages : message temps réel « sfx » → chacun joue le fichier.
   Volume entendu = volume du MJ × volume personnel (réglé par chacun, gardé dans son navigateur).
   Les navigateurs bloquent le son avant le premier clic dans la page : un bandeau le rappelle.
   ============================================================ */
const AU = (() => {
  const TRACKS = { music: 'Musique', ambiance: 'Ambiance' };
  const yt = { music: null, ambiance: null }; const ready = { music: false, ambiance: false };
  let audio = {};                 // copie de campaigns.audio
  let unlocked = false;           // premier clic fait
  let local = { music: 100, ambiance: 100, sfx: 100, mute: false };
  try{ Object.assign(local, JSON.parse(localStorage.getItem('jdr-vol') || '{}')); }catch(e){}
  const saveLocal = () => { try{ localStorage.setItem('jdr-vol', JSON.stringify(local)); }catch(e){} };
  const st = k => Object.assign({ src: null, title: '', playing: false, pos: 0, at: 0, loop: true, vol: 70 }, audio[k] || {});
  const posNow = s => s.playing ? s.pos + Math.max(0, (Date.now() - (s.at || Date.now())) / 1000) : s.pos;
  const volOf = k => local.mute ? 0 : Math.round(st(k).vol * local[k] / 100);

  // Lien YouTube → { v: vidéo, list: playlist }
  function parseYT(url){
    url = String(url || '').trim(); if(!url) return null;
    if(/^[\w-]{11}$/.test(url)) return { v: url };
    let u; try{ u = new URL(url); }catch(e){ return null; }
    if(!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(u.hostname)) return null;
    const list = u.searchParams.get('list') || null;
    let v = u.searchParams.get('v');
    if(!v && /youtu\.be$/.test(u.hostname)) v = u.pathname.slice(1, 12);
    const m = u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/); if(!v && m) v = m[2];
    if(v && !/^[\w-]{11}$/.test(v)) v = null;
    return v || list ? { v: v || null, list } : null;
  }

  /* ---------- Lecteurs YouTube (cachés hors écran) ---------- */
  function initYT(){
    const box = el('div', { id: 'ytbox', 'aria-hidden': 'true', style: 'position:fixed;left:-10000px;top:0;width:220px;height:130px;overflow:hidden' },
      el('div', { id: 'yt-music' }), el('div', { id: 'yt-ambiance' }));
    document.body.append(box);
    window.onYouTubeIframeAPIReady = () => {
      Object.keys(TRACKS).forEach(k => {
        yt[k] = new YT.Player('yt-' + k, { width: 200, height: 113, playerVars: { autoplay: 0, controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
          events: { onReady: () => { ready[k] = true; apply(k, true); },
            onStateChange: e => onYTState(k, e.data),
            onError: () => { if(isGM) toast(`${TRACKS[k]} : vidéo illisible (lien incorrect ou lecture intégrée interdite par son auteur).`); } } });
      });
    };
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => toast('Lecteur YouTube indisponible (connexion ?)'); document.head.append(s);
  }
  function onYTState(k, state){
    const s = st(k);
    if(state === 0 && s.loop && s.src && !s.src.list){ yt[k].seekTo(0, true); yt[k].playVideo(); }    // fin : on reboucle
    if(state === 1 && isGM && !s.title){                                                                 // le MJ récupère le titre
      const t = (yt[k].getVideoData && yt[k].getVideoData().title) || ''; if(t) setTrack(k, { title: t }, true); }
    if(state === 1 || state === 2) renderBanner();
  }
  const loaded = { music: null, ambiance: null };   // source chargée dans chaque lecteur (clé texte)
  function apply(k, force){
    if(!ready[k] || !yt[k]) return; const s = st(k), p = yt[k];
    p.setVolume(volOf(k));
    if(!s.src){ if(loaded[k]){ p.stopVideo(); loaded[k] = null; } renderBanner(); return; }
    const key = JSON.stringify(s.src);
    const want = posNow(s);
    if(loaded[k] !== key){
      loaded[k] = key;
      if(s.src.list){ const o = { list: s.src.list, listType: 'playlist', index: 0, startSeconds: Math.floor(want) }; if(s.playing && unlocked) p.loadPlaylist(o); else p.cuePlaylist(o); p.setLoop(!!s.loop); }
      else { const o = { videoId: s.src.v, startSeconds: Math.floor(want) }; if(s.playing && unlocked) p.loadVideoById(o); else p.cueVideoById(o); }
      renderBanner(); return;
    }
    if(s.src.list) p.setLoop(!!s.loop);
    const state = p.getPlayerState ? p.getPlayerState() : -1;
    if(s.playing && unlocked){
      const t = p.getCurrentTime ? p.getCurrentTime() : 0;
      if(!s.src.list && (Math.abs(t - want) > 3 || force) && state !== 3) p.seekTo(want, true);
      if(state !== 1 && state !== 3) p.playVideo();
    } else if(state === 1 || state === 3) p.pauseVideo();
    renderBanner();
  }
  function applyAll(force){ Object.keys(TRACKS).forEach(k => apply(k, force)); }

  // Premier clic dans la page : le son est autorisé
  document.addEventListener('pointerdown', () => { if(unlocked) return; unlocked = true; applyAll(true); renderBanner(); }, { capture: true });
  function renderBanner(){
    let b = document.getElementById('au-unlock');
    const need = !unlocked && Object.keys(TRACKS).some(k => st(k).playing && st(k).src);
    if(!need){ if(b) b.remove(); return; }
    if(!b){ b = el('button', { type: 'button', id: 'au-unlock', class: 'au-unlock', text: '🔇 Clique ici pour activer le son de la table' }); document.body.append(b); }
  }

  /* ---------- Changements (MJ) ---------- */
  let saveT = null;
  async function commit(now){
    clearTimeout(saveT);
    const go = async () => { await saveCamp({ audio: structuredClone(audio) }); };
    if(now) return go(); saveT = setTimeout(go, 400);
  }
  function setTrack(k, patch, quiet){
    audio = Object.assign({}, audio, { [k]: Object.assign(st(k), patch) });
    apply(k, !quiet); render(); commit(!quiet);
  }
  function launch(k, url){
    const src = parseYT(url); if(!src){ toast('Lien YouTube non reconnu (ex. https://www.youtube.com/watch?v=…).'); return false; }
    setTrack(k, { src, title: '', playing: true, pos: 0, at: Date.now() }); return true;
  }
  function toggle(k){
    const s = st(k); if(!s.src) return;
    if(s.playing){ const t = yt[k] && yt[k].getCurrentTime ? yt[k].getCurrentTime() : posNow(s); setTrack(k, { playing: false, pos: t, at: Date.now() }); }
    else setTrack(k, { playing: true, at: Date.now() });
  }
  function stop(k){ setTrack(k, { playing: false, pos: 0, at: Date.now() }); }

  /* ---------- Bruitages ---------- */
  let sounds = []; let soundsLoaded = false;
  async function loadSounds(){
    if(!isGM || soundsLoaded) return; soundsLoaded = true;
    const { data, error } = await jdrSb.storage.from('jdr-plateau').list(`${CAMP}/sons`, { limit: 300, sortBy: { column: 'name', order: 'asc' } });
    if(error){ toast(jdrErrorText(error)); return; }
    sounds = (data || []).filter(f => f.name && !f.name.startsWith('.')).map(f => ({ path: `${CAMP}/sons/${f.name}`, name: f.name.replace(/-[a-z0-9]+\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      url: jdrSb.storage.from('jdr-plateau').getPublicUrl(`${CAMP}/sons/${f.name}`).data.publicUrl }));
    render();
  }
  async function uploadSounds(files){
    for(const f of files){
      if(!/^audio\//.test(f.type)){ toast(`« ${f.name} » n’est pas un fichier son.`); continue; }
      if(f.size > 20 * 1024 * 1024){ toast(`« ${f.name} » est trop lourd (20 Mo maximum).`); continue; }
      const ext = (f.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
      const base = f.name.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'son';
      const path = `${CAMP}/sons/${base}-${Date.now().toString(36)}.${ext}`;
      toast(`Envoi de « ${f.name} »…`);
      const { error } = await jdrSb.storage.from('jdr-plateau').upload(path, f, { contentType: f.type, upsert: false });
      if(error){ toast(jdrErrorText(error)); continue; }
      sounds.push({ path, name: base.replace(/[-_]+/g, ' '), url: jdrSb.storage.from('jdr-plateau').getPublicUrl(path).data.publicUrl });
    }
    sounds.sort((a, b) => a.name.localeCompare(b.name, 'fr')); render();
  }
  function playSfx(p){
    if(!unlocked || local.mute) return;
    const a = new Audio(p.url); a.volume = Math.max(0, Math.min(1, (Number(p.vol ?? 100) / 100) * (local.sfx / 100))); a.play().catch(() => {});
  }
  function fireSfx(s){ const p = { url: s.url, name: s.name, vol: audio.sfxVol ?? 80 }; playSfx(p); send('sfx', p); }

  /* ---------- Onglet Musique ---------- */
  function slider(val, on, label){ const r = el('input', { type: 'range', min: '0', max: '100', value: val, 'aria-label': label }); r.addEventListener('input', () => on(Number(r.value))); return r; }
  function trackBlock(k){
    const s = st(k); const box = el('div', { class: 'au-t' });
    box.append(el('h3', { text: TRACKS[k] }));
    const now = s.src ? (s.title || (s.src.list ? 'Playlist YouTube' : 'Vidéo YouTube')) : 'Rien en cours';
    box.append(el('div', { class: 'au-now' }, el('span', { class: 'au-dot' + (s.playing && s.src ? ' on' : '') }), el('span', { text: now })));
    if(isGM){
      const inp = el('input', { placeholder: 'Lien YouTube (vidéo ou playlist)', 'aria-label': `Lien YouTube pour ${TRACKS[k]}` });
      const go = () => { if(launch(k, inp.value)) inp.value = ''; };
      inp.addEventListener('keydown', e => { if(e.key === 'Enter') go(); });
      box.append(el('div', { class: 'au-row' }, inp, el('button', { type: 'button', class: 'primary', text: 'Lancer', onclick: go })));
      const loop = el('input', { type: 'checkbox' }); loop.checked = s.loop !== false; loop.addEventListener('change', () => setTrack(k, { loop: loop.checked }, true));
      box.append(el('div', { class: 'au-row' },
        el('button', { type: 'button', text: s.playing ? '⏸ Pause' : '▶ Lecture', disabled: !s.src, onclick: () => toggle(k) }),
        el('button', { type: 'button', text: '⏹', title: 'Stop (revient au début)', 'aria-label': 'Stop', disabled: !s.src, onclick: () => stop(k) }),
        el('label', { class: 'chk' }, loop, document.createTextNode(' En boucle'))));
      box.append(el('label', { class: 'f' }, document.createTextNode('Volume pour toute la table'), slider(s.vol, v => { audio = Object.assign({}, audio, { [k]: Object.assign(st(k), { vol: v }) }); apply(k); commit(); }, `Volume ${TRACKS[k]} pour la table`)));
      // favoris
      const fav = (audio.saved || []).filter(x => x.kind === k);
      const list = el('div', { class: 'au-fav' }, ...fav.map(f => el('div', { class: 'au-fi' },
        el('button', { type: 'button', class: 'au-fn', text: f.name, title: 'Lancer ' + f.name, onclick: () => launch(k, f.url) }),
        el('button', { type: 'button', text: '✕', title: 'Retirer des favoris', 'aria-label': 'Retirer ' + f.name, onclick: () => { audio = Object.assign({}, audio, { saved: (audio.saved || []).filter(x => x !== f) }); render(); commit(true); } }))));
      if(s.src) list.append(el('button', { type: 'button', class: 'au-add', text: '☆ Garder dans les favoris', onclick: () => {
        const url = s.src.v ? `https://www.youtube.com/watch?v=${s.src.v}${s.src.list ? '&list=' + s.src.list : ''}` : `https://www.youtube.com/playlist?list=${s.src.list}`;
        const name = (s.title || TRACKS[k]).slice(0, 60);
        if(!(audio.saved || []).some(x => x.url === url && x.kind === k)){ audio = Object.assign({}, audio, { saved: [...(audio.saved || []), { kind: k, name, url }] }); render(); commit(true); } } }));
      box.append(el('div', { class: 'au-sub', text: 'Favoris' }), list.childNodes.length ? list : el('p', { class: 'hint', style: 'margin:0', text: 'Aucun favori.' }));
    }
    return box;
  }
  function render(){
    const P = document.getElementById('au-pane'); if(!P) return;
    const kids = [trackBlock('music'), trackBlock('ambiance')];
    // bruitages
    const sb = el('div', { class: 'au-t' }, el('h3', { text: 'Bruitages' }));
    if(isGM){
      const f = el('input', { type: 'file', accept: 'audio/*', multiple: true, hidden: true });
      f.addEventListener('change', () => { uploadSounds([...f.files]); f.value = ''; });
      const dz = el('label', { class: 'dropz', text: 'Dépose tes sons ici (mp3, ogg, wav), ou clique pour les choisir' }, f);
      ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { if([...e.dataTransfer.types].includes('Files')){ e.preventDefault(); dz.classList.add('over'); } }));
      ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, () => dz.classList.remove('over')));
      dz.addEventListener('drop', e => { e.preventDefault(); uploadSounds([...e.dataTransfer.files]); });
      sb.append(dz, el('div', { class: 'au-sfx' }, ...sounds.map(s => { const b = el('button', { type: 'button', text: '▶ ' + s.name, title: 'Jouer chez tout le monde (clic droit : supprimer)', onclick: () => fireSfx(s) });
          b.addEventListener('contextmenu', async e => { e.preventDefault();
            if(b.dataset.arm !== '1'){ b.dataset.arm = '1'; b.textContent = 'Supprimer ? (clic droit)'; setTimeout(() => { b.dataset.arm = ''; b.textContent = '▶ ' + s.name; }, 3000); return; }
            const { error } = await jdrSb.storage.from('jdr-plateau').remove([s.path]); if(error){ toast(jdrErrorText(error)); return; } sounds = sounds.filter(x => x !== s); render(); });
          return b; })),
        sounds.length ? el('p', { class: 'hint', style: 'margin:0', text: 'Clic : joue chez tout le monde · clic droit deux fois : supprimer.' }) : el('p', { class: 'hint', style: 'margin:0', text: 'Aucun son pour l’instant.' }),
        el('label', { class: 'f' }, document.createTextNode('Volume des bruitages pour la table'), slider(audio.sfxVol ?? 80, v => { audio = Object.assign({}, audio, { sfxVol: v }); commit(); }, 'Volume des bruitages')));
    } else sb.append(el('p', { class: 'hint', style: 'margin:0', text: 'Le MJ déclenche les bruitages ; tu les entends selon ton volume ci-dessous.' }));
    kids.push(sb);
    // volumes personnels
    const me2 = el('div', { class: 'au-t' }, el('h3', { text: 'Mon volume' }));
    [['music', 'Musique'], ['ambiance', 'Ambiance'], ['sfx', 'Bruitages']].forEach(([k, l]) => me2.append(el('label', { class: 'f' }, document.createTextNode(l), slider(local[k], v => { local[k] = v; saveLocal(); applyAll(); }, 'Mon volume ' + l))));
    const mute = el('input', { type: 'checkbox' }); mute.checked = local.mute; mute.addEventListener('change', () => { local.mute = mute.checked; saveLocal(); applyAll(); });
    me2.append(el('label', { class: 'chk' }, mute, document.createTextNode(' Tout couper (seulement chez moi)')));
    kids.push(me2);
    P.replaceChildren(...kids);
  }

  /* ---------- Entrées ---------- */
  function init(){ audio = Object.assign({}, (camp && camp.audio) || {}); initYT(); render(); renderBanner(); }
  function onCamp(a){
    if(isGM) return;   // le MJ est le seul à écrire : on ignore l'écho de ses propres enregistrements
    const before = JSON.stringify(audio); audio = Object.assign({}, a || {});
    if(JSON.stringify(audio) !== before){ applyAll(); render(); }
  }
  return { init, onCamp, render, playSfx, loadSounds, parseYT, get state(){ return audio; } };
})();
