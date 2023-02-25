const EXTENSION_PREFIX = 'manifold-fans-and-critics-extension_';
const PERM_MARKETS_KEY = EXTENSION_PREFIX + 'perm-markets';
const USERNAME_TO_TO_POSITIONS_KEY = EXTENSION_PREFIX + 'user-to-markets';

// Log the current URL
console.log('Current page URL:', window.location.href);

// const fetchMarketsUrl = 'https://manifold.markets/api/v0/markets?limit=1000';
const permanentGroupID = '2T4mM0N5az2lYcaN5G50';
const fetchMarketsUrl = 'https://manifold.markets/api/v0/group/by-id/' + permanentGroupID + '/markets';
const topSpotCount = 5;
const necessaryMarketKeys = ['url', 'fanString'];

// The template for fetchPositionsUrl takes a market id
const fetchPositionsUrl = 'https://manifold.markets/api/v0/market/ID/positions';

// Listen for clicks on the nav with aria-label="Tabs", and replace the images when it is clicked
document.querySelector('[aria-label="Tabs"]').addEventListener('click', () => {
  // Wait for the page to load
  setTimeout(() => {
    replaceImages();
  }, 250);
});

// This is needed to call async functions from the top level of the content script
(async () => {
  permMarkets = JSON.parse(localStorage.getItem(PERM_MARKETS_KEY));

  if (!permMarkets) {
    console.log('Perm markets not found in local storage, fetching from API...');
    permMarkets = await reloadMarkets();
  }
  if (permMarkets && !localStorage.getItem(USERNAME_TO_TO_POSITIONS_KEY)) {
    await buildUserNameToTopPositions(topSpotCount, permMarkets);
  }

  replaceImages();
  console.log('Extension done!');
  console.log(permMarkets);
  console.log(JSON.parse(localStorage.getItem(USERNAME_TO_TO_POSITIONS_KEY)));
})();


function replaceImages() {
  console.log("Replacing images...");

  // Select all images with the "example-class" class
  const images = document.querySelectorAll('.my-0');

  // Loop through each image and add an overlay icon
  images.forEach((image) => {
    // Get the alt text on the image, and remove the word avatar from the end
    const imageUsername = image.alt.replace('avatar', '').trim();

    // Load userNameToTopPositions from local storage
    const userNameToTopPositions = JSON.parse(localStorage.getItem(USERNAME_TO_TO_POSITIONS_KEY));
    const permMarkets = JSON.parse(localStorage.getItem(PERM_MARKETS_KEY));

    // Skip if the username is not in userNameToTopPositions
    if (!userNameToTopPositions[imageUsername]) {
      return;
    }

    // Skip if the image has already been replaced
    if (image.classList.contains('replaced-by-extension')) {
      return;
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
    wrapper.appendChild(hoverText);

    iconDiv.addEventListener('mouseover', () => {
      hoverText.style.display = 'block';
    });

    iconDiv.addEventListener('mouseleave', () => {
      hoverText.style.display = 'none';
    });

    // add event listeners to the market info div to keep it displayed when the user hovers over it
    hoverText.addEventListener('mouseenter', () => {
      hoverText.style.display = 'block';
    });
    hoverText.addEventListener('mouseleave', () => {
      hoverText.style.display = 'none';
    });

    // prevent the event from bubbling up to the parent img element
    hoverText.addEventListener('mouseover', (event) => {
      event.stopPropagation();
    });

    userNameToTopPositions[imageUsername].forEach((position) => {
      // Create a new link to this market
      const link = document.createElement('a');
      link.href = permMarkets[position.marketId].url;
      link.target = '_blank';
      link.textContent = permMarkets[position.marketId].fanString + " #" + position.place +" ";
      if (position.direction == 'YES') {
        link.textContent += 'Fan!';
      } else {
        link.textContent += 'Critic';
      }

      // Add the link to the hover text
      hoverText.appendChild(link);

      // Separate each link with a newline
      const newline = document.createElement('br');
      hoverText.appendChild(newline);
    });
  });
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
  console.log(userNameToTopPositions);

  //save userNameToTopPositions to local storage
  localStorage.setItem(USERNAME_TO_TO_POSITIONS_KEY, JSON.stringify(userNameToTopPositions));
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
  localStorage.setItem(PERM_MARKETS_KEY, storageString);

  return permMarkets;
}
