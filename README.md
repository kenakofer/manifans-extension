# manifans-extension
Browser extension for Manifold Markets, displaying digital flair on users that hold large positions in permanent markets/stocks.

To load the extension temporarily for testing:

 - On **Firefox**: rename `firefox-manifest.json` to `manifest.json`, then go to `about:debugging`, `This Firefox`, `Load Temporary Add-on...`
 - On **Chrome**: rename `chrome-manifest.json` to `manifest.json`, then go to `about:extensions`, `Developer Mode`, `Load Unpacked`

### TODO
    - After sorting by #1, #2 etc, sort by size of position? value of position? # of traders below you in the position? # of traders on either side of your position? We want important markets higher up somehow, and there's important differences between these.
    - Expand the +3 more on click, then force a harder display filter cutoff
    - Save a userToHTML object for faster replacement
    - Make popup have nicer button
    - Change "chance" and "probability" to "favorable" or "good". Maybe YES and NO as well?
    - Some convention for reading a fan string from out of the description
    - It still just sometimes doesn't show on the page, then I refresh and it shows.
    - I'm probably still doing storage horribly wrong.
    - hard to mouse from small image onto hover
    - Solve the disappearing problem on the Positions tab
    - Solve the background script stopping.
    - Limit ourselves once API gives that capability
    - Smart update (listen for new bets on perm markets, only update the data affected)
