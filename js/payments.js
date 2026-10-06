/**
 * Gestionnaire des Paiements Wave & Simulations
 */
class PaymentsManager {
    constructor() {
        this.selectedParticipant = null;
        this.currentAmount = 0;
        this.isProcessing = false;
        this.init();
    }

    init() {
        // Écouteur sur le sélecteur de participant
        const select = document.getElementById('payment-participant-select');
        if (select) {
            select.addEventListener('change', (e) => this.handleParticipantSelect(e.target.value));
        }

        // Écouteur sur le champ de saisie du montant
        const input = document.getElementById('payment-amount-input');
        if (input) {
            input.addEventListener('input', (e) => this.handleAmountInput(e.target.value));
        }

        // Écouteurs sur les boutons rapides de montant (300, 1500, 7000)
        const quickBtns = document.querySelectorAll('.quick-pill, .quick-amount-btn, [data-amount]');
        quickBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const amountVal = btn.getAttribute('data-amount');
                this.setQuickAmount(amountVal, btn);
            });
        });

        // Écouteur sur le bouton Wave
        const wavePayBtn = document.getElementById('wave-pay-btn');
        if (wavePayBtn) {
            wavePayBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.initiatePayment();
            });
        }
    }

    // Mise à jour de la liste déroulante des participants
    populateParticipantSelect(participants) {
        const select = document.getElementById('payment-participant-select');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = `<option value="" disabled selected>👉 Choisir ton nom dans la liste</option>` +
            participants.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');

        if (currentVal && participants.some(p => String(p.id) === String(currentVal))) {
            select.value = currentVal;
            this.handleParticipantSelect(currentVal);
        }
    }

    handleParticipantSelect(participantId) {
        if (!participantId) {
            this.selectedParticipant = null;
            this.renderParticipantSummary(null);
            this.updatePayButtonState();
            return;
        }

        const participants = window.participantsManager.participants;
        const payments = window.participantsManager.payments;
        const p = participants.find(item => String(item.id) === String(participantId));
        
        if (p) {
            const stats = window.participantsManager.calculateStats(p, payments);
            this.selectedParticipant = stats;
            this.renderParticipantSummary(stats);

            // Conserver le montant sélectionné ou auto-ajuster
            const input = document.getElementById('payment-amount-input');
            if (input && (!this.currentAmount || this.currentAmount <= 0) && stats.remaining > 0) {
                const defaultAmt = Math.min(1500, stats.remaining);
                input.value = defaultAmt;
                this.currentAmount = defaultAmt;
            }
            this.updatePayButtonState();
        }
    }

    handleAmountInput(value) {
        const numeric = Number(String(value).replace(/[^0-9]/g, '')) || 0;
        this.currentAmount = numeric;

        // Mise à jour de l'état actif des boutons rapides
        document.querySelectorAll('.quick-pill, .quick-amount-btn').forEach(b => {
            const bAmt = Number(b.getAttribute('data-amount'));
            if (bAmt === numeric && numeric > 0) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });

        this.updatePayButtonState();
    }

    // Définir le montant depuis un bouton rapide d'exemple
    setQuickAmount(type, clickedBtn = null) {
        const numeric = Number(type) || 0;
        const input = document.getElementById('payment-amount-input');
        
        if (input) {
            input.value = numeric;
            this.currentAmount = numeric;
            
            // Animation visuelle de saisie
            input.classList.add('ring-2', 'ring-[#1dc3eb]', 'bg-sky-50');
            setTimeout(() => {
                input.classList.remove('ring-2', 'ring-[#1dc3eb]', 'bg-sky-50');
            }, 300);
        }

        // Surbrillance active du bouton sélectionné
        document.querySelectorAll('.quick-pill, .quick-amount-btn').forEach(b => b.classList.remove('active'));
        if (clickedBtn) {
            clickedBtn.classList.add('active');
        } else {
            const matchBtn = document.querySelector(`[data-amount="${type}"]`);
            if (matchBtn) matchBtn.classList.add('active');
        }

        this.updatePayButtonState();
    }

    renderParticipantSummary(stats) {
        const container = document.getElementById('participant-payment-preview');
        if (!container) return;

        if (!stats) {
            container.innerHTML = ``;
            return;
        }

        const isCompleted = stats.status === 'completed';

        container.innerHTML = `
            <div class="bg-sky-50/80 rounded-2xl p-4 border border-sky-200/80 space-y-2.5">
                <div class="flex items-center justify-between">
                    <div>
                        <span class="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">Participant sélectionné</span>
                        <h4 class="text-sm font-black text-slate-900">${stats.participant.nom}</h4>
                    </div>
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                        ${stats.statusLabel}
                    </span>
                </div>

                <!-- Grille 3 chiffres -->
                <div class="grid grid-cols-3 gap-1.5 bg-white rounded-xl p-2.5 border border-sky-100 text-center">
                    <div>
                        <span class="text-[9px] text-slate-400 block">Déjà versé</span>
                        <span class="text-xs font-black text-slate-900">${formatMoney(stats.totalPaid)}</span>
                    </div>
                    <div>
                        <span class="text-[9px] text-slate-400 block">Reste</span>
                        <span class="text-xs font-black ${isCompleted ? 'text-emerald-600' : 'text-amber-600'}">${formatMoney(stats.remaining)}</span>
                    </div>
                    <div>
                        <span class="text-[9px] text-slate-400 block">Objectif</span>
                        <span class="text-xs font-black text-slate-900">${formatMoney(stats.target)}</span>
                    </div>
                </div>

                <!-- Barre -->
                <div class="space-y-1">
                    <div class="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                        <span>Progression</span>
                        <span class="font-bold text-sky-700">${stats.percentage}%</span>
                    </div>
                    <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-sky-500'}" style="width: ${stats.percentage}%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    updatePayButtonState() {
        const btn = document.getElementById('wave-pay-btn');
        const errorEl = document.getElementById('payment-validation-error');
        if (!btn) return;

        let errorMsg = '';
        let isValid = true;

        if (!this.selectedParticipant) {
            isValid = false;
            errorMsg = "Veuillez choisir un participant.";
        } else if (this.selectedParticipant.remaining <= 0) {
            isValid = false;
            errorMsg = "Objectif individuel déjà atteint ! Aucun montant supplémentaire requis.";
        } else if (!this.currentAmount || this.currentAmount <= 0) {
            isValid = false;
            errorMsg = "Veuillez saisir un montant supérieur à 0 FCFA.";
        } else if (this.currentAmount > this.selectedParticipant.remaining) {
            isValid = false;
            errorMsg = `Le montant ne peut pas dépasser le reste à payer (${formatMoney(this.selectedParticipant.remaining)}).`;
        }

        // Le bouton reste TOUJOURS avec sa couleur bleu Wave vive sans opacité
        btn.disabled = false;
        btn.dataset.valid = isValid ? 'true' : 'false';

        if (errorEl) {
            if (errorMsg && (this.currentAmount > 0 || (this.selectedParticipant && this.selectedParticipant.remaining <= 0))) {
                errorEl.textContent = errorMsg;
                errorEl.classList.remove('hidden');
            } else {
                errorEl.classList.add('hidden');
            }
        }
    }

    // Lancer le flux de paiement Wave
    async initiatePayment() {
        if (this.isProcessing) return;

        // 1. Vérification du participant
        if (!this.selectedParticipant) {
            const select = document.getElementById('payment-participant-select');
            if (select) {
                select.focus();
                select.classList.add('ring-2', 'ring-[#1dc3eb]');
                setTimeout(() => select.classList.remove('ring-2', 'ring-[#1dc3eb]'), 1200);
            }
            window.notificationManager.showInfo("👆 Veuillez d'abord choisir votre nom dans la liste.", "warning");
            return;
        }

        // 2. Vérification du montant
        if (!this.currentAmount || this.currentAmount <= 0) {
            const input = document.getElementById('payment-amount-input');
            if (input) {
                input.focus();
                input.classList.add('ring-2', 'ring-[#1dc3eb]');
                setTimeout(() => input.classList.remove('ring-2', 'ring-[#1dc3eb]'), 1200);
            }
            window.notificationManager.showInfo("💰 Veuillez choisir ou saisir un montant à verser.", "warning");
            return;
        }

        const participant = this.selectedParticipant.participant;
        const amount = this.currentAmount;
        const remaining = this.selectedParticipant.remaining;

        if (remaining <= 0) {
            window.notificationManager.showInfo("🎉 Votre participation est déjà entièrement soldée !", "info");
            return;
        }

        if (amount > remaining) {
            window.notificationManager.showInfo(`Le montant saisi (${formatMoney(amount)}) dépasse votre reste à payer (${formatMoney(remaining)}).`, 'error');
            return;
        }

        this.openWaveCheckoutModal(participant, amount);
    }

    // Modal de confirmation & paiement Wave
    openWaveCheckoutModal(participant, amount) {
        const modal = document.getElementById('wave-checkout-modal');
        const modalContent = document.getElementById('wave-checkout-content');
        if (!modal || !modalContent) return;

        const txRef = `WAVE_TX_${Date.now().toString().slice(-6)}`;
        
        // Construction de l'URL Wave officielle avec pré-remplissage du montant
        const rawBaseUrl = (CONFIG.WAVE_PAYMENT_URL || "https://pay.wave.com/m/M_ci_NvjJ2LHyaS6A/c/ci/").trim();
        const cleanBase = rawBaseUrl.replace(/\/+$/, '');
        const separator = cleanBase.includes('?') ? '&' : '?';
        const waveUrlWithAmount = `${cleanBase}${separator}amount=${amount}&a=${amount}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(waveUrlWithAmount)}`;

        modalContent.innerHTML = `
            <div class="p-6">
                <!-- En-tête Wave -->
                <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-[#1dc3eb] flex items-center justify-center shadow-md shadow-[#1dc3eb]/30 overflow-hidden">
                            <img src="assets/images/wave-logo.png" alt="Wave" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <h3 class="font-bold text-base text-slate-900 dark:text-white">Paiement Wave</h3>
                            <span class="text-[11px] text-slate-400 font-mono">Réf: ${txRef}</span>
                        </div>
                    </div>
                    <button class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors" onclick="window.paymentsManager.closeWaveModal()">
                        ✕
                    </button>
                </div>

                <!-- Récapitulatif du paiement -->
                <div class="bg-sky-50 dark:bg-sky-950/40 rounded-2xl p-4 border border-sky-200 dark:border-sky-800/60 mb-4 text-center">
                    <span class="text-xs text-sky-800 dark:text-sky-300 font-medium block mb-0.5">Montant à verser</span>
                    <div class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">${formatMoney(amount)}</div>
                    <span class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">Participant : <strong>${participant.nom}</strong></span>
                </div>

                <!-- QR Code & Étape 1 : Ouvrir Wave -->
                <div class="space-y-3 mb-5">
                    <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-center">
                        <span class="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">
                            1. Réglez via votre application Wave
                        </span>
                        
                        <!-- Bouton Ouvrir Wave Mobile avec Montant Pré-rempli -->
                        <a href="${waveUrlWithAmount}" target="_blank" rel="noopener noreferrer"
                           class="w-full py-3.5 px-4 rounded-xl bg-[#1dc3eb] hover:bg-[#18b0d5] active:scale-95 text-white font-black text-sm shadow-md shadow-[#1dc3eb]/30 transition-all flex items-center justify-center gap-2 mb-3">
                            <img src="assets/images/wave-logo.png" alt="Wave" class="w-5 h-5 rounded-full object-cover">
                            <span>Ouvrir Wave et Payer (${formatMoney(amount)})</span>
                            <span>↗</span>
                        </a>

                        <!-- QR Code pour utilisateur sur PC -->
                        <div class="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center">
                            <span class="text-[11px] text-slate-400 mb-2">Ou scannez ce QR Code avec votre téléphone Wave :</span>
                            <div class="p-2 bg-white rounded-xl shadow-sm border border-slate-200 inline-block">
                                <img src="${qrCodeUrl}" alt="QR Code Wave" class="w-32 h-32 object-contain rounded-lg">
                            </div>
                        </div>
                    </div>

                    <!-- Étape 2 : Confirmer la cotisation -->
                    <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-center">
                        <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-2">
                            2. Une fois le virement envoyé :
                        </span>
                        <button id="wave-confirm-btn" class="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                                onclick="window.paymentsManager.processWavePayment('${participant.id}', ${amount}, '${txRef}')">
                            <span>✅</span>
                            <span>Valider mon versement sur le site</span>
                        </button>
                    </div>
                </div>

                <div class="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                    <span>🔒</span>
                    <span>Lien direct officiel Wave Côte d'Ivoire</span>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeWaveModal() {
        const modal = document.getElementById('wave-checkout-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    // Traiter le paiement (simulateur ou vrai backend)
    async processWavePayment(participantId, amount, txRef) {
        const confirmBtn = document.getElementById('wave-confirm-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `
                <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-950" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Communication avec Wave...
            `;
        }

        // Sauvegarder l'état précédent pour l'animation
        const participant = window.participantsManager.participants.find(p => String(p.id) === String(participantId));
        const prevStats = window.participantsManager.calculateStats(participant, window.participantsManager.payments);
        const previousTotal = prevStats.totalPaid;
        const target = prevStats.target;

        // Simulation du délai réseau réaliste Wave (1,2 secondes)
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Enregistrement du paiement en attente de validation via le service de données
        const paymentPayload = {
            participant_id: participantId,
            montant: Number(amount),
            wave_transaction_id: txRef,
            statut: 'pending'
        };

        await window.dataService.addPayment(paymentPayload);

        // Fermer la modal Wave Checkout
        this.closeWaveModal();

        // Réinitialiser les champs de paiement
        const amountInput = document.getElementById('payment-amount-input');
        if (amountInput) amountInput.value = '';
        this.currentAmount = 0;

        // Déclencher le toast informatif
        window.notificationManager.showToast(`Versement de ${formatMoney(amount)} envoyé ! En attente de validation.`, 'info', '⏳');

        // Afficher l'écran d'attente de validation
        this.showPendingCelebration(participant.nom, amount, txRef);
    }

    // Écran de confirmation de versement envoyé (en attente admin)
    showPendingCelebration(participantName, amountPaid, txRef) {
        const modal = document.getElementById('success-modal');
        const modalContent = document.getElementById('success-modal-content');
        if (!modal || !modalContent) return;

        modalContent.innerHTML = `
            <div class="p-6 text-center">
                <!-- Icone sablier animée -->
                <div class="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 text-white text-3xl flex items-center justify-center shadow-xl shadow-amber-500/30 mb-4 animate-pulse">
                    ⏳
                </div>

                <span class="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 mb-2">
                    En cours de validation
                </span>

                <h2 class="text-2xl font-black text-slate-900 dark:text-white mb-1">
                    +${formatMoney(amountPaid)}
                </h2>
                <p class="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-5">
                    Participant : <strong>${participantName}</strong>
                </p>

                <!-- Information de validation -->
                <div class="bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/50 mb-6 text-left space-y-2">
                    <div class="flex items-start gap-2.5">
                        <span class="text-base flex-shrink-0">📲</span>
                        <p class="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                            Votre déclaration de paiement a bien été reçue. 
                        </p>
                    </div>
                    <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-6">
                        Dès que l'administrateur valide la réception des fonds sur Wave, votre cotisation sera <strong>automatiquement ajoutée à la cagnotte</strong> et visible par tous les amis.
                    </p>
                    <div class="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 text-[11px] text-slate-400 font-mono text-center">
                        Réf transaction : ${txRef}
                    </div>
                </div>

                <!-- Bouton Retour -->
                <button class="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm shadow-lg transition-all"
                        onclick="window.paymentsManager.closeSuccessModal()">
                    D'accord, retour au tableau de bord 👍
                </button>
            </div>
        `;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeSuccessModal() {
        const modal = document.getElementById('success-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        if (window.app) {
            window.app.switchView('dashboard');
        }
    }

    // Animation de confettis en Canvas ultra-légère (zéro lib externe)
    launchConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const pieces = [];
        const colors = ['#087EA4', '#06B6D4', '#10B981', '#FBBF24', '#F43F5E', '#8B5CF6', '#1DC5D8'];
        const numPieces = 80;

        for (let i = 0; i < numPieces; i++) {
            pieces.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 16,
                vy: (Math.random() - 0.7) * 16,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rSpeed: (Math.random() - 0.5) * 10,
                alpha: 1
            });
        }

        let animationFrame;
        let elapsed = 0;

        function render() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            elapsed++;

            pieces.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.35; // gravité
                p.rotation += p.rSpeed;
                p.alpha -= 0.012;

                if (p.alpha > 0) {
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, p.alpha);
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    ctx.restore();
                }
            });

            if (elapsed < 90) {
                animationFrame = requestAnimationFrame(render);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        render();
    }
}

window.paymentsManager = new PaymentsManager();
