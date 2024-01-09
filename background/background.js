EXTENSION_PREFIX = 'manifans-extension_';

FULL_RELOAD_AFTER_SECONDS = 30 * 60; // 30 minutes
MARKET_FETCH_BATCH_SIZE = 20;
DIRECTIONS = ['YES', 'NO'];
TOP_SPOTS_TO_LOAD = 5; // This is for data processing, not for displaying. It should be greater than or equal to the max of places-to-show slider in popup.js
ALLOWED_OUTCOME_TYPES = ['BINARY', 'STONK'];

MARKET_MAP_KEY = EXTENSION_PREFIX + 'market-map';
USERNAME_TO_POSITIONS_KEY = EXTENSION_PREFIX + 'user-to-markets';
PLACES_TO_SHOW_KEY = EXTENSION_PREFIX + 'places-to-show';
UPDATE_NOW_KEY = EXTENSION_PREFIX + 'update-now';
TIME_OF_LAST_UPDATE_KEY = EXTENSION_PREFIX + 'time-of-last-update';
TIME_OF_LAST_PAGE_LOAD_KEY = EXTENSION_PREFIX + 'time-of-last-page-load';
BACKGROUND_HEARTBEAT_KEY = EXTENSION_PREFIX + 'background-heartbeat';
LOAD_STATUS_KEY = EXTENSION_PREFIX + 'load-status';
LAST_BET_ID_KEY = EXTENSION_PREFIX + 'last-bet-id';
IGNORE_DESTINY_KEY = EXTENSION_PREFIX + 'ignore-destiny';

NECESSARY_MARKET_KEYS = ['url', 'displayStrings', 'totalLiquidity'];

PERMANENT_GROUP_ID = '2T4mM0N5az2lYcaN5G50';
MARKETS_IN_GROUP_URL = 'https://api.manifold.markets/v0/group/by-id/ID/markets';
MANIFANS_GROUP_ID = '3cpr3RrU1ZCe19JQGIRK';
FETCH_POSITIONS_URL = 'https://api.manifold.markets/v0/market/ID/positions?order=shares&top=' + TOP_SPOTS_TO_LOAD + '&bottom=' + TOP_SPOTS_TO_LOAD;
FETCH_MARKET_DESCRIPTION_URL = 'https://api.manifold.markets/v0/market/ID';
FETCH_BETS_URL = 'https://api.manifold.markets/v0/bets';

RELEVANT_GROUPS = [
    '3cpr3RrU1ZCe19JQGIRK', // manifold.markets/group/manifans
    '2T4mM0N5az2lYcaN5G50', // manifold.markets/group/permanent
    'jhtvaP3PHXY6RPIiMd8A', // manifold.markets/group/destinygg-stocks
]

DESTINY_GROUPS = [
    'W2ES30fRo6CCbPNwMTTj', // manifold.markets/group/destinygg
    'jhtvaP3PHXY6RPIiMd8A', // manifold.markets/group/destinygg-stocks
]


// Use chrome in chrome, and browser in firefox
var chrome = chrome;
try {
    chrome = browser;
    console.log("Switched to browser from chrome");
} catch (err) { }


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

backgroundLoop();
setInterval(async () => {
    backgroundLoop();
}, 5 * 1000);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function backgroundLoop() {
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
}


