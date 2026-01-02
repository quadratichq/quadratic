async function loadTheme() {
    try {
        const response = await fetch('/api/state');
        if (response.ok) {
            const state = await response.json();
            const theme = state.theme || 'dark';
            if (theme === 'light') {
                document.body.classList.add('light-mode');
                updateThemeToggleIcon(true);
            } else {
                document.body.classList.remove('light-mode');
                updateThemeToggleIcon(false);
            }
        }
    } catch (error) {
        console.error('Failed to load theme:', error);
        // Default to dark mode if API fails
        document.body.classList.remove('light-mode');
        updateThemeToggleIcon(false);
    }
}

async function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    const theme = isLight ? 'light' : 'dark';
    updateThemeToggleIcon(isLight);

    try {
        await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme })
        });
    } catch (error) {
        console.error('Failed to save theme:', error);
    }
}

function updateThemeToggleIcon(isLight) {
    const toggle = document.getElementById('themeToggle');
    if (toggle) {
        toggle.textContent = isLight ? '🌙' : '☀️';
    }
}

function updatePageTitle() {
    const totalServices = Object.keys(services).length;
    const runningServices = Object.values(services).filter(
        service => service.status.toLowerCase() === 'running'
    ).length;

    if (totalServices > 0) {
        document.title = `Quadratic Dev Server (${runningServices}/${totalServices})`;
    } else {
        document.title = 'Quadratic Dev Server';
    }
}

function updateFavicon() {
    // Check connection status first - show red X if connection is lost
    if (connectionLost) {
        stopFaviconAnimation();
        wasAnimatingFavicon = false;
        createFavicon(0, 'error');
        return;
    }

    // Check if any services are starting
    const hasStartingServices = Object.values(services).some(
        service => service.status.toLowerCase() === 'starting'
    );

    if (hasStartingServices) {
        startFaviconAnimation();
        wasAnimatingFavicon = true;
    } else {
        // If we were animating and now we're not, ensure favicon is updated immediately
        // This is important for tabs that are not focused, where requestAnimationFrame is throttled
        const wasAnimating = wasAnimatingFavicon;
        stopFaviconAnimation();
        wasAnimatingFavicon = false;

        // Always set static favicon when not animating
        setStaticFavicon();

        // When transitioning from animating to finished, force browser to recognize the change
        // by removing and re-adding the favicon element. This ensures the favicon updates
        // even when the tab is not focused (where requestAnimationFrame is throttled)
        if (wasAnimating) {
            const favicon = document.getElementById('favicon');
            if (favicon) {
                // Remove and re-add the favicon element to force browser update
                const parent = favicon.parentNode;
                const dataUrl = favicon.href;
                favicon.remove();

                // Create a new favicon link element
                const newFavicon = document.createElement('link');
                newFavicon.id = 'favicon';
                newFavicon.rel = 'icon';
                newFavicon.type = 'image/png';
                newFavicon.href = dataUrl;
                parent.appendChild(newFavicon);
            }
        }
    }
}

function startFaviconAnimation() {
    if (faviconAnimationFrame !== null) {
        return; // Already animating
    }
    faviconLastTime = null; // Reset timestamp when starting
    faviconAnimationFrame = requestAnimationFrame(animateFavicon);
}

function stopFaviconAnimation() {
    if (faviconAnimationFrame !== null) {
        cancelAnimationFrame(faviconAnimationFrame);
        faviconAnimationFrame = null;
        faviconLastTime = null;
    }
}

function animateFavicon(timestamp) {
    // Use performance.now() if timestamp is not provided (shouldn't happen with RAF, but safety check)
    const currentTime = timestamp || performance.now();

    if (faviconLastTime === null) {
        faviconLastTime = currentTime;
    }

    // Calculate rotation based on elapsed time
    // 240 degrees per second = consistent speed across all refresh rates
    const deltaTime = currentTime - faviconLastTime;
    const degreesPerSecond = 200;
    const rotationIncrement = (degreesPerSecond * deltaTime) / 1000;

    faviconRotation = (faviconRotation + rotationIncrement) % 360;
    faviconLastTime = currentTime;

    createFavicon(faviconRotation, 'in-progress');
    faviconAnimationFrame = requestAnimationFrame(animateFavicon);
}

function setStaticFavicon() {
    createFavicon(0, 'checkmark');
}

