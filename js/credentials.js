async function getCredentials() {

    // retrieve credentials if not available
    if (!("available" in credentials)) {
        credentials.available = false;
        console.log("[Credentials] Retrieving..")

        // build paste from parameter
        const params = new URLSearchParams(new URL(window.location.href).search);
        const pasteid = params.get('pasteid');
        const url = `https://pastebin.com/raw/${pasteid}`;

        // fetch credentials
        fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
            .then(response => {
                if (response.ok) return response.json()
                throw new Error('Network response was not ok.')
            })
            .then(data => {
                credentials.value = JSON.parse(data.contents)
                credentials.available = true;
                console.log("[Credentials] Retrieved.")
            })
        return
    }

    // wait until available
    console.log("[Credentials] Waiting..")
    while (!credentials.available) {
        await sleep(100)
    }

    // return credentials
    return credentials.value;
}

// init credentials
const credentials = {}
// initial call to make credentials available
getCredentials()



