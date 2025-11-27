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
        // Connection established - hide error banner
        hideConnectionError();
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
    };

    ws.onclose = (event) => {
        console.log('WebSocket closed, reconnecting...');
        // Show error banner if not a clean close
        if (event.code !== 1000) {
            showConnectionError();
        }
        setTimeout(connectWebSocket, 1000);
    };
}
