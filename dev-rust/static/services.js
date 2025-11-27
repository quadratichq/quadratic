async function updateStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        updateServices(data.services);
    } catch (error) {
        console.error('Failed to update status:', error);
    }
}

function updateServices(serviceList) {
    // Check if service data has actually changed
    const serviceDataString = JSON.stringify(serviceList);
    const wasEmpty = Object.keys(services).length === 0;
    if (previousServiceData === serviceDataString) {
        return; // No changes, skip re-render
    }
    previousServiceData = serviceDataString;

    const oldServices = { ...services };
    services = {};
    serviceList.forEach(service => {
        services[service.name] = service;
    });

    // If services were empty and now we have services, select all by default
    if (wasEmpty && Object.keys(services).length > 0 && selectedServices.size === 0) {
        Object.keys(services).forEach(name => {
            selectedServices.add(name);
        });
    }

    // Save state if watch/hidden changed
    const stateChanged = Object.keys(services).some(name => {
        const old = oldServices[name];
        const current = services[name];
        return !old || old.watching !== current.watching || old.hidden !== current.hidden;
    });

    if (stateChanged && Object.keys(services).length > 0) {
        saveState();
    }

    renderServiceList();
    updateFavicon();
    updatePageTitle();
    updateStopAllButton();
}

function updateStopAllButton() {
    const stopAllBtn = document.getElementById('stopAllBtn');
    if (!stopAllBtn) return;

    // Disable the button if all services are already stopped or killed
    const allStopped = Object.values(services).every(
        service => service.status.toLowerCase() === 'stopped' || service.status.toLowerCase() === 'killed'
    );

    stopAllBtn.disabled = allStopped || Object.keys(services).length === 0;
}

function renderServiceList() {
    const container = document.getElementById('serviceList');

    // Get or create content container
    let contentContainer = container.querySelector('.service-list-content');
    if (!contentContainer) {
        contentContainer = document.createElement('div');
        contentContainer.className = 'service-list-content';
        container.appendChild(contentContainer);
    }

    // Check if all services are selected (All mode)
    const allServicesSelected = Object.keys(services).length > 0 &&
                               Object.keys(services).every(name => selectedServices.has(name));

    // Render "All" button first - ensure it's always at the top
    let allItem = contentContainer.querySelector('[data-service-name="__all__"]');
    if (!allItem) {
        allItem = document.createElement('div');
        allItem.dataset.serviceName = '__all__';
        allItem.className = 'service-item';
        allItem.onclick = () => {
            selectAllServices();
        };
        // Always insert at the very beginning
        contentContainer.insertBefore(allItem, contentContainer.firstChild);
    } else {
        // Move to beginning if it's not already there
        if (allItem !== contentContainer.firstChild) {
            contentContainer.insertBefore(allItem, contentContainer.firstChild);
        }
    }
    allItem.className = `service-item ${allServicesSelected ? 'selected' : ''}`;
    allItem.innerHTML = `
        <div class="service-name" style="flex: 1;">
            <span style="font-weight: bold;">all services</span>
        </div>
        <div class="service-badges"></div>
    `;

    // Define service sections
    const serviceSections = [
        { title: 'client', services: ['client', 'core', 'python', 'types'] },
        { title: 'api', services: ['api', 'shared'] },
        { title: 'services', services: ['multiplayer', 'files', 'connection'] },
        { title: 'system', services: ['checks'] }
    ];

    // Render service sections
    serviceSections.forEach((section, sectionIndex) => {
        // Find or create section container
        let sectionContainer = contentContainer.querySelector(`[data-section="${section.title}"]`);
        if (!sectionContainer) {
            sectionContainer = document.createElement('div');
            sectionContainer.className = 'service-section';
            sectionContainer.dataset.section = section.title;

            // Create section title
            const title = document.createElement('div');
            title.className = 'service-section-title';
            title.textContent = section.title;
            sectionContainer.appendChild(title);

            // Insert section after All item or after previous sections
            const allItem = contentContainer.querySelector('[data-service-name="__all__"]');
            const existingSections = Array.from(contentContainer.querySelectorAll('.service-section'));
            if (sectionIndex === 0) {
                // First section goes after All item
                if (allItem && allItem.nextSibling) {
                    contentContainer.insertBefore(sectionContainer, allItem.nextSibling);
                } else {
                    contentContainer.appendChild(sectionContainer);
                }
            } else {
                // Other sections go after previous sections
                const prevSection = existingSections[sectionIndex - 1];
                if (prevSection && prevSection.nextSibling) {
                    contentContainer.insertBefore(sectionContainer, prevSection.nextSibling);
                } else {
                    contentContainer.appendChild(sectionContainer);
                }
            }
        }

        // Render services in this section
        section.services.forEach((serviceName) => {
            const service = services[serviceName];
            if (!service) {
                // Remove row if service no longer exists
                const existingRow = sectionContainer.querySelector(`[data-service-name="${serviceName}"]`);
                if (existingRow) {
                    existingRow.remove();
                }
                return;
            }

            const isSelected = !allServicesSelected && selectedServices.has(service.name);
            const statusClass = `status-${service.status.toLowerCase()}`;

            // Check if row already exists
            let row = sectionContainer.querySelector(`[data-service-name="${service.name}"]`);

            if (!row) {
                // Create new row wrapper
                row = document.createElement('div');
                row.dataset.serviceName = service.name;
                row.className = 'service-row';
                sectionContainer.appendChild(row);
            }

            // Get or create service item
            let item = row.querySelector('.service-item');
            if (!item) {
                item = document.createElement('div');
                item.className = 'service-item';
                row.appendChild(item);
                // Allow clicking the item to select only this service
                item.onclick = () => {
                    selectOnlyService(service.name);
                };
            }

            // Get or create buttons container
            let buttons = row.querySelector('.service-item-buttons');
            if (!buttons) {
                buttons = document.createElement('div');
                buttons.className = 'service-item-buttons';
                row.appendChild(buttons);
            }

            // Update classes - don't show selected when All mode is active
            // Add error class for checks service when it fails
            const hasError = service.name === 'checks' && service.status.toLowerCase() === 'error';
            item.className = `service-item ${isSelected ? 'selected' : ''} ${hasError ? 'service-error' : ''}`;

            // Update service item content
            const itemContent = `
                <div class="service-name" style="flex: 1;">
                    <span class="status-indicator ${statusClass}"></span>
                    <span>${service.name}</span>
                </div>
            `;

            if (item.innerHTML !== itemContent.trim()) {
                item.innerHTML = itemContent;
            }

            // Update buttons content - only show perf button for core service
            const perfButton = service.has_perf_command ? `
                <button class="perf ${service.perf ? 'active' : ''}"
                        onclick="event.stopPropagation(); togglePerf()"
                        title="${service.perf ? 'Disable perf mode' : 'Enable perf mode'}">🚀</button>
            ` : '';

            // Only show watch button if service has watch command
            const watchButton = service.has_watch_command ? `
                <button class="watch ${service.watching ? 'active' : ''}"
                        onclick="event.stopPropagation(); toggleWatch('${service.name}')"
                        title="${service.watching ? 'Stop watching' : 'Start watching'}">👀</button>
            ` : '';

            // For types, shared, and checks services, show refresh button instead of kill button
            const isOneTimeService = service.name === 'types' || service.name === 'shared' || service.name === 'checks';
            const actionButton = isOneTimeService ? `
                <button class="kill refresh"
                        onclick="event.stopPropagation(); restartService('${service.name}')"
                        title="Refresh">↻</button>
            ` : `
                <button class="kill ${service.status === 'killed' ? 'active' : ''}"
                        onclick="event.stopPropagation(); killService('${service.name}')"
                        title="${service.status === 'killed' ? 'Restart' : 'Kill'}">${service.status === 'killed' ? '↻' : '✕'}</button>
            `;

            const buttonsContent = `
                ${perfButton}
                ${watchButton}
                <button class="hidden ${service.hidden ? 'active' : ''}"
                        onclick="event.stopPropagation(); toggleFilter('${service.name}')"
                        title="${service.hidden ? 'Show logs' : 'Hide logs'}">🙈</button>
                ${actionButton}
            `;

            if (buttons.innerHTML !== buttonsContent.trim()) {
                buttons.innerHTML = buttonsContent;
            }
        });
    });

    // Remove any rows that are no longer in any section
    const allServiceNames = serviceSections.flatMap(s => s.services);
    const existingRows = Array.from(contentContainer.querySelectorAll('.service-row[data-service-name]'));
    existingRows.forEach(row => {
        const serviceName = row.dataset.serviceName;
        if (!services[serviceName] || !allServiceNames.includes(serviceName)) {
            row.remove();
        }
    });
}

