// Logic/RecoilLogic.js = math/formulas for weapon recoil animation
import WeaponRegistry from '../Data/WeaponRegistry.js';

const ZERO_RECOIL = { x: 0, y: 0, rot: 0 };

export default class RecoilLogic {
    // playerId -> { startTime, durationMs, maxKickX, maxKickY, maxKickRot }
    static active = new Map();

    /** Begin the recoil animation for a player. */
    static trigger(playerId, weaponId = 'M4800', now = Date.now()) {
        const data = WeaponRegistry.getWeaponData(weaponId);
        const cfg = data && data.Recoil;
        if (!cfg || !cfg.Enabled) return;

        this.active.set(playerId, {
            startTime: now,
            durationMs: cfg.Duration * 1000,
            maxKickX: cfg.MaxKickX || 0,
            maxKickY: cfg.MaxKickY || 0,
            maxKickRot: cfg.MaxKickRot || 0
        });
    }

    /**
     * Returns this frame's recoil offsets in gun-local units:
     *   { x, y, rot }
     * Caller ADDS these to the base gun offsets before rotating into world space.
     */
    static getOffset(playerId, now = Date.now()) {
        const state = this.active.get(playerId);
        if (!state) return ZERO_RECOIL;

        const elapsed = now - state.startTime;

        // Past the full animation window: retire this entry.
        if (elapsed >= state.durationMs) {
            this.active.delete(playerId);
            return ZERO_RECOIL;
        }

        // Normalized time (0 to 1)
        const t = elapsed / state.durationMs;

        // Smooth recoil curve:
        // Math.pow(1 - t, 1.5) gives a snappy initial kick that smoothly settles back to 0.
        const factor = Math.pow(1 - t, 1.5);

        return {
            x: state.maxKickX * factor,
            y: state.maxKickY * factor,
            rot: state.maxKickRot * factor
        };
    }

    static clear(playerId) { this.active.delete(playerId); }
    static clearAll() { this.active.clear(); }
}