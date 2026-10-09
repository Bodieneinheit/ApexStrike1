// Data/WeaponRegistry.js = Maps Weapon IDs to their Data classes
import SniperData from './SniperData.js';
import SMGData from './SMGData.js';
import ShootingData from './ShootingData.js';

export default class WeaponRegistry {
    // Spread every weapon class config into the single main registry.
    // Adding a new weapon type = import it here + spread it below.
    static weapons = {
        ...SniperData.Snipers,
        ...SMGData.SMGS
        // Future non-sniper weapons can be added here:
        // ...ShotgunData.SHOTGUNS
    };

    // Used by the client as the guaranteed-valid fallback weapon id.
    static DefaultWeaponId = 'M4800';

    static getWeaponData(weaponId) {
        return this.weapons[weaponId] || this.weapons[this.DefaultWeaponId];
    }

    static hasWeapon(weaponId) {
        return Object.prototype.hasOwnProperty.call(this.weapons, weaponId);
    }

    static getDamage(weaponId) {
        const data = this.getWeaponData(weaponId);
        return data.Damage || 25;
    }

    // Used by the Loadout UI for badges, the preview type label and the
    // Select Weapon filter. Derived from each blueprint's Type ('Sniper'/'SMG').
    static getCategory(weaponId) {
        const data = this.weapons[weaponId];
        return (data && data.Type ? data.Type.toLowerCase() : '');
    }

    // Strict lookup: unlike getWeaponData this never falls back to the default
    // weapon, so callers can use a miss to mean "nothing equipped here".
    static findWeaponData(weaponId) {
        if (!weaponId || !this.hasWeapon(weaponId)) return null;
        return this.weapons[weaponId];
    }

    // Per-weapon bullet spawn offset, relative to the player center and rotated
    // by aim angle. Falls back to ShootingData.DefaultBulletOffset when a weapon
    // blueprint does not declare one.
    static getBulletOffset(weaponId) {
        const data = this.getWeaponData(weaponId);

        if (
            data &&
            data.BulletOffset &&
            Number.isFinite(data.BulletOffset.x) &&
            Number.isFinite(data.BulletOffset.y)
        ) {
            return data.BulletOffset;
        }

        return ShootingData.DefaultBulletOffset;
    }
}
