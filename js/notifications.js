/**
 * Gestionnaire Avancé de Notifications & Installation PWA (iOS / Android)
 * - Notifications Natives (Web Push & Notification API)
 * - Notifications Toast In-App
 * - Synchronisation multi-appareils / multi-onglets en direct (BroadcastChannel + Realtime)
 * - Prompt d'installation PWA guidé pour iPhone (Safari) et Android (Chrome)
 */

class NotificationManager {
    constructor() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(this.container);
        }
        
        this.audioCtx = null;
        this.swRegistration = null;
        this.broadcastChannel = null;
        this.deferredPrompt = null; // Pour Android / Chrome PWA install

        this.init();
    }

    async init() {
        // 1. Initialiser le Service Worker
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('./sw.js');
                console.log("📲 Service Worker PWA enregistré avec succès !");
            } catch (err) {
                console.warn("Échec de l'enregistrement du Service Worker :", err);
            }
        }

        // 2. Initialiser le canal BroadcastChannel pour synchroniser instantanément tous les onglets ouverts
        if ('BroadcastChannel' in window) {
            try {
                this.broadcastChannel = new BroadcastChannel('cagnotte_plage_channel');
                this.broadcastChannel.onmessage = (event) => {
                    this.handleBroadcastMessage(event.data);
                };
            } catch (e) {
                console.warn("BroadcastChannel non supporté :", e);
            }
        }

        // 3. Écouteur pour l'installation PWA Android / Chrome
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallBanner('android');
        });

        // Détection de l'installation réussie
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.hideInstallBanner();
            this.showInfo("🎉 Application installée avec succès sur votre écran d'accueil !", "info");
        });

        // 4. Détection iOS pour proposer l'installation si l'utilisateur est sur iPhone / iPad et pas encore en mode standalone
        this.checkIosInstall();

        // 5. Mettre à jour l'état du bouton de cloche de notification
        this.updateNotificationUiState();
    }

    // Vérifie si l'application s'exécute déjà en mode autonome (installée)
    isStandalone() {
        return (window.matchMedia('(display-mode: standalone)').matches) || 
               (window.navigator.standalone === true);
    }

    // Détection spécifique iOS Safari
    checkIosInstall() {
        const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
        const isSafari = /safari/.test(window.navigator.userAgent.toLowerCase()) && !/chrome|crios|fxios/.test(window.navigator.userAgent.toLowerCase());
        
        if (isIos && isSafari && !this.isStandalone()) {
            // Afficher le guide iOS si l'utilisateur ne l'a pas déjà fermé
            const dismissed = localStorage.getItem('cagnotte_ios_install_dismissed');
            if (!dismissed) {
                setTimeout(() => {
                    this.showInstallBanner('ios');
                }, 3000);
            }
        }
    }

    // Afficher la bannière d'installation PWA
    showInstallBanner(platform) {
        if (this.isStandalone()) return;

        const banner = document.getElementById('pwa-install-banner');
        if (!banner) return;

        const btn = document.getElementById('pwa-install-action-btn');
        const desc = document.getElementById('pwa-install-desc');

        if (platform === 'ios') {
            if (desc) desc.textContent = "Ajouter à l'écran d'accueil en 2 clics !";
            if (btn) {
                btn.textContent = "📲 Installer";
                btn.onclick = () => this.showIosGuideModal();
            }
        } else {
            if (desc) desc.textContent = "Accès direct et alertes en direct.";
            if (btn) {
                btn.textContent = "📲 Installer";
                btn.onclick = () => this.promptAndroidInstall();
            }
        }

        banner.classList.remove('hidden');
    }

    hideInstallBanner() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) banner.classList.add('hidden');
        localStorage.setItem('cagnotte_ios_install_dismissed', 'true');
    }

    // Lancer le prompt natif Android
    async promptAndroidInstall() {
        if (!this.deferredPrompt) {
            this.showToast("Appuyez sur le menu (⋮) de Chrome puis 'Installer l'application'.", "info", "📲");
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`Résultat de l'installation : ${outcome}`);
        this.deferredPrompt = null;
        this.hideInstallBanner();
    }

    // Afficher la modale explicative pour iPhone (Safari)
    showIosGuideModal() {
        const modal = document.getElementById('ios-install-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    closeIosGuideModal() {
        const modal = document.getElementById('ios-install-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    // Demande de permission pour les notifications natives
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
            if (isIos && !this.isStandalone()) {
                this.showIosGuideModal();
                this.showToast("Sur iPhone, ajoutez l'app sur l'écran d'accueil pour activer les notifications système !", "info", "📲");
                return false;
            }
            this.showToast("Les notifications sont synchronisées en direct dans l'application !", "info", "🔔");
            return false;
        }

        try {
            // Activer également OneSignal Push
            if (window.OneSignalDeferred) {
                window.OneSignalDeferred.push(async function(OneSignal) {
                    try {
                        if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) {
                            await OneSignal.Notifications.requestPermission();
                        }
                    } catch (e) {
                        console.warn("OneSignal permission call:", e);
                    }
                });
            }

            const permission = await Notification.requestPermission();
            this.updateNotificationUiState();

            if (permission === 'granted') {
                this.showToast("Super ! Notifications push activées sur votre appareil.", "success", "🔔");
                this.sendNativeNotification("🏖️ Notifications Activées !", {
                    body: "Vous serez averti en direct à chaque cotisation ou annonce.",
                    icon: './assets/icons/icon-192.png'
                });
                return true;
            } else {
                this.showToast("Notifications désactivées ou en attente.", "warning", "🔕");
                return false;
            }
        } catch (err) {
            console.error("Erreur demande permission notifications:", err);
            return false;
        }
    }

    // Mettre à jour l'UI (icône de cloche dans le header)
    updateNotificationUiState() {
        const bellBtn = document.getElementById('header-notify-btn');
        const bellIcon = document.getElementById('header-notify-icon');
        const bellDot = document.getElementById('header-notify-dot');
        if (!bellBtn) return;

        // La cloche reste TOUJOURS visible sur tous les écrans (mobile et desktop)
        bellBtn.style.display = 'flex';

        if ('Notification' in window && Notification.permission === 'granted') {
            if (bellDot) bellDot.classList.remove('hidden');
            bellBtn.title = "Notifications activées";
            if (bellIcon) bellIcon.textContent = "🔔";
        } else {
            if (bellDot) bellDot.classList.add('hidden');
            bellBtn.title = "Activer les notifications push";
            if (bellIcon) bellIcon.textContent = "🔔";
        }
    }

    // Envoyer une notification native sur le téléphone / ordinateur
    async sendNativeNotification(title, options = {}) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        const defaultOptions = {
            body: options.body || "Mise à jour sur la cagnotte Sortie Plage 🏖️",
            icon: options.icon || './assets/icons/icon-192.png',
            badge: options.badge || './assets/icons/icon-192.png',
            vibrate: [200, 100, 200, 100, 200],
            tag: 'cagnotte-update-' + Date.now(),
            renotify: true,
            data: {
                url: './index.html'
            }
        };

        const finalOptions = Object.assign(defaultOptions, options);

        try {
            // Utiliser le Service Worker actif (indispensable sur iPhone PWA et Android)
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg && 'showNotification' in reg) {
                    await reg.showNotification(title, finalOptions);
                    return;
                }
            }
            new Notification(title, finalOptions);
        } catch (e) {
            console.warn("Impossible d'afficher la notification système :", e);
        }
    }

    // Diffuser un événement à tous les autres onglets et fenêtres
    broadcastEvent(eventType, payload) {
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({ eventType, payload, timestamp: Date.now() });
        }
    }

    // Traitement des messages reçus d'autres onglets
    handleBroadcastMessage(data) {
        if (!data || !data.eventType) return;

        if (data.eventType === 'NEW_PAYMENT') {
            const p = data.payload;
            this.showPaymentToast(p.participantName, p.montant, p.currentTotal, p.targetAmount);
            this.sendNativeNotification(`🌊 Nouveau versement de ${p.participantName} !`, {
                body: `${p.participantName} a cotisé ${formatMoney(p.montant)} avec Wave.`,
                icon: './assets/images/wave-logo.png'
            });
        } else if (data.eventType === 'VALIDATE_PAYMENT') {
            const p = data.payload;
            this.showInfo(`✅ Versement de ${formatMoney(p.montant)} validé pour ${p.participantName} !`, "info", "wave");
            this.sendNativeNotification(`✅ Versement validé !`, {
                body: `Le versement de ${formatMoney(p.montant)} pour ${p.participantName} a été approuvé.`,
                icon: './assets/images/wave-logo.png'
            });
        } else if (data.eventType === 'NEW_PARTICIPANT') {
            const p = data.payload;
            this.showInfo(`👥 ${p.nom} a rejoint la liste des participants !`, "info");
            this.sendNativeNotification(`👥 Nouveau participant !`, {
                body: `${p.nom} participe à la sortie plage !`,
                icon: './assets/icons/icon-192.png'
            });
        } else if (data.eventType === 'ANNOUNCEMENT') {
            const title = data.payload.title || "📢 Message de l'organisateur";
            const msg = data.payload.message || data.payload.body || "";
            this.showToast(`<div class="font-bold text-xs text-sky-400">${title}</div><div class="text-xs text-slate-200 mt-0.5">${msg}</div>`, "info", "📢", "bird");
            this.sendNativeNotification(title, {
                body: msg,
                icon: './assets/icons/icon-192.png'
            });
        } else if (data.eventType === 'CONFIG_UPDATED') {
            if (window.app) {
                if (typeof window.app.renderInfoView === 'function') window.app.renderInfoView();
                if (typeof window.app.renderDashboard === 'function') window.app.renderDashboard();
                if (window.app.countdown && CONFIG.EVENT_DATE) {
                    window.app.countdown.setTargetDate(CONFIG.EVENT_DATE);
                }
            }
        }
    }

    // 🐦 SON 1 : Gazouillis & Chant d'oiseaux tropicaux (Pour les diffuseurs de notification / annonces)
    playBirdChirpSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            if (!this.audioCtx) {
                this.audioCtx = new AudioContext();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const ctx = this.audioCtx;
            const now = ctx.currentTime;

            // Master Gain amplifié pour un volume puissant et net
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.85, now);
            masterGain.connect(ctx.destination);

            // Synthétiseur d'un chant d'oiseau réaliste par balayage de fréquence harmonique
            const createChirp = (startTime, startFreq, peakFreq, endFreq, duration, volume) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                filter.type = 'bandpass';
                filter.frequency.setValueAtTime((startFreq + peakFreq) / 2, startTime);
                filter.Q.setValueAtTime(3.5, startTime);

                osc.type = 'sine';
                osc.frequency.setValueAtTime(startFreq, startTime);
                osc.frequency.exponentialRampToValueAtTime(peakFreq, startTime + duration * 0.35);
                osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

                gain.gain.setValueAtTime(0.001, startTime);
                gain.gain.linearRampToValueAtTime(volume, startTime + duration * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(masterGain);

                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            // Séquence de gazouillis joyeux et nets
            createChirp(now + 0.00, 2800, 4800, 3200, 0.12, 0.65);
            createChirp(now + 0.13, 3100, 5300, 3400, 0.11, 0.75);
            createChirp(now + 0.26, 2900, 5800, 3600, 0.14, 0.85);
            createChirp(now + 0.44, 3300, 6400, 3900, 0.16, 0.80);
            createChirp(now + 0.64, 3700, 5900, 4200, 0.13, 0.60);
        } catch (e) {
            console.warn("Son d'oiseau indisponible ou bloqué:", e);
        }

        // Vibration haptique sur smartphone
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate([80, 50, 80, 50, 120]);
            } catch (e) {}
        }
    }

    // 🌊 SON 2 : Bruit de Vague de Mer & Écume (Pour les paiements validés / versements)
    playOceanWaveSound() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            if (!this.audioCtx) {
                this.audioCtx = new AudioContext();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const ctx = this.audioCtx;
            const now = ctx.currentTime;
            const duration = 3.0; // 3 secondes de déferlement de vague

            // Master Gain amplifié pour une présence sonore claire et immersive
            const masterGain = ctx.createGain();
            masterGain.gain.setValueAtTime(0.9, now);
            masterGain.connect(ctx.destination);

            // 1. Générateur de bruit (Houle & Ressac marin)
            const bufferSize = Math.floor(ctx.sampleRate * duration);
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut * 0.94) + (white * 0.06);
                lastOut = output[i];
            }

            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;

            // Filtre résonant dynamique balayant de la montée au déferlement
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.setValueAtTime(3.8, now);
            filter.frequency.setValueAtTime(200, now);
            filter.frequency.exponentialRampToValueAtTime(1400, now + 1.1); // Montée de la vague
            filter.frequency.exponentialRampToValueAtTime(3000, now + 1.5); // Écume & éclaboussure
            filter.frequency.exponentialRampToValueAtTime(160, now + duration); // Retrait de l'eau

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.001, now);
            noiseGain.gain.linearRampToValueAtTime(0.75, now + 1.1);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            whiteNoise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(masterGain);

            whiteNoise.start(now);
            whiteNoise.stop(now + duration);

            // 2. Onde sub-bass (Profondeur de la mer)
            const subOsc = ctx.createOscillator();
            const subGain = ctx.createGain();
            subOsc.type = 'sine';
            subOsc.frequency.setValueAtTime(80, now);
            subOsc.frequency.exponentialRampToValueAtTime(130, now + 1.0);
            subOsc.frequency.exponentialRampToValueAtTime(50, now + duration);

            subGain.gain.setValueAtTime(0.001, now);
            subGain.gain.linearRampToValueAtTime(0.45, now + 1.0);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

            subOsc.connect(subGain);
            subGain.connect(masterGain);

            subOsc.start(now);
            subOsc.stop(now + duration);

            // 3. Clochette cristalline de validation (+ accord harmonieux)
            const chimeTimes = [0.1, 0.3, 0.55];
            const chimeFreqs = [784.00, 1046.50, 1318.51]; // G5, C6, E6
            chimeTimes.forEach((t, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(chimeFreqs[idx], now + t);
                gain.gain.setValueAtTime(0.001, now + t);
                gain.gain.linearRampToValueAtTime(0.25, now + t + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.6);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + t);
                osc.stop(now + t + 0.6);
            });
        } catch (e) {
            console.warn("Son de vague indisponible ou bloqué:", e);
        }

        // Vibration haptique sur smartphone
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate([150, 100, 250]);
            } catch (e) {}
        }
    }

    // Alias générique pour compatibilité
    playNotificationSound(soundType = 'bird') {
        if (soundType === 'wave') {
            this.playOceanWaveSound();
        } else {
            this.playBirdChirpSound();
        }
    }

    // Afficher une notification de paiement en temps réel (Son de vague de mer 🌊)
    showPaymentToast(participantName, amount, currentTotal, targetAmount) {
        this.playOceanWaveSound();

        const toast = document.createElement('div');
        toast.className = 'pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white border border-sky-400/40 rounded-2xl p-4 shadow-2xl flex items-start gap-3.5 transform transition-all duration-300 translate-y-[-20px] opacity-0';
        
        const isSold = currentTotal >= targetAmount;

        toast.innerHTML = `
            <div class="w-11 h-11 rounded-xl bg-[#1dc3eb] flex items-center justify-center text-xl flex-shrink-0 shadow-lg shadow-[#1dc3eb]/30 overflow-hidden p-0.5">
                <img src="assets/images/wave-logo.png" alt="Wave" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <h4 class="font-bold text-xs text-[#1dc3eb] uppercase tracking-wider">Versement Wave reçu !</h4>
                    <span class="text-[11px] text-slate-400 font-mono">À l'instant</span>
                </div>
                <p class="text-sm font-semibold text-white truncate mt-0.5">${participantName}</p>
                <div class="flex items-center gap-2 mt-1">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#1dc3eb]/20 text-[#1dc3eb] border border-[#1dc3eb]/30">
                        +${formatMoney(amount)}
                    </span>
                    <span class="text-xs text-slate-300">
                        Total : <strong class="${isSold ? 'text-emerald-400' : 'text-amber-300'}">${formatMoney(currentTotal)}</strong> / ${formatMoney(targetAmount)}
                    </span>
                </div>
                ${isSold ? `<div class="mt-1.5 text-xs text-emerald-300 font-medium flex items-center gap-1">🎉 Objectif individuel atteint !</div>` : ''}
            </div>
            <button class="text-slate-400 hover:text-white p-1 transition-colors self-start" onclick="this.parentElement.remove()" title="Fermer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;

        this.container.appendChild(toast);

        // Animation d'entrée
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-[-20px]', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        });

        // Auto-fermeture après 6 secondes
        setTimeout(() => {
            toast.classList.add('translate-y-[-20px]', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 6000);
    }

    // Toast générique (info, alerte)
    showInfo(message, type = 'info', soundType = 'bird') {
        this.showToast(message, type, null, soundType);
    }

    // Toast polyvalent avec icône personnalisée et sélection du son
    showToast(message, type = 'info', customIcon = null, soundType = 'bird') {
        if (soundType === 'wave') {
            this.playOceanWaveSound();
        } else if (soundType === 'bird') {
            this.playBirdChirpSound();
        }

        const toast = document.createElement('div');
        const bgColors = type === 'error' 
            ? 'bg-rose-900/95 border-rose-500/40 text-rose-100' 
            : type === 'warning'
            ? 'bg-amber-900/95 border-amber-500/40 text-amber-100'
            : type === 'success'
            ? 'bg-slate-900/95 border-emerald-500/40 text-white'
            : 'bg-slate-900/95 border-sky-400/40 text-white';
            
        const defaultIcon = type === 'error' ? '⚠️' : type === 'warning' ? '⚡' : type === 'success' ? '✅' : '🔔';
        const displayIcon = customIcon || defaultIcon;

        toast.className = `pointer-events-auto ${bgColors} backdrop-blur-md border rounded-2xl p-4 shadow-xl flex items-center gap-3 transform transition-all duration-300 translate-y-[-20px] opacity-0 text-sm font-medium`;
        
        toast.innerHTML = `
            <span class="text-xl flex-shrink-0">${displayIcon}</span>
            <div class="flex-1">${message}</div>
            <button class="opacity-70 hover:opacity-100 p-1 flex-shrink-0" onclick="this.parentElement.remove()">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        `;

        this.container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-[-20px]', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        });

        setTimeout(() => {
            toast.classList.add('translate-y-[-20px]', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 4500);
    }
}

window.notificationManager = new NotificationManager();
