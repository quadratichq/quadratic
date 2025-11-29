async function toggleWatch(service) {
    try {
        const currentState = services[service]?.watching ?? false;
        const newState = !currentState;
        await fetch('/api/set-watch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, watching: newState })
        });
        updateStatus();
    } catch (error) {
        console.error('Failed to toggle watch:', error);
    }
}

async function togglePerf() {
    try {
        const currentState = services['core']?.perf ?? false;
        const newState = !currentState;
        await fetch('/api/set-perf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ perf: newState })
        });
        updateStatus();
    } catch (error) {
        console.error('Failed to toggle perf:', error);
    }
}

async function toggleFilter(service) {
    try {
        const newState = !services[service]?.hidden ?? false;
        await fetch('/api/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service, hidden: newState })
        });
        updateStatus();
    } catch (error) {
        console.error('Failed to toggle filter:', error);
    }
}

async function killService(service) {
    try {
        await fetch('/api/kill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service })
        });
        updateStatus();
    } catch (error) {
        console.error('Failed to kill service:', error);
    }
}

async function restartService(service) {
    try {
        // Check if shared is watching - if so, do nothing
        if (service === 'shared' && services[service]?.watching) {
            return;
        }

        // Restart the service
        await fetch('/api/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service })
        });
        updateStatus();
    } catch (error) {
        console.error('Failed to restart service:', error);
    }
}

async function restartAllServices() {
    try {
        // Clear logs on the frontend
        clearLogs();

        await fetch('/api/restart-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        updateStatus();
    } catch (error) {
        console.error('Failed to restart all services:', error);
    }
}

async function stopAllServices() {
    try {
        await fetch('/api/stop-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        updateStatus();
    } catch (error) {
        console.error('Failed to stop all services:', error);
    }
}

async function saveState() {
    try {
        const watching = {};
        const hidden = {};

        Object.keys(services).forEach(name => {
            const service = services[name];
            watching[name] = service.watching;
            hidden[name] = service.hidden;
        });

        await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ watching, hidden })
        });
    } catch (error) {
        console.error('Failed to save state:', error);
    }
}

let targetInfoExpanded = false;

function toggleTargetInfo() {
    // Don't allow toggling when loading
    const totalEl = document.getElementById('targetInfoTotal');
    if (totalEl && totalEl.querySelector('.loading-dots')) {
        return;
    }

    const pane = document.getElementById('targetInfoPane');
    const content = document.getElementById('targetInfoContent');
    const toggle = pane.querySelector('.target-info-toggle');

    targetInfoExpanded = !targetInfoExpanded;

    if (targetInfoExpanded) {
        content.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▼';
    }
}

function updateTargetInfoPane(data) {
    if (!data.success || !data.sizes) {
        return false;
    }

    let totalSize = 0;
    data.sizes.forEach(item => {
        totalSize += item.size;
    });

    // Update the pane
    const totalEl = document.getElementById('targetInfoTotal');
    const listEl = document.getElementById('targetInfoList');

    // Update total
    totalEl.textContent = `Total: ${formatSize(totalSize)}`;

    // Update list
    listEl.innerHTML = '';
    data.sizes.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'target-info-item';
        itemEl.innerHTML = `
            <span class="target-info-path">${item.path}</span>
            <span class="target-info-size">${item.size_formatted}</span>
        `;
        listEl.appendChild(itemEl);
    });

    // Re-enable the toggle button after loading completes
    const header = document.querySelector('.target-info-header');
    if (header) {
        header.style.pointerEvents = '';
        header.style.opacity = '';
    }

    // Ensure it starts minimized
    if (targetInfoExpanded) {
        toggleTargetInfo();
    }

    return true;
}

function showTargetLoading() {
    const totalEl = document.getElementById('targetInfoTotal');
    totalEl.innerHTML = '<span class="target-info-loading"><span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></span>';

    // Disable the toggle button while loading
    const header = document.querySelector('.target-info-header');
    if (header) {
        header.style.pointerEvents = 'none';
        header.style.opacity = '0.6';
    }
}

async function checkTargetSizes() {
    const btn = document.getElementById('checkTargetBtn');
    if (btn && btn.disabled) {
        return; // Already checking
    }

    try {
        if (btn) btn.disabled = true;
        showTargetLoading();

        const response = await fetch('/api/check-target');
        const data = await response.json();

        if (!updateTargetInfoPane(data)) {
            const totalEl = document.getElementById('targetInfoTotal');
            totalEl.textContent = 'Error';
            // Re-enable toggle on error
            const header = document.querySelector('.target-info-header');
            if (header) {
                header.style.pointerEvents = '';
                header.style.opacity = '';
            }
        }

        if (btn) btn.disabled = false;
    } catch (error) {
        console.error('Failed to check target sizes:', error);
        const totalEl = document.getElementById('targetInfoTotal');
        totalEl.textContent = 'Error';
        // Re-enable toggle on error
        const header = document.querySelector('.target-info-header');
        if (header) {
            header.style.pointerEvents = '';
            header.style.opacity = '';
        }
        const btn = document.getElementById('checkTargetBtn');
        if (btn) btn.disabled = false;
    }
}

