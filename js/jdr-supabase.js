// Connexion Supabase du JDR Merveille d'Un'Gara.
// Même projet Supabase que Rimd'Orël, mais toutes les requêtes vont dans le schéma "jdr".
// La clé ci-dessous est la clé publique (publishable) : elle peut être visible dans le code.
// Les règles d'accès (RLS) dans la base protègent les données.

const JDR_SUPABASE_URL = 'https://jzjhfxaibqqhzgkdyrdn.supabase.co';
const JDR_SUPABASE_KEY = 'sb_publishable_7CVKlpSiuI9Z4iaWTX1kGQ_jEXArIU8';

// null si la bibliothèque Supabase n'a pas pu être chargée (ex. page ouverte hors ligne)
const jdrSb = (typeof supabase !== 'undefined')
  ? supabase.createClient(JDR_SUPABASE_URL, JDR_SUPABASE_KEY, { db: { schema: 'jdr' } })
  : null;

// Traduit les erreurs techniques en messages compréhensibles
function jdrErrorText(error){
  const msg = (error && (error.message || error.toString())) || 'Erreur inconnue';
  if (/schema must be one of|Invalid schema|PGRST106/i.test(msg))
    return "Le schéma « jdr » n'est pas encore autorisé dans l'API Supabase (Project Settings → Data API → Exposed schemas).";
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou mot de passe incorrect.';
  if (/Email not confirmed/i.test(msg)) return "Adresse e-mail pas encore confirmée : ouvre le lien reçu par e-mail.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Connexion impossible : vérifie ta connexion internet.';
  if (/Code de campagne invalide/i.test(msg)) return 'Code de campagne invalide.';
  if (/Personnage introuvable/i.test(msg)) return "Ce personnage n'existe pas ou ne t'appartient pas.";
  return msg;
}

async function jdrCurrentUser(){
  if (!jdrSb) return null;
  const { data } = await jdrSb.auth.getSession();
  return data && data.session ? data.session.user : null;
}
