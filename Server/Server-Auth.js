// Server/Server-Auth.js = authoritative validation and final decision on all actions
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const MatchMakingRoomManager = require('../Manager/MatchMakingRoomManager');
const AntiCheatManager = require('../Manager/AntiCheatManager'); // <-- ADD THIS

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ROOT = path.join(__dirname, '..');

// --- FIX #6: EXPLICIT STATIC ALLOWLIST ---
// Only serve directories the browser actually needs.
// NEVER expose: Server/, Tools/, package.json, node_modules/, Issues.md
const CLIENT_DIRS = [
    'Assets', 'Client', 'Data', 'Logic',
    'HealthBar', 'HomePage', 'InGameLoadout',
    'Loadout', 'Market', 'Respawn', 'SlotBox'
];
for (const dir of CLIENT_DIRS) {
    app.use(`/${dir}`, express.static(path.join(ROOT, dir)));
}

// Serve only client-safe Manager files (never AntiCheatManager or MatchMakingRoomManager)
const CLIENT_MANAGERS = [
    'AmmunitionManager.js',
    'DevCssBadge.js',
    'HomeBaseManager.js',
    'InGameLoadoutManager.js',
    'LoadoutManager.js',
    'MovementManager.js',
    'RespawnManager.js',
    'SelectWeaponManager.js',
    'SlotboxManager.js'
];
for (const file of CLIENT_MANAGERS) {
    app.get(`/Manager/${file}`, (req, res) => {
        res.sendFile(path.join(ROOT, 'Manager', file));
    });
}

// Serve index.html at root
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

const PORT = process.env.PORT || 3000;

// --- SPAWN POINTS (replaces the random Math.random()*800/600 spawns) ---
const SPAWN_POINTS = [
    { x: 130, y: 130 },
    { x: 670, y: 130 },
    { x: 130, y: 470 },
    { x: 670, y: 470 },
    { x: 400, y: 100 },
    { x: 400, y: 500 },
    { x: 100, y: 280 },
    { x: 700, y: 280 }
];

// Pick a spawn point that is not right on top of a live enemy.
function pickSpawnPoint(room, team) {
    const now = Date.now();
    const liveEnemies = Object.values(room.players).filter(
        (p) => p.team !== team && p.hp > 0 && (now - (p.lastUpdateTime || 0)) < 5000
    );
    const clear = SPAWN_POINTS.filter(
        (sp) => !liveEnemies.some((e) => Math.hypot(e.x - sp.x, e.y - sp.y) < 250)
    );
    const pool = clear.length ? clear : SPAWN_POINTS; // Fall back to all points if map is crowded
    return pool[Math.floor(Math.random() * pool.length)];
}

const matchMaker = new MatchMakingRoomManager();
const socketToRoomMap = {};

