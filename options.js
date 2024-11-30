document.addEventListener('DOMContentLoaded', function() {
  loadOptions();
  document.getElementById('save-button').addEventListener('click', saveOptions);
  document.getElementById('stocks').addEventListener('input', updateStockToggles);
  document.getElementById('reset-dismissal').addEventListener('click', resetDismissalStates);
});

function loadOptions() {
  chrome.storage.sync.get(['stocks', 'showBadge', 'enabledStocks', 'panelStyle'], function(result) {
    const stocks = result.stocks || ['HCAR', 'HUBC', 'NETSOL', 'AVN'];
    document.getElementById('stocks').value = stocks.join(', ');
    document.getElementById('showBadge').value = result.showBadge || 'always';
    document.getElementById('panelStyle').value = result.panelStyle || 'off';
    updateStockToggles(result.enabledStocks || stocks);
  });
}

function updateStockToggles(enabledStocks = []) {
  const stocksInput = document.getElementById('stocks').value;
  const stocks = stocksInput.split(',').map(s => s.trim()).filter(Boolean);
  const container = document.getElementById('stockToggles');
  
  container.innerHTML = stocks.map(stock => `
    <div class="flex items-center">
      <input type="checkbox" id="toggle-${stock}" 
             class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
             ${enabledStocks.includes(stock) ? 'checked' : ''}>
      <label for="toggle-${stock}" class="ml-2 block text-sm text-gray-900">
        Show ${stock} in badge rotation
      </label>
    </div>
  `).join('');
}

function saveOptions() {
  const stocksInput = document.getElementById('stocks').value;
  const stocks = stocksInput.split(',').map(s => s.trim()).filter(Boolean);
  const showBadge = document.getElementById('showBadge').value;
  const panelStyle = document.getElementById('panelStyle').value;
  const enabledStocks = stocks.filter(stock => {
    const checkbox = document.getElementById(`toggle-${stock}`);
    return checkbox ? checkbox.checked : false;
  });

  // Always reset dismissal state when saving options
  chrome.storage.sync.set({ 
    stocks,
    showBadge,
    enabledStocks,
    panelStyle,
    [`${panelStyle}Dismissed`]: false,
    [`${panelStyle}DismissedDate`]: null
  }, function() {
    updateStockToggles(enabledStocks);
    chrome.runtime.sendMessage({ type: 'OPTIONS_UPDATED' });
    alert('Options saved! Panel display has been reset.');
  });
}

function resetDismissalStates() {
  chrome.storage.sync.get(['panelStyle'], function(result) {
    // Only reset if not set to 'off'
    if (result.panelStyle !== 'off') {
      chrome.storage.sync.set({
        tickerDismissed: false,
        cardDismissed: false,
        tickerDismissedDate: null,
        cardDismissedDate: null
      }, function() {
        chrome.runtime.sendMessage({ type: 'OPTIONS_UPDATED' });
        alert('Panel dismissal states have been reset!');
      });
    } else {
      alert('Cannot reset panels while display is set to Off.');
    }
  });
}