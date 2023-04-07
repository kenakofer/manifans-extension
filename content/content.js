EXTENSION_PREFIX = 'manifans-extension_';
MARKET_MAP_KEY = EXTENSION_PREFIX + 'market-map';
USERNAME_TO_POSITIONS_KEY = EXTENSION_PREFIX + 'user-to-markets';
PLACES_TO_SHOW_KEY = EXTENSION_PREFIX + 'places-to-show';
TIME_OF_LAST_PAGE_LOAD_KEY = EXTENSION_PREFIX + 'time-of-last-page-load';
BACKGROUND_HEARTBEAT_KEY = EXTENSION_PREFIX + 'background-heartbeat';

// Use chrome in chrome, and browser in firefox
var chrome = chrome;
try {
    chrome = browser;
} catch (err) { }

// Set time of last page load to now
store(TIME_OF_LAST_PAGE_LOAD_KEY, Date.now());


// Check if the background script heartbeat is older than 1 minute, and if so, restart it
setInterval( async () => {
  var lastHeartbeat = await get(BACKGROUND_HEARTBEAT_KEY);
  if (!lastHeartbeat || Date.now() - lastHeartbeat > 60 * 1000) {
    console.log('Background heartbeat is old! Attempting to restart background...');
    chrome.runtime.sendMessage({message: 'restart-background-script'});
  }
}, 30 * 1000);


// Listen for clicks on the FIRST nav with aria-label="Tabs", and replace the images when it is clicked
var tabs = document.querySelector('nav[aria-label="Tabs"]');
if (tabs) {
  tabs.addEventListener('click', replaceImagesDelayed);
}
setTimeout(() => {
  // Only grab the first nav with aria-label="Tabs"
  tabs = document.querySelector('nav[aria-label="Tabs"]');
  // On click
  if (tabs) {
    tabs.addEventListener('click', replaceImagesDelayed);
  }
}, 3000);

async function replaceImagesDelayed() {
  setTimeout(replaceImages, 250);
}


// For the first three second, replace the images every 250ms to catch everything ASAP
for (var i = 0; i < 12; i++) {
  setTimeout(replaceImages, i * 250);
}

// For when the Manifold UI resets everything randomly
var cachedPlacesToShow;
setInterval( async () => {
  // Listen for changes to the local storage for places-to-show
  var placesToShow = await get(PLACES_TO_SHOW_KEY);
  if (placesToShow && placesToShow !== cachedPlacesToShow) {
    cachedPlacesToShow = placesToShow;
  }
  replaceImagesIfNotHidden();
}, 3000);

async function store(key, value) {
  await chrome.storage.local.set({[key]: value}).then(() => {});
}

async function get(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key];
  } catch (err) {
    // reload the page
    window.location.reload();
    return null;
  }
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

async function replaceImagesIfNotHidden() {
  if (document.visibilityState === "hidden") {
    // console.log("Page is hidden, skipping replaceImages");
    return;
  }
  await replaceImages(true);
}

// Initalize hoverTextTables dictionary
var hoverTextTables = {};

function populateHoverTextTable(imageUsername, userNameToTopPositions, permMarkets, placesToShow, forceReload=false) {
  var hoverTextTable;

  if (hoverTextTables[imageUsername]) {
    hoverTextTable = hoverTextTables[imageUsername];
    if (!forceReload) {
      return hoverTextTable;
    }
    // Remove all children
    while (hoverTextTable.firstChild) {
      hoverTextTable.removeChild(hoverTextTable.firstChild);
    }
  } else {
    hoverTextTable = document.createElement('table');
    hoverTextTable.classList.add('example-hover-text');
    document.body.appendChild(hoverTextTable);
  }

  // We have a fresh, empty hoverTextTable

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
      if (yesEntries >= 10) {
        yesEllided++;
        // Create the ellipsis element if it doesn't exist
        if (!yesEllipsis) {
          yesEllipsis = document.createElement('span');
          yesEllipsis.classList.add('ellipsis');
          hoverTextTable.appendChild(yesEllipsis);
        }
        yesEllipsis.textContent = ' +' + yesEllided + " more...";
        yesEllipsis.appendChild
        return;
      }
      yesEntries++;
    } else {
      if (noEntries >= 10) {
        noEllided++;
        // Create the ellipsis element if it doesn't exist
        if (!noEllipsis) {
          noEllipsis = document.createElement('span');
          noEllipsis.classList.add('ellipsis');
          hoverTextTable.appendChild(noEllipsis);
        }
        noEllipsis.textContent = ' +' + noEllided + " more...";
        return;
      }
      noEntries++;
    }

    // Create a new link to this market
    const link = document.createElement('a');
    link.href = permMarkets[position.marketId].url;
    link.classList.add('hover-link');

    // Create a new row in the hover text
    const hoverTextRow = document.createElement('tr');
    const emojiColumn = document.createElement('td');
    const textColumn = document.createElement('td');
    link.appendChild(textColumn);
    hoverTextRow.classList.add('inherit-background');
    emojiColumn.classList.add('manifans-cell');
    textColumn.classList.add('manifans-cell');
    hoverTextRow.appendChild(emojiColumn);
    hoverTextRow.appendChild(textColumn);
    textColumn.appendChild(link);
    hoverTextTable.appendChild(hoverTextRow);

    // link.appendChild(emojiColumn);

    // hoverTextRow.appendChild(link);

    // link.target = '_blank'; // open in a new tab
    // add the class fan-link
    link.textContent = permMarkets[position.marketId].displayStrings.subject + " #" + position.place +" ";
    const imageDiv = document.createElement('div');
    imageDiv.classList.add('tiny-icon');
    emojiColumn.appendChild(imageDiv);

    if (position.direction == 'YES') {
      link.textContent += permMarkets[position.marketId].displayStrings.fan;
      link.classList.add('fan-link');
      if (position.place == 1) {
        imageDiv.classList.add('trophy-image');
      } else {
        imageDiv.classList.add('trophy-shadow-image');
      }
    } else {
      link.textContent += permMarkets[position.marketId].displayStrings.critic;
      link.classList.add('critic-link');
      if (position.place == 1) {
        imageDiv.classList.add('pepper-image');
      } else {
        imageDiv.classList.add('pepper-shadow-image');
      }
    }
    if (position.direction != 'YES' && !criticSeparator && yesEntries > 0) {
      criticSeparator = true;
      link.style.marginTop = '10px';
      emojiColumn.style.paddingTop = '10px';
    }
  });

  // Hide the icon if there are no entries
  if (yesEntries + noEntries == 0) {
    // console.log('Skipping image with username', imageUsername, 'because there are no entries after filtering');
    // iconDiv.style.display = 'none';
    return null;
  }



  hoverTextTables[imageUsername] = hoverTextTable;
  return hoverTextTable;
}


