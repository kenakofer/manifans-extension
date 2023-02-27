// TODO how do I avoid defining these in multiple places?
EXTENSION_PREFIX = 'manifans-extension_';
PERM_MARKETS_KEY = EXTENSION_PREFIX + 'perm-markets';
USERNAME_TO_TO_POSITIONS_KEY = EXTENSION_PREFIX + 'user-to-markets';
PLACES_TO_SHOW_KEY = EXTENSION_PREFIX + 'places-to-show';
UPDATE_NOW_KEY = EXTENSION_PREFIX + 'update-now';
TIME_OF_LAST_UPDATE_KEY = EXTENSION_PREFIX + 'time-of-last-update';
BACKGROUND_HEARTBEAT_KEY = EXTENSION_PREFIX + 'background-heartbeat';

LOAD_STATUS_KEY = EXTENSION_PREFIX + 'load-status';

// Use chrome in chrome, and browser in firefox
var chrome = chrome;
try {
    chrome = browser;
    console.log("Switched to browser from chrome");
} catch (err) { }

checkIfBackgroundNeedsRestarted();
// Check if background script needs restarted when popup is opened
async function checkIfBackgroundNeedsRestarted() {
    var lastHeartbeat = get(BACKGROUND_HEARTBEAT_KEY);
    if (!lastHeartbeat || Date.now() - lastHeartbeat > 60 * 1000) {
        console.log('Background heartbeat is old! Attempting to restart background...');
        chrome.runtime.sendMessage({message: 'restart-background-script'});
    }
}

// Places to show slider
document.querySelector('#places-to-show').addEventListener('input', async() => {
    const value = document.querySelector('#places-to-show').value;
    document.querySelector('#places-to-show-value').innerHTML = value;
    await store(PLACES_TO_SHOW_KEY, value);
    console.log(PLACES_TO_SHOW_KEY + ": " + value);
});

// Button to update
document.querySelector('#update-button').addEventListener('click', () => {
    store(UPDATE_NOW_KEY, true);
    document.querySelector('#load-status-label').innerHTML = 'Getting ready to sync...';
    // Also store in LOAD_STATUS_KEY
    store(LOAD_STATUS_KEY, {
        percent: 0,
        display: 'block',
        message: 'Getting ready to sync...'
    });
});

// Set the load-status progress bar from storage every 2 seconds
setLoadStatusFromStorage();
setInterval(setLoadStatusFromStorage, 2000);
async function setLoadStatusFromStorage() {
    result = await get(LOAD_STATUS_KEY);
    if (result) {
        document.querySelector('#load-status-inner-bar').style.width = Math.round(result.percent * 100) + '%';
        document.querySelector('#load-status-outer-bar').style.display = result.display;
        document.querySelector('#load-status-label').innerHTML = result.message;
    }
}

setLastSyncFromStorage();
setInterval(setLastSyncFromStorage, 10 * 1000);
async function setLastSyncFromStorage() {
    result = await get(TIME_OF_LAST_UPDATE_KEY);
    if (result) {
        // Display in minutes
        const minutes = Math.round((Date.now() - result) / 1000 / 60);
        document.querySelector('#last-synced-time').innerHTML = minutes + ' minutes ago';
    } else {
        document.querySelector('#last-synced-time').innerHTML = 'never';
    }
}


// Every 2 seconds, run setSliderValueFromStorage
setSliderValueFromStorage();
setInterval(setSliderValueFromStorage, 2000);
async function setSliderValueFromStorage() {
    result = await get(PLACES_TO_SHOW_KEY);
    if (result) {
        console.log('placesToShow loading at ' + result);
        document.querySelector('#places-to-show').value = result;
        document.querySelector('#places-to-show-value').innerHTML = result;
    }
}


async function store(key, value) {
  await chrome.storage.local.set({[key]: value}).then(() => {});
}

async function get(key) {
  const result = await chrome.storage.local.get(key);
  if (!result) {
    return null;
  }
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
