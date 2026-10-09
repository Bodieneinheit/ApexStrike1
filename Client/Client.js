// Client/Client.js = visual rendering and feedback for the player
import HomeBaseManager from '../Manager/HomeBaseManager.js';
import UserData from '../Data/UserData.js';
import SniperData from '../Data/SniperData.js';
import ShootingData from '../Data/ShootingData.js';
import M800Logic from '../Logic/M800Logic.js';
import CameraData from '../Data/CameraData.js';
import CameraLogic from '../Logic/CameraLogic.js';
import HealthBarData from '../Data/HealthBarData.js';
import HealthBarLogic from '../Logic/HealthBarLogic.js';
import CockingAGun from '../Logic/CockingAGun.js';
import RecoilLogic from '../Logic/RecoilLogic.js';
import AccuracyLogic from '../Logic/AccuracyLogic.js';
import UserCollisionLogic from '../Logic/UserCollisionLogic.js';
import HandData from '../Data/HandData.js';
import HandLogic from '../Logic/HandLogic.js';
import WeaponRegistry from '../Data/WeaponRegistry.js';
import WeaponDropData from '../Data/WeaponDropData.js';
import RespawnManager from '../Manager/RespawnManager.js';
import MovementManager from '../Manager/MovementManager.js';
import SlotboxManager from '../Manager/SlotboxManager.js';
import LoadoutManager from '../Manager/LoadoutManager.js';
import SelectWeaponManager from '../Manager/SelectWeaponManager.js';
import InGameLoadoutManager from '../Manager/InGameLoadoutManager.js';
import DevCssBadge from '../Manager/DevCssBadge.js';
import AmmunitionManager from '../Manager/AmmunitionManager.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const matchmakingStatus = document.getElementById('matchmaking-status');
const matchmakingText = document.getElementById('matchmaking-text');
const cancelBtn = document.getElementById('cancel-btn');

// --- HP VISUAL ELEMENTS ---
const damageOverlay = document.getElementById('damage-overlay');

let respawnManager = null;

const movementManager = new MovementManager();
const ammunitionManager = new AmmunitionManager();
// Pass a callback that emits to the server whenever the local player changes slots
const slotboxManager = new SlotboxManager((slot) => {
    if (socket && isMatchActive) {
        socket.emit('switchSlot', { slot: slot });
    }
});

function triggerDamageFlash() {
    if (!damageOverlay) return;
    // Remove and re-add class to force animation restart for rapid hits
    damageOverlay.classList.remove('active');
    void damageOverlay.offsetWidth; // Force reflow
    damageOverlay.classList.add('active');
}

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- SPRITES ---
// Raw source images are only used ONCE to pre-render scaled offscreen canvases.
// The render loop then blits those pre-sized canvases instead of resampling big
// PNG textures every frame (huge Canvas2D win on low-end devices).
const userSprite = new Image();
const handSprite = new Image();
const bulletSprite = new Image();
const leftHandSprite = new Image();
const rightHandSprite = new Image();

// --- DYNAMIC WEAPON SPRITE CACHE ---
// Every weapon in WeaponRegistry is pre-loaded and pre-scaled ONCE at boot,
// keyed by weaponId. Picking up a different gun mid-match then costs nothing:
// no fetch, no resample, just a different object out of the cache.
const weaponSprites = {};        // weaponId -> raw Image
const scaledWeaponSprites = {};  // weaponId -> pre-scaled offscreen canvas
const handSprites = {};          // weaponId -> raw hand Image (only if it overrides)
const scaledHandSprites = {};    // weaponId -> pre-scaled hand canvas

const DEFAULT_WEAPON_ID = WeaponRegistry.DefaultWeaponId;

let scaledUserSprite = null;
let scaledWeaponSprite = null;   // default weapon's canvas, used as render fallback
let scaledHandSprite = null;
let scaledBulletSprite = null;
let scaledLeftHandSprite = null;
let scaledRightHandSprite = null;

function createScaledCanvas(image, scale) {
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.max(1, Math.round(image.naturalWidth * scale));
    offscreen.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(image, 0, 0, offscreen.width, offscreen.height);
    return offscreen;
}

userSprite.onload = () => { scaledUserSprite = createScaledCanvas(userSprite, UserData.Scale); };
handSprite.onload = () => { scaledHandSprite = createScaledCanvas(handSprite, SniperData.HandScale); };
bulletSprite.onload = () => { scaledBulletSprite = createScaledCanvas(bulletSprite, ShootingData.Scale); };

// Unarmed hand onload
leftHandSprite.onload = () => { scaledLeftHandSprite = createScaledCanvas(leftHandSprite, HandData.Scale); };
rightHandSprite.onload = () => { scaledRightHandSprite = createScaledCanvas(rightHandSprite, HandData.Scale); };

userSprite.src = UserData.Image;
handSprite.src = SniperData.HandImage;
bulletSprite.src = ShootingData.Image;

// Unarmed hand sources
leftHandSprite.src = HandData.LeftHandImage;
rightHandSprite.src = HandData.RightHandImage;

// Helpful console warnings if asset paths are wrong
userSprite.onerror = () => console.warn('[Client.js] Failed to load user sprite:', UserData.Image);
handSprite.onerror = () => console.warn('[Client.js] Failed to load hand sprite:', SniperData.HandImage);
bulletSprite.onerror = () => console.warn('[Client.js] Failed to load bullet sprite:', ShootingData.Image);
leftHandSprite.onerror = () => console.warn('[Client.js] Failed to load left hand sprite:', HandData.LeftHandImage);
rightHandSprite.onerror = () => console.warn('[Client.js] Failed to load right hand sprite:', HandData.RightHandImage);

// --- AUTO-LOAD EVERY WEAPON DEFINED IN THE REGISTRY ---
// Adding a weapon to Data/ is all it takes for it to render correctly.
for (const weaponId in WeaponRegistry.weapons) {
    const wData = WeaponRegistry.weapons[weaponId];
    if (!wData || !wData.Image) continue;

    const img = new Image();
    img.onload = () => {
        scaledWeaponSprites[weaponId] = createScaledCanvas(img, wData.Scale || 1);
        if (weaponId === DEFAULT_WEAPON_ID) scaledWeaponSprite = scaledWeaponSprites[weaponId];
    };
    img.onerror = () => console.warn(`[Client.js] Failed to load weapon sprite for ${weaponId}:`, wData.Image);
    img.src = wData.Image;
    weaponSprites[weaponId] = img;

    // Hand sprite: the default weapon already uses the global handSprite above,
    // so only weapons that bring their own art need an extra load.
    if (weaponId !== DEFAULT_WEAPON_ID && wData.HandImage) {
        const hImg = new Image();
        hImg.onload = () => { scaledHandSprites[weaponId] = createScaledCanvas(hImg, wData.HandScale || SniperData.HandScale); };
        hImg.onerror = () => console.warn(`[Client.js] Failed to load hand sprite for ${weaponId}:`, wData.HandImage);
        hImg.src = wData.HandImage;
        handSprites[weaponId] = hImg;
    }
}

// Raw default-weapon image, kept as the early-frames fallback in the draw calls.
const weaponSprite = weaponSprites[DEFAULT_WEAPON_ID] || new Image();

// Reused scratch objects: drawPlayerEntity runs per player per rendered frame,
// so these lookups must not allocate.
const gunArtResult = { scaled: null, raw: null };
const handArtResult = { scaled: null, raw: null };

/**
 * Sprite pair for the gun a player is currently holding.
 * Falls back to the default weapon's art so a mid-load frame (or an unknown
 * weaponId from a stale client) still draws something sensible.
 */
function getWeaponSprites(weaponId) {
    gunArtResult.scaled = scaledWeaponSprites[weaponId] || scaledWeaponSprites[DEFAULT_WEAPON_ID] || null;
    gunArtResult.raw = weaponSprites[weaponId] || weaponSprite;
    return gunArtResult;
}

