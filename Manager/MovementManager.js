// Manager/MovementManager.js = state/orchestration for player movement & slide canceling
import MovementData from '../Data/MovementData.js';
import MovementLogic from '../Logic/MovementLogic.js';

export default class MovementManager {
    constructor() {
        this.isSliding = false;
        this.slideMomentumX = 0;
        this.slideMomentumY = 0;
        this.lastSlideState = false;
    }

    update(dt, keys, aimAngle) {
        let moveX = 0;
        let moveY = 0;
        if (keys.w) moveY -= 1;
        if (keys.s) moveY += 1;
        if (keys.a) moveX -= 1;
        if (keys.d) moveX += 1;

        const isMoving = (moveX !== 0 || moveY !== 0);

        const slideHeld = !!keys[MovementData.Keys.Slide];
        const slideJustPressed = slideHeld && !this.lastSlideState;
        this.lastSlideState = slideHeld;

        // NEW: Check for Sprint
        const sprintHeld = !!keys[MovementData.Keys.Sprint];

        // ==========================================
        // STATE MACHINE TRANSITIONS (SLIDE)
        // ==========================================
        if (slideJustPressed && isMoving && !this.isSliding) {
            this.isSliding = true;
            const mag = Math.hypot(moveX, moveY);
            const normX = moveX / mag;
            const normY = moveY / mag;

            // Slide uses BaseSpeed * BoostMultiplier
            const boostSpeed = MovementData.BaseSpeed * MovementData.Slide.BoostMultiplier;
            this.slideMomentumX = normX * boostSpeed;
            this.slideMomentumY = normY * boostSpeed;
        }

        if (!slideHeld && this.isSliding) {
            this.isSliding = false;
            this.slideMomentumX = 0;
            this.slideMomentumY = 0;
        }

        // ==========================================
        // VELOCITY CALCULATION
        // ==========================================
        let finalVX = 0;
        let finalVY = 0;

        if (this.isSliding) {
            // --- SLIDE STATE ---
            finalVX = this.slideMomentumX;
            finalVY = this.slideMomentumY;

            const decay = MovementLogic.getFrictionDecay(MovementData.Slide.Friction, dt);
            this.slideMomentumX *= decay;
            this.slideMomentumY *= decay;

            if (Math.hypot(this.slideMomentumX, this.slideMomentumY) < 50) {
                this.isSliding = false;
                this.slideMomentumX = 0;
                this.slideMomentumY = 0;
            }

        } else {
            // --- STANDARD / SPRINT STATE ---
            if (isMoving) {
                const mag = Math.hypot(moveX, moveY);
                const normX = moveX / mag;
                const normY = moveY / mag;

                // 1. Start with Base Speed
                let speed = MovementData.BaseSpeed;

                // 2. Apply Sprint Multiplier to the Base Speed immediately
                if (sprintHeld) {
                    speed *= MovementData.SprintMultiplier;
                }

                // 3. Get the directional multiplier (1.0, 0.85, or 0.70)
                const multiplier = MovementLogic.getDirectionalMultiplier(moveX, moveY, aimAngle);

                // 4. Apply Penalties
                if (sprintHeld) {
                    // While sprinting, ONLY apply the penalty if moving BACKWARD.
                    // This allows you to strafe (A/D) at full sprint speed for that true Omni-sprint feel!
                    if (multiplier < MovementData.DirectionalMultipliers.strafe) {
                        speed *= multiplier;
                    }
                    // If moving forward or strafing, speed remains at full sprint speed.
                } else {
                    // Normal walking: apply all directional penalties (forward, strafe, backward)
                    speed *= multiplier;
                }

                finalVX = normX * speed;
                finalVY = normY * speed;
            }
        }

        return { vx: finalVX, vy: finalVY };
    }

    reset() {
        this.isSliding = false;
        this.slideMomentumX = 0;
        this.slideMomentumY = 0;
        this.lastSlideState = false;
    }
}