import React, { useState, useEffect, useRef } from 'react';
import { Download, AlertCircle, Calendar, BarChart2, ChevronDown, ChevronUp, Upload, Users, Edit2 } from 'lucide-react';
import _ from 'lodash';
import Papa from 'papaparse';

function OrderManager({ orderList, setOrderList, stockItems, onUpdateOrder, onImportOrders }) {
  // Get saved grouping preference from localStorage with fallback to 'none'
  const [groupBy, setGroupBy] = useState(() => {
    return localStorage.getItem('order_groupBy_method') || 'none';
  });
  
  // State to track expanded vendor groups in the vendor-date view
  const [expandedVendors, setExpandedVendors] = useState({});
  
  // State for import status
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);
  
  // State for vendor change modal
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [selectedOrderIndex, setSelectedOrderIndex] = useState(null);
  const [newVendor, setNewVendor] = useState('');
  
  // Get all unique vendors from stockItems
  const allVendors = _.uniq(
    stockItems
      .map(item => item.vendor)
      .filter(Boolean)
      .sort()
  );
  
  // Save grouping preference when it changes
  useEffect(() => {
    localStorage.setItem('order_groupBy_method', groupBy);
  }, [groupBy]);
  
  const removeOrderItem = (index) => {
    const newOrderList = [...orderList];
    newOrderList.splice(index, 1);
    setOrderList(newOrderList);
  };
  
  const updateQuantity = (index, quantity) => {
    const newOrderList = [...orderList];
    newOrderList[index].quantity = Math.max(1, parseInt(quantity) || 1);
    setOrderList(newOrderList);
  };
  
  const updateDueDate = (index, dateString) => {
    const newOrderList = [...orderList];
    newOrderList[index].dueDate = new Date(dateString);
    setOrderList(newOrderList);
  };
  
  // New function to update vendor
  const updateVendor = (index, vendor) => {
    const newOrderList = [...orderList];
    newOrderList[index].vendor = vendor;
    setOrderList(newOrderList);
  };
  
  // Open vendor change modal
  const openVendorModal = (index) => {
    setSelectedOrderIndex(index);
    setNewVendor(orderList[index].vendor || '');
    setShowVendorModal(true);
  };
  
  // Close vendor change modal
  const closeVendorModal = () => {
    setShowVendorModal(false);
    setSelectedOrderIndex(null);
    setNewVendor('');
  };
  
  // Confirm vendor change
  const confirmVendorChange = () => {
    if (selectedOrderIndex !== null && newVendor) {
      updateVendor(selectedOrderIndex, newVendor);
      closeVendorModal();
    }
  };
  
  // Add these functions for handling CSV import
  const handleOrderImport = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setImportStatus({ type: 'loading', message: 'Reading order data...' });
    
    try {
      const fileContent = await readFileAsText(file);
      processOrderCsv(fileContent);
    } catch (error) {
      console.error('Error importing orders:', error);
      setImportStatus({ type: 'error', message: 'Error importing orders: ' + error.message });
    }
  };
  
  // Helper function to read file as text
  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e.target.error);
      reader.readAsText(file);
    });
  };
  
  // Process the CSV file
  const processOrderCsv = (fileContent) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Normalize headers to handle case variations
        const normalized = header.toLowerCase().trim();
        if (normalized.includes('item')) return 'item';
        if (normalized.includes('vendor')) return 'vendor';
        if (normalized.includes('category')) return 'category';
        if (normalized.includes('quantity')) return 'quantity';
        if (normalized.includes('due')) return 'dueDate';
        if (normalized.includes('creation') || normalized.includes('created')) return 'creationDate';
        return header; // Keep original if no match
      },
      complete: (results) => {
        // Convert CSV rows to order objects
        const importedOrders = results.data.map(row => {
          // Parse dates with multiple formats
          const parseDate = (dateStr) => {
            if (!dateStr) return new Date();
            
            // Try different date formats
            const formats = [
              // MM/DD/YYYY
              (str) => {
                const parts = str.split('/');
                if (parts.length === 3) {
                  const [month, day, year] = parts;
                  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
                throw new Error('Invalid format');
              },
              // YYYY-MM-DD
              (str) => {
                const parts = str.split('-');
                if (parts.length === 3) {
                  const [year, month, day] = parts;
                  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
                throw new Error('Invalid format');
              },
              // Direct Date constructor
              (str) => new Date(str)
            ];
            
            // Try each format until one works
            for (const format of formats) {
              try {
                const date = format(dateStr);
                if (!isNaN(date.getTime())) return date;
              } catch (e) {
                // Continue to next format
              }
            }
            
            // If all fails, use current date
            return new Date();
          };
          
          return {
            item: row.item || '',
            vendor: row.vendor || '',
            category: row.category || '',
            quantity: parseFloat(row.quantity) || 0,
            dueDate: parseDate(row.dueDate),
            date: parseDate(row.creationDate || new Date().toISOString())
          };
        });
        
        // Filter out orders with invalid data
        const validOrders = importedOrders.filter(order => 
          order.item && !isNaN(order.quantity) && order.quantity > 0 && order.dueDate instanceof Date
        );
        
        // Filter orders for items that exist in stockItems
        const matchingOrders = validOrders.filter(order => 
          stockItems.some(item => item.item === order.item)
        );
        
        if (matchingOrders.length > 0) {
          // Use the parent component's function to update state
          onImportOrders(matchingOrders);
          setImportStatus({ 
            type: 'success', 
            message: `Successfully imported ${matchingOrders.length} orders.${
              matchingOrders.length < validOrders.length ? 
              ` (${validOrders.length - matchingOrders.length} orders skipped - items not found)` : ''
            }`
          });
        } else {
          setImportStatus({ 
            type: 'warning', 
            message: 'No valid orders found in the imported file.'
          });
        }
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        setImportStatus({ 
          type: 'error', 
          message: 'Error parsing CSV: ' + error.message 
        });
      }
    });
  };
  
  // Clear the file input after selection
  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const exportOrders = () => {
    let csvContent = "Item,Vendor,Category,Quantity,Due Date,Creation Date\n";
    
    orderList.forEach(order => {
      csvContent += `${order.item},${order.vendor},${order.category},${order.quantity},${formatDate(order.dueDate)},${formatDate(order.date)}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `order-list-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Format date to YYYY-MM-DD
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };
  
  // Format date to more readable format for display
  const formatDisplayDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };
  
  // Group orders differently based on the selected grouping method
  let groupedOrders = null;
  
  if (groupBy === 'vendor') {
    groupedOrders = _.groupBy(orderList, 'vendor');
  } else if (groupBy === 'category') {
    groupedOrders = _.groupBy(orderList, 'category');
  } else if (groupBy === 'vendor-date') {
    // First group by vendor
    const byVendor = _.groupBy(orderList, 'vendor');
    
    // Then for each vendor, group by date
    groupedOrders = {};
    Object.entries(byVendor).forEach(([vendor, vendorOrders]) => {
      // Group by due date (convert to string for grouping)
      const byDate = _.groupBy(vendorOrders, order => 
        order.dueDate ? new Date(order.dueDate).toISOString().split('T')[0] : 'No Date'
      );
      
      // Store in the hierarchical structure
      groupedOrders[vendor] = byDate;
    });
  }
  
  // Toggle expansion of a vendor group
  const toggleVendorExpansion = (vendor) => {
    setExpandedVendors(prev => ({
      ...prev,
      [vendor]: !prev[vendor]
    }));
  };
  
  const getTomorrowString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  // Calculate totals for vendor groups
  const getVendorTotals = (vendorOrders) => {
    const totalItems = vendorOrders.length;
    const totalQuantity = vendorOrders.reduce((sum, order) => sum + order.quantity, 0);
    return { totalItems, totalQuantity };
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Order List</h3>
          
          <div className="flex space-x-2">
            <select 
              className="px-3 py-2 border rounded"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="none">No Grouping</option>
              <option value="vendor">Group by Vendor</option>
              <option value="category">Group by Category</option>
              <option value="vendor-date">Group by Vendor, then Date</option>
            </select>
            
            <label className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center cursor-pointer">
              <Upload size={16} className="mr-2" />
              Import Orders
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept=".csv" 
                onChange={(e) => {
                  handleOrderImport(e);
                  resetFileInput();
                }}
              />
            </label>
            
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
              onClick={exportOrders}
              disabled={orderList.length === 0}
            >
              <Download size={16} className="mr-2" />
              Export as CSV
            </button>
          </div>
        </div>
        
        {/* Import Status Message */}
        {importStatus && (
          <div className={`mt-3 p-3 rounded ${
            importStatus.type === 'success' ? 'bg-green-100 text-green-800' :
            importStatus.type === 'error' ? 'bg-red-100 text-red-800' :
            importStatus.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {importStatus.type === 'loading' && (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                {importStatus.message}
              </div>
            )}
            {importStatus.type !== 'loading' && importStatus.message}
            {importStatus.type !== 'loading' && (
              <button
                className="float-right text-sm underline"
                onClick={() => setImportStatus(null)}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
        
        {orderList.length > 0 ? (
          <>
            {groupBy === 'none' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orderList.map((order, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.item}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <span>{order.vendor}</span>
                            <button
                              className="ml-2 p-1 text-blue-600 hover:text-blue-800 rounded"
                              onClick={() => openVendorModal(index)}
                              title="Change Vendor"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <input 
                            type="number" 
                            min="1" 
                            className="px-2 py-1 border rounded w-20"
                            value={order.quantity}
                            onChange={(e) => updateQuantity(index, e.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm flex items-center">
                          <Calendar size={14} className="mr-2 text-gray-400" />
                          <input
                            type="date"
                            className="px-2 py-1 border rounded"
                            value={formatDate(order.dueDate) || getTomorrowString()}
                            onChange={(e) => updateDueDate(index, e.target.value)}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button 
                            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            onClick={() => removeOrderItem(index)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {(groupBy === 'vendor' || groupBy === 'category') && (
              <div className="space-y-6">
                {Object.entries(groupedOrders).map(([groupName, items]) => (
                  <div key={groupName} className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-md font-medium text-gray-700 mb-3">
                      {groupBy === 'vendor' ? 'Vendor: ' : 'Category: '}
                      {groupName}
                      <span className="ml-2 text-gray-500 text-sm">
                        ({items.length} items)
                      </span>
                    </h4>
                    
                    <div className="overflow-x-auto bg-white rounded">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                            {groupBy === 'vendor' ? (
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            ) : (
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                            )}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {items.map((order, itemIndex) => {
                            const globalIndex = orderList.findIndex(o => o === order);
                            return (
                              <tr key={itemIndex}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.item}</td>
                                {groupBy === 'vendor' ? (
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.category}</td>
                                ) : (
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex items-center">
                                      <span>{order.vendor}</span>
                                      <button
                                        className="ml-2 p-1 text-blue-600 hover:text-blue-800 rounded"
                                        onClick={() => openVendorModal(globalIndex)}
                                        title="Change Vendor"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <input 
                                    type="number" 
                                    min="1" 
                                    className="px-2 py-1 border rounded w-20"
                                    value={order.quantity}
                                    onChange={(e) => updateQuantity(globalIndex, e.target.value)}
                                  />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm flex items-center">
                                  <Calendar size={14} className="mr-2 text-gray-400" />
                                  <input
                                    type="date"
                                    className="px-2 py-1 border rounded"
                                    value={formatDate(order.dueDate) || getTomorrowString()}
                                    onChange={(e) => updateDueDate(globalIndex, e.target.value)}
                                  />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <div className="flex space-x-2">
                                    <button 
                                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                      onClick={() => removeOrderItem(globalIndex)}
                                    >
                                      Remove
                                    </button>
                                    {groupBy === 'vendor' && (
                                      <button 
                                        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                                        onClick={() => openVendorModal(globalIndex)}
                                        title="Move to another vendor"
                                      >
                                        <Users size={14} className="mr-1" />
                                        Move
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {groupBy === 'vendor-date' && (
              <div className="space-y-6">
                {Object.entries(groupedOrders).map(([vendor, dateGroups]) => {
                  // Calculate the totals for this vendor
                  const vendorOrders = _.flatten(Object.values(dateGroups));
                  const { totalItems, totalQuantity } = getVendorTotals(vendorOrders);
                  
                  return (
                    <div key={vendor} className="border rounded-lg overflow-hidden">
                      {/* Vendor header - clickable to expand/collapse */}
                      <div 
                        className="bg-gray-100 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-200"
                        onClick={() => toggleVendorExpansion(vendor)}
                      >
                        <div>
                          <h4 className="font-medium text-gray-800">
                            Vendor: {vendor}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {totalItems} items • Total quantity: {totalQuantity}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <button className="p-1 text-gray-500 hover:text-gray-700">
                            {expandedVendors[vendor] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </div>
                      </div>
                      
                      {/* Date groups - only shown when vendor is expanded */}
                      {expandedVendors[vendor] && (
                        <div className="divide-y divide-gray-200">
                          {Object.entries(dateGroups).sort().map(([date, orders]) => (
                            <div key={date} className="bg-white">
                              <div className="px-4 py-2 bg-blue-50">
                                <h5 className="font-medium text-blue-800">
                                  Due Date: {formatDisplayDate(date)}
                                  <span className="ml-2 text-blue-600 text-sm">
                                    ({orders.length} items • Total: {orders.reduce((sum, o) => sum + o.quantity, 0)})
                                  </span>
                                </h5>
                              </div>
                              
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-gray-200">
                                    {orders.map((order, itemIndex) => {
                                      const globalIndex = orderList.findIndex(o => o === order);
                                      return (
                                        <tr key={itemIndex}>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.item}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.category}</td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <input 
                                              type="number" 
                                              min="1" 
                                              className="px-2 py-1 border rounded w-20"
                                              value={order.quantity}
                                              onChange={(e) => updateQuantity(globalIndex, e.target.value)}
                                            />
                                          </td>
                                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex space-x-2">
                                              <button 
                                                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                                onClick={() => removeOrderItem(globalIndex)}
                                              >
                                                Remove
                                              </button>
                                              <button 
                                                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-100 flex items-center"
                                                onClick={() => {
                                                  const newDate = prompt("Enter new due date (YYYY-MM-DD):", formatDate(order.dueDate));
                                                  if (newDate) {
                                                    updateDueDate(globalIndex, newDate);
                                                  }
                                                }}
                                              >
                                                <Calendar size={14} className="mr-1 text-gray-500" />
                                                Change date
                                              </button>
                                              <button 
                                                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                                                onClick={() => openVendorModal(globalIndex)}
                                              >
                                                <Users size={14} className="mr-1" />
                                                Move
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Your order list is empty. Add items from the Inventory page or import an order CSV.</p>
          </div>
        )}
      </div>
      
      {/* Vendor Change Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96 max-w-full">
            <h3 className="text-lg font-semibold mb-4">Change Vendor</h3>
            
            {selectedOrderIndex !== null && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Item:</span> {orderList[selectedOrderIndex].item}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <span className="font-medium">Current Vendor:</span> {orderList[selectedOrderIndex].vendor || 'None'}
                </p>
                
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Select New Vendor:
                </label>
                <select
                  className="w-full px-3 py-2 border rounded"
                  value={newVendor}
                  onChange={(e) => setNewVendor(e.target.value)}
                >
                  <option value="">Select a vendor...</option>
                  {allVendors.map(vendor => (
                    <option key={vendor} value={vendor}>{vendor}</option>
                  ))}
                </select>
                
                {/* Option to input a new vendor */}
                <div className="mt-3">
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Or enter a new vendor:
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Enter new vendor name"
                    value={newVendor.includes(allVendors) ? '' : newVendor}
                    onChange={(e) => setNewVendor(e.target.value)}
                  />
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
                onClick={closeVendorModal}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={confirmVendorChange}
                disabled={!newVendor}
              >
                Change Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderManager;