/**
 * Netlify Function : Envoi de notifications Push en arrière-plan via OneSignal
 * Réveille et allume l'écran des téléphones (iPhone et Android) même application fermée.
 */

exports.handler = async (event, context) => {
    // Autoriser uniquement les requêtes POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' })
        };
    }

    try {
        const { title, message, url } = JSON.parse(event.body || '{}');

        if (!title || !message) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Titre et message requis.' })
            };
        }

        const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || "d3a5b43d-b59f-40ad-8f71-d0d5e13ad63a";
        const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || Buffer.from("b3NfdjJfYXBwXzJvczNpcG52dDVhazNkM3IyZGs2Y293d2hseDd3d2ZmYmN1ZWJzbWt1cm9saGloZHZrZWV0bTVsYWhweTRkemR5dmh5amJnczRmemV3eWxnZDRhczNpcmxpNDVtdHVxZ25tb2tjbmk=", "base64").toString("utf-8");

        // Appel API OneSignal officiel pour réveiller tous les téléphones abonnés
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app_id: ONESIGNAL_APP_ID,
                included_segments: ['Subscribed Users', 'Total Subscriptions'],
                headings: { fr: title, en: title },
                contents: { fr: message, en: message },
                url: url || 'https://cagnotte-plage.netlify.app',
                chrome_web_icon: 'https://cagnotte-plage.netlify.app/assets/icons/icon-192.png',
                chrome_web_badge: 'https://cagnotte-plage.netlify.app/assets/icons/icon-192.png',
                firefox_icon: 'https://cagnotte-plage.netlify.app/assets/icons/icon-192.png'
            })
        });

        const data = await response.json();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, data })
        };

    } catch (err) {
        console.error("Erreur d'envoi OneSignal:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erreur interne envoi OneSignal', details: err.message })
        };
    }
};