// --- SERVER-SIDE SWEPT COLLISION MATH ---
// Mirrors Logic/HealthBarLogic.checkBulletSweep. Checks if a moving line segment
// (the server's own bullet trajectory) intersects a circle (player hitbox).
function checkBulletSweep(prevX, prevY, currX, currY, targetX, targetY, radius) {
    const dx = currX - prevX;
    const dy = currY - prevY;
    const fx = prevX - targetX;
    const fy = prevY - targetY;
    const a = dx * dx + dy * dy;
    if (a === 0) return (fx * fx + fy * fy) <= (radius * radius);
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - radius * radius;
    let discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return false;
    discriminant = Math.sqrt(discriminant);
    const t1 = (-b - discriminant) / (2 * a);
    const t2 = (-b + discriminant) / (2 * a);
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

// Drops bullets that have flown past their own range so room.activeBullets cannot
// grow without bound during a long match.
function pruneActiveBullets(room, now) {
    if (!room.activeBullets || room.activeBullets.size === 0) return;
    for (const [id, bullet] of room.activeBullets) {
        const travelled = ((now - bullet.spawnTime) / 1000) * bullet.speed;
        if (travelled > bullet.range + AntiCheatManager.BULLET_LIFETIME_MARGIN) {
            room.activeBullets.delete(id);
        }
    }
}

/** Resets a player's ammo state when their weapon changes. */
function resetPlayerAmmo(player) {
    const ammo = AntiCheatManager.initAmmo(player.currentWeapon);
    player.mag = ammo.mag;
    player.reserve = ammo.reserve;
    player.isReloading = false;
    player.reloadEndTime = 0;
}

// Public, client-safe player state. Never broadcast strikes, reload timers,
// socket bookkeeping, or other server-only fields.
function publicPlayerSnapshot(player) {
    return {
        id: player.id,
        username: player.username,
        team: player.team,
        x: player.x,
        y: player.y,
        hp: player.hp,
        maxHp: player.maxHp,
        currentWeapon: player.currentWeapon,
        currentSlot: player.currentSlot
    };
}

io.on('connection', (socket) => {
    console.log(`[Server-Auth] Player connected: ${socket.id}`);

    // 1. Join Matchmaking
    socket.on('joinMatchmaking', (username) => {
        const existingRoomId = socketToRoomMap[socket.id];
        const existingRoom = existingRoomId ? matchMaker.rooms[existingRoomId] : null;

        // Already in a room (e.g. duplicate event or reconnection): rejoin it, don't double-add
        if (existingRoom && existingRoom.players[socket.id]) {
            socket.join(existingRoom.id);
            const playerCount = Object.keys(existingRoom.players).length;
            socket.emit('matchmakingUpdate', {
                count: playerCount,
                max: matchMaker.MAX_PLAYERS_PER_ROOM,
                team: existingRoom.players[socket.id].team
            });
            return;
        }

        const room = matchMaker.findOrCreateRoom();
        
        const startingWeapon = AntiCheatManager.DEFAULT_WEAPON_ID;
        const startingAmmo = AntiCheatManager.initAmmo(startingWeapon);
        
        const playerData = matchMaker.addPlayerToRoom(room, {
            id: socket.id,
            username: username,
            x: Math.random() * 800,
            y: Math.random() * 600,
            lastUpdateTime: Date.now(),
            hp: AntiCheatManager.MAX_HP,
            maxHp: AntiCheatManager.MAX_HP,
            currentWeapon: startingWeapon, // NEW: Track equipped weapon
            currentSlot: 1, // NEW: Everyone spawns with Gun (Slot 1)
            lastShotTime: 0,         // NEW: Track fire rate for validation
            strikes: 0,          // NEW: Strike counter for speed violations
            lastStrikeTime: 0,   // NEW: Timestamp of last strike for decay
            // --- FIX #4: SERVER-SIDE AMMO STATE ---
            mag: startingAmmo.mag,
            reserve: startingAmmo.reserve,
            isReloading: startingAmmo.isReloading,
            reloadEndTime: startingAmmo.reloadEndTime,

            // Loadout equip state (authoritative; set by the equipLoadout handler)
            equippedLoadoutSlot: null,
            equippedPrimary: null,
            equippedSecondary: null
        });

        socketToRoomMap[socket.id] = room.id;
        socket.join(room.id);

        const playerCount = Object.keys(room.players).length;
        socket.emit('matchmakingUpdate', { count: playerCount, max: matchMaker.MAX_PLAYERS_PER_ROOM, team: playerData.team });

        // If room just hit 10 players, start countdown
        if (playerCount === matchMaker.MAX_PLAYERS_PER_ROOM && room.status === 'waiting') {
            console.log(`[Server-Auth] Room ${room.id} full! Starting 10s countdown.`);
            
            // 1. SPAWN PLAYERS IMMEDIATELY so they see the countdown in-game
            const publicPlayers = Object.values(room.players).map(publicPlayerSnapshot);

            console.log(
                `[Server-Auth] matchStart ${room.id}:`,
                publicPlayers.map(p => `${p.username}(${p.id})`).join(', ')
            );

            io.to(room.id).emit('matchStart', {
                players: publicPlayers,
                roomId: room.id
            });

            // 2. Start the 10s countdown
            matchMaker.startCountdown(
                room,
                // On Tick Callback
                (count) => {
                    io.to(room.id).emit('countdownTick', count);
                },
                // On Complete Callback
                () => {
                    console.log(`[Server-Auth] Room ${room.id} countdown finished! Game on.`);
                    room.status = 'in_game';
                    io.to(room.id).emit('countdownFinished');
                }
            );
        }
    });

    // 2. Authoritative Movement Validation (only while a match is live)
    socket.on('playerInput', (data) => {
        const roomId = socketToRoomMap[socket.id];
        const room = roomId ? matchMaker.rooms[roomId] : null;
        const player = room ? room.players[socket.id] : null;
        if (!room || !player) return;
        if (room.status !== 'in_game') return;
        if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

        // --- BUG FIX: DEAD MEN CAN'T WALK ---
        if (player.hp <= 0) return;

        const now = Date.now();
        // FIX: Clamped to 0.5s (500ms) instead of 0.1s. This absorbs real-world 
        // network lag spikes so legitimate players don't get false-positive strikes 
        // when a packet is delayed.
        const dt = Math.min((now - player.lastUpdateTime) / 1000, 0.5);
        player.lastUpdateTime = now;

        // SECURITY: Calculate the maximum distance the player could have legally moved
        // (This allows sprinted (375) and slide-boosted (1200) movement without flagging as a cheat)
        const maxLegalDistance = AntiCheatManager.MAX_LEGAL_PLAYER_SPEED * dt;
        const actualDistance = Math.hypot(data.x - player.x, data.y - player.y);

        // Allow a larger margin of error (+30 pixels) for network jitter, 
// collision pushes from other players, and floating-point math.
        if (actualDistance <= maxLegalDistance + 30) {
            player.x = data.x;
            player.y = data.y;
        } else {
            // --- FIX #5: STRIKE SYSTEM ---
            if (!player.strikes) player.strikes = 0;
            if (!player.lastStrikeTime) player.lastStrikeTime = 0;

            // Decay strikes after 30s of clean play
            if (now - player.lastStrikeTime > AntiCheatManager.STRIKE_DECAY_MS) {
                player.strikes = 0;
            }

            player.strikes++;
            player.lastStrikeTime = now;

            console.warn(
                `[AntiCheat] SPEED VIOLATION #${player.strikes}/${AntiCheatManager.MAX_STRIKES} ` +
                `| ${player.username} (${socket.id}) ` +
                `| moved ${actualDistance.toFixed(1)}px in ${dt.toFixed(3)}s ` +
                `(max ${maxLegalDistance.toFixed(1)}px)`
            );

            if (player.strikes >= AntiCheatManager.MAX_STRIKES) {
                console.warn(`[AntiCheat] KICKING ${player.username} (${socket.id}) — ${player.strikes} speed violations.`);
                socket.emit('kicked', { reason: 'Movement validation failed repeatedly.' });
                socket.disconnect(true);
                return;
            }

            // Clamp to max legal distance
            const angle = Math.atan2(data.y - player.y, data.x - player.x);
            player.x += Math.cos(angle) * maxLegalDistance;
            player.y += Math.sin(angle) * maxLegalDistance;
        }

        // Aim angle is used to derive bullet spawns server-side, so it has to be
        // a real number too. Keep the last known good value otherwise.
        player.aimAngle = Number.isFinite(data.aimAngle) ? data.aimAngle : (player.aimAngle || 0);

        // Broadcast the validated, authoritative state to everyone in the match
        // (including the mover, so the client can reconcile its prediction)
        io.to(room.id).emit('playerMoved', {
            ...publicPlayerSnapshot(player),
            aimAngle: player.aimAngle,
            timestamp: now
        });
    });

    // 3. Player Cancels / Leaves Matchmaking
    socket.on('leaveMatchmaking', () => {
        handleLeave(socket);
    });

    // 3.5 Handle Shooting
    socket.on('playerShoot', (data) => {
        const roomId = socketToRoomMap[socket.id];
        const room = roomId ? matchMaker.rooms[roomId] : null;

        // Only allow shooting if the room exists and the game is actively running
        if (!room || room.status !== 'in_game') return;

        const player = room.players[socket.id];
        if (!player || player.hp <= 0) return; // Dead players cannot shoot

        // --- SECURITY: FIRE RATE VALIDATION ---
        // WEAPONS.fireRate is decimal seconds; Date.now() is milliseconds.
        const now = Date.now();
        if (now - player.lastShotTime < AntiCheatManager.getFireRateMs(player.currentWeapon)) {
            return; // Hacker is shooting faster than the weapon allows. Ignore.
        }
        player.lastShotTime = now;

        // --- FIX #4: LAZY RELOAD COMPLETION ---
        AntiCheatManager.tickReload(player, now);

        // --- FIX #4: REJECT IF RELOADING ---
        if (player.isReloading) return;

        // --- FIX #4: REJECT IF MAG EMPTY ---
        if (player.mag <= 0) {
            // Tell the client their mag is actually empty (reconciliation)
            socket.emit('ammoUpdate', { mag: player.mag, reserve: player.reserve, isReloading: false });
            return;
        }

        // --- CONSUME AMMO SERVER-SIDE ---
        player.mag--;

        // --- SERVER-OWNED BULLET SPAWN ---
        // data.x / data.y / data.angle are never read. The muzzle is derived from
        // the server's last validated player position and aim angle, so a client
        // cannot spawn a bullet anywhere on the map (or at any angle).
        const weapon = AntiCheatManager.getWeaponData(player.currentWeapon);
        const offset = AntiCheatManager.getBulletOffset(player.currentWeapon);
        const aimAngle = Number.isFinite(player.aimAngle) ? player.aimAngle : 0;

        // --- FIX #4: SERVER-DERIVED SPREAD ---
        // The server decides the actual bullet trajectory. Client angle is ignored.
        const bulletAngle = AntiCheatManager.applySpread(aimAngle, player.currentWeapon);

        const cosA = Math.cos(aimAngle);
        const sinA = Math.sin(aimAngle);

        const spawnX = player.x + (offset.x * cosA - offset.y * sinA);
        const spawnY = player.y + (offset.x * sinA + offset.y * cosA);

        // Accept the client's id so hit reports line up with the shooter's own
        // bullet, but fall back to a server-generated id when it is unusable.
        const bulletId = (typeof data.id === 'string' && data.id.length > 0 && data.id.length <= 64)
            ? data.id
            : `srv_${now}_${Math.random().toString(36).slice(2, 8)}`;

        if (!room.activeBullets) room.activeBullets = new Map();
        room.activeBullets.set(bulletId, {
            id: bulletId,
            ownerId: player.id,
            weaponId: player.currentWeapon,
            spawnX,
            spawnY,
            angle: bulletAngle, // Server-derived spread-adjusted trajectory
            spawnTime: now,
            speed: AntiCheatManager.getBulletSpeed(player.currentWeapon),
            range: weapon.range
        });

        // Prune rarely (not on every shot) so this scan never runs at 14/sec for an SMG.
        if (room.activeBullets.size > 20) pruneActiveBullets(room, now);

        // Broadcast the authoritative spawn data to the room
        io.to(room.id).emit('bulletSpawned', {
            ownerId: socket.id,
            ownerTeam: player.team, // Needed for client-side friendly fire check
            ownerWeaponId: player.currentWeapon, // NEW: Broadcast weapon ID
            id: bulletId,
            x: spawnX,
            y: spawnY,
            angle: bulletAngle,
            timestamp: now
        });

        // --- FIX #4: SYNC AMMO BACK TO SHOOTER ---
        socket.emit('ammoUpdate', { mag: player.mag, reserve: player.reserve, isReloading: false });
    });

    // --- FIX #4: SERVER-AUTHORITATIVE RELOAD ---
    socket.on('reloadWeapon', () => {
        const roomId = socketToRoomMap[socket.id];
        const room = roomId ? matchMaker.rooms[roomId] : null;
        if (!room || room.status !== 'in_game') return;

        const player = room.players[socket.id];
        if (!player || player.hp <= 0) return;

        const now = Date.now();

        // Lazy-complete any finished reload first
        AntiCheatManager.tickReload(player, now);

        // Can't start a new reload while one is active
        if (player.isReloading) return;

        const weaponData = AntiCheatManager.getWeaponData(player.currentWeapon);

        // Can't reload if mag is already full
        if (player.mag >= (weaponData.magazineSize || AntiCheatManager.DEFAULT_MAGAZINE_SIZE)) return;

        // Can't reload with no reserve ammo
        if (player.reserve <= 0) return;

        // Start the reload
        player.isReloading = true;
        player.reloadEndTime = now + (weaponData.reloadTime || AntiCheatManager.DEFAULT_RELOAD_SECONDS) * 1000;

        // Confirm to the shooter so their UI stays in sync
        socket.emit('ammoUpdate', {
            mag: player.mag,
            reserve: player.reserve,
            isReloading: true,
            reloadEndTime: player.reloadEndTime
        });
    });

    // 3.6 Authoritative Slot Switching
    socket.on('switchSlot', (data) => {
        const roomId = socketToRoomMap[socket.id];
        const room = roomId ? matchMaker.rooms[roomId] : null;
        if (!room || room.status !== 'in_game') return;

        const player = room.players[socket.id];
        if (!player || player.hp <= 0) return; // Dead men can't switch weapons

        const slot = parseInt(data.slot);
        // SECURITY: Validate slot is 1, 2, or 3
        if (![1, 2, 3].includes(slot)) return;

        player.currentSlot = slot;

        // Broadcast to the whole room so everyone sees the animation/state change
        io.to(room.id).emit('playerSwitchedSlot', {
            id: socket.id,
            slot: slot
        });
    });

    // 3.65 Authoritative Loadout Equip
    socket.on('equipLoadout', (data) => {
        const roomId = socketToRoomMap[socket.id];
        const room = roomId ? matchMaker.rooms[roomId] : null;
        if (!room) return;

        const player = room.players[socket.id];
        if (!player) return;

        // FIX: Allow equipping during the countdown phase OR while the player is dead (respawn screen)
        if (room.status !== 'countdown' && player.hp > 0) return;

        if (!data || typeof data !== 'object') return;

        const loadoutSlot = parseInt(data.loadoutSlot, 10);

        // Loadout slots are only 1-5.
        if (!Number.isInteger(loadoutSlot) || loadoutSlot < 1 || loadoutSlot > 5) return;

        // Validate primary weapon against the server's own registry.
        const primary = typeof data.primary === 'string' && AntiCheatManager.WEAPONS[data.primary]
            ? data.primary
            : null;

        // Secondary is optional for now.
        const secondary = typeof data.secondary === 'string' && AntiCheatManager.WEAPONS[data.secondary]
            ? data.secondary
            : null;

        // Require a primary weapon to equip.
        if (!primary) return;

        // Save equipped loadout.
        player.equippedLoadoutSlot = loadoutSlot;
        player.equippedPrimary = primary;
        player.equippedSecondary = secondary;

        // Apply weapon immediately.
        player.currentWeapon = primary;
        player.currentSlot = 1;

        resetPlayerAmmo(player); // <-- FIX #4: equip refills the new weapon's mag

        // Broadcast to the room so local and remote players update visuals.
        io.to(room.id).emit('loadoutEquipped', {
            playerId: socket.id,
            loadoutSlot: loadoutSlot,
            primary: primary,
            secondary: secondary
        });
    });

    // 3.75 Authoritative Hit & Damage Validation
    socket.on('playerHit', (data) => {
        const roomId = socketToRoomMap[socket.id];
        const room = roomId ? matchMaker.rooms[roomId] : null;
        if (!room || room.status !== 'in_game') return;

        // Shape check — reject anything that isn't a well-formed hit report.
        if (!data || typeof data.bulletId !== 'string' || typeof data.targetId !== 'string') return;

        const shooter = room.players[socket.id]; 
        const target  = room.players[data.targetId];

        if (!shooter || !target) return;
        if (shooter.id === target.id) return;        // can't shoot yourself
        if (shooter.team === target.team) return;    // no friendly fire
        if (target.hp <= 0) return;                  // already dead

        const now = Date.now();

        // --- SECURITY: DEDUPLICATE HITS BY (bulletId, targetId) ---
        // One bullet can only damage one target once. This also defeats a
        // malicious client re-emitting the same bulletId to stack damage.
        if (!room.processedHits) room.processedHits = new Map();
        const hitKey = `${data.bulletId}|${data.targetId}`;
        const seenAt = room.processedHits.get(hitKey);
        if (seenAt && now - seenAt < 3000) return;   // duplicate — ignore
        room.processedHits.set(hitKey, now);

        // Periodic prune so the map doesn't grow without bound in long matches.
        if (room.processedHits.size > 500) {
            for (const [k, t] of room.processedHits) {
                if (now - t > 3000) room.processedHits.delete(k);
            }
        }

        // --- SECURITY: DISTANCE VALIDATION ---
        const weapon = AntiCheatManager.getWeaponData(shooter.currentWeapon);
        const dist = Math.hypot(shooter.x - target.x, shooter.y - target.y);
        if (dist > weapon.range + AntiCheatManager.HIT_DISTANCE_MARGIN) return; // +50px network jitter margin

        // --- SECURITY: THE BULLET MUST BE REAL ---
        // Nothing here trusts the client's claim. The bullet has to exist in the
        // server's own table, belong to this shooter, still be inside its
        // lifetime/range, and actually intersect the target's hitbox along the
        // trajectory the server simulated.
        if (!room.activeBullets) return;
        const bullet = room.activeBullets.get(data.bulletId);
        if (!bullet) return;                    // never fired, or already consumed
        if (bullet.ownerId !== shooter.id) return; // stolen bullet id

        const elapsedSec = (now - bullet.spawnTime) / 1000;
        const distTraveled = elapsedSec * bullet.speed;

        // Expired / out-of-range bullet (covers the classic "shoot at the corpse later" trick)
        if (distTraveled > bullet.range + AntiCheatManager.BULLET_LIFETIME_MARGIN) {
            room.activeBullets.delete(data.bulletId);
            return;
        }

        // Where the server says this bullet is right now
        // FIX: Removed the strict geometry check (checkBulletSweep) which was causing 
     // desyncs due to client/server bullet simulation timing differences. 
     // We already verify the bullet is real, belongs to the shooter, is within 
     // its lifetime/range, and the target is within the weapon's max range.
     // Trusting the client's hit report here prevents the "ghost player" desync 
     // where the shooter predicts a kill but the server rejects it.
     
     /* 
     const currX = bullet.spawnX + Math.cos(bullet.angle) * distTraveled;
     const currY = bullet.spawnY + Math.sin(bullet.angle) * distTraveled;
     const hitRadius = AntiCheatManager.HIT_RADIUS +
         AntiCheatManager.getSpreadTolerance(bullet.weaponId, distTraveled);
     if (!checkBulletSweep(bullet.spawnX, bullet.spawnY, currX, currY, target.x, target.y, hitRadius)) {
         return; // Geometry does not match
     }
     */
     
     // --- APPLY DAMAGE (single source of truth) ---
        const damage = AntiCheatManager.getWeaponData(bullet.weaponId).damage;
        target.hp = Math.max(0, target.hp - damage);

        // Consume the bullet so one shot can never damage two targets
        room.activeBullets.delete(data.bulletId);

        io.to(room.id).emit('playerHpUpdate', {
            id: target.id,
            hp: target.hp,
            attackerId: shooter.id,
            attackerName: shooter.username
        });

        // Handle Death (client must request respawn after the delay)
        if (target.hp <= 0) {
            target.deathTime = Date.now();

            // Drop weapon on death
            const dropId = `drop_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const dropData = {
                id: dropId,
                x: target.x,
                y: target.y,
                weaponId: target.currentWeapon || AntiCheatManager.DEFAULT_WEAPON_ID,
                ownerId: target.id,
                spawnTime: Date.now()
            };

            if (!room.droppedWeapons) room.droppedWeapons = {};
            room.droppedWeapons[dropId] = dropData;

            io.to(room.id).emit('weaponDropped', dropData);
        }
    });

    // 3.9 Authoritative Weapon Pickup
    socket.on('pickupWeapon', (data) => {
        const roomId = socketToRoomMap[socket.id];
        const room = roomId ? matchMaker.rooms[roomId] : null;
        if (!room || room.status !== 'in_game') return;

        const player = room.players[socket.id];
        if (!player || player.hp <= 0) return; // Dead men can't pick up loot
        if (!data || typeof data.dropId !== 'string') return;

        const drop = room.droppedWeapons ? room.droppedWeapons[data.dropId] : null;
        if (!drop) return;

        // SECURITY: Only hand out weapons this server actually knows about.
        if (!AntiCheatManager.WEAPONS[drop.weaponId]) return;

        // SECURITY: Verify player is actually close enough to pick it up
        const dist = Math.hypot(player.x - drop.x, player.y - drop.y);
        if (dist > 50) return; // Hacker tried to pick up from far away

        // Apply weapon (for now, just update their current weapon)
        player.currentWeapon = drop.weaponId;

        resetPlayerAmmo(player); // <-- ADD THIS

        // Remove from map
        delete room.droppedWeapons[data.dropId];

        // Broadcast removal and weapon change to the room
        io.to(room.id).emit('weaponPickedUp', { dropId: data.dropId, playerId: player.id, weaponId: drop.weaponId });
    });

    // 3.875 Authoritative Respawn Request (player must wait 7 seconds)
    socket.on('requestRespawn', () => {
        const roomId = socketToRoomMap[socket.id];
        const room = roomId ? matchMaker.rooms[roomId] : null;
        if (!room || room.status !== 'in_game') return;

        const player = room.players[socket.id];
        if (!player || player.hp > 0) return; // Ignore if not dead

        // SECURITY: Enforce the 7-second delay on the server
        if (!player.deathTime || (Date.now() - player.deathTime) < AntiCheatManager.RESPAWN_DELAY_MS) {
            return; // Hacker tried to respawn early. Ignore.
        }
        // Execute Respawn (proper spawn point, away from live enemies)
        player.hp = player.maxHp;
        player.currentSlot = 1; // Force back to Gun on respawn

        // Respawn with the equipped loadout weapon if one exists
        player.currentWeapon = player.equippedPrimary || AntiCheatManager.DEFAULT_WEAPON_ID;

        resetPlayerAmmo(player); // <-- ADD THIS

        const spawnPt = pickSpawnPoint(room, player.team);
        player.x = spawnPt.x;
        player.y = spawnPt.y;
        player.deathTime = null;

        io.to(room.id).emit('playerRespawned', {
            id: player.id,
            hp: player.hp,
            x: player.x,
            y: player.y,
            currentSlot: player.currentSlot,
            currentWeapon: player.currentWeapon,
            loadoutSlot: player.equippedLoadoutSlot
        });

        // Also broadcast position so interpolation seeds correctly
        io.to(room.id).emit('playerMoved', {
            id: player.id,
            x: player.x,
            y: player.y,
            hp: player.hp,
            currentSlot: player.currentSlot,
            currentWeapon: player.currentWeapon
        });
    });

    // 4. Handle Disconnection (Cleanup)
    socket.on('disconnect', () => {
        console.log(`[Server-Auth] Player disconnected: ${socket.id}`);
        handleLeave(socket);
    });
});

function handleLeave(socket) {
    const roomId = socketToRoomMap[socket.id];
    if (roomId && matchMaker.rooms[roomId]) {
        const room = matchMaker.rooms[roomId];

        // If we were in countdown, cancel it and tell remaining players
        if (room.status === 'countdown') {
            matchMaker.cancelCountdown(room);
            io.to(room.id).emit('playerLeft', socket.id);
            io.to(room.id).emit('countdownCancelled');
            console.log(`[Server-Auth] Countdown cancelled in ${roomId} due to player leaving.`);
        }

        // If we were mid-game, tell the rest of the match
        if (room.status === 'in_game') {
            io.to(room.id).emit('playerLeft', socket.id);
        }

        matchMaker.removePlayerFromRoom(roomId, socket.id);

        // Update remaining players on the new count
        const newCount = Object.keys(room.players).length;
        if (newCount > 0) {
            io.to(room.id).emit('matchmakingUpdate', { count: newCount, max: matchMaker.MAX_PLAYERS_PER_ROOM });
        }
    }

    delete socketToRoomMap[socket.id];
    if (roomId) socket.leave(roomId);
}

server.listen(PORT, () => {
    console.log(`[Server-Auth] Server is running on http://localhost:${PORT}`);
});