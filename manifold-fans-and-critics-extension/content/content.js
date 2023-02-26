EXTENSION_PREFIX = 'manifold-fans-and-critics-extension_';
PERM_MARKETS_KEY = EXTENSION_PREFIX + 'perm-markets';
USERNAME_TO_TO_POSITIONS_KEY = EXTENSION_PREFIX + 'user-to-markets';
PLACES_TO_SHOW_KEY = EXTENSION_PREFIX + 'places-to-show';

const permanentGroupID = '2T4mM0N5az2lYcaN5G50';
const fetchMarketsUrl = 'https://manifold.markets/api/v0/group/by-id/' + permanentGroupID + '/markets';
const topSpotCount = 5; // This is for data processing, not for displaying. It should be greater than or equal to the max of places-to-show slider in popup.js
const necessaryMarketKeys = ['url', 'fanString'];

// The template for fetchPositionsUrl takes a market id
const fetchPositionsUrl = 'https://manifold.markets/api/v0/market/ID/positions';


// Listen for clicks on the nav with aria-label="Tabs", and replace the images when it is clicked
document.addEventListener('DOMContentLoaded', async () => {
  document.querySelector('[aria-label="Tabs"]').addEventListener('click', () => {
    // Wait for the tab to load
    setTimeout(() => {
      replaceImages();
    }, 250);
  });
});

// Listen for changes to the local storage for places-to-show every few seconds
var cachedPlacesToShow;
setInterval( async () => {
  const placesToShow = await get(PLACES_TO_SHOW_KEY);
  if (placesToShow && placesToShow !== cachedPlacesToShow) {
    cachedPlacesToShow = placesToShow;
    replaceImages();
  }
}, 2000);

// This is needed to call async functions from the top level of the content script
(async () => {
  var permMarkets = await getJson(PERM_MARKETS_KEY);
  if (!permMarkets) {
    console.log('Perm markets not found in storage, fetching from API...');
    permMarkets = await reloadMarkets();
  }
  var userNameToTopPositions = await getJson(USERNAME_TO_TO_POSITIONS_KEY);
  if (permMarkets && !userNameToTopPositions) {
    await buildUserNameToTopPositions(topSpotCount, permMarkets);
    replaceImages();
  }
  console.log('Extension done!');
  console.log(permMarkets);
  console.log(await getJson(USERNAME_TO_TO_POSITIONS_KEY));
})();



