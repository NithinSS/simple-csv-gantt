const THEME = {
    backgroundColor: {
        fill: '#B5CCDA'
    },
    gantt: {
    trackHeight: 35,
    barHeight: 20,
    barCornerRadius: 10,
    shadowEnabled: true,
    palette: [
        { color: '#99A0BA', dark: '#7881A3', light: '#99A0BA' }, // slate blue
        { color: '#B5CCDA', dark: '#8AB4CD', light: '#B5CCDA' }, // sky blue
        { color: '#ECCAC8', dark: '#E3B1B3', light: '#ECCAC8' }, // blush pink
        { color: '#A8988A', dark: '#948679', light: '#A8988A' }, // warm grey
        { color: '#E0B35C', dark: '#C98A2D', light: '#E0B35C' }, // amber
        { color: '#6FCF97', dark: '#2FA37A', light: '#6FCF97' }, // teal green
        { color: '#C9A0DC', dark: '#AD6ECF', light: '#C9A0DC' }, // plum
    ],
    arrow: {
        width: 3,
        color: '#B5CCDA'
    },
    innerGridHorizLine: {
        stroke: 'transparent',
        strokeWidth: 1
    },
    innerGridTrack: {fill: '#151635'},
    innerGridDarkTrack: {fill: '#15162B'},
    defaultStartDate: new Date(),
    labelStyle: {
        fontName: 'helvetica',
        fontSize: 14,
        color: 'white'
    },
    }
}