/** Same as getWeaponSprites, but for the hands gripping it. */
function getHandSprites(weaponId) {
    handArtResult.scaled = scaledHandSprites[weaponId] || scaledHandSprite;
    handArtResult.raw = handSprites[weaponId] || handSprite;
    return handArtResult;
}

// --- MOUSE / CAMERA ---
let screenMouseX = window.innerWidth / 2;
let screenMouseY = window.innerHeight / 2;

// These become WORLD-space mouse coordinates after camera conversion.
let mouseX = 0;
let mouseY = 0;

const camera = {
    x: 0,
    y: 0,
    zoom: CameraData.DefaultZoom
};

// Snaps the camera hard to a world position.
// Used on respawn so the POV doesn't drag from the corpse to the spawn point.
function snapCameraToPosition(x, y) {
    camera.x = x;
    camera.y = y;
    camera.prevX = x;
    camera.prevY = y;
}

window.addEventListener('mousemove', (e) => {
    screenMouseX = e.clientX;
    screenMouseY = e.clientY;
});

// --- SHOOTING INPUT ---
let isMouseDown = false;
let lastShotTime = 0;
let localBullets = [];
let remoteBullets = [];
let droppedWeapons = []; // Array to hold active drops on the map

// FIX #4: guards the reloadWeapon emit so holding R doesn't spam the socket
// every frame. Reset when R is released.
let reloadRequested = false;

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && isMatchActive) {
        isMouseDown = true;
        shoot(); // Fire immediately on click
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) isMouseDown = false;
});

// Fire rate comes from the equipped weapon's Data (matches the server's WEAPONS registry).
function getFireRate() {
    if (!localPlayer) return ShootingData.FireRate;
    const data = WeaponRegistry.getWeaponData(localPlayer.currentWeapon || DEFAULT_WEAPON_ID);
    return (typeof data.FireRate === 'number') ? data.FireRate : ShootingData.FireRate;
}

// Bullets travel at their own weapon's muzzle velocity (falls back to the global value).
function getBulletSpeed(weaponId) {
    const data = WeaponRegistry.getWeaponData(weaponId);
    return (typeof data.BulletSpeed === 'number') ? data.BulletSpeed : ShootingData.SpeedBullet;
}

function shoot() {
    if (!canMove) return; // Blocked during the countdown
    if (!localPlayer) return;
    if (localPlayer.hp <= 0) return;

    // Prevent shooting if not in a weapon slot
    if (slotboxManager && !slotboxManager.isWeaponSlot(slotboxManager.getActiveSlot())) return;

    const now = Date.now();
    if (now - lastShotTime < getFireRate() * 1000) return;

    // --- AMMO CHECK ---
    // Blocks the shot if the mag is empty or a reload is in progress.
    // Checked AFTER the fire-rate gate so a rejected shot does not eat a round
    // and does not reset lastShotTime (which would let a player burst-fire by
    // mashing the trigger while the mag is empty).
    if (!ammunitionManager.tryShoot()) return;
    // -----------------

    lastShotTime = now;

    // Determine the weapon first so its bullet spawn offset can be per-weapon.
    const weaponId = localPlayer.currentWeapon || DEFAULT_WEAPON_ID;
    const weaponData = WeaponRegistry.getWeaponData(weaponId);
    const bulletOffset = WeaponRegistry.getBulletOffset(weaponId);

    // --- ACCURACY / SPREAD CALCULATION ---
    const isMoving = keys.w || keys.a || keys.s || keys.d;
    const isSprinting = keys.shift;
    const maxSpread = AccuracyLogic.getSpread(weaponData, isMoving, isSprinting);

    // Visual angle is where the gun sprite points (exact crosshair)
    const visualAngle = localPlayer.aimAngle;
    // Final angle is where the bullet actually flies (with random deviation)
    const finalAimAngle = AccuracyLogic.applySpread(visualAngle, maxSpread);
    // -------------------------------------

    // Calculate rotated spawn position based on Offsets
    // NOTE: We use visualAngle here so the bullet spawns exactly out of the muzzle
    const offsetX = bulletOffset.x;
    const offsetY = bulletOffset.y;
    const cosA = Math.cos(visualAngle);
    const sinA = Math.sin(visualAngle);

    const rotatedX = (offsetX * cosA) - (offsetY * sinA);
    const rotatedY = (offsetX * sinA) + (offsetY * cosA);

    const spawnX = localPlayer.x + rotatedX;
    const spawnY = localPlayer.y + rotatedY;

    const bullet = {
        id: `${myId}_${now}_${Math.random()}`,
        x: spawnX,
        y: spawnY,
        prevX: spawnX,
        prevY: spawnY,
        angle: finalAimAngle, // Bullet travels on the spread-adjusted angle
        spawnTime: now,
        dist: 0,
        team: localPlayer.team,
        ownerWeaponId: weaponId,  // NEW: Track weapon for damage prediction
        speed: getBulletSpeed(weaponId) // NEW: Per-weapon muzzle velocity
    };
    localBullets.push(bullet);

    // Kick off the cocking animation for our own player immediately.
    CockingAGun.trigger(myId, weaponId, now);

    // -- NEW: Trigger the recoil effect ---
    RecoilLogic.trigger(myId, weaponId, now);

    if (socket) {
        socket.emit('playerShoot', {
            id: bullet.id,
            x: spawnX,
            y: spawnY,
            angle: finalAimAngle, // Server broadcasts this exact trajectory
            timestamp: now
        });
    }
}

// --- NETWORK / GAME STATE ---
let socket = null;
let myId = null;
let localPlayer = null;
let remotePlayers = {};
let isMatchActive = false;
let canMove = false; // Blocked until the server emits countdownFinished

function createRemotePlayer(p) {
    const now = Date.now();

    return {
        id: p.id,
        x: p.x,
        y: p.y,
        prevX: p.x,
        prevY: p.y,
        timestamp: p.timestamp || now,
        prevTimestamp: p.timestamp || now,
        username: p.username,
        team: p.team,
        aimAngle: p.aimAngle || 0,
        hp: p.hp ?? HealthBarData.MaxHP,
        maxHp: p.maxHp || HealthBarData.MaxHP,
        currentWeapon: p.currentWeapon || DEFAULT_WEAPON_ID,
        currentSlot: p.currentSlot || 1
    };
}

// --- COUNTDOWN / IN-GAME LOADOUT UI ---
const matchCountdownEl = document.getElementById('match-countdown');
const matchCountdownText = document.getElementById('match-countdown-text');
const ingameLoadoutOpenBtn = document.getElementById('ingame-loadout-open-btn');

// --- INPUT ---
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ' ': false,   // Slide
    shift: false, // Sprint
    r: false      // Reload
};

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    let handled = false;
    if (key === 'w' || key === 'arrowup') { keys.w = true; handled = true; }
    if (key === 's' || key === 'arrowdown') { keys.s = true; handled = true; }
    if (key === 'a' || key === 'arrowleft') { keys.a = true; handled = true; }
    if (key === 'd' || key === 'arrowright') { keys.d = true; handled = true; }
    if (key === ' ') { keys[' '] = true; handled = true; e.preventDefault(); }

    // NEW: Shift key tracking
    if (key === 'shift') { keys.shift = true; handled = true; }

    // Reload
    if (key === 'r') { keys.r = true; handled = true; }

    if (!handled) return;

    // Never hijack typing inside an input/textarea (e.g. the username box or future chat).
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    e.preventDefault();
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();

    if (key === 'w' || key === 'arrowup') keys.w = false;
    if (key === 's' || key === 'arrowdown') keys.s = false;
    if (key === 'a' || key === 'arrowleft') keys.a = false;
    if (key === 'd' || key === 'arrowright') keys.d = false;
    if (key === ' ') keys[' '] = false;

    // NEW: Shift key release
    if (key === 'shift') keys.shift = false;

    // Reload release
    if (key === 'r') keys.r = false;
});

