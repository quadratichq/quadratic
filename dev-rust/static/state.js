// State variables
let ws = null;
let selectedServices = new Set(); // Use Set for multiple selections
let logs = [];
let services = {};
let previousServiceData = null; // Track previous service state to avoid unnecessary re-renders

let htmlETag = null;
let faviconAnimationFrame = null;
let faviconRotation = 0;

// Load logs from server on page load
async function loadLogsFromServer() {
    try {
        const response = await fetch('/api/logs');
        if (response.ok) {
            const serverLogs = await response.json();
            logs = serverLogs;
            renderLogs();
        }
    } catch (error) {
        console.error('Failed to load logs from server:', error);
    }
}

async function checkForReload() {
    try {
        const response = await fetch('/?check=' + Date.now(), { method: 'HEAD' });
        const etag = response.headers.get('etag');
        if (htmlETag && etag && etag !== htmlETag) {
            console.log('HTML file changed, reloading...');
            clearLogs();
            window.location.reload();
        }
        if (!htmlETag) {
            htmlETag = etag;
        }
    } catch (error) {
        // Silently fail - this is just a convenience feature
    }
}

async function loadState() {
    try {
        const response = await fetch('/api/state');
        if (response.ok) {
            const state = await response.json();
            // State will be applied when services are loaded
            return state;
        }
    } catch (error) {
        console.error('Failed to load state:', error);
    }
    return null;
}

async function init() {
    // Load theme first
    await loadTheme();

    // Load state first, then logs
    loadState().then(() => {
        loadLogsFromServer();
    });

    connectWebSocket();
    updateStatus();
    setInterval(updateStatus, 1000);
    // Check for HTML file changes every 2 seconds
    checkForReload();
    setInterval(checkForReload, 2000);
    // Services will be selected automatically when they're loaded in updateServices()
    // Initial page title update
    updatePageTitle();
}
