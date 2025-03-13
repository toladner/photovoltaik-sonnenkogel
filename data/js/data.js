const DATA = {dach: {}, balkon: {}, verbrauch: {}, verbrauchReal: {}, bezugReal: {}, einspeisung: {}, bezug: {}}

async function sleep(ms) {
    await new Promise(r => setTimeout(r, ms));
}

function getRequest(type, requestDay) {
    return (["balkon", "einspeisung", "bezugReal"].indexOf(type) > -1) ? requestDay : requestDay.substring(0, 7);
}

function isDataRetrieved(type, requestDay) {
    return getRequest(type, requestDay) in DATA[type];
}

async function isDataAvailable(type, requestDay) {
    // build request
    let request = getRequest(type, requestDay)

    // wait until data is available
    while (!(DATA[type][request].available)) {
        console.log(`[DATA] ${type} (${request}) - Awaiting availability..`)
        await sleep(1000)
    }
}

function getNearestBalkonData(data, timestamp) {
    // Return 0 if the data array is empty
    if (!data || data.length === 0) {
        return 0;
    }

    // Clean and prepare data
    const cleanData = data.map(item => ({
        x: new Date(item.x),
        y: parseFloat(item.y)
    })).sort((a, b) => a.x - b.x);

    // Convert target timestamp to Date object
    const targetTime = new Date(timestamp);

    // Define the grace period (31 minutes in milliseconds)
    const gracePeriod = 31 * 60 * 1000;

    // Handle timestamps before earliest data point
    if (targetTime < cleanData[0].x) {
        const timeDiff = cleanData[0].x - targetTime;

        // If within grace period, return first value
        if (timeDiff <= gracePeriod) {
            return cleanData[0].y;
        } else {
            // If outside grace period, return 0
            return 0;
        }
    }

    // Handle timestamps after latest data point
    if (targetTime > cleanData[cleanData.length - 1].x) {
        const timeDiff = targetTime - cleanData[cleanData.length - 1].x;

        // If within grace period, return last value
        if (timeDiff <= gracePeriod) {
            return cleanData[cleanData.length - 1].y;
        } else {
            // If outside grace period, return 0
            return 0;
        }
    }

    // Find the two data points to interpolate between
    let beforeIndex = 0;
    for (let i = 0; i < cleanData.length - 1; i++) {
        if (targetTime >= cleanData[i].x && targetTime <= cleanData[i + 1].x) {
            beforeIndex = i;
            break;
        }
    }

    const before = cleanData[beforeIndex];
    const after = cleanData[beforeIndex + 1];

    // If exact match, return the exact value
    if (targetTime.getTime() === before.x.getTime()) {
        return before.y;
    }
    if (targetTime.getTime() === after.x.getTime()) {
        return after.y;
    }

    // Calculate time difference in milliseconds
    const timeDiff = after.x.getTime() - before.x.getTime();
    const targetDiff = targetTime.getTime() - before.x.getTime();

    // Calculate interpolation factor (0 to 1)
    const factor = targetDiff / timeDiff;

    // Perform linear interpolation
    const interpolatedValue = before.y + factor * (after.y - before.y);

    return interpolatedValue;
}

async function getData(type, requestDay) {
    // check if data is available
    if (isDataRetrieved(type, requestDay)) {
        // wait for data to become available
        await isDataAvailable(type, requestDay)

        // return requested data
        return DATA[type][requestDay].value;
    }

    console.log(`[DATA] ${type} (${requestDay}) - Requesting data..`)

    // retrieve data
    if (type === "balkon") {
        // make requested day unavailable
        DATA[type][requestDay] = {available: false};
        // retrieve balkon data
        const rawData = await retrieveDataBalkon(requestDay)
        // save data
        DATA[type][requestDay] = {value: rawData, available: true};

    } else if (type === "einspeisung") {
        // make requested day unavailable
        DATA[type][requestDay] = {available: false};
        // request bezug data
        const bezugData = await getData('bezug', requestDay)
        // only count negative numbers
        const rawData = bezugData.map(data_i => {
            return {x: data_i.x, y: -Math.min(0, data_i.y)}
        })
        // save data
        DATA[type][requestDay] = {value: rawData, available: true};

    } else if (type === "bezugReal") {
        // make requested day unavailable
        DATA[type][requestDay] = {available: false};
        // request bezug data
        const bezugData = await getData('bezug', requestDay)
        // only count negative numbers
        const rawData = bezugData.map(data_i => {
            return {x: data_i.x, y: Math.max(0, data_i.y)}
        })
        // save data
        DATA[type][requestDay] = {value: rawData, available: true};
    } else if (type === "verbrauchReal") {// make requested day unavailable
        // make requested day unavailable
        DATA[type][requestDay] = {available: false};
        // request all required data data
        const verbrauchData = await getData('bezug', requestDay)
        const dachData = await getData('dach', requestDay)
        const balkonData = await getData('balkon', requestDay)

        // compute real verbrauch
        const rawData = range(verbrauchData.length-1)
            .map(i => {return {
                x: verbrauchData[i].x,
                y: dachData[i].y + getNearestBalkonData(balkonData, verbrauchData[i].x) + verbrauchData[i].y
            }})
        // save data
        DATA[type][requestDay] = {value: rawData, available: true};

    } else {
        // make requested day/month unavailable
        const requestMonth = requestDay.substring(0, 7);
        const types = ["dach", "bezug", "verbrauch"]
        for (let i = 0; i < types.length; i++) {
            DATA[types[i]][requestMonth] = {available: false};
        }
        // retrieve data
        const rawData = await retrieveDataDach(requestMonth);
        // store retrieved data in DATA
        types.forEach(type => {
            // gather data per day
            const entries = rawData[type]
            Object.keys(entries)
                // filter not-requested days (e.g., '2025-01-01 00:00:00' for requested '2024-12')
                .filter(day_i => day_i.includes(requestMonth))
                // save each day
                .forEach((day_i) => DATA[type][day_i] = {value: entries[day_i]})
            DATA[type][requestMonth] = {available: true};
        })
    }

    return DATA[type][requestDay].value
}

