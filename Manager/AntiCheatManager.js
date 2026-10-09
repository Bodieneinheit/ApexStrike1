// Manager/AntiCheatManager.js = Authoritative server-side validation rules and weapon caps
class AntiCheatManager {
    // --- DEFAULTS ---
    static DEFAULT_WEAPON_ID = 'M4800';

// --- MOVEMENT & GAME LIMITS ---
// Base(300) * Sprint(1.65) * Slide(4.0) = 1980.
// 1600 covers slide + network jitter + collision pushes with a comfortable margin.
static MAX_LEGAL_PLAYER_SPEED = 1600;
    static MAX_HP = 125;
    static RESPAWN_DELAY_MS = 7000;

    // --- FIX #5: STRIKE SYSTEM ---
// After 5 strikes of speed violations the player is kicked.
static MAX_STRIKES = 5;
    static STRIKE_DECAY_MS = 60000; // Strikes reset after 60s of clean movement

    // Mirrors Data/HealthBarData.js HitRadius (player bullet hitbox circle).
    static HIT_RADIUS = 25;

    // Network jitter allowances for bullet validation.
    static HIT_DISTANCE_MARGIN = 50;   // px added to weapon range on hit checks
    static BULLET_LIFETIME_MARGIN = 100; // px added to weapon range for bullet expiry

    // --- WEAPON REGISTRY (Server-side mirror of Data/WeaponRegistry.js) ---
    // IMPORTANT: `range` must cover the full distance a bullet can travel.
    // fireRate is in SECONDS as a decimal, matching Data/SniperData.js and Data/SMGData.js.
    // Example: 0.07 = 70 milliseconds between shots.
    // `spread` mirrors Data/*.Spread (max bullet deviation in radians). The client
    // randomises its bullet angle inside +/- spread, so hit validation widens the
    // swept hitbox by tan(spread) * distance instead of trusting that angle.
    // `bulletSpeed` / `bulletOffset` mirror Data/*.BulletSpeed and
    // Data/WeaponRegistry.getBulletOffset() so the server can own bullet spawns.
    // `magazineSize` / `reloadTime` / `maxReserve` / `startingReserve` mirror
    // Data/*.MagazineSize, Data/*.ReloadTime and Data/*.Ammo so the server's ammo
    // ledger stays in lockstep with the client's HUD.
    static WEAPONS = {
        'M4800': {
            damage: 80, fireRate: 1, range: 2000, spread: 0,
            bulletSpeed: 4000, bulletOffset: { x: 35, y: -35 },
            magazineSize: 5, reloadTime: 3.0,
            maxReserve: 25, startingReserve: 15
        },
        'P90': {
            damage: 22, fireRate: 0.07, range: 1080, spread: 0.10,
            bulletSpeed: 3200, bulletOffset: { x: 60, y: -20 },
            magazineSize: 50, reloadTime: 0.5,
            maxReserve: 300, startingReserve: 150
        }

        // --- ADD NEW WEAPONS HERE ---
        // 'MP5': { damage: 18, fireRate: 0.08, range: 1000, spread: 0.06, bulletSpeed: 3000, bulletOffset: { x: 130, y: -14 }, magazineSize: 30, reloadTime: 2.2, maxReserve: 180, startingReserve: 120 }
    };

    // Fallbacks for weapons that predate the ammo fields.
    static DEFAULT_MAGAZINE_SIZE = 30;
    static DEFAULT_RELOAD_SECONDS = 2.0;
    static DEFAULT_RESERVE = 90;

    /** Fallback muzzle offset (mirrors Data/ShootingData.js DefaultBulletOffset) */
    static DEFAULT_BULLET_OFFSET = { x: 60, y: -35 };

    /** Fallback muzzle velocity (mirrors Data/ShootingData.js SpeedBullet) */
    static DEFAULT_BULLET_SPEED = 4000;

    /** Helper to safely grab weapon data, falling back to default if hacker sends garbage ID */
    static getWeaponData(weaponId) {
        return this.WEAPONS[weaponId] || this.WEAPONS[this.DEFAULT_WEAPON_ID];
    }

    /** Returns fireRate in milliseconds for server-side Date.now() comparisons */
    static getFireRateMs(weaponId) {
        const data = this.getWeaponData(weaponId);
        return (data.fireRate || 0) * 1000;
    }

    /** Authoritative muzzle velocity in px/sec (never client supplied) */
    static getBulletSpeed(weaponId) {
        const data = this.getWeaponData(weaponId);
        return Number.isFinite(data.bulletSpeed) ? data.bulletSpeed : this.DEFAULT_BULLET_SPEED;
    }

    /** Authoritative muzzle offset in player-local space (never client supplied) */
    static getBulletOffset(weaponId) {
        const data = this.getWeaponData(weaponId);
        const offset = data.bulletOffset;
        if (offset && Number.isFinite(offset.x) && Number.isFinite(offset.y)) return offset;
        return this.DEFAULT_BULLET_OFFSET;
    }

    /**
     * How far off-axis a bullet may legitimately travel, in px, at a given distance.
     * The client randomises its bullet angle within +/- spread (Logic/AccuracyLogic.js),
     * so the server treats the trajectory as a cone instead of a single line.
     */
    static getSpreadTolerance(weaponId, distance) {
        const spread = this.getWeaponData(weaponId).spread;
        if (!(spread > 0) || !(distance > 0)) return 0;
        return Math.tan(spread) * distance;
    }

    // --- SERVER-AUTHORITATIVE AMMO ---

    /**
     * Builds a fresh ammo state for a weapon. Used on spawn, respawn,
     * weapon pickup and loadout equip.
     */
    static initAmmo(weaponId) {
        const data = this.getWeaponData(weaponId);
        return {
            mag: data.magazineSize || this.DEFAULT_MAGAZINE_SIZE,
            reserve: Math.min(
                data.startingReserve || this.DEFAULT_RESERVE,
                data.maxReserve === undefined ? Infinity : data.maxReserve
            ),
            isReloading: false,
            reloadEndTime: 0
        };
    }

    /**
     * Lazily completes a reload once its timer has elapsed. Called on every
     * shoot/reload request so a finished reload can never be "stuck" just
     * because the client stopped spamming events. Mutates `player`.
     */
    static tickReload(player, now) {
        if (!player || !player.isReloading) return;
        if (now < player.reloadEndTime) return;

        const data = this.getWeaponData(player.currentWeapon);
        const magSize = data.magazineSize || this.DEFAULT_MAGAZINE_SIZE;
        const needed = magSize - player.mag;
        const available = Math.min(needed, player.reserve);

        player.mag += available;
        player.reserve -= available;
        player.isReloading = false;
        player.reloadEndTime = 0;
    }

    /**
     * Applies the weapon's server-side spread to a fired angle. The client never
     * gets to choose the real trajectory, so devtools cannot zero this out.
     */
    static applySpread(baseAngle, weaponId) {
        const spread = this.getWeaponData(weaponId).spread;
        if (!(spread > 0)) return baseAngle;
        return baseAngle + (Math.random() - 0.5) * 2 * spread;
    }
}

module.exports = AntiCheatManager;
