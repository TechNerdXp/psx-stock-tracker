document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.sync.get(['stocks'], function(result) {
    const stocks = result.stocks || ['HCAR', 'SYS', 'NETSOL', 'HUBC', 'AVN'];
    updateStocks(stocks);
  });

  document.getElementById('options-button').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});

function updateStocks(stocks) {
  const stockContainer = document.getElementById('stocks');
  stockContainer.innerHTML = '';
  stocks.forEach(stock => {
    const stockElement = document.createElement('div');
    stockElement.id = stock;
    stockElement.className = 'flex items-center justify-between p-4 bg-gray-100 rounded-lg shadow';
    stockElement.innerHTML = `
      <span class="text-lg font-semibold">${stock}</span>
      <span class="text-lg" id="${stock}-price">Loading...</span>
    `;
    stockContainer.appendChild(stockElement);
  });

  chrome.storage.sync.get(stocks, function(result) {
    const shouldFetch = isMarketHours() || 
                       !stocks.every(stock => result[stock]);
    
    if (shouldFetch) {
      fetchStockData(stocks);
    } else {
      useStoredPrices(stocks);
    }
  });
}

function fetchStockData(stocks) {
  stocks.forEach(stock => {
    fetch(`https://dps.psx.com.pk/company/${stock}`)
      .then(response => response.text())
      .then(html => {
        const price = extractPriceFromHTML(html);
        document.getElementById(`${stock}-price`).innerText = price;
        chrome.storage.sync.set({ [stock]: price });
      })
      .catch(error => {
        document.getElementById(`${stock}-price`).innerText = 'Error';
      });
  });
}

function useStoredPrices(stocks) {
  chrome.storage.sync.get(stocks, function(result) {
    stocks.forEach(stock => {
      const price = result[stock] || 'N/A';
      document.getElementById(`${stock}-price`).innerText = price;
    });
  });
}

function extractPriceFromHTML(html) {
  const priceMatch = html.match(/<div class="quote__close">Rs\.(\d+\.\d+)<\/div>/);
  return priceMatch ? priceMatch[1] : 'N/A';
}

function isMarketHours() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const holidays = [
    // Add holiday dates in 'YYYY-MM-DD' format
    '2023-12-25', // Christmas
    '2023-01-01', // New Year's Day
    // Add more holidays as needed
  ];
  const today = now.toISOString().split('T')[0];

  // Check if today is a holiday
  if (holidays.includes(today)) {
    return false;
  }

  // Check if today is a weekend (Saturday or Sunday)
  if (day === 0 || day === 6) {
    return false;
  }

  // Check if today is Friday and after 12:30 PM
  if (day === 5 && (hour > 12 || (hour === 12 && now.getMinutes() >= 30))) {
    return false;
  }

  // Check if current time is within market hours (Monday to Thursday, 9 AM to 5 PM, and Friday, 9 AM to 12:30 PM)
  return (day >= 1 && day <= 4 && hour >= 9 && hour < 17) || (day === 5 && hour >= 9 && hour < 12);
}