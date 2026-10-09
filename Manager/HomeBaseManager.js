// Manager/HomeBaseManager.js
export default class HomeBaseManager {
    constructor(onGameStartCallback) {
        this.onGameStartCallback = onGameStartCallback;
        
        this.homeScreen = document.getElementById('home-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.usernameInput = document.getElementById('username-input');
        this.quickPlayBtn = document.getElementById('quickplay-btn');
        this.errorMsg = document.getElementById('error-msg');

        this.quickPlayBtn.addEventListener('click', () => this.handleQuickPlay());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleQuickPlay();
        });
    }

    handleQuickPlay() {
        const username = this.usernameInput.value.trim();
        if (username.length < 2 || username.length > 15) {
            this.showError("Username must be 2-15 characters!");
            return;
        }
        this.hideError();
        this.startGame(username);
    }

    startGame(username) {
        this.homeScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';
        // Release keyboard focus from the username box so WASD goes straight to the game.
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        if (this.onGameStartCallback) this.onGameStartCallback(username);
    }

    // NEW: Reset UI back to the home screen (used when cancelling matchmaking)
    showHomeScreen() {
        this.gameScreen.style.display = 'none';
        this.homeScreen.style.display = 'flex';
    }

    showError(msg) {
        this.errorMsg.textContent = msg;
        this.errorMsg.style.display = 'block';
    }

    hideError() {
        this.errorMsg.style.display = 'none';
    }
}