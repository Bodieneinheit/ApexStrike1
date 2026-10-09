// Data/SniperData.js = static blueprints for all Sniper Rifles
export default class SniperData {
    // The default sniper used for initial client loading and fallbacks
    static DefaultSniperId = 'M4800';

    static Snipers = {
        'M4800': {
            // --- GAMEPLAY SPRITE ---
            Image: '/Assets/M4800/M800_TopDownGoldenSkin.png',
            Type: 'Sniper',
            Scale: 0.40,
            RotateImage: 0,
            // --- HAND SPRITE ---
            HandImage: '/Assets/UserHand/UserHand.png',
            HandScale: 1.1,
            HandRotateImage: 0,
            // --- GUN ATTACHMENT ---
            GunOffset: { x: 100, y: -19 },
            // --- BULLET SPAWN OFFSET ---
            // Relative to player center, rotated by aim angle.
            // Positive x = farther forward toward the mouse.
            BulletOffset: { x: 35, y: -35 },
            // --- HAND ATTACHMENT POINTS ---
            HandOffsets: {
                front: { x: -40, y: 8 },
                back:  { x: -70, y: -6 }
            },
            // --- RECOIL EFFECT ---
            Recoil: {
                Enabled: true,
                Duration: 0.35,      // Seconds for the recoil animation
                MaxKickX: -10,       // Pixels backward (negative is back)
                MaxKickY: -15,       // Pixels up (negative is up)
                MaxKickRot: -0.08    // Radians tilt up (negative is up)
            },
            // --- COCKING ANIMATION ---
            Cocking: {
                Enabled: true,
                Delay: 0.10,
                Duration: 0.80,
                front: true,
                back: false,
                // Keyframes: t (0→1), hand offset (gun-local), gun twitch (x, y, rot)
                Keyframes: [
                    { t: 0.00, hand: { x: 0,    y: 0   }, gun: { x: 0,  y: 0, rot: 0      } },
                    { t: 0.10, hand: { x: -4,   y: 2 }, gun: { x: 0,  y: 0, rot: 0.05     } },  // reach to bolt
                    { t: 0.22, hand: { x: -6,   y: 5 }, gun: { x: -1, y: 0, rot: 0.012  } },  // grab + lift
                    { t: 0.48, hand: { x: -34,  y: 3  }, gun: { x: -10, y: 0, rot: -0.10      } },  // full pull rear
                    { t: 0.72, hand: { x: -8,   y: 1  }, gun: { x: 10,  y: 0, rot: -0.008 } },  // push forward
                    { t: 1.00, hand: { x: 0,    y: 0   }, gun: { x: 0,  y: 0, rot: 0      } }   // settle
                ]
            },
            // --- LAYER ORDER ---
            LayerOrder: ['backHand', 'frontHand', 'gun', 'body', 'username'],
            // --- AMMO ---
            Ammo: {
                MaxReserve: 25,          // Total spare bullets you can carry
                StartingReserve: 15      // Spare bullets you spawn with
            },
            // --- WEAPON STATS ---
            WeaponId: 'M4800',
            Damage: 80,
            FireRate: 1,       // Seconds between shots
            MagazineSize: 5,
            ReloadTime: 3.0,
            BulletSpeed: 4000,
            Range: 2000,
            ScopeZoom: 1.6,
            Spread: 0      // Very tight spread (High Accuracy)
        },

        // ==========================================
        // EXAMPLE: HOW TO ADD A NEW SNIPER (e.g., AWP)
        // ==========================================
        /*
        'AWP': {
            Image: '/Assets/AWP/AWP_TopDown.png',
            Type: 'Sniper',
            Scale: 0.45,
            RotateImage: 0,
            HandImage: '/Assets/UserHand/UserHand.png',
            HandScale: 1.1,
            HandRotateImage: 0,
            GunOffset: { x: 110, y: -20 },
            BulletOffset: { x: 190, y: -20 },
            HandOffsets: {
                front: { x: -50, y: 10 },
                back:  { x: -80, y: -5 }
            },
            Cocking: {
                Enabled: true, Delay: 0.80, Duration: 0.45,
                front: true, back: false,
                Keyframes: [
                    { t: 0.00, hand: { x: 0,    y: 0   }, gun: { x: 0,  y: 0, rot: 0      } },
                    { t: 0.12, hand: { x: -5,   y: -12 }, gun: { x: 0,  y: 0, rot: 0      } },
                    { t: 0.22, hand: { x: -7,   y: -16 }, gun: { x: -1, y: 0, rot: 0.014  } },
                    { t: 0.48, hand: { x: -40,  y: -4  }, gun: { x: -4, y: 0, rot: 0      } },
                    { t: 0.72, hand: { x: -9,   y: -1  }, gun: { x: 3,  y: 0, rot: -0.010 } },
                    { t: 1.00, hand: { x: 0,    y: 0   }, gun: { x: 0,  y: 0, rot: 0      } }
                ]
            },
            LayerOrder: ['backHand', 'frontHand', 'gun', 'body', 'username'],
            Ammo: {
                MaxReserve: 45,
                StartingReserve: 30
            },
            WeaponId: 'AWP',
            Damage: 110,       // 1 shot kill
            FireRate: 2.5,
            MagazineSize: 10,
            ReloadTime: 3.5,
            BulletSpeed: 4500,
            Range: 2500,
            ScopeZoom: 2.0,
            Spread: 0.005      // NEW: Even tighter spread
        }
        */
    };

    /**
     * Retrieves the data object for a specific sniper.
     * Falls back to the DefaultSniperId (M4800) if not found.
     */
    static getSniperData(weaponId) {
        return this.Snipers[weaponId] || this.Snipers[this.DefaultSniperId];
    }

    // --- FALLBACK GETTERS ---
    // These allow Client.js and M800Logic.js to keep using "SniperData.Scale"
    // for the default weapon without breaking the initial render loop.
    static get Image() { return this.Snipers[this.DefaultSniperId].Image; }
    static get Scale() { return this.Snipers[this.DefaultSniperId].Scale; }
    static get HandImage() { return this.Snipers[this.DefaultSniperId].HandImage; }
    static get HandScale() { return this.Snipers[this.DefaultSniperId].HandScale; }
    static get RotateImage() { return this.Snipers[this.DefaultSniperId].RotateImage; }
    static get HandRotateImage() { return this.Snipers[this.DefaultSniperId].HandRotateImage; }
    static get GunOffset() { return this.Snipers[this.DefaultSniperId].GunOffset; }
    static get HandOffsets() { return this.Snipers[this.DefaultSniperId].HandOffsets; }
    static get Cocking() { return this.Snipers[this.DefaultSniperId].Cocking; }

    static get BulletOffset() {
        return this.Snipers[this.DefaultSniperId].BulletOffset || { x: 60, y: -35 };
    }
}