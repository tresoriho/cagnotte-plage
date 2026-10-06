/**
 * Gestionnaire du compte à rebours de l'événement
 */
class CountdownManager {
    constructor(targetDateIso) {
        this.targetDate = new Date(targetDateIso).getTime();
        this.timerInterval = null;
        
        this.daysEl = document.getElementById('count-days');
        this.hoursEl = document.getElementById('count-hours');
        this.minutesEl = document.getElementById('count-minutes');
        this.secondsEl = document.getElementById('count-seconds');
        this.countdownContainer = document.getElementById('countdown-container');
        this.countdownStatusMessage = document.getElementById('countdown-status-message');
    }

    setTargetDate(newDateIso) {
        this.targetDate = new Date(newDateIso).getTime();
        this.update();
    }

    start() {
        this.update();
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => this.update(), 1000);
    }

    stop() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    update() {
        const now = new Date().getTime();
        const difference = this.targetDate - now;

        if (difference <= 0) {
            this.handleExpired();
            return;
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        this.renderDigits(days, hours, minutes, seconds);
    }

    renderDigits(days, hours, minutes, seconds) {
        if (this.daysEl) this.daysEl.textContent = String(days).padStart(2, '0');
        if (this.hoursEl) this.hoursEl.textContent = String(hours).padStart(2, '0');
        if (this.minutesEl) this.minutesEl.textContent = String(minutes).padStart(2, '0');
        if (this.secondsEl) this.secondsEl.textContent = String(seconds).padStart(2, '0');
    }

    handleExpired() {
        this.renderDigits(0, 0, 0, 0);
        if (this.countdownStatusMessage) {
            this.countdownStatusMessage.innerHTML = `<span class="text-amber-300 font-bold animate-pulse">🎉 C'est le grand jour ! La sortie a commencé ! 🌴🌊</span>`;
        }
    }
}

window.CountdownManager = CountdownManager;
