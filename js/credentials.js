async function getCredentials() {

    // retrieve credentials if not available
    if (!("available" in credentials)) {
        // initializing credentials
        credentials.available = false;
        console.log("[Credentials] Retrieving..")

        // get encrypted credentials
        const response = await fetch('./js/data/credentials.encrypted');
        const encryptedCreds = await response.text();

        // read key
        const params = new URLSearchParams(new URL(window.location.href).search);
        const key = params.get('pasteid');

        // test encryption
        // const encryptedTemp = await CryptoJS.AES.encrypt(plain, key);
        // console.log(encryptedTemp.toString(CryptoJS.enc.Utf8))

        // decrypt credentials
        const decryptedCreds = await CryptoJS.AES.decrypt(encryptedCreds, key);
        const value = decryptedCreds.toString(CryptoJS.enc.Utf8)

        // save credentials
        credentials.value = JSON.parse(value);
        credentials.available = true;
    }

    // wait until available
    while (!credentials.available) {
        console.log("[Credentials] Waiting..")
        await sleep(100)
    }

    // return credentials
    return credentials.value;
}

// init credentials
const credentials = {}
// initial call to make credentials available
getCredentials()