// Reset keys if window loses focus to avoid stuck movement
window.addEventListener('blur', () => {
    keys.w = false;
    keys.a = false;
    keys.s = false;
    keys.d = false;
    keys[' '] = false;
    keys.shift = false; // Reset sprint on window blur
    keys.r = false;     // Reset reload hold on window blur
    isMouseDown = false;    // Prevent the player from firing into the void
    reloadRequested = false; // Allow a fresh R press to trigger a reload
});

// --- MOVEMENT NETWORK RATE ---
let lastSentTime = 0;
const SEND_RATE_MS = 33; // ~30 updates per second

// --- GAME LOOP CONTROL ---
// Fixed simulation step keeps movement identical and spike-free on any framerate.
const FIXED_DT = 1 / 60;
// Adaptive render cap: sim runs every rAF, but drawing is limited to a sane
// rate. On high-refresh displays (3x+ vsync) a low-end iGPU cannot re-rasterize
// the full canvas per vsync, so we target refreshHz/3 (clamped 60..120fps).
let animationFrameId = null;
let lastTime = performance.now();
let accumulator = 0;
let lastRenderTime = 0;
let loopToken = 0;

// Display refresh rate, measured live from rAF cadence (falls back to 60Hz).
let measuredRefreshHz = 60;
let currentRenderCapHz = 60;
const rafIntervals = [];
const MAX_RAF_SAMPLES = 60;
let lastRafTick = 0;

function updateRefreshMeasurement(currentTime) {
    if (lastRafTick > 0) {
        rafIntervals.push(currentTime - lastRafTick);
        if (rafIntervals.length > MAX_RAF_SAMPLES) rafIntervals.shift();
    }
    lastRafTick = currentTime;

    if (rafIntervals.length >= 10) {
        const sorted = rafIntervals.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (median > 0) {
            measuredRefreshHz = Math.max(24, Math.min(240, Math.round(1000 / median)));
        }
    }
}

// Render interval for the current target cap (refresh/3, clamped 60..120).
function getRenderCapMs() {
    const targetHz = Math.max(60, Math.min(120, Math.round(measuredRefreshHz / 3)));
    currentRenderCapHz = targetHz;
    return 1000 / targetHz;
}

