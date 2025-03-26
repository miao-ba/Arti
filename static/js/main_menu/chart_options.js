// chartOptions.js
export const baseOptions = {
    chart: {
        height: 500,
        toolbar: { show: true }, // Toolbar enabled for all charts
        zoom: { enabled: true },
        animations: {
            enabled: true, // Animations enabled with noticeable settings
            speed: 1500, // Increased speed for visibility
            animateGradually: { enabled: true, delay: 300 }, // Slower gradual animation
            dynamicAnimation: { enabled: true, speed: 600 } // Slower dynamic animation
        }
    },
    xaxis: {
        categories: [], // Default empty, set per chart
        labels: {
            style: { fontSize: '14px', fontFamily: 'Sarasa Mono TC Regular, sans-serif' },
            formatter: val => val // Default to raw value
        }
    },
    yaxis: {
        labels: {
            style: { fontSize: '14px', fontFamily: 'Sarasa Mono TC Regular, sans-serif' },
            formatter: val => Math.floor(val)
        }
    },
    title: {
        text: '',
        align: 'center',
        style: { fontSize: '18px', fontFamily: 'Sarasa Mono TC Bold, sans-serif' }
    },
    legend: {
        fontSize: '14px',
        fontFamily: 'Sarasa Mono TC Regular, monospace'
    },
    tooltip: {
        style: { fontSize: '16px', fontFamily: 'Sarasa Mono TC Regular, sans-serif' },
        y: { formatter: val => Number(val).toFixed(2).replace(/\.0+$/, '') }
    },
    dataLabels: { enabled: false } // Default off, enabled for pie charts
};