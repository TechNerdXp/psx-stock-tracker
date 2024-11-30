let badgeInterval = null;
let currentPrices = [];
let currentStocks = []; // Add this to track which stock each price belongs to

chrome.runtime.onInstalled.addListener(() => {
  startBadgeRotation();
  fetchStockData(['HCAR', 'SYS', 'NETSOL', 'HUBC', 'AVN'], true, true); // Force fetch initial data
});

chrome.alarms.create('fetchStockData', { periodInMinutes: 9 }); // Update every 9 minutes

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'fetchStockData') {
    chrome.storage.sync.get(['stocks', 'showBadge'], function(result) {
      const stocks = result.stocks || ['HCAR', 'SYS', 'NETSOL', 'HUBC', 'AVN'];
      const showBadge = result.showBadge || 'always';
      console.log(`Fetching stock data with showBadge: ${showBadge}`);
      fetchStockData(stocks, showBadge);
    });
  }
});

// Add this message listener for option changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPTIONS_UPDATED') {
    console.log('Options updated, restarting badge rotation');
    // Force fetch new data with new settings
    chrome.storage.sync.get(['stocks', 'showBadge'], function(result) {
      const stocks = result.stocks || ['HCAR', 'SYS', 'NETSOL', 'HUBC', 'AVN'];
      fetchStockData(stocks, result.showBadge, true);
    });
    // Restart badge rotation
    startBadgeRotation();
  }
});

function fetchStockData(stocks, showBadge, forceFetch = false) {
  chrome.storage.sync.get(['enabledStocks', ...stocks], function(result) {
    const enabledStocks = result.enabledStocks || stocks;
    console.log('Enabled stocks:', enabledStocks); // Debug log
    
    const shouldFetch = forceFetch || 
                       isMarketHours() || 
                       !stocks.every(stock => result[stock]);
    
    if (!shouldFetch) {
      console.log('Using stored data');
      useStoredPrices(enabledStocks); // Pass enabledStocks here
      return;
    }

    console.log('Fetching fresh data');
    let completed = 0;
    const newPrices = [];
    const newStocks = [];
    
    stocks.forEach((stock) => {
      if (!enabledStocks.includes(stock)) {
        completed++;
        return;
      }

      fetch(`https://dps.psx.com.pk/company/${stock}`)
        .then((response) => response.text())
        .then((html) => {
          const price = extractPriceFromHTML(html);
          if (price !== 'N/A') {
            const numericPrice = Math.floor(parseFloat(price));
            chrome.storage.sync.set({ [stock]: numericPrice.toString() });
            newPrices.push(numericPrice);
            newStocks.push(stock);
          }
          completed++;
          if (completed === stocks.length && newPrices.length > 0) {
            currentPrices = newPrices;
            currentStocks = newStocks;
            console.log('Updated prices:', currentPrices); // Debug log
            console.log('Updated stocks:', currentStocks); // Debug log
          }
        })
        .catch((error) => {
          console.error(`Error fetching data for ${stock}:`, error);
          completed++;
        });
    });
  });
}

function useStoredPrices(enabledStocks) {
  chrome.storage.sync.get(enabledStocks, function(result) {
    const newPrices = [];
    const newStocks = [];
    
    enabledStocks.forEach(stock => {
      const price = result[stock];
      if (price && price !== 'N/A') {
        newPrices.push(parseInt(price));
        newStocks.push(stock);
      }
    });

    if (newPrices.length > 0) {
      currentPrices = newPrices;
      currentStocks = newStocks;
      console.log('Using stored prices:', currentPrices); // Debug log
      console.log('Using stored stocks:', currentStocks); // Debug log
    }
  });
}

function startBadgeRotation() {
  if (badgeInterval) {
    clearInterval(badgeInterval);
  }

  let index = 0;
  const rotateBadge = () => {
    chrome.storage.sync.get(['showBadge'], function(result) {
      const showBadge = result.showBadge || 'always';
      if (currentPrices.length > 0 && (showBadge === 'always' || isMarketHours())) {
        const priceText = currentPrices[index].toString();
        const stockText = currentStocks[index];
        chrome.action.setBadgeText({ text: priceText });
        chrome.action.setTitle({ title: stockText }); // Show stock name on hover
        chrome.action.setBadgeBackgroundColor({ color: '#00FF00' });
        index = (index + 1) % currentPrices.length;
      } else if (showBadge !== 'always' && !isMarketHours()) {
        chrome.action.setBadgeText({ text: '' });
      }
    });
  };

  rotateBadge(); // Initial update
  badgeInterval = setInterval(rotateBadge, 3000); // Rotate every 3 seconds
}

function extractPriceFromHTML(html) {
  const priceMatch = html.match(/<div class="quote__close">Rs\.(\d+\.\d+)<\/div>/);
  return priceMatch ? parseFloat(priceMatch[1]) : 'N/A';
}

function isMarketHours() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minutes = now.getMinutes();

  // PSX trading hours:
  // Monday to Thursday: 9:30 AM to 3:30 PM
  // Friday: 9:30 AM to 12:30 PM
  // Closed on weekends

  // Weekend check
  if (day === 0 || day === 6) return false;

  // Friday check
  if (day === 5) {
    return (hour === 9 && minutes >= 30) || (hour === 12 && minutes <= 30) || (hour > 9 && hour < 12);
  }

  // Monday to Thursday check
  return (hour === 9 && minutes >= 30) || (hour === 15 && minutes <= 30) || (hour > 9 && hour < 15);
}