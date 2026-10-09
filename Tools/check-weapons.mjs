// Tools/check-weapons.mjs = dev-time consistency check across the three places a weapon must be declared.
//
// A new weapon is declared in THREE places, and two of the three fail silently:
//   1. Data/SniperData.js | Data/SMGData.js  -> gameplay blueprint (client, ESM)
//   2. Manager/AntiCheatManager.js           -> server mirror (CommonJS)
//   3. Data/GunClassRecipe.js                -> Select Weapon manifest (client, ESM)
//
// Missing #2 is the dangerous one: AntiCheatManager.getWeaponData() falls back to the
// default weapon, so a gun missing from the mirror silently inherits the default's
// damage / fire rate / range with no error anywhere.
//
// Runs in Node because the Data files are ESM and AntiCheatManager is CommonJS, so
// nothing in the browser can import across that boundary.
//
// Usage: npm run check:weapons

import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// The Data/ blueprints are browser ESM but live in a package.json with no
// "type": "module" (the server is CommonJS, so that flag cannot be set). Node
// would therefore load them as CommonJS and fail on the first `import`.
// Mirror Data/ into a temp dir carrying its own {"type":"module"} so the real
// files are parsed as ESM, unmodified.
const stage = mkdtempSync(join(tmpdir(), 'apexstrike-weapons-'));
let GunClassRecipe, WeaponRegistry, AntiCheatManager;
try {
    cpSync(join(ROOT, 'Data'), join(stage, 'Data'), { recursive: true });
    writeFileSync(join(stage, 'package.json'), '{"type":"module"}');

    GunClassRecipe = (await import(pathToFileURL(join(stage, 'Data/GunClassRecipe.js')).href)).default;
    WeaponRegistry = (await import(pathToFileURL(join(stage, 'Data/WeaponRegistry.js')).href)).default;
    AntiCheatManager = require(join(ROOT, 'Manager/AntiCheatManager.js'));
} finally {
    rmSync(stage, { recursive: true, force: true });
}

const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// Pull the Select Weapon filter options straight out of the markup.
const filterBlock = /id="select-weapon-filter"[\s\S]*?<\/select>/.exec(html);
const filterValues = filterBlock
    ? Array.from(filterBlock[0].matchAll(/value="([^"]*)"/g)).map((m) => m[1])
    : [];
const filterCategories = filterValues.filter((v) => v !== 'all').map((v) => v.toLowerCase());

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const recipeIds = GunClassRecipe.RECIPES.map((r) => r.id);
const registryIds = Object.keys(WeaponRegistry.weapons);
const mirrorIds = Object.keys(AntiCheatManager.WEAPONS);
const assetExists = (p) => p && existsSync(join(ROOT, p.replace(/^\//, '')));

console.log('Weapon consistency check');
console.log(`  registry : ${registryIds.length}  [${registryIds.join(', ')}]`);
console.log(`  manifest : ${recipeIds.length}  [${recipeIds.join(', ')}]`);
console.log(`  mirror   : ${mirrorIds.length}  [${mirrorIds.join(', ')}]`);
console.log(`  filters  : ${filterCategories.length}  [${filterCategories.join(', ')}]\n`);

for (const id of recipeIds) {
    // 1. Manifest entry must resolve, or the card is skipped with no error.
    const data = WeaponRegistry.findWeaponData(id);
    if (!data) {
        err(`${id}: in GunClassRecipe.RECIPES but not in WeaponRegistry - its Select Weapon card will never render. Add it to SniperData/SMGData.`);
        continue;
    }

    // 2. Manifest entry must exist in the server mirror, or stats silently
    //    fall back to AntiCheatManager.DEFAULT_WEAPON_ID.
    const mirror = AntiCheatManager.WEAPONS[id];
    if (!mirror) {
        const fallback = AntiCheatManager.WEAPONS[AntiCheatManager.DEFAULT_WEAPON_ID];
        err(
            `${id}: not in AntiCheatManager.WEAPONS - the server will validate it as ` +
            `${AntiCheatManager.DEFAULT_WEAPON_ID} (damage ${fallback.damage}, fireRate ${fallback.fireRate}ms, ` +
            `range ${fallback.range}) instead of its own stats.`
        );
    } else {
        // 3. Units: Data FireRate and mirror fireRate are both SECONDS now.
        if (Math.abs(mirror.fireRate - data.FireRate) > 0.001) {
            err(
                `${id}: fireRate mismatch - Data.FireRate is ${data.FireRate}s ` +
                `but AntiCheatManager.WEAPONS.${id}.fireRate is ${mirror.fireRate}s.`
            );
        }
        if (mirror.damage !== data.Damage) {
            warn(`${id}: damage differs - Data ${data.Damage} vs mirror ${mirror.damage} (server is authoritative).`);
        }
        if (data.Range !== undefined && mirror.range !== data.Range) {
            warn(`${id}: range differs - Data ${data.Range} vs mirror ${mirror.range} (server is authoritative).`);
        }
    }

    // 4. A new Type needs a matching filter option or those cards are unreachable.
    const type = (data.Type || '').toLowerCase();
    if (type && !filterCategories.includes(type)) {
        err(`${id}: Type "${data.Type}" has no <option value="${type}"> in the #select-weapon-filter dropdown - cards will be hidden whenever a filter is active.`);
    }

    // 5. Assets referenced by the manifest and the blueprint must exist.
    const recipe = GunClassRecipe.RECIPES.find((r) => r.id === id);
    if (!assetExists(recipe.icon)) {
        err(`${id}: manifest icon not found on disk -> ${recipe.icon}`);
    }
    if (!assetExists(data.Image)) {
        err(`${id}: gameplay sprite not found on disk -> ${data.Image}`);
    }

    // 8. BulletOffset should exist for consistent muzzle spawning.
    if (
        !data.BulletOffset ||
        typeof data.BulletOffset.x !== 'number' ||
        typeof data.BulletOffset.y !== 'number'
    ) {
        warn(
            `${id}: missing BulletOffset - client will use ShootingData.DefaultBulletOffset.`
        );
    }
}

// 6. Registry weapons with no manifest entry cannot be equipped from the menu.
for (const id of registryIds) {
    if (!recipeIds.includes(id)) {
        warn(`${id}: in WeaponRegistry but not in GunClassRecipe.RECIPES - usable in game, but not selectable in the Loadout menu.`);
    }
}

// 7. Mirror entries the client cannot render are dead server config.
for (const id of mirrorIds) {
    if (!registryIds.includes(id)) {
        warn(`${id}: in AntiCheatManager.WEAPONS but not in WeaponRegistry - server config for a gun that does not exist.`);
    }
}

for (const m of warnings) console.log(`  WARN  ${m}`);
for (const m of errors) console.log(`  ERROR ${m}`);

if (errors.length) {
    console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
}
console.log(`\nAll checks passed${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
