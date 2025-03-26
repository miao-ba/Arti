// main_menu.js
import { fetchServerTime, calculateDateRange, generateLabels } from './utils.js';
import { renderRecycleCharts, renderGeneralWasteCharts, renderBiomedicalWasteCharts, renderPharGlassCharts } from './charts.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("main_menu.js loaded");

    const serverTime = await fetchServerTime();
    const { startDate, endDate } = calculateDateRange(serverTime);
    const xAxisLabels = generateLabels(startDate, endDate);

    const data = window.recycleData || {};
    const recycleData = data.recycle || {};
    const generalData = data.general || {};
    const biomedicalData = data.biomedical || {};
    const pharGlassData = data.pharGlass || {};

    // Render all charts
    renderRecycleCharts(recycleData, xAxisLabels);
    renderGeneralWasteCharts(generalData, xAxisLabels);
    renderBiomedicalWasteCharts(biomedicalData, xAxisLabels);
    renderPharGlassCharts(pharGlassData, xAxisLabels);

    // Toggle chart sections with hex buttons
    const sections = {
        'recycleOverview': document.getElementById('recycleOverview'),
        'generalOverview': document.getElementById('generalOverview'),
        'biomedicalOverview': document.getElementById('biomedicalOverview'),
        'pharGlassOverview': document.getElementById('pharGlassOverview')
    };
    document.querySelectorAll('hex-button').forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.getAttribute('data-section');
            Object.keys(sections).forEach(id => {
                sections[id].style.display = id === sectionId ? 'block' : 'none';
            });
            button.setAttribute('active', '');
            document.querySelectorAll(`hex-button:not([data-section="${sectionId}"])`).forEach(b => b.removeAttribute('active'));
            if (sectionId === 'recycleOverview') window.updateRecycleStackedBar($('input[name="recyclePeriod"]:checked').val() || 'monthly');
            else if (sectionId === 'generalOverview') window.updateGeneralStackedBar($('input[name="generalPeriod"]:checked').val() || 'monthly');
            else if (sectionId === 'biomedicalOverview') window.updateBiomedicalStackedBar($('input[name="biomedicalPeriod"]:checked').val() || 'monthly');
        });
    });

    // Event listeners for period changes
    $('input[name="recyclePeriod"]').change(function() { window.updateRecycleStackedBar($(this).val()); });
    $('input[name="generalPeriod"]').change(function() { window.updateGeneralStackedBar($(this).val()); });
    $('input[name="biomedicalPeriod"]').change(function() { window.updateBiomedicalStackedBar($(this).val()); });
});