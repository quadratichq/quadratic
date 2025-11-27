function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function ansiToHtml(text) {
    // ANSI color code mappings
    const ansiColors = {
        // Standard foreground colors (30-37)
        30: '#000000', // black
        31: '#cd3131', // red
        32: '#0dbc79', // green
        33: '#e5e510', // yellow
        34: '#2472c8', // blue
        35: '#bc3fbc', // magenta
        36: '#11a8cd', // cyan
        37: '#e5e5e5', // white
        // Standard background colors (40-47)
        40: '#000000', // black
        41: '#cd3131', // red
        42: '#0dbc79', // green
        43: '#e5e510', // yellow
        44: '#2472c8', // blue
        45: '#bc3fbc', // magenta
        46: '#11a8cd', // cyan
        47: '#e5e5e5', // white
        // Bright foreground colors (90-97)
        90: '#666666', // bright black
        91: '#f14c4c', // bright red
        92: '#23d18b', // bright green
        93: '#f5f543', // bright yellow
        94: '#3b8eea', // bright blue
        95: '#d670d6', // bright magenta
        96: '#29b8db', // bright cyan
        97: '#e5e5e5', // bright white
        // Bright background colors (100-107)
        100: '#666666', // bright black
        101: '#f14c4c', // bright red
        102: '#23d18b', // bright green
        103: '#f5f543', // bright yellow
        104: '#3b8eea', // bright blue
        105: '#d670d6', // bright magenta
        106: '#29b8db', // bright cyan
        107: '#e5e5e5', // bright white
    };

    // Regex to match ANSI escape sequences
    const ansiRegex = /\x1b\[([0-9;]*?)m/g;

    let result = '';
    let lastIndex = 0;
    let openSpans = [];
    let match;

    while ((match = ansiRegex.exec(text)) !== null) {
        // Add text before the escape sequence
        if (match.index > lastIndex) {
            result += escapeHtml(text.substring(lastIndex, match.index));
        }

        const codes = match[1].split(';').map(c => c === '' ? 0 : parseInt(c, 10));

        // Handle reset (0)
        if (codes.includes(0) || codes.length === 0) {
            // Close all open spans
            while (openSpans.length > 0) {
                result += '</span>';
                openSpans.pop();
            }
        } else {
            // Process color codes
            for (const code of codes) {
                // Skip 0 (reset) if it's not the only code
                if (code === 0) continue;

                // Foreground colors (30-37, 90-97)
                if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
                    const color = ansiColors[code];
                    if (color) {
                        result += `<span style="color: ${color}">`;
                        openSpans.push('color');
                    }
                }
                // Background colors (40-47, 100-107)
                else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
                    const bgColor = ansiColors[code];
                    if (bgColor) {
                        result += `<span style="background-color: ${bgColor}">`;
                        openSpans.push('bg');
                    }
                }
                // RGB colors (38;2;r;g;b)
                else if (code === 38) {
                    // This would need more complex parsing for RGB
                    // For now, skip
                }
                // Bold (1)
                else if (code === 1) {
                    result += '<span style="font-weight: bold">';
                    openSpans.push('bold');
                }
                // Dim (2)
                else if (code === 2) {
                    result += '<span style="opacity: 0.5">';
                    openSpans.push('dim');
                }
                // Underline (4)
                else if (code === 4) {
                    result += '<span style="text-decoration: underline">';
                    openSpans.push('underline');
                }
            }
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        result += escapeHtml(text.substring(lastIndex));
    }

    // Close any remaining open spans
    while (openSpans.length > 0) {
        result += '</span>';
        openSpans.pop();
    }

    return result;
}
