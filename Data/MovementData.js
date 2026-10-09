// Data/MovementData.js = static blueprints for movement physics and state
export default class MovementData {
    // --- BASE SPEED ---
    // MUST match Server-Auth.js MAX_LEGAL_PLAYER_SPEED (covers sprint + slide boost)
    static BaseSpeed = 300;

    // --- SPRINT MECHANICS ---
    static SprintMultiplier = 1.65; // 125% speed when holding Sprint

    // --- DIRECTIONAL MULTIPLIERS (CoD Style Strafing) ---
    // Applied based on the angle between movement vector and aim angle.
    static DirectionalMultipliers = {
        forward: 1.0,    // 100% speed
        strafe: 0.85,    // 85% speed (side-stepping)
        backward: 0.70   // 70% speed (retreating)
    };

    // --- SLIDE MECHANICS ---
    static Slide = {
        BoostMultiplier: 4.0, // 400% speed burst on trigger (1200 px/s!)
        Friction: 0.95
    };

    // --- INPUT BINDINGS ---
    static Keys = {
        Slide: ' ',      // Spacebar
        Sprint: 'shift'  // NEW: Shift key for sprinting
    };
}