(function (global) {
    const KEY = 'dash_ui_zoom';
    const MIN = 0.5;
    const MAX = 1.5;
    const STEP = 0.1;

    function clamp(value) {
        return Math.min(MAX, Math.max(MIN, Math.round(value * 100) / 100));
    }

    function getStoredZoom() {
        try {
            const saved = parseFloat(localStorage.getItem(KEY) || '1');
            return Number.isFinite(saved) ? clamp(saved) : 1;
        } catch {
            return 1;
        }
    }

    function applyUiZoom(value) {
        const zoom = clamp(value);
        if (zoom === 1) {
            document.documentElement.style.zoom = '';
            try { localStorage.removeItem(KEY); } catch { /* ignore */ }
        } else {
            document.documentElement.style.zoom = String(zoom);
            try { localStorage.setItem(KEY, String(zoom)); } catch { /* ignore */ }
        }
        return zoom;
    }

    function restoreUiZoom() {
        const saved = getStoredZoom();
        if (saved !== 1) applyUiZoom(saved);
    }

    function initUiZoomControls() {
        document.addEventListener('keydown', (event) => {
            if (!event.ctrlKey) return;

            const current = getStoredZoom();
            if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                applyUiZoom(current + STEP);
            } else if (event.key === '-' || event.key === '_') {
                event.preventDefault();
                applyUiZoom(current - STEP);
            } else if (event.key === '0') {
                event.preventDefault();
                applyUiZoom(1);
            }
        });
    }

    restoreUiZoom();
    global.initUiZoomControls = initUiZoomControls;
    global.applyUiZoom = applyUiZoom;
    global.getStoredUiZoom = getStoredZoom;
})(window);
