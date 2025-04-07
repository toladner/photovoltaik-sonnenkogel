// SETTINGS -------------------------------------------------------------------

// Default matlab colors: https://de.mathworks.com/help/matlab/creating_plots/specify-plot-colors.html
const plotData = {
    dach: {name: 'Dach', color: '#0072BD', hidden: false, legendOrder: 0},
    balkon: {name: 'Balkon', color: '#EDB120', hidden: false, legendOrder: 1},
    verbrauchReal: {name: 'Verbrauch', color: '#D95319', hidden: true, legendOrder: 2},
    bezugReal: {name: 'Bezug', color: '#7E2F8E', hidden: true, legendOrder: 3},
    einspeisung: {name: 'Einspeisung', color: '#77AC30', hidden: false, legendOrder: 4},
    bezug: {name: 'Netto', color: '#4DBEEE', hidden: true, legendOrder: 5},
    alpha: '75'
}

// HELPER FUNCTIONS ----------------------------------------------------------

function addPlaceholder(element) {
    element.classList.add('placeholder')
}

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

function enableButtons(which, flag) {
    // gather buttons
    let buttons = [];
    if (which === 'today' || which === 'all') {
        buttons.push("todayDataPrev", "todayDataNext", 'todayPicker')
    }

    // enable/disable buttons
    buttons.map(id => {
        if (flag) {
            // enable button
            document.getElementById(id).removeAttribute('disabled')
        } else {
            // disable button
            document.getElementById(id).setAttribute('disabled', 'true')
        }
    })
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

function getLegendSorting(a, b, data) {
    if (typeof a === "undefined" || typeof b === "undefined") {
        return 0
    }
    return (a, b, data) => plotData[a.text.toLowerCase()].legendOrder - plotData[b.text.toLowerCase()].legendOrder
}

function getAspectRatio(format = "short") {
    if (format === 'tall') {
        return 2 / 1.4
    } else {
        return 2 / 1.1
    }
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

// Live Chart ---

async function showLiveChart() {
    logSection('[CHART] Showing Live..')

    // type: position
    const typesMap = {
        'dach': {pos: 0},
        'balkon': {pos: 0},
        'verbrauchReal': {pos: 1},
        'bezugReal': {pos: 2},
        'einspeisung': {pos: 2},
        'bezug': {pos: 2},
    }
    const types = Object.keys(typesMap)

    // retrieve data
    await Promise.all(
        types.map(async type =>
            typesMap[type].data = await getLastData(type)
        )
    )

    const data = {
        labels: ["Produktion", "Verbrauch",
            typesMap['einspeisung'].data.y > 0 ? plotData.einspeisung.name : plotData.bezugReal.name],
        datasets:
            // don't show 'bezug' here
            types.filter(type => type !== 'bezug')
                .map(type => {
                    const data_i = [0, 0, 0];
                    data_i[typesMap[type].pos] = typesMap[type].data.y
                    return getBasicDatasetObject(type, data_i)
                })
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
                    ticks: {
                        stepSize: 500
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
    types.forEach(type => overwritePlaceHolder('liveData', type, typesMap[type].data.y, 'W'))
    overwritePlaceHolder('liveData', 'dateDach', typesMap['dach'].data.x, '')
    overwritePlaceHolder('liveData', 'dateBalkon', typesMap['balkon'].data.x, '')
}

// Today Chart ---

let todayDate = getDay();

async function showTodayChart() {
    logSection('[CHART] Showing Today..')

    // plot chart
    const chartId = 'todayChart';
    new Chart(document.getElementById(chartId), {
        type: 'line',
        options: {
            responsive: true,
            aspectRatio: getAspectRatio(),
            elements: {
                point: {
                    radius: 0
                }
            },
            plugins: {
                legend: {
                    labels: {
                        sort: getLegendSorting()
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
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
                    ticks: {
                        stepSize: 500
                    },
                    grid: getGridStyle()
                }
            }
        }
    });

    await updateTodayData(todayDate)

}

async function updateTodayData(date) {
    // disable buttons and add placeholder while loading charts
    const chartId = 'todayChart';
    enableButtons('today', false)
    addPlaceholder(document.getElementById(chartId).parentElement)

    // gather data
    const types = ['balkon', 'dach', 'verbrauchReal', 'bezugReal', 'einspeisung', 'bezug']
    const data = {
        labels: [],
        datasets:
            (await Promise.all(
                types.map(async (type) => {
                        return getTimeDatasetObject(type, await getData(type, date))
                    }
                )))
    };
    // update chart
    let chart = Chart.getChart(chartId);
    if (chart.data.datasets.length > 0) {
        // correctly set visible/hidden labels
        range(chart.data.datasets.length - 1).forEach(i => data.datasets[i].hidden = !chart._metasets[i].visible)
    }
    chart.data = data;
    chart.options.scales.x.min = `${date} 06:00`
    chart.options.scales.x.max = `${date} 22:00`
    chart.update('none'); // no animation

    // update placeholders
    removePlaceholder(document.getElementById(chartId).parentElement)
    // update statistics
    document.querySelector(`#todayData #headline`)
        .innerText = date === getDay(0) ?
        "Heute" : date === getDay(-1) ?
            "Gestern" : formatDate(new Date(date), 'month-day');
    document.getElementById('todayPicker').value = todayDate;
    types.forEach(
        type =>
            overwritePlaceHolder(
                'todayData',
                type,
                integrateData(data.datasets[types.indexOf(type)].data), 'kWh'
            )
    )
    // enable buttons
    enableButtons('today', true)
}

async function updateToday(which) {
    // disable buttons
    enableButtons('today', false)

    // compute desired date
    const nextDate = (which === 'picker') ?
        document.getElementById('todayPicker').value :
        getDay((which === 'prev') ? -1 : +1, 'iso', new Date(todayDate));

    if (nextDate !== todayDate && new Date(nextDate).getTime() <= new Date().getTime()) {
        // update if required
        await updateTodayData(nextDate)
        todayDate = nextDate;
    }
    document.getElementById('todayPicker').value = todayDate

    // enable buttons
    enableButtons('today', true)
}

// Week Chart ---

async function showWeekChart() {
    logSection('[CHART] Showing Week..')

    // plot chat
    const chartId = 'weekChart'
    new Chart(document.getElementById(chartId), {
        type: 'line',
        options: {
            responsive: true,
            aspectRatio: getAspectRatio('tall'),
            elements: {
                point: {
                    radius: 0
                }
            },
            plugins: {
                zoom: {
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
                        onZoom: ({chart}) => {
                            updateWeekData(chart.scales.x.min, chart.scales.x.max)
                        }
                    },
                    pan: {
                        enabled: true,
                        mode: 'x',
                        onPan: ({chart}) => {
                            updateWeekData(chart.scales.x.min, chart.scales.x.max)
                        }
                    },
                    limits: {
                        x: {max: getEndOfDate(new Date())}
                    }
                },
                legend: {
                    labels: {
                        sort: getLegendSorting()
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    max: `${getDay(0)} 23:59:59`,
                    time: {
                        unit: "day",
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        callback: (value) => formatDate(new Date(value), "month-day")
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'W'
                    },
                    ticks: {
                        stepSize: 500
                    },
                    grid: getGridStyle()
                }
            }
        }
    });
    await updateWeekData(getDay(-3), getDay(0))

}

async function updateWeekData(dateFrom, dateTo) {
    const chartId = 'weekChart'
    const types = ['balkon', 'dach', 'verbrauchReal', 'bezugReal', 'einspeisung', 'bezug']

    // gather dates
    dateFrom = new Date(dateFrom)
    dateTo = new Date(dateTo)
    const dateArray = getDateArray(dateFrom, dateTo)

    // gather data
    const data = {
        labels: [],
        datasets:
            await Promise.all(
                types.map(async (type) => {
                        return getTimeDatasetObject(
                            type,
                            await Promise.all(dateArray.map(date => getData(type, formatDate(date))))
                                .then(results => results.flat()))
                    }
                )
            )
    };

    let chart = Chart.getChart(chartId);
    if (chart.data.datasets.length > 0) {
        // correctly set visible/hidden labels
        range(chart.data.datasets.length - 1).forEach(i => data.datasets[i].hidden = !chart._metasets[i].visible)
    }
    chart.data = data;
    chart.update('none'); // no animation

    // update placeholders
    removePlaceholder(document.getElementById(chartId).parentElement)
    // update statistics
    document.querySelector('#weekData #headline').innerText = `${dateArray.length} Tage`
    types.forEach(
        type =>
            overwritePlaceHolder(
                'weekData',
                type,
                integrateData(data.datasets[types.indexOf(type)].data), 'kWh'
            )
    )
}

// Month Chart ---

async function showMonthData() {
    logSection('[CHART] Showing Month..')
    const N = 30;
    const days = range(-(N - 1), 0);

    // plot chart
    const chartId = 'monthChart';
    new Chart(document.getElementById(chartId), {
            type: 'bar',
            options: {
                responsive: true,
                aspectRatio: getAspectRatio('tall'),
                scales: {
                    x: {
                        type: 'time',
                        max: `${getDay(0)} 00:00`,
                        time: {
                            unit: "day",
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            callback: (value) => formatDate(new Date(value), "month-day")
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'kWh'
                        },
                        grid: getGridStyle()
                    }
                },
                plugins: {
                    zoom: {
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
                            onZoom: ({chart}) => {
                                updateMonthData(chart.scales.x.min, chart.scales.x.max)
                            }
                        },
                        pan: {
                            enabled: true,
                            mode: 'x',
                            onPan: ({chart}) => {
                                updateMonthData(chart.scales.x.min, chart.scales.x.max)
                            }
                        },
                        limits: {
                            x: {max: getEndOfDate(new Date())}
                        }
                    },
                    legend: {
                        labels: {
                            sort: getLegendSorting()
                        }
                    }
                }
            }
        }
    )
    await updateMonthData(getDay(-29), getDay(1))
}

async function updateMonthData(dateFrom, dateTo) {
    const chartId = 'monthChart'
    const types = ['balkon', 'dach', 'verbrauchReal', 'bezugReal', 'einspeisung', 'bezug']

    // gather dates
    dateFrom = new Date(dateFrom)
    dateTo = new Date(dateTo)
    const dateArray = getDateArray(dateFrom, dateTo)

    const data = {
        labels: [],
        datasets:
            await Promise.all(types.map(async type =>
                getTimeDatasetObject(type,
                    (await Promise.all(dateArray.map(date => getData(type, formatDate(date)))))
                        .map(data_i => {
                            return {x: `${formatDate(new Date(data_i[data_i.length - 1].x))} 00:00`, y: integrateData(data_i)}
                        })
                ))
            )
    };

    let chart = Chart.getChart(chartId);
    if (chart.data.datasets.length > 0) {
        // correctly set visible/hidden labels
        range(chart.data.datasets.length - 1).forEach(i => data.datasets[i].hidden = !chart._metasets[i].visible)
    }
    chart.data = data;
    chart.update('none'); // no animation

    // update placeholders
    removePlaceholder(document.getElementById(chartId).parentElement)
    // update statistics
    document.querySelector('#monthData #headline').innerText = `${dateArray.length} Tage`
    types.forEach(
        type =>
            overwritePlaceHolder(
                'monthData',
                type,
                (data.datasets[types.indexOf(type)].data).reduce((acc, data_i) => acc + data_i.y, 0),
                'kWh'
            )
    )
}

// Show Charts ---

async function showCharts() {
    // disable all buttons
    enableButtons('all', false)

    // set chart defaults
    Chart.defaults.font.size = 16;
    Chart.defaults.font.family = 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue","Noto Sans","Liberation Sans",Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'
    Chart.defaults.font.weight = 400
    Chart.defaults.font.lineHeight = 1.5

    logSection('[CHART] Starting..')                     // Start:
    getCredentials()                                          // 1. Credentials
        .then(value => showLiveChart()                 // 2. Live
            .then(value => showTodayChart()             // 3. Today
                .then(value => showWeekChart()          // 4. Week
                    .then(value => showMonthData()      // 5. Month
                        .then(value => {                // Done!
                            logSection('[CHART] Completed.')
                            logSection('')
                        }))
                )
            )
        )
}

showCharts()