function createFavicon(rotation, type = 'checkmark') {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, 32, 32);

    const centerX = 16;
    const centerY = 16;

    if (type === 'in-progress') {
        // Draw circular arrows (refresh icon) that rotates
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((rotation * Math.PI) / 180);

        // Draw circular arrow - two curved arrows pointing at each other
        ctx.strokeStyle = '#4CAF50'; // Green color
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const radius = 10;
        const gapAngle = Math.PI / 6; // 30 degree gap on each side

        // First arrow (top half circle) - going clockwise, with gaps
        const arrow1Start = -Math.PI / 2 + gapAngle;
        const arrow1End = Math.PI / 2 - gapAngle;
        ctx.beginPath();
        ctx.arc(0, 0, radius, arrow1Start, arrow1End, false);
        ctx.stroke();

        // Arrowhead for first arrow (pointing in direction of clockwise motion)
        const arrow1X = radius * Math.cos(arrow1End);
        const arrow1Y = radius * Math.sin(arrow1End);
        // Tangent direction for clockwise motion
        const tan1X = Math.sin(arrow1End);
        const tan1Y = -Math.cos(arrow1End);
        const arrowLen = 5;
        const arrowSpread = 3;
        ctx.beginPath();
        ctx.moveTo(arrow1X, arrow1Y);
        ctx.lineTo(arrow1X + tan1X * arrowLen + tan1Y * arrowSpread, arrow1Y + tan1Y * arrowLen - tan1X * arrowSpread);
        ctx.moveTo(arrow1X, arrow1Y);
        ctx.lineTo(arrow1X + tan1X * arrowLen - tan1Y * arrowSpread, arrow1Y + tan1Y * arrowLen + tan1X * arrowSpread);
        ctx.stroke();

        // Second arrow (bottom half circle) - going counter-clockwise, with gaps
        const arrow2Start = Math.PI / 2 + gapAngle;
        const arrow2End = -Math.PI / 2 - gapAngle; // Equivalent to 3π/2 - gapAngle
        ctx.beginPath();
        ctx.arc(0, 0, radius, arrow2Start, arrow2End, false);
        ctx.stroke();

        // Arrowhead for second arrow (pointing in direction of clockwise motion)
        const arrow2X = radius * Math.cos(arrow2End);
        const arrow2Y = radius * Math.sin(arrow2End);
        // Tangent direction for clockwise motion: perpendicular to radius, rotated 90° clockwise
        const tan2X = Math.sin(arrow2End);  // perpendicular to radius
        const tan2Y = -Math.cos(arrow2End); // rotated clockwise
        ctx.beginPath();
        ctx.moveTo(arrow2X, arrow2Y);
        ctx.lineTo(arrow2X + tan2X * arrowLen + tan2Y * arrowSpread, arrow2Y + tan2Y * arrowLen - tan2X * arrowSpread);
        ctx.moveTo(arrow2X, arrow2Y);
        ctx.lineTo(arrow2X + tan2X * arrowLen - tan2Y * arrowSpread, arrow2Y + tan2Y * arrowLen + tan2X * arrowSpread);
        ctx.stroke();

        ctx.restore();
    } else if (type === 'error') {
        // Draw red X
        ctx.strokeStyle = '#F44336'; // Red color
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw X (two diagonal lines)
        const size = 10;
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - size);
        ctx.lineTo(centerX + size, centerY + size);
        ctx.moveTo(centerX + size, centerY - size);
        ctx.lineTo(centerX - size, centerY + size);
        ctx.stroke();
    } else {
        // Draw green checkmark
        ctx.strokeStyle = '#4CAF50'; // Green color
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw checkmark
        ctx.beginPath();
        ctx.moveTo(9, 16);
        ctx.lineTo(14, 21);
        ctx.lineTo(23, 10);
        ctx.stroke();
    }

    // Convert canvas to data URL and update favicon
    const dataUrl = canvas.toDataURL('image/png');
    const favicon = document.getElementById('favicon');
    if (favicon) {
        favicon.href = dataUrl;
    } else {
        // Create favicon link if it doesn't exist
        const link = document.createElement('link');
        link.id = 'favicon';
        link.rel = 'icon';
        link.type = 'image/png';
        link.href = dataUrl;
        document.head.appendChild(link);
    }
}
