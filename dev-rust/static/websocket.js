function showConnectionError() {
    const banner = document.getElementById('errorBanner');
    if (banner) {
        banner.style.display = 'flex';
    }
}

function hideConnectionError() {
    const banner = document.getElementById('errorBanner');
    if (banner) {
        banner.style.display = 'none';
    }
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
        // Connection established - hide error banner and clear connection lost flag
        hideConnectionError();
        connectionLost = false;
        // Re-render services to clear red status
        if (typeof renderServiceList === 'function') {
            renderServiceList();
        }
        // Update favicon when connection is restored
        if (typeof updateFavicon === 'function') {
            updateFavicon();
        }
        console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
        const data = event.data;
        if (data === 'reload') {
            // Live reload triggered - clear logs before reloading
            clearLogs();
            window.location.reload();
            return;
        }
        if (data.startsWith('status:')) {
            const status = JSON.parse(data.substring(7));
            updateServices(status.services);
        } else {
            const log = JSON.parse(data);
            addLog(log);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        showConnectionError();
        connectionLost = true;
        // Re-render services to show red status
        if (typeof renderServiceList === 'function') {
            renderServiceList();
        }
        // Update favicon to show red X when connection is lost
        if (typeof updateFavicon === 'function') {
            updateFavicon();
        }
    };

    ws.onclose = (event) => {
        console.log('WebSocket closed, reconnecting...');
        // Set connection lost flag whenever connection closes (we're disconnected)
        connectionLost = true;
        // Re-render services to show red status
        if (typeof renderServiceList === 'function') {
            renderServiceList();
        }
        // Update favicon to show red X when connection is lost
        if (typeof updateFavicon === 'function') {
            updateFavicon();
        }
        // Show error banner if not a clean close
        if (event.code !== 1000) {
            showConnectionError();
        }
        setTimeout(connectWebSocket, 1000);
    };
}
