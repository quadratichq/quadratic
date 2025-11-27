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
    // Check if any services are starting
    const hasStartingServices = Object.values(services).some(
        service => service.status.toLowerCase() === 'starting'
    );

    if (hasStartingServices) {
        startFaviconAnimation();
    } else {
        stopFaviconAnimation();
        setStaticFavicon();
    }
}

function startFaviconAnimation() {
    if (faviconAnimationFrame !== null) {
        return; // Already animating
    }
    animateFavicon();
}

function stopFaviconAnimation() {
    if (faviconAnimationFrame !== null) {
        cancelAnimationFrame(faviconAnimationFrame);
        faviconAnimationFrame = null;
    }
}

function animateFavicon() {
    faviconRotation = (faviconRotation + 8) % 360;
    createFavicon(faviconRotation);
    faviconAnimationFrame = requestAnimationFrame(animateFavicon);
}

function setStaticFavicon() {
    createFavicon(0);
}

function createFavicon(rotation) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, 32, 32);

    // Draw Quadratic logo colors in a circular pattern
    const centerX = 16;
    const centerY = 16;
    const radius = 12;

    // Colors from the Quadratic logo
    const colors = ['#CB8999', '#5D576B', '#8ECB89', '#FFC800', '#6CD4FF'];
    const numSegments = 5;
    const segmentAngle = (2 * Math.PI) / numSegments;

    // Draw rotating segments
    for (let i = 0; i < numSegments; i++) {
        const startAngle = (i * segmentAngle) + (rotation * Math.PI / 180);
        const endAngle = ((i + 1) * segmentAngle) + (rotation * Math.PI / 180);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();
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
