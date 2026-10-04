// Google renders each row's label text in this palette's `color` tone directly
// (it ignores labelStyle.color whenever a resource matches an entry), so every
// tone here is chosen for contrast against the white canvas, not just for looks.
// `dark` is used for a row on the critical path -- naturally higher-contrast
// here since it's a further-saturated version of the same hue, not a lighter one.
const THEME = {
    backgroundColor: {
        fill: '#FFFFFF'
    },
    gantt: {
    trackHeight: 35,
    barHeight: 20,
    barCornerRadius: 10,
    shadowEnabled: true,
    palette: [
        { color: '#2C3E66', dark: '#1B2847', light: '#2C3E66' }, // navy
        { color: '#7A2E3B', dark: '#5C1F29', light: '#7A2E3B' }, // burgundy
        { color: '#2F6F4E', dark: '#1E4A33', light: '#2F6F4E' }, // forest green
        { color: '#1F6F78', dark: '#134850', light: '#1F6F78' }, // teal
        { color: '#6B3F8C', dark: '#4A2A61', light: '#6B3F8C' }, // plum
        { color: '#8A5A1E', dark: '#5E3C12', light: '#8A5A1E' }, // bronze
        { color: '#3C4552', dark: '#272D36', light: '#3C4552' }, // charcoal
    ],
    arrow: {
        width: 3,
        color: '#3C4552'
    },
    innerGridHorizLine: {
        stroke: '#E4E7EB',
        strokeWidth: 1
    },
    innerGridTrack: {fill: '#FFFFFF'},
    innerGridDarkTrack: {fill: '#F4F6F8'},
    defaultStartDate: new Date(),
    labelStyle: {
        fontName: 'helvetica',
        fontSize: 14,
        color: '#1B2230'
    },
    }
}
