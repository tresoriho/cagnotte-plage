/**
 * Module Supabase & Gestionnaire de données temps réel
 * Gère à la fois la connexion réelle Supabase et le moteur de synchronisation local/démo.
 */
class DataService {
    constructor() {
        this.supabaseClient = null;
        this.isRealSupabase = false;
        this.listeners = [];
        this.STORAGE_KEY_PARTICIPANTS = 'cagnotte_plage_participants_v3';
        this.STORAGE_KEY_PAYMENTS = 'cagnotte_plage_payments_v3';
        
        this.init();
    }

    init() {
        // Vérifie si Supabase est configuré avec de vraies clés
        if (CONFIG.SUPABASE_URL && 
            CONFIG.SUPABASE_URL !== "https://votre-projet.supabase.co" && 
            CONFIG.SUPABASE_ANON_KEY && 
            CONFIG.SUPABASE_ANON_KEY !== "votre-cle-anon-publique-supabase" &&
            typeof window.supabase !== 'undefined') {
            try {
                this.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
                this.isRealSupabase = true;
                console.log("🌊 Connecté à Supabase Realtime !");
                this.setupSupabaseRealtime();
            } catch (err) {
                console.warn("Erreur d'initialisation Supabase, utilisation du fallback démo:", err);
                this.initFallbackStorage();
            }
        } else {
            // Mode Démo / Stockage local réactif
            console.log("🌴 Mode Démo Réactif initialisé (Données locales synchronisées)");
            this.initFallbackStorage();
        }
    }

    initFallbackStorage() {
        if (!localStorage.getItem(this.STORAGE_KEY_PARTICIPANTS)) {
            localStorage.setItem(this.STORAGE_KEY_PARTICIPANTS, JSON.stringify(CONFIG.INITIAL_PARTICIPANTS));
        }
        if (!localStorage.getItem(this.STORAGE_KEY_PAYMENTS)) {
            localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(CONFIG.INITIAL_PAYMENTS));
        }
    }

    // Dédupliquer strictement les participants (évite les doublons)
    deduplicateParticipants(list) {
        if (!list || !Array.isArray(list)) return CONFIG.INITIAL_PARTICIPANTS;
        const seen = new Set();
        const unique = [];

        for (const p of list) {
            if (!p || !p.nom) continue;
            const norm = p.nom.trim().toLowerCase();
            if (!seen.has(norm)) {
                seen.add(norm);
                unique.push(p);
            }
        }
        return unique.length > 0 ? unique : CONFIG.INITIAL_PARTICIPANTS;
    }

    // Récupérer tous les participants (100% uniques, sans doublon)
    async getParticipants() {
        if (this.isRealSupabase && this.supabaseClient) {
            const { data, error } = await this.supabaseClient
                .from('participants')
                .select('*')
                .order('created_at', { ascending: true });
            if (error || !data || data.length === 0) {
                return this.getLocalParticipants();
            }
            const cleanList = this.deduplicateParticipants(data);
            localStorage.setItem(this.STORAGE_KEY_PARTICIPANTS, JSON.stringify(cleanList));
            return cleanList;
        }
        return this.getLocalParticipants();
    }

    getLocalParticipants() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY_PARTICIPANTS);
            const list = raw ? JSON.parse(raw) : CONFIG.INITIAL_PARTICIPANTS;
            return this.deduplicateParticipants(list);
        } catch (e) {
            return this.deduplicateParticipants(CONFIG.INITIAL_PARTICIPANTS);
        }
    }

    // Normalisation stricte et universelle des statuts : 'pending', 'confirmed', 'cancelled'
    normalizePayment(p) {
        if (!p) return p;
        let st = (p.statut || p.status || 'pending').toLowerCase().trim();
        if (st === 'completed' || st === 'valide' || st === 'validé' || st === 'success') {
            st = 'confirmed';
        } else if (st === 'en_attente' || st === 'attente' || st === 'waiting') {
            st = 'pending';
        } else if (st === 'refused' || st === 'refuse' || st === 'annule' || st === 'annulé') {
            st = 'cancelled';
        }
        p.statut = st;
        return p;
    }

    // Récupérer tous les paiements (validés et en attente)
    async getPayments() {
        if (this.isRealSupabase && this.supabaseClient) {
            const { data, error } = await this.supabaseClient
                .from('paiements')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.error("Erreur chargement paiements Supabase:", error);
                return this.getLocalPayments();
            }
            if (data && Array.isArray(data)) {
                const normalized = data.map(p => this.normalizePayment(p));
                localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(normalized));
                return normalized;
            }
            return this.getLocalPayments();
        }
        return this.getLocalPayments();
    }

    getLocalPayments() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY_PAYMENTS);
            const list = raw ? JSON.parse(raw) : CONFIG.INITIAL_PAYMENTS;
            const normalized = (list || []).map(p => this.normalizePayment(p));
            // Tri du plus récent au plus ancien
            return normalized.sort((a, b) => new Date(b.created_at || b.paid_at) - new Date(a.created_at || a.paid_at));
        } catch (e) {
            return CONFIG.INITIAL_PAYMENTS;
        }
    }

    // Enregistrer un nouveau paiement (statut 'pending' par défaut pour validation admin)
    async addPayment(paymentPayload) {
        const nowIso = new Date().toISOString();
        const newPayment = {
            id: 'pay-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            participant_id: String(paymentPayload.participant_id),
            montant: Number(paymentPayload.montant),
            wave_transaction_id: paymentPayload.wave_transaction_id || `WAVE_TX_${Math.floor(100000 + Math.random() * 900000)}`,
            wave_checkout_id: paymentPayload.wave_checkout_id || null,
            statut: 'pending', // Strictement 'pending'
            created_at: nowIso,
            updated_at: nowIso,
            paid_at: null,
            validated_at: null,
            cancelled_at: null,
            validated_by: null,
            cancel_reason: null
        };

        // 1. Sauvegarde locale immédiate
        this.savePaymentLocally(newPayment);

        let finalPayment = newPayment;

        // 2. Insertion dans Supabase (colonnes standardisées)
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                const supabaseRow = {
                    id: newPayment.id,
                    participant_id: String(paymentPayload.participant_id),
                    montant: Number(paymentPayload.montant),
                    wave_transaction_id: newPayment.wave_transaction_id,
                    wave_checkout_id: newPayment.wave_checkout_id,
                    statut: 'pending',
                    created_at: nowIso,
                    paid_at: null
                };

                const { data, error } = await this.supabaseClient
                    .from('paiements')
                    .insert([supabaseRow])
                    .select();
                if (error) {
                    console.error("Erreur insertion paiement Supabase:", error);
                } else if (data && data[0]) {
                    finalPayment = this.normalizePayment(data[0]);
                }
            } catch (err) {
                console.warn("Exception insert Supabase:", err);
            }
        }

        // 3. Déclencher l'événement Realtime
        this.notifyListeners({
            eventType: 'INSERT',
            new: finalPayment
        });

        return finalPayment;
    }

    // Valider un paiement en attente par l'administrateur (Protection Concurrence / Anti-double validation)
    async validatePayment(id, validatedBy = 'Administrateur') {
        const nowIso = new Date().toISOString();
        let payments = this.getLocalPayments();
        let targetPayment = payments.find(p => String(p.id) === String(id));

        // 1. Vérification côté Supabase si disponible pour éviter double validation concurrente
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                const { data: remoteData, error: fetchErr } = await this.supabaseClient
                    .from('paiements')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();

                if (!fetchErr && remoteData) {
                    const st = (remoteData.statut || '').toLowerCase().trim();
                    if (st === 'confirmed' || st === 'completed') {
                        return { success: false, code: 'ALREADY_CONFIRMED', message: 'Ce versement a déjà été validé.' };
                    }
                    if (st === 'cancelled' || st === 'refused') {
                        return { success: false, code: 'ALREADY_CANCELLED', message: 'Ce versement a déjà été annulé.' };
                    }
                }
            } catch (e) {
                console.warn("Vérification distante Supabase impossible:", e);
            }
        } else if (targetPayment) {
            const st = (targetPayment.statut || '').toLowerCase().trim();
            if (st === 'confirmed' || st === 'completed') {
                return { success: false, code: 'ALREADY_CONFIRMED', message: 'Ce versement a déjà été validé.' };
            }
            if (st === 'cancelled' || st === 'refused') {
                return { success: false, code: 'ALREADY_CANCELLED', message: 'Ce versement a déjà été annulé.' };
            }
        }

        // 2. Mise à jour de l'objet de versement
        payments = payments.map(p => {
            if (String(p.id) === String(id)) {
                p.statut = 'confirmed';
                p.paid_at = nowIso;
                p.validated_at = nowIso;
                p.validated_by = validatedBy;
                p.updated_at = nowIso;
                targetPayment = p;
            }
            return p;
        });
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(payments));

        // 3. Mise à jour en base Supabase (statut 'confirmed' avec compatibilité 'completed')
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                const { error: errConfirmed } = await this.supabaseClient
                    .from('paiements')
                    .update({ 
                        statut: 'confirmed', 
                        paid_at: nowIso
                    })
                    .eq('id', id);

                if (errConfirmed) {
                    await this.supabaseClient
                        .from('paiements')
                        .update({ 
                            statut: 'completed', 
                            paid_at: nowIso
                        })
                        .eq('id', id);
                }
            } catch (e) {
                console.warn("Erreur update Supabase validatePayment:", e);
            }
        }

        // 4. Notification des écouteurs
        this.notifyListeners({
            eventType: 'VALIDATE_PAYMENT',
            payment: targetPayment
        });

        // 5. Envoi notification push OneSignal sur écran verrouillé
        const participant = this.getLocalParticipants().find(p => String(p.id) === String(targetPayment?.participant_id));
        const pName = participant ? participant.nom : 'Un membre';
        const pMontant = targetPayment?.montant || 0;
        this.sendRemotePush(`🌊 Versement validé !`, `${pName} a cotisé ${formatMoney(pMontant)} pour la sortie plage 🏖️`);

        return { success: true, payment: targetPayment };
    }

    // Annuler ou rejeter un versement en attente (avec motif)
    async cancelPayment(id, reason = 'Paiement non reçu') {
        const nowIso = new Date().toISOString();
        let payments = this.getLocalPayments();
        let targetPayment = payments.find(p => String(p.id) === String(id));

        // 1. Vérification côté Supabase pour éviter double traitement concurrent
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                const { data: remoteData, error: fetchErr } = await this.supabaseClient
                    .from('paiements')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();

                if (!fetchErr && remoteData) {
                    const st = (remoteData.statut || '').toLowerCase().trim();
                    if (st === 'confirmed' || st === 'completed') {
                        return { success: false, code: 'ALREADY_CONFIRMED', message: 'Ce versement a déjà été validé et ne peut plus être annulé.' };
                    }
                    if (st === 'cancelled' || st === 'refused') {
                        return { success: false, code: 'ALREADY_CANCELLED', message: 'Ce versement a déjà été annulé.' };
                    }
                }
            } catch (e) {
                console.warn("Vérification distante Supabase impossible:", e);
            }
        } else if (targetPayment) {
            const st = (targetPayment.statut || '').toLowerCase().trim();
            if (st === 'confirmed' || st === 'completed') {
                return { success: false, code: 'ALREADY_CONFIRMED', message: 'Ce versement a déjà été validé et ne peut plus être annulé.' };
            }
            if (st === 'cancelled' || st === 'refused') {
                return { success: false, code: 'ALREADY_CANCELLED', message: 'Ce versement a déjà été annulé.' };
            }
        }

        // 2. Mise à jour locale
        payments = payments.map(p => {
            if (String(p.id) === String(id)) {
                p.statut = 'cancelled';
                p.cancelled_at = nowIso;
                p.cancel_reason = reason;
                p.updated_at = nowIso;
                targetPayment = p;
            }
            return p;
        });
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(payments));

        // 3. Mise à jour Supabase
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                await this.supabaseClient
                    .from('paiements')
                    .update({ 
                        statut: 'cancelled'
                    })
                    .eq('id', id);
            } catch (e) {
                console.warn("Erreur cancel Supabase:", e);
            }
        }

        // 4. Notification des écouteurs
        this.notifyListeners({
            eventType: 'CANCEL_PAYMENT',
            payment: targetPayment
        });

        return { success: true, payment: targetPayment };
    }

    savePaymentLocally(payment) {
        let currentPayments = this.getLocalPayments();
        const existingIdx = currentPayments.findIndex(p => String(p.id) === String(payment.id));
        if (existingIdx >= 0) {
            currentPayments[existingIdx] = payment;
        } else {
            currentPayments.unshift(payment);
        }
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(currentPayments));
    }

    // Enregistrer / Remplacer tous les participants (100% uniques)
    async saveParticipants(list) {
        const cleanList = this.deduplicateParticipants(list);
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                await this.supabaseClient
                    .from('participants')
                    .upsert(cleanList);
            } catch (e) {
                console.warn("Erreur upsert participants Supabase:", e);
            }
        }
        localStorage.setItem(this.STORAGE_KEY_PARTICIPANTS, JSON.stringify(cleanList));
        this.notifyListeners({ eventType: 'UPDATE_PARTICIPANTS', participants: cleanList });
        return cleanList;
    }

    // Ajouter un participant
    async addParticipant(participantData) {
        const list = this.getLocalParticipants();
        const newP = {
            id: 'p-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            nom: participantData.nom.trim(),
            telephone: participantData.telephone ? participantData.telephone.trim() : '',
            objectif: Number(participantData.objectif || CONFIG.TARGET_PER_PARTICIPANT)
        };

        if (this.isRealSupabase && this.supabaseClient) {
            const { data, error } = await this.supabaseClient
                .from('participants')
                .insert([newP])
                .select();
            if (!error && data && data.length > 0) {
                list.push(data[0]);
                localStorage.setItem(this.STORAGE_KEY_PARTICIPANTS, JSON.stringify(list));
                this.notifyListeners({ eventType: 'INSERT_PARTICIPANT', participant: data[0] });
                return data[0];
            }
        }

        list.push(newP);
        localStorage.setItem(this.STORAGE_KEY_PARTICIPANTS, JSON.stringify(list));
        this.notifyListeners({ eventType: 'INSERT_PARTICIPANT', participant: newP });
        return newP;
    }

    // Supprimer un participant
    async deleteParticipant(id) {
        let list = this.getLocalParticipants();
        list = list.filter(p => String(p.id) !== String(id));
        localStorage.setItem(this.STORAGE_KEY_PARTICIPANTS, JSON.stringify(list));

        // Supprimer aussi ses paiements
        let payments = this.getLocalPayments();
        payments = payments.filter(p => String(p.participant_id) !== String(id));
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(payments));

        if (this.isRealSupabase && this.supabaseClient) {
            await this.supabaseClient.from('participants').delete().eq('id', id);
        }

        this.notifyListeners({ eventType: 'DELETE_PARTICIPANT', id });
        return true;
    }

    // Supprimer un versement individuel
    async deletePayment(id) {
        let payments = this.getLocalPayments();
        payments = payments.filter(p => String(p.id) !== String(id));
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(payments));

        if (this.isRealSupabase && this.supabaseClient) {
            await this.supabaseClient.from('paiements').delete().eq('id', id);
        }

        this.notifyListeners({ eventType: 'DELETE_PAYMENT', id });
        return true;
    }

    // Réinitialiser les versements à 0 FCFA (Remise à 0 du Dashboard)
    async clearAllPayments() {
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify([]));
        if (this.isRealSupabase && this.supabaseClient) {
            await this.supabaseClient.from('paiements').delete().neq('id', 'keep_empty');
        }
        this.notifyListeners({ eventType: 'CLEAR_PAYMENTS', timestamp: Date.now() });
        return true;
    }

    // Sauvegarder la configuration générale de l'événement (Sync Locale + Supabase DB + Realtime Broadcast)
    async saveConfig(customConfig) {
        localStorage.setItem('cagnotte_plage_config_v1', JSON.stringify(customConfig));
        CONFIG.loadSavedConfig();
        this.notifyListeners({ eventType: 'CONFIG_UPDATED', config: customConfig });

        // 1. Enregistrement en base Supabase pour mise à jour permanente chez tous les membres
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                const upsertData = {
                    id: 'main_event',
                    app_name: customConfig.APP_NAME,
                    app_tagline: customConfig.APP_TAGLINE,
                    event_location: customConfig.EVENT_LOCATION,
                    event_meeting_info: customConfig.EVENT_MEETING_INFO,
                    event_inclusions: customConfig.EVENT_INCLUSIONS,
                    event_date: customConfig.EVENT_DATE,
                    target_per_participant: Number(customConfig.TARGET_PER_PARTICIPANT),
                    total_custom_goal: Number(customConfig.TOTAL_CUSTOM_GOAL),
                    wave_payment_url: customConfig.WAVE_PAYMENT_URL,
                    hero_image: customConfig.HERO_IMAGE,
                    bottom_banner_image: customConfig.BOTTOM_BANNER_IMAGE,
                    updated_at: new Date().toISOString()
                };

                await this.supabaseClient
                    .from('config_event')
                    .upsert([upsertData]);
                console.log("✅ Configuration synchronisée avec Supabase pour tous les membres !");
            } catch (err) {
                console.warn("Erreur sauvegarde config_event Supabase:", err);
            }
        }

        // 2. Diffusion instantanée par WebSocket à tous les onglets et téléphones connectés
        if (this.broadcastChannelSupabase) {
            try {
                await this.broadcastChannelSupabase.send({
                    type: 'broadcast',
                    event: 'cagnotte_event',
                    payload: {
                        eventType: 'CONFIG_UPDATED',
                        payload: customConfig
                    }
                });
            } catch (e) {}
        }
    }

    // Récupérer la configuration enregistrée sur Supabase
    async fetchRemoteConfig() {
        if (!this.isRealSupabase || !this.supabaseClient) return;
        try {
            const { data, error } = await this.supabaseClient
                .from('config_event')
                .select('*')
                .eq('id', 'main_event')
                .maybeSingle();

            if (!error && data) {
                this.applyRemoteConfig(data, false);
            }
        } catch (e) {
            console.warn("Table config_event en attente d'initialisation SQL.");
        }
    }

    // Appliquer la configuration distante et rafraîchir l'application
    applyRemoteConfig(row, triggerNotify = true) {
        if (!row) return;
        const mapped = {
            APP_NAME: row.app_name || CONFIG.APP_NAME,
            APP_TAGLINE: row.app_tagline || CONFIG.APP_TAGLINE,
            EVENT_LOCATION: row.event_location || CONFIG.EVENT_LOCATION,
            EVENT_MEETING_INFO: row.event_meeting_info || CONFIG.EVENT_MEETING_INFO,
            EVENT_INCLUSIONS: row.event_inclusions || CONFIG.EVENT_INCLUSIONS,
            EVENT_DATE: row.event_date || CONFIG.EVENT_DATE,
            TARGET_PER_PARTICIPANT: Number(row.target_per_participant) || CONFIG.TARGET_PER_PARTICIPANT,
            TOTAL_CUSTOM_GOAL: Number(row.total_custom_goal) || CONFIG.TOTAL_CUSTOM_GOAL,
            WAVE_PAYMENT_URL: row.wave_payment_url || CONFIG.WAVE_PAYMENT_URL,
            HERO_IMAGE: row.hero_image || CONFIG.HERO_IMAGE,
            BOTTOM_BANNER_IMAGE: row.bottom_banner_image || CONFIG.BOTTOM_BANNER_IMAGE
        };

        Object.assign(CONFIG, mapped);
        localStorage.setItem('cagnotte_plage_config_v1', JSON.stringify(mapped));

        if (triggerNotify) {
            this.notifyListeners({ eventType: 'CONFIG_UPDATED', config: mapped });
        }
    }

    // Réinitialiser les données pour la démo
    resetDemoData() {
        localStorage.setItem(this.STORAGE_KEY_PARTICIPANTS, JSON.stringify(CONFIG.INITIAL_PARTICIPANTS));
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(CONFIG.INITIAL_PAYMENTS));
        
        this.notifyListeners({
            eventType: 'RESET',
            timestamp: Date.now()
        });
    }

    // Écouteur Supabase Realtime & Canal Broadcast
    setupSupabaseRealtime() {
        // Charger la configuration distante
        this.fetchRemoteConfig();

        // 1. Écouteur sur les modifications en base (paiements, participants, annonces, config)
        this.supabaseClient
            .channel('public:cagnotte_tables')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'paiements' }, (payload) => {
                console.log('⚡ Événement Realtime Supabase reçu (table paiements):', payload);
                this.notifyListeners({
                    eventType: payload.eventType || 'UPDATE',
                    new: payload.new,
                    old: payload.old
                });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, (payload) => {
                console.log('⚡ Événement Realtime Supabase reçu (table participants):', payload);
                this.notifyListeners({
                    eventType: 'UPDATE_PARTICIPANTS',
                    new: payload.new
                });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'annonces' }, (payload) => {
                console.log('📢 Annonce en direct reçue de Supabase (table annonces):', payload);
                if (window.notificationManager && payload.new) {
                    window.notificationManager.handleBroadcastMessage({
                        eventType: 'ANNOUNCEMENT',
                        payload: {
                            title: payload.new.titre,
                            message: payload.new.message
                        }
                    });
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'config_event' }, (payload) => {
                console.log('⚙️ Réglages modifiés par l\'admin reçus de Supabase:', payload);
                if (payload.new) {
                    this.applyRemoteConfig(payload.new, true);
                }
            })
            .subscribe();

        // 2. Canal Broadcast pour notifications instantanées entre tous les téléphones/clients
        this.broadcastChannelSupabase = this.supabaseClient.channel('cagnotte_broadcast_room', {
            config: {
                broadcast: { ack: true }
            }
        });
        this.broadcastChannelSupabase
            .on('broadcast', { event: 'cagnotte_event' }, ({ payload }) => {
                console.log('📢 Notification Broadcast reçue de Supabase:', payload);
                if (window.notificationManager && payload) {
                    window.notificationManager.handleBroadcastMessage(payload);
                }
            })
            .subscribe((status, err) => {
                console.log('📡 Statut connexion temps réel Supabase:', status, err || '');
            });
    }

    // Diffuser une annonce à tous les téléphones connectés (Realtime + Push OneSignal)
    async sendBroadcastAnnouncement(title, message) {
        const eventData = {
            eventType: 'ANNOUNCEMENT',
            payload: { title, message }
        };

        // 1. Diffusion instantanée par WebSocket Realtime Broadcast
        if (this.broadcastChannelSupabase) {
            try {
                await this.broadcastChannelSupabase.send({
                    type: 'broadcast',
                    event: 'cagnotte_event',
                    payload: eventData
                });
                console.log("✅ Message broadcast envoyé via Supabase");
            } catch (err) {
                console.warn("Erreur envoi broadcast Supabase:", err);
            }
        }

        // 2. Insertion en base Supabase pour réplication Postgres Realtime à tous les téléphones
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                await this.supabaseClient.from('annonces').insert([{
                    titre: title,
                    message: message
                }]);
            } catch (err) {
                console.warn("Table annonces optionnelle:", err);
            }
        }

        // 3. Envoi de la notification PUSH OneSignal en arrière-plan (réveil de l'écran verrouillé)
        await this.sendRemotePush(title, message);
    }

    // Déclenchement de la notification Push globale en arrière-plan (OneSignal Serverless Function)
    async sendRemotePush(title, message, url = window.location.origin) {
        try {
            await fetch('/.netlify/functions/send-push-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    message: message,
                    url: url
                })
            });
            console.log("📲 Notification Push OneSignal envoyée avec succès.");
        } catch (e) {
            console.warn("Échec envoi Push OneSignal distant:", e);
        }
    }

    // Système d'abonnement pour l'UI
    onRealtimeUpdate(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(payload) {
        this.listeners.forEach(cb => {
            try {
                cb(payload);
            } catch (e) {
                console.error("Erreur dans le callback realtime:", e);
            }
        });

        // Relai vers NotificationManager (BroadcastChannel local + Notifications Natives)
        if (window.notificationManager && payload) {
            if (payload.eventType === 'INSERT' && payload.new) {
                const participants = this.getLocalParticipants();
                const p = participants.find(part => String(part.id) === String(payload.new.participant_id)) || { nom: 'Un ami' };
                const isPending = payload.new.statut === 'pending';
                const eventType = isPending ? 'PENDING_PAYMENT' : 'NEW_PAYMENT';
                const eventData = {
                    eventType: eventType,
                    payload: {
                        participantName: p.nom,
                        montant: payload.new.montant,
                        currentTotal: 0,
                        targetAmount: CONFIG.TARGET_PER_PARTICIPANT
                    }
                };
                window.notificationManager.broadcastEvent(eventType, eventData.payload);
                if (this.broadcastChannelSupabase) {
                    this.broadcastChannelSupabase.send({
                        type: 'broadcast',
                        event: 'cagnotte_event',
                        payload: eventData
                    });
                }
            } else if (payload.eventType === 'VALIDATE_PAYMENT' && payload.payment) {
                const participants = this.getLocalParticipants();
                const p = participants.find(part => String(part.id) === String(payload.payment.participant_id)) || { nom: 'Un ami' };
                const eventData = {
                    eventType: 'VALIDATE_PAYMENT',
                    payload: {
                        participantName: p.nom,
                        montant: payload.payment.montant,
                        paymentId: payload.payment.id
                    }
                };
                window.notificationManager.broadcastEvent('VALIDATE_PAYMENT', eventData.payload);
                if (this.broadcastChannelSupabase) {
                    this.broadcastChannelSupabase.send({
                        type: 'broadcast',
                        event: 'cagnotte_event',
                        payload: eventData
                    });
                }
            } else if (payload.eventType === 'CANCEL_PAYMENT' && payload.payment) {
                const participants = this.getLocalParticipants();
                const p = participants.find(part => String(part.id) === String(payload.payment.participant_id)) || { nom: 'Un ami' };
                const eventData = {
                    eventType: 'CANCEL_PAYMENT',
                    payload: {
                        participantName: p.nom,
                        montant: payload.payment.montant,
                        paymentId: payload.payment.id
                    }
                };
                window.notificationManager.broadcastEvent('CANCEL_PAYMENT', eventData.payload);
                if (this.broadcastChannelSupabase) {
                    this.broadcastChannelSupabase.send({
                        type: 'broadcast',
                        event: 'cagnotte_event',
                        payload: eventData
                    });
                }
            } else if (payload.eventType === 'INSERT_PARTICIPANT' && payload.participant) {
                const eventData = {
                    eventType: 'NEW_PARTICIPANT',
                    payload: payload.participant
                };
                window.notificationManager.broadcastEvent('NEW_PARTICIPANT', eventData.payload);
                if (this.broadcastChannelSupabase) {
                    this.broadcastChannelSupabase.send({
                        type: 'broadcast',
                        event: 'cagnotte_event',
                        payload: eventData
                    });
                }
            }
        }
    }
}

// Instance globale du service de données
window.dataService = new DataService();
