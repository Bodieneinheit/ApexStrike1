// Data/SMGData.js = static blueprints for all SMGs
export default class SMGData {
    // The default SMG used for initial client loading and fallbacks
    static DefaultSMGId = 'P90';

    static SMGS = {
        'P90': {
            // --- GAMEPLAY SPRITE ---
            Image: '/Assets/p90/P90_TopDownDefaultSkin.png',
            Type: 'SMG',
            Scale: 0.35,        // Slightly smaller than the sniper
            RotateImage: 0,
            // --- HAND SPRITE ---
            HandImage: '/Assets/UserHand/UserHand.png',
            HandScale: 1.1,
            HandRotateImage: 0,
            // --- GUN ATTACHMENT ---
            // P90 is a bullpup, so the grip is further back
            GunOffset: { x: 75, y: -15 },
            // --- BULLET SPAWN OFFSET ---
            // Relative to player center, rotated by aim angle.
            // Positive x = farther forward toward the mouse.
            BulletOffset: { x: 60, y: -20 },
            // --- HAND ATTACHMENT POINTS ---
            HandOffsets: {
                front: { x: -10, y: 8 },   // Support hand near the front mag/grip
                back:  { x: -35, y: -5 }    // Trigger hand further back
            },
            // --- RECOIL EFFECT ---
            Recoil: {
                Enabled: true,
                Duration: 0.15,   // Snappy, fast recovery for an SMG
                MaxKickX: -4,      // Less backward kick than a sniper
                MaxKickY: -6,      // Less upward kick
                MaxKickRot: -0.03  // Radians tilt up (negative is up)
            },
            // --- COCKING ANIMATION ---
            Cocking: {
                Enabled: true,
                Delay: 0.05,
                Duration: 0.40,    // Faster cocking than a sniper
                front: true,
                back: false,
                // Keyframes: t (0→1), hand offset (gun-local), gun twitch (x, y, rot)
                Keyframes: [
                    { t: 0.00, hand: { x: 0,    y: 0   }, gun: { x: 0,  y: 0, rot: 0      } },
                    { t: 0.20, hand: { x: 0,   y: 0   }, gun: { x: 0,  y: 0, rot: 0   } },  // reach to charging handle
                    { t: 0.50, hand: { x: 0,  y: 0   }, gun: { x: 0, y: 0, rot: 0  } },  // pull back
                    { t: 0.80, hand: { x: 0,   y: 0   }, gun: { x: 0,  y: 0, rot: 0  } },  // push forward
                    { t: 1.00, hand: { x: 0,    y: 0   }, gun: { x: 0,  y: 0, rot: 0      } }   // settle
                ]
            },
            // --- LAYER ORDER ---
            LayerOrder: ['backHand', 'frontHand', 'gun', 'body', 'username'],
            // --- AMMO ---
            Ammo: {
                MaxReserve: 300,         // SMGs carry lots of spare ammo
                StartingReserve: 150     // Spawn with a healthy reserve
            },
            // --- WEAPON STATS ---
            WeaponId: 'P90',
            Damage: 22,          // Lower damage per bullet
            FireRate: 0.07,      // Very fast (approx 14 shots/sec)
            MagazineSize: 50,
            ReloadTime: 0.5,
            BulletSpeed: 3200,   // Slower than a sniper
            Range: 1080,        // Shorter effective range
            Spread: .10        // Wider spread (Lower Accuracy)
        }

        // ==========================================
        // EXAMPLE: HOW TO ADD A NEW SMG (e.g., MP5)
        // ==========================================
        /*
        'MP5': {
            Image: '/Assets/mp5/MP5_TopDownDefaultSkin.png',
            Type: 'SMG',
            Scale: 0.32,
            RotateImage: 0,
            HandImage: '/Assets/UserHand/UserHand.png',
            HandScale: 1.1,
            HandRotateImage: 0,
            GunOffset: { x: 70, y: -14 },
            BulletOffset: { x: 130, y: -14 },
            HandOffsets: {
                front: { x: -12, y: 10 },
                back:  { x: -52, y: -4 }
            },
            Recoil: {
                Enabled: true, Duration: 0.12,
                MaxKickX: -3, MaxKickY: -5, MaxKickRot: -0.02
            },
            Cocking: {
                Enabled: true, Delay: 0.04, Duration: 0.30,
                front: true, back: false,
                Keyframes: [
                    { t: 0.00, hand: { x: 0,    y: 0   }, gun: { x: 0,  y: 0, rot: 0      } },
                    { t: 0.30, hand: { x: -4,   y: 3   }, gun: { x: 0,  y: 0, rot: 0.015  } },
                    { t: 0.60, hand: { x: -16,  y: 3   }, gun: { x: -3, y: 0, rot: -0.03  } },
                    { t: 1.00, hand: { x: 0,    y: 0   }, gun: { x: 0,  y: 0, rot: 0      } }
                ]
            },
            LayerOrder: ['backHand', 'frontHand', 'gun', 'body', 'username'],
            Ammo: {
                MaxReserve: 180,
                StartingReserve: 120
            },
            WeaponId: 'MP5',
            Damage: 18,
            FireRate: 0.08,
            MagazineSize: 30,
            ReloadTime: 2.2,
            BulletSpeed: 3000,
            Range: 1000,
            Spread: 0.06        // NEW: Slightly better accuracy than P90
        }
     
     
     
     
     
     
     
     
        */
    };

    /**
     * Retrieves the data object for a specific SMG.
     * Falls back to the DefaultSMGId (P90) if not found.
     */
    static getSMGData(weaponId) {
        return this.SMGS[weaponId] || this.SMGS[this.DefaultSMGId];
    }

    // --- FALLBACK GETTERS ---
    // Mirror the SniperData interface so the registry/client can treat every
    // weapon class the same way regardless of which file it was defined in.
    static get Image() { return this.SMGS[this.DefaultSMGId].Image; }
    static get Scale() { return this.SMGS[this.DefaultSMGId].Scale; }
    static get HandImage() { return this.SMGS[this.DefaultSMGId].HandImage; }
    static get HandScale() { return this.SMGS[this.DefaultSMGId].HandScale; }
    static get RotateImage() { return this.SMGS[this.DefaultSMGId].RotateImage; }
    static get HandRotateImage() { return this.SMGS[this.DefaultSMGId].HandRotateImage; }
    static get GunOffset() { return this.SMGS[this.DefaultSMGId].GunOffset; }
    static get HandOffsets() { return this.SMGS[this.DefaultSMGId].HandOffsets; }
    static get Cocking() { return this.SMGS[this.DefaultSMGId].Cocking; }

    static get BulletOffset() {
        return this.SMGS[this.DefaultSMGId].BulletOffset || { x: 60, y: -35 };
    }
}
