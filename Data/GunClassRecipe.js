// Data/GunClassRecipe.js = The visual manifest for the Select Weapon UI
import WeaponRegistry from './WeaponRegistry.js';

export default class GunClassRecipe {

    // --- THE MASTER UI LIST ---
    // Controls the ORDER and ICONS for the Select Weapon screen.
    // x, y, and scale allow fine-tuning the icon's position and size within the card
    // so it doesn't get cut off by the image wrap boundaries.
    static RECIPES = [
        {
            id: 'M4800',
            icon: '/Assets/M4800/M4800_GoldenSkinIcon.png',
            x: 0,      
            y: -30,    
            scale: 1.0, 
            surfaces: { loadout: { y: -50 }, ingame: { y: 0 } }
        },
        {
            id: 'P90',
            icon: '/Assets/p90/p90_icon_Skin.png',
            x: 0,
            y: -30,
            scale: 0.78,
            surfaces: { loadout: { y: -50 }, ingame: { y: 0 } }
        }
       
    ];

    /**
     * Menu art for any weapon id, for UI outside the Select Weapon grid
     * (Loadout rail silhouettes, Main/Sub cards, preview stage).
     * Falls back to the gameplay sprite if a recipe has no icon yet.
     */
    static getIcon(weaponId) {
        const recipe = this.RECIPES.find((entry) => entry.id === weaponId);
        if (recipe && recipe.icon) return recipe.icon;

        const weaponData = WeaponRegistry.findWeaponData(weaponId);
        return weaponData ? weaponData.Image : '';
    }

    /**
     * The recipe's fine-tuning transform as a CSS value, so every surface that
     * shows a menu icon (Select Weapon grid, Loadout Main/Sub cards, In-Game
     * Loadout cards) positions it identically instead of re-deriving the numbers
     * per call site.
     *
     * @param {string} weaponId
     * @param {string} surface - 'grid' (Select Weapon), 'loadout' (home Loadout
     *   Main/Sub cards) or 'ingame' (In-Game Loadout cards). The wraps differ in
     *   height, so a recipe can override x/y/scale per surface via
     *   `surfaces: { loadout: { y: 0 } }`. Omitted coordinates fall back to the
     *   recipe's top-level x/y, which are the Select Weapon grid's tuning.
     */
    static getIconStyle(weaponId, surface = 'grid') {
        const recipe = this.RECIPES.find((entry) => entry.id === weaponId);
        if (!recipe) return 'translate(0px, 0px) scale(1)';

        const override = (recipe.surfaces && recipe.surfaces[surface]) || {};
        const x = override.x !== undefined ? override.x : (recipe.x || 0);
        const y = override.y !== undefined ? override.y : (recipe.y || 0);
        const scale = override.scale !== undefined ? override.scale : (recipe.scale || 1);

        return `translate(${x}px, ${y}px) scale(${scale})`;
    }

    /**
     * Automatically renders all recipes into the Select Weapon grid.
     */
    static renderSelectWeaponGrid(gridElementId = 'select-weapon-grid') {
        const grid = document.getElementById(gridElementId);
        if (!grid) return;

        grid.innerHTML = '';

        this.RECIPES.forEach(recipe => {
            // 1. Pull gameplay stats from the Registry.
            // findWeaponData (not getWeaponData) so an unknown id is skipped
            // instead of silently inheriting the default weapon's stats.
            const weaponData = WeaponRegistry.findWeaponData(recipe.id);
            if (!weaponData) return;

            // 2. Extract what we need (Icon from recipe, stats from registry)
            const iconSrc = this.getIcon(recipe.id);
            const type = weaponData.Type || 'Unknown';
            const badgeClass = type.toLowerCase(); // 'sniper' or 'smg'

            // 3. Create the card
            const card = document.createElement('div');
            card.className = 'select-weapon-card';
            card.dataset.weaponId = recipe.id;

            // Build transform string for fine-tuning icon placement
            const transform = this.getIconStyle(recipe.id, 'grid');

            card.innerHTML = `
                <div class="select-weapon-card-top">
                    <div>
                        <h3 class="select-weapon-name">${recipe.id}</h3>
                        <div class="select-weapon-type">${type}</div>
                    </div>
                    <span class="select-weapon-badge ${badgeClass}">${type}</span>
                </div>

                <div class="select-weapon-image-wrap">
                    <!-- Inline transform applied here for precise positioning -->
                    <img class="select-weapon-image" src="${iconSrc}" alt="${recipe.id}" style="transform: ${transform};">
                </div>

                <div class="select-weapon-body">
                    <div class="select-weapon-status">
                        DMG: ${weaponData.Damage} | ROF: ${weaponData.FireRate}s | ACC: ${Math.round((1 - (weaponData.Spread || 0)) * 100)}%
                    </div>
                </div>
            `;

            grid.appendChild(card);
        });
    }
}