function stopGameLoop() {
    // Invalidate any running loop chain so re-searching never double-drives the game.
    loopToken++;
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// --- DEBUG / VERIFICATION: FPS METER (safe to delete once tuned) ---
const fpsEl = document.createElement('div');
fpsEl.style.cssText = 'position:fixed;top:8px;left:8px;padding:4px 8px;font:12px/16px monospace;color:#fff;background:rgba(0,0,0,0.45);border-radius:4px;pointer-events:none;user-select:none;z-index:20;';
document.body.appendChild(fpsEl);

let fpsFrames = 0;
let fpsLastTime = performance.now();

// Phase cost accumulators — show WHERE frame time goes (sim / grid / sprites / text).
const perfStats = {
    sim: 0, draw: 0, grid: 0, entities: 0, text: 0,
    simFrames: 0, drawFrames: 0, gridFrames: 0, entitiesFrames: 0, textFrames: 0
};

function resetPerfStats() {
    for (const key in perfStats) perfStats[key] = 0;
}

function avgMs(acc, frames) {
    return frames > 0 ? (acc / frames).toFixed(2) : '0.00';
}

function updateFpsMeter(currentTime) {
    fpsEl.style.display = isMatchActive ? 'block' : 'none';
    if (!isMatchActive) return;

    if (currentTime - fpsLastTime >= 500) {
        const elapsed = currentTime - fpsLastTime;
        const fps = Math.round((fpsFrames * 1000) / elapsed);
        const avgFrameMs = (elapsed / fpsFrames).toFixed(1);
        fpsEl.textContent =
            `FPS: ${fps} (${avgFrameMs}ms) [cap ${currentRenderCapHz}Hz]` +
            ` | sim ${avgMs(perfStats.sim, perfStats.simFrames)}` +
            ` | draw ${avgMs(perfStats.draw, perfStats.drawFrames)}` +
            ` | grid ${avgMs(perfStats.grid, perfStats.gridFrames)}` +
            ` | sprites ${avgMs(perfStats.entities, perfStats.entitiesFrames)}`;
        resetPerfStats();
        fpsFrames = 0;
        fpsLastTime = currentTime;
    }
}

// --- GAME INITIALIZATION ---
export function initializeGame(username) {
    stopGameLoop();

    socket = io();

    // --- NEW: Initialize Respawn Manager ---
    respawnManager = new RespawnManager(() => {
        if (socket) socket.emit('requestRespawn');
    });

    matchmakingStatus.style.display = 'block';
    cancelBtn.style.display = 'inline-block';
    matchmakingText.innerText = 'Connecting to server...';

    socket.on('connect', () => {
        socket.emit('joinMatchmaking', username);
    });

    socket.on('matchmakingUpdate', (data) => {
        const teamText = data.team ? ` | Assigned Team: ${data.team.toUpperCase()}` : '';
        matchmakingText.innerText = `Waiting for players... (${data.count}/${data.max})${teamText}`;
    });

    socket.on('countdownTick', (count) => {
        if (matchCountdownText) matchCountdownText.innerText = count;
        matchmakingText.innerText = `MATCH STARTING IN ${count}...`;
    });

    socket.on('countdownFinished', () => {
        canMove = true;
        if (matchCountdownEl) matchCountdownEl.style.display = 'none';

        // The server only accepts equipLoadout during the countdown, so hide the
        // In-Game Loadout button rather than let players equip into a void.
        if (ingameLoadoutOpenBtn) ingameLoadoutOpenBtn.style.display = 'none';
        if (inGameLoadoutManager) inGameLoadoutManager.close();
    });

    socket.on('countdownCancelled', () => {
        canMove = false;
        if (matchCountdownEl) matchCountdownEl.style.display = 'none';
        if (ingameLoadoutOpenBtn) ingameLoadoutOpenBtn.style.display = 'none';
        if (inGameLoadoutManager) inGameLoadoutManager.close();
        matchmakingText.innerText = 'Countdown cancelled. Waiting for players...';
    });

    socket.on('matchStart', (data) => {
        matchmakingStatus.style.display = 'none';
        cancelBtn.style.display = 'none';

        isMatchActive = true;
        canMove = false; // Freeze movement until countdownFinished
        myId = socket.id;

        // Show the in-game countdown overlay + loadout button.
        if (matchCountdownEl) matchCountdownEl.style.display = 'block';
        if (ingameLoadoutOpenBtn) ingameLoadoutOpenBtn.style.display = 'block';

        // Ensure death screen is hidden when match starts
        if (respawnManager) respawnManager.hideDeathScreen();

        localPlayer = null;
        remotePlayers = {};
        localBullets = [];
        remoteBullets = [];
        droppedWeapons = []; // Clear drops on new match
        CockingAGun.clearAll();
        RecoilLogic.clearAll();
        movementManager.reset();
        ammunitionManager.reset();
        reloadRequested = false;
        slotboxManager.show();

        // Reset the equipped loadout slot for the new match.
        if (inGameLoadoutManager) {
            inGameLoadoutManager.reset();
        }

        data.players.forEach((p) => {
            if (p.id === myId) {
                localPlayer = {
                    id: p.id,
                    x: p.x,
                    y: p.y,
                    prevX: p.x,
                    prevY: p.y,
                    username: p.username,
                    team: p.team,
                    speed: 400,
                    aimAngle: 0,
                    hp: p.hp || HealthBarData.MaxHP,
                    maxHp: p.maxHp || HealthBarData.MaxHP,
                    currentWeapon: p.currentWeapon || DEFAULT_WEAPON_ID,
                    currentSlot: p.currentSlot || 1
                };
            } else {
                remotePlayers[p.id] = createRemotePlayer(p);
            }
        });

        // Center camera on local player immediately.
        if (localPlayer) {
            camera.x = localPlayer.x;
            camera.y = localPlayer.y;

            // Convert mouse once so aiming does not start at world 0,0.
            const initialWorldMouse = CameraLogic.screenToWorld(
                screenMouseX,
                screenMouseY,
                canvas.width,
                canvas.height,
                camera
            );

            mouseX = initialWorldMouse.x;
            mouseY = initialWorldMouse.y;
        }

        camera.prevX = camera.x;
        camera.prevY = camera.y;

        // Arm ammo for the weapon this match starts with.
        if (localPlayer) {
            ammunitionManager.initWeapon(localPlayer.currentWeapon || DEFAULT_WEAPON_ID);
            reloadRequested = false;
        }

        lastTime = performance.now();
        accumulator = 0;
        lastRenderTime = 0;
        startGameLoop();
    });

    socket.on('playerMoved', (data) => {
        if (!isMatchActive) return;

        if (data.id === myId) {
            // Client-side prediction reconciliation.
            // If server disagrees too much, correct local player.
            if (localPlayer) {
                const dist = Math.hypot(localPlayer.x - data.x, localPlayer.y - data.y);

                if (dist > 5) {
                    localPlayer.x = data.x;
                    localPlayer.y = data.y;

                    // Big correction (server clamp or a real desync): move the
                    // interpolation anchors too, otherwise the renderer
                    // interpolates the body across the map from the old spot.
                    if (dist > 40) {
                        localPlayer.prevX = data.x;
                        localPlayer.prevY = data.y;
                    }
                }

                if (typeof data.aimAngle === 'number') {
                    localPlayer.aimAngle = data.aimAngle;
                }
            }
        } else {
            // Remote player interpolation setup. If this client missed the
            // initial spawn payload, heal from the enriched movement snapshot
            // instead of silently ignoring that player forever.
            let p = remotePlayers[data.id];

            if (!p) {
                if (!data.username || !data.team) {
                    console.warn('[Client] Ignoring movement for unknown player:', data.id);
                    return;
                }

                p = remotePlayers[data.id] = createRemotePlayer(data);
            }

            p.prevX = p.x;
            p.prevY = p.y;
            p.prevTimestamp = p.timestamp;

            p.x = data.x;
            p.y = data.y;
            p.timestamp = data.timestamp;

            if (typeof data.aimAngle === 'number') p.aimAngle = data.aimAngle;
            if (typeof data.username === 'string') p.username = data.username;
            if (typeof data.team === 'string') p.team = data.team;
            if (typeof data.hp === 'number') p.hp = data.hp;
            if (typeof data.maxHp === 'number') p.maxHp = data.maxHp;
            if (typeof data.currentWeapon === 'string') p.currentWeapon = data.currentWeapon;
            if (typeof data.currentSlot === 'number') p.currentSlot = data.currentSlot;
        }
    });

    socket.on('playerLeft', (id) => {
        CockingAGun.clear(id);
        RecoilLogic.clear(id);
        delete remotePlayers[id];
    });

    // --- HP & DEATH SOCKET EVENTS ---
    socket.on('playerHpUpdate', (data) => {
        if (!isMatchActive) return;

        if (data.id === myId) {
            if (!localPlayer) return;
            // --- SERVER RECONCILIATION ---
            // If the server's truth differs from our prediction, SNAP to the server's value.
            // (e.g., Server rejected the hit because of a wall, or hacker tried to change damage)
            if (localPlayer.hp !== data.hp) {
                localPlayer.hp = data.hp;
            }

            if (data.hp <= 0) {
                // Show screen immediately with "Enemy" (Client Prediction).
                // Guarded so repeated server updates don't restart the 7s timer.
                if (respawnManager && !respawnManager.isDead) {
                    respawnManager.showDeathScreen('Enemy');
                }
                // --- FIX: Server Reconciliation for Killer Name ---
                if (respawnManager && data.attackerName) {
                    respawnManager.updateKillerName(data.attackerName);
                }

                // FIX D: Drop our own in-flight bullets. They are dead air for the
                // rest of the respawn and would otherwise appear to teleport.
                localBullets = [];
            } else if (respawnManager && respawnManager.isDead) {
                // Server rejected the fatal hit — we're actually alive. Hide the screen.
                respawnManager.hideDeathScreen();
            }
        } else if (remotePlayers[data.id]) {
            // Reconcile remote player HP
            if (remotePlayers[data.id].hp !== data.hp) {
                remotePlayers[data.id].hp = data.hp;
            }

            // FIX D: Strip the corpse's remaining shots so a dead player stops
            // dealing damage. Matched on ownerId (captured from bulletSpawned),
            // not on the id string prefix.
            if (remotePlayers[data.id].hp <= 0) {
                remoteBullets = remoteBullets.filter(b => b.ownerId !== data.id);
            }
        }
    });

    socket.on('playerRespawned', (data) => {
        if (data.id === myId) {
            if (!localPlayer) return;
            CockingAGun.clear(data.id);
            RecoilLogic.clear(data.id);

            // NEW: Auto-close the loadout screen if it's still open
            if (inGameLoadoutManager) inGameLoadoutManager.close();

            localPlayer.hp = data.hp;
            localPlayer.x = data.x;
            localPlayer.y = data.y;

            // POV SYNC: Reset the interpolation anchors and snap the camera to spawn,
            // otherwise the renderer drags both body and view from the death
            // location across the map.
            localPlayer.prevX = data.x;
            localPlayer.prevY = data.y;
            snapCameraToPosition(data.x, data.y);

            // Drop any leftover frame blending so the snap is instant.
            accumulator = 0;

            // Force UI and state back to Slot 1 (Gun)
            localPlayer.currentSlot = 1;

            // Restore equipped loadout weapon if server sends it
            if (typeof data.currentWeapon === 'string') {
                localPlayer.currentWeapon = data.currentWeapon;
            }

            // Restore equipped loadout slot in Loadout UI
            if (typeof data.loadoutSlot === 'number' && inGameLoadoutManager) {
                inGameLoadoutManager.setEquippedSlot(data.loadoutSlot);
            }

            slotboxManager.setActiveSlot(1);

            // Respawning refills the mag and tops the reserve back up.
            ammunitionManager.initWeapon(localPlayer.currentWeapon || DEFAULT_WEAPON_ID);
            reloadRequested = false;

            if (respawnManager) respawnManager.hideDeathScreen();
        } else if (remotePlayers[data.id]) {
            CockingAGun.clear(data.id);
            RecoilLogic.clear(data.id);
            const rp = remotePlayers[data.id];
            rp.hp = data.hp;
            rp.x = data.x;
            rp.y = data.y;
            // Reset interpolation anchors to spawn so the body
            // doesn't slide from the death location to spawn
            rp.prevX = data.x;
            rp.prevY = data.y;
            rp.timestamp = performance.now();
            rp.prevTimestamp = performance.now();
            // Sync equipment state
            if (data.currentSlot !== undefined) rp.currentSlot = data.currentSlot;
            if (data.currentWeapon !== undefined) rp.currentWeapon = data.currentWeapon;
            // Clear any lingering bullets from the dead player
            remoteBullets = remoteBullets.filter(b => b.ownerId !== data.id);
        }
    });

    // SYNC REMOTE SLOT CHANGES
    socket.on('playerSwitchedSlot', (data) => {
        if (data.id === myId) {
            if (localPlayer) localPlayer.currentSlot = data.slot;
        } else {
            if (remotePlayers[data.id]) {
                remotePlayers[data.id].currentSlot = data.slot;
            }
        }
    });

    // AUTHORITATIVE LOADOUT EQUIP CONFIRMATION
    socket.on('loadoutEquipped', (data) => {
        if (!isMatchActive || !data) return;

        if (data.playerId === myId) {
            if (localPlayer) {
                if (data.primary) {
                    localPlayer.currentWeapon = data.primary;
                }

                // Equipping a loadout forces the player back to weapon slot 1.
                localPlayer.currentSlot = 1;

                // New weapon, new ammo pool.
                if (data.primary) {
                    ammunitionManager.initWeapon(data.primary);
                    reloadRequested = false;
                }
            }

            if (inGameLoadoutManager) {
                inGameLoadoutManager.setEquippedSlot(data.loadoutSlot);
            }

            if (slotboxManager) {
                slotboxManager.setActiveSlot(1);
            }
        } else {
            const remote = remotePlayers[data.playerId];
            if (remote) {
                if (data.primary) {
                    remote.currentWeapon = data.primary;
                }

                remote.currentSlot = 1;
            }
        }
    });

    socket.on('bulletSpawned', (data) => {
        if (!isMatchActive) return;
        if (data.ownerId === myId) return; // Ignore our own bullets broadcasted back

        // Play the cocking animation on the shooter's hand (uses local receive time
        // so network jitter can't make the animation fire at a weird moment).
        CockingAGun.trigger(data.ownerId, data.ownerWeaponId);

        // NEW: Recoil effect on remote shooters as well.
        RecoilLogic.trigger(data.ownerId, data.ownerWeaponId);

        remoteBullets.push({
            id: data.id,
            x: data.x,
            y: data.y,
            prevX: data.x,
            prevY: data.y,
            angle: data.angle,
            spawnTime: data.timestamp,
            dist: 0,
            ownerTeam: data.ownerTeam,
            ownerId: data.ownerId,
            ownerWeaponId: data.ownerWeaponId,
            speed: getBulletSpeed(data.ownerWeaponId)
        });
    });

    // --- WEAPON DROP SOCKET EVENTS ---
    socket.on('weaponDropped', (data) => {
        if (!isMatchActive) return;
        droppedWeapons.push(data);
    });

    socket.on('weaponPickedUp', (data) => {
        // Remove from local array
        droppedWeapons = droppedWeapons.filter(d => d.id !== data.dropId);

        // Whoever picked it up now renders that weapon's sprite/offsets.
        if (data.playerId === myId) {
            if (localPlayer) {
                localPlayer.currentWeapon = data.weaponId;
                ammunitionManager.initWeapon(data.weaponId);
                reloadRequested = false;
            }
        } else if (remotePlayers[data.playerId]) {
            remotePlayers[data.playerId].currentWeapon = data.weaponId;
        }
    });

    // --- FIX #4: SERVER AMMO RECONCILIATION ---
    // The server owns the real mag/reserve counters. Snap the local HUD to
    // whatever it says instead of trusting our local prediction.
    socket.on('ammoUpdate', (data) => {
        if (!ammunitionManager.activeWeaponId) return;
        if (!Number.isFinite(data.mag) || !Number.isFinite(data.reserve)) return;

        ammunitionManager.currentMag = data.mag;
        ammunitionManager.currentReserve = data.reserve;

        if (data.isReloading && data.reloadEndTime) {
            ammunitionManager.isReloading = true;
            // reloadEndTime is an absolute epoch ms; convert to a start time so
            // the existing progress-bar math in AmmunitionManager keeps working.
            ammunitionManager.reloadStartTime =
                data.reloadEndTime - ammunitionManager.reloadDurationMs;
        } else {
            ammunitionManager.isReloading = false;
            ammunitionManager.reloadStartTime = 0;
        }
    });

    // --- FIX #5: KICK HANDLER ---
    socket.on('kicked', (data) => {
        const reason = (data && data.reason) || 'Unknown reason.';
        console.warn('[Client] Kicked:', reason);
        isMatchActive = false;
        stopGameLoop();
        alert(`Disconnected: ${reason}`);
        window.location.reload();
    });
}

// --- CANCEL / LEAVE (attached ONCE — survives re-searching) ---
cancelBtn.addEventListener('click', () => {
    if (socket) {
        socket.emit('leaveMatchmaking');
        socket.disconnect();
        socket = null;
    }

    stopGameLoop();

    isMatchActive = false;
    canMove = false;
    myId = null;
    localPlayer = null;
    remotePlayers = {};
    localBullets = [];
    remoteBullets = [];
    droppedWeapons = [];
    CockingAGun.clearAll();
    RecoilLogic.clearAll();
    movementManager.reset();
    ammunitionManager.reset();
    reloadRequested = false;
    slotboxManager.hide();

    matchmakingStatus.style.display = 'none';
    cancelBtn.style.display = 'none';
    if (matchCountdownEl) matchCountdownEl.style.display = 'none';
    if (ingameLoadoutOpenBtn) ingameLoadoutOpenBtn.style.display = 'none';
    if (inGameLoadoutManager) inGameLoadoutManager.close();

    if (respawnManager) respawnManager.hideDeathScreen();

    homeManager.showHomeScreen();
});

// --- MAIN GAME LOOP ---
// Only ONE loop chain is ever alive: each new session gets a fresh token and
// any superseded chain stops itself on the next frame.
function startGameLoop() {
    const token = loopToken;

    function tick(currentTime) {
        if (token !== loopToken) return;

        updateRefreshMeasurement(currentTime);
        updateFpsMeter(currentTime);

        const ts0 = performance.now();
        stepOnce(currentTime);
        perfStats.sim += performance.now() - ts0;
        perfStats.simFrames++;

        // Render capped adaptively (refresh/3, 60..120). Meter counts drawn frames.
        if (currentTime - lastRenderTime >= getRenderCapMs() - 0.5) {
            if (isMatchActive) fpsFrames++;

            const ts1 = performance.now();
            draw();
            perfStats.draw += performance.now() - ts1;
            perfStats.drawFrames++;

            lastRenderTime = currentTime;
        }

        animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);
}

// Measures elapsed real time, then simulates the world in fixed-size steps.
function stepOnce(currentTime) {
    let frameDt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;
    // Clamp so alt-tabbing / stalls / lag spikes cannot teleport the player.
    if (frameDt > 0.1) frameDt = 0.1;

    accumulator += frameDt;

    // At the FIXED_DT rate, so a low-end device that drops to 30fps still
    // advances the world in the exact same size steps as a 120Hz display.
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 8) {
        stepSimulation(FIXED_DT);
        accumulator -= FIXED_DT;
        steps++;
    }
    if (steps >= 8) accumulator = 0; // safety net against the "spiral of death"
}

