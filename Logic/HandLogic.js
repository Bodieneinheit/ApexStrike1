// Logic/HandLogic.js = math/formulas for default unarmed hand placement
import HandData from '../Data/HandData.js';

export default class HandLogic {
    /**
     * Calculates world positions for the left and right hands when unarmed.
     * Hands are attached directly to the player's body center (x, y).
     */
    static getUnarmedHandPositions(playerX, playerY, aimAngle) {
        const cosA = Math.cos(aimAngle);
        const sinA = Math.sin(aimAngle);

        // --- LEFT HAND ---
        const lOff = HandData.LeftHandOffset;
        const leftX = playerX + (lOff.x * cosA - lOff.y * sinA);
        const leftY = playerY + (lOff.x * sinA + lOff.y * cosA);

        // --- RIGHT HAND ---
        const rOff = HandData.RightHandOffset;
        const rightX = playerX + (rOff.x * cosA - rOff.y * sinA);
        const rightY = playerY + (rOff.x * sinA + rOff.y * cosA);

        return {
            left: { x: leftX, y: leftY },
            right: { x: rightX, y: rightY }
        };
    }
}