async function store(key, value) {
  await browser.storage.local.set({[key]: value}).then(() => {});
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

// Replace the images once the page has loaded
window.onload = () => {
  replaceImages();
};
document.addEventListener('DOMContentLoaded', async () => {
  replaceImages();
});

async function replaceImages() {
  console.log("Replacing images...");


  // Load userNameToTopPositions from local storage
  const userNameToTopPositions = await getJson(USERNAME_TO_TO_POSITIONS_KEY);
  const permMarkets = await getJson(PERM_MARKETS_KEY);
  const placesToShow = await get(PLACES_TO_SHOW_KEY);

  // Select all images with the "my-0" class that are not a child of a div with "group" class
  const images = document.querySelectorAll('.my-0:not(.group img.my-0)');

  // Loop through each image using an async function:
  for (let i = 0; i < images.length; i++) {
    const image = images[i];

    // Get the alt text on the image, and remove the word avatar from the end
    const imageUsername = image.alt.replace('avatar', '').trim();

    // Skip if the username is not in userNameToTopPositions
    if (!userNameToTopPositions[imageUsername]) {
      // console.log('Skipping image with username', imageUsername);
      continue;
    }

    // Skip if the image has already been replaced
    if (image.classList.contains('replaced-by-extension')) {
      // console.log('Skipping image with username', imageUsername, 'because it has already been replaced');
      continue;
    }
    image.classList.add('replaced-by-extension');


    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative'; // set position to relative to position the icon correctly
    image.parentNode.insertBefore(wrapper, image); // insert the wrapper before the image
    wrapper.appendChild(image); // move the image into the wrapper

    // Create a new element for the icon
    const iconDiv = document.createElement('div');
    iconDiv.classList.add('example-icon');
    wrapper.appendChild(iconDiv); // add the icon to the wrapper

    // Create a new element for the hover text
    const hoverText = document.createElement('div');
    hoverText.classList.add('example-hover-text');

    // Add the hover text to the wrapper
    wrapper.appendChild(hoverText);



    var criticSeparator = false;
    var yesEllided = 0;
    var noEllided = 0;
    var noEntries = 0;
    var yesEntries = 0;

    var yesEllipsis = null;
    var noEllipsis = null;

    userNameToTopPositions[imageUsername].forEach((position, i) => {
      if (position.place > placesToShow) {
        // console.log('Skipping position', position, 'because it is not in the top', placesToShow);
        return;
      }
      if (position.direction == 'YES') {
        if (position.place > 1 && yesEntries >= 10) {
          yesEllided++;
          // Create the ellipsis element if it doesn't exist
          if (!yesEllipsis) {
            yesEllipsis = document.createElement('span');
            yesEllipsis.classList.add('ellipsis');
            hoverText.appendChild(yesEllipsis);
          }
          yesEllipsis.textContent = ' +' + yesEllided + " more...";
          return;
        }
        yesEntries++;
      } else {
        if (position.place > 1 && noEntries >= 10) {
          noEllided++;
          // Create the ellipsis element if it doesn't exist
          if (!noEllipsis) {
            noEllipsis = document.createElement('span');
            noEllipsis.classList.add('ellipsis');
            hoverText.appendChild(noEllipsis);
          }
          noEllipsis.textContent = ' +' + noEllided + " more...";
          return;
        }
        noEntries++;
      }

      // Create a new link to this market
      const link = document.createElement('a');
      link.href = permMarkets[position.marketId].url;
      link.target = '_blank';
      // add the class fan-link
      link.classList.add('hover-link');
      link.textContent = permMarkets[position.marketId].fanString + " #" + position.place +" ";
      if (position.direction == 'YES') {
        link.textContent += 'Fan!';
        link.classList.add('fan-link');
        if (position.place == 1) {
          link.textContent = '🏆 ' + link.textContent;
        }
      } else {
        link.textContent += 'Critic';
        link.classList.add('critic-link');
        if (position.place == 1) {
          link.textContent = '🌶️ ' + link.textContent;
        }
      }
      if (position.direction != 'YES' && !criticSeparator) {
        criticSeparator = true;
        link.style.marginTop = '10px';
      }

      // Add the link to the hover text
      hoverText.appendChild(link);
    });

    // Hide the icon if there are no entries
    if (yesEntries + noEntries == 0) {
      console.log('Skipping image with username', imageUsername, 'because there are no entries after filtering');
      iconDiv.style.display = 'none';
      continue;
    }

    iconDiv.addEventListener('mouseover', () => {
      hoverText.style.display = 'block';
      hoverText.style.zIndex = '10000';
      iconDiv.style.zIndex = '10001';
    });

    iconDiv.addEventListener('mouseleave', () => {
      hoverText.style.display = 'none';
      hoverText.style.zIndex = '9998';
      iconDiv.style.zIndex = '9999';
    });

    // add event listeners to the market info div to keep it displayed when the user hovers over it
    hoverText.addEventListener('mouseenter', () => {
      hoverText.style.display = 'block';
      hoverText.style.zIndex = '10000';
      iconDiv.style.zIndex = '10001';
    });
    hoverText.addEventListener('mouseleave', () => {
      hoverText.style.display = 'none';
      hoverText.style.zIndex = '9998';
      iconDiv.style.zIndex = '9999';
    });

    // prevent the event from bubbling up to the parent img element
    hoverText.addEventListener('mouseover', (event) => {
      event.stopPropagation();
    });
  }
}


function getPositionsUrl(marketId) {
  return fetchPositionsUrl.replace('ID', marketId);
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
    console.log("Fetching positions for market " + m + "/" + market_ids.length + ": " + market.fanString);

    var best = {YES: [], NO: []};
    for (var i = 0; i < spots; i++) {
      // Initialize position.totalShares.YES and position.totalShares.NO to 0
      best.YES.push({totalShares: {YES: 0}});
      best.NO.push({totalShares: {NO: 0}});
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
}

// Insert a position into the best array, keeping the array sorted from highest to lowest
function insertSorted(array, position, key) {
  for (var i = 0; i < array.length; i++) {
    if (position.totalShares[key] > array[i].totalShares[key]) {
      array.splice(i, 0, position);
      array.pop();
      return;
    }
  }
}

//function to reload all market data
async function reloadMarkets() {
  console.log('reloadMarkets()');
  // Get the full list of markets, sifting through them for the permanent binary ones
  permMarkets = {};

  const marketResponse = await fetch(fetchMarketsUrl);

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
      if (!necessaryMarketKeys.includes(key)) {
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
