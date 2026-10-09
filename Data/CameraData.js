// Data/CameraData.js = static blueprint for camera settings
export default class CameraData {
    // Lower number = more zoomed out
    // Higher number = more zoomed in
    static DefaultZoom = 0.75;

    static MinZoom = 0.35;
    static MaxZoom = 1.5;

    // Mouse wheel zoom sensitivity, only used if you enable scroll zoom
    static ZoomSensitivity = 0.0012;

    // 1 = camera instantly follows player
    // 0.15 = smooth camera follow
    // Lower = smoother/laggier follow
    static FollowSmooth = 0.2;
}