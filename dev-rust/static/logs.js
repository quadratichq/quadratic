function addLog(log) {
    logs.push(log);
    // Don't limit logs here - server handles that
    // Just keep reasonable limit in browser (100000)
    if (logs.length > 100000) {
        logs.shift();
    }
    renderLogs();
}

function renderLogs() {
    const container = document.getElementById('logs');

    // Check if user is at the bottom before rendering (within 10px threshold)
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const wasAtBottom = scrollBottom < 10;

    // Show logs from all selected services, or all logs if none selected
    const filtered = selectedServices.size > 0
        ? logs.filter(log => selectedServices.has(log.service))
        : logs;

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No logs yet...</div>';
        return;
    }

    // Store the previous scroll height to calculate the difference
    const previousScrollHeight = container.scrollHeight;
    const previousScrollTop = container.scrollTop;

    container.innerHTML = filtered.map(log => {
        const serviceClass = `service-${log.service}`;
        const time = new Date(log.timestamp * 1000).toLocaleTimeString();
        return `
            <div class="log-entry">
                <span class="log-service ${serviceClass}">[${log.service}]</span>
                <span class="log-message">${ansiToHtml(log.message)}</span>
                <span class="log-timestamp">${time}</span>
            </div>
        `;
    }).join('');

    // Only auto-scroll if user was already at the bottom
    if (wasAtBottom) {
        container.scrollTop = container.scrollHeight;
    } else {
        // Maintain scroll position by adjusting for the height difference
        const heightDiff = container.scrollHeight - previousScrollHeight;
        container.scrollTop = previousScrollTop + heightDiff;
    }
}

function showAllLogs() {
    selectAllServices();
}

function clearLogs() {
    logs = [];
    renderLogs();
}
