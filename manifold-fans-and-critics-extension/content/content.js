// Log the current URL
console.log('Current page URL:', window.location.href);

function replaceImages() {
  console.log("Replacing images...");

  // Select all images with the "example-class" class
  const images = document.querySelectorAll('.my-0');

  // Loop through each image and add an overlay icon
  images.forEach((image) => {
    // Get the alt text on the image, and remove the word avatar from the end
    const imageUsername = image.alt.replace('avatar', '').trim();

    // Load userToMarkets from local storage
    const userToMarkets = JSON.parse(localStorage.getItem(userToMarketsKey));

    // Skip if the username is not in userToMarkets
    if (!userToMarkets[imageUsername]) {
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

    userToMarkets[imageUsername].forEach((market) => {
      // Create a new link to this market
      const link = document.createElement('a');
      link.href = market.url;
      link.target = '_blank';
      link.textContent = market.fanString + " #1 Fan!";

      // Add the link to the hover text
      hoverText.appendChild(link);

      // Separate each link with a newline
      const newline = document.createElement('br');
      hoverText.appendChild(newline);
    });

    // hoverText.textContent = userToMarkets[imageUsername].map((market) => '<a href="https://google.com">' + market.fanString + " #1 Fan!</a>").join('\n');
    // hoverText.textContent = userToMarkets[imageUsername].map((market) => 'aoeu' + market.fanString + " #1 Fan!").join('\n');

    // Set the title to the name of all of this user's permanent markets
    // icon.setAttribute('title', userToMarkets[imageUsername].map((market) => market.fanString + " #1 Fan!").join('\n'));
  });
}

// const fetchMarketsUrl = 'https://manifold.markets/api/v0/markets?limit=1000';
const permanentGroupID = '2T4mM0N5az2lYcaN5G50';
const fetchMarketsUrl = 'https://manifold.markets/api/v0/group/by-id/' + permanentGroupID + '/markets';
const prefix = 'manifold-fans-and-critics-extension_';
const permMarketsKey = prefix + 'perm-markets';
const earliestMarketCheckedKey = prefix + 'earliest-market-id-checked';
const latestMarketCheckedKey = prefix + 'latest-market-id-checked';
const userToMarketsKey = prefix + 'user-to-markets';

var permMarkets = JSON.parse(localStorage.getItem(permMarketsKey));
earliestMarketChecked = localStorage.getItem(earliestMarketCheckedKey);
latestMarketChecked = localStorage.getItem(latestMarketCheckedKey);

if (!permMarkets) {
  reloadMarkets();
}

// Mapping from usernames to a list of permanent market ids they have created

if (permMarkets) {
  const userToMarkets = {};
  permMarkets.forEach((market) => {
    userToMarkets[market.creatorUsername] = userToMarkets[market.creatorUsername] || [];
    userToMarkets[market.creatorUsername].push(market);
  });
  //save userToMarkets to local storage
  localStorage.setItem(userToMarketsKey, JSON.stringify(userToMarkets));
}

replaceImages();

// Listen for clicks on the nav with aria-label="Tabs", and replace the images when it is clicked
document.querySelector('[aria-label="Tabs"]').addEventListener('click', () => {
  // Wait for the page to load
  setTimeout(() => {
    replaceImages();
  }, 250);
});


//function to reload all market data
function reloadMarkets() {
    // Get the full list of markets, sifting through them for the permanent binary ones
    permMarkets = [];

    fetch(fetchMarketsUrl)
    .then(response => response.json())
    .then(data => {
      latestMarketChecked = data[0].id;
      localStorage.setItem(latestMarketCheckedKey, latestMarketChecked);

      data.forEach((market) => {
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

          // Append market to permMarkets
          permMarkets.push(market);
      });
      localStorage.setItem(permMarketsKey, JSON.stringify(permMarkets));
    })
    .catch(error => console.error('Error fetching markets:', error));

}
