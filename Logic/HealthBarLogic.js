// Logic/HealthBarLogic.js = math/formulas for health, damage, and collisions
import HealthBarData from '../Data/HealthBarData.js';

export default class HealthBarLogic {
    /**
     * Clamps HP between 0 and MaxHP
     */
    static clampHP(hp, maxHp = HealthBarData.MaxHP) {
        return Math.max(0, Math.min(maxHp, hp));
    }

    /**
     * Checks if two teams are enemies
     */
    static isEnemy(team1, team2) {
        return team1 !== team2;
    }

    /**
     * Swept Collision: Checks if a moving line segment (bullet trajectory)
     * intersects a circle (player hitbox). Prevents fast bullets from tunneling.
     */
    static checkBulletSweep(prevX, prevY, currX, currY, targetX, targetY, radius) {
        const dx = currX - prevX;
        const dy = currY - prevY;
        const fx = prevX - targetX;
        const fy = prevY - targetY;

        const a = dx * dx + dy * dy;
        if (a === 0) {
            // Bullet didn't move this frame, fallback to point check
            return (fx * fx + fy * fy) <= (radius * radius);
        }

        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - radius * radius;

        let discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;

        discriminant = Math.sqrt(discriminant);
        const t1 = (-b - discriminant) / (2 * a);
        const t2 = (-b + discriminant) / (2 * a);

        // Check if intersection happens within the bullet's movement segment [0, 1]
        if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) {
            return true;
        }
        return false;
    }
}