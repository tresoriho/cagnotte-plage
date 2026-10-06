/**
 * Gestionnaire de l'Espace Administration
 * Permet de configurer l'objectif total, ajouter/modifier/supprimer les participants,
 * et réinitialiser le tableau de bord à 0 FCFA.
 */
class AdminManager {
    constructor() {
        this.participants = [];
        this.payments = [];
        this.AUTH_STORAGE_KEY = 'cagnotte_admin_authenticated_v1';
        if (typeof document !== 'undefined') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        }
    }

    // Vérifie si l'administrateur est authentifié
    isAuthenticated() {
        try {
            return sessionStorage.getItem(this.AUTH_STORAGE_KEY) === 'true' || localStorage.getItem(this.AUTH_STORAGE_KEY) === 'true';
        } catch (e) {
            return false;
        }
    }

    // Connexion et déverrouillage de l'espace administrateur
    login(enteredPin) {
        sessionStorage.setItem(this.AUTH_STORAGE_KEY, 'true');
        localStorage.setItem(this.AUTH_STORAGE_KEY, 'true');

        const errEl = document.getElementById('admin-pin-error');
        if (errEl) errEl.classList.add('hidden');

        const lockScreen = document.getElementById('admin-lock-screen');
        const mainPanel = document.getElementById('admin-main-panel');
        if (lockScreen) {
            lockScreen.classList.add('hidden');
            lockScreen.style.display = 'none';
        }
        if (mainPanel) {
            mainPanel.classList.remove('hidden');
            mainPanel.style.display = 'block';
        }

        if (window.notificationManager) {
            window.notificationManager.showToast('Accès Administrateur déverrouillé ! 🔓', 'success', '👑');
        }

        this.renderAdminView();
        return true;
    }

    // Gestionnaire de soumission du code PIN
    handlePinSubmit(e) {
        if (e && typeof e.preventDefault === 'function') {
            e.preventDefault();
        }
        const pinInput = document.getElementById('admin-pin-input');
        const val = pinInput ? pinInput.value : '';
        this.login(val);
        if (pinInput) {
            pinInput.value = '';
        }
        return false;
    }

    // Déconnexion et verrouillage de l'espace administrateur
    logout() {
        sessionStorage.removeItem(this.AUTH_STORAGE_KEY);
        localStorage.removeItem(this.AUTH_STORAGE_KEY);
        if (window.notificationManager) {
            window.notificationManager.showToast('Espace Administrateur verrouillé.', 'info', '🔒');
        }
        const lockScreen = document.getElementById('admin-lock-screen');
        const mainPanel = document.getElementById('admin-main-panel');
        if (lockScreen) {
            lockScreen.classList.remove('hidden');
            lockScreen.style.display = 'block';
        }
        if (mainPanel) {
            mainPanel.classList.add('hidden');
            mainPanel.style.display = 'none';
        }
        this.renderAdminView();
    }

    init() {
        this.bindEvents();
    }

    updateData(participants, payments) {
        this.participants = participants;
        this.payments = payments;
        this.renderAdminView();
    }

    bindEvents() {
        // Formulaire de Code PIN Administrateur
        const pinForm = document.getElementById('admin-pin-form');
        if (pinForm) {
            pinForm.addEventListener('submit', (e) => {
                this.handlePinSubmit(e);
            });
        }

        // Formulaire Réglages Généraux (Objectif total, Titre, etc.)
        const configForm = document.getElementById('admin-config-form');
        if (configForm) {
            configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveGeneralSettings();
            });
        }

        // Calcul automatique lors de la saisie
        const targetPerPersonInput = document.getElementById('admin-target-per-person');
        const totalGoalInput = document.getElementById('admin-total-goal');
        const participantsCountEl = document.getElementById('admin-calculated-count');

        if (targetPerPersonInput) {
            targetPerPersonInput.addEventListener('input', () => {
                this.updateCalculatedSummary();
            });
        }

        if (totalGoalInput) {
            totalGoalInput.addEventListener('input', () => {
                const total = Number(totalGoalInput.value) || 0;
                const count = Math.max(1, this.participants.length);
                if (targetPerPersonInput && total > 0) {
                    targetPerPersonInput.value = Math.round(total / count);
                    this.updateCalculatedSummary();
                }
            });
        }

        // Changement d'image de couverture via fichier local
        const coverFileInput = document.getElementById('admin-cover-file');
        if (coverFileInput) {
            coverFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64Data = event.target.result;
                        const previewEl = document.getElementById('admin-cover-preview');
                        const hiddenInput = document.getElementById('admin-hero-image-val');
                        if (previewEl) previewEl.src = base64Data;
                        if (hiddenInput) hiddenInput.value = base64Data;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Changement de la photo de la bannière du bas (Citation)
        const bottomBannerFileInput = document.getElementById('admin-bottom-banner-file');
        if (bottomBannerFileInput) {
            bottomBannerFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64Data = event.target.result;
                        const previewEl = document.getElementById('admin-bottom-banner-preview');
                        const hiddenInput = document.getElementById('admin-bottom-banner-val');
                        if (previewEl) previewEl.src = base64Data;
                        if (hiddenInput) hiddenInput.value = base64Data;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Écouteur sur la cotisation par participant pour recalculer immédiatement le budget et l'objectif total
        const targetPerPersonInput = document.getElementById('admin-target-per-person');
        if (targetPerPersonInput) {
            targetPerPersonInput.addEventListener('input', () => {
                this.updateCalculatedSummary();
                const totalGoalInput = document.getElementById('admin-total-goal');
                const val = Number(targetPerPersonInput.value) || CONFIG.TARGET_PER_PARTICIPANT;
                if (totalGoalInput) {
                    totalGoalInput.value = val * this.participants.length;
                }
            });
        }

        // Formulaire d'ajout individuel d'un participant
        const addParticipantForm = document.getElementById('admin-add-participant-form');
        if (addParticipantForm) {
            addParticipantForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleAddParticipant();
            });
        }

        // Formulaire d'ajout groupé (Plusieurs noms à la fois)
        const batchAddBtn = document.getElementById('admin-batch-add-btn');
        if (batchAddBtn) {
            batchAddBtn.addEventListener('click', async () => {
                await this.handleBatchAddParticipants();
            });
        }

        // Formulaire d'envoi de notification Push Broadcast à tous les téléphones
        const broadcastForm = document.getElementById('admin-broadcast-form');
        if (broadcastForm) {
            broadcastForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSendBroadcastNotification();
            });
        }

        // Modèles de messages rapides pour l'admin
        const quickMsgBtns = document.querySelectorAll('.admin-quick-msg-btn');
        quickMsgBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const title = btn.getAttribute('data-title') || '';
                const body = btn.getAttribute('data-body') || '';
                const titleInput = document.getElementById('admin-broadcast-title');
                const bodyInput = document.getElementById('admin-broadcast-body');
                if (titleInput) titleInput.value = title;
                if (bodyInput) {
                    bodyInput.value = body;
                    bodyInput.focus();
                }
            });
        });

        // Bouton Réinitialiser le Tableau de bord à 0 FCFA
        const resetDashboardBtn = document.getElementById('admin-reset-payments-btn');
        if (resetDashboardBtn) {
            resetDashboardBtn.addEventListener('click', async () => {
                if (confirm('Êtes-vous sûr de vouloir remettre tous les paiements et le tableau de bord à 0 FCFA ?')) {
                    await window.dataService.clearAllPayments();
                    window.notificationManager.showToast('Tableau de bord réinitialisé à 0 FCFA !', 'success', '🔄');
                }
            });
        }

        // Bouton Tout réinitialiser (Zéro absolu : 0 paiements + suppression des participants de test)
        const fullWipeBtn = document.getElementById('admin-full-wipe-btn');
        if (fullWipeBtn) {
            fullWipeBtn.addEventListener('click', async () => {
                if (confirm('Attention : cela va supprimer TOUS les participants et remettre tous les compteurs à zéro pour repartir d\'une page blanche. Confirmer ?')) {
                    await window.dataService.saveParticipants([]);
                    await window.dataService.clearAllPayments();
                    window.notificationManager.showToast('Cagnotte entièrement vidée (0 participant, 0 FCFA)', 'info', '🧹');
                }
            });
        }
    }

    // Diffuser une notification push à tous les utilisateurs ayant installé l'app
    async handleSendBroadcastNotification() {
        const titleInput = document.getElementById('admin-broadcast-title');
        const bodyInput = document.getElementById('admin-broadcast-body');
        const submitBtn = document.getElementById('admin-broadcast-submit-btn');

        const title = titleInput?.value?.trim();
        const message = bodyInput?.value?.trim();

        if (!title || !message) {
            alert('Veuillez remplir le titre et le texte de la notification.');
            return;
        }

        // Feedback visuel sur le bouton
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>⏳</span><span>Envoi en cours à tous les téléphones...</span>`;
        }

        const payload = { title, message };

        // 1. Envoyer la notification locale sur la machine/téléphone de l'admin
        if (window.notificationManager) {
            window.notificationManager.sendNativeNotification(title, {
                body: message,
                icon: './assets/icons/icon-192.png'
            });

            // 2. Diffuser sur les onglets et fenêtres locales
            window.notificationManager.broadcastEvent('ANNOUNCEMENT', payload);
        }

        // 3. Diffuser en direct via Supabase Realtime à tous les téléphones connectés
        if (window.dataService) {
            await window.dataService.sendBroadcastAnnouncement(title, message);
        }

        // 4. Envoi OneSignal Push en arrière-plan (pour réveiller et allumer l'écran des téléphones verrouillés / fermés)
        try {
            await fetch('/.netlify/functions/send-push-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    message: message,
                    url: window.location.origin
                })
            });
        } catch (err) {
            console.warn("Notification OneSignal en arrière-plan non envoyée :", err);
        }

        // Notification de confirmation à l'admin
        setTimeout(() => {
            if (window.notificationManager) {
                window.notificationManager.showToast(`📢 Notification envoyée avec succès à tous les participants !`, 'success', '🚀');
            }

            if (bodyInput) bodyInput.value = '';
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }, 500);
    }

    // Calcul en direct du budget prévisionnel
    updateCalculatedSummary() {
        const targetPerPerson = Number(document.getElementById('admin-target-per-person')?.value) || CONFIG.TARGET_PER_PARTICIPANT;
        const count = this.participants.length;
        const estimatedTotal = targetPerPerson * count;

        const summaryEl = document.getElementById('admin-summary-calc');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-xs text-cyan-900 dark:text-cyan-200 flex items-center justify-between">
                    <span>💡 Budget total calculé (${count} participant${count > 1 ? 's' : ''} × ${formatMoney(targetPerPerson)}) :</span>
                    <span class="font-black text-sm text-cyan-700 dark:text-cyan-300">${formatMoney(estimatedTotal)}</span>
                </div>
            `;
        }
    }

    // Sauvegarde des réglages généraux
    saveGeneralSettings() {
        const appName = document.getElementById('admin-app-name')?.value || CONFIG.APP_NAME;
        const appTagline = document.getElementById('admin-app-tagline')?.value || CONFIG.APP_TAGLINE;
        const location = document.getElementById('admin-location')?.value || CONFIG.EVENT_LOCATION;
        const meetingInfo = document.getElementById('admin-meeting-info')?.value || CONFIG.EVENT_MEETING_INFO;
        const inclusions = document.getElementById('admin-inclusions')?.value || CONFIG.EVENT_INCLUSIONS;
        const eventDate = document.getElementById('admin-event-date')?.value || CONFIG.EVENT_DATE;
        const targetPerPerson = Number(document.getElementById('admin-target-per-person')?.value) || CONFIG.TARGET_PER_PARTICIPANT;
        const customTotalGoal = Number(document.getElementById('admin-total-goal')?.value) || (targetPerPerson * this.participants.length);
        const waveUrl = document.getElementById('admin-wave-url')?.value?.trim() || CONFIG.WAVE_PAYMENT_URL;
        const heroImage = document.getElementById('admin-hero-image-val')?.value?.trim() || CONFIG.HERO_IMAGE;
        const bottomBannerImage = document.getElementById('admin-bottom-banner-val')?.value?.trim() || CONFIG.BOTTOM_BANNER_IMAGE;

        // Appliquer également aux participants existants si coché
        const applyToAll = document.getElementById('admin-apply-target-to-all')?.checked;
        if (applyToAll && this.participants.length > 0) {
            this.participants.forEach(p => p.objectif = targetPerPerson);
            window.dataService.saveParticipants(this.participants);
        }

        window.dataService.saveConfig({
            APP_NAME: appName,
            APP_TAGLINE: appTagline,
            EVENT_LOCATION: location,
            EVENT_MEETING_INFO: meetingInfo,
            EVENT_INCLUSIONS: inclusions,
            EVENT_DATE: eventDate,
            TARGET_PER_PARTICIPANT: targetPerPerson,
            TOTAL_CUSTOM_GOAL: customTotalGoal,
            WAVE_PAYMENT_URL: waveUrl,
            HERO_IMAGE: heroImage,
            BOTTOM_BANNER_IMAGE: bottomBannerImage
        });

        if (window.app && typeof window.app.renderInfoView === 'function') {
            window.app.renderInfoView();
        }
        if (window.app && typeof window.app.renderDashboard === 'function') {
            window.app.renderDashboard();
        }

        window.notificationManager.showToast('Informations et photos enregistrées avec succès !', 'success', '💾');
    }

    // Ajouter un participant individuel
    async handleAddParticipant() {
        const nameInput = document.getElementById('admin-new-name');
        const phoneInput = document.getElementById('admin-new-phone');
        const targetInput = document.getElementById('admin-new-target');

        const nom = nameInput?.value?.trim();
        if (!nom) {
            alert('Veuillez renseigner le nom du participant.');
            return;
        }

        const telephone = phoneInput?.value?.trim() || '';
        const defaultTarget = Number(document.getElementById('admin-target-per-person')?.value) || CONFIG.TARGET_PER_PARTICIPANT;
        const objectif = Number(targetInput?.value) || defaultTarget;

        await window.dataService.addParticipant({ nom, telephone, objectif });

        // Nettoyer les champs
        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (targetInput) targetInput.value = '';

        window.notificationManager.showToast(`${nom} a été ajouté(e) avec succès !`, 'success', '👤');
    }

    // Ajout en lot (Plusieurs participants d'un coup)
    async handleBatchAddParticipants() {
        const batchTextarea = document.getElementById('admin-batch-names');
        if (!batchTextarea) return;

        const text = batchTextarea.value.trim();
        if (!text) {
            alert('Veuillez entrer au moins un nom de participant.');
            return;
        }

        // Découper par ligne ou par virgule
        const names = text.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
        if (names.length === 0) return;

        const defaultTarget = Number(document.getElementById('admin-target-per-person')?.value) || CONFIG.TARGET_PER_PARTICIPANT;
        const currentList = window.dataService.getLocalParticipants();

        names.forEach(name => {
            currentList.push({
                id: 'p-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
                nom: name,
                telephone: '',
                objectif: defaultTarget
            });
        });

        await window.dataService.saveParticipants(currentList);
        batchTextarea.value = '';
        window.notificationManager.showToast(`${names.length} participant(s) ajouté(s) en bloc !`, 'success', '👥');
    }

    // Supprimer un participant
    async deleteParticipant(id, nom) {
        if (!this.isAuthenticated()) {
            alert("Accès refusé : Seul l'administrateur avec code secret peut effectuer cette action.");
            this.renderAdminView();
            return;
        }
        if (confirm(`Supprimer définitivement ${nom} de la liste ?`)) {
            await window.dataService.deleteParticipant(id);
            window.notificationManager.showToast(`${nom} supprimé(e).`, 'info', '🗑️');
        }
    }

    // Supprimer un versement individuel
    async deletePayment(id, nom, montant) {
        if (!this.isAuthenticated()) {
            alert("Accès refusé : Seul l'administrateur avec code secret peut effectuer cette action.");
            this.renderAdminView();
            return;
        }
        if (confirm(`Supprimer ce versement de ${formatMoney(montant)} pour ${nom} ?`)) {
            await window.dataService.deletePayment(id);
            window.notificationManager.showToast(`Versement de ${formatMoney(montant)} supprimé.`, 'info', '🗑️');
        }
    }

    // Valider un versement en attente (RÉSERVÉ EXCLUSIVEMENT À L'ADMINISTRATEUR)
    async validatePayment(id, nom, montant) {
        if (!this.isAuthenticated()) {
            alert("Accès refusé : Seul l'administrateur avec code secret a la possibilité de valider un paiement.");
            this.renderAdminView();
            return;
        }

        if (confirm(`Confirmer la réception de ${formatMoney(montant)} pour ${nom} et l'ajouter à la cagnotte ?`)) {
            await window.dataService.validatePayment(id);
            window.notificationManager.showToast(`Paiement de ${nom} validé avec succès (+${formatMoney(montant)}) !`, 'success', '🎉', 'wave');
            if (window.paymentsManager) {
                window.paymentsManager.launchConfetti();
            }
        }
    }

    // Rejeter ou annuler un versement non reçu en attente (RÉSERVÉ EXCLUSIVEMENT À L'ADMINISTRATEUR)
    async rejectPayment(id, nom, montant) {
        if (!this.isAuthenticated()) {
            alert("Accès refusé : Seul l'administrateur avec code secret a la possibilité d'annuler ou refuser un paiement.");
            this.renderAdminView();
            return;
        }

        if (confirm(`Annuler cette déclaration de versement de ${formatMoney(montant)} pour ${nom} (paiement non reçu sur Wave) ?`)) {
            await window.dataService.cancelPayment(id);
            window.notificationManager.showToast(`Déclaration de ${nom} annulée (non reçue).`, 'info', '❌');
        }
    }

    // Afficher et mettre à jour la vue d'administration
    renderAdminView() {
        const lockScreen = document.getElementById('admin-lock-screen');
        const mainPanel = document.getElementById('admin-main-panel');

        // Si l'administrateur n'a pas déverrouillé, afficher l'écran de verrouillage
        if (!this.isAuthenticated()) {
            if (lockScreen) {
                lockScreen.classList.remove('hidden');
                lockScreen.style.display = 'block';
            }
            if (mainPanel) {
                mainPanel.classList.add('hidden');
                mainPanel.style.display = 'none';
            }
            const pinInput = document.getElementById('admin-pin-input');
            if (pinInput) setTimeout(() => pinInput.focus(), 150);
            return;
        }

        // Si authentifié, afficher l'espace d'administration
        if (lockScreen) {
            lockScreen.classList.add('hidden');
            lockScreen.style.display = 'none';
        }
        if (mainPanel) {
            mainPanel.classList.remove('hidden');
            mainPanel.style.display = 'block';
        }

        // Toujours récupérer les données synchronisées les plus récentes
        if (window.app && Array.isArray(window.app.payments) && window.app.payments.length > 0) {
            this.payments = window.app.payments;
        } else if (window.dataService) {
            this.payments = window.dataService.getLocalPayments();
        }

        if (window.app && Array.isArray(window.app.participants) && window.app.participants.length > 0) {
            this.participants = window.app.participants;
        } else if (window.dataService) {
            this.participants = window.dataService.getLocalParticipants();
        }

        // Pré-remplir les champs de réglages
        const nameInput = document.getElementById('admin-app-name');
        const taglineInput = document.getElementById('admin-app-tagline');
        const locationInput = document.getElementById('admin-location');
        const meetingInfoInput = document.getElementById('admin-meeting-info');
        const inclusionsInput = document.getElementById('admin-inclusions');
        const dateInput = document.getElementById('admin-event-date');
        const targetPerPersonInput = document.getElementById('admin-target-per-person');
        const totalGoalInput = document.getElementById('admin-total-goal');
        const waveUrlInput = document.getElementById('admin-wave-url');
        const previewEl = document.getElementById('admin-cover-preview');
        const hiddenInput = document.getElementById('admin-hero-image-val');
        const bottomPreviewEl = document.getElementById('admin-bottom-banner-preview');
        const bottomHiddenInput = document.getElementById('admin-bottom-banner-val');

        if (nameInput && !nameInput.value) nameInput.value = CONFIG.APP_NAME;
        if (taglineInput && !taglineInput.value) taglineInput.value = CONFIG.APP_TAGLINE;
        if (locationInput) locationInput.value = CONFIG.EVENT_LOCATION || '';
        if (meetingInfoInput) meetingInfoInput.value = CONFIG.EVENT_MEETING_INFO || '';
        if (inclusionsInput) inclusionsInput.value = CONFIG.EVENT_INCLUSIONS || '';
        if (dateInput && !dateInput.value) dateInput.value = CONFIG.EVENT_DATE.substring(0, 16);
        if (targetPerPersonInput && !targetPerPersonInput.value) targetPerPersonInput.value = CONFIG.TARGET_PER_PARTICIPANT;
        if (waveUrlInput && !waveUrlInput.value) waveUrlInput.value = CONFIG.WAVE_PAYMENT_URL;
        if (previewEl) previewEl.src = CONFIG.HERO_IMAGE || 'assets/images/hero-beach.jpg';
        if (hiddenInput) hiddenInput.value = CONFIG.HERO_IMAGE || 'assets/images/hero-beach.jpg';
        if (bottomPreviewEl) bottomPreviewEl.src = CONFIG.BOTTOM_BANNER_IMAGE || 'assets/images/friends-beach.jpg';
        if (bottomHiddenInput) bottomHiddenInput.value = CONFIG.BOTTOM_BANNER_IMAGE || 'assets/images/friends-beach.jpg';
        
        const count = this.participants.length;
        const targetPerPerson = Number(targetPerPersonInput?.value) || CONFIG.TARGET_PER_PARTICIPANT;
        const calcTotal = this.participants.reduce((sum, p) => sum + Number(p.objectif || targetPerPerson), 0);
        if (totalGoalInput) {
            totalGoalInput.value = calcTotal || (targetPerPerson * count);
        }

        // Séparer les paiements en attente et les paiements validés (insensible à la casse)
        const pendingPayments = this.payments.filter(p => {
            const st = (p.statut || p.status || '').toLowerCase().trim();
            return st === 'pending' || st === 'en_attente' || st === 'attente';
        });
        const completedPayments = this.payments.filter(p => {
            const st = (p.statut || p.status || '').toLowerCase().trim();
            return st === 'completed' || st === 'valide' || st === 'validé' || st === 'success';
        });

        // Mettre à jour les badges
        const countBadge = document.getElementById('admin-participants-badge');
        if (countBadge) countBadge.textContent = `${count} participant${count > 1 ? 's' : ''}`;

        const pendingBadge = document.getElementById('admin-pending-badge');
        if (pendingBadge) {
            pendingBadge.textContent = `${pendingPayments.length} en attente`;
            if (pendingPayments.length > 0) {
                pendingBadge.className = 'px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-pulse';
            } else {
                pendingBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
            }
        }

        const paymentsBadge = document.getElementById('admin-payments-badge');
        if (paymentsBadge) paymentsBadge.textContent = `${completedPayments.length} validé${completedPayments.length > 1 ? 's' : ''}`;

        this.updateCalculatedSummary();

        // 1. Rendre la liste des versements EN ATTENTE de validation
        const pendingContainer = document.getElementById('admin-pending-payments-body');
        if (pendingContainer) {
            if (pendingPayments.length === 0) {
                pendingContainer.innerHTML = `
                    <div class="text-center py-6 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-xs flex items-center justify-center gap-2">
                        <span>✨</span>
                        <span>Aucun versement en attente. Tout est à jour !</span>
                    </div>
                `;
            } else {
                pendingContainer.innerHTML = pendingPayments.map(pay => {
                    const participant = this.participants.find(p => String(p.id) === String(pay.participant_id));
                    const name = participant ? participant.nom : (pay.participants?.nom || 'Participant inconnu');
                    const timeStr = formatDateTime(pay.created_at || pay.paid_at);

                    return `
                        <div class="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-lg font-bold flex-shrink-0 shadow-sm">
                                    ⏳
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h4 class="font-bold text-sm text-slate-900 dark:text-white">${name}</h4>
                                        <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-200">En attente</span>
                                    </div>
                                    <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                        <span>Montant déclaré : <strong class="text-slate-900 dark:text-white font-black">${formatMoney(pay.montant)}</strong></span>
                                        <span>•</span>
                                        <span class="font-mono text-[11px]">${pay.wave_transaction_id || 'WAVE'}</span>
                                    </div>
                                    <span class="text-[10px] text-slate-400 mt-0.5 block">${timeStr}</span>
                                </div>
                            </div>

                            <!-- Actions de validation administrateur -->
                            <div class="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-amber-200/60 dark:border-amber-800/40">
                                <button onclick="window.adminManager.validatePayment('${pay.id}', '${name.replace(/'/g, "\\'")}', ${pay.montant})" 
                                        class="flex-1 sm:flex-none py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                    <span>✅</span>
                                    <span>Valider le versement</span>
                                </button>
                                <button onclick="window.adminManager.rejectPayment('${pay.id}', '${name.replace(/'/g, "\\'")}', ${pay.montant})" 
                                        class="py-2 px-3.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200 text-rose-700 dark:text-rose-300 font-bold text-xs transition-colors flex items-center justify-center gap-1 active:scale-95">
                                    <span>❌</span>
                                    <span>Annuler (non reçu)</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // 2. Rendre la liste des participants
        const listContainer = document.getElementById('admin-participants-table-body');
        if (listContainer) {
            if (this.participants.length === 0) {
                listContainer.innerHTML = `
                    <div class="text-center py-8 text-slate-400 text-xs">
                        Aucun participant pour le moment. Ajoutez votre premier ami ci-dessus !
                    </div>
                `;
            } else {
                listContainer.innerHTML = this.participants.map((p) => {
                    const stats = window.participantsManager ? window.participantsManager.calculateStats(p, this.payments) : { totalPaid: 0, percentage: 0 };
                    const initials = window.participantsManager ? window.participantsManager.getInitials(p.nom) : '??';
                    const gradient = window.participantsManager ? window.participantsManager.getAvatarGradient(p.nom) : 'from-cyan-500 to-blue-600';

                    return `
                        <div class="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-9 h-9 rounded-xl bg-gradient-to-tr ${gradient} text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                                    ${initials}
                                </div>
                                <div class="min-w-0">
                                    <h4 class="font-bold text-xs text-slate-900 dark:text-white truncate">${p.nom}</h4>
                                    <div class="flex items-center gap-2 text-[11px] text-slate-400">
                                        <span>${p.telephone ? p.telephone : 'Pas de tél.'}</span>
                                        <span>•</span>
                                        <span class="text-cyan-600 dark:text-cyan-400 font-semibold">Obj: ${formatMoney(p.objectif || CONFIG.TARGET_PER_PARTICIPANT)}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-3">
                                <div class="text-right hidden sm:block">
                                    <span class="text-xs font-black ${stats.totalPaid > 0 ? 'text-emerald-600' : 'text-slate-400'}">${formatMoney(stats.totalPaid)}</span>
                                    <span class="block text-[10px] text-slate-400">${stats.percentage}%</span>
                                </div>
                                <button onclick="window.adminManager.deleteParticipant('${p.id}', '${p.nom.replace(/'/g, "\\'")}')" 
                                        class="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors" title="Supprimer ce participant">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // 3. Rendre la liste des versements CONFIRMÉS
        const paymentsContainer = document.getElementById('admin-payments-table-body');
        if (paymentsContainer) {
            if (completedPayments.length === 0) {
                paymentsContainer.innerHTML = `
                    <div class="text-center py-8 text-slate-400 text-xs">
                        Aucun versement validé pour le moment.
                    </div>
                `;
            } else {
                paymentsContainer.innerHTML = completedPayments.map(pay => {
                    const participant = this.participants.find(p => String(p.id) === String(pay.participant_id));
                    const name = participant ? participant.nom : (pay.participants?.nom || 'Participant inconnu');
                    const timeStr = formatDateTime(pay.paid_at || pay.created_at);

                    return `
                        <div class="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-sm gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                                    💰
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <h4 class="font-bold text-xs text-slate-900 dark:text-white truncate">${name}</h4>
                                        <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Validé ✅</span>
                                    </div>
                                    <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                        <span>${timeStr}</span>
                                        <span>•</span>
                                        <span class="font-mono text-[10px]">${pay.wave_transaction_id || pay.id}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-3">
                                <div class="text-right">
                                    <span class="text-xs font-black text-emerald-600 dark:text-emerald-400">+${formatMoney(pay.montant)}</span>
                                </div>
                                <button onclick="window.adminManager.deletePayment('${pay.id}', '${name.replace(/'/g, "\\'")}', ${pay.montant})" 
                                        class="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors" title="Supprimer ce versement">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }
}

// Instance globale
if (typeof window !== 'undefined') {
    window.adminManager = new AdminManager();
}
