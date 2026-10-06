/**
 * Contrôleur Principal de l'Application "Cagnotte Sortie Plage 🏖️"
 */
class App {
    constructor() {
        this.currentView = 'dashboard';
        this.participants = [];
        this.payments = [];
        this.countdown = null;
        this.dashboardParticipantFilter = 'all';

        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    async init() {
        console.log("🏖️ Initialisation de la Cagnotte Sortie Plage...");

        // Initialiser le compte à rebours
        if (window.CountdownManager) {
            this.countdown = new window.CountdownManager(CONFIG.EVENT_DATE);
            this.countdown.start();
        }

        // Initialiser la navigation
        this.setupNavigation();

        // Écouter les événements temps réel
        if (window.dataService) {
            window.dataService.onRealtimeUpdate((payload) => {
                console.log("⚡ Mise à jour temps réel reçue :", payload);
                if (payload && payload.eventType === 'CONFIG_UPDATED' && this.countdown && CONFIG.EVENT_DATE) {
                    this.countdown.setTargetDate(CONFIG.EVENT_DATE);
                }
                this.reloadData();
            });
        }

        // Chargement initial des données
        await this.reloadData();

        // Initialiser la vue initiale
        this.switchView('dashboard');

        // Écouteurs pour les filtres et recherche
        this.setupParticipantFilters();
        this.setupDashboardSummaryFilters();
    }

    async reloadData() {
        if (!window.dataService) return;

        this.participants = await window.dataService.getParticipants();
        this.payments = await window.dataService.getPayments();

        // Mettre à jour le gestionnaire des participants
        if (window.participantsManager) {
            window.participantsManager.updateData(this.participants, this.payments);
        }

        // Mettre à jour le gestionnaire admin
        if (window.adminManager) {
            window.adminManager.updateData(this.participants, this.payments);
        }

        // Mettre à jour les sélecteurs de paiement
        if (window.paymentsManager) {
            window.paymentsManager.populateParticipantSelect(this.participants);
        }

        // Recalculer et afficher le tableau de bord
        this.renderDashboard();

        // Mettre à jour la vue des participants si active
        this.renderParticipantsView();

        // Mettre à jour l'historique
        this.renderHistoryView();

        // Mettre à jour les infos pratiques
        this.renderInfoView();
    }

    // Rendu dynamique de la vue Infos pratiques
    renderInfoView() {
        const locationEl = document.getElementById('info-event-location');
        const meetingEl = document.getElementById('info-meeting-info');
        const targetTitleEl = document.getElementById('info-target-title');
        const inclusionsListEl = document.getElementById('info-inclusions-list');

        if (locationEl && CONFIG.EVENT_LOCATION) {
            locationEl.textContent = CONFIG.EVENT_LOCATION;
        }
        if (meetingEl && CONFIG.EVENT_MEETING_INFO) {
            meetingEl.textContent = CONFIG.EVENT_MEETING_INFO;
        }
        if (targetTitleEl) {
            targetTitleEl.textContent = `Ce que couvre la cotisation (${formatMoney(CONFIG.TARGET_PER_PARTICIPANT)})`;
        }
        if (inclusionsListEl && CONFIG.EVENT_INCLUSIONS) {
            const items = CONFIG.EVENT_INCLUSIONS.split('\n').map(i => i.trim()).filter(i => i.length > 0);
            if (items.length > 0) {
                inclusionsListEl.innerHTML = items.map(item => `<li>${item}</li>`).join('');
            }
        }
    }

    // Calculer les métriques globales de la cagnotte
    calculateGlobalStats() {
        const totalParticipants = this.participants.length;
        // L'objectif total augmente immédiatement dès qu'un nouveau membre est ajouté
        const totalTarget = this.participants.reduce((sum, p) => sum + Number(p.objectif || CONFIG.TARGET_PER_PARTICIPANT), 0);
        
        const totalCollected = this.payments
            .filter(p => p.statut === 'completed')
            .reduce((sum, p) => sum + Number(p.montant || 0), 0);

        const totalRemaining = Math.max(0, totalTarget - totalCollected);
        const percentage = totalTarget > 0 ? Math.min(100, Math.round((totalCollected / totalTarget) * 100)) : 0;

        let soldesCount = 0;
        let inProgressCount = 0;
        let notStartedCount = 0;

        this.participants.forEach(p => {
            const stats = window.participantsManager ? window.participantsManager.calculateStats(p, this.payments) : { status: 'not_started' };
            if (stats.status === 'completed') {
                soldesCount++;
            } else if (stats.status === 'in_progress') {
                inProgressCount++;
            } else {
                notStartedCount++;
            }
        });

        return {
            totalParticipants,
            totalTarget,
            totalCollected,
            totalRemaining,
            percentage,
            soldesCount,
            inProgressCount,
            notStartedCount
        };
    }

    // Rendu du Tableau de Bord & Progression Globale
    renderDashboard() {
        const stats = this.calculateGlobalStats();

        // Image de couverture et avatars
        const coverImg = document.getElementById('hero-cover-image');
        const headerAvatar = document.getElementById('header-avatar-img');
        const bottomBannerImg = document.getElementById('bottom-banner-image');
        if (coverImg && CONFIG.HERO_IMAGE) coverImg.src = CONFIG.HERO_IMAGE;
        if (headerAvatar && CONFIG.HERO_IMAGE) headerAvatar.src = CONFIG.HERO_IMAGE;
        if (bottomBannerImg && CONFIG.BOTTOM_BANNER_IMAGE) bottomBannerImg.src = CONFIG.BOTTOM_BANNER_IMAGE;

        // KPI Objectif Total Card
        const targetEl = document.getElementById('stat-total-target');
        const targetSubEl = document.getElementById('stat-target-sublabel');
        const miniPercentEl = document.getElementById('dashboard-mini-percent');
        const goalProgressBarEl = document.getElementById('stat-goal-progressbar');
        const collectedSublabelEl = document.getElementById('stat-collected-sublabel');

        if (targetEl) targetEl.textContent = formatMoney(stats.totalTarget);
        if (targetSubEl) targetSubEl.textContent = `${formatMoney(CONFIG.TARGET_PER_PARTICIPANT)} / participant`;
        if (miniPercentEl) miniPercentEl.textContent = `${stats.percentage}%`;
        if (goalProgressBarEl) goalProgressBarEl.style.width = `${stats.percentage}%`;
        if (collectedSublabelEl) collectedSublabelEl.textContent = `${formatMoney(stats.totalCollected)} / ${formatMoney(stats.totalTarget)}`;

        // 3 Sub-Cards
        const collectedEl = document.getElementById('stat-total-collected');
        const remainingEl = document.getElementById('stat-total-remaining');
        const countEl = document.getElementById('stat-participants-count');

        if (collectedEl) collectedEl.textContent = formatMoney(stats.totalCollected);
        if (remainingEl) remainingEl.textContent = formatMoney(stats.totalRemaining);
        if (countEl) countEl.textContent = `${stats.totalParticipants} personnes`;

        // Carte Ocean Dark Progression
        const globalPercentEl = document.getElementById('global-progress-percent');
        const globalProgressBarEl = document.getElementById('global-progress-bar');
        const globalRatioEl = document.getElementById('global-progress-ratio');
        const globalSoldesBadgeEl = document.getElementById('global-soldes-badge');

        if (globalPercentEl) globalPercentEl.textContent = `${stats.percentage}%`;
        if (globalProgressBarEl) globalProgressBarEl.style.width = `${stats.percentage}%`;
        if (globalRatioEl) globalRatioEl.textContent = `${formatMoney(stats.totalCollected)} / ${formatMoney(stats.totalTarget)}`;
        if (globalSoldesBadgeEl) globalSoldesBadgeEl.textContent = `${stats.soldesCount} / ${stats.totalParticipants} ont soldé`;

        // Participants Summary Pills
        const countSoldesEl = document.getElementById('summary-count-soldes');
        const countInProgressEl = document.getElementById('summary-count-inprogress');
        const countNotStartedEl = document.getElementById('summary-count-notstarted');
        const participantsBadgeEl = document.getElementById('dashboard-participants-badge');

        if (countSoldesEl) countSoldesEl.textContent = stats.soldesCount;
        if (countInProgressEl) countInProgressEl.textContent = stats.inProgressCount;
        if (countNotStartedEl) countNotStartedEl.textContent = stats.notStartedCount;
        if (participantsBadgeEl) participantsBadgeEl.textContent = `${stats.totalParticipants} personnes`;

        // Rendu des versements récents
        this.renderRecentDashboardActivity();

        // Rendu de la liste des participants sur le Dashboard
        this.renderDashboardParticipants();
    }

    renderRecentDashboardActivity() {
        const container = document.getElementById('dashboard-recent-payments');
        const pendingBadge = document.getElementById('dashboard-pending-count-badge');
        if (!container) return;

        const pending = this.payments.filter(p => p.statut === 'pending');
        const completed = this.payments.filter(p => p.statut === 'completed');

        // Mettre à jour le badge de versements en attente
        if (pendingBadge) {
            if (pending.length > 0) {
                pendingBadge.textContent = `${pending.length} en attente ⏳`;
                pendingBadge.classList.remove('hidden');
            } else {
                pendingBadge.classList.add('hidden');
            }
        }

        // Afficher d'abord tous les paiements en attente, puis les plus récents confirmés (max 5 au total)
        const displayList = [...pending, ...completed].slice(0, 6);

        if (displayList.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 px-4 space-y-2">
                    <div class="w-12 h-12 mx-auto rounded-full bg-sky-50 text-sky-500 flex items-center justify-center text-xl">
                        🪙
                    </div>
                    <p class="text-xs font-bold text-slate-700">Aucun versement pour le moment.</p>
                    <p class="text-[11px] text-slate-400">Les déclarations Wave apparaîtront ici immédiatement en temps réel.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = displayList.map(p => {
            const participant = this.participants.find(part => String(part.id) === String(p.participant_id));
            const name = participant ? participant.nom : (p.participants?.nom || 'Participant');
            const initials = window.participantsManager ? window.participantsManager.getInitials(name) : 'P';
            const gradient = window.participantsManager ? window.participantsManager.getAvatarGradient(name) : 'from-sky-400 to-blue-600';
            const isPending = (p.statut || '').toLowerCase() === 'pending' || (p.statut || '').toLowerCase() === 'en_attente';

            if (isPending) {
                return `
                    <div class="p-3.5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 shadow-sm space-y-2.5 transition-all">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <div class="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                                    ⏳
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5">
                                        <p class="font-bold text-xs text-slate-900 truncate">${name}</p>
                                        <span class="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-200 text-amber-900 animate-pulse flex-shrink-0">
                                            En attente
                                        </span>
                                    </div>
                                    <span class="text-[10px] text-slate-500 font-medium block truncate">${formatDateTime(p.created_at || p.paid_at)} • <span class="font-mono">${p.wave_transaction_id || 'WAVE'}</span></span>
                                </div>
                            </div>
                            <div class="text-right flex-shrink-0 pl-2">
                                <span class="text-sm font-black text-amber-700">+${formatMoney(p.montant)}</span>
                            </div>
                        </div>

                        <!-- Statut informatif sur le Dashboard -->
                        <div class="flex items-center gap-1.5 pt-2 border-t border-amber-200/80 text-[11px] font-bold text-amber-800 leading-tight">
                            <span class="flex-shrink-0">⏳</span>
                            <span class="flex-1">Paiement en attente de validation par l'administrateur</span>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70 shadow-sm">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr ${gradient} text-white font-black text-xs flex items-center justify-center flex-shrink-0">
                            ${initials}
                        </div>
                        <div class="min-w-0">
                            <p class="font-bold text-xs text-slate-900 truncate">${name}</p>
                            <span class="text-[10px] text-slate-400 font-medium">${formatDateTime(p.paid_at || p.created_at)}</span>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <span class="text-xs font-black text-emerald-600">+${formatMoney(p.montant)}</span>
                        <span class="block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">Confirmé ✅</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDashboardParticipants() {
        const container = document.getElementById('dashboard-participants-list');
        if (!container || !window.participantsManager) return;

        let list = this.participants.map(p => window.participantsManager.calculateStats(p, this.payments));

        if (this.dashboardParticipantFilter !== 'all') {
            list = list.filter(item => item.status === this.dashboardParticipantFilter);
        }

        if (list.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-slate-400 text-xs font-medium">
                    Aucun participant dans cette catégorie.
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(item => {
            const p = item.participant;
            const initials = window.participantsManager.getInitials(p.nom);
            const isCompleted = item.status === 'completed';
            const isInProgress = item.status === 'in_progress';

            let statusLabel = 'Non payé';
            let statusPillClass = 'bg-slate-100 text-slate-600 border-slate-200';
            if (isCompleted) {
                statusLabel = 'Soldé ✅';
                statusPillClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold';
            } else if (isInProgress) {
                statusLabel = 'En cours ⏳';
                statusPillClass = 'bg-amber-50 text-amber-700 border-amber-200 font-bold';
            }

            return `
                <div class="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-sky-300 transition-all cursor-pointer active:scale-[0.99]"
                     onclick="window.participantsManager.openDetailModal('${p.id}')">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                ${initials}
                            </div>
                            <div>
                                <h4 class="font-bold text-xs text-slate-900 leading-tight">${p.nom}</h4>
                                <span class="text-[10px] text-slate-400 font-medium">${formatMoney(item.totalPaid)} / ${formatMoney(item.target)}</span>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] border ${statusPillClass}">
                            ${statusLabel}
                        </span>
                    </div>

                    <div class="flex items-center gap-2">
                        <div class="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div class="h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-sky-500'}" style="width: ${item.percentage}%;"></div>
                        </div>
                        <span class="text-[10px] font-bold text-slate-500">${item.percentage}%</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    setupDashboardSummaryFilters() {
        const soldesBtn = document.getElementById('filter-soldes');
        const inProgressBtn = document.getElementById('filter-inprogress');
        const notStartedBtn = document.getElementById('filter-notstarted');

        const resetActive = () => {
            [soldesBtn, inProgressBtn, notStartedBtn].forEach(btn => {
                if (btn) btn.classList.remove('active', 'ring-2', 'ring-sky-400');
            });
        };

        if (soldesBtn) {
            soldesBtn.addEventListener('click', () => {
                if (this.dashboardParticipantFilter === 'completed') {
                    this.dashboardParticipantFilter = 'all';
                    resetActive();
                } else {
                    this.dashboardParticipantFilter = 'completed';
                    resetActive();
                    soldesBtn.classList.add('active', 'ring-2', 'ring-sky-400');
                }
                this.renderDashboardParticipants();
            });
        }

        if (inProgressBtn) {
            inProgressBtn.addEventListener('click', () => {
                if (this.dashboardParticipantFilter === 'in_progress') {
                    this.dashboardParticipantFilter = 'all';
                    resetActive();
                } else {
                    this.dashboardParticipantFilter = 'in_progress';
                    resetActive();
                    inProgressBtn.classList.add('active', 'ring-2', 'ring-sky-400');
                }
                this.renderDashboardParticipants();
            });
        }

        if (notStartedBtn) {
            notStartedBtn.addEventListener('click', () => {
                if (this.dashboardParticipantFilter === 'not_started') {
                    this.dashboardParticipantFilter = 'all';
                    resetActive();
                } else {
                    this.dashboardParticipantFilter = 'not_started';
                    resetActive();
                    notStartedBtn.classList.add('active', 'ring-2', 'ring-sky-400');
                }
                this.renderDashboardParticipants();
            });
        }
    }

    // Vue Participants complète
    renderParticipantsView() {
        const grid = document.getElementById('participants-grid');
        const filter = document.querySelector('.participant-filter-btn.active')?.getAttribute('data-filter') || 'all';
        const searchInput = document.getElementById('participant-search-input');
        const query = searchInput ? searchInput.value : '';

        if (window.participantsManager) {
            window.participantsManager.renderGrid(grid, filter, query);
        }
    }

    // Vue Historique Groupé
    renderHistoryView() {
        const container = document.getElementById('history-feed-container');
        if (!container) return;

        if (this.payments.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 px-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <span class="text-3xl block mb-2">📜</span>
                    <p class="text-slate-700 font-bold text-sm">Aucun versement dans l'historique</p>
                    <p class="text-xs text-slate-400 mt-1">Les versements confirmés apparaîtront ici automatiquement.</p>
                </div>
            `;
            return;
        }

        const groups = {};
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);

        this.payments.forEach(p => {
            const d = new Date(p.created_at || p.paid_at);
            let groupTitle = '';

            if (d.toDateString() === now.toDateString()) {
                groupTitle = "Aujourd'hui";
            } else if (d.toDateString() === yesterday.toDateString()) {
                groupTitle = "Hier";
            } else {
                groupTitle = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                groupTitle = groupTitle.charAt(0).toUpperCase() + groupTitle.slice(1);
            }

            if (!groups[groupTitle]) {
                groups[groupTitle] = [];
            }
            groups[groupTitle].push(p);
        });

        container.innerHTML = Object.keys(groups).map(title => {
            const items = groups[title];
            const groupTotal = items.filter(p => p.statut === 'completed').reduce((acc, curr) => acc + Number(curr.montant || 0), 0);

            return `
                <div class="space-y-2.5 mb-4">
                    <div class="flex items-center justify-between px-1">
                        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">${title}</h3>
                        <span class="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                            Validé : ${formatMoney(groupTotal)}
                        </span>
                    </div>
                    <div class="space-y-2">
                        ${items.map(p => {
                            const participant = this.participants.find(part => String(part.id) === String(p.participant_id));
                            const name = participant ? participant.nom : (p.participants?.nom || 'Participant');
                            const initials = window.participantsManager ? window.participantsManager.getInitials(name) : 'P';
                            const timeStr = new Date(p.created_at || p.paid_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                            const isPending = p.statut === 'pending';

                            return `
                                <div class="flex items-center justify-between p-3.5 rounded-2xl bg-white border ${isPending ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'} shadow-sm">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 font-black text-xs flex items-center justify-center flex-shrink-0">
                                            ${initials}
                                        </div>
                                        <div>
                                            <div class="flex items-center gap-1.5">
                                                <h4 class="font-bold text-xs text-slate-900">${name}</h4>
                                                <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-50 text-sky-700">Wave</span>
                                            </div>
                                            <div class="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                <span>🕒 ${timeStr}</span>
                                                <span>•</span>
                                                <span class="font-mono">Réf: ${p.wave_transaction_id || 'WAVE_PAY'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-sm font-black ${isPending ? 'text-amber-600' : 'text-emerald-600'}">
                                            +${formatMoney(p.montant)}
                                        </div>
                                        ${isPending ? `
                                            <span class="text-[10px] text-amber-600 font-bold">En attente ⏳</span>
                                        ` : `
                                            <span class="text-[10px] text-emerald-600 font-bold">Validé ✅</span>
                                        `}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Gestion du changement d'onglets
    setupNavigation() {
        const navButtons = document.querySelectorAll('[data-view-target]');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetView = btn.getAttribute('data-view-target');
                this.switchView(targetView);
            });
        });
    }

    switchView(viewName) {
        this.currentView = viewName;

        // Masquer toutes les sections
        const views = document.querySelectorAll('.app-view');
        views.forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('block');
        });

        // Afficher la vue demandée
        const targetViewEl = document.getElementById(`view-${viewName}`);
        if (targetViewEl) {
            targetViewEl.classList.remove('hidden');
            targetViewEl.classList.add('block');
        }

        // Mettre à jour l'état actif des boutons de navigation
        const navButtons = document.querySelectorAll('[data-view-target]');
        navButtons.forEach(btn => {
            const isTarget = btn.getAttribute('data-view-target') === viewName;
            if (isTarget) {
                btn.classList.add('nav-active');
            } else {
                btn.classList.remove('nav-active');
            }
        });

        // Déclencher les rendus spécifiques
        if (viewName === 'dashboard') {
            this.renderDashboard();
        } else if (viewName === 'participants') {
            this.renderParticipantsView();
        } else if (viewName === 'history') {
            this.renderHistoryView();
        } else if (viewName === 'info') {
            this.renderInfoView();
        } else if (viewName === 'admin' && window.adminManager) {
            window.adminManager.updateData(this.participants, this.payments);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setupParticipantFilters() {
        const filterBtns = document.querySelectorAll('.participant-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                filterBtns.forEach(b => {
                    b.classList.remove('active', 'bg-[#0284C7]', 'text-white');
                    b.classList.add('bg-white', 'text-slate-600', 'border', 'border-slate-200/80');
                    const span = b.querySelector('span:last-child');
                    if (span && !span.textContent.includes('Tous')) {
                        span.classList.add('text-slate-400');
                    }
                });
                btn.classList.add('active', 'bg-[#0284C7]', 'text-white');
                btn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200/80');
                this.renderParticipantsView();
            });
        });

        const searchInput = document.getElementById('participant-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.renderParticipantsView();
            });
        }

        const sortBtn = document.getElementById('participant-sort-btn');
        if (sortBtn) {
            sortBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const grid = document.getElementById('participants-grid');
                const filter = document.querySelector('.participant-filter-btn.active')?.getAttribute('data-filter') || 'all';
                const query = searchInput ? searchInput.value : '';
                if (window.participantsManager) {
                    window.participantsManager.toggleSort(grid, filter, query);
                }
            });
        }
    }
}

// Initialiser l'application
window.app = new App();
