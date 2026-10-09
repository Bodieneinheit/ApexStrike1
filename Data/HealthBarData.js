// Data/HealthBarData.js = static blueprints for health and visual bars
export default class HealthBarData {
    static MaxHP = 125;
    static HitDamage = 25; // 5 shots to kill (Must match server)

    // --- VISUAL BAR SETTINGS ---
    static BarWidth = 50;
    static BarHeight = 6;
    static OffsetY = 40; // Distance below player center

    // --- COLORS ---
    static BackgroundColor = 'rgba(0, 0, 0, 0.6)';
    static FillColor = '#00ff00'; // Green
    static BorderColor = '#ffffff';

    // --- GAMEPLAY ---
    static HitRadius = 25; // Collision circle radius for bullets
    static RespawnTime = 3000; // Milliseconds before respawning
}