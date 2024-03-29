# ManiFans Extension [![](https://img.shields.io/amo/v/manifans.svg?logo=firefox&style=flat)](https://addons.mozilla.org/en-US/firefox/addon/manifans/) [![](https://img.shields.io/chrome-web-store/v/hkccfpgeafncnjbahmjbkbmclamegmmd?logo=google-chrome)](https://chrome.google.com/webstore/detail/manifans/hkccfpgeafncnjbahmjbkbmclamegmmd?hl=en)



<img align="left" src="icons/icon128.png" height="65px">

ManiFans is an extension for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/manifans/) and [Chrome](https://chrome.google.com/webstore/detail/manifans/hkccfpgeafncnjbahmjbkbmclamegmmd?hl=en). It adds a badge to the profile picture of users on [Manifold Markets](https://manifold.markets) who hold the top positions on permanent markets, AKA stock markets. When you hover over this badge, you might see that they are "Aba's #1 Fan", and "AI Singularity's #3 Critic", and you know they've put their mana where their mouth is to secure those titles.

-----------------

![screenshot showing extension in use](screenshot-redacted.png)



## What does it do?

 - While browsing Manifold, it periodically checks for changes to the relevant markets.
 - While browsing Manifold, it periodically checks for changes in users' positions on these markets
 - It adds the badge to all the user profile pics that earned it.
 - It only fetches public market data, has no trackers, never uploads anything, and all the features work whether you're logged into Manifold or not.
 - The code is open-source (MIT license), so you can take a look if you're curious and help make it better.

## Why would anyone want this?

Right now, few people give attention to the positions or percentages of "permanent" "stock" markets on Manifold. Some elect not to participate because the market will not resolve, nor must it respond to changes in the world.

ManiFans rewards those holding the largest positions (and the subject of the market) with social attention, and thus tighten a "social peg" to the value of shares. Having this strengthened peg is good not just for those who want to put their fandom on display, but also for those predicting the price of that attention, and those wanting the market's current balance to tell them something real about the subject's social standing.

It might be useful to for traders to passively notice that another commenter on some SpaceX prediction has the badge "Elon Musk's #1 Critic. Whether or not the commenter is truly critical of Elon, it's notable that they paid for a costly signal to that effect.

## Run locally for testing

To load the extension locally:

 1. Download this repository.
   1. On **Firefox**: rename `firefox-manifest.json` to `manifest.json`, then go to `about:debugging`, `This Firefox`, `Load Temporary Add-on...`, and navigate into the directory with `manifest.json`.
   1. On **Chrome**: rename `chrome-manifest.json` to `manifest.json`, then go to `about:extensions`, `Developer Mode`, `Load Unpacked`, and navigate into the directory with `manifest.json`.

Once installed, click on the extension icon in your browser to see the status and settings. It takes a minute after installation to sync all the market and position data for the first time.


### TODO
    - Change icon while inactive/loading
    - Expand the +3 more on click, then force a harder display filter cutoff
    - Change "chance" and "probability" to "favorable" or "good". Maybe YES and NO as well?
