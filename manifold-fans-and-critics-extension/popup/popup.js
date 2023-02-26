// TODO how do I avoid defining these in multiple places?
EXTENSION_PREFIX = 'manifold-fans-and-critics-extension_';
PERM_MARKETS_KEY = EXTENSION_PREFIX + 'perm-markets';
USERNAME_TO_TO_POSITIONS_KEY = EXTENSION_PREFIX + 'user-to-markets';
PLACES_TO_SHOW_KEY = EXTENSION_PREFIX + 'places-to-show';

// On load, run this async
document.addEventListener('DOMContentLoaded', async () => {

    setSliderValueFromStorage();

    // button to clear this extension's values from local storage
    // document.querySelector('#clear-button').addEventListener('click', () => {
    //     let total = 0;
    //     // Loop through all items in storage and remove those that are for this extension
    //     for (let i = 0; i < localStorage.length; i++) {
    //         const key = localStorage.key(i);
    //         if (key.startsWith(EXTENSION_PREFIX)) {
    //         let length = localStorage.getItem(key).length;
    //         localStorage.removeItem(key);
    //         console.log("Removed " + key + " (" + length + " bytes)");
    //         total += length;
    //         }
    //     }


    //     alert('All cached extension data cleared! (' + total + ' bytes)');
    // });


    // Places to show slider
    document.querySelector('#places-to-show').addEventListener('input', async() => {
        const value = document.querySelector('#places-to-show').value;
        document.querySelector('#places-to-show-value').innerHTML = value;
        await store(PLACES_TO_SHOW_KEY, value);
        console.log(PLACES_TO_SHOW_KEY + ": " + value);
    });
});

// Every 2 seconds, run setSliderValueFromStorage
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
  await browser.storage.local.set({[key]: value}).then(() => {});
}

async function get(key) {
  const result = await browser.storage.local.get(key);
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
