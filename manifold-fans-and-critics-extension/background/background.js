EXTENSION_PREFIX = 'manifold-fans-and-critics-extension_';
PERM_MARKETS_KEY = EXTENSION_PREFIX + 'perm-markets';
USERNAME_TO_TO_POSITIONS_KEY = EXTENSION_PREFIX + 'user-to-markets';
PLACES_TO_SHOW_KEY = EXTENSION_PREFIX + 'places-to-show';
UPDATE_NOW_KEY = EXTENSION_PREFIX + 'update-now';
TIME_OF_LAST_UPDATE_KEY = EXTENSION_PREFIX + 'time-of-last-update';
TIME_OF_LAST_PAGE_LOAD_KEY = EXTENSION_PREFIX + 'time-of-last-page-load';
BACKGROUND_HEARTBEAT_KEY = EXTENSION_PREFIX + 'background-heartbeat';
RELOAD_AFTER_SECONDS = 10 * 60; // 10 minutes

NECESSARY_MARKET_KEYS = ['url', 'fanString'];

LOAD_STATUS_KEY = EXTENSION_PREFIX + 'load-status';

PERMANENT_GROUP_ID = '2T4mM0N5az2lYcaN5G50';
FETCH_MARKETS_URL = 'https://manifold.markets/api/v0/group/by-id/' + PERMANENT_GROUP_ID + '/markets';
FETCH_POSITIONS_URL = 'https://manifold.markets/api/v0/market/ID/positions';

const TOP_SPOTS_TO_LOAD = 5; // This is for data processing, not for displaying. It should be greater than or equal to the max of places-to-show slider in popup.js

console.log("Starting background");

// Receive message to restart the background script if it's not running:
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.message === "restart-background-script") {
            console.log("Restarting background");
            chrome.runtime.reload();
        }
    }
);


let running = false
store(BACKGROUND_HEARTBEAT_KEY, Date.now());

setInterval(async () => {
    // Set a heartbeat so that we can tell if the background script is running
    store(BACKGROUND_HEARTBEAT_KEY, Date.now());

    if (running) {
        return;
    }
    console.log("locking");
    running = true;

    fillInMissingData()
        .then(() => {
            running = false
            console.log("Finished. unlocking");
        })
        .catch((err) => {
            console.log(err);
            running = false;
            console.log("Error: unlocking");
        });
}, 10 * 1000);


async function fillInMissingData() {
    console.log("Checking our stored data");

    // Check if last page load was more than 1 minute ago
    var timeOfLastPageLoad = await get(TIME_OF_LAST_PAGE_LOAD_KEY);
    if (!timeOfLastPageLoad || (Date.now() - timeOfLastPageLoad) > 1000 * 60 * 10) {
        console.log("User is not active on Manifold, not updating");
        store(LOAD_STATUS_KEY, {
            percent: 1.0,
            display: "inline-block",
            message: "Will not sync while user is not active on Manifold"});
            return;
    }


    var permMarkets = await getJson(PERM_MARKETS_KEY);
    var userNameToTopPositions = await getJson(USERNAME_TO_TO_POSITIONS_KEY);


    // Check if update-now is set, or if time of last update is more than 1 hour ago
    var timeOfLastUpdate = await get(TIME_OF_LAST_UPDATE_KEY);
    var updateNow = await get(UPDATE_NOW_KEY);

    if (updateNow || !timeOfLastUpdate || (Date.now() - timeOfLastUpdate) > 1000 * RELOAD_AFTER_SECONDS) {
        // Invalidate the variables, but not the storage
        permMarkets = null;
        userNameToTopPositions = null;
        store(UPDATE_NOW_KEY, false); // Message received, reset the flag
    }

    if (!permMarkets) {
        console.log('Perm markets not found in storage, fetching from API...');
        permMarkets = await reloadMarkets();
    }
    if (permMarkets && !userNameToTopPositions) {
        await buildUserNameToTopPositions(TOP_SPOTS_TO_LOAD, permMarkets);
    }
    else if (permMarkets && userNameToTopPositions) {
        // Update status to done
        store(LOAD_STATUS_KEY, {
            percent: 1.0,
            display: "inline-block",
            message: ""});
    }
}

async function store(key, value) {
    await browser.storage.local.set({ [key]: value }).then(() => { });
}

async function get(key) {
    const result = await browser.storage.local.get(key);
    return result[key];
}

async function getJson(key) {
    var string = await get(key);
    if (string) {
        return JSON.parse(string);
    } else {
        return null;
    }
}

function getPositionsUrl(marketId) {
    return FETCH_POSITIONS_URL.replace('ID', marketId);
}

