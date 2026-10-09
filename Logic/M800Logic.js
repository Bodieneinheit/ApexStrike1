// Logic/M800Logic.js = math/formulas for weapon rendering
import WeaponRegistry from '../Data/WeaponRegistry.js';

export default class M800Logic {
    // Fallback offsets if a weapon does not define them yet
    static DEFAULT_WEAPON_ID = 'M4800';

    static DEFAULT_GUN_OFFSET = { x: 8, y: 0 };

    static DEFAULT_HAND_OFFSETS = {
        front: { x: 25, y: 8 },   // Support hand on the fore-end
        back: { x: -5, y: -4 }    // Trigger hand near grip/scope
    };

    /**
     * Returns the angle from player position to mouse/target position.
     * 0 radians = facing right.
     */
    static getAimAngle(fromX, fromY, toX, toY) {
        return Math.atan2(toY - fromY, toX - fromX);
    }

    /**
     * Rotates a local offset point by an angle.
     * This is how we convert "25px forward on the gun"
     * into real world X/Y coordinates.
     */
    static rotatePoint(x, y, angle) {
        return {
            x: x * Math.cos(angle) - y * Math.sin(angle),
            y: x * Math.sin(angle) + y * Math.cos(angle)
        };
    }

    /**
     * Applies a rotated offset to an origin point.
     */
    static offsetPoint(origin, angle, offset) {
        const rotated = this.rotatePoint(offset.x, offset.y, angle);

        return {
            x: origin.x + rotated.x,
            y: origin.y + rotated.y
        };
    }

    /**
     * Where the gun itself is attached to the player.
     * Usually slightly forward from the player's center.
     * Resolved from the registry so every weapon (sniper, SMG, future
     * shotguns/pistols) uses its own attachment point.
     */
    static getGunOffset(weaponId = this.DEFAULT_WEAPON_ID) {
        const data = WeaponRegistry.getWeaponData(weaponId);
        return (data && data.GunOffset) || this.DEFAULT_GUN_OFFSET;
    }

    /**
     * Front/back hand offsets relative to the gun origin.
     */
    static getHandOffsets(weaponId = this.DEFAULT_WEAPON_ID) {
        const data = WeaponRegistry.getWeaponData(weaponId);
        return (data && data.HandOffsets) || this.DEFAULT_HAND_OFFSETS;
    }

    /**
     * Sprite rotation nudges for the weapon itself and for the hands holding it.
     * Returned as 0 when a weapon doesn't need one, so callers can add them blindly.
     */
    static getRotateOffsets(weaponId = this.DEFAULT_WEAPON_ID) {
        const data = WeaponRegistry.getWeaponData(weaponId) || {};
        return {
            weapon: data.RotateImage || 0,
            hand: data.HandRotateImage || 0
        };
    }

    /**
     * Calculates all world positions needed to render the weapon combo.
     *
     * Returns:
     * {
     *   gunOrigin: { x, y },
     *   frontHand: { x, y },
     *   backHand: { x, y }
     * }
     */
    static getWeaponRenderState(playerX, playerY, aimAngle, weaponId = this.DEFAULT_WEAPON_ID) {
        const player = { x: playerX, y: playerY };

        const gunOrigin = this.offsetPoint(
            player,
            aimAngle,
            this.getGunOffset(weaponId)
        );

        const handOffsets = this.getHandOffsets(weaponId);

        const frontHand = this.offsetPoint(
            gunOrigin,
            aimAngle,
            handOffsets.front
        );

        const backHand = this.offsetPoint(
            gunOrigin,
            aimAngle,
            handOffsets.back
        );

        return {
            gunOrigin,
            frontHand,
            backHand
        };
    }
}