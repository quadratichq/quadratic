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

    // Store the scroll position before rendering
    const previousScrollTop = container.scrollTop;

    // Show logs from all selected services, or all logs if none selected
    const filtered = selectedServices.size > 0
        ? logs.filter(log => selectedServices.has(log.service))
        : logs;

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">No logs yet...</div>';
        return;
    }

    container.innerHTML = filtered.map(log => {
        const serviceClass = `service-${log.service}`;
        const time = new Date(log.timestamp * 1000).toLocaleTimeString();
        const isStderr = (log.stream || 'stdout') === 'stderr';
        const stderrBadge = isStderr ? '<span class="stderr-badge" title="stderr">stderr</span>' : '';
        return `
            <div class="log-entry ${isStderr ? 'log-entry-stderr' : ''}">
                <span class="log-service ${serviceClass}">[${log.service}]</span>
                ${stderrBadge}
                <span class="log-message">${ansiToHtml(log.message)}</span>
                <span class="log-timestamp">${time}</span>
            </div>
        `;
    }).join('');

    // Only auto-scroll if user was already at the bottom
    if (wasAtBottom) {
        container.scrollTop = container.scrollHeight;
    } else {
        // Maintain the same scroll position (don't scroll when new content is added)
        container.scrollTop = previousScrollTop;
    }
}

function showAllLogs() {
    selectAllServices();
}

function clearLogs() {
    logs = [];
    renderLogs();
}