async function replaceImages(forceReload=false) {
  // console.log("Replacing images...");

  // Load userNameToTopPositions from local storage
  const userNameToTopPositions = await getJson(USERNAME_TO_POSITIONS_KEY);

  if (!userNameToTopPositions) {
    console.log('userNameToTopPositions is null (is it still syncing?), skipping replaceImages');
    return;
  }

  const permMarkets = await getJson(MARKET_MAP_KEY);

  var placesToShow = await get(PLACES_TO_SHOW_KEY);
  placesToShow = placesToShow ? placesToShow : 3; // Default slider value is 3

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

    // Find any parent divs with the "overflow-hidden" class and remove it
    var parent = image.parentNode;
    while (parent) {
      if (parent.classList && parent.classList.contains('overflow-hidden')) {
        parent.classList.remove('overflow-hidden');
        break; // Only remove one overflow-hidden class
      }
      parent = parent.parentNode;
    }

    // Check if the parent has the manifans-wrapper class already
    parent = image.parentNode;
    var wrapper;
    if (parent && parent.classList && parent.classList.contains('manifans-wrapper')) {
      wrapper = parent;
      // Delete all children with small-finger-icon or finger-icon class
      const children = wrapper.childNodes;
      for (let i = children.length - 1; i >= 0; i--) {
        if (children[i].classList && (children[i].classList.contains('small-finger-icon') || children[i].classList.contains('finger-icon'))) {
          wrapper.removeChild(children[i]);
        }
      }
    } else {
      wrapper = document.createElement('div');
      wrapper.classList.add('manifans-wrapper');
      wrapper.style.position = 'relative'; // set position to relative to position the icon correctly
      image.parentNode.insertBefore(wrapper, image); // insert the wrapper before the image
      wrapper.appendChild(image); // move the image into the wrapper
    }

    // Create a new element for the icon
    const iconDiv = document.createElement('div');
    // Add the smaller icon class if the image is less than 28 px wide
    if (image.width < 28) {
      iconDiv.classList.add('small-finger-icon');
    } else {
      iconDiv.classList.add('finger-icon');
    }
    wrapper.appendChild(iconDiv); // add the icon to the wrapper

    const hoverTextTable = populateHoverTextTable(imageUsername, userNameToTopPositions, permMarkets, placesToShow, forceReload);

    if (!hoverTextTable) {
      // Don't show icon (all hover text entries were filtered out)
      iconDiv.style.display = 'none';
      continue;
    }

    iconDiv.addEventListener('mouseover', () => {
      hoverTextTable.style.display = 'block';
      hoverTextTable.style.zIndex = '10000';
      iconDiv.style.zIndex = '10001';

      // Note that hoverTextTable is fixed position. Move it to the iconDiv's absolute position on the screen
      hoverTextTable.style.left = iconDiv.getBoundingClientRect().left + document.body.scrollLeft + 'px';
      hoverTextTable.style.top = iconDiv.getBoundingClientRect().bottom + document.body.scrollTop - 1 + 'px';

      // If the bottom of the hover text table is below the bottom of the screen, move it up
      const hoverTextTableBottom = hoverTextTable.getBoundingClientRect().bottom + document.body.scrollTop;
      const screenBottom = window.innerHeight;
      if (hoverTextTableBottom > screenBottom) {
        hoverTextTable.style.top = hoverTextTable.getBoundingClientRect().top - (hoverTextTableBottom - screenBottom) + 'px';
        // Move to the right of the finger
        hoverTextTable.style.left = iconDiv.getBoundingClientRect().right - 1 + 'px';
      }
    });

    iconDiv.addEventListener('mouseleave', () => {
      hoverTextTable.style.display = 'none';
      hoverTextTable.style.zIndex = '9998';
      iconDiv.style.zIndex = '9999';
    });

    // add event listeners to the hoverTextTable to keep it displayed when the user hovers over it
    hoverTextTable.addEventListener('mouseenter', () => {
      hoverTextTable.style.display = 'block';
      hoverTextTable.style.zIndex = '9999';
    });
    hoverTextTable.addEventListener('mouseleave', () => {
      hoverTextTable.style.display = 'none';
      hoverTextTable.style.zIndex = '9998';
    });
    // prevent the event from bubbling up to the parent img element
    hoverTextTable.addEventListener('mouseover', (event) => {
      event.stopPropagation();
    });
  }
}
