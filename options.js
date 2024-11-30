document.addEventListener('DOMContentLoaded', function() {
  loadOptions();
  document.getElementById('save-button').addEventListener('click', saveOptions);
  document.getElementById('stocks').addEventListener('input', updateStockToggles);
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

  // Get current checkbox states before updating
  const enabledStocks = stocks.filter(stock => {
    const checkbox = document.getElementById(`toggle-${stock}`);
    // If checkbox exists, use its state, otherwise it's a new stock
    return checkbox ? checkbox.checked : false;
  });

  // Save immediately without recreating checkboxes
  chrome.storage.sync.set({ 
    stocks,
    showBadge,
    enabledStocks,
    panelStyle
  }, function() {
    // Update checkboxes after saving
    updateStockToggles(enabledStocks);
    chrome.runtime.sendMessage({ type: 'OPTIONS_UPDATED' });
    alert('Options saved!');
  });
}