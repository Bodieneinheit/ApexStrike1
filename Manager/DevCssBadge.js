// Manager/DevCssBadge.js = temporary dev overlay naming the stylesheet behind the current screen
export default class DevCssBadge {
    // Checked top-down, so the topmost overlay always wins over the screen beneath it.
    static Screens = [
        { id: 'select-weapon-screen', name: 'Select Weapon', sheets: ['Loadout/SelectWeapon.css'] },
        { id: 'ingame-loadout-screen', name: 'In-Game Loadout', sheets: ['InGameLoadout/InGameLoadout.css'] },
        { id: 'loadout-screen', name: 'Loadout', sheets: ['Loadout/LoadOut.css', 'Loadout/LoadOutSlot.css'] },
        { id: 'market-screen', name: 'Market', sheets: ['Market/Market.css'] },
        { id: 'death-screen', name: 'Death Overlay', sheets: ['Respawn/Respawn.css', 'HealthBar/HealthBar.css'] },
        { id: 'game-screen', name: 'Game', sheets: ['SlotBox/SlotBox.css', 'InGameLoadout/InGameLoadout.css', 'HealthBar/HealthBar.css', 'Respawn/Respawn.css'] },
        { id: 'home-screen', name: 'Home', sheets: ['HomePage/HomePage.css'] }
    ];

    static Style = `
        #dev-css-badge {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 9999;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            gap: 1px;
            padding: 8px 12px;
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.72);
            border: 1px solid rgba(0, 255, 136, 0.35);
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
            font-family: Consolas, 'Courier New', monospace;
            font-size: 11px;
            line-height: 1.45;
            text-align: right;
        }
        #dev-css-badge .dev-css-badge-name {
            color: #00ff88;
            font-weight: 700;
            letter-spacing: 1px;
            text-transform: uppercase;
        }
        #dev-css-badge .dev-css-badge-id { color: #6ee7ff; }
        #dev-css-badge .dev-css-badge-sheets { color: #9fb6aa; }
    `;

    constructor() {
        DevCssBadge._injectStyle();

        this.nameEl = document.createElement('span');
        this.nameEl.className = 'dev-css-badge-name';
        this.idEl = document.createElement('span');
        this.idEl.className = 'dev-css-badge-id';
        this.sheetsEl = document.createElement('span');
        this.sheetsEl.className = 'dev-css-badge-sheets';

        this.badge = document.createElement('div');
        this.badge.id = 'dev-css-badge';
        this.badge.appendChild(this.nameEl);
        this.badge.appendChild(this.idEl);
        this.badge.appendChild(this.sheetsEl);
        document.body.appendChild(this.badge);

        // Overlays toggle via classList, home/game toggle via inline style.display,
        // so watch both attributes on every screen.
        this.observer = new MutationObserver(() => this._update());
        for (const screen of DevCssBadge.Screens) {
            const el = document.getElementById(screen.id);
            if (el) this.observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
        }

        this._update();
    }

    /** Remove the badge and stop observing. */
    destroy() {
        this.observer.disconnect();
        this.badge.remove();
    }

    _update() {
        const screen = DevCssBadge.Screens.find(
            (candidate) => this._isVisible(document.getElementById(candidate.id))
        );

        if (!screen) {
            this.badge.style.display = 'none';
            return;
        }

        this.badge.style.display = '';
        this.nameEl.textContent = screen.name;
        this.idEl.textContent = `#${screen.id}`;
        this.sheetsEl.textContent = screen.sheets.join('  +  ');
    }

    _isVisible(el) {
        if (!el) return false;
        if (el.classList.contains('hidden')) return false;
        if (el.classList.contains('active')) return true;

        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    static _injectStyle() {
        if (document.getElementById('dev-css-badge-style')) return;

        const style = document.createElement('style');
        style.id = 'dev-css-badge-style';
        style.textContent = this.Style;
        document.head.appendChild(style);
    }
}
