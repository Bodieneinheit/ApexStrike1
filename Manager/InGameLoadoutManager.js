// Manager/InGameLoadoutManager.js = state/orchestration for the in-game loadout UI
//
// Deliberately read-only with respect to loadout data: the home-screen
// LoadoutManager owns every edit, and this screen only picks one of the five
// saved slots to equip. It therefore has no Select Weapon, no skin/class
// changing, and no way to write back into a slot.
//
// Cards are built with createElement + textContent, never innerHTML, so a
// future player-supplied string (custom loadout name, skin name) renders as
// literal text instead of markup.
import WeaponRegistry from '../Data/WeaponRegistry.js';
import GunClassRecipe from '../Data/GunClassRecipe.js';

export default class InGameLoadoutManager {
    static SlotCount = 5;

    constructor(loadoutManager) {
        this.loadoutManager = loadoutManager || null;

        this.screen = document.getElementById('ingame-loadout-screen');
        this.backBtn = document.getElementById('ingame-loadout-back-btn');
        this.grid = document.getElementById('ingame-loadout-grid');

        this.equippedSlotNumber = null;
        this.onEquipCallback = null;

        if (!this.screen || !this.grid) {
            console.warn('[InGameLoadoutManager] Missing required In-Game Loadout HTML elements.');
            return;
        }

        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => this.close());
        }

        this._handleKeyDown = this._handleKeyDown.bind(this);
        window.addEventListener('keydown', this._handleKeyDown);
    }

    isOpen() {
        if (!this.screen) return false;
        return this.screen.classList.contains('active');
    }

    open() {
        if (!this.screen) return;

        this.screen.classList.remove('hidden');
        this.screen.classList.add('active');

        this.render();
    }

    close() {
        if (!this.screen) return;

        this.screen.classList.remove('active');
        this.screen.classList.add('hidden');
    }

    setEquipCallback(callback) {
        this.onEquipCallback = callback;
    }

    /** Mirror the server's authoritative equipped loadout slot. */
    setEquippedSlot(slotNumber) {
        this.equippedSlotNumber = slotNumber;

        if (this.isOpen()) {
            this.render();
        }
    }

    /** Called on every new match so a stale equip never leaks into the next one. */
    reset() {
        this.equippedSlotNumber = null;

        if (this.isOpen()) {
            this.render();
        }
    }

    render() {
        if (!this.grid) return;

        // Clearing only: assigning an empty string injects nothing.
        this.grid.innerHTML = '';

        for (let number = 1; number <= InGameLoadoutManager.SlotCount; number++) {
            const slot = this._getSlot(number);

            const primary = slot && slot.primary ? slot.primary : null;
            const secondary = slot && slot.secondary ? slot.secondary : null;

            const hasPrimary = !!(primary && WeaponRegistry.hasWeapon(primary));
            const equipped = this.equippedSlotNumber === number;

            // --- CARD ROOT ---
            const card = document.createElement('div');
            card.className = 'ingame-loadout-card';
            if (equipped) card.classList.add('equipped');
            if (!hasPrimary) card.classList.add('empty');

            // --- SLOT NUMBER BADGE ---
            const numberEl = document.createElement('div');
            numberEl.className = 'ingame-loadout-card-number';
            numberEl.textContent = String(number);
            card.appendChild(numberEl);

            // --- LABEL ---
            const labelEl = document.createElement('div');
            labelEl.className = 'ingame-loadout-card-label';
            labelEl.textContent = `Loadout ${number}`;
            card.appendChild(labelEl);

            // --- WEAPON ICON (matches the home Loadout card art) ---
            const iconWrap = document.createElement('div');
            iconWrap.className = 'ingame-loadout-card-icon-wrap';

            if (hasPrimary) {
                const icon = document.createElement('img');
                icon.className = 'ingame-loadout-card-icon';
                icon.src = GunClassRecipe.getIcon(primary);
                icon.alt = primary;
                // The 'ingame' surface centers the art in this wrap, which is
                // much shorter than the home Loadout's. Callers must not share
                // the 'loadout' override here or the icon clips out of view.
                icon.style.transform = GunClassRecipe.getIconStyle(primary, 'ingame');
                iconWrap.appendChild(icon);
            } else {
                const placeholder = document.createElement('span');
                placeholder.className = 'ingame-loadout-card-placeholder';
                placeholder.textContent = '—';
                iconWrap.appendChild(placeholder);
            }

            card.appendChild(iconWrap);

            // --- STATUS TEXT ---
            const statusEl = document.createElement('div');
            statusEl.className = 'ingame-loadout-card-status';

            if (hasPrimary) {
                let status = `Primary: ${primary}`;
                if (secondary && WeaponRegistry.hasWeapon(secondary)) {
                    status += ` | Sub: ${secondary}`;
                }
                statusEl.textContent = status;
            } else {
                statusEl.textContent = 'Empty';
            }

            card.appendChild(statusEl);

            // --- EQUIP BUTTON ---
            const equipBtn = document.createElement('button');
            equipBtn.className = 'ingame-loadout-equip-btn';
            equipBtn.type = 'button';
            equipBtn.textContent = equipped ? 'Equipped' : 'Equip';

            if (equipped) equipBtn.classList.add('equipped');
            if (!hasPrimary || equipped) equipBtn.disabled = true;

            equipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.equip(number);
            });

            card.appendChild(equipBtn);

            // Clicking the card itself can also equip.
            card.addEventListener('click', () => {
                this.equip(number);
            });

            this.grid.appendChild(card);
        }
    }

    equip(slotNumber) {
        const slot = this._getSlot(slotNumber);
        if (!slot) return;

        const primary = slot.primary;
        const secondary = slot.secondary || null;

        // Require a valid primary weapon.
        if (!primary || !WeaponRegistry.hasWeapon(primary)) return;

        // Already equipped.
        if (this.equippedSlotNumber === slotNumber) return;

        this.equippedSlotNumber = slotNumber;
        this.render();

        if (this.onEquipCallback) {
            this.onEquipCallback(slotNumber, {
                primary: primary,
                secondary: secondary
            });
        }
    }

    _getSlot(slotNumber) {
        // Preferred: public accessor.
        if (this.loadoutManager && typeof this.loadoutManager.getSlot === 'function') {
            return this.loadoutManager.getSlot(slotNumber);
        }

        // Fallback: direct access.
        if (this.loadoutManager && Array.isArray(this.loadoutManager.slots)) {
            return this.loadoutManager.slots.find((slot) => slot.number === slotNumber) || null;
        }

        return null;
    }

    _handleKeyDown(e) {
        if (!this.isOpen()) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
        }
    }
}