// One fixed-size simulation step for the local player + camera.
function stepSimulation(dt) {
    if (!isMatchActive || !localPlayer || !socket) return;

    const now = Date.now();

    // FIX B: death must NOT freeze the world. Only the sections that need a
    // living body (aim, movement, camera, pickups, reload, firing) are gated —
    // bullets and hit detection below always advance.
    const alive = localPlayer.hp > 0;

    // =============================================
    // 1. AIM, MOVEMENT, CAMERA, PICKUPS, RELOAD, FIRE (alive only)
    // =============================================
    if (alive) {
        // --- MOUSE & AIM ---
        // Convert screen mouse into world mouse (inlined — no object allocation).
        mouseX = (screenMouseX - canvas.width / 2) / camera.zoom + camera.x;
        mouseY = (screenMouseY - canvas.height / 2) / camera.zoom + camera.y;

        // Aim angle for local player (Needed for directional strafing math).
        localPlayer.aimAngle = M800Logic.getAimAngle(
            localPlayer.x,
            localPlayer.y,
            mouseX,
            mouseY
        );

        // --- MOVEMENT ---
        // Snapshot previous state for smooth render interpolation.
        localPlayer.prevX = localPlayer.x;
        localPlayer.prevY = localPlayer.y;

        if (canMove) {
            // Get final velocity from the Movement State Machine.
            const moveVector = movementManager.update(dt, keys, localPlayer.aimAngle);

            localPlayer.x += moveVector.vx * dt;
            localPlayer.y += moveVector.vy * dt;

            // --- PLAYER PHYSICS COLLISION ---
            // Push the local player out of any remote player they are overlapping.
            // Only the LOCAL player is moved, so the two clients never fight over
            // who shifts and there is no rubber-banding. Runs before the position
            // is emitted below, so the server records the corrected position.
            const resolvedPos = UserCollisionLogic.resolveLocalPlayerCollisions(localPlayer, remotePlayers);
            localPlayer.x = resolvedPos.x;
            localPlayer.y = resolvedPos.y;
            // ---------------------------------
        }

        // --- CAMERA ---
        // Smooth camera follow.
        camera.prevX = camera.x;
        camera.prevY = camera.y;
        CameraLogic.follow(
            camera,
            localPlayer.x,
            localPlayer.y,
            dt,
            CameraData.FollowSmooth
        );

        // --- CHECK FOR WEAPON PICKUPS ---
        for (let i = droppedWeapons.length - 1; i >= 0; i--) {
            const drop = droppedWeapons[i];

            // Cleanup old drops locally
            if (now - drop.spawnTime > WeaponDropData.Lifetime) {
                droppedWeapons.splice(i, 1);
                continue;
            }

            // Check if local player is walking over it
            const dist = Math.hypot(localPlayer.x - drop.x, localPlayer.y - drop.y);
            if (dist < WeaponDropData.PickupRadius) {
                socket.emit('pickupWeapon', { dropId: drop.id });
                droppedWeapons.splice(i, 1); // Remove locally (server will confirm)
            }
        }

        // --- RELOAD INPUT + TIMER ---
        // startReload() self-guards: it no-ops if already reloading, mag full,
        // reserve empty, or no weapon has been initialized yet.
        //
        // FIX #4: the local reload is only a prediction for the HUD — the server
        // owns the real mag/reserve ledger. Emit `reloadWeapon` once per keypress
        // (rising edge) so a held R doesn't flood the socket at 60fps.
        if (keys.r) {
            if (!reloadRequested) {
                reloadRequested = true;
                const wasReloading = ammunitionManager.isReloading;
                ammunitionManager.startReload(now);
                if (!wasReloading && ammunitionManager.isReloading && socket && isMatchActive) {
                    socket.emit('reloadWeapon');
                }
            }
        } else {
            reloadRequested = false;
        }
        // Tick the reload timer so the mag refills when ReloadTime elapses.
        ammunitionManager.update(now);
        // ----------------------------

        // Continuous fire while holding the mouse button.
        if (isMouseDown) {
            if (now - lastShotTime >= getFireRate() * 1000) {
                shoot();
            }
        }

        // Send movement + aim to server (rate-limited by real elapsed time).
        if (now - lastSentTime > SEND_RATE_MS) {
            socket.emit('playerInput', {
                x: localPlayer.x,
                y: localPlayer.y,
                aimAngle: localPlayer.aimAngle,
                timestamp: now
            });

            lastSentTime = now;
        }
    }

    // =============================================
    // 2. BULLETS — ALWAYS UPDATE (even while dead)
    // =============================================
    const bulletDuration = ShootingData.Duration * 1000;

    for (let i = localBullets.length - 1; i >= 0; i--) {
        const b = localBullets[i];
        if (now - b.spawnTime > bulletDuration) { localBullets.splice(i, 1); continue; }

        // Despawn at the weapon's effective range so it can't fly past it.
        const maxRange = WeaponRegistry.getWeaponData(b.ownerWeaponId).Range;
        const bulletSpeed = b.speed || getBulletSpeed(b.ownerWeaponId);

        b.prevX = b.x; // NEW: Store previous position before moving
        b.prevY = b.y;
        b.x += Math.cos(b.angle) * bulletSpeed * dt;
        b.y += Math.sin(b.angle) * bulletSpeed * dt;
        b.dist += bulletSpeed * dt;

        if (b.dist >= maxRange) { localBullets.splice(i, 1); }
    }

    for (let i = remoteBullets.length - 1; i >= 0; i--) {
        const b = remoteBullets[i];
        if (now - b.spawnTime > bulletDuration) { remoteBullets.splice(i, 1); continue; }

        const maxRange = WeaponRegistry.getWeaponData(b.ownerWeaponId).Range;
        const bulletSpeed = b.speed || getBulletSpeed(b.ownerWeaponId);

        b.prevX = b.x;
        b.prevY = b.y;
        b.x += Math.cos(b.angle) * bulletSpeed * dt;
        b.y += Math.sin(b.angle) * bulletSpeed * dt;
        b.dist += bulletSpeed * dt;

        if (b.dist >= maxRange) { remoteBullets.splice(i, 1); }
    }

    // --- IMPROVED HIT DETECTION (Swept Collision + Local Prediction) ---

    // 1. Local bullets hitting remote players
    for (let i = localBullets.length - 1; i >= 0; i--) {
        const b = localBullets[i];
        for (const id in remotePlayers) {
            const p = remotePlayers[id];
            if (p.hp <= 0) continue;
            if (HealthBarLogic.isEnemy(localPlayer.team, p.team)) {
                if (HealthBarLogic.checkBulletSweep(b.prevX, b.prevY, b.x, b.y, p.x, p.y, HealthBarData.HitRadius)) {

                    // --- CLIENT-SIDE PREDICTION ---
                    const weaponDmg = WeaponRegistry.getDamage(b.ownerWeaponId);
                    p.hp = Math.max(0, p.hp - weaponDmg);

                    socket.emit('playerHit', { targetId: p.id, bulletId: b.id });
                    localBullets.splice(i, 1);
                    break;
                }
            }
        }
    }

    // 2. Remote bullets hitting local player (visual flash only, alive only).
    //    The victim client does NOT predict incoming damage. The shooter's client
    //    reports the hit, the server applies it once, and playerHpUpdate arrives
    //    here as the authoritative value. Locally predicting it too would
    //    double-count whenever playerHpUpdate lands before the next sim step.
    if (alive) {
        for (let i = remoteBullets.length - 1; i >= 0; i--) {
            const b = remoteBullets[i];
            if (HealthBarLogic.isEnemy(localPlayer.team, b.ownerTeam)) {
                if (HealthBarLogic.checkBulletSweep(
                        b.prevX, b.prevY, b.x, b.y,
                        localPlayer.x, localPlayer.y,
                        HealthBarData.HitRadius)) {

                    // Instant visual feedback only — no HP math, no socket emit.
                    triggerDamageFlash();
                    remoteBullets.splice(i, 1); // consume locally so we don't re-test
                }
            }
        }
    }
}

// --- RENDERING ---
const GRID_SIZE = 60;
const CULL_MARGIN = 100;
const RENDER_DELAY_MS = 50;

// Camera → screen transform set directly on the context (no save/restore, no alloc).
function applyCameraTransform(camX, camY, camZoom) {
    ctx.setTransform(
        camZoom, 0, 0, camZoom,
        canvas.width / 2 - camX * camZoom,
        canvas.height / 2 - camY * camZoom
    );
}

// Simple world-space floor so movement past the camera is always visible.
function drawFloorGrid(left, top, right, bottom) {
    const startX = Math.floor(left / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(top / GRID_SIZE) * GRID_SIZE;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.51)';
    ctx.lineWidth = 2;

    ctx.beginPath();
    for (let x = startX; x <= right; x += GRID_SIZE) {
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= bottom; y += GRID_SIZE) {
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
    }
    ctx.stroke();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isMatchActive || !localPlayer) return;

    const now = Date.now();

    // Smooth interpolated camera between the last two simulation states.
    const renderAlpha = Math.max(0, Math.min(1, accumulator / FIXED_DT));
    const camX = camera.prevX + (camera.x - camera.prevX) * renderAlpha;
    const camY = camera.prevY + (camera.y - camera.prevY) * renderAlpha;
    const camZoom = camera.zoom;

    // Visible world bounds (inlined screen->world math for the 4 viewport corners).
    const halfW = canvas.width / 2;
    const halfH = canvas.height / 2;
    const invZoom = 1 / camZoom;
    const viewLeft = camX - halfW * invZoom - CULL_MARGIN;
    const viewRight = camX + halfW * invZoom + CULL_MARGIN;
    const viewTop = camY - halfH * invZoom - CULL_MARGIN;
    const viewBottom = camY + halfH * invZoom + CULL_MARGIN;

    applyCameraTransform(camX, camY, camZoom);

    const g0 = performance.now();
    // Floor grid (world space) — moves with the camera, so WASD is clearly visible.
    drawFloorGrid(viewLeft, viewTop, viewRight, viewBottom);
    perfStats.grid += performance.now() - g0;
    perfStats.gridFrames++;

    // Draw Bullets below every player so weapon sprites always sit on top.
    drawBullets(localBullets, viewLeft, viewTop, viewRight, viewBottom);
    drawBullets(remoteBullets, viewLeft, viewTop, viewRight, viewBottom);

    const e0 = performance.now();
    // Draw remote players with interpolation + viewport culling.
    for (const id in remotePlayers) {
        const p = remotePlayers[id];

        // FIX A: Dead players are invisible. Skip them entirely so the body,
        // weapon, hands and username don't linger on a corpse that already died.
        if (p.hp <= 0) continue;

        let alpha = 0;
        const timeDiff = p.timestamp - p.prevTimestamp;

        if (timeDiff > 0) {
            alpha = (now - RENDER_DELAY_MS - p.prevTimestamp) / timeDiff;
        }

        alpha = Math.max(0, Math.min(1, alpha));

        const renderX = p.prevX + (p.x - p.prevX) * alpha;
        const renderY = p.prevY + (p.y - p.prevY) * alpha;

        // Skip players that are off-screen (cheap bounding-box check first).
        if (renderX < viewLeft || renderX > viewRight || renderY < viewTop || renderY > viewBottom) {
            continue;
        }

        drawPlayerEntity(p, renderX, renderY);
    }

    // Draw local player, interpolated between its last two simulation positions
    // so movement stays smooth even when the device renders below 60fps.
    // FIX A: hidden while dead (the death overlay covers the view, but the body
    // must not render underneath a possibly transparent overlay).
    if (localPlayer.hp > 0) {
        const localRenderX = localPlayer.prevX + (localPlayer.x - localPlayer.prevX) * renderAlpha;
        const localRenderY = localPlayer.prevY + (localPlayer.y - localPlayer.prevY) * renderAlpha;
        drawPlayerEntity(localPlayer, localRenderX, localRenderY);
    }

    // --- DRAW DROPPED WEAPONS ---
    for (const drop of droppedWeapons) {
        // Viewport culling
        if (drop.x < viewLeft || drop.x > viewRight || drop.y < viewTop || drop.y > viewBottom) continue;

        // Calculate a pulsing effect based on time
        const pulse = Math.sin(now / 200) * 0.2 + 1.0;
        const glowRadius = WeaponDropData.Radius * pulse;

        // 1. Outer Glow
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, glowRadius + 8, 0, Math.PI * 2);
        ctx.fillStyle = WeaponDropData.GlowColor;
        ctx.fill();

        // 2. Inner Core
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, WeaponDropData.Radius, 0, Math.PI * 2);
        ctx.fillStyle = WeaponDropData.Color;
        ctx.fill();

        // 3. Weapon ID Text
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${12 / camera.zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(drop.weaponId, drop.x, drop.y);
    }

    perfStats.entities += performance.now() - e0;
    perfStats.entitiesFrames++;

    // Back to identity so the next frame's clearRect() always covers the full canvas.
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    drawAmmoHud();
}

