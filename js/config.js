/**
 * Configuration globale de la plateforme "Cagnotte Sortie Plage 🏖️"
 */
const CONFIG = {
    // Nom et sous-titre de l'événement
    APP_NAME: "Cagnotte Sortie Plage 🏖️",
    APP_TAGLINE: "Tous ensemble pour une journée inoubliable 🌊",

    // Date cible de la sortie (Samedi 7 Novembre 2026)
    EVENT_DATE: "2026-11-07T08:30:00",

    // Lieu et détails de la sortie
    EVENT_LOCATION: "Plage Privée d'Assinie - KM 12 (Espace paillotes & transats)",
    EVENT_MEETING_INFO: "Samedi 7 Novembre 2026 à 08h30 (Cocody Angré 7e Tranche)",
    EVENT_INCLUSIONS: "Transport VIP aller-retour\nBarbecue & grillades au feu de bois 🥩\nBoissons fraîches à volonté 🍹\nAccès plage privée, transats & musique 🎵",
    EVENT_THEME: "Journée Détente, Barbecue & Baignade 🍹",

    // Objectif individuel par participant (en FCFA)
    TARGET_PER_PARTICIPANT: 25000,

    // Devise d'affichage
    CURRENCY: "FCFA",

    // Configuration Supabase (Base de données temps réel en production)
    SUPABASE_URL: "https://hhunphucbcrzzygupyme.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhodW5waHVjYmNyenp5Z3VweW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyOTI5MTksImV4cCI6MjEwNjg2ODkxOX0.WmT9MfEIetkMJYqtOwL-NNMgmCANcxYsJ6jJhnwhlkE",

    // Mode démo / simulation actif si hors-ligne
    USE_LOCAL_STORAGE_FALLBACK: true,

    // Lien direct Wave de paiement (Marchand / Cagnotte)
    WAVE_PAYMENT_URL: "https://pay.wave.com/m/M_ci_NvjJ2LHyaS6A/c/ci/",

    // Endpoint backend Wave (Netlify Serverless Function ou Backend Custom)
    WAVE_API_ENDPOINT: "/.netlify/functions/create-wave-payment",

    // Données initiales des 11 participants
    INITIAL_PARTICIPANTS: [
        { id: "1", nom: "Albak", telephone: "", objectif: 25000 },
        { id: "2", nom: "AKB", telephone: "", objectif: 25000 },
        { id: "3", nom: "Amporio", telephone: "", objectif: 25000 },
        { id: "4", nom: "Arthur", telephone: "", objectif: 25000 },
        { id: "5", nom: "Basil", telephone: "", objectif: 25000 },
        { id: "6", nom: "David", telephone: "", objectif: 25000 },
        { id: "7", nom: "Papos", telephone: "", objectif: 25000 },
        { id: "8", nom: "Stephane", telephone: "", objectif: 25000 },
        { id: "9", nom: "Tony", telephone: "", objectif: 25000 },
        { id: "10", nom: "Tresor", telephone: "", objectif: 25000 },
        { id: "11", nom: "Yves", telephone: "", objectif: 25000 }
    ],

    INITIAL_PAYMENTS: [],

    // Image de couverture de l'événement (Hero Banner)
    HERO_IMAGE: "assets/images/hero-beach.jpg",

    // Image de la bannière du bas (Citation d'ambiance)
    BOTTOM_BANNER_IMAGE: "assets/images/friends-beach.jpg",

    // Charger les réglages sauvegardés par l'admin s'ils existent
    loadSavedConfig() {
        try {
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('cagnotte_plage_config_v1');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.APP_NAME) this.APP_NAME = parsed.APP_NAME;
                    if (parsed.APP_TAGLINE) this.APP_TAGLINE = parsed.APP_TAGLINE;
                    if (parsed.EVENT_LOCATION) this.EVENT_LOCATION = parsed.EVENT_LOCATION;
                    if (parsed.EVENT_MEETING_INFO) this.EVENT_MEETING_INFO = parsed.EVENT_MEETING_INFO;
                    if (parsed.EVENT_INCLUSIONS) this.EVENT_INCLUSIONS = parsed.EVENT_INCLUSIONS;
                    if (parsed.EVENT_DATE) this.EVENT_DATE = parsed.EVENT_DATE;
                    if (parsed.TARGET_PER_PARTICIPANT) this.TARGET_PER_PARTICIPANT = Number(parsed.TARGET_PER_PARTICIPANT);
                    if (parsed.TOTAL_CUSTOM_GOAL) this.TOTAL_CUSTOM_GOAL = Number(parsed.TOTAL_CUSTOM_GOAL);
                    if (parsed.WAVE_PAYMENT_URL) this.WAVE_PAYMENT_URL = parsed.WAVE_PAYMENT_URL;
                    if (parsed.HERO_IMAGE) this.HERO_IMAGE = parsed.HERO_IMAGE;
                    if (parsed.BOTTOM_BANNER_IMAGE) this.BOTTOM_BANNER_IMAGE = parsed.BOTTOM_BANNER_IMAGE;
                }
            }
        } catch (e) {
            console.warn("Impossible de charger la config personnalisée", e);
        }
    }
};

// Initialisation immédiate de la config
CONFIG.loadSavedConfig();

// Formateur de devise FCFA standardisé
function formatMoney(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) amount = 0;
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + " " + CONFIG.CURRENCY;
}

// Formateur de date/heure convivial
function formatDateTime(isoString) {
    if (!isoString) return "-";
    const date = new Date(isoString);
    const now = new Date();

    // Comparaison jour
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
        return `Aujourd'hui à ${timeStr}`;
    } else if (isYesterday) {
        return `Hier à ${timeStr}`;
    } else {
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ` à ${timeStr}`;
    }
}