function getDummyData(requestDate) {
    return [{x: `${formatDate(requestDate)} 00:00`, y: 0}]
}

async function retrieveDataBalkon(requestDay) {
    // only available from 2024-12-16
    const firstDate = new Date('2024-12-16')
    const requestDate = new Date(requestDay)
    if (firstDate.getTime() > requestDate.getTime()) {
        return getDummyData(requestDate)
    }

    // init
    const credentials = await getCredentials()
    const statusId = updateStatus(`Loading ${requestDay}..`)

    const response = await fetchRetry("https://neapi.hoymiles.com/pvm-report/api/0/station/report/select_power_by_station", {
        method: "POST",
        body: JSON.stringify({
            sid_list: [7446940],
            sid: 7446940,
            start_date: requestDay,
            end_date: requestDay,
            page: 1,
            page_size: 100
        }),
        headers: {
            "Content-type": "application/json; charset=UTF-8",
            "authorization": credentials.smile.token
        }
    })
    const json = await response.json();
    let rawData = json.data[0].data_list.map(element => {
        return {
            x: `${requestDay} ${element.date}`,
            y: element.pv_power
        }
    })
    if (rawData.length === 0) {
        rawData = getDummyData(requestDate)
    }

    deleteStatus(statusId)
    return rawData
}

async function retrieveDataDach(requestMonth) {
    // init
    const credentials = await getCredentials()
    const statusId = updateStatus(`Loading ${requestMonth}..`)

    // call dns
    const responseDNS = await fetchRetry("https://dns.loxonecloud.com/504F94A0FD08", {redirect: 'follow'})

    // fetch data from real url
    const url = `${responseDNS.url}stats/18cefec1-017c-47f3-ffffed57184a04d2.${requestMonth.replace('-', '')}.xml`
    const headers = new Headers({
        'Authorization': `Basic ${btoa(`${credentials.loxone.username}:${credentials.loxone.password}`)}`
    });
    const response = await fetchRetry(url, {headers: headers});
    const xmlText = await response.text()

    // init data struct
    const rawData = {dach: {}, verbrauch: {}, bezug: {}}

    // parse xml
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml").children[0];

    // iterate through all entries
    for (let i = 0; i < xmlDoc.children.length; i++) {
        //read current entry
        const entry = xmlDoc.children[i];
        const T = entry.attributes["T"].nodeValue;
        const date = T.substring(0, 10)

        // init structure if necessary
        if (!(date in rawData["dach"])) {
            rawData["dach"][date] = [];
            rawData["verbrauch"][date] = [];
            rawData["bezug"][date] = [];
        }

        // append entry
        rawData["dach"][date].push({x: T, y: parseFloat(entry.attributes["V"].nodeValue) * 1000})
        rawData["verbrauch"][date].push({x: T, y: parseFloat(entry.attributes["V2"].nodeValue) * 1000})
        rawData["bezug"][date].push({x: T, y: parseFloat(entry.attributes["V3"].nodeValue) * 1000})
    }

    deleteStatus(statusId)
    return rawData
}

async function getLastData(type) {
    const data = await getData(type, getDay(0));
    return data[data.length - 1]
}

function integrateData(data) {
    // init area
    let area = 0;

    // iterate over all data points
    for (let i = 0; i < data.length - 1; i++) {
        // extract data
        const xDate = new Date(data[i].x);
        const y = data[i].y;
        const x1Date = new Date(data[i + 1].x);
        const y1 = data[i + 1].y;

        // compute difference in hours
        const dx = (x1Date.getTime() - xDate.getTime()) / (1000 * 60 * 60)

        // ignore data points with too large distances...
        if (dx <= 2) {
            // compute area of trapezoid
            const darea = (parseInt(y) + parseInt(y1)) * dx / 2 / 1000
            // add to result
            area += darea
        }
    }

    return area
}