// Screen-space ammo readout (bottom-right, clear of the bottom-center slotbox).
function drawAmmoHud() {
    // Nothing is initialized before the match gives us a weapon.
    if (!ammunitionManager.activeWeaponId) return;

    const ammo = ammunitionManager.getState();
    const ammoX = canvas.width - 30;
    const ammoY = canvas.height - 80;

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';

    // Magazine count (large). Turns red on empty, amber on a partial mag.
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.fillStyle = ammo.mag === 0 ? '#ff4444' : (ammo.mag <= ammo.maxMag * 0.25 ? '#ffb020' : '#ffffff');
    ctx.fillText(ammo.mag, ammoX, ammoY);

    // Reserve count (smaller, under the mag)
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = ammo.reserve === 0 ? '#ff4444' : '#9fb6aa';
    ctx.fillText(`/ ${ammo.reserve}`, ammoX, ammoY + 22);

    if (ammo.isReloading) {
        const barW = 120;
        const barH = 4;
        const barX = ammoX - barW;
        const barY = ammoY + 30;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(barX, barY, barW * ammo.reloadProgress, barH);

        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillStyle = '#00ff88';
        ctx.textBaseline = 'top';
        ctx.fillText('RELOADING', ammoX, barY + 6);
    } else if (ammo.mag === 0 && ammo.reserve > 0) {
        // Dry-fire hint so the player knows R is the fix.
        ctx.font = 'bold 11px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffb020';
        ctx.textBaseline = 'top';
        ctx.fillText('PRESS R TO RELOAD', ammoX, ammoY + 30);
    }
}