function selectOnlyService(name) {
    // Clear all selections and select only this service
    selectedServices.clear();
    selectedServices.add(name);
    renderServiceList();
    renderLogs();
    updateSelectedServiceUI();
}

function toggleService(name) {
    // Check if all services are currently selected (All mode)
    const allServicesSelected = Object.keys(services).length > 0 &&
                               Object.keys(services).every(n => selectedServices.has(n));

    if (allServicesSelected) {
        // If All mode is active, clear all and select only this service
        selectedServices.clear();
        selectedServices.add(name);
    } else {
        // Normal toggle behavior
        if (selectedServices.has(name)) {
            selectedServices.delete(name);
        } else {
            selectedServices.add(name);
        }
    }
    renderServiceList();
    renderLogs();
    updateSelectedServiceUI();
}

function selectAllServices() {
    const allSelected = Object.keys(services).length > 0 &&
                       Object.keys(services).every(name => selectedServices.has(name));

    if (allSelected) {
        // Deselect all
        selectedServices.clear();
    } else {
        // Select all
        Object.keys(services).forEach(name => {
            selectedServices.add(name);
        });
    }
    renderServiceList();
    renderLogs();
    updateSelectedServiceUI();
}

function updateSelectedServiceUI() {
    const container = document.getElementById('selectedService');
    if (selectedServices.size === 0) {
        container.innerHTML = '<span style="color: #808080;">No services selected</span>';
        return;
    }

    if (selectedServices.size === 1) {
        const serviceName = Array.from(selectedServices)[0];
        const service = services[serviceName];
        if (!service) return;

        const watchButton = service.has_watch_command ? `
                <button class="toggle-watch" onclick="toggleWatch('${service.name}')">
                    ${service.watching ? 'Stop Watching' : 'Start Watching'}
                </button>
        ` : '';
        const isOneTimeService = service.name === 'types' || service.name === 'shared' || service.name === 'checks';
        const actionButton = isOneTimeService ? `
                <button class="kill refresh" onclick="restartService('${service.name}')">
                    Refresh
                </button>
        ` : `
                <button class="kill" onclick="killService('${service.name}')">
                    ${service.status === 'killed' ? 'Restart' : 'Kill'}
                </button>
        `;

        container.innerHTML = `
            <div class="action-buttons">
                ${watchButton}
                <button class="toggle-filter" onclick="toggleFilter('${service.name}')">
                    ${service.hidden ? 'Show Logs' : 'Hide Logs'}
                </button>
                ${actionButton}
            </div>
        `;
    } else {
        container.innerHTML = `<span style="color: #808080;">${selectedServices.size} services selected</span>`;
    }
}
