// Manager/RespawnManager.js = state/orchestration for the death and respawn UI
export default class RespawnManager {
    constructor(onRespawnCallback) {
        this.onRespawnCallback = onRespawnCallback;

        // DOM Elements
        this.deathScreen = document.getElementById('death-screen');
        this.titleEl = document.getElementById('death-title');
        this.killerEl = document.getElementById('death-killer');
        this.timerEl = document.getElementById('death-timer');
        this.promptEl = document.getElementById('death-prompt');

        this.isDead = false;
        this.canRespawn = false;
        this.timerInterval = null;
        this.RESPAWN_DELAY = 7000; // 7 seconds

        this._handleInput = this._handleInput.bind(this);
    }

    showDeathScreen(killerName) {
        this.isDead = true;
        this.canRespawn = false;
        this.deathScreen.classList.add('active');

        this.titleEl.textContent = 'ELIMINATED';
        this.killerEl.textContent = killerName
            ? `Eliminated by ${killerName}`
            : 'Eliminated by Enemy';

        this.promptEl.classList.add('hidden');
        this.promptEl.classList.remove('pulse');
        this.timerEl.classList.remove('hidden');

        const totalSeconds = Math.ceil(this.RESPAWN_DELAY / 1000);
        let timeLeft = totalSeconds;
        this.timerEl.textContent = `Respawning in ${timeLeft}...`;

        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                this.timerEl.classList.add('hidden');
                this.promptEl.classList.remove('hidden');
                this.promptEl.classList.add('pulse');
                this.canRespawn = true;
                this._attachListeners();
            } else {
                this.timerEl.textContent = `Respawning in ${timeLeft}...`;
            }
        }, 1000);
    }

    updateKillerName(name) {
        if (this.isDead && name) {
            this.killerEl.textContent = `Eliminated by ${name}`;
        }
    }

    hideDeathScreen() {
        this.isDead = false;
        this.canRespawn = false;
        this.deathScreen.classList.remove('active');
        this.promptEl.classList.remove('pulse');
        if (this.promptEl.classList.contains('hidden') === false) {
            this.promptEl.classList.add('hidden');
        }
        this._detachListeners();
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = null;
    }

    _attachListeners() {
        window.addEventListener('keydown', this._handleInput);
        window.addEventListener('mousedown', this._handleInput);
    }

    _detachListeners() {
        window.removeEventListener('keydown', this._handleInput);
        window.removeEventListener('mousedown', this._handleInput);
    }

    _handleInput(e) {
        if (!this.canRespawn) return;
        // Prevent triggering if they are typing in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // NEW: Prevent accidental respawn if the loadout screen is open
        const loadoutScreen = document.getElementById('ingame-loadout-screen');
        if (loadoutScreen && loadoutScreen.classList.contains('active')) return;

        e.preventDefault();
        this._detachListeners(); // Prevent double-triggering
        if (this.onRespawnCallback) this.onRespawnCallback();
    }
}