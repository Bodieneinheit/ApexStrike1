// Logic/CockingAGun.js = animation state/logic for the "cocking a gun" motion.
//
// On every shot, the hand(s) flagged `front` / `back` in the weapon's
// SniperData.Cocking block wait `Delay` seconds, then follow a keyframed hand
// path while the gun body itself twitches (translates + rotates) during the
// motion. Purely cosmetic — never touches hit detection, damage, or networking.
import WeaponRegistry from '../Data/WeaponRegistry.js';

const ZERO = { x: 0, y: 0 };
const ZERO_GUN = { x: 0, y: 0, rot: 0 };
const NO_OFFSET = { front: ZERO, back: ZERO, gun: ZERO_GUN };

export default class CockingAGun {
    // playerId -> { startTime, delayMs, durationMs, keyframes, front, back }
    static active = new Map();

    /** Begin (or restart) the animation for a player. Safe to spam. */
    static trigger(playerId, weaponId = 'M4800', now = Date.now()) {
        const data = WeaponRegistry.getWeaponData(weaponId);
        const cfg = data && data.Cocking;
        if (!cfg || !cfg.Enabled) return;
        if (!cfg.Keyframes || cfg.Keyframes.length < 2) return;
        if (!cfg.front && !cfg.back) return;

        this.active.set(playerId, {
            startTime:  now,
            delayMs:    (cfg.Delay ?? 0) * 1000,
            durationMs:  cfg.Duration       * 1000,
            keyframes:   cfg.Keyframes,
            front:       !!cfg.front,
            back:        !!cfg.back,
        });
    }

    /**
     * Returns this frame's offsets in gun-local units:
     *   { front: { x, y }, back: { x, y }, gun: { x, y, rot } }
     * Always returns the same shape — hands that aren't animating get {0,0}
     * and an inactive animation gets {0,0,0} gun twitch.
     * Caller ADDS these to the base offsets before rotating into world space.
     */
    static getHandOffsets(playerId, now = Date.now()) {
        const a = this.active.get(playerId);
        if (!a) return NO_OFFSET;

        const elapsed = now - a.startTime;

        // Pre-delay: still counting down, nothing has moved yet.
        if (elapsed < a.delayMs) return NO_OFFSET;

        // Past the full animation window: retire this entry.
        const animElapsed = elapsed - a.delayMs;
        if (animElapsed >= a.durationMs) {
            this.active.delete(playerId);
            return NO_OFFSET;
        }

        const t = animElapsed / a.durationMs;
        const frame = this._interpolateKeyframes(a.keyframes, t);

        return {
            front: a.front ? frame.hand : ZERO,
            back:  a.back  ? frame.hand : ZERO,
            gun:   frame.gun
        };
    }

    /** Binary-search keyframes and lerp between the two surrounding ones */
    static _interpolateKeyframes(keyframes, t) {
        // Clamp
        if (t <= keyframes[0].t) return this._cloneFrame(keyframes[0]);
        if (t >= keyframes[keyframes.length - 1].t) return this._cloneFrame(keyframes[keyframes.length - 1]);

        // Find surrounding keyframes
        let i = 0;
        while (i < keyframes.length - 1 && keyframes[i + 1].t < t) i++;

        const k0 = keyframes[i];
        const k1 = keyframes[i + 1];
        const span = k1.t - k0.t;
        const local = span > 0 ? (t - k0.t) / span : 0;

        // Smoothstep for organic feel between keyframes
        const s = local * local * (3 - 2 * local);

        return {
            hand: {
                x: k0.hand.x + (k1.hand.x - k0.hand.x) * s,
                y: k0.hand.y + (k1.hand.y - k0.hand.y) * s
            },
            gun: {
                x:   k0.gun.x   + (k1.gun.x   - k0.gun.x)   * s,
                y:   k0.gun.y   + (k1.gun.y   - k0.gun.y)   * s,
                rot: k0.gun.rot + (k1.gun.rot - k0.gun.rot) * s
            }
        };
    }

    static _cloneFrame(kf) {
        return {
            hand: { x: kf.hand.x, y: kf.hand.y },
            gun:  { x: kf.gun.x,  y: kf.gun.y, rot: kf.gun.rot }
        };
    }

    static clear(playerId) { this.active.delete(playerId); }
    static clearAll()      { this.active.clear(); }
}