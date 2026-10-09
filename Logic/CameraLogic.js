// Logic/CameraLogic.js = math/formulas for camera behavior
export default class CameraLogic {
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Converts screen/mouse coordinates into world coordinates.
     * This is required once camera zoom/position exists.
     */
    static screenToWorld(screenX, screenY, canvasWidth, canvasHeight, camera) {
        return {
            x: (screenX - canvasWidth / 2) / camera.zoom + camera.x,
            y: (screenY - canvasHeight / 2) / camera.zoom + camera.y
        };
    }

    /**
     * Moves camera toward target position.
     */
    static follow(camera, targetX, targetY, dt, smooth = 1) {
        if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

        if (smooth >= 1) {
            camera.x = targetX;
            camera.y = targetY;
            return;
        }

        // Frame-rate independent smoothing.
        const t = 1 - Math.pow(1 - smooth, dt * 60);

        camera.x += (targetX - camera.x) * t;
        camera.y += (targetY - camera.y) * t;
    }

    /**
     * Applies camera transform to canvas context.
     * Call this between ctx.save() and ctx.restore().
     */
    static apply(ctx, canvas, camera) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(camera.zoom, camera.zoom);
        ctx.translate(-camera.x, -camera.y);
    }
}