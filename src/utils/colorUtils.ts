export const colorNameToHex: Record<string, string> = {
    'Preto': '#000000',
    'Branco': '#FFFFFF',
    'Mescla': '#BEBEBE',
    'Cinza Mescla': '#BEBEBE',
    'Chumbo': '#696969',
    'Cinza Chumbo': '#696969',
    'Marinho': '#00008B',
    'Royal': '#0000FF',
    'Verde': '#5DBB63',
    'Verde Bandeira': '#009b3a',
    'Musgo': '#006400',
    'Verde Escuro': '#006400',
    'Vinho': '#800000',
    'Bordô': '#800000',
    'Vermelho': '#FF0000',
    'Laranja': '#FFA500',
    'Amarelo': '#FFFF00',
    'Roxo': '#8A2BE2',
    'Pink': '#FF00FF',
    'Rosa Pink': '#FF69B4',
    'Lilás': '#C8A2C8',
    'Lilas': '#C8A2C8', // Alias
    'Rosa Bebê': '#F4C2C2',
    'Turquesa': '#00FFFF',
    'Verde Euforia': '#00FF7F',
    'Verde Limão': '#ADFF2F',
    'Marrom Caramelo': '#D2691E',
    'Caramelo': '#D2691E',
    'Coral': '#FF7F50',
    'Azul Claro': '#87CEEB',
    'Azul Bebê': '#89CFF0',

    // Fallbacks and other existing colors
    'va': '#BDBDBD', // Variadas
    'chat': '#BDBDBD', // Chat
};

export const getColorHex = (colorName: string): string => {
    const normalizedName = Object.keys(colorNameToHex).find(key => key.toLowerCase() === colorName.toLowerCase());
    return normalizedName ? colorNameToHex[normalizedName] : '#CCCCCC';
};

/**
 * Generates an array of distinct pastel colors.
 * @param count The number of colors to generate.
 * @returns An array of hex color strings.
 */
export const generatePastelColors = (count: number): string[] => {
    const colors: string[] = [];
    const saturation = 90; // Increased for more vibrant pastels
    const lightness = 85;  // Increased for better visibility in dark mode
    for (let i = 0; i < count; i++) {
        // Distribute hues evenly around the color wheel
        const hue = (i * (360 / count)) % 360;
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
};

/**
 * Generates a deterministic color based on a string input.
 * Useful for assigning consistent colors to products, tags, etc.
 */
export const getStringColor = (str: string, saturation = 70, lightness = 85): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, ${saturation}%, ${lightness}%)`;
};

export const getTextColorForBackground = (color: string): string => {
    // Handle HSL strings like 'hsl(180, 70%, 80%)' or 'hsla(180, 70%, 80%, 0.5)'
    const hslMatch = color.match(/hsl(a)?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*(,\s*[\d.]+\s*)?\)/);
    if (hslMatch && hslMatch[2]) { // hslMatch[2] is the lightness value
        const lightness = parseFloat(hslMatch[2]);
        return lightness > 60 ? '#000000' : '#FFFFFF'; // A lightness > 60% is light enough for black text.
    }

    // Handle HEX strings
    if (color.startsWith('#')) {
        let hex = color.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map(char => char + char).join('');
        }
        if (hex.length !== 6) return '#000000';

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        // Using the YIQ formula to determine brightness
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 150 ? '#000000' : '#FFFFFF';
    }

    // Default for unknown formats
    return '#000000';
};