async function fillInMissingData() {
    console.log("Checking our stored data");

    // Check if last page load was more than 1 minute ago
    var timeOfLastPageLoad = await get(TIME_OF_LAST_PAGE_LOAD_KEY);
    // Also, if we have never synced, we'll go ahead and sync
    if (timeOfLastPageLoad && (Date.now() - timeOfLastPageLoad) > 1000 * 60 * 10) {
        console.log("User is not active on Manifold, not updating");
        store(LOAD_STATUS_KEY, {
            percent: 1.0,
            display: "inline-block",
            message: "Sync inactive while not browsing Manifold"});
            return;
    }


    var marketMap = await getJson(MARKET_MAP_KEY);
    var userNameToTopPositions = await getJson(USERNAME_TO_POSITIONS_KEY);
    // Check for empty userNameToTopPositions
    if (userNameToTopPositions && Object.keys(userNameToTopPositions).length === 0) {
        userNameToTopPositions = null;
    }


    // Check if update-now is set, or if time of last update is more than 1 hour ago
    var timeOfLastUpdate = await get(TIME_OF_LAST_UPDATE_KEY);
    var updateNow = await get(UPDATE_NOW_KEY);
    var lastBetId = await get(LAST_BET_ID_KEY);

    var secondsSinceUpdate = (Date.now() - timeOfLastUpdate) / 1000;

    if (marketMap && Object.keys(marketMap).length == 0) {
        marketMap = null;
    }

    // Been a long time or never, so do full update
    if (updateNow || !timeOfLastUpdate || secondsSinceUpdate > FULL_RELOAD_AFTER_SECONDS) {
        // Invalidate the variables, but not the storage
        marketMap = null;
        userNameToTopPositions = null;
        store(UPDATE_NOW_KEY, false); // Message received, reset the flag (no need to wait)
    } else if (marketMap && userNameToTopPositions && lastBetId) {
        // Do a partial update based on bets placed since last update
        var newBets;
        // console.log("fetching bets since " + lastBetId);
        newBets = await fetchBetsSince(lastBetId);
        if (!newBets) {
            console.log("Couldn't connect up bets, wiping cached data to do full reload");
            marketMap = null;
            userNameToTopPositions = null;
            store(UPDATE_NOW_KEY, false); // Message received, reset the flag (no need to wait)
        } else if (newBets && newBets[0]) {
            console.log("Found " + newBets.length + " new bets since " + lastBetId);
            // Store the new latest bet id (no need to wait)
            store(LAST_BET_ID_KEY, newBets[0].id);
            marketIds = getChangedMarketIdsFromBets(newBets, marketMap);
            if (marketIds && marketIds.length > 0) {
                // Sleep 10 seconds to allow the API to catch up
                console.log("Sleeping 10 seconds to allow API to catch up");
                await sleep(10 * 1000);
                await buildUserNameToTopPositions(TOP_SPOTS_TO_LOAD, marketMap, userNameToTopPositions, marketIds);
                console.log("Sleeping 20 more seconds to allow API to catch up");
                await sleep(20 * 1000);
                await buildUserNameToTopPositions(TOP_SPOTS_TO_LOAD, marketMap, userNameToTopPositions, marketIds);
            }
        }
    }

    if (!marketMap) {
        console.log('Perm markets not found in storage, fetching from API...');
        marketMap = await reloadMarkets();
    }
    if (marketMap && !userNameToTopPositions) {
        console.log('Perm user positions not found in storage, fetching from API...');
        latestBets = await fetchBets(1);
        // Store the new latest bet id (no need to wait)
        store(LAST_BET_ID_KEY, latestBets[0].id);

        await buildUserNameToTopPositions(TOP_SPOTS_TO_LOAD, marketMap);
    }
    else if (marketMap && userNameToTopPositions) {
        // Update status to done (no need to wait)
        if (!updateNow) {
            store(LOAD_STATUS_KEY, {
                percent: 1.0,
                display: "inline-block",
                message: Object.keys(marketMap).length + " markets, " + Object.keys(userNameToTopPositions).length + " users"});
        }
    }
}

async function store(key, value) {
    await chrome.storage.local.set({ [key]: value }).then(() => { });
}

async function get(key) {
    const result = await chrome.storage.local.get(key);
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

function getMarketDescriptionUrl(marketId) {
    return FETCH_MARKET_DESCRIPTION_URL.replace('ID', marketId);
}

function getChangedMarketIdsFromBets(bets, marketMap) {
    var marketIds = [];
    bets.forEach((bet) => {
        // It's in the market map, and isn't yet in marketIds
        if (marketMap[bet.contractId] && marketIds.indexOf(bet.contractId) === -1) {
            marketIds.push(bet.contractId);
        }
    });
    return marketIds;
}

async function retryFetch(url) {
    var retries = 0;
    var maxRetries = 5;
    var response;
    while (retries < maxRetries) {
        // Catch errors and check for error responses
        try {
            response = await fetch(url);
            if (response.ok) {
                break;
            } else {
                console.warn("Error fetching " + url + ": " + response.status + " " + response.statusText);
            }
        } catch (error) {
            console.warn("Error fetching " + url + ": " + error);
        }

        retries++;
        if (retries == maxRetries) {
            console.warn("Failed to fetch " + url + " after " + maxRetries + " retries");
            return null;
        }

        // Sleep for increasing amounts of time between retries (1, 4, 9, 16, etc seconds)
        var sleepTime = retries*retries;
        console.log("Sleeping " + sleepTime + " seconds before retrying fetch of " + url);
        await sleep(sleepTime * 1000);
        console.log("Retrying fetch of " + url + " (retry " + retries + ")");
    }

    return response;
}

async function fetchBets(count, beforeId=false) {
    // console.log("Fetching " + count + " bets before " + beforeId);
    var url = FETCH_BETS_URL;
    url += '?limit=' + count;
    if (beforeId) {
        url += '&before=' + beforeId;
    }
    const betsResponse = await retryFetch(url);
    const bets = await betsResponse.json();
    return bets;
}

async function fetchBetsSince(sinceId) {
    var bets = [];
    var lastBetId = false;
    var limitAmounts = [100,1000]; // Try 100 bets to start, then 1000 bets
    for (var l = 0; l < limitAmounts.length; l++) {
        var newBets = await fetchBets(limitAmounts[l], lastBetId);
        // Iterate newBets with for loop so we can break out of the loop
        for (var i = 0; i < newBets.length; i++) {
            var bet = newBets[i];
            if (bet.id == sinceId) {
                // console.log("Found bet " + sinceId + " in new bets");
                return bets;
            }
            bets.push(bet);
        }
        console.log("Couldn't find bet " + sinceId + " in " + newBets.length + " bets");
        lastBetId = newBets[newBets.length - 1].id;
    }
    console.log("Giving up on finding bet " + sinceId);

    // If we didn't find the bet, return null (We'll have to do a full update)
    return null;
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

async function partialUpdate(marketMap, userNameToTopPositions) {
    // Keep track of marketids in marketMap to update
    var marketIdsToUpdate = [];

    // Fetch bets from API
    const betsResponse = await retryFetch(FETCH_BETS_URL);
    const bets = await betsResponse.json();
    bets.forEach((bet) => {
        if (bet.contract_id in marketMap) {
            marketIdsToUpdate.push(bet.contract_id);
        }
    });
}

async function getTopUsersInMarket(market_id, spots, userNameToTopPositions, marketMap, ensureNoDuplicates = false) {
    // console.log("Fetching positions for market " + market_id);
    const market = marketMap[market_id];

    var best = { YES: [], NO: [] };
    for (var i = 0; i < spots; i++) {
        // Initialize position.totalShares.YES and position.totalShares.NO to 0
        best.YES.push({ totalShares: { YES: 0 } });
        best.NO.push({ totalShares: { NO: 0 } });
    }

    // Wait for the response before continuing
    const positionsResponse = await retryFetch(getPositionsUrl(market_id));

    // Wait for the response to be parsed before continuing
    var positions = await positionsResponse.json();

    // Filter out positions where hasShares=false. This is necessary because
    // trace numbers of shares could be left that manifold doesn't count or
    // display.
    positions = positions.filter((position) => {
        return position.hasShares;
    });

    positions.forEach((position) => {
        DIRECTIONS.forEach((direction) => {
            if (best[direction][spots - 1].totalShares[direction] < position.totalShares[direction]) {
                insertSorted(best[direction], position, direction);
            }
        });
    });

    // For each username in userNameToTopPositions, clear out entries with market_id
    if (ensureNoDuplicates) {
        // console.log("Ensuring no duplicates for market " + market_id);
        Object.keys(userNameToTopPositions).forEach((username) => {
            userNameToTopPositions[username] = userNameToTopPositions[username].filter((position) => {
                if (position.marketId == market_id) {
                    // console.log("Removing duplicate position for " + username + " in market " + market_id);
                }
                return position.marketId != market_id;
            });
        });
    }

    // Now we have the top positions for each side of the market
    // Add these top users to the userNameToTopPositions object
    DIRECTIONS.forEach((direction) => {
        // Loop through best[direction], and also keep track of the index with i
        best[direction].forEach((position, i) => {
            userNameToTopPositions[position.userUsername] = userNameToTopPositions[position.userUsername] || [];
            userNameToTopPositions[position.userUsername].push({
                marketId: market_id,
                place: i + 1,
                direction: direction,
                totalLiquidity: market.totalLiquidity,
                shares: Math.round(position.totalShares[direction], 2),
            });
        });
    });
}

async function buildUserNameToTopPositions(spots, marketMap, useExistingUsernames=false, idsToUpdate=false) {
    console.log(marketMap);

    var userNameToTopPositions;
    if (useExistingUsernames) {
        userNameToTopPositions = useExistingUsernames;
        ensureNoDuplicates = true;
    } else {
        userNameToTopPositions = {};
        ensureNoDuplicates = false;
    }

    var market_ids;
    var ensureNoDuplicates;
    if (idsToUpdate) {
        market_ids = idsToUpdate;
    } else {
        market_ids = Object.keys(marketMap);
    }

    console.log('Building username to top positions for ' + market_ids.length + ' markets');

    for (var batch = 0; batch < market_ids.length; batch += MARKET_FETCH_BATCH_SIZE) {
        var batchedFetches = [];
        for (var m = 0; batch+m < market_ids.length && m < MARKET_FETCH_BATCH_SIZE; m++) {
            // Print warning if id isn't in marketMap
            if (!(market_ids[batch + m] in marketMap)) {
                console.warn("Market id " + market_ids[batch + m] + " not in marketMap");
                continue;
            }
            const market_id = market_ids[batch + m];
            batchedFetches.push(getTopUsersInMarket(market_id, spots, userNameToTopPositions, marketMap, ensureNoDuplicates));
        };
        console.log("Running batch " + batch + "/" + market_ids.length);
        if (batch % 5 == 0) {
            store(LOAD_STATUS_KEY, {
                percent: batch / market_ids.length,
                display: "inline-block",
                message: "Syncing market data (" + batch + "/" + market_ids.length + ")"});
        }
        await Promise.all(batchedFetches);
    }

    // For each key in userNameToTopPositions, sort the array by direction and then place
    console.log("Sorting positions for each username...");
    Object.keys(userNameToTopPositions).forEach((username) => {
        userNameToTopPositions[username].sort((a, b) => {
            if (a.direction == b.direction) {
                return (a.place - b.place) * 10000 + b.totalLiquidity - a.totalLiquidity;
            } else if (a.direction == 'YES') {
                return -1;
            } else {
                return 1;
            }
        });
    });

    //save userNameToTopPositions to local storage
    console.log("Saving positions to local storage.");
    store(USERNAME_TO_POSITIONS_KEY, JSON.stringify(userNameToTopPositions));

    // If this was a full update
    if (!idsToUpdate) {
        // Update time-of-last-update to now
        store(TIME_OF_LAST_UPDATE_KEY, new Date().getTime());
        // Don't update again until the user clicks the button again
        store(UPDATE_NOW_KEY, false);
    }
}

function getMarketsInGroupUrl(group_id) {
    // Replace ID in MARKETS_IN_GROUP_URL
    return MARKETS_IN_GROUP_URL.replace('ID', group_id);
}

//function to reload all market data
async function reloadMarkets() {
    console.log('reloadMarkets()');
    // Get the full list of markets, sifting through them for the permanent binary ones
    var markets = {};
    var i = 0;

    // Use for loop to loop over relevant groups
    for (var g = 0; g < RELEVANT_GROUPS.length; g++) {
        const group_id = RELEVANT_GROUPS[g];
        const marketResponse = await retryFetch(getMarketsInGroupUrl(group_id));
        // Wait for the response to be parsed before continuing
        var groupMarkets = await marketResponse.json();
        console.log(groupMarkets);

        groupMarkets.forEach((market) => {
            // If the market isn't already in the map, add it
            if (!(market.id in markets)) {
                i++;
                markets[market.id] = market;
                // If g==0, this is the first group, so add a special flag to these markets
                if (g == 0) {
                    market.markedManifans = true;
                }
            }
        });
    };
    console.log("Fetched " + i + " markets from relevant groups");

    // If destiny markets are being ignored, fetch those market ids and exclude them
    ignore_destiny_markets = await get(IGNORE_DESTINY_KEY);
    if (ignore_destiny_markets) {
        i = 0;
        console.log("Ignoring destiny markets");
        for (var g = 0; g < DESTINY_GROUPS.length; g++) {
            const group_id = DESTINY_GROUPS[g];
            const destinyMarketResponse = await retryFetch(getMarketsInGroupUrl(group_id));
            const destiny_markets = await destinyMarketResponse.json();
            destiny_markets.forEach((market) => {
                if (market.id in markets) {
                    i++;
                    delete markets[market.id];
                }
            });
        }
        console.log("Deleted " + i + " destiny markets");
    }

    console.log(markets);


    var marketMap = {};

    // Loop over the keys in markets
    for (const market_id in markets) {
        // console.log("Processing market " + market_id)
        const market = markets[market_id];

        // Only markets in the allowed outcome types
        if (!ALLOWED_OUTCOME_TYPES.includes(market.outcomeType)) {
            continue;
        }

        // Only still open markets
        if (market.isResolved) {
            continue;
        }

        // market.textDescription is only available with an additional API call,
        // so only do it if the market is in the Manifans group
        if (market.markedManifans) {
            // Fetch market description data from the API
            const marketDescriptionResponse = await retryFetch(getMarketDescriptionUrl(market.id));
            // Wait for the response to be parsed before continuing
            const marketDescription = await marketDescriptionResponse.json();
            market.textDescription = marketDescription.textDescription;
        }

        // Set displayStrings to be the market question without words in parentheses or braces
        let subject = market.question.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();

        var removed = true;

        for (var r = 0; r < 10; r++) {
            removed = false;

            // Replace the last instance of the word "stock" with nothing
            if (subject.match(/stock/i)) {
                subject = subject.replace(/stock$/i, '');
                subject = subject.trim();
                removed = true;
            }

            // If the market question ends with "index" in any case, remove it
            if (subject.match(/index$/i)) {
                subject = subject.replace(/index$/i, '');
                subject = subject.trim();
                removed = true;
            }

            // If the market question ends with "permanent" in any case, remove it
            if (subject.match(/permanent$/i)) {
                subject = subject.replace(/permanent$/i, '');
                subject = subject.trim();
                removed = true;
            }

            // If the market ends with a word with only non-alphanumeric characters, remove it
            if (subject.match(/ \W+$/)) {
                subject = subject.replace(/ \W+$/, '');
                subject = subject.trim();
                removed = true;
            }

            // Remove trailing periods, commas, colons, and semicolons
            if (subject.match(/[\.,:;]$/)) {
                subject = subject.replace(/[\.,:;]$/, '');
                subject = subject.trim();
                removed = true;
            }

            if (!removed) {
                break;
            }
        }

        // Special case ;)
        if (market.question == "Permanent Stock stock [permanent]") {
            subject = "Permanent Stock";
        }

        // Load from description if specified, (Note from above that the
        // textDescription isn't always available)
        subject = extractFromDescription("subject", market.textDescription, 20) || subject

        // If length of subject is 0 or too long, skip this market
        if (subject.length == 0 || subject.length > 40) {
            console.log("Skipping market " + market.question + " because subject is " + subject + " (" + subject.length + " characters)");
            continue;
        }

        subject += "'s";

        market.displayStrings = {
            subject: subject,
            fan: extractFromDescription("fan", market.textDescription, 15) || "Fan!",
            critic: extractFromDescription("critic", market.textDescription, 15) || "Critic"
        };

        // Check if each key is in the list of keys to keep (save id to use for the key)
        for (var key in market) {
            if (!NECESSARY_MARKET_KEYS.includes(key)) {
                delete market[key];
            }
        }

        // Append market to marketMap, (don't have to worry about duplicates because we're using a map)
        marketMap[market_id] = market;
    }

    var storageString = JSON.stringify(marketMap);
    console.log('Size of marketMap going into storage: ' + storageString.length);
    await store(MARKET_MAP_KEY, storageString);

    return marketMap;
}

function extractFromDescription(key, description, maxLength) {
    if (!description) {
        return null;
    }
    // If the description is
    // "\n\nsubject: Tri-omni God\n\nfan: Believer\n\ncritic: Skeptic\n\n", and
    // the key is "critic", then this function will return "Skeptic" (Each key
    // value pair must be by itself between \n's, or the start or end of the
    // string. The key is not case sensitive.)
    var regex = new RegExp("(\\n|^)" + key + ":\\s*(.*?)\\s*(\\n|$)", "i");

    var match = description.match(regex);
    if (match) {
        var value = match[2];
        console.log("Found " + key + " in description: " + value);
        return value.substring(0, maxLength);
    }
    return null;
}
