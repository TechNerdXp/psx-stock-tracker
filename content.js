const stockContainer = document.createElement('div');
stockContainer.id = 'floating-stock-ticker';

chrome.storage.sync.get(['stocks', 'panelStyle'], function(result) {
  const stocks = result.stocks || ['HCAR', 'SYS', 'NETSOL', 'HUBC', 'AVN'];
  const panelStyle = result.panelStyle || 'off'; // Default to 'off'
  
  if (panelStyle !== 'off') {
    document.body.appendChild(stockContainer);
    updateDisplay(stocks, panelStyle);
  }
});

function updateDisplay(stocks, style) {
  stockContainer.className = `panel-${style}`;
  stockContainer.innerHTML = '';
  
  if (style === 'ticker') {
    document.body.classList.add('has-ticker');
    
    // Add hover effect handlers
    stockContainer.addEventListener('mouseenter', () => {
      stockContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
      stockContainer.style.opacity = '1';
    });
    
    stockContainer.addEventListener('mouseleave', () => {
      stockContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
      stockContainer.style.opacity = '0.9';
    });

    stocks.forEach(stock => {
      const stockSpan = document.createElement('span');
      stockSpan.className = 'ticker-item';
      stockSpan.innerHTML = `
        <strong>${stock}</strong>
        <span id="page-${stock}" class="price">Loading...</span>
        <span class="separator">|</span>
      `;
      stockContainer.appendChild(stockSpan);
    });
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
}

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

// Update the message listener to handle style changes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPTIONS_UPDATED') {
    chrome.storage.sync.get(['stocks', 'panelStyle'], function(result) {
      const stocks = result.stocks || ['HCAR', 'SYS', 'NETSOL', 'HUBC', 'AVN'];
      const panelStyle = result.panelStyle || 'off';
      
      if (panelStyle === 'off') {
        stockContainer.remove();
        document.body.classList.remove('has-ticker');
      } else {
        if (!stockContainer.isConnected) {
          document.body.appendChild(stockContainer);
        }
        updateDisplay(stocks, panelStyle);
      }
    });
  }
});

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