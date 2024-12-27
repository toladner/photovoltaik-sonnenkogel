
// SETTINGS -------------------------------------------------------------------

const plotData = {
    dach: {name: 'Dach', color: '#4CAF50', hidden: false},
    balkon: {name: 'Balkon', color: '#CDDC39', hidden: false},
    verbrauch: {name: 'Verbrauch', color: '#F44336', hidden: true},
    bezug: {name: 'Bezug', color: '#9C27B0', hidden: true},
    alpha: '70'
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
    const dataset = getBasicDatasetObject(type,data)
    dataset.fill = 'origin'
    dataset.hidden = plotData[type].hidden
    return dataset
}

// CHARTS ---------------------------------------------------------------------

// Live Chart
async function showLiveChart() {

    const lastDach = await getLastData('dach')
    const lastBalkon = await getLastData('balkon')
    const lastBezug = await getLastData('bezug')
    const lastVerbrauch = await getLastData('verbrauch')

    const data = {
        labels: ["Produktion", "Verbrauch"],
        datasets: [
            getBasicDatasetObject('dach', [lastDach.y, 0]),
            getBasicDatasetObject('balkon', [lastBalkon.y, 0]),
            getBasicDatasetObject('verbrauch', [0,lastVerbrauch.y]),
        ]
    };
    new Chart(document.getElementById('liveChart'), {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
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
            }
        }
    });
    document.getElementById('liveChartSpinner').hidden = true;
}
showLiveChart();

// Today Chart
async function showTodayChart() {
    const types = ['balkon', 'dach','verbrauch','bezug']

    const data = {
        labels: [],
        datasets:
            await Promise.all(
                types.map(async (type) => {
                        return getTimeDatasetObject(type, await getData(type, getDay(0)))
                    }
                ))
    };
    new Chart(document.getElementById('todayChart'), {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            elements: {
                point: {
                    radius: 0
                }
            },
            plugins: {
                tooltip: {
                    mode: 'x',
                    intersect: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    min: getDay(0),
                    max: getDay(1),
                    ticks: {stepSize: 2},
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
    document.getElementById('todayChartSpinner').hidden = true;
}
showTodayChart();

// Week Chart
async function showWeekChart() {
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
    new Chart(document.getElementById('weekChart'), {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            elements: {
                point: {
                    radius: 0
                }
            },
            plugins: {
                tooltip: {
                    mode: 'x',
                    intersect: false
                }
            },
            scales: {
                x: {
                    type: 'time',
                    min: getDay(-6),
                    max: getDay(1),
                    time: {
                        unit: "day",
                        displayFormats: {
                            day: 'dd. MMM'
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
    document.getElementById('weekChartSpinner').hidden = true;
}
showWeekChart();