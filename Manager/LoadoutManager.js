// Manager/LoadoutManager.js = state/orchestration for the Loadout UI
import WeaponRegistry from '../Data/WeaponRegistry.js';
import GunClassRecipe from '../Data/GunClassRecipe.js';

export default class LoadoutManager {
    // Number of loadout slots shown in the left rail.
    static SlotCount = 5;

    constructor(selectWeaponManager) {
        this.selectWeaponManager = selectWeaponManager || null;

        this.loadoutScreen = document.getElementById('loadout-screen');
        this.openBtn = document.getElementById('loadout-btn');
        this.backBtn = document.getElementById('loadout-back-btn');
        this.gameScreen = document.getElementById('game-screen');
        this.homeScreen = document.getElementById('home-screen');

        this.rail = document.getElementById('loadout-list');
        this.railCards = this.rail
            ? Array.from(this.rail.querySelectorAll('.loadout-rail-card'))
            : [];

        this.primaryCard = this._getWeaponCardRefs('primary');
        this.secondaryCard = this._getWeaponCardRefs('secondary');

        this.previewStage = document.getElementById('loadout-preview-stage');
        this.previewImage = document.getElementById('loadout-preview-image');
        this.previewType = document.getElementById('loadout-preview-type');
        this.previewName = document.getElementById('loadout-preview-name');

        // Local-only loadout state: one entry per rail slot.
        this.slots = [];
        for (let number = 1; number <= LoadoutManager.SlotCount; number++) {
            this.slots.push({ number: number, primary: null, secondary: null });
        }
        this.activeSlot = 1;

        // If the HTML shell is missing, fail quietly but warn in console.
        if (!this.loadoutScreen || !this.openBtn || !this.backBtn) {
            console.warn('[LoadoutManager] Missing required Loadout HTML elements.');
            return;
        }

        // The Select Weapon screen owns its own DOM and state; it reads slot
        // state back from us through the public API below.
        if (this.selectWeaponManager) {
            this.selectWeaponManager.attach(this);
        }

        this.openBtn.addEventListener('click', () => this.open());
        this.backBtn.addEventListener('click', () => this.close());

        this._attachListeners();
        this.render();
    }

    isOpen() {
        if (!this.loadoutScreen) return false;
        return this.loadoutScreen.classList.contains('active');
    }

    isSelectWeaponOpen() {
        return this.selectWeaponManager ? this.selectWeaponManager.isOpen() : false;
    }

    /**
     * Home-screen entry point: full editing (main/sub weapons, Select Weapon,
     * future skins/classes). Equipping lives in InGameLoadoutManager.
     */
    open() {
        if (!this.loadoutScreen) return;

        // Never let the home screen's Loadout cover a live match.
        if (this._isGameRunning()) return;

        this.loadoutScreen.classList.remove('hidden');
        this.loadoutScreen.classList.add('active');
        this.render();
    }

    close() {
        if (!this.loadoutScreen) return;

        this.closeSelectWeapon();
        this.clearPreview();
        this.loadoutScreen.classList.remove('active');
        this.loadoutScreen.classList.add('hidden');
    }

    toggle() {
        if (this.isOpen()) {
            this.close();
        } else {
            this.open();
        }
    }

    /* ==========================================
       PUBLIC STATE API
       ========================================== */

    getActiveSlotNumber() {
        return this.activeSlot;
    }

    getSlotWeapon(slotNumber, slotType) {
        const slot = this._getSlot(slotNumber);
        return slot ? slot[slotType] : null;
    }

    /** Public accessor so other managers (InGameLoadoutManager) can read slots. */
    getSlot(slotNumber) {
        return this._getSlot(slotNumber);
    }

    /** Assign a weapon id (or null to clear) to a slot's main/sub slot. */
    setSlotWeapon(slotNumber, slotType, weaponId) {
        const slot = this._getSlot(slotNumber);
        if (!slot) return;

        slot[slotType] = weaponId && WeaponRegistry.hasWeapon(weaponId) ? weaponId : null;
        this.render();
    }

    /** Make a rail slot active and load its weapons into the middle cards. */
    setActiveSlot(slotNumber) {
        const slot = this._getSlot(slotNumber);
        if (!slot) return;

        this.activeSlot = slotNumber;
        this.clearPreview();
        this.render();
    }

    /* ==========================================
       RENDERING
       ========================================== */

    render() {
        this.railCards.forEach((card) => {
            const number = parseInt(card.getAttribute('data-loadout-number'), 10);
            const slot = this._getSlot(number);
            if (!slot) return;

            card.classList.toggle('active', number === this.activeSlot);
            this._renderRailCard(card, slot);
        });

        this._renderWeaponCard(this.primaryCard, this._getSlot(this.activeSlot), 'primary');
        this._renderWeaponCard(this.secondaryCard, this._getSlot(this.activeSlot), 'secondary');
    }

    _renderRailCard(card, slot) {
        const placeholder = card.querySelector('.loadout-rail-card-placeholder');
        let icon = card.querySelector('.loadout-rail-card-icon');
        const data = WeaponRegistry.findWeaponData(slot.primary);

        if (data) {
            if (!icon) {
                icon = document.createElement('img');
                icon.className = 'loadout-rail-card-icon';
                icon.alt = '';
                card.insertBefore(icon, card.firstChild);
            }
            icon.src = GunClassRecipe.getIcon(slot.primary);
            if (placeholder) placeholder.hidden = true;
        } else {
            if (icon) icon.remove();
            if (placeholder) placeholder.hidden = false;
        }
    }

    _renderWeaponCard(refs, slot, slotType) {
        if (!refs || !slot) return;

        const data = WeaponRegistry.findWeaponData(slot[slotType]);

        if (data) {
            refs.card.classList.remove('empty');
            refs.name.textContent = data.WeaponId;
            refs.image.src = GunClassRecipe.getIcon(slot[slotType]);
            // Honour the recipe's x/y/scale so this card matches the Select
            // Weapon grid, using the 'loadout' surface tuning since this wrap
            // is a different height than the grid's.
            refs.image.style.transform = GunClassRecipe.getIconStyle(data.WeaponId, 'loadout');
            refs.image.alt = data.WeaponId;
            refs.image.hidden = false;
            if (refs.placeholder) refs.placeholder.hidden = true;
            refs.status.textContent = 'Click to change';
        } else {
            refs.card.classList.add('empty');
            refs.name.textContent = 'Empty';
            refs.image.hidden = true;
            refs.image.style.transform = '';
            refs.image.removeAttribute('src');
            if (refs.placeholder) {
                refs.placeholder.textContent = 'No weapon equipped';
                refs.placeholder.hidden = false;
            }
            refs.status.textContent = 'Click to assign a weapon';
        }

        refs.card.setAttribute('data-slot-type', slotType);
    }

    /* ==========================================
       HOVER PREVIEW STAGE
       ========================================== */

    showPreview(weaponId) {
        const data = WeaponRegistry.findWeaponData(weaponId);
        if (!data || !this.previewStage) {
            this.clearPreview();
            return;
        }

        this.previewImage.src = GunClassRecipe.getIcon(data.WeaponId);
        this.previewImage.alt = data.WeaponId;
        this.previewType.textContent = WeaponRegistry.getCategory(data.WeaponId);
        this.previewName.textContent = data.WeaponId;
        this.previewStage.classList.add('active');
    }

    clearPreview() {
        if (!this.previewStage) return;

        this.previewStage.classList.remove('active');
        this.previewImage.removeAttribute('src');
    }

    /* ==========================================
       SELECT WEAPON SCREEN (delegated)
       ========================================== */

    openSelectWeapon(slotType) {
        if (!this.selectWeaponManager) return;

        const slot = this._getSlot(this.activeSlot);
        if (!slot) return;

        this.selectWeaponManager.open(this.activeSlot, slotType);
    }

    closeSelectWeapon() {
        if (this.selectWeaponManager) this.selectWeaponManager.close();
    }

    /* ==========================================
       EVENTS
       ========================================== */

    _attachListeners() {
        this.railCards.forEach((card) => {
            const number = parseInt(card.getAttribute('data-loadout-number'), 10);

            card.addEventListener('click', () => this.setActiveSlot(number));
            card.addEventListener('mouseenter', () => {
                const slot = this._getSlot(number);
                if (!slot) return;
                this.showPreview(slot.primary || slot.secondary);
            });
            card.addEventListener('mouseleave', () => this.clearPreview());
        });

        [this.primaryCard, this.secondaryCard].forEach((refs) => {
            if (!refs) return;

            const slotType = refs.card.getAttribute('data-slot-type');

            refs.card.addEventListener('mouseenter', () => {
                const slot = this._getSlot(this.activeSlot);
                if (slot) this.showPreview(slot[slotType]);
            });
            refs.card.addEventListener('mouseleave', () => this.clearPreview());
            refs.card.addEventListener('click', () => this.openSelectWeapon(slotType));
        });

        this._handleKeyDown = this._handleKeyDown.bind(this);
        window.addEventListener('keydown', this._handleKeyDown);
    }

    _getWeaponCardRefs(slotType) {
        const card = document.getElementById(`loadout-${slotType}-card`);
        if (!card) return null;

        return {
            card: card,
            name: document.getElementById(`loadout-${slotType}-name`),
            image: document.getElementById(`loadout-${slotType}-image`),
            placeholder: document.getElementById(`loadout-${slotType}-placeholder`),
            status: document.getElementById(`loadout-${slotType}-status`)
        };
    }

    _getSlot(slotNumber) {
        return this.slots.find((slot) => slot.number === slotNumber) || null;
    }

    _isGameRunning() {
        // HomeBaseManager sets game-screen to display: block when a match starts.
        return this.gameScreen && this.gameScreen.style.display === 'block';
    }

    _handleKeyDown(e) {
        if (e.key === 'Escape') {
            if (this.isSelectWeaponOpen()) {
                this.closeSelectWeapon();
            } else if (this.isOpen()) {
                this.close();
            }
            return;
        }

        if (!this.isOpen() || this.isSelectWeaponOpen()) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const number = parseInt(e.key, 10);
        if (number >= 1 && number <= LoadoutManager.SlotCount) {
            this.setActiveSlot(number);
        }
    }
}
