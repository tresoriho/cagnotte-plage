/**
 * Backend Serverless Function : Initialisation d'une session Wave Checkout
 * Déployable sur Netlify, Vercel ou tout serveur Node.js
 */

exports.handler = async (event, context) => {
    // Autoriser uniquement la méthode POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' })
        };
    }

    try {
        const { participant_id, montant, success_url, error_url } = JSON.parse(event.body || '{}');

        // Validation stricte des données reçues
        if (!participant_id || !montant || isNaN(montant) || Number(montant) <= 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Données de paiement invalides (participant_id et montant positif requis).' })
            };
        }

        const WAVE_API_KEY = process.env.WAVE_SECRET_API_KEY;
        if (!WAVE_API_KEY) {
            console.warn("WAVE_SECRET_API_KEY manquant. Mode simulation actif.");
            return {
                statusCode: 200,
                body: JSON.stringify({
                    simulation: true,
                    checkout_url: "#simulated-wave-checkout",
                    wave_launch_url: "#simulated-wave-app",
                    id: `wave_sim_${Date.now()}`
                })
            };
        }

        // Appel à l'API Wave Checkout officielle
        // Doc Wave API : https://docs.wave.com/
        const waveResponse = await fetch('https://api.wave.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WAVE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: String(montant),
                currency: 'XOF',
                client_reference: `CAGNOTTE_PLAGE_${participant_id}_${Date.now()}`,
                success_url: success_url || 'https://votre-site.com/?payment=success',
                error_url: error_url || 'https://votre-site.com/?payment=error',
                metadata: {
                    participant_id: participant_id,
                    event_name: 'Cagnotte Sortie Plage 🏖️'
                }
            })
        });

        const waveData = await waveResponse.json();

        if (!waveResponse.ok) {
            console.error('Erreur retournée par Wave API:', waveData);
            return {
                statusCode: waveResponse.status,
                body: JSON.stringify({ error: 'Erreur lors de la création de la session Wave Checkout.', details: waveData })
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                checkout_url: waveData.wave_launch_url || waveData.checkout_url,
                wave_launch_url: waveData.wave_launch_url,
                id: waveData.id
            })
        };

    } catch (err) {
        console.error('Erreur interne create-wave-payment:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur interne du serveur lors de la création du paiement Wave.' })
        };
    }
};
