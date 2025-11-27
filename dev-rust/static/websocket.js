function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

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
    };

    ws.onclose = () => {
        console.log('WebSocket closed, reconnecting...');
        setTimeout(connectWebSocket, 1000);
    };
}
