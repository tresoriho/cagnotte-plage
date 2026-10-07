/**
 * Gestionnaire de l'Espace Administration (Version Corrigée & Sécurisée)
 * Gestion centralisée des versements (Validation / Annulation / Historique complet),
 * des participants, des réglages de l'événement et de la diffusion de notifications.
 */
class AdminManager {
    constructor() {
        this.participants = [];
        this.payments = [];
        this.historyFilter = 'all'; // 'all', 'pending', 'confirmed', 'cancelled'
        this.isProcessingAction = false;
        this.pendingValidateId = null;
        this.pendingCancelId = null;

        if (typeof document !== 'undefined') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        }
    }

    // Accès direct sans code PIN
    isAuthenticated() {
        return true;
    }

    login() {
        return true;
    }

    logout() {
        if (window.app) {
            window.app.switchView('dashboard');
        }
    }

    init() {
        this.bindEvents();
        if (window.dataService) {
            this.participants = window.dataService.getLocalParticipants();
            this.payments = window.dataService.getLocalPayments();
        }
        this.renderAdminView();
    }

    updateData(participants, payments) {
        this.participants = Array.isArray(participants) ? participants : [];
        this.payments = Array.isArray(payments) ? payments : [];
        this.renderAdminView();
    }

    bindEvents() {
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
                        const base64 = event.target.result;
                        const previewEl = document.getElementById('admin-cover-preview');
                        const hiddenInput = document.getElementById('admin-hero-image-val');
                        if (previewEl) previewEl.src = base64;
                        if (hiddenInput) hiddenInput.value = base64;
                        CONFIG.HERO_IMAGE = base64;
                        const mainCover = document.getElementById('hero-cover-image');
                        if (mainCover) mainCover.src = base64;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Changement de bannière de bas de page via fichier local
        const bottomBannerFileInput = document.getElementById('admin-bottom-banner-file');
        if (bottomBannerFileInput) {
            bottomBannerFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const base64 = event.target.result;
                        const previewEl = document.getElementById('admin-bottom-banner-preview');
                        const hiddenInput = document.getElementById('admin-bottom-banner-val');
                        if (previewEl) previewEl.src = base64;
                        if (hiddenInput) hiddenInput.value = base64;
                        CONFIG.BOTTOM_BANNER_IMAGE = base64;
                        const mainBottomBanner = document.getElementById('bottom-banner-image');
                        if (mainBottomBanner) mainBottomBanner.src = base64;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // Formulaire d'ajout d'un participant
        const addParticipantForm = document.getElementById('admin-add-participant-form');
        if (addParticipantForm) {
            addParticipantForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddParticipant();
            });
        }

        // Ajout groupé de participants
        const batchAddBtn = document.getElementById('admin-batch-add-btn');
        if (batchAddBtn) {
            batchAddBtn.addEventListener('click', () => {
                this.handleBatchAddParticipants();
            });
        }

        // Formulaire Diffusion Notification
        const broadcastForm = document.getElementById('admin-broadcast-form');
        if (broadcastForm) {
            broadcastForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleBroadcastSubmit();
            });
        }

        // Modèles de messages rapides
        const quickMsgBtns = document.querySelectorAll('.admin-quick-msg-btn');
        quickMsgBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const title = btn.getAttribute('data-title');
                const body = btn.getAttribute('data-body');
                const titleInput = document.getElementById('admin-broadcast-title');
                const bodyInput = document.getElementById('admin-broadcast-body');
                if (titleInput && title) titleInput.value = title;
                if (bodyInput && body) bodyInput.value = body;
            });
        });

        // Bouton de remise à 0 des versements
        const resetDashboardBtn = document.getElementById('admin-reset-payments-btn');
        if (resetDashboardBtn) {
            resetDashboardBtn.addEventListener('click', async () => {
                if (confirm("⚠️ Êtes-vous sûr de vouloir remettre tous les versements à 0 FCFA ?")) {
                    await window.dataService.clearAllPayments();
                    if (window.app) await window.app.reloadData();
                    window.notificationManager.showToast("Cagnotte remise à 0 FCFA avec succès.", "info", "🔄");
                }
            });
        }

        // Bouton suppression complète (vidage participants)
        const fullWipeBtn = document.getElementById('admin-full-wipe-btn');
        if (fullWipeBtn) {
            fullWipeBtn.addEventListener('click', async () => {
                if (confirm("🚨 DANGER : Vider tous les participants et remettre la cagnotte à zéro ?")) {
                    await window.dataService.saveParticipants([]);
                    await window.dataService.clearAllPayments();
                    if (window.app) await window.app.reloadData();
                    window.notificationManager.showToast("Tous les participants et versements ont été effacés.", "info", "🧹");
                }
            });
        }

        // Filtres onglets historique
        const filterBtns = document.querySelectorAll('.admin-history-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const filter = btn.getAttribute('data-status') || 'all';
                this.setHistoryFilter(filter);
            });
        });
    }

    setHistoryFilter(filter) {
        this.historyFilter = filter;
        const filterBtns = document.querySelectorAll('.admin-history-filter-btn');
        filterBtns.forEach(btn => {
            const st = btn.getAttribute('data-status') || 'all';
            if (st === filter) {
                btn.className = 'admin-history-filter-btn px-3 py-1 rounded-full bg-slate-900 text-white font-bold transition-all whitespace-nowrap shadow-sm text-[11px]';
            } else {
                btn.className = 'admin-history-filter-btn px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all whitespace-nowrap text-[11px]';
            }
        });
        this.renderHistoryTable();
    }

    // Afficher et mettre à jour la vue d'administration
    renderAdminView() {
        const mainPanel = document.getElementById('admin-main-panel');
        if (mainPanel) {
            mainPanel.classList.remove('hidden');
            mainPanel.style.display = 'block';
        }

        // Récupérer la liste à jour
        if (window.app && Array.isArray(window.app.payments)) {
            this.payments = window.app.payments;
        } else if (window.dataService) {
            this.payments = window.dataService.getLocalPayments();
        }

        if (window.app && Array.isArray(window.app.participants)) {
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
        if (locationInput && !locationInput.value) locationInput.value = CONFIG.EVENT_LOCATION || '';
        if (meetingInfoInput && !meetingInfoInput.value) meetingInfoInput.value = CONFIG.EVENT_MEETING_INFO || '';
        if (inclusionsInput && !inclusionsInput.value) inclusionsInput.value = CONFIG.EVENT_INCLUSIONS || '';
        if (dateInput && !dateInput.value) dateInput.value = CONFIG.EVENT_DATE ? CONFIG.EVENT_DATE.substring(0, 16) : '';
        if (targetPerPersonInput && !targetPerPersonInput.value) targetPerPersonInput.value = CONFIG.TARGET_PER_PARTICIPANT;
        if (waveUrlInput && !waveUrlInput.value) waveUrlInput.value = CONFIG.WAVE_PAYMENT_URL;
        if (previewEl && CONFIG.HERO_IMAGE) previewEl.src = CONFIG.HERO_IMAGE;
        if (hiddenInput && CONFIG.HERO_IMAGE) hiddenInput.value = CONFIG.HERO_IMAGE;
        if (bottomPreviewEl && CONFIG.BOTTOM_BANNER_IMAGE) bottomPreviewEl.src = CONFIG.BOTTOM_BANNER_IMAGE;
        if (bottomHiddenInput && CONFIG.BOTTOM_BANNER_IMAGE) bottomHiddenInput.value = CONFIG.BOTTOM_BANNER_IMAGE;

        const count = this.participants.length;
        const targetPerPerson = Number(targetPerPersonInput?.value) || CONFIG.TARGET_PER_PARTICIPANT;
        const calcTotal = this.participants.reduce((sum, p) => sum + Number(p.objectif || targetPerPerson), 0);
        if (totalGoalInput && !totalGoalInput.value) {
            totalGoalInput.value = calcTotal || (targetPerPerson * count);
        }

        // Séparation stricte et normalisée des statuts
        const pendingPayments = this.payments.filter(p => {
            const st = (p.statut || '').toLowerCase().trim();
            return st === 'pending' || st === 'en_attente' || st === 'attente';
        });

        const confirmedPayments = this.payments.filter(p => {
            const st = (p.statut || '').toLowerCase().trim();
            return st === 'confirmed' || st === 'completed' || st === 'valide' || st === 'validé';
        });

        const cancelledPayments = this.payments.filter(p => {
            const st = (p.statut || '').toLowerCase().trim();
            return st === 'cancelled' || st === 'refused' || st === 'annule' || st === 'annulé';
        });

        const totalPendingAmount = pendingPayments.reduce((acc, p) => acc + Number(p.montant || 0), 0);

        // 1. Mettre à jour le badge et le sous-titre de la section Versements en Attente
        const pendingBadge = document.getElementById('admin-pending-badge');
        const pendingSublabel = document.getElementById('admin-pending-sublabel');

        if (pendingBadge) {
            if (pendingPayments.length > 0) {
                pendingBadge.textContent = `${pendingPayments.length} versement${pendingPayments.length > 1 ? 's' : ''} • ${formatMoney(totalPendingAmount)} à vérifier`;
                pendingBadge.className = 'px-3.5 py-1.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 shadow-sm animate-pulse border border-amber-400';
            } else {
                pendingBadge.textContent = '0 versement en attente';
                pendingBadge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200';
            }
        }

        if (pendingSublabel) {
            if (pendingPayments.length > 0) {
                pendingSublabel.innerHTML = `<strong>${formatMoney(totalPendingAmount)}</strong> en attente de vérification sur votre compte Wave.`;
            } else {
                pendingSublabel.textContent = 'Validez après réception effective des fonds sur Wave.';
            }
        }

        // 2. Mettre à jour les compteurs de badges généraux
        const countBadge = document.getElementById('admin-participants-badge');
        if (countBadge) countBadge.textContent = `${count} participant${count > 1 ? 's' : ''}`;

        const paymentsBadge = document.getElementById('admin-payments-badge');
        if (paymentsBadge) paymentsBadge.textContent = `${this.payments.length} versement${this.payments.length > 1 ? 's' : ''}`;

        // Compteurs onglets historique
        const countAllEl = document.getElementById('admin-count-all');
        const countPendEl = document.getElementById('admin-count-pending');
        const countConfEl = document.getElementById('admin-count-confirmed');
        const countCancEl = document.getElementById('admin-count-cancelled');

        if (countAllEl) countAllEl.textContent = this.payments.length;
        if (countPendEl) countPendEl.textContent = pendingPayments.length;
        if (countConfEl) countConfEl.textContent = confirmedPayments.length;
        if (countCancEl) countCancEl.textContent = cancelledPayments.length;

        this.updateCalculatedSummary();

        // 3. Rendre la liste des VERSEMENTS EN ATTENTE
        const pendingContainer = document.getElementById('admin-pending-payments-body');
        if (pendingContainer) {
            if (pendingPayments.length === 0) {
                pendingContainer.innerHTML = `
                    <div class="text-center py-8 px-4 rounded-2xl bg-white/80 border border-dashed border-slate-200 text-slate-400 text-xs flex flex-col items-center justify-center gap-1.5 shadow-sm">
                        <span class="text-2xl">✨</span>
                        <span class="font-bold text-slate-700">Aucun versement en attente</span>
                        <span class="text-[11px] text-slate-400">Tous les versements déclarés ont été traités.</span>
                    </div>
                `;
            } else {
                pendingContainer.innerHTML = pendingPayments.map(pay => {
                    const participant = this.participants.find(p => String(p.id) === String(pay.participant_id));
                    const name = participant ? participant.nom : (pay.participants?.nom || 'Participant');
                    const initials = window.participantsManager ? window.participantsManager.getInitials(name) : '??';
                    const gradient = window.participantsManager ? window.participantsManager.getAvatarGradient(name) : 'from-amber-400 to-orange-500';
                    const dateFormatted = this.formatDateFriendly(pay.created_at || pay.paid_at);
                    const txRef = pay.wave_transaction_id || 'WAVE_TX';

                    return `
                        <div class="p-4 rounded-2xl bg-white border-2 border-amber-300 shadow-sm space-y-3 transition-all hover:border-amber-400">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr ${gradient} text-white font-black text-sm flex items-center justify-center flex-shrink-0 shadow-md">
                                        ${initials}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <h4 class="font-black text-sm text-slate-900 truncate">${name}</h4>
                                            <span class="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                                En attente ⏳
                                            </span>
                                        </div>
                                        <div class="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                            <span>${dateFormatted}</span>
                                            <span>•</span>
                                            <span class="font-mono text-[11px] font-bold text-slate-700">${txRef}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="text-right flex-shrink-0">
                                    <div class="text-lg font-black text-amber-700 tracking-tight">
                                        +${formatMoney(pay.montant)}
                                    </div>
                                </div>
                            </div>

                            <!-- Actions Administrateur -->
                            <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                <button type="button" onclick="window.adminManager.openValidateModal('${pay.id}')" 
                                        class="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5">
                                    <span>✅</span>
                                    <span>VALIDER</span>
                                </button>
                                <button type="button" onclick="window.adminManager.openCancelModal('${pay.id}')" 
                                        class="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs border border-rose-200 transition-all flex items-center justify-center gap-1.5">
                                    <span>❌</span>
                                    <span>ANNULER</span>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // 4. Rendre la liste des participants
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
                        <div class="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-9 h-9 rounded-xl bg-gradient-to-tr ${gradient} text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                                    ${initials}
                                </div>
                                <div class="min-w-0">
                                    <h4 class="font-bold text-xs text-slate-900 truncate">${p.nom}</h4>
                                    <div class="flex items-center gap-2 text-[11px] text-slate-400">
                                        <span>${p.telephone ? p.telephone : 'Pas de tél.'}</span>
                                        <span>•</span>
                                        <span class="text-sky-700 font-bold">Obj: ${formatMoney(p.objectif || CONFIG.TARGET_PER_PARTICIPANT)}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-3">
                                <div class="text-right">
                                    <span class="text-xs font-bold text-slate-900 block">${formatMoney(stats.totalPaid)}</span>
                                    <span class="text-[10px] text-slate-400 block">${stats.percentage}%</span>
                                </div>
                                <button onclick="window.adminManager.deleteParticipant('${p.id}', '${p.nom.replace(/'/g, "\\'")}')" 
                                        class="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors text-xs" 
                                        title="Supprimer ${p.nom}">
                                    ✕
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // 5. Rendre la table d'historique complète
        this.renderHistoryTable();
    }

    // Rendu de l'historique complet des versements (avec filtres)
    renderHistoryTable() {
        const container = document.getElementById('admin-payments-table-body');
        if (!container) return;

        let list = [...this.payments];

        if (this.historyFilter === 'pending') {
            list = list.filter(p => (p.statut || '').toLowerCase().trim() === 'pending');
        } else if (this.historyFilter === 'confirmed') {
            list = list.filter(p => {
                const st = (p.statut || '').toLowerCase().trim();
                return st === 'confirmed' || st === 'completed';
            });
        } else if (this.historyFilter === 'cancelled') {
            list = list.filter(p => {
                const st = (p.statut || '').toLowerCase().trim();
                return st === 'cancelled' || st === 'refused';
            });
        }

        if (list.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    Aucun versement dans cette catégorie.
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(pay => {
            const participant = this.participants.find(p => String(p.id) === String(pay.participant_id));
            const name = participant ? participant.nom : (pay.participants?.nom || 'Participant inconnu');
            const st = (pay.statut || '').toLowerCase().trim();
            const isPending = st === 'pending' || st === 'en_attente';
            const isConfirmed = st === 'confirmed' || st === 'completed';
            const isCancelled = st === 'cancelled' || st === 'refused';
            const timeStr = this.formatDateFriendly(pay.created_at || pay.paid_at);
            const txRef = pay.wave_transaction_id || 'WAVE';

            let badgeHtml = '';
            if (isPending) {
                badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">⏳ En attente</span>`;
            } else if (isConfirmed) {
                badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">✅ Validé</span>`;
            } else if (isCancelled) {
                badgeHtml = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">❌ Annulé</span>`;
            }

            return `
                <div class="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between gap-2.5">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h5 class="font-bold text-xs text-slate-900 truncate">${name}</h5>
                            ${badgeHtml}
                        </div>
                        <div class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                            <span>${timeStr}</span>
                            <span>•</span>
                            <span class="font-mono">${txRef}</span>
                            ${isCancelled && pay.cancel_reason ? `<span>• Motif: <em>${pay.cancel_reason}</em></span>` : ''}
                        </div>
                    </div>

                    <div class="flex items-center gap-2 flex-shrink-0">
                        <div class="text-right">
                            <span class="text-xs font-black ${isPending ? 'text-amber-600' : (isConfirmed ? 'text-emerald-600' : 'text-slate-400 line-through')}">
                                +${formatMoney(pay.montant)}
                            </span>
                        </div>

                        ${isPending ? `
                            <div class="flex items-center gap-1">
                                <button onclick="window.adminManager.openValidateModal('${pay.id}')" 
                                        class="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 transition-colors"
                                        title="Valider">
                                    ✓
                                </button>
                                <button onclick="window.adminManager.openCancelModal('${pay.id}')" 
                                        class="px-2 py-1 rounded-lg bg-rose-100 text-rose-700 font-bold text-[10px] hover:bg-rose-200 transition-colors"
                                        title="Annuler">
                                    ✕
                                </button>
                            </div>
                        ` : `
                            <button onclick="window.adminManager.deletePayment('${pay.id}', '${name.replace(/'/g, "\\'")}', ${pay.montant})" 
                                    class="w-6 h-6 rounded-lg bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors text-xs" 
                                    title="Supprimer la ligne">
                                🗑️
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Date conviviale : "Aujourd'hui à 08:01", "Hier à 19:30" ou "07/10/2026 à 08:01"
    formatDateFriendly(isoString) {
        if (!isoString) return "-";
        try {
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return "-";
            const now = new Date();
            const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            if (d.toDateString() === now.toDateString()) {
                return `Aujourd'hui à ${timeStr}`;
            }
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            if (d.toDateString() === yesterday.toDateString()) {
                return `Hier à ${timeStr}`;
            }
            return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${timeStr}`;
        } catch (e) {
            return "-";
        }
    }

    // =========================================================================
    // MODALES DE VALIDATION & ANNULATION (SÉCURITÉ & ANTI-DOUBLE VALIDATION)
    // =========================================================================

    openValidateModal(payId) {
        const payment = this.payments.find(p => String(p.id) === String(payId));
        if (!payment) {
            alert("Versement introuvable.");
            return;
        }

        const st = (payment.statut || '').toLowerCase().trim();
        if (st === 'confirmed' || st === 'completed') {
            alert("Ce versement a déjà été validé.");
            return;
        }
        if (st === 'cancelled' || st === 'refused') {
            alert("Ce versement a déjà été annulé.");
            return;
        }

        this.pendingValidateId = payId;
        const participant = this.participants.find(p => String(p.id) === String(payment.participant_id));
        const name = participant ? participant.nom : 'Participant';
        const modal = document.getElementById('admin-validate-modal');
        const content = document.getElementById('admin-validate-modal-content');

        if (!modal || !content) return;

        content.innerHTML = `
            <div class="p-6 text-center space-y-4">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shadow-sm">
                    ✅
                </div>

                <div>
                    <h3 class="font-heading font-black text-lg text-slate-900">Confirmer ce versement ?</h3>
                    <p class="text-xs text-slate-500 mt-0.5">Vérifiez que vous avez bien reçu les fonds sur votre application Wave.</p>
                </div>

                <!-- Récapitulatif -->
                <div class="bg-emerald-50/80 rounded-2xl p-4 border border-emerald-200 text-left space-y-2">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-500 font-medium">Participant :</span>
                        <strong class="text-slate-900 font-black">${name}</strong>
                    </div>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-500 font-medium">Montant :</span>
                        <strong class="text-base text-emerald-700 font-black">+${formatMoney(payment.montant)}</strong>
                    </div>
                    <div class="flex items-center justify-between text-[11px] pt-2 border-t border-emerald-200/60">
                        <span class="text-slate-400">Réf. transaction :</span>
                        <span class="font-mono font-bold text-slate-700">${payment.wave_transaction_id || 'WAVE'}</span>
                    </div>
                </div>

                <p class="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-left leading-relaxed">
                    💡 <strong>Conséquence :</strong> Ce montant sera immédiatement ajouté à la cagnotte globale et comptabilisé sur le profil de <strong>${name}</strong>.
                </p>

                <div class="grid grid-cols-2 gap-2.5 pt-1">
                    <button type="button" onclick="window.adminManager.closeValidateModal()" 
                            class="py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors">
                        Annuler
                    </button>
                    <button type="button" id="admin-confirm-validate-btn" onclick="window.adminManager.executeValidatePayment('${payment.id}')" 
                            class="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                        <span>Confirmer</span>
                        <span>✓</span>
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeValidateModal() {
        this.pendingValidateId = null;
        const modal = document.getElementById('admin-validate-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async executeValidatePayment(payId) {
        if (this.isProcessingAction) return;
        this.isProcessingAction = true;

        const btn = document.getElementById('admin-confirm-validate-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Validation...";
        }

        try {
            const res = await window.dataService.validatePayment(payId, 'Administrateur');

            if (!res.success) {
                alert(res.message || "Ce versement ne peut pas être validé.");
                this.closeValidateModal();
                if (window.app) await window.app.reloadData();
                return;
            }

            const payment = res.payment;
            const participant = this.participants.find(p => String(p.id) === String(payment.participant_id));
            const name = participant ? participant.nom : 'Participant';

            this.closeValidateModal();

            if (window.paymentsManager && typeof window.paymentsManager.launchConfetti === 'function') {
                window.paymentsManager.launchConfetti();
            }

            window.notificationManager.showToast(`Versement de ${name} validé (+${formatMoney(payment.montant)}) !`, 'success', '🎉', 'wave');

            if (window.app) {
                await window.app.reloadData();
            } else {
                this.payments = window.dataService.getLocalPayments();
                this.renderAdminView();
            }
        } catch (err) {
            console.error("Erreur validation paiement:", err);
            alert("Une erreur est survenue lors de la validation.");
        } finally {
            this.isProcessingAction = false;
        }
    }

    openCancelModal(payId) {
        const payment = this.payments.find(p => String(p.id) === String(payId));
        if (!payment) {
            alert("Versement introuvable.");
            return;
        }

        const st = (payment.statut || '').toLowerCase().trim();
        if (st === 'confirmed' || st === 'completed') {
            alert("Ce versement a déjà été validé et ne peut plus être annulé.");
            return;
        }
        if (st === 'cancelled' || st === 'refused') {
            alert("Ce versement a déjà été annulé.");
            return;
        }

        this.pendingCancelId = payId;
        const participant = this.participants.find(p => String(p.id) === String(payment.participant_id));
        const name = participant ? participant.nom : 'Participant';
        const modal = document.getElementById('admin-cancel-modal');
        const content = document.getElementById('admin-cancel-modal-content');

        if (!modal || !content) return;

        content.innerHTML = `
            <div class="p-6 text-center space-y-4">
                <div class="w-14 h-14 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center text-2xl shadow-sm">
                    ❌
                </div>

                <div>
                    <h3 class="font-heading font-black text-lg text-slate-900">Annuler ce versement ?</h3>
                    <p class="text-xs text-slate-500 mt-0.5">Le versement sera rejeté et ne sera pas crédité sur la cagnotte.</p>
                </div>

                <!-- Récapitulatif -->
                <div class="bg-rose-50/60 rounded-2xl p-3.5 border border-rose-200 text-left space-y-1.5 text-xs">
                    <div class="flex justify-between">
                        <span class="text-slate-500 font-medium">Participant :</span>
                        <strong class="text-slate-900 font-black">${name}</strong>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-500 font-medium">Montant :</span>
                        <strong class="text-rose-700 font-black">${formatMoney(payment.montant)}</strong>
                    </div>
                </div>

                <!-- Motif d'annulation -->
                <div class="text-left space-y-1.5">
                    <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Motif de l'annulation / refus :
                    </label>
                    <select id="admin-cancel-reason-select" class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500">
                        <option value="Paiement non reçu sur Wave" selected>Paiement non reçu sur Wave</option>
                        <option value="Montant incorrect">Montant incorrect</option>
                        <option value="Doublon / Déclaration en double">Doublon / Déclaration en double</option>
                        <option value="Autre motif">Autre motif</option>
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-2.5 pt-1">
                    <button type="button" onclick="window.adminManager.closeCancelModal()" 
                            class="py-3 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors">
                        Retour
                    </button>
                    <button type="button" id="admin-confirm-cancel-btn" onclick="window.adminManager.executeCancelPayment('${payment.id}')" 
                            class="py-3 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-600/25 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                        <span>Confirmer le refus</span>
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeCancelModal() {
        this.pendingCancelId = null;
        const modal = document.getElementById('admin-cancel-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async executeCancelPayment(payId) {
        if (this.isProcessingAction) return;
        this.isProcessingAction = true;

        const select = document.getElementById('admin-cancel-reason-select');
        const reason = select ? select.value : 'Paiement non reçu';

        const btn = document.getElementById('admin-confirm-cancel-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Annulation...";
        }

        try {
            const res = await window.dataService.cancelPayment(payId, reason);

            if (!res.success) {
                alert(res.message || "Ce versement ne peut pas être annulé.");
                this.closeCancelModal();
                if (window.app) await window.app.reloadData();
                return;
            }

            const payment = res.payment;
            const participant = this.participants.find(p => String(p.id) === String(payment.participant_id));
            const name = participant ? participant.nom : 'Participant';

            this.closeCancelModal();

            window.notificationManager.showToast(`Versement de ${name} annulé (${reason}).`, 'info', '❌');

            if (window.app) {
                await window.app.reloadData();
            } else {
                this.payments = window.dataService.getLocalPayments();
                this.renderAdminView();
            }
        } catch (err) {
            console.error("Erreur annulation paiement:", err);
            alert("Une erreur est survenue lors de l'annulation.");
        } finally {
            this.isProcessingAction = false;
        }
    }

    // Supprimer définitivement un versement de la base
    async deletePayment(id, nom, montant) {
        if (confirm(`Supprimer définitivement l'enregistrement de ${formatMoney(montant)} pour ${nom} ?`)) {
            await window.dataService.deletePayment(id);
            if (window.app) await window.app.reloadData();
            window.notificationManager.showToast(`Ligne supprimée.`, 'info', '🗑️');
        }
    }

    // Supprimer un participant
    async deleteParticipant(id, nom) {
        if (confirm(`Supprimer définitivement ${nom} de la liste ?`)) {
            await window.dataService.deleteParticipant(id);
            if (window.app) await window.app.reloadData();
            window.notificationManager.showToast(`${nom} supprimé(e).`, 'info', '🗑️');
        }
    }

    // Ajout d'un participant individuel
    async handleAddParticipant() {
        const nameInput = document.getElementById('admin-new-name');
        if (!nameInput) return;

        const nom = nameInput.value.trim();
        if (!nom) return;

        const target = Number(document.getElementById('admin-target-per-person')?.value) || CONFIG.TARGET_PER_PARTICIPANT;

        await window.dataService.addParticipant({ nom, telephone: '', objectif: target });
        nameInput.value = '';

        if (window.app) await window.app.reloadData();
        window.notificationManager.showToast(`${nom} a été ajouté(e) avec succès !`, 'success', '👤');
    }

    // Ajout en lot
    async handleBatchAddParticipants() {
        const batchTextarea = document.getElementById('admin-batch-names');
        if (!batchTextarea) return;

        const text = batchTextarea.value.trim();
        if (!text) {
            alert('Veuillez entrer au moins un nom de participant.');
            return;
        }

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
        if (window.app) await window.app.reloadData();
        window.notificationManager.showToast(`${names.length} participant(s) ajouté(s) en bloc !`, 'success', '👥');
    }

    // Envoi de notification push broadcast
    async handleBroadcastSubmit() {
        const titleInput = document.getElementById('admin-broadcast-title');
        const bodyInput = document.getElementById('admin-broadcast-body');
        const submitBtn = document.getElementById('admin-broadcast-submit-btn');

        if (!titleInput || !bodyInput) return;

        const title = titleInput.value.trim();
        const message = bodyInput.value.trim();

        if (!title || !message) {
            alert("Veuillez remplir le titre et le texte de l'annonce.");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span>⏳ Envoi en cours...</span>`;
        }

        if (window.dataService) {
            await window.dataService.sendBroadcastAnnouncement(title, message);
        }

        titleInput.value = '';
        bodyInput.value = '';

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>🚀 Envoyer la notification à tous les téléphones</span>`;
        }

        window.notificationManager.showToast("Notification diffusée à tous les participants ! 📲", "success", "📢");
    }

    updateCalculatedSummary() {
        const targetPerPerson = Number(document.getElementById('admin-target-per-person')?.value) || CONFIG.TARGET_PER_PARTICIPANT;
        const count = this.participants.length;
        const calculatedTotal = targetPerPerson * count;

        const summaryEl = document.getElementById('admin-summary-calc');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="bg-sky-50 rounded-2xl p-3 border border-sky-200 text-xs text-slate-700 flex items-center justify-between">
                    <span>${count} participants × ${formatMoney(targetPerPerson)} =</span>
                    <strong class="text-sm font-black text-sky-900">${formatMoney(calculatedTotal)}</strong>
                </div>
            `;
        }
    }

    // Sauvegarde des réglages généraux
    async saveGeneralSettings() {
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

        await window.dataService.saveConfig({
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

        if (window.app) await window.app.reloadData();
        window.notificationManager.showToast("Paramètres sauvegardés avec succès !", "success", "⚙️");
    }
}

// Instance globale
window.adminManager = new AdminManager();
