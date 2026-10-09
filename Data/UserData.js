// Data/UserData.js = static blueprints for the user's default skin/sprite
export default class UserData {
    static Scale = 0.90
; // Multiplier for the image size (1.5x original size)
    static Image = '/Assets/User/UserHead.png'; 
    static Rotate = true; 
    static RotateImage = Math.PI / 2; //

    // --- PHYSICS ---
    // The physical radius of the player's body for push-back collisions.
    // (Kept separate from HealthBarData.HitRadius so you can tune them independently)
    static CollisionRadius = 25; 
}


