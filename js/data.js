const DATA = {dach: {}, balkon: {}, verbrauch: {}, bezug: {}}

async function sleep(ms) {
    await new Promise(r => setTimeout(r, ms));
}

function isDataRetrieved(type, requestDay) {
    let request = type === "balkon" ? requestDay : requestDay.substring(0, 7);
    return request in DATA[type];
}

async function isDataAvailable(type, requestDay) {
    // build request
    let request = type === "balkon" ? requestDay : requestDay.substring(0, 7);

    // wait until data is available
    while (!(DATA[type][request].available)) {
        console.log(`[${type}][${request}] Awaiting availability..`)
        await sleep(250)
    }
}

async function getData(type, requestDay) {
    // check if data is available
    if (isDataRetrieved(type, requestDay)) {
        // wait for data to become available
        await isDataAvailable(type, requestDay)

        // return requested data
        return DATA[type][requestDay].value;
    }

    // setup lock to ensure single requests
    console.log(`[${type}][${requestDay}] Requesting data..`)
    DATA[type] = {};

    // retrieve data
    if (type === "balkon") {
        // make requested day unavailable
        DATA[type][requestDay] = {available: false};
        // retrieve balkon data
        const rawData = await retrieveDataBalkon(requestDay)
        // save data
        DATA[type][requestDay] = {value: rawData, available: true};

    } else {
        const types = ["dach", "bezug", "verbrauch"]
        // make requested day/month unavailable
        const requestMonth = requestDay.substring(0, 7);
        for (let i = 0; i < types.length; i++) {
            DATA[types[i]][requestMonth] = {available: false};
        }
        // retrieve data
        rawData = await retrieveDataDach(requestMonth);
        // store retrieved data in DATA
        for (let i = 0; i < types.length; i++) {
            entries = rawData[types[i]]
            Object.keys(entries).forEach((key) => DATA[types[i]][key] = {value: entries[key]})
            DATA[types[i]][requestMonth] = {available: true};
        }
    }

    console.log(`[${type}][${requestDay}] Successful!`)
    return DATA[type][requestDay].value
}

async function retrieveDataBalkon(requestDay) {
    const credentials = await getCredentials()

    const response = await fetch("https://neapi.hoymiles.com/pvm-report/api/0/station/report/select_power_by_station", {
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
    return json.data[0].data_list.map(element => {
        return {
            x: `${requestDay} ${element.date}`,
            y: element.pv_power
        }
    })
}

async function retrieveDataDach(requestMonth) {
    // read xml
    const credentials = await getCredentials()
    const headers = new Headers({
        'Authorization': `Basic ${btoa(`${credentials.loxone.username}:${credentials.loxone.password}`)}`
    });

    // call dns
    const responseDNS = await fetch("https://dns.loxonecloud.com/504F94A0FD08", {redirect: 'follow'})

    // fetch data from real url
    const url = `${responseDNS.url}stats/18cefec1-017c-47f3-ffffed57184a04d2.${requestMonth.replace('-','')}.xml`
    const response = await fetch(url, {headers: headers});
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

    return rawData
}

function getDay(dayAgo) {
    // Get today's date
    const today = new Date();

    // compute other day
    const otherDay = new Date(today);
    otherDay.setDate(today.getDate() + dayAgo);
    return otherDay.toISOString().slice(0, 10);
}

async function getLastData(type) {
    let data = await getData(type, getDay(0));
    return data[data.length - 1]
}