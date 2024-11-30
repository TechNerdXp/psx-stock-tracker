const stockContainer = document.createElement('div');
stockContainer.id = 'floating-stock-ticker';

chrome.storage.sync.get(['stocks', 'panelStyle', 'tickerDismissed', 'cardDismissed'], function(result) {
  const stocks = result.stocks || ['HCAR', 'SYS', 'NETSOL', 'HUBC', 'AVN'];
  const panelStyle = result.panelStyle || 'off';
  
  // Only check specific dismissal state
  const isDismissed = result[`${panelStyle}Dismissed`];
  
  if (panelStyle !== 'off' && !isDismissed) {
    document.body.appendChild(stockContainer);
    updateDisplay(stocks, panelStyle);
  }
});

function updateDisplay(stocks, style) {
  // First check if panel style is off
  if (style === 'off') {
    stockContainer.remove();
    document.body.classList.remove('has-ticker');
    return;
  }

  // Check for market open reset and previous dismissal
  chrome.storage.sync.get([`${style}Dismissed`, `${style}DismissedDate`], function(result) {
    const dismissedDate = result[`${style}DismissedDate`];
    const isDismissed = result[`${style}Dismissed`] && !isNewMarketSession(dismissedDate);
    
    if (isDismissed) {
      stockContainer.remove();
      document.body.classList.remove('has-ticker');
      return;
    }

    stockContainer.className = `panel-${style}`;
    stockContainer.innerHTML = '';
    
    // Add dismiss button
    const dismissButton = document.createElement('button');
    dismissButton.className = 'dismiss-button';
    dismissButton.innerHTML = '×';
    dismissButton.onclick = handleDismiss(style);
    stockContainer.appendChild(dismissButton);

    if (style === 'ticker') {
      document.body.classList.add('has-ticker');
      
      // Create ticker content container
      const tickerContent = document.createElement('div');
      tickerContent.className = 'ticker-content';
      
      stocks.forEach(stock => {
        const stockSpan = document.createElement('span');
        stockSpan.className = 'ticker-item';
        stockSpan.innerHTML = `
          <strong>${stock}</strong>
          <span id="page-${stock}" class="price">Loading...</span>
          <span class="separator">|</span>
        `;
        tickerContent.appendChild(stockSpan);
      });
      
      stockContainer.appendChild(tickerContent);
      // Add dismiss button after ticker content
      stockContainer.appendChild(dismissButton);
    } else if (style === 'card') {
      document.body.classList.remove('has-ticker');
      const title = document.createElement('div');
      title.className = 'card-title';
      title.textContent = 'PSX Stocks';
      stockContainer.appendChild(title);

      stocks.forEach(stock => {
        const stockDiv = document.createElement('div');
        stockDiv.className = 'card-item';
        stockDiv.innerHTML = `
          <strong>${stock}</strong>
          <span id="page-${stock}" class="price">Loading...</span>
        `;
        stockContainer.appendChild(stockDiv);
      });
    }
      
    // Get stored prices first, then fetch new ones
    chrome.storage.sync.get(stocks, function(result) {
      stocks.forEach(stock => {
        const priceElement = document.getElementById(`page-${stock}`);
        if (priceElement && result[stock]) {
          priceElement.textContent = result[stock];
        }
      });
    });
      
    if (isMarketHours()) {
      fetchStockData(stocks);
    }
  });
}

// Simplify the market session check
function isNewMarketSession(lastDismissedDate) {
  if (!lastDismissedDate) return true;
  
  const now = new Date();
  const lastDismissed = new Date(lastDismissedDate);
  const marketOpen = new Date(now);
  marketOpen.setHours(9, 30, 0, 0);
  
  // Reset if:
  // 1. It's a new day and we're in market hours
  // 2. We crossed 9:30 AM since last dismissal
  return (now.toDateString() !== lastDismissed.toDateString() && isMarketHours()) ||
         (lastDismissed < marketOpen && now >= marketOpen && isMarketHours());
}

// Update dismiss button handler
function handleDismiss(style) {
  return (e) => {
    e.stopPropagation();
    stockContainer.remove();
    document.body.classList.remove('has-ticker');
    chrome.storage.sync.set({ 
      [`${style}Dismissed`]: true,
      [`${style}DismissedDate`]: new Date().toISOString()
    });
  };
}

// Update the message listener to handle style changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPTIONS_UPDATED') {
    chrome.storage.sync.get(['stocks', 'panelStyle'], function(result) {
      const stocks = result.stocks || ['HCAR', 'SYS', 'NETSOL', 'HUBC', 'AVN'];
      const panelStyle = result.panelStyle || 'off';
      
      // Always remove old panel first
      stockContainer.remove();
      document.body.classList.remove('has-ticker');
      
      if (panelStyle !== 'off') {
        // Clear any existing dismissal states
        chrome.storage.sync.set({
          [`${panelStyle}Dismissed`]: false,
          [`${panelStyle}DismissedDate`]: null
        }, function() {
          // Ensure container is added to body before updating display
          if (!document.body.contains(stockContainer)) {
            document.body.appendChild(stockContainer);
          }
          updateDisplay(stocks, panelStyle);
        });
      }
    });
  }
});

function updateStocks(stocks, container) {
  container.innerHTML = '';
  
  stocks.forEach(stock => {
    const stockElement = document.createElement('span');
    stockElement.id = `page-${stock}`;
    stockElement.className = 'stock-item';
    stockElement.innerHTML = `${stock}: <span class="price">Loading...</span> `;
    container.appendChild(stockElement);
  });
  
  fetchStockData(stocks);
}

function fetchStockData(stocks) {
  stocks.forEach(stock => {
    const priceElement = document.getElementById(`page-${stock}`);
    if (!priceElement) return;

    fetch(`https://dps.psx.com.pk/company/${stock}`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
      })
      .then(html => {
        const priceInfo = extractPriceFromHTML(html);
        if (priceInfo.success) {
          priceElement.textContent = priceInfo.price;
          priceElement.classList.remove('error');
          chrome.storage.sync.set({ [stock]: priceInfo.price });
        } else {
          throw new Error('Price not found');
        }
      })
      .catch(error => {
        console.error(`Error fetching ${stock}:`, error);
        chrome.storage.sync.get([stock], function(result) {
          const storedPrice = result[stock];
          if (storedPrice) {
            priceElement.textContent = storedPrice;
          } else {
            priceElement.textContent = 'N/A';
            priceElement.classList.add('error');
          }
        });
      });
  });
}

function extractPriceFromHTML(html) {
  const priceMatch = html.match(/<div class="quote__close">Rs\.(\d+\.\d+)<\/div>/);
  return {
    success: !!priceMatch,
    price: priceMatch ? priceMatch[1] : null
  };
}

// Add market hours check
function isMarketHours() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minutes = now.getMinutes();

  if (day === 0 || day === 6) return false;

  if (day === 5) {
    return (hour === 9 && minutes >= 30) || (hour === 12 && minutes <= 30) || (hour > 9 && hour < 12);
  }

  return (hour === 9 && minutes >= 30) || (hour === 15 && minutes <= 30) || (hour > 9 && hour < 15);
}