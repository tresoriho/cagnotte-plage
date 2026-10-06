/**
 * Backend Webhook Handler : Réception et validation des paiements confirmés par Wave
 * Enregistre la transaction dans Supabase en toute sécurité avec la clé Service Role.
 */

const crypto = require('crypto');

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

            // 3. Enregistrement sécurisé du paiement via l'API REST Supabase (PostgREST)
            //    avec protection contre les doublons (idempotence)
            const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/paiements`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify([{
                    participant_id: participantId,
                    montant: amount,
                    wave_transaction_id: transactionId,
                    wave_checkout_id: session.id,
                    statut: 'completed',
                    paid_at: new Date().toISOString()
                }])
            });

            const result = await response.json().catch(() => null);
            const data = response.ok ? result : null;
            const error = response.ok ? null : (result || { message: `HTTP ${response.status}` });

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
