// Logic/AccuracyLogic.js = math/formulas for weapon accuracy and bullet spread
export default class AccuracyLogic {
    /**
     * Calculates the final spread (in radians) based on weapon stats and player state.
     * Future-proof: can easily add penalties for moving, sprinting, or jumping.
     */
    static getSpread(weaponData, isMoving = false, isSprinting = false) {
        if (!weaponData) return 0;

        let baseSpread = weaponData.Spread || 0;

        // --- FUTURE EXPANSION EXAMPLES ---
        // if (isSprinting) baseSpread *= 2.5;
        // else if (isMoving) baseSpread *= 1.5;

        return baseSpread;
    }

    /**
     * Applies random deviation to a base aim angle.
     * Returns the final angle the bullet should travel.
     */
    static applySpread(baseAngle, maxSpread) {
        if (!(maxSpread > 0)) return baseAngle;

        // Generate a random value between -maxSpread and +maxSpread
        const deviation = (Math.random() - 0.5) * 2 * maxSpread;
        return baseAngle + deviation;
    }
}
