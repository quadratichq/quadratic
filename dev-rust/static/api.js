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
