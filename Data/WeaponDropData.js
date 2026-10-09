// Data/WeaponDropData.js = static blueprints for dropped weapons on the map
export default class WeaponDropData {
    static Radius = 22;
    static Color = '#ffaa00';       // Glowing gold/orange core
    static GlowColor = 'rgba(255, 170, 0, 0.3)'; // Outer glow
    static Lifetime = 45000;        // 45 seconds before it despawns
    static PickupRadius = 35;       // Distance required to pick it up
}