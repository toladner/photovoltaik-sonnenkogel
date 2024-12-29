// SETTINGS -------------------------------------------------------------------

// Default matlab colors: https://de.mathworks.com/help/matlab/creating_plots/specify-plot-colors.html
const plotData = {
    dach: {name: 'Dach', color: '#0072BD', hidden: false, legendOrder: 0},
    balkon: {name: 'Balkon', color: '#EDB120', hidden: false, legendOrder: 1},
    verbrauch: {name: 'Verbrauch', color: '#D95319', hidden: true, legendOrder: 2},
    bezug: {name: 'Bezug', color: '#7E2F8E', hidden: true, legendOrder: 3},
    alpha: '75'
}

// HELPER FUNCTIONS ----------------------------------------------------------

function removePlaceholder(element) {
    element.classList.remove('placeholder')
}

function overwritePlaceHolder(groupId, elementId, value, unit = 'W?') {
    const element = document.querySelector(`#${groupId} #${elementId}`)
    element.innerText = (unit === "") ? `${value}` : `${value} ${unit}`
    removePlaceholder(element)
}

// DATASET OBJECTS ------------------------------------------------------------

function getBasicDatasetObject(type, data) {
    return {
        label: plotData[type].name,
        data: data,
        backgroundColor: `${plotData[type].color}${plotData.alpha}`,
        borderColor: plotData[type].color,
        borderWidth: 1,
        lineTension: 0.4
    }
}

function getTimeDatasetObject(type, data) {
    const dataset = getBasicDatasetObject(type, data)
    dataset.fill = 'origin'
    dataset.hidden = plotData[type].hidden
    return dataset
}

function getZoomOptions() {
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return {
        zoom: {
            wheel: {
                enabled: true,
            },
            drag: {
                enabled: false
            },
            pinch: {
                enabled: true
            },
            mode: 'x',
        },
        pan: {
            enabled: true,
            mode: 'x'
        },
        limits: {
            x: {max: endOfDay}
        }
    }
}

function getLegendSorting(a,b,data) {
    return (a,b,data) => plotData[a.text.toLowerCase()].legendOrder - plotData[b.text.toLowerCase()].legendOrder
}

function getAspectRatio() {return 2 / 1.1}

// CHARTS ---------------------------------------------------------------------

// Live Chart
async function showLiveChart() {
    logSection('[CHART] Showing Live..')

    lastData = await Promise.all([
        getLastData('dach'),
        getLastData('balkon'),
        getLastData('verbrauch'),
        getLastData('bezug'),
    ]);

    const lastDach = lastData[0];
    const lastBalkon = lastData[1];
    const lastVerbrauch = lastData[2];
    const lastBezug = lastData[3];

    const data = {
        labels: ["Produktion", "Verbrauch", "Bezug"],
        datasets: [
            getBasicDatasetObject('dach', [lastDach.y, 0, 0]),
            getBasicDatasetObject('balkon', [lastBalkon.y, 0, 0]),
            getBasicDatasetObject('verbrauch', [0, lastVerbrauch.y, 0]),
            getBasicDatasetObject('bezug', [0, 0, lastBezug.y]),
        ]
    };
    const chartId = 'liveChart';
    new Chart(document.getElementById(chartId), {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            aspectRatio: getAspectRatio(),
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'W'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        sort: getLegendSorting()
                    }
                }
            }
        }
    });

    // update placeholders
    removePlaceholder(document.getElementById(chartId).parentElement)

    overwritePlaceHolder('liveData', 'dach', lastDach.y, 'W')
    overwritePlaceHolder('liveData', 'dateDach', lastDach.x, '')
    overwritePlaceHolder('liveData', 'balkon', lastBalkon.y, 'W')
    overwritePlaceHolder('liveData', 'dateBalkon', lastBalkon.x, '')
    overwritePlaceHolder('liveData', 'verbrauch', lastVerbrauch.y, 'W')
    overwritePlaceHolder('liveData', 'bezug', lastBezug.y, 'W')
}

