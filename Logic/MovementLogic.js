// Logic/MovementLogic.js = math/formulas for movement physics
import MovementData from '../Data/MovementData.js';

export default class MovementLogic {
    /**
     * Calculates the speed multiplier based on movement direction relative to aim.
     * Uses the dot product to determine if moving forward, backward, or strafing.
     */
    static getDirectionalMultiplier(moveX, moveY, aimAngle) {
        if (moveX === 0 && moveY === 0) return 0;

        // Normalize movement vector
        const mag = Math.hypot(moveX, moveY);
        const normX = moveX / mag;
        const normY = moveY / mag;

        // Aim vector (where the mouse is)
        const aimX = Math.cos(aimAngle);
        const aimY = Math.sin(aimAngle);

        // Dot product: 1 = perfectly forward, -1 = perfectly backward, 0 = perfectly sideways
        const dot = normX * aimX + normY * aimY;

        if (dot > 0.5) return MovementData.DirectionalMultipliers.forward;
        if (dot < -0.5) return MovementData.DirectionalMultipliers.backward;
        return MovementData.DirectionalMultipliers.strafe;
    }

    /**
     * Calculates frame-rate independent friction decay for slide momentum.
     */
    static getFrictionDecay(friction, dt) {
        return Math.pow(friction, dt * 60);
    }
}