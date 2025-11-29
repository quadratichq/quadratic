function addLog(log) {
    // Check if this is a target-purge progress message
    if (log.service === 'target-purge' && log.message.startsWith('PROGRESS:')) {
        handleTargetPurgeProgress(log.message);
        // Don't add progress messages to logs
        return;
    }

    logs.push(log);
    // Don't limit logs here - server handles that
    // Just keep reasonable limit in browser (100000)
    if (logs.length > 100000) {
        logs.shift();
    }
    renderLogs();
}

function handleTargetPurgeProgress(message) {
    // Parse PROGRESS:percentage:total:status message
    const parts = message.split(':');
    if (parts.length >= 4 && parts[0] === 'PROGRESS') {
        const percentage = parseInt(parts[1], 10);
        const total = parseInt(parts[2], 10);
        const status = parts.slice(3).join(':'); // Rejoin in case status contains ':'

        updateTargetPurgeProgress(percentage, total, status);
    }
}

function updateTargetPurgeProgress(percentage, total, status) {
    const progressContainer = document.getElementById('targetProgress');
    const progressBar = document.getElementById('targetProgressBar');
    const progressText = document.getElementById('targetProgressText');

    if (progressContainer && progressBar && progressText) {
        progressContainer.style.display = 'block';
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = status;

        // Hide progress when complete
        if (percentage >= 100) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 1000);
        }
    }
}

function saveSelection() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return null;
    }

    const range = selection.getRangeAt(0);
    const container = document.getElementById('logs');
    if (!container.contains(range.commonAncestorContainer)) {
        return null;
    }

    // Find the log entries that contain the selection
    const logEntries = Array.from(container.querySelectorAll('.log-entry'));
    const startEntry = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement.closest('.log-entry')
        : range.startContainer.closest('.log-entry');
    const endEntry = range.endContainer.nodeType === Node.TEXT_NODE
        ? range.endContainer.parentElement.closest('.log-entry')
        : range.endContainer.closest('.log-entry');

    if (!startEntry || !endEntry) {
        return null;
    }

    const startIndex = logEntries.indexOf(startEntry);
    const endIndex = logEntries.indexOf(endEntry);

    if (startIndex === -1 || endIndex === -1) {
        return null;
    }

    // Get the log message elements and find character offsets
    const startMessage = startEntry.querySelector('.log-message');
    const endMessage = endEntry.querySelector('.log-message');

    if (!startMessage || !endMessage) {
        return null;
    }

    // Calculate character offsets within the message text
    const startOffset = getTextOffsetInElement(range.startContainer, startMessage, range.startOffset);
    const endOffset = getTextOffsetInElement(range.endContainer, endMessage, range.endOffset);

    return {
        startIndex,
        endIndex,
        startOffset,
        endOffset
    };
}

function getTextOffsetInElement(node, element, nodeOffset) {
    let offset = 0;
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
    );

    let textNode;
    while ((textNode = walker.nextNode())) {
        if (textNode === node) {
            return offset + nodeOffset;
        }
        offset += textNode.textContent.length;
    }

    return offset;
}

function restoreSelection(savedSelection) {
    if (!savedSelection) return;

    const container = document.getElementById('logs');
    const logEntries = Array.from(container.querySelectorAll('.log-entry'));

    if (savedSelection.startIndex >= logEntries.length || savedSelection.endIndex >= logEntries.length) {
        return; // Logs were filtered or removed
    }

    const startEntry = logEntries[savedSelection.startIndex];
    const endEntry = logEntries[savedSelection.endIndex];

    if (!startEntry || !endEntry) {
        return;
    }

    const startMessage = startEntry.querySelector('.log-message');
    const endMessage = endEntry.querySelector('.log-message');

    if (!startMessage || !endMessage) {
        return;
    }

    // Find the text nodes and offsets
    const startPos = findTextPosition(startMessage, savedSelection.startOffset);
    const endPos = findTextPosition(endMessage, savedSelection.endOffset);

    if (!startPos || !endPos) {
        return;
    }

    // Create and set the selection
    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    selection.removeAllRanges();
    selection.addRange(range);
}

function findTextPosition(element, charOffset) {
    let currentOffset = 0;
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
    );

    let textNode;
    while ((textNode = walker.nextNode())) {
        const textLength = textNode.textContent.length;
        if (currentOffset + textLength >= charOffset) {
            return {
                node: textNode,
                offset: charOffset - currentOffset
            };
        }
        currentOffset += textLength;
    }

    // If we didn't find it, return the last text node
    const lastTextNode = getLastTextNode(element);
    if (lastTextNode) {
        return {
            node: lastTextNode,
            offset: lastTextNode.textContent.length
        };
    }

    return null;
}

function getLastTextNode(element) {
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
    );

    let lastNode = null;
    let node;
    while ((node = walker.nextNode())) {
        lastNode = node;
    }
    return lastNode;
}

function renderLogs() {
    const container = document.getElementById('logs');

    // Check if user is at the bottom before rendering (within 10px threshold)
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const wasAtBottom = scrollBottom < 10;

    // Store the scroll position before rendering
    const previousScrollTop = container.scrollTop;

    // Save current selection before re-rendering
    const savedSelection = saveSelection();

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
                <span class="log-metadata">
                    <span class="log-service ${serviceClass}">[${log.service}]</span>
                    ${stderrBadge}
                </span>
                <span class="log-message">${ansiToHtml(log.message)}</span>
                <span class="log-timestamp">${time}</span>
            </div>
        `;
    }).join('');

    // Restore selection after re-rendering
    if (savedSelection) {
        // Use requestAnimationFrame to ensure DOM is fully updated
        requestAnimationFrame(() => {
            restoreSelection(savedSelection);
        });
    }

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
