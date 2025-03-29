import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, X, AlertTriangle, ArrowUp, PrinterIcon, ChartIcon } from 'lucide-react';
import { getTransactionTypeDescription } from '../utils/helpers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import _ from 'lodash';

function TransactionView({ stockItems, onSelectItem, setActiveTab }) {
  const [expandedItems, setExpandedItems] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('transactions');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showVendorFilter, setShowVendorFilter] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [includeGraphs, setIncludeGraphs] = useState(true);
  const [weeklyOrderSuggestions, setWeeklyOrderSuggestions] = useState({});
  const [positiveBalanceTransactions, setPositiveBalanceTransactions] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  
  // Extract all unique categories and vendors
  const allCategories = _.uniq(
    stockItems
      .map(item => item.category)
      .filter(Boolean)
      .sort()
  );
  
  const allVendors = _.uniq(
    stockItems
      .map(item => item.vendor)
      .filter(Boolean)
      .sort()
  );
  
  // Toggle expanded state for an item
  const toggleExpand = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };
  
  // Toggle expanded state for transaction group
  const toggleExpandGroup = (itemId, weekKey) => {
    const groupKey = `${itemId}-${weekKey}`;
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };
  
  // Navigate to item details
  const goToItemDetail = (item) => {
    onSelectItem(item);
    setActiveTab('item-detail');
  };
  
  // Toggle category selection
  const toggleCategory = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };
  
  // Toggle vendor selection
  const toggleVendor = (vendor) => {
    if (selectedVendors.includes(vendor)) {
      setSelectedVendors(selectedVendors.filter(v => v !== vendor));
    } else {
      setSelectedVendors([...selectedVendors, vendor]);
    }
  };
  
  // Select all categories
  const selectAllCategories = () => {
    setSelectedCategories([...allCategories]);
  };
  
  // Clear all selected categories
  const clearSelectedCategories = () => {
    setSelectedCategories([]);
  };
  
  // Select all vendors
  const selectAllVendors = () => {
    setSelectedVendors([...allVendors]);
  };
  
  // Clear all selected vendors
  const clearSelectedVendors = () => {
    setSelectedVendors([]);
  };
  
  // Calculate balance after work orders
  const calculateBalanceAfterWO = (item) => {
    let balance = item.startingBalance;
    if (item.workOrders && item.workOrders.length > 0) {
      const totalWOQuantity = item.workOrders.reduce((sum, wo) => sum + wo.quantity, 0);
      balance -= totalWOQuantity;
    }
    return balance;
  };
  
  // Analyze orders for recommendation report
  useEffect(() => {
    if (showReportPanel) {
      analyzeAllItems();
    }
  }, [showReportPanel, selectedCategories, selectedVendors]);
  
  // Analyze all filtered items for order recommendations
  const analyzeAllItems = () => {
    const newSuggestions = {};
    const newPositiveTransactions = {};
    
    filteredItems.forEach(item => {
      if (item.orders && item.orders.length > 0) {
        const { suggestions, positiveTransaction } = analyzeRequiredOrders(item);
        
        if (suggestions.length > 0) {
          newSuggestions[item.item] = suggestions;
        }
        
        if (positiveTransaction) {
          newPositiveTransactions[item.item] = positiveTransaction;
        }
      }
    });
    
    setWeeklyOrderSuggestions(newSuggestions);
    setPositiveBalanceTransactions(newPositiveTransactions);
  };
  
  // Analyze required orders for a specific item
  const analyzeRequiredOrders = (item) => {
    // Sort transactions chronologically
    const sortedTransactions = _.sortBy([...item.transactions], 'dueDate');
    
    // Calculate running balance over time
    let runningBalance = item.startingBalance;
    let balanceBecomesPositive = false;
    let positiveTransaction = null;
    let previousBalance = runningBalance;
    
    // Check if balance becomes positive in the future
    for (let i = 0; i < sortedTransactions.length; i++) {
      const transaction = sortedTransactions[i];
      
      if (transaction.type === 1) { // Purchase Order
        runningBalance += transaction.quantity;
        
        // If balance was negative and now positive, mark this transaction
        if (previousBalance < 0 && runningBalance >= 0 && !balanceBecomesPositive) {
          balanceBecomesPositive = true;
          positiveTransaction = { ...transaction, index: i };
        }
      } else if (transaction.type === 4 || transaction.type === 3 || transaction.type === 6) { // Open Sales or Released/Issued Work Orders
        runningBalance -= transaction.quantity;
      }
      
      previousBalance = runningBalance;
    }
    
    // If balance becomes positive, return that transaction
    if (balanceBecomesPositive) {
      return { suggestions: [], positiveTransaction };
    }
    
    // If balance doesn't become positive, analyze required orders with cumulative effects
    // Helper to get the Monday of each week
    const getWeekStart = (date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
      return new Date(d.setDate(diff));
    };
    
    // Get week key for grouping
    const getWeekKey = (date) => {
      const weekStart = getWeekStart(date);
      return weekStart.toISOString().split('T')[0];
    };
    
    // Initialize with current balance
    let simulatedBalance = item.startingBalance;
    const weeklyNeeds = {};
    const recommendedOrders = [];
    
    // Process transactions in chronological order
    for (let i = 0; i < sortedTransactions.length; i++) {
      const transaction = sortedTransactions[i];
      const weekKey = getWeekKey(transaction.dueDate);
      
      // Update balance based on transaction type
      if (transaction.type === 1) { // Purchase Order
        simulatedBalance += transaction.quantity;
      } else if (transaction.type === 4 || transaction.type === 3 || transaction.type === 6) { // Open Sales or Released/Issued Work Orders
        simulatedBalance -= transaction.quantity;
        
        // If balance becomes negative, track in weekly needs
        if (simulatedBalance < 0) {
          if (!weeklyNeeds[weekKey]) {
            weeklyNeeds[weekKey] = {
              weekStart: getWeekStart(transaction.dueDate),
              totalNeeded: 0,
              transactions: []
            };
          }
          
          // Add transaction and its impact to the weekly need
          weeklyNeeds[weekKey].transactions.push({
            ...transaction,
            impact: Math.min(transaction.quantity, Math.abs(simulatedBalance))
          });
          
          weeklyNeeds[weekKey].totalNeeded += Math.min(transaction.quantity, Math.abs(simulatedBalance));
          
          // Create an order to bring balance back to zero
          const orderQuantity = Math.abs(simulatedBalance);
          simulatedBalance = 0; // Balance is now zero after hypothetical order
          
          // Store recommendation
          if (orderQuantity > 0) {
            recommendedOrders.push({
              weekKey,
              weekStart: getWeekStart(transaction.dueDate),
              quantity: orderQuantity,
              transactions: [...weeklyNeeds[weekKey].transactions] // Copy current transactions
            });
          }
        }
      }
    }
    
    // Group recommendations by week and consolidate quantities
    const consolidatedOrders = {};
    
    recommendedOrders.forEach(order => {
      if (!consolidatedOrders[order.weekKey]) {
        consolidatedOrders[order.weekKey] = {
          weekStart: order.weekStart,
          quantity: 0,
          transactions: []
        };
      }
      
      consolidatedOrders[order.weekKey].quantity += order.quantity;
      order.transactions.forEach(t => {
        if (!consolidatedOrders[order.weekKey].transactions.some(existing => 
          existing.dueDate.getTime() === t.dueDate.getTime() && 
          existing.partNumber === t.partNumber &&
          existing.type === t.type
        )) {
          consolidatedOrders[order.weekKey].transactions.push(t);
        }
      });
    });
    
    // Convert to array and sort by week
    const finalRecommendations = Object.values(consolidatedOrders).sort((a, b) => 
      a.weekStart - b.weekStart
    );
    
    return { suggestions: finalRecommendations, positiveTransaction: null };
  };
  
  // Filter items based on criteria
  let filteredItems = stockItems.filter(item => item.transactions?.length > 1);
  
  // Filter by selected categories if any are selected
  if (selectedCategories.length > 0) {
    filteredItems = filteredItems.filter(item => 
      selectedCategories.includes(item.category)
    );
  }
  
  // Filter by selected vendors if any are selected
  if (selectedVendors.length > 0) {
    filteredItems = filteredItems.filter(item => 
      selectedVendors.includes(item.vendor)
    );
  }
  
  // Filter by search term if provided
  if (searchTerm) {
    filteredItems = filteredItems.filter(item => 
      item.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  // Sort items based on selected option
  switch (sortOption) {
    case 'transactions':
      filteredItems = _.orderBy(
        filteredItems, 
        [item => item.transactions.length], 
        ['desc']
      );
      break;
    case 'negative':
      filteredItems = _.orderBy(
        filteredItems, 
        [item => item.startingBalance < 0 ? 1 : 0, item => item.transactions.length], 
        ['desc', 'desc']
      );
      break;
    case 'alphabetical':
      filteredItems = _.orderBy(
        filteredItems, 
        [item => item.item.toLowerCase()], 
        ['asc']
      );
      break;
    case 'category':
      filteredItems = _.orderBy(
        filteredItems, 
        [item => item.category?.toLowerCase(), item => item.item.toLowerCase()], 
        ['asc', 'asc']
      );
      break;
    case 'vendor':
      filteredItems = _.orderBy(
        filteredItems, 
        [item => item.vendor?.toLowerCase(), item => item.item.toLowerCase()], 
        ['asc', 'asc']
      );
      break;
    default:
      break;
  }
  
  // Generate printable recommended orders report
  const generateReport = () => {
    window.print();
  };
  
  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex-grow max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search items..."
                className="pl-10 pr-4 py-2 border rounded w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <label className="text-sm font-medium text-gray-700 mr-2">Sort by:</label>
            <select
              className="border rounded px-3 py-2"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="transactions">Most Transactions</option>
              <option value="negative">Negative Balance First</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="category">Category</option>
              <option value="vendor">Vendor</option>
            </select>
          </div>
          
          <button
            className={`px-3 py-2 rounded flex items-center space-x-1 ${
              showCategoryFilter ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            } hover:bg-blue-100`}
            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
          >
            <Filter size={16} />
            <span>Categories</span>
            {selectedCategories.length > 0 && (
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {selectedCategories.length}
              </span>
            )}
          </button>
          
          <button
            className={`px-3 py-2 rounded flex items-center space-x-1 ${
              showVendorFilter ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
            } hover:bg-blue-100`}
            onClick={() => setShowVendorFilter(!showVendorFilter)}
          >
            <Filter size={16} />
            <span>Vendors</span>
            {selectedVendors.length > 0 && (
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {selectedVendors.length}
              </span>
            )}
          </button>
          
          <button
            className={`px-3 py-2 rounded flex items-center space-x-1 ${
              showReportPanel ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
            } hover:bg-purple-100`}
            onClick={() => setShowReportPanel(!showReportPanel)}
          >
            <PrinterIcon size={16} className="mr-1" />
            <span>Recommended Orders Report</span>
          </button>
        </div>
        
        {/* Category Filter */}
        {showCategoryFilter && (
          <div className="mt-3 p-3 border rounded-md bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-gray-700">Filter by Category</h4>
              <div className="space-x-2">
                <button 
                  className="text-xs text-blue-600 hover:underline"
                  onClick={selectAllCategories}
                >
                  Select All
                </button>
                <button 
                  className="text-xs text-red-600 hover:underline"
                  onClick={clearSelectedCategories}
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {allCategories.map(category => (
                <button
                  key={category}
                  className={`px-2 py-1 text-xs rounded-full flex items-center ${
                    selectedCategories.includes(category) 
                      ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                      : 'bg-gray-100 text-gray-700 border border-gray-300'
                  }`}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                  {selectedCategories.includes(category) && (
                    <X size={12} className="ml-1" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Vendor Filter */}
        {showVendorFilter && (
          <div className="mt-3 p-3 border rounded-md bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-gray-700">Filter by Vendor</h4>
              <div className="space-x-2">
                <button 
                  className="text-xs text-blue-600 hover:underline"
                  onClick={selectAllVendors}
                >
                  Select All
                </button>
                <button 
                  className="text-xs text-red-600 hover:underline"
                  onClick={clearSelectedVendors}
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2 max-h-40 overflow-y-auto">
              {allVendors.map(vendor => (
                <button
                  key={vendor}
                  className={`px-2 py-1 text-xs rounded-full flex items-center ${
                    selectedVendors.includes(vendor) 
                      ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                      : 'bg-gray-100 text-gray-700 border border-gray-300'
                  }`}
                  onClick={() => toggleVendor(vendor)}
                >
                  {vendor}
                  {selectedVendors.includes(vendor) && (
                    <X size={12} className="ml-1" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-sm text-gray-500 mt-3">
          Showing {filteredItems.length} items with transactions
          {(selectedCategories.length > 0 || selectedVendors.length > 0) && (
            <span>
              {selectedCategories.length > 0 && ` from ${selectedCategories.length} categories`}
              {selectedVendors.length > 0 && ` with ${selectedVendors.length} vendors`}
            </span>
          )}
        </div>
      </div>
      
      {/* Recommended Orders Report */}
      {showReportPanel && (
        <div id="recommended-orders-report" className="bg-white p-6 rounded-lg shadow print:shadow-none">
          <div className="flex justify-between items-center mb-6 print:hidden">
            <h2 className="text-xl font-bold text-gray-800">Recommended Orders Report</h2>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeGraphs}
                  onChange={() => setIncludeGraphs(!includeGraphs)}
                  className="mr-2"
                />
                <span>Include Graphs</span>
              </label>
              <button
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center"
                onClick={generateReport}
              >
                <PrinterIcon size={16} className="mr-2" />
                Print Report
              </button>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-center mb-4 hidden print:block">MRP Recommended Orders Report</h1>
          <p className="text-sm text-gray-500 text-center mb-6 hidden print:block">
            Generated on {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
          </p>
          
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items match your current selection. Please adjust your filters.
            </div>
          ) : (
            <div className="space-y-8">
              {filteredItems.filter(item => 
                (weeklyOrderSuggestions[item.item]?.length > 0) || 
                positiveBalanceTransactions[item.item]
              ).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No recommended orders for the current selection of items.
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const hasSuggestions = weeklyOrderSuggestions[item.item]?.length > 0;
                  const hasPositiveTransaction = positiveBalanceTransactions[item.item];
                  
                  // Skip items with no recommendations
                  if (!hasSuggestions && !hasPositiveTransaction) {
                    return null;
                  }
                  
                  return (
                    <div key={index} className="border rounded-lg p-4 page-break-inside-avoid">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">{item.item}</h3>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {item.category}
                            </span>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                              {item.vendor}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Current Balance: 
                                <span className={item.startingBalance < 0 ? 'text-red-600 font-medium ml-1' : 'ml-1'}>
                                  {item.startingBalance}
                                </span>
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Balance After Work Orders: 
                                <span className={calculateBalanceAfterWO(item) < 0 ? 'text-red-600 font-medium ml-1' : 'ml-1'}>
                                  {calculateBalanceAfterWO(item).toFixed(2)}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Balance Trend Chart - only if includeGraphs is true */}
                      {includeGraphs && item.runningTotals && item.runningTotals.length > 0 && (
                        <div className="h-40 my-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={item.runningTotals}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tickFormatter={(date) => new Date(date).toLocaleDateString()} 
                              />
                              <YAxis />
                              <Tooltip 
                                formatter={(value) => [`${value}`, 'Balance']}
                                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                              />
                              <Line 
                                type="stepAfter" 
                                dataKey="balance" 
                                stroke="#3b82f6" 
                                name="Projected Balance" 
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      
                      {/* Recommendations */}
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-700 mb-2">Order Recommendations</h4>
                        
                        {hasPositiveTransaction && (
                          <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4">
                            <div className="flex items-start">
                              <AlertTriangle className="text-yellow-500 mr-3 mt-0.5 flex-shrink-0" size={18} />
                              <div>
                                <h5 className="font-semibold text-yellow-800 text-sm">Attention Required</h5>
                                <p className="text-yellow-800 text-sm mt-1">
                                  A future purchase order will bring the balance positive on {new Date(positiveBalanceTransactions[item.item].dueDate).toLocaleDateString()}.
                                  Consider moving this order up to address current negative balance.
                                </p>
                                <div className="mt-2 text-sm">
                                  <span className="font-medium">PO:</span> {positiveBalanceTransactions[item.item].partNumber} |
                                  <span className="font-medium"> Quantity:</span> {positiveBalanceTransactions[item.item].quantity} |
                                  <span className="font-medium"> Date:</span> {new Date(positiveBalanceTransactions[item.item].dueDate).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {hasSuggestions && (
                          <div className="border rounded">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Week Starting</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Suggested Order</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Details</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {weeklyOrderSuggestions[item.item].map((suggestion, sIndex) => (
                                  <tr key={sIndex}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                      {suggestion.weekStart.toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {suggestion.quantity.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                      <button 
                                        className="text-blue-600 hover:underline print:hidden"
                                        onClick={() => toggleExpandGroup(item.item, `week-${sIndex}`)}
                                      >
                                        {suggestion.transactions.length} transactions
                                        {expandedGroups[`${item.item}-week-${sIndex}`] ? 
                                          <ChevronUp size={14} className="inline ml-1" /> : 
                                          <ChevronDown size={14} className="inline ml-1" />}
                                      </button>
                                      <span className="hidden print:inline">
                                        Covers {suggestion.transactions.length} transactions
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Transaction List */}
      {!showReportPanel && (
        <div className="bg-white rounded-lg shadow">
          {filteredItems.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredItems.map((item, index) => (
                <div key={index} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">{item.item}</h3>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {item.category}
                        </span>
                        {item.startingBalance < 0 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                            Negative Balance
                          </span>
                        )}
                        {item.orders && item.orders.length > 0 && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            {item.orders.length} Orders Needed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Vendor: {item.vendor} | 
                        Balance: <span className={item.startingBalance < 0 ? 'text-red-600 font-medium' : ''}>
                          {item.startingBalance}
                        </span> | 
                        After WO: <span className={calculateBalanceAfterWO(item) < 0 ? 'text-red-600 font-medium' : ''}>
                          {calculateBalanceAfterWO(item).toFixed(2)}
                        </span>
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                        onClick={() => goToItemDetail(item)}
                      >
                        Details
                      </button>
                      <button
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                        onClick={() => toggleExpand(item.item)}
                      >
                        <span>Transactions</span>
                        {expandedItems[item.item] ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />}
                      </button>
                    </div>
                  </div>
                  
                  {/* Summary stats */}
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-xs text-gray-500">Beginning Balance</p>
                      <p className="text-base font-semibold">{item.startingBalance}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-xs text-gray-500">Transactions</p>
                      <p className="text-base font-semibold">{item.transactions ? item.transactions.length : 0}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-xs text-gray-500">Open POs</p>
                      <p className="text-base font-semibold">{item.purchaseOrders ? item.purchaseOrders.length : 0}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded">
                      <p className="text-xs text-gray-500">Open Sales/WOs</p>
                      <p className="text-base font-semibold">
                        {(item.workOrders ? item.workOrders.length : 0) + 
                         (item.openSales ? item.openSales.length : 0)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Expanded transactions */}
                  {expandedItems[item.item] && (
                    <div className="max-h-80 overflow-y-auto mt-4 border rounded">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Running Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(() => {
                            let runningTotal = item.startingBalance;
                            return item.transactions.map((transaction, tIndex) => {
                              // Update running total based on transaction type
                              if (transaction.type === 1) { // Purchase Order
                                runningTotal += transaction.quantity;
                              } else if (transaction.type === 4 || transaction.type === 3 || transaction.type === 6) { // Open Sales or Released/Issued Work Orders
                                runningTotal -= transaction.quantity;
                              }
                              
                              return (
                                <tr key={tIndex} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {getTransactionTypeDescription(transaction.type)}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {new Date(transaction.dueDate).toLocaleDateString()}
                                  </td>
                                  <td className={`px-4 py-2 whitespace-nowrap text-xs font-medium ${
                                    transaction.type === 1 ? 'text-green-600' : 
                                    (transaction.type === 4 || transaction.type === 3 || transaction.type === 6) ? 'text-red-600' : 'text-gray-900'
                                  }`}>
                                    {transaction.type === 1 ? '+' : (transaction.type === 4 || transaction.type === 3 || transaction.type === 6) ? '-' : ''}{transaction.quantity}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {transaction.partNumber}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                    {runningTotal.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              {selectedCategories.length > 0 || selectedVendors.length > 0 ? 
                "No items match your current filter criteria." :
                "No items with transactions found. Please upload MRP data or adjust your search."}
            </div>
          )}
        </div>
      )}
      
      {/* Print styles for the report */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              #recommended-orders-report, #recommended-orders-report * {
                visibility: visible;
              }
              #recommended-orders-report {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              .page-break-inside-avoid {
                page-break-inside: avoid;
              }
            }
          `
        }}
      />
    </div>
  );
}

export default TransactionView;