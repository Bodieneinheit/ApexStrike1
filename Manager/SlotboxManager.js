// Manager/SlotboxManager.js = state/orchestration for the Slotbox HUD
export default class SlotboxManager {
    // Accept a callback for network syncing
    constructor(onChangeCallback = null) {
        this.hud = document.getElementById('slotbox-hud');
        this.slots = document.querySelectorAll('.slotbox');
        this.activeSlot = 1; // Default to slot 1
        this.totalSlots = 3; // Total number of slots
        this.onChangeCallback = onChangeCallback;

        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleWheel = this._handleWheel.bind(this);
    }

    /** Show the HUD and start listening for keybinds */
    show() {
        if (this.hud) this.hud.classList.add('active');
        this._attachListeners();

        this.activeSlot = 0; // Force the CSS state to repaint
        this.setActiveSlot(1);
    }

    /** Hide the HUD and clean up listeners */
    hide() {
        if (this.hud) this.hud.classList.remove('active');
        this._detachListeners();
    }

    _attachListeners() {
        window.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('wheel', this._handleWheel, { passive: false });
    }

    _detachListeners() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('wheel', this._handleWheel);
    }

    _handleKeyDown(e) {
        // Ignore if the user is typing in an input (like the username box)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key;
        if (key === '1') this.setActiveSlot(1);
        else if (key === '2') this.setActiveSlot(2);
        else if (key === '3') this.setActiveSlot(3);
    }

    // Scroll wheel cycles through slots
    _handleWheel(e) {
        // Don't hijack scroll if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Prevent default browser zoom/scroll behavior
        e.preventDefault();

        // deltaY > 0 = scroll down = next slot
        // deltaY < 0 = scroll up = previous slot
        if (e.deltaY > 0) {
            // Next slot (wrap 3 → 1)
            const next = this.activeSlot >= this.totalSlots ? 1 : this.activeSlot + 1;
            this.setActiveSlot(next);
        } else if (e.deltaY < 0) {
            // Previous slot (wrap 1 → 3)
            const prev = this.activeSlot <= 1 ? this.totalSlots : this.activeSlot - 1;
            this.setActiveSlot(prev);
        }
    }

    /** Updates the visual state and internal state */
    setActiveSlot(slotNumber) {
        if (this.activeSlot === slotNumber) return;
        this.activeSlot = slotNumber;

        this.slots.forEach(slot => {
            const slotNum = parseInt(slot.getAttribute('data-slot'));
            if (slotNum === slotNumber) {
                slot.classList.add('active');
            } else {
                slot.classList.remove('active');
            }
        });

        // Trigger callback so Client.js can emit to server
        if (this.onChangeCallback) {
            this.onChangeCallback(slotNumber);
        }
    }

    /**
     * Checks if a given slot number is currently designated as a weapon slot.
     * Future-proof: When you add guns to Slot 2 or 3, just update this array!
     */
    isWeaponSlot(slotNumber) {
        // For now, only Slot 1 is a weapon.
        // Later, when you add a secondary gun to Slot 2, just change this to:
        // return [1, 2].includes(slotNumber);
        return slotNumber === 1;
    }

    /** Getter for other systems to check which slot is active */
    getActiveSlot() {
        return this.activeSlot;
    }
}