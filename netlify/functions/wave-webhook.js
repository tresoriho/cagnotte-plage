/**
 * Backend Webhook Handler : Réception et validation des paiements confirmés par Wave
 * Enregistre la transaction dans Supabase en toute sécurité avec la clé Service Role.
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Méthode non autorisée' };
    }

    try {
        const rawBody = event.body || '';
        const waveSignature = event.headers['wave-signature'] || event.headers['Wave-Signature'];
        const WEBHOOK_SECRET = process.env.WAVE_WEBHOOK_SECRET;

        // 1. Vérification de la signature Wave (Sécurité critique)
        if (WEBHOOK_SECRET && waveSignature) {
            const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
            const digest = hmac.update(rawBody).digest('hex');

            if (digest !== waveSignature) {
                console.error("Signature Wave invalide ! Tentative suspecte rejetée.");
                return { statusCode: 401, body: JSON.stringify({ error: 'Signature Wave non valide.' }) };
            }
        }

        const payload = JSON.parse(rawBody);
        console.log("Événement Wave Webhook reçu :", payload.type);

        // On traite uniquement les paiements complétés avec succès
        if (payload.type === 'checkout.session.completed') {
            const session = payload.data;
            const participantId = session.metadata?.participant_id;
            const amount = Number(session.amount);
            const transactionId = session.transaction_id || session.id;

            if (!participantId || !amount) {
                return { statusCode: 400, body: 'Métadonnées participant ou montant manquantes' };
            }

            // 2. Connexion à Supabase avec la clé Service Role sécurisée
            const SUPABASE_URL = process.env.SUPABASE_URL;
            const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
                console.error("Variables Supabase manquantes dans l'environnement serveur.");
                return { statusCode: 500, body: 'Configuration serveur Supabase incomplète' };
            }

            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

            // 3. Enregistrement sécurisé du paiement avec protection contre les doublons (idempotence)
            const { data, error } = await supabase
                .from('paiements')
                .insert([{
                    participant_id: participantId,
                    montant: amount,
                    wave_transaction_id: transactionId,
                    wave_checkout_id: session.id,
                    statut: 'completed',
                    paid_at: new Date().toISOString()
                }])
                .select();

            if (error) {
                // Si la transaction existe déjà, on retourne 200 pour acquitter Wave
                if (error.code === '23505') {
                    console.log("Transaction déjà enregistrée (idempotence respectée) :", transactionId);
                    return { statusCode: 200, body: JSON.stringify({ received: true, message: 'Already processed' }) };
                }
                console.error("Erreur insertion Supabase :", error);
                return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
            }

            console.log("✅ Paiement Wave validé et enregistré pour le participant :", participantId);
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ received: true, payment_id: data[0]?.id })
            };
        }

        return { statusCode: 200, body: JSON.stringify({ received: true }) };

    } catch (err) {
        console.error("Erreur serveur wave-webhook:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur interne de traitement du webhook.' })
        };
    }
};