function disableUI() {
    // Disable header buttons
    const headerButtons = document.querySelectorAll('.controls button');
    headerButtons.forEach(btn => {
        const wasAlreadyDisabled = btn.disabled;
        btn.disabled = true;
        btn.setAttribute('data-was-disabled', wasAlreadyDisabled ? 'true' : 'false');
    });

    // Disable service list interactions
    const serviceList = document.getElementById('serviceList');
    if (serviceList) {
        serviceList.style.pointerEvents = 'none';
        serviceList.style.opacity = '0.6';
    }

    // Disable target info pane toggle
    const targetInfoHeader = document.querySelector('.target-info-header');
    if (targetInfoHeader) {
        targetInfoHeader.style.pointerEvents = 'none';
        targetInfoHeader.style.opacity = '0.6';
    }

    // Disable target controls
    const targetControls = document.querySelectorAll('.target-controls button');
    targetControls.forEach(btn => {
        btn.disabled = true;
    });

    // Disable logs container interactions
    const logsContainer = document.querySelector('.logs-container');
    if (logsContainer) {
        logsContainer.style.pointerEvents = 'none';
        logsContainer.style.opacity = '0.6';
    }
}

function enableUI() {
    // Re-enable header buttons (only if they weren't disabled before)
    const headerButtons = document.querySelectorAll('.controls button');
    headerButtons.forEach(btn => {
        const wasDisabled = btn.getAttribute('data-was-disabled') === 'true';
        if (!wasDisabled) {
            btn.disabled = false;
        }
        btn.removeAttribute('data-was-disabled');
    });

    // Restore correct state for stopAllBtn (it has conditional logic)
    if (typeof updateStopAllButton === 'function') {
        updateStopAllButton();
    }

    // Re-enable service list
    const serviceList = document.getElementById('serviceList');
    if (serviceList) {
        serviceList.style.pointerEvents = '';
        serviceList.style.opacity = '';
    }

    // Re-enable target info pane toggle
    const targetInfoHeader = document.querySelector('.target-info-header');
    if (targetInfoHeader) {
        targetInfoHeader.style.pointerEvents = '';
        targetInfoHeader.style.opacity = '';
    }

    // Re-enable target controls
    const checkBtn = document.getElementById('checkTargetBtn');
    const purgeBtn = document.getElementById('purgeTargetBtn');
    if (checkBtn) checkBtn.disabled = false;
    if (purgeBtn) purgeBtn.disabled = false;

    // Re-enable logs container
    const logsContainer = document.querySelector('.logs-container');
    if (logsContainer) {
        logsContainer.style.pointerEvents = '';
        logsContainer.style.opacity = '';
    }
}

async function purgeTargetDirectories() {
    if (!confirm('This will stop all services and delete all /target directories. Are you sure?')) {
        return;
    }

    try {
        // Show progress bar first
        const progressContainer = document.getElementById('targetProgress');
        if (progressContainer) {
            progressContainer.style.display = 'block';
            // Reset progress
            const progressBar = document.getElementById('targetProgressBar');
            const progressText = document.getElementById('targetProgressText');
            if (progressBar) progressBar.style.width = '0%';
            if (progressText) progressText.textContent = 'Starting...';
        }

        // Disable all UI during purge
        disableUI();

        const response = await fetch('/api/purge-target', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.success) {
            // Hide progress bar
            const progressContainer = document.getElementById('targetProgress');
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }

            // Re-enable UI immediately after purge completes (before restart)
            enableUI();

            // Refresh target sizes to show updated info
            await checkTargetSizes();

            // Restart all services after purge (don't wait - let it happen in background)
            restartAllServices();

            // Refresh status after purge
            updateStatus();
        } else {
            alert('Failed to purge target directories: ' + (data.error || 'Unknown error'));
            // Hide progress on error
            const progressContainer = document.getElementById('targetProgress');
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
            // Re-enable UI on error
            enableUI();
        }
    } catch (error) {
        console.error('Failed to purge target directories:', error);
        alert('Failed to purge target directories: ' + error.message);
        // Hide progress on error
        const progressContainer = document.getElementById('targetProgress');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        // Re-enable UI on error
        enableUI();
    }
}

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    if (unitIndex === 0) {
        return `${bytes} ${units[unitIndex]}`;
    } else {
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}
