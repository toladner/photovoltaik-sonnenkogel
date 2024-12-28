
// init statusManager
statusManager = {maxId: 0, currId: 0, queuedIds: {}}

function updateStatus(status, id=statusManager.maxId+1) {
    // save status
    statusManager.queuedIds[id] = status
    statusManager.currId = id;
    statusManager.maxId = Math.max(id, statusManager.maxId)

    // display status
    const spinner = "<div class=\"spinner-grow spinner-grow-sm\" role=\"status\"><span class=\"visually-hidden\">Loading...</span></div>"
    document.getElementById('status').innerHTML = `${status}&emsp;${spinner}`

    return id
}

function deleteStatus(id) {
    // delete id
    delete statusManager.queuedIds[id]

    // check if status needs to be updated
    if (id === statusManager.currId) {
        const ids = Object.keys(statusManager.queuedIds);
        if (ids.length === 0) {
            // reset status
            statusManager.currId = 0;
            document.getElementById('status').innerText = ""
        } else {
            const nextId = parseInt(ids[ids.length-1])
            updateStatus(statusManager.queuedIds[nextId], nextId)
        }
    }
}

function logSection(text) {
    console.log(`----\n${text}`)
}