function insertSorted(array, position, key) {
    for (var i = 0; i < array.length; i++) {
        if (position.totalShares[key] > array[i].totalShares[key]) {
            array.splice(i, 0, position);
            array.pop(); // Don't allow the array to increase in size
            return;
        }
    }
}

async function buildUserNameToTopPositions(spots, permMarkets) {
    console.log('Building username to top positions...');
    console.log(permMarkets);
    const userNameToTopPositions = {};
    const directions = ['YES', 'NO'];

    // Loop through each key in the permMarkets object with a standard for loop to accomodate async/await. This is not an array!
    const market_ids = Object.keys(permMarkets);
    for (var m = 0; m < market_ids.length; m++) {
        const market_id = market_ids[m];
        const market = permMarkets[market_id];
        if (m % 10 == 0) {
            store(LOAD_STATUS_KEY, {
                percent: m / market_ids.length,
                display: "inline-block",
                message: "Fetching data for " + m + "/" + market_ids.length + " permanent markets"});
            console.log("Fetching positions for market " + m + "/" + market_ids.length + ": " + market.fanString);
        }

        var best = { YES: [], NO: [] };
        for (var i = 0; i < spots; i++) {
            // Initialize position.totalShares.YES and position.totalShares.NO to 0
            best.YES.push({ totalShares: { YES: 0 } });
            best.NO.push({ totalShares: { NO: 0 } });
        }

        // Wait for the response before continuing
        const positionsResponse = await fetch(getPositionsUrl(market_id));

        // Wait for the response to be parsed before continuing
        const positions = await positionsResponse.json();

        positions.forEach((position) => {
            directions.forEach((direction) => {
                // Check if the position has more shares than the lowest position in the best array
                if (best[direction][spots - 1].totalShares[direction] < position.totalShares[direction]) {
                    insertSorted(best[direction], position, direction);
                }
            });
        });

        // Now we have the top positions for each side of the market
        // Add these top users to the userNameToTopPositions object
        directions.forEach((direction) => {
            // Loop through best[direction], and also keep track of the index with i
            best[direction].forEach((position, i) => {
                userNameToTopPositions[position.userUsername] = userNameToTopPositions[position.userUsername] || [];
                userNameToTopPositions[position.userUsername].push({
                    marketId: market_id,
                    place: i + 1,
                    direction: direction
                });
            });
        });
    };

    // For each key in userNameToTopPositions, sort the array by direction and then place
    console.log("Sorting positions for each username...");
    Object.keys(userNameToTopPositions).forEach((username) => {
        userNameToTopPositions[username].sort((a, b) => {
            if (a.direction == b.direction) {
                return a.place - b.place;
            } else if (a.direction == 'YES') {
                return -1;
            } else {
                return 1;
            }
        });
    });

    //save userNameToTopPositions to local storage
    console.log("Saving positions to local storage.");
    store(USERNAME_TO_TO_POSITIONS_KEY, JSON.stringify(userNameToTopPositions));


    // Update status to done
    store(LOAD_STATUS_KEY, {
        percent: 1.0,
        display: "inline-block",
        message: market_ids.length + " markets updated."});
    // Update time-of-last-update to now
    store(TIME_OF_LAST_UPDATE_KEY, new Date().getTime());
    // Don't update again until the user clicks the button again
    store(UPDATE_NOW_KEY, false);
}

//function to reload all market data
async function reloadMarkets() {
    console.log('reloadMarkets()');
    // Get the full list of markets, sifting through them for the permanent binary ones
    permMarkets = {};

    const marketResponse = await fetch(FETCH_MARKETS_URL);

    // Wait for the response to be parsed before continuing
    const markets = await marketResponse.json();

    markets.forEach((market) => {
        // Only binary markets
        if (market.outcomeType !== 'BINARY') {
            return;
        }

        // Only still open markets
        if (market.isResolved) {
            return;
        }

        // Only markets with permanent in the question
        // if (!market.question.includes('(Permanent)') && !market.question.includes('[Permanent]')) {
        //     return;
        // }

        // Set fanstring to be the market question without words in parentheses, and without words like "stock"
        let ma = market.question.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').replace(/stock/gi, '').trim();
        market.fanString = ma;

        // Check if each key is in the list of keys to keep (save id to use for the key)
        var market_id = market.id;
        for (var key in market) {
            if (!NECESSARY_MARKET_KEYS.includes(key)) {
                delete market[key];
            }
        }

        // Append market to permMarkets
        permMarkets[market_id] = market;
    });

    var storageString = JSON.stringify(permMarkets);
    console.log('Size of permMarkets going into storage: ' + storageString.length);
    await store(PERM_MARKETS_KEY, storageString);

    return permMarkets;
}