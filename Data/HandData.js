// Data/HandData.js = static blueprints for default unarmed hands
export default class HandData {
    // --- SPRITES ---
    // Reusing the existing hand asset. Change these paths if you add new unarmed sprites!
    static LeftHandImage = '/Assets/UserHand/UserHand.png';
    static RightHandImage = '/Assets/UserHand/UserHand.png';

    static Scale = 1.1;
    static RotateImage = 0; // Offset angle to align the hand sprite

    // --- ATTACHMENT OFFSETS (Relative to player body center) ---
    // Negative X = left, Positive X = right. Positive Y = down/forward depending on sprite.
    static LeftHandOffset = { x:  30, y: 20 };
    static RightHandOffset = { x: 30, y: -20 };
}