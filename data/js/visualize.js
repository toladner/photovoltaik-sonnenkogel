// SETTINGS -------------------------------------------------------------------

// Default matlab colors: https://de.mathworks.com/help/matlab/creating_plots/specify-plot-colors.html
const plotData = {
    dach: {name: 'Dach', color: '#0072BD', hidden: false, legendOrder: 0},
    balkon: {name: 'Balkon', color: '#EDB120', hidden: false, legendOrder: 1},
    verbrauch: {name: 'Verbrauch', color: '#D95319', hidden: true, legendOrder: 2},
    bezug: {name: 'Bezug', color: '#7E2F8E', hidden: true, legendOrder: 3},
    einspeisung: {name: 'Eingespeist', color: '#77AC30', hidden: false, legendOrder: 4},
    alpha: '75'
}

// HELPER FUNCTIONS ----------------------------------------------------------

function removePlaceholder(element) {
    element.classList.remove('placeholder')
}

function overwritePlaceHolder(groupId, elementId, value, unit = 'W?') {

    // write into element
    const element = document.querySelector(`#${groupId} #${elementId}`)
    if (typeof value === "string" && value.includes(':')) {
        // likely a date
        element.innerText = value
    } else {
        // convert number
        element.innerText = parseFloat(value).toFixed(1)

        // add unit
        if (!(unit === "")) {
            element.innerText = `${element.innerText} ${unit}`
        }
    }

    // remove placeholder
    removePlaceholder(element)
}

// DATASET OBJECTS ------------------------------------------------------------

function getBasicDatasetObject(type, data, hidden = false) {
    return {
        label: plotData[type].name,
        data: data,
        backgroundColor: `${plotData[type].color}${plotData.alpha}`,
        borderColor: plotData[type].color,
        borderWidth: 1,
        lineTension: 0.4,
        hidden: hidden
    }
}

function getTimeDatasetObject(type, data) {
    const dataset = getBasicDatasetObject(type, data, plotData[type].hidden)
    dataset.fill = 'origin'
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

function getLegendSorting(a, b, data) {
    if (typeof a === "undefined" || typeof b === "undefined") {
        return 0
    }
    return (a, b, data) => plotData[a.text.toLowerCase()].legendOrder - plotData[b.text.toLowerCase()].legendOrder
}

function getAspectRatio() {
    return 2 / 1.1
}

function getGridStyle() {
    return {
        color: function (context) {
            if (context.tick.value === 0) {
                return 'black'; // highlight zero grid line
            }
            return 'rgba(0, 0, 0, 0.1)'; // default grid line color
        },
    }
}

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
                    },
                    grid: getGridStyle()
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
    const types = ['balkon', 'dach', 'verbrauch', 'bezug', 'einspeisung']

    // gather data
    const data = {
        labels: [],
        datasets:
            await Promise.all(
                types.map(async (type) => {
                        return getTimeDatasetObject(type, await getData(type, getDay(0)))
                    }
                ))
    };
    // plot chart
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
                    },
                    grid: getGridStyle()
                }
            }
        }
    });

    // update placeholders
    removePlaceholder(document.getElementById(chartId).parentElement)
    // update statistics
    types.forEach(
        type =>
            overwritePlaceHolder(
                'todayData',
                type,
                integrateData(data.datasets[types.indexOf(type)].data), 'kWh'
            )
    )
}

// Week Chart
async function showWeekChart() {
    logSection('[CHART] Showing Week..')
    const types = ['balkon', 'dach', 'verbrauch', 'bezug', 'einspeisung']

    // gather data
    const data = {
        labels: [],
        datasets:
            await Promise.all(
                types.map(async (type) => {
                        return getTimeDatasetObject(
                            type,
                            await Promise.all(range(-6, 0).map(i => getData(type, getDay(i))))
                                .then(results => results.flat()))
                    }
                )
            )
    };
    // plot chat
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
                        callback: (value) => new Date(value).toLocaleDateString('de-DE', {month: 'short', day: '2-digit'})
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'W'
                    },
                    grid: getGridStyle()
                }
            }
        }
    });

    // update placeholders
    removePlaceholder(document.getElementById(chartId).parentElement)
    // update statistics
    types.forEach(
        type =>
            overwritePlaceHolder(
                'weekData',
                type,
                integrateData(data.datasets[types.indexOf(type)].data), 'kWh'
            )
    )
}

async function showMonthData() {
    logSection('[CHART] Showing Month..')
    const types = ['balkon', 'dach', 'verbrauch', 'bezug', 'einspeisung']
    const N = 30;
    const days = range(-(N - 1), 0);

    // gather data
    const data = {
        labels: days.map(i => getDay(i)),
        datasets:
            await Promise.all(types.map(async type =>
                getBasicDatasetObject(type,
                    (await Promise.all(
                        days.map(i =>
                            getData(type, getDay(i))
                        )
                    )).map(data_i => integrateData(data_i)),
                    plotData[type].hidden
                ))
            )

    };
    // plot chart
    const chartId = 'monthChart';
    new Chart(document.getElementById(chartId), {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            aspectRatio: getAspectRatio(),
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'kWh'
                    },
                    grid: getGridStyle()
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
    // update statistics
    types.forEach(
        type =>
            overwritePlaceHolder(
                'monthData',
                type,
                (data.datasets[types.indexOf(type)].data).reduce((acc, data_i) => acc + data_i, 0),
                'kWh'
            )
    )
}

async function showCharts() {
    Chart.defaults.font.size = 16;
    Chart.defaults.font.family = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans","Liberation Sans",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'
    Chart.defaults.font.weight = 400
    Chart.defaults.font.lineHeight = 1.5
    logSection('[CHART] Starting..')                         // Start:
    getCredentials()                                              // 1. Credentials
        .then(value => showLiveChart()                     // 2. Live
                .then(value => showTodayChart()             // 3. Today
                    .then(value => showWeekChart()          // 4. Week
                        .then(value => showMonthData()      // 5. Month
                            .then(value => {                // Done!
                                console.log('[CHART] Completed.')
                            }))
                    )
                )
        )
}

showCharts()