function drawPlayerEntity(player, x, y) {
    const teamColor = player.team === localPlayer.team ? '#2266ff' : '#ff2222';

    const aimAngle = player.aimAngle || 0;
    const cosA = Math.cos(aimAngle);
    const sinA = Math.sin(aimAngle);

    const userRotateOffset = UserData.RotateImage || 0;

    // --- CHECK ACTIVE SLOT ---
    // Unified slot rendering: both local and remote players now have a
    // server-synced currentSlot.
    const activeSlot = player.currentSlot || 1;

    if (activeSlot === 1) {
        // ==========================================
        // STATE 1: ARMED (Holding Gun)
        // ==========================================
        // Everything below is resolved per-weapon from WeaponRegistry, so any
        // weapon added to Data/ renders correctly with zero changes here.
        const currentWeaponId = player.currentWeapon || DEFAULT_WEAPON_ID;

        // Static attachment offsets (returned by reference — reused, not reallocated).
        const gunOffset = M800Logic.getGunOffset(currentWeaponId);
        const handOffsets = M800Logic.getHandOffsets(currentWeaponId);

        const rotateOffsets = M800Logic.getRotateOffsets(currentWeaponId);
        const weaponRotateOffset = rotateOffsets.weapon;
        const handRotateOffset = rotateOffsets.hand;

        // This weapon's own art (pre-scaled at boot), plus the hands gripping it.
        const gunArt = getWeaponSprites(currentWeaponId);
        const handArt = getHandSprites(currentWeaponId);

        // --- COCKING OFFSETS (now includes gun twitch) ---
        const cock = CockingAGun.getHandOffsets(player.id);
        const recoil = RecoilLogic.getOffset(player.id);

        // Gun origin WITH twitch AND recoil applied
        const gunLocalX = gunOffset.x + cock.gun.x + recoil.x;
        const gunLocalY = gunOffset.y + cock.gun.y + recoil.y;
        const gunX = x + (gunLocalX * cosA - gunLocalY * sinA);
        const gunY = y + (gunLocalX * sinA + gunLocalY * cosA);
        const gunAngle = aimAngle + weaponRotateOffset + cock.gun.rot + recoil.rot; // gun rotation twitch + recoil tilt

        // Front / back hands: base + cocking offset, relative to the TWITCHED gun origin.
        const front = handOffsets.front;
        const back  = handOffsets.back;

        const frontLocalX = front.x + cock.front.x;
        const frontLocalY = front.y + cock.front.y;
        const backLocalX  = back.x  + cock.back.x;
        const backLocalY  = back.y  + cock.back.y;

        const frontX = gunX + (frontLocalX * cosA - frontLocalY * sinA);
        const frontY = gunY + (frontLocalX * sinA + frontLocalY * cosA);
        const backX  = gunX + (backLocalX  * cosA - backLocalY  * sinA);
        const backY  = gunY + (backLocalX  * sinA + backLocalY  * cosA);

        // 1. Back hand — bottom layer
        drawRotatedImageFast(handArt.scaled, handArt.raw, backX, backY, aimAngle + handRotateOffset, 7, '#e0e0e0');

        // 2. Front hand — still below the weapon
        drawRotatedImageFast(handArt.scaled, handArt.raw, frontX, frontY, aimAngle + handRotateOffset, 7, '#e0e0e0');

        // 3. Weapon — above hands, below body (uses twitch-aware gun angle)
        drawRotatedImageFast(gunArt.scaled, gunArt.raw, gunX, gunY, gunAngle, 28, '#888888');

    } else {
        // ==========================================
        // STATE 2/3: UNARMED (Default Hands)
        // ==========================================
        const unarmedHands = HandLogic.getUnarmedHandPositions(x, y, aimAngle);
        const handRotateOffset = HandData.RotateImage || 0;

        // 1. Left Hand (normal orientation)
        drawRotatedImageFast(
            scaledLeftHandSprite, leftHandSprite,
            unarmedHands.left.x, unarmedHands.left.y,
            aimAngle + handRotateOffset, 7, '#e0e0e0',
            false
        );

        // 2. Right Hand (flipped horizontally so it's not a "second left hand")
        drawRotatedImageFast(
            scaledRightHandSprite, rightHandSprite,
            unarmedHands.right.x, unarmedHands.right.y,
            aimAngle + handRotateOffset, 7, '#e0e0e0',
            true
        );
    }

    // 4. Body — always drawn above the hands/weapon
    drawRotatedImageFast(scaledUserSprite, userSprite, x, y, aimAngle + userRotateOffset, 20, '#cccccc');

    // 5. Username — always on top
    const bodyHeight = userSprite.naturalHeight || 64;
    const userScale = UserData.Scale || 1;

    // Keep username size consistent on screen despite camera zoom.
    const fontSize = 14 / camera.zoom;
    const labelGap = 24 / camera.zoom;
    const usernameY = y - (bodyHeight * userScale / 2) - labelGap;

    ctx.fillStyle = teamColor;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(player.username, x, usernameY);

    // 6. HP BAR — just below the user
    if (player.hp !== undefined && player.maxHp !== undefined && player.hp > 0) {
        const barWidth = HealthBarData.BarWidth;
        const barHeight = HealthBarData.BarHeight;
        const barX = x - barWidth / 2;
        const barY = y + HealthBarData.OffsetY;

        // Background
        ctx.fillStyle = HealthBarData.BackgroundColor;
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // Green Fill
        const hpPercent = player.hp / player.maxHp;
        ctx.fillStyle = HealthBarData.FillColor;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        // Border (scales inversely with zoom to stay thin)
        ctx.strokeStyle = HealthBarData.BorderColor;
        ctx.lineWidth = 1 / camera.zoom;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }
}

// Bullet rendering with viewport culling for performance.
function drawBullets(bullets, vLeft, vTop, vRight, vBottom) {
    for (const b of bullets) {
        if (b.x < vLeft || b.x > vRight || b.y < vTop || b.y > vBottom) continue;

        ctx.translate(b.x, b.y);

        const bulletAngle = b.angle + ShootingData.RotateImage;
        ctx.rotate(bulletAngle);

        if (scaledBulletSprite && scaledBulletSprite.width > 0) {
            ctx.drawImage(scaledBulletSprite, -scaledBulletSprite.width / 2, -scaledBulletSprite.height / 2);
        } else if (bulletSprite.complete && bulletSprite.naturalWidth > 0) {
            ctx.drawImage(bulletSprite, -bulletSprite.naturalWidth / 2, -bulletSprite.naturalHeight / 2);
        } else {
            // Fallback if image fails to load
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ffcc00';
            ctx.fill();
        }

        ctx.rotate(-bulletAngle);
        ctx.translate(-b.x, -b.y);
    }
}

// Blits a pre-scaled sprite with rotation. Uses translate()/rotate() and manually
// reverses them instead of ctx.save()/ctx.restore() (no canvas state-stack churn).
// Added flipX support for hands.
function drawRotatedImageFast(scaledCanvas, fallbackImage, x, y, angle, fallbackRadius, fallbackColor, flipX = false) {
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Apply horizontal flip if requested (for the right hand)
    if (flipX) ctx.scale(-1, 1);

    if (scaledCanvas && scaledCanvas.width > 0) {
        ctx.drawImage(scaledCanvas, -scaledCanvas.width / 2, -scaledCanvas.height / 2);
    } else if (fallbackImage.complete && fallbackImage.naturalWidth > 0) {
        // Extremely early frames before onload — draw raw source so the body isn't missing.
        ctx.drawImage(fallbackImage, -fallbackImage.naturalWidth / 2, -fallbackImage.naturalHeight / 2);
    } else {
        ctx.beginPath();
        ctx.arc(0, 0, fallbackRadius, 0, Math.PI * 2);
        ctx.fillStyle = fallbackColor;
        ctx.fill();
    }

    // Reset flip before reversing rotation/translation
    if (flipX) ctx.scale(-1, 1);
    ctx.rotate(-angle);
    ctx.translate(-x, -y);
}

// --- WINDOW RESIZE ---
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// --- BOOTSTRAP ---
const homeManager = new HomeBaseManager(initializeGame);

// Initialize Select Weapon Manager first
const selectWeaponManager = new SelectWeaponManager();

// Pass it into Loadout Manager so they can communicate
const loadoutManager = new LoadoutManager(selectWeaponManager);

// In-Game Loadout: equip-only screen. No weapon editing, no Select Weapon,
// no skin/class changing — the home screen owns all of that.
const inGameLoadoutManager = new InGameLoadoutManager(loadoutManager);

// Wire up the in-game Loadout button (shown during the countdown).
if (ingameLoadoutOpenBtn) {
    ingameLoadoutOpenBtn.addEventListener('click', () => {
        if (isMatchActive && inGameLoadoutManager) {
            inGameLoadoutManager.open();
        }
    });
}

inGameLoadoutManager.setEquipCallback((loadoutSlot, weapons) => {
    if (!socket || !isMatchActive || !localPlayer) return;
    if (!weapons || !weapons.primary) return;

    // Local prediction; the server's loadoutEquipped reply is authoritative.
    localPlayer.currentWeapon = weapons.primary;
    localPlayer.currentSlot = 1;

    socket.emit('equipLoadout', {
        loadoutSlot: loadoutSlot,
        primary: weapons.primary,
        secondary: weapons.secondary || null
    });
});

// --- DEATH SCREEN LOADOUT BUTTON ---
const deathLoadoutBtn = document.getElementById('death-loadout-btn');
if (deathLoadoutBtn) {
    deathLoadoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (inGameLoadoutManager) {
            inGameLoadoutManager.open();
        }
    });
}

const devCssBadge = new DevCssBadge();