/**
 * Gestionnaire des Participants & Affichage Stylisé (Modèle Officiel)
 */
class ParticipantsManager {
    constructor() {
        this.participants = [];
        this.payments = [];
        this.selectedParticipantId = null;
        this.sortMode = 'default'; // 'default', 'name_asc', 'amount_desc'
    }

    // Extraire les initiales (ex: "Albak" => "AL", "AKB" => "AK", "Marc Eric" => "ME")
    getInitials(name) {
        if (!name) return "??";
        const trimmed = name.trim();
        const parts = trimmed.split(/\s+/);
        if (parts.length === 1) {
            return trimmed.substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // Palette de couleurs pastel raffinées pour les avatars ronds (identique au modèle)
    getAvatarStyle(name) {
        const styles = [
            { bg: 'bg-sky-100', text: 'text-sky-600' },       // AL (Albak)
            { bg: 'bg-rose-100', text: 'text-rose-500' },     // AK (AKB)
            { bg: 'bg-emerald-100', text: 'text-emerald-600' }, // AM (Amporio)
            { bg: 'bg-amber-100', text: 'text-amber-600' },   // AR (Arthur)
            { bg: 'bg-purple-100', text: 'text-purple-600' }, // BA (Basil)
            { bg: 'bg-teal-100', text: 'text-teal-600' },     // DA (David)
            { bg: 'bg-indigo-100', text: 'text-indigo-600' }, // PA (Papos)
            { bg: 'bg-pink-100', text: 'text-pink-600' },     // ST (Stephane)
            { bg: 'bg-cyan-100', text: 'text-cyan-700' },     // TO (Tony)
            { bg: 'bg-orange-100', text: 'text-orange-600' }, // TR (Tresor)
            { bg: 'bg-violet-100', text: 'text-violet-600' }  // YV (Yves)
        ];
        
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % styles.length;
        return styles[index];
    }

    // Palette de dégradés vifs pour les cartes d'activité et badges
    getAvatarGradient(name) {
        const gradients = [
            'from-sky-500 to-blue-600',
            'from-rose-500 to-pink-600',
            'from-emerald-500 to-teal-600',
            'from-amber-500 to-orange-600',
            'from-purple-500 to-indigo-600',
            'from-teal-500 to-cyan-600',
            'from-indigo-500 to-violet-600',
            'from-pink-500 to-rose-600',
            'from-cyan-500 to-sky-600',
            'from-orange-500 to-red-600',
            'from-violet-500 to-purple-600'
        ];
        let hash = 0;
        for (let i = 0; i < (name || '').length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % gradients.length;
        return gradients[index];
    }

    // Calculer les statistiques d'un participant
    calculateStats(participant, payments) {
        const participantPayments = (payments || []).filter(p => String(p.participant_id) === String(participant.id) && p.statut === 'completed');
        const totalPaid = participantPayments.reduce((acc, curr) => acc + Number(curr.montant || 0), 0);
        const target = Number(participant.objectif || CONFIG.TARGET_PER_PARTICIPANT);
        const remaining = Math.max(0, target - totalPaid);
        const percentage = Math.min(100, Math.round((totalPaid / target) * 100));

        let status = 'not_started';
        let statusLabel = 'Non payé';

        if (totalPaid >= target) {
            status = 'completed';
            statusLabel = 'Soldé';
        } else if (totalPaid > 0) {
            status = 'in_progress';
            statusLabel = 'En cours';
        }

        return {
            participant,
            totalPaid,
            target,
            remaining,
            percentage,
            status,
            statusLabel,
            payments: participantPayments
        };
    }

    updateData(participants, payments) {
        this.participants = participants;
        this.payments = payments;
    }

    // Mettre à jour les compteurs des pilules de filtres
    updateFilterCounts(statsList) {
        const total = statsList.length;
        const completed = statsList.filter(s => s.status === 'completed').length;
        const inProgress = statsList.filter(s => s.status === 'in_progress').length;
        const notStarted = statsList.filter(s => s.status === 'not_started').length;

        const elAll = document.getElementById('filter-count-all');
        const elCompleted = document.getElementById('filter-count-completed');
        const elInProgress = document.getElementById('filter-count-in_progress');
        const elNotStarted = document.getElementById('filter-count-not_started');

        if (elAll) elAll.textContent = `(${total})`;
        if (elCompleted) elCompleted.textContent = `(${completed})`;
        if (elInProgress) elInProgress.textContent = `(${inProgress})`;
        if (elNotStarted) elNotStarted.textContent = `(${notStarted})`;
    }

    // Rendre la liste complète des participants (Modèle Exact)
    renderGrid(containerElement, filter = 'all', searchQuery = '') {
        if (!containerElement) return;

        const participantStats = this.participants.map(p => this.calculateStats(p, this.payments));
        this.updateFilterCounts(participantStats);

        let filtered = [...participantStats];

        // 1. Filtrage par statut
        if (filter !== 'all') {
            filtered = filtered.filter(item => item.status === filter);
        }

        // 2. Recherche textuelle
        if (searchQuery && searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item => item.participant.nom.toLowerCase().includes(q));
        }

        // 3. Tri
        if (this.sortMode === 'name_asc') {
            filtered.sort((a, b) => a.participant.nom.localeCompare(b.participant.nom));
        } else if (this.sortMode === 'amount_desc') {
            filtered.sort((a, b) => b.totalPaid - a.totalPaid);
        }

        if (filtered.length === 0) {
            containerElement.innerHTML = `
                <div class="text-center py-12 px-4 rounded-3xl bg-white border border-slate-200/80 shadow-sm">
                    <span class="text-3xl block mb-2">🔍</span>
                    <p class="text-slate-700 font-bold text-sm">Aucun participant trouvé</p>
                    <p class="text-xs text-slate-400 mt-1">Essayez un autre filtre ou une autre recherche.</p>
                </div>
            `;
            return;
        }

        containerElement.innerHTML = filtered.map(item => {
            const p = item.participant;
            const initials = this.getInitials(p.nom);
            const avatar = this.getAvatarStyle(p.nom);
            const isCompleted = item.status === 'completed';
            const isInProgress = item.status === 'in_progress';

            // Badge Statut
            let statusBadge = '';
            if (isCompleted) {
                statusBadge = `
                    <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/70">
                        <span>✅</span>
                        <span>Soldé</span>
                    </div>
                `;
            } else if (isInProgress) {
                statusBadge = `
                    <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200/70">
                        <span>⌛</span>
                        <span>En cours</span>
                    </div>
                `;
            } else {
                statusBadge = `
                    <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                        <span>🕒</span>
                        <span>Non payé</span>
                    </div>
                `;
            }

            return `
                <div class="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer space-y-3"
                     onclick="window.participantsManager.openDetailModal('${p.id}')">
                    
                    <!-- En-tête : Avatar Initiale, Nom, Badge Statut, Flèche -->
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-12 h-12 rounded-full ${avatar.bg} ${avatar.text} font-black text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
                                ${initials}
                            </div>
                            <div class="min-w-0">
                                <h3 class="font-extrabold text-base text-slate-900 leading-tight truncate">${p.nom}</h3>
                                <p class="text-xs text-slate-400 font-medium mt-0.5">Participant</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            ${statusBadge}
                            <span class="text-slate-300 text-base font-bold select-none">›</span>
                        </div>
                    </div>

                    <!-- Montants & Barre de progression -->
                    <div class="space-y-1.5 pt-1">
                        <div class="flex items-baseline justify-between">
                            <div class="text-xl font-black text-slate-900 tracking-tight">
                                ${formatMoney(item.totalPaid)}
                            </div>
                            <div class="text-right">
                                <span class="text-xs font-extrabold text-sky-600">${item.percentage}%</span>
                                <span class="text-xs text-slate-400 font-medium ml-1">/ ${formatMoney(item.target)}</span>
                            </div>
                        </div>

                        <!-- Barre de progression -->
                        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div class="h-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-emerald-500' : 'bg-[#1dc3eb]'}" 
                                 style="width: ${item.percentage}%">
                            </div>
                        </div>
                    </div>

                    <!-- Footer : Reste à payer & Bouton Détails -->
                    <div class="flex items-center justify-between pt-1">
                        <div class="text-xs text-slate-500 font-medium">
                            ${isCompleted 
                                ? '<span class="text-emerald-600 font-black">🎉 Cotisation soldée</span>' 
                                : `Reste : <strong class="text-amber-500 font-black">${formatMoney(item.remaining)}</strong>`
                            }
                        </div>
                        <button class="px-3.5 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-600 font-extrabold text-xs flex items-center gap-1 transition-colors">
                            <span>Détails</span>
                            <span class="text-xs">›</span>
                        </button>
                    </div>

                </div>
            `;
        }).join('');
    }

    // Basculer le mode de tri
    toggleSort(gridElement, filter, query) {
        if (this.sortMode === 'default') {
            this.sortMode = 'name_asc';
            window.notificationManager.showToast('Tri par ordre alphabétique (A-Z)', 'info', '🔤');
        } else if (this.sortMode === 'name_asc') {
            this.sortMode = 'amount_desc';
            window.notificationManager.showToast('Tri par montant le plus élevé', 'info', '💰');
        } else {
            this.sortMode = 'default';
            window.notificationManager.showToast('Ordre initial rétabli', 'info', '🔄');
        }
        this.renderGrid(gridElement, filter, query);
    }

    // Ouvrir la modale détaillée d'un participant
    openDetailModal(participantId) {
        const participant = this.participants.find(p => String(p.id) === String(participantId));
        if (!participant) return;

        const stats = this.calculateStats(participant, this.payments);
        const modal = document.getElementById('participant-modal');
        const modalContent = document.getElementById('participant-modal-content');
        if (!modal || !modalContent) return;

        const initials = this.getInitials(participant.nom);
        const avatar = this.getAvatarStyle(participant.nom);
        const isCompleted = stats.status === 'completed';

        let historyHtml = '';
        if (stats.payments.length === 0) {
            historyHtml = `
                <div class="text-center py-6 text-slate-400 text-xs">
                    <span class="text-2xl block mb-1">🏖️</span>
                    Aucun versement validé pour le moment.
                </div>
            `;
        } else {
            historyHtml = `
                <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
                    ${stats.payments.map((p, index) => `
                        <div class="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                                    #${stats.payments.length - index}
                                </div>
                                <div>
                                    <div class="font-bold text-xs text-slate-900">${formatMoney(p.montant)}</div>
                                    <div class="text-[10px] text-slate-400 font-mono">${formatDateTime(p.paid_at || p.created_at)}</div>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Confirmé ✅
                            </span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        modalContent.innerHTML = `
            <div class="p-6">
                <!-- En-tête Modale -->
                <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full ${avatar.bg} ${avatar.text} font-black text-base flex items-center justify-center shadow-sm">
                            ${initials}
                        </div>
                        <div>
                            <h3 class="font-extrabold text-lg text-slate-900 leading-tight">${participant.nom}</h3>
                            <span class="text-xs text-slate-400 font-medium">Fiche individuelle</span>
                        </div>
                    </div>
                    <button class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors" onclick="window.participantsManager.closeDetailModal()">
                        ✕
                    </button>
                </div>

                <!-- Récapitulatif Statut & Montants -->
                <div class="bg-sky-50/60 rounded-2xl p-4 border border-sky-100 mb-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-slate-500 font-medium">Progression</span>
                        <span class="text-xs font-black text-sky-700">${stats.percentage}%</span>
                    </div>
                    <div class="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-700 ${isCompleted ? 'bg-emerald-500' : 'bg-[#1dc3eb]'}" style="width: ${stats.percentage}%"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 pt-1">
                        <div class="bg-white p-2.5 rounded-xl border border-slate-100">
                            <span class="text-[10px] text-slate-400 font-bold uppercase block">Cotisé</span>
                            <span class="text-sm font-black text-slate-900">${formatMoney(stats.totalPaid)}</span>
                        </div>
                        <div class="bg-white p-2.5 rounded-xl border border-slate-100">
                            <span class="text-[10px] text-slate-400 font-bold uppercase block">Reste à payer</span>
                            <span class="text-sm font-black ${isCompleted ? 'text-emerald-600' : 'text-amber-600'}">${formatMoney(stats.remaining)}</span>
                        </div>
                    </div>
                </div>

                <!-- Historique des versements du participant -->
                <div class="space-y-2 mb-4">
                    <h4 class="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Versements confirmés</h4>
                    ${historyHtml}
                </div>

                <!-- Bouton d'action rapide vers paiement -->
                ${!isCompleted ? `
                    <button class="w-full py-3.5 px-4 rounded-2xl bg-[#1dc3eb] hover:bg-[#18b0d5] text-white font-black text-sm shadow-md transition-all active:scale-98 flex items-center justify-center gap-2"
                            onclick="window.participantsManager.selectAndPay('${participant.id}')">
                        <img src="assets/images/wave-logo.png" alt="Wave" class="w-5 h-5 rounded-full object-cover">
                        <span>Payer pour ${participant.nom} →</span>
                    </button>
                ` : `
                    <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center text-xs font-bold text-emerald-700">
                        🎉 Félicitations ! Participation entièrement soldée.
                    </div>
                `}
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeDetailModal() {
        const modal = document.getElementById('participant-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    selectAndPay(participantId) {
        this.closeDetailModal();
        if (window.app && typeof window.app.switchView === 'function') {
            window.app.switchView('dashboard');
        }
        const select = document.getElementById('payment-participant-select');
        if (select) {
            select.value = participantId;
            if (window.paymentsManager) {
                window.paymentsManager.handleParticipantSelect(participantId);
            }
        }
    }
}

window.participantsManager = new ParticipantsManager();