// Today Chart
async function showTodayChart() {
    logSection('[CHART] Showing Today..')
    const types = ['balkon', 'dach', 'verbrauch', 'bezug']

    const data = {
        labels: [],
        datasets:
            await Promise.all(
                types.map(async (type) => {
                        return getTimeDatasetObject(type, await getData(type, getDay(0)))
                    }
                ))
    };
    const chartId = 'todayChart';
    new Chart(document.getElementById(chartId), {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            aspectRatio: getAspectRatio(),
            elements: {
                point: {
                    radius: 0
                }
            },
            plugins: {
                // zoom: getZoomOptions()
                legend: {
                    labels: {
                        sort: getLegendSorting()
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    min: `${getDay(0)} 06:00`,
                    max: `${getDay(0)} 22:00`,
                    time: {
                        unit: "hour",
                        displayFormats: {
                            hour: 'HH'
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'W'
                    }
                }
            }
        }
    });

    // update placeholders
    removePlaceholder(document.getElementById(chartId).parentElement)

    // sum values
    const values = types.map((type) =>
        data.datasets[types.indexOf(type)].data.reduce((sum, item) => sum + parseInt(item.y, 10), 0)
    )
    // compute einspeisung
    types.push('einspeisung')
    values.push(data.datasets[types.indexOf('bezug')].data.reduce((sum, item) => sum - Math.min(0, parseInt(item.y, 10)), 0))

    // update placeholder
    types.forEach((type) => overwritePlaceHolder('todayData', type, values[types.indexOf(type)], 'W?'))
}

// Week Chart
async function showWeekChart() {
    logSection('[CHART] Showing Week..')
    const types = ['balkon', 'dach', 'verbrauch', 'bezug']

    const data = {
        labels: [],
        datasets:
            await Promise.all(
                types.map(async (type) => {
                        return getTimeDatasetObject(
                            type,
                            await Promise.all([
                                getData(type, getDay(-6)),
                                getData(type, getDay(-5)),
                                getData(type, getDay(-4)),
                                getData(type, getDay(-3)),
                                getData(type, getDay(-2)),
                                getData(type, getDay(-1)),
                                getData(type, getDay(0)),
                            ]).then(results => results.flat()))
                    }
                )
            )
    };
    const chartId = 'weekChart'
    new Chart(document.getElementById(chartId), {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            aspectRatio: getAspectRatio(),
            elements: {
                point: {
                    radius: 0
                }
            },
            plugins: {
                zoom: getZoomOptions(),
                legend: {
                    labels: {
                        sort: getLegendSorting()
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    min: getDay(-6),
                    max: `${getDay(0)} 23:59:59`,
                    time: {
                        unit: "day",
                        displayFormats: {
                            day: 'dd. MMM'
                        }
                    },
                    ticks: {
                        callback: (value) => new Date(value).toLocaleDateString('de-DE', {month:'short', day:'2-digit'})
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'W'
                    }
                }
            }
        }
    });

    // update placeholders
    removePlaceholder(document.getElementById(chartId).parentElement)

    // sum values
    const values = types.map((type) =>
        data.datasets[types.indexOf(type)].data.reduce((sum, item) => sum + parseInt(item.y, 10), 0)
    )
    // compute einspeisung
    types.push('einspeisung')
    values.push(data.datasets[types.indexOf('bezug')].data.reduce((sum, item) => sum - Math.min(0, parseInt(item.y, 10)), 0))

    // update placeholder
    types.forEach((type) => overwritePlaceHolder('weekData', type, values[types.indexOf(type)], 'W?'))
}

async function showCharts() {
    Chart.defaults.font.size = 16;
    Chart.defaults.font.family = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans","Liberation Sans",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'
    Chart.defaults.font.weight = 400
    Chart.defaults.font.lineHeight = 1.5
    showLiveChart()
        .then(value => showTodayChart()
            .then(value => showWeekChart()
            )
        );
}

showCharts()
