// Manager/AmmunitionManager.js = state/orchestration for ammo, magazines, and reloading
import WeaponRegistry from '../Data/WeaponRegistry.js';

const DEFAULT_MAG_SIZE = 30;
const DEFAULT_RESERVE = 90;
const DEFAULT_RELOAD_SECONDS = 2.0;

export default class AmmunitionManager {
    constructor() {
        this.currentMag = 0;
        this.currentReserve = 0;
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.reloadDurationMs = 0;
        this.activeWeaponId = null;
    }

    /**
     * Initialize (or reinitialize) ammo for a weapon.
     * Called on: match start, respawn, weapon pickup, loadout equip.
     */
    initWeapon(weaponId) {
        const data = WeaponRegistry.getWeaponData(weaponId);
        if (!data) return;

        const ammo = data.Ammo || {};

        this.activeWeaponId = weaponId;
        this.currentMag = data.MagazineSize || DEFAULT_MAG_SIZE;
        // Never hand out more than the weapon can carry, even if a blueprint
        // declares a StartingReserve above its own MaxReserve.
        this.currentReserve = Math.min(
            ammo.StartingReserve || DEFAULT_RESERVE,
            ammo.MaxReserve || Infinity
        );
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.reloadDurationMs = (data.ReloadTime || DEFAULT_RELOAD_SECONDS) * 1000;
    }

    /**
     * Called every simulation frame to tick the reload timer.
     */
    update(now) {
        if (!this.isReloading) return;
        if (now - this.reloadStartTime >= this.reloadDurationMs) {
            this._finishReload();
        }
    }

    /**
     * Attempt to fire one round.
     * Returns true if the shot is allowed, false if mag is empty or reloading.
     */
    tryShoot() {
        if (!this.activeWeaponId) return false;
        if (this.isReloading) return false;
        if (this.currentMag <= 0) return false;
        this.currentMag--;
        return true;
    }

    /**
     * Begin a reload. Ignores the request if already reloading,
     * mag is full, or reserve is empty.
     */
    startReload(now) {
        if (!this.activeWeaponId) return;
        if (this.isReloading) return;
        if (this.currentMag >= this._getMagSize()) return;
        if (this.currentReserve <= 0) return;
        this.isReloading = true;
        this.reloadStartTime = now;
    }

    /**
     * Returns a snapshot for HUD rendering.
     */
    getState() {
        return {
            mag: this.currentMag,
            reserve: this.currentReserve,
            maxMag: this._getMagSize(),
            isReloading: this.isReloading,
            // 0..1 progress so the HUD can draw a reload bar
            reloadProgress: this._getReloadProgress(Date.now())
        };
    }

    /** Hard reset between matches. */
    reset() {
        this.currentMag = 0;
        this.currentReserve = 0;
        this.isReloading = false;
        this.reloadStartTime = 0;
        this.reloadDurationMs = 0;
        this.activeWeaponId = null;
    }

    // --- PRIVATE ---

    _finishReload() {
        const magSize = this._getMagSize();
        const needed = magSize - this.currentMag;
        const available = Math.min(needed, this.currentReserve);
        this.currentMag += available;
        this.currentReserve -= available;
        this.isReloading = false;
    }

    _getReloadProgress(now) {
        if (!this.isReloading || this.reloadDurationMs <= 0) return 0;
        return Math.max(0, Math.min(1, (now - this.reloadStartTime) / this.reloadDurationMs));
    }

    _getMagSize() {
        if (!this.activeWeaponId) return DEFAULT_MAG_SIZE;
        const data = WeaponRegistry.getWeaponData(this.activeWeaponId);
        return (data && data.MagazineSize) || DEFAULT_MAG_SIZE;
    }
}
