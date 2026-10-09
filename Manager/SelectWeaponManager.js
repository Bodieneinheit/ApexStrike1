// Manager/SelectWeaponManager.js = state/orchestration for the Select Weapon UI
import WeaponRegistry from '../Data/WeaponRegistry.js';
import GunClassRecipe from '../Data/GunClassRecipe.js';

export default class SelectWeaponManager {
    constructor() {
        this.screen = document.getElementById('select-weapon-screen');
        this.backBtn = document.getElementById('select-weapon-back-btn');
        this.confirmBtn = document.getElementById('select-weapon-confirm-btn');
        this.grid = document.getElementById('select-weapon-grid');
        this.search = document.getElementById('select-weapon-search');
        this.filter = document.getElementById('select-weapon-filter');
        this.titleEl = document.getElementById('select-weapon-title');
        this.subtitleEl = document.getElementById('select-weapon-subtitle');

        // Which loadout slot / weapon type the grid is currently editing.
        // Populated by open(); read by confirm.
        this.currentLoadoutNumber = 1;
        this.currentSlotType = 'primary';

        // Weapon id highlighted in the grid, or null for "nothing chosen yet".
        this.pendingWeaponId = null;

        // The LoadoutManager that owns slot state. Registered via attach().
        this.loadout = null;

        // If the HTML shell is missing, fail quietly but warn in console.
        if (!this.screen || !this.backBtn || !this.grid) {
            console.warn('[SelectWeaponManager] Missing required HTML elements.');
            return;
        }

        this._attachListeners();
    }

    /* ==========================================
       WIRING
       ========================================== */

    /**
     * Registers the LoadoutManager as the source of slot state. Called by
     * LoadoutManager's constructor; keeps the dependency one-directional so
     * neither class has to construct the other.
     */
    attach(loadout) {
        this.loadout = loadout;
    }

    isOpen() {
        if (!this.screen) return false;
        return this.screen.classList.contains('active');
    }

    /* ==========================================
       OPEN / CLOSE
       ========================================== */

    /**
     * Opens the Select Weapon screen for a specific loadout slot and weapon type.
     * @param {number} loadoutNumber - 1 to 5
     * @param {string} slotType - 'primary' or 'secondary'
     */
    open(loadoutNumber, slotType) {
        if (!this.screen) return;

        this.currentLoadoutNumber = loadoutNumber;
        this.currentSlotType = slotType;

        // Pre-select whatever is already equipped in that slot.
        this.pendingWeaponId = this.loadout
            ? this.loadout.getSlotWeapon(loadoutNumber, slotType)
            : null;

        // Update UI text dynamically
        if (this.titleEl) {
            const label = slotType === 'primary' ? 'Main Weapon' : 'Sub Weapon';
            this.titleEl.textContent = `Select ${label}`;
        }
        if (this.subtitleEl) {
            const label = slotType === 'primary' ? 'main weapon' : 'sub weapon';
            this.subtitleEl.textContent =
                `Choose a ${label} for Loadout #${loadoutNumber}.`;
        }

        if (this.search) this.search.disabled = false;
        if (this.filter) this.filter.disabled = false;
        this.renderSelectWeaponGrid();

        this.screen.classList.remove('hidden');
        this.screen.classList.add('active');
    }

    close() {
        if (!this.screen) return;

        this.screen.classList.remove('active');
        this.screen.classList.add('hidden');
        this.pendingWeaponId = null;
    }

    /* ==========================================
       GRID
       ========================================== */

    renderSelectWeaponGrid() {
        if (!this.grid) return;

        // Card markup is owned by GunClassRecipe; this only drives the
        // search/filter/selection view state on top of what it renders.
        GunClassRecipe.renderSelectWeaponGrid(this.grid.id);

        const query = this.search ? (this.search.value || '').trim().toLowerCase() : '';
        const category = this.filter ? this.filter.value : 'all';
        const cards = this.grid.querySelectorAll('.select-weapon-card');

        let matches = 0;
        cards.forEach((card) => {
            const weaponId = card.dataset.weaponId;
            const visible =
                (category === 'all' || WeaponRegistry.getCategory(weaponId) === category) &&
                (!query || weaponId.toLowerCase().includes(query));

            card.style.display = visible ? '' : 'none';
            card.classList.toggle('selected', weaponId === this.pendingWeaponId);
            if (visible) matches++;
        });

        this._renderEmptyState(matches === 0);
        this._syncConfirmButton();
    }

    _renderEmptyState(show) {
        const existing = this.grid.querySelector('.select-weapon-empty');
        if (!show) {
            if (existing) existing.remove();
            return;
        }

        if (existing) return;

        const empty = document.createElement('div');
        empty.className = 'select-weapon-empty';
        empty.innerHTML =
            '<div class="select-weapon-empty-title">No weapons found</div>' +
            '<div>Try a different search or filter.</div>';
        this.grid.appendChild(empty);
    }

    /* ==========================================
       SELECTION
       ========================================== */

    selectWeapon(weaponId) {
        this.pendingWeaponId = weaponId;
        this.renderSelectWeaponGrid();
    }

    _syncConfirmButton() {
        if (!this.confirmBtn) return;
        this.confirmBtn.disabled = !this.pendingWeaponId;
    }

    confirm() {
        if (!this.currentSlotType || !this.pendingWeaponId) return;
        if (!this.loadout) return;

        this.loadout.setSlotWeapon(
            this.currentLoadoutNumber,
            this.currentSlotType,
            this.pendingWeaponId
        );
        this.close();
    }

    /* ==========================================
       EVENTS
       ========================================== */

    _attachListeners() {
        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => this.close());
        }
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => this.confirm());
        }

        // Delegate clicks for weapon cards inside the grid.
        if (this.grid) {
            this.grid.addEventListener('click', (e) => this._handleCardClick(e));
        }
        if (this.search) {
            this.search.addEventListener('input', () => this.renderSelectWeaponGrid());
        }
        if (this.filter) {
            this.filter.addEventListener('change', () => this.renderSelectWeaponGrid());
        }

        // NOTE: Escape is intentionally NOT handled here. LoadoutManager owns the
        // window keydown listener and closes the topmost screen first. A second
        // listener here would close the Select Weapon screen and then immediately
        // close the Loadout screen behind it on the same keypress.
    }

    _handleCardClick(e) {
        const card = e.target.closest('.select-weapon-card');
        if (!card || !card.dataset.weaponId) return;

        this.selectWeapon(card.dataset.weaponId);
    }
}
