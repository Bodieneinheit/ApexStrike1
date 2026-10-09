// Logic/UserCollisionLogic.js = math/formulas for player-to-player physical collisions
import UserData from '../Data/UserData.js';

// Hard cap on how far one simulation step may push the local player out of
// overlaps. The server validates every playerInput packet against
// AntiCheatManager.MAX_LEGAL_PLAYER_SPEED (2100 px/s); at the 33ms client send
// rate that is ~69px + 5px margin. Spawning inside a crowd, or being caught
// between several players, can ask for more than that in a single step, which
// would get clamped server-side and rubber-band the player. Capping here
// spreads the correction over a few frames instead.
const MAX_PUSH_PER_STEP = 12;

// Used when two players sit at the exact same coordinate (dist == 0), so there
// is no normal vector to normalize. Any consistent axis works.
const FALLBACK_DIRECTION = { x: 1, y: 0 };

export default class UserCollisionLogic {
    /**
     * Resolves physical overlaps between the local player and remote players.
     * Only moves the LOCAL player to prevent multiplayer rubber-banding/jitter.
     *
     * @param {Object} localPlayer - The local player object { x, y }
     * @param {Object} remotePlayers - Dictionary of remote players { id: { x, y, hp } }
     * @returns {Object} The resolved { x, y } coordinates for the local player.
     */
    static resolveLocalPlayerCollisions(localPlayer, remotePlayers) {
        if (!localPlayer || !remotePlayers) {
            return { x: localPlayer ? localPlayer.x : 0, y: localPlayer ? localPlayer.y : 0 };
        }

        let pushX = 0;
        let pushY = 0;

        const radius = UserData.CollisionRadius;
        const minDist = radius * 2;          // Distance at which their edges touch
        const minDistSq = minDist * minDist;

        for (const id in remotePlayers) {
            const remote = remotePlayers[id];
            if (!remote) continue;

            // Don't collide with dead players (they are lying on the ground).
            if (remote.hp !== undefined && remote.hp <= 0) continue;

            // Ignore half-built/interpolating entries rather than trusting NaN.
            if (!Number.isFinite(remote.x) || !Number.isFinite(remote.y)) continue;

            const dx = localPlayer.x - remote.x;
            const dy = localPlayer.y - remote.y;
            const distSq = (dx * dx) + (dy * dy);

            if (distSq >= minDistSq) continue;

            let nx;
            let ny;
            let overlap;

            if (distSq > 0) {
                const dist = Math.sqrt(distSq);
                // How much they are overlapping.
                overlap = minDist - dist;
                // Normalized vector pointing from remote to local, so adding it
                // moves the local player AWAY from the remote one.
                nx = dx / dist;
                ny = dy / dist;
            } else {
                // Dead center on each other: no normal exists, so pick one and
                // separate by the full body width.
                nx = FALLBACK_DIRECTION.x;
                ny = FALLBACK_DIRECTION.y;
                overlap = minDist;
            }

            // Accumulate in push space; the local position is only updated once
            // at the end, so remotes resolved earlier in this loop are measured
            // against the same starting position (no order-dependent feedback).
            pushX += nx * overlap;
            pushY += ny * overlap;
        }

        const pushDistSq = (pushX * pushX) + (pushY * pushY);

        if (pushDistSq > MAX_PUSH_PER_STEP * MAX_PUSH_PER_STEP) {
            const scale = MAX_PUSH_PER_STEP / Math.sqrt(pushDistSq);
            pushX *= scale;
            pushY *= scale;
        }

        return {
            x: localPlayer.x + pushX,
            y: localPlayer.y + pushY
        };
    }
}
