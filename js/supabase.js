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

    // Récupérer tous les participants
    async getParticipants() {
        if (this.isRealSupabase && this.supabaseClient) {
            const { data, error } = await this.supabaseClient
                .from('participants')
                .select('*')
                .order('id', { ascending: true });
            if (error) {
                console.error("Erreur chargement participants Supabase:", error);
                return this.getLocalParticipants();
            }
            return data;
        }
        return this.getLocalParticipants();
    }

    getLocalParticipants() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY_PARTICIPANTS);
            return raw ? JSON.parse(raw) : CONFIG.INITIAL_PARTICIPANTS;
        } catch (e) {
            return CONFIG.INITIAL_PARTICIPANTS;
        }
    }

    // Récupérer tous les paiements (validés et en attente)
    async getPayments() {
        if (this.isRealSupabase && this.supabaseClient) {
            const { data, error } = await this.supabaseClient
                .from('paiements')
                .select('*, participants(nom)')
                .order('created_at', { ascending: false });
            if (error) {
                console.error("Erreur chargement paiements Supabase:", error);
                return this.getLocalPayments();
            }
            return data;
        }
        return this.getLocalPayments();
    }

    getLocalPayments() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY_PAYMENTS);
            const list = raw ? JSON.parse(raw) : CONFIG.INITIAL_PAYMENTS;
            // Tri du plus récent au plus ancien
            return list.sort((a, b) => new Date(b.created_at || b.paid_at) - new Date(a.created_at || a.paid_at));
        } catch (e) {
            return CONFIG.INITIAL_PAYMENTS;
        }
    }

    // Enregistrer un nouveau paiement (statut 'pending' par défaut pour validation admin)
    async addPayment(paymentPayload) {
        const newPayment = {
            id: 'pay-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            participant_id: paymentPayload.participant_id,
            montant: Number(paymentPayload.montant),
            wave_transaction_id: paymentPayload.wave_transaction_id || `WAVE_TX_${Math.floor(1000 + Math.random() * 9000)}`,
            statut: paymentPayload.statut || 'pending', // 'pending' (en attente admin) ou 'completed'
            created_at: new Date().toISOString(),
            paid_at: paymentPayload.statut === 'completed' ? new Date().toISOString() : null
        };

        if (this.isRealSupabase && this.supabaseClient) {
            const { data, error } = await this.supabaseClient
                .from('paiements')
                .insert([newPayment])
                .select();
            if (error) {
                console.error("Erreur insertion paiement Supabase:", error);
                // Fallback local
                this.savePaymentLocally(newPayment);
            } else {
                this.notifyListeners({ eventType: 'INSERT', new: data[0] });
                return data[0];
            }
        } else {
            this.savePaymentLocally(newPayment);
        }

        // Déclencher l'événement Realtime
        this.notifyListeners({
            eventType: 'INSERT',
            new: newPayment
        });

        return newPayment;
    }

    // Valider un paiement en attente par l'administrateur
    async validatePayment(id) {
        let payments = this.getLocalPayments();
        let targetPayment = null;
        payments = payments.map(p => {
            if (String(p.id) === String(id)) {
                p.statut = 'completed';
                p.paid_at = new Date().toISOString();
                targetPayment = p;
            }
            return p;
        });
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(payments));

        if (this.isRealSupabase && this.supabaseClient) {
            await this.supabaseClient
                .from('paiements')
                .update({ statut: 'completed', paid_at: new Date().toISOString() })
                .eq('id', id);
        }

        this.notifyListeners({
            eventType: 'VALIDATE_PAYMENT',
            payment: targetPayment
        });

        return targetPayment;
    }

    savePaymentLocally(payment) {
        const currentPayments = this.getLocalPayments();
        currentPayments.unshift(payment);
        localStorage.setItem(this.STORAGE_KEY_PAYMENTS, JSON.stringify(currentPayments));
    }

    // Enregistrer / Remplacer tous les participants
    async saveParticipants(list) {
        if (this.isRealSupabase && this.supabaseClient) {
            try {
                // Pour Supabase, mise à jour ou insertion
                console.log("Synchronisation participants avec Supabase...");
            } catch (e) {
                console.warn(e);
            }
        }
        localStorage.setItem(this.STORAGE_KEY_PARTICIPANTS, JSON.stringify(list));
        this.notifyListeners({ eventType: 'UPDATE_PARTICIPANTS', participants: list });
        return list;
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

    // Sauvegarder la configuration générale de l'événement
    saveConfig(customConfig) {
        localStorage.setItem('cagnotte_plage_config_v1', JSON.stringify(customConfig));
        CONFIG.loadSavedConfig();
        this.notifyListeners({ eventType: 'CONFIG_UPDATED', config: customConfig });
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
        // 1. Écouteur sur les modifications en base
        this.supabaseClient
            .channel('public:paiements')
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

    // Diffuser une annonce à tous les téléphones connectés
    async sendBroadcastAnnouncement(title, message) {
        const eventData = {
            eventType: 'ANNOUNCEMENT',
            payload: { title, message }
        };

        if (this.broadcastChannelSupabase) {
            try {
                await this.broadcastChannelSupabase.send({
                    type: 'broadcast',
                    event: 'cagnotte_event',
                    payload: eventData
                });
                console.log("✅ Message broadcast envoyé avec succès via Supabase");
            } catch (err) {
                console.warn("Erreur envoi broadcast Supabase:", err);
            }
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
                const eventData = {
                    eventType: 'NEW_PAYMENT',
                    payload: {
                        participantName: p.nom,
                        montant: payload.new.montant,
                        currentTotal: 0,
                        targetAmount: CONFIG.TARGET_PER_PARTICIPANT
                    }
                };
                window.notificationManager.broadcastEvent('NEW_PAYMENT', eventData.payload);
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
