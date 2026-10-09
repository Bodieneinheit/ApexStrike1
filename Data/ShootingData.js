// Data/ShootingData.js = static blueprint for shooting and bullet settings
export default class ShootingData {

    // --- BULLET SPRITE ---
    static Image = '/Assets/Bullet/Bullet.webp';
    static Scale = 0.35;              // Multiplier for bullet image size
    static RotateImage = -Math.PI / -2;  // Offset angle to align bullet art with its trajectory
                                      // 0 = faces right, Math.PI/2 = faces down, -Math.PI/2 = faces up

    // --- SHOOTING STATS ---
    static FireRate = 0.2;           // Seconds between shots (0.12 = ~8.3 shots/sec)
    static Duration = 1.2;            // Seconds before bullet despawns
    static SpeedBullet = 4000;        // Pixels per second

    // --- SPAWN OFFSETS (Relative to player center, rotated by aim angle) ---
    // Fallback only: Sindividual weapons should define their own BulletOffset in
    // Data/SniperData.js and Data/SMGData.js. If a weapon does not define one,
    // this is used instead.
    static DefaultBulletOffset = { x: 60, y: -35 };  

    // --- BACKWARDS COMPATIBILITY ---
    // Older code may still reference ShootingData.OffsetX / ShootingData.OffsetY.
    static get OffsetX() {
        return this.DefaultBulletOffset.x;
    }

    static get OffsetY() {
        return this.DefaultBulletOffset.y;
    }
}