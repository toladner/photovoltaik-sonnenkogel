async function getCredentials() {

    // retrieve credentials if not available
    if (!("available" in credentials)) {
        // initializing credentials
        credentials.available = false;

        // get encrypted credentials
        console.log("[CREDENTIALS] Retrieving..")
        const statusId = updateStatus("Login..")
        const response = await fetchRetry('./data/credentials/credentials.encrypted');
        const encryptedCreds = await response.text();

        // read key
        console.log(`[CREDENTIALS] Decrypting..`)
        const params = new URLSearchParams(new URL(window.location.href).search);
        const key = params.get('pasteid');

        // test encryption
        // const responsePlain = await fetchRetry('./js/data/credentials.raw');
        // const plainCreds = await responsePlain.text();
        // const encryptedTemp = await CryptoJS.AES.encrypt(plainCreds, key);
        // console.log(encryptedTemp.toString())

        // decrypt credentials
        const decryptedCreds = await CryptoJS.AES.decrypt(encryptedCreds, key);
        let value = decryptedCreds.toString(CryptoJS.enc.Utf8)
        value = JSON.parse(value);

        // save credentials
        credentials.value = value;

        // obtain s-mile token
        console.log('[CREDENTIALS] Obtaining s-mile token..')
        const responseSmile = await fetchRetry(
            "https://neapi.hoymiles.com/iam/pub/0/auth/login",
            {
                headers: {'Content-Type': 'application/json;charset=UTF-8'},
                method: "POST", body: JSON.stringify({
                    user_name: credentials.value.smile.username,
                    password: credentials.value.smile.password
                })
            }
        )
        const jsonSmile = await responseSmile.json()
        credentials.value.smile.token = jsonSmile.data.token

        // finish
        credentials.available = true;
        deleteStatus(statusId)
        console.log(`[CREDENTIALS] Initialized.`)
    }

    // wait until available
    while (!credentials.available) {
        console.log("[CREDENTIALS] Waiting..")
        await sleep(100)
    }

    // return credentials
    return credentials.value;
}

// init credentials
const credentials = {}



