import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getTransactionTypeDescription } from '../utils/helpers';

function InventoryList({ items, onSelectItem, selectedItem, onAddToOrder, setActiveTab }) {
  const [expandedItems, setExpandedItems] = useState({});
  const [orderQuantity, setOrderQuantity] = useState({});
  const [showOrderPrompt, setShowOrderPrompt] = useState(null);
  
  // Toggle expanded state for an item
  const toggleExpand = (itemId) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };
  
  // Navigate to item details page
  const goToItemDetail = (item) => {
    onSelectItem(item);
    setActiveTab('item-detail');
  };
  
  // Show order quantity prompt
  const promptOrderQuantity = (item) => {
    // Initialize order quantity if not already set
    if (!orderQuantity[item.item]) {
      setOrderQuantity(prev => ({
        ...prev,
        [item.item]: Math.abs(item.startingBalance < 0 ? item.startingBalance : 0) || 1
      }));
    }
    setShowOrderPrompt(item.item);
  };
  
  // Confirm order quantity
  const confirmOrderQuantity = (item) => {
    onAddToOrder(item, orderQuantity[item.item] || 1);
    setShowOrderPrompt(null);
  };
  
  // Update order quantity
  const handleQuantityChange = (itemId, value) => {
    setOrderQuantity(prev => ({
      ...prev,
      [itemId]: Math.max(1, parseInt(value) || 1)
    }));
  };
  
  // Calculate balance after work orders for each item
  const itemsWithBalanceAfterWO = items.map(item => {
    let balanceAfterWO = item.startingBalance;
    
    // Subtract work order quantities
    if (item.workOrders && item.workOrders.length > 0) {
      const totalWOQuantity = item.workOrders.reduce((sum, wo) => sum + wo.quantity, 0);
      balanceAfterWO -= totalWOQuantity;
    }
    
    return {
      ...item,
      balanceAfterWO
    };
  });
  
  // Sort items to put those with 0 transactions at the bottom
  const sortedItems = [...itemsWithBalanceAfterWO].sort((a, b) => {
    const aHasTransactions = a.transactions?.length > 1; // More than just the beginning balance
    const bHasTransactions = b.transactions?.length > 1;
    
    if (aHasTransactions && !bHasTransactions) return -1;
    if (!aHasTransactions && bHasTransactions) return 1;
    return 0;
  });
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Balance</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance After WO</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedItems.length > 0 ? (
              sortedItems.map((item, index) => (
                <React.Fragment key={index}>
                  <tr 
                    className={`${selectedItem?.item === item.item ? 'bg-blue-50' : ''} ${item.startingBalance < 0 ? 'bg-red-50' : ''} hover:bg-gray-50`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.item}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.vendor}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.startingBalance < 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {item.startingBalance}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.balanceAfterWO < 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {item.balanceAfterWO.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.transactions ? item.transactions.length : 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
                      <button 
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-1 inline-flex"
                        onClick={() => toggleExpand(item.item)}
                      >
                        <span>View</span>
                        {expandedItems[item.item] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      
                      <button 
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 inline-flex"
                        onClick={() => promptOrderQuantity(item)}
                      >
                        Add to Order
                      </button>
                      
                      <button 
                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 inline-flex"
                        onClick={() => goToItemDetail(item)}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                  
                  {/* Order Quantity Prompt */}
                  {showOrderPrompt === item.item && (
                    <tr>
                      <td colSpan="7" className="px-6 py-2 bg-green-50">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-gray-700">Enter quantity to order:</span>
                          <input
                            type="number"
                            min="1"
                            className="px-3 py-1 border rounded w-24 text-center"
                            value={orderQuantity[item.item] || 1}
                            onChange={(e) => handleQuantityChange(item.item, e.target.value)}
                          />
                          <button
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                            onClick={() => confirmOrderQuantity(item)}
                          >
                            Confirm
                          </button>
                          <button
                            className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                            onClick={() => setShowOrderPrompt(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {/* Expanded view */}
                  {expandedItems[item.item] && (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 bg-gray-50">
                        <div className="space-y-4">
                          {/* Summary stats */}
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white p-3 rounded shadow-sm">
                              <p className="text-xs text-gray-500">Beginning Balance</p>
                              <p className="text-lg font-semibold">{item.startingBalance}</p>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                              <p className="text-xs text-gray-500">Open POs</p>
                              <p className="text-lg font-semibold">{item.purchaseOrders?.length || 0}</p>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                              <p className="text-xs text-gray-500">Work Orders</p>
                              <p className="text-lg font-semibold">{item.workOrders?.length || 0}</p>
                            </div>
                            <div className="bg-white p-3 rounded shadow-sm">
                              <p className="text-xs text-gray-500">Sales Orders</p>
                              <p className="text-lg font-semibold">{item.openSales?.length || 0}</p>
                            </div>
                          </div>
                          
                          {/* Transactions */}
                          <div>
                            <h4 className="font-medium text-sm mb-2">Recent Transactions</h4>
                            {item.transactions && item.transactions.length > 1 ? (
                              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-white sticky top-0">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Reference</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Running Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {(() => {
                                      let runningTotal = item.startingBalance;
                                      return item.transactions.slice(0, 50).map((transaction, tIndex) => {
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
                            ) : (
                              <p className="text-sm text-gray-500">No transactions beyond beginning balance.</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                  No items found. Please upload MRP data or adjust filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InventoryList;