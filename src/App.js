import React, { useState, useEffect } from 'react';
import { Upload, BarChart2, Package, FileText, Truck, CheckCircle, Search, Layers } from 'lucide-react';
import _ from 'lodash';
import Papa from 'papaparse';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import ItemDetail from './components/ItemDetail';
import OrderManager from './components/OrderManager';
import { getTransactionTypeDescription, ceilingRound } from './utils/helpers';

function App() {
  const [stockItems, setStockItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [orderList, setOrderList] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [sidebarSearchTerm, setSidebarSearchTerm] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('all'); // 'all', 'negative', 'needsOrder'
  const [orderGroupBy, setOrderGroupBy] = useState(() => localStorage.getItem('order_groupBy') || 'week');
  
  // State to store the filtered items from the Inventory component
  const [inventoryFilteredItems, setInventoryFilteredItems] = useState([]);
  // State to track which tab the user came from
  const [previousTab, setPreviousTab] = useState(null);
  
  // New state to track the persistent navigation context
  const [navigationContext, setNavigationContext] = useState('all'); // 'all', 'inventory', 'search'
  
  // Data loading and processing function
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    setProcessingStatus('Reading MRP data...');
    
    try {
      const fileContent = await readFileAsText(file);
      processMRPData(fileContent);
    } catch (error) {
      console.error('Error processing file:', error);
      setProcessingStatus('Error processing file: ' + error.message);
      setIsUploading(false);
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
  
  // Helper function to parse dates
  const parseDate = (dateString) => {
    // Handle invalid dates
    if (!dateString || dateString === '00/00/00' || dateString === '00/00/0000' || 
        dateString.includes('00/00') || !isValidDateFormat(dateString)) {
      return new Date();
    }
    
    try {
      // Try parsing the date
      const date = new Date(dateString);
      // Check if the date is valid
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
      // If any error occurs, return today's date
      return new Date();
    }
  };
  
  // Helper to check if date format is valid
  const isValidDateFormat = (dateString) => {
    // Basic format check - can be enhanced for specific formats
    return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateString) || 
           /^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString);
  };
  
  // Process MRP data
  const processMRPData = (fileContent) => {
    setProcessingStatus('Parsing MRP data...');
    
    // Parse CSV with PapaParse
    Papa.parse(fileContent, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        setProcessingStatus('Organizing stock items...');
        
        const parsedStockItems = [];
        let currentItem = null;
        
        try {
          // Process each row in the CSV
          results.data.forEach((row) => {
            if (row.length < 5) return;
            
            const transactionType = parseInt(row[0]);
            
            // Skip Min Balance transactions (type 8)
            if (transactionType === 8) return;
            
            const stockItem = row[1];
            const dueDate = row[2]; // This will be parsed later with the parseDate function
            const partNumber = row[3];
            
            // Handle quantity, sometimes it has quotes or minus signs
            let quantity;
            if (transactionType !== 0) {
              quantity = ceilingRound(row[4].replace('-', '').replace('"', '').replace('"', ''));
            } else {
              quantity = ceilingRound(row[4]);
            }
            
            // Handle vendor and category
            let vendor, purchaseOrderNumber, category;
            
            if (row.length > 8) {
              vendor = row[5];
              purchaseOrderNumber = row[6];
              category = row[7];
            } else {
              vendor = row[5];
              purchaseOrderNumber = row[6];
              category = row[7];
            }
            
            // Parse the date string to a Date object
            const dueDateObj = parseDate(dueDate);
            
            if (transactionType === 0) { // Beginning balance
              currentItem = {
                item: stockItem,
                startingBalance: ceilingRound(row[4]), // Not removing minus sign but rounding up
                vendor,
                category,
                transactions: [], // Start with empty arrays
                workOrders: [],
                openSales: [],
                purchaseOrders: [],
                orders: []
              };
              parsedStockItems.push(currentItem);
            } else if (currentItem) {
              // For all other transaction types, create the transaction object first
              const transactionObj = {
                type: transactionType,
                dueDate: dueDateObj,
                quantity,
                partNumber: transactionType === 1 ? purchaseOrderNumber : partNumber,
                covered: false,
                coverType: null,
                availableQuantity: quantity
              };
              
              // Check if this exact transaction already exists to prevent duplicates during import
              const duplicateExists = currentItem.transactions.some(t => 
                t.type === transactionObj.type &&
                String(t.partNumber) === String(transactionObj.partNumber) &&
                new Date(t.dueDate).getTime() === new Date(dueDateObj).getTime() &&
                t.quantity === quantity
              );
              
              // Only add if this is not a duplicate
              if (!duplicateExists) {
                // Add to transactions array
                currentItem.transactions.push(transactionObj);
                
                // Add to specific arrays based on transaction type
                switch(transactionType) {
                  case 1: // Open PO
                    currentItem.purchaseOrders.push({
                      quantity,
                      dueDate: dueDateObj,
                      purchaseOrderNumber
                    });
                    break;
                  case 3: // Released WO - Adds to inventory (production)
                    currentItem.workOrders.push({
                      partNumber,
                      dueDate: dueDateObj,
                      quantity,
                      availableQuantity: quantity,
                      isReleased: true // Flag to identify it as a released work order
                    });
                    break;
                  case 4: // Open Sale
                    currentItem.openSales.push({
                      partNumber,
                      quantity,
                      dueDate: dueDateObj,
                      covered: false,
                      coverType: null,
                      remainingQuantity: quantity
                    });
                    break;
                  case 6: // Work Order/Issued - Subtracts from inventory (consumption)
                    currentItem.workOrders.push({
                      partNumber,
                      dueDate: dueDateObj,
                      quantity,
                      availableQuantity: quantity,
                      isReleased: false // Flag to identify it as an issued work order
                    });
                    break;
                }
              }
            }
          });
          
          // Match work orders with sales to cover open sales
          parsedStockItems.forEach(item => {
            matchWorkOrdersWithSales(item);
          });
          
          // Generate orders and calculate running balances
          setProcessingStatus('Generating order information...');
          // Use the state variable instead of creating a local constant
          parsedStockItems.forEach(item => {
            generateOrders(item, orderGroupBy);
          });
          
          // Extract unique categories and vendors for filtering
          const uniqueCategories = _.uniq(parsedStockItems.map(item => item.category)).filter(Boolean);
          const uniqueVendors = _.uniq(parsedStockItems.map(item => item.vendor)).filter(Boolean);
          
          setCategories(uniqueCategories);
          setVendors(uniqueVendors);
          setStockItems(parsedStockItems);
          setIsUploading(false);
          setProcessingStatus('Data processed successfully!');
          
          // Set initial selected item
          if (parsedStockItems.length > 0) {
            setSelectedItem(parsedStockItems[0]);
          }
          
        } catch (error) {
          console.error('Error in data processing:', error);
          setProcessingStatus('Error in data processing: ' + error.message);
          setIsUploading(false);
        }
      },
      error: (error) => {
        setProcessingStatus('Error parsing CSV: ' + error.message);
        setIsUploading(false);
      }
    });
  };

  // Match work orders with open sales to prevent double counting
  const matchWorkOrdersWithSales = (item) => {
    // Skip if any required arrays are missing
    if (!item.workOrders || !item.openSales || !item.transactions) {
      return;
    }
    
    // Get all work orders and open sales directly from the item
    // Important: Don't create new array copies - work directly with the references
    const workOrders = item.workOrders;
    const openSales = item.openSales;
    
    // Sort work orders by date (earliest first)
    workOrders.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    // For each work order, try to find and cover matching open sales
    workOrders.forEach(workOrder => {
      // Skip if no part number or no quantity
      if (!workOrder.partNumber || !workOrder.quantity) {
        return;
      }
      
      // Start with full work order quantity available
      let remainingWOQuantity = workOrder.quantity;
      
      // Find matching sales with the same part number that aren't already covered
      const matchingSales = openSales.filter(sale => 
        !sale.covered && 
        String(sale.partNumber) === String(workOrder.partNumber)
      );
      
      // If no exact matches, try to find similar part numbers
      let salesToProcess = matchingSales.length > 0 ? matchingSales : 
        openSales.filter(sale => 
          !sale.covered && (
            String(sale.partNumber).includes(String(workOrder.partNumber)) ||
            String(workOrder.partNumber).includes(String(sale.partNumber))
          )
        );
      
      // Sort sales by date (earliest first)
      salesToProcess.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
      
      // Try to cover each sale with this work order
      salesToProcess.forEach(sale => {
        if (remainingWOQuantity > 0 && !sale.covered) {
          // Calculate how much of this sale we can cover
          const quantityToCover = Math.min(remainingWOQuantity, sale.quantity);
          
          // Mark the sale as covered
          sale.covered = true;
          sale.coverType = workOrder.isReleased ? 'released' : 'issued';
          sale.remainingQuantity = sale.quantity - quantityToCover;
          
          // Reduce the work order's available quantity
          remainingWOQuantity -= quantityToCover;
          
          // Find and update the corresponding transaction in the transactions array
          // Important: Use strict equality comparisons for dates using getTime()
          const saleTransactions = item.transactions.filter(t => 
            t.type === 4 && 
            String(t.partNumber) === String(sale.partNumber) && 
            new Date(t.dueDate).getTime() === new Date(sale.dueDate).getTime() &&
            !t.covered // Only update transactions that aren't already covered
          );
          
          if (saleTransactions.length > 0) {
            // Update only the first matching transaction if multiple exist
            const saleTransaction = saleTransactions[0];
            saleTransaction.covered = true;
            saleTransaction.coverType = sale.coverType; 
            saleTransaction.availableQuantity = sale.remainingQuantity;
          }
        }
      });
      
      // Update the work order's available quantity
      workOrder.availableQuantity = remainingWOQuantity;
      
      // Update the corresponding work order transaction
      const workOrderType = workOrder.isReleased ? 3 : 6; // 3 for Released, 6 for Issued
      const workOrderTransactions = item.transactions.filter(t => 
        t.type === workOrderType && 
        String(t.partNumber) === String(workOrder.partNumber) &&
        new Date(t.dueDate).getTime() === new Date(workOrder.dueDate).getTime()
      );
      
      if (workOrderTransactions.length > 0) {
        // Update only the first matching transaction if multiple exist
        const workOrderTransaction = workOrderTransactions[0];
        workOrderTransaction.availableQuantity = remainingWOQuantity;
      }
    });
    
    // After matching is complete, deduplicate the transactions array
    // This ensures we remove any potential duplicates that might exist
    const uniqueTransactions = [];
    const transactionKeys = new Set();
    
    item.transactions.forEach(transaction => {
      // Create a unique key for each transaction
      // Create a unique key for each transaction
      const key = `${transaction.type}-${transaction.partNumber}-${new Date(transaction.dueDate).getTime()}-${transaction.quantity}`;      
      // Only keep the first occurrence of each transaction
      if (!transactionKeys.has(key)) {
        transactionKeys.add(key);
        uniqueTransactions.push(transaction);
      }
    });
    
    // Replace the transactions array with the deduplicated one
    item.transactions = uniqueTransactions;
  };

  // Helper function to get the Monday of a week
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    return new Date(d.setDate(diff));
  };

  // Helper function to get the first day of a month
  const getMonthStart = (date) => {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  };
  
  // Modified generateOrders function to support grouping by week or month
  const generateOrders = (item, groupBy = 'week') => {
    // Sort transactions by date
    item.transactions = _.sortBy(item.transactions, 'dueDate');
    
    // Calculate running balance and determine orders
    let currentBalance = item.startingBalance;
    
    // If starting balance is negative, create an order
    if (currentBalance < 0) {
      item.orders.push({
        dueDate: new Date(),
        quantity: Math.abs(currentBalance),
        partNumber: "Negative Balance",
        vendor: item.vendor,
        category: item.category
      });
      currentBalance = 0;
    }
    
    // Process each transaction and determine if orders are needed
    item.transactions.forEach(transaction => {
      if (transaction.type === 1) { // Purchase Order
        currentBalance += transaction.quantity;
      } 
      else if (transaction.type === 3) { // Released WO - ADDS to inventory
        currentBalance += transaction.quantity;
      }
      else if (transaction.type === 4) { // Open Sales
        // Only subtract if the sale is not covered by a work order
        if (!transaction.covered) {
          currentBalance -= transaction.availableQuantity;
          
          // Create order if balance goes negative
          if (currentBalance < 0) {
            item.orders.push({
              dueDate: new Date(transaction.dueDate),
              quantity: Math.abs(currentBalance),
              partNumber: transaction.partNumber,
              vendor: item.vendor,
              category: item.category
            });
            currentBalance = 0;
          }
        }
      }
      else if (transaction.type === 6) { // Issued WO - SUBTRACTS from inventory
        // Subtract the work order quantity
        currentBalance -= transaction.quantity;
        
        // Create order if balance goes negative
        if (currentBalance < 0) {
          item.orders.push({
            dueDate: new Date(transaction.dueDate),
            quantity: Math.abs(currentBalance),
            partNumber: transaction.partNumber,
            vendor: item.vendor,
            category: item.category
          });
          currentBalance = 0;
        }
      }
    });
    
    // Group orders by selected time period (week or month)
    const getGroupKey = (date) => {
      if (groupBy === 'month') {
        const monthStart = getMonthStart(date);
        return `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`;
      } else {
        // Default to week
        const weekStart = getWeekStart(date);
        return `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      }
    };
    
    const ordersByGroup = _.groupBy(item.orders, order => getGroupKey(order.dueDate));
    
    // Generate grouped orders (weekly or monthly)
    item.groupedOrders = Object.entries(ordersByGroup).map(([groupKey, orders]) => {
      // Get the first date in the group as the reference date
      const groupDate = groupBy === 'month' 
        ? getMonthStart(orders[0].dueDate)
        : getWeekStart(orders[0].dueDate);
      
      return {
        groupKey,
        groupDate,
        groupBy, // Store the grouping method used
        dueDate: new Date(orders[0].dueDate),
        quantity: _.sumBy(orders, 'quantity'),
        vendor: item.vendor,
        category: item.category
      };
    });
    
    // Sort grouped orders by date
    item.groupedOrders = _.sortBy(item.groupedOrders, 'groupDate');
    
    // Keep the monthlyOrders for backward compatibility (renamed to groupedOrders)
    item.monthlyOrders = item.groupedOrders;
    
    // Calculate running totals for visualization
    item.runningTotals = [];
    let balance = item.startingBalance;
    
    const sortedTransactions = _.sortBy(item.transactions, 'dueDate');
    sortedTransactions.forEach(transaction => {
      if (transaction.type === 1) { // Purchase Order
        balance += transaction.quantity;
      }
      else if (transaction.type === 3) { // Released WO - ADDS to inventory
        balance += transaction.quantity;
      }
      else if (transaction.type === 4) { // Open Sales
        // Only subtract if the sale is not covered by a work order
        if (!transaction.covered) {
          balance -= transaction.availableQuantity;
        }
      }
      else if (transaction.type === 6) { // Issued WO - SUBTRACTS from inventory
        balance -= transaction.quantity;
      }
      
      item.runningTotals.push({
        date: transaction.dueDate,
        balance,
        type: transaction.type,
        description: getTransactionTypeDescription(transaction.type)
      });
    });
  };
  
  // Dashboard handlers for card clicks
  const handleDashboardCardClick = (action) => {
    switch(action) {
      case 'totalItems':
        setInventoryFilter('all');
        setNavigationContext('inventory'); // Set context when going to inventory
        setActiveTabWithTracking('inventory');
        break;
      case 'negativeBalance':
        setInventoryFilter('negative');
        setNavigationContext('inventory'); // Set context when going to filtered inventory
        setActiveTabWithTracking('inventory');
        break;
      case 'requiresOrder':
        setInventoryFilter('needsOrder');
        setNavigationContext('inventory'); // Set context when going to filtered inventory
        setActiveTabWithTracking('inventory');
        break;
      default:
        break;
    }
  };
  
  // Add to order list function with due date support
 // Add to order list function with due date support and updates to item data
const addToOrderList = (item, quantity, dueDate) => {
  // Default to tomorrow if no date provided
  const orderDueDate = dueDate || getTomorrowDate();
  
  // Create a unique ID for this order for better identification
  const orderId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  
  // Check if there's an existing order for this item with the SAME due date
  const existingIndex = orderList.findIndex(order => 
    order.item === item.item && 
    order.dueDate.toDateString() === orderDueDate.toDateString()
  );
  
  if (existingIndex >= 0) {
    // If order with same item and due date exists, add quantities
    const updatedOrders = [...orderList];
    updatedOrders[existingIndex].quantity += quantity;
    setOrderList(updatedOrders);
    
    // Find the corresponding item in stockItems
    const itemIndex = stockItems.findIndex(si => si.item === item.item);
    if (itemIndex >= 0) {
      const updatedStockItems = [...stockItems];
      const stockItem = updatedStockItems[itemIndex];
      
      // Update the existing transaction and purchase order
      // Find the matching transaction and PO by date
      const existingPO = stockItem.purchaseOrders.find(po => 
        new Date(po.dueDate).toDateString() === orderDueDate.toDateString()
      );
      
      if (existingPO) {
        // Update the PO quantity
        existingPO.quantity += quantity;
        
        // Update the corresponding transaction
        const matchingTransaction = stockItem.transactions.find(t => 
          t.type === 1 && // PO type
          t.partNumber === existingPO.purchaseOrderNumber &&
          new Date(t.dueDate).toDateString() === orderDueDate.toDateString()
        );
        
        if (matchingTransaction) {
          matchingTransaction.quantity += quantity;
          matchingTransaction.availableQuantity += quantity;
        }
        
        // Regenerate orders with updated quantities
        generateOrders(stockItem, orderGroupBy);
        
        // Update the stock items array
        setStockItems(updatedStockItems);
      }
    }
  } else {
    // Create a new order
    // Add to order list first
    setOrderList([
      ...orderList,
      {
        id: orderId,
        item: item.item,
        vendor: item.vendor,
        category: item.category,
        quantity,
        date: new Date(), // Creation date
        dueDate: orderDueDate // When the order is needed
      }
    ]);
    
    // Now add it to the item's transactions and purchase orders
    const itemIndex = stockItems.findIndex(si => si.item === item.item);
    if (itemIndex >= 0) {
      const updatedStockItems = [...stockItems];
      const stockItem = updatedStockItems[itemIndex];
      
      // Create a unique PO number for this order
      const poNumber = `UI-${new Date().getTime().toString(36)}-${Math.floor(Math.random() * 1000)}`;
      
      // Create a transaction for this order (type 1 = Open PO)
      const transaction = {
        type: 1, // Open PO
        dueDate: orderDueDate,
        quantity: quantity,
        partNumber: poNumber,
        covered: false,
        coverType: null,
        availableQuantity: quantity
      };
      
      // Add to transactions array
      if (!stockItem.transactions) {
        stockItem.transactions = [];
      }
      stockItem.transactions.push(transaction);
      
      // Add to purchaseOrders array
      if (!stockItem.purchaseOrders) {
        stockItem.purchaseOrders = [];
      }
      stockItem.purchaseOrders.push({
        quantity: quantity,
        dueDate: orderDueDate,
        purchaseOrderNumber: poNumber
      });
      
      // Regenerate orders and running totals
      generateOrders(stockItem, orderGroupBy);
      
      // Update stockItems state
      setStockItems(updatedStockItems);
    }
  }
};

  // New function to update an existing order
  // New function to update an existing order
// New function to update an existing order
const updateOrder = (orderIndex, updatedFields) => {
  // Check if this is a special "remove" operation
  if (updatedFields && updatedFields.__remove === true) {
    const orderToRemove = orderList[orderIndex];
    
    // Remove the order at this index
    const newOrderList = [...orderList];
    newOrderList.splice(orderIndex, 1);
    setOrderList(newOrderList);
    
    // Find the corresponding item and update its transactions and orders
    const itemIndex = stockItems.findIndex(si => si.item === orderToRemove.item);
    if (itemIndex >= 0) {
      const updatedStockItems = [...stockItems];
      const stockItem = updatedStockItems[itemIndex];
      
      // Find all POs that match the order's date and might match the order
      const matchingPOs = stockItem.purchaseOrders.filter(po => 
        new Date(po.dueDate).toDateString() === new Date(orderToRemove.dueDate).toDateString()
      );
      
      // Try to find the exact PO that matches this order
      let poToRemove = null;
      
      if (matchingPOs.length === 1) {
        // Only one PO on this date, must be this one
        poToRemove = matchingPOs[0];
      } else {
        // Multiple POs on this date, find one with matching quantity
        poToRemove = matchingPOs.find(po => po.quantity === orderToRemove.quantity);
      }
      
      if (poToRemove) {
        // Remove from purchaseOrders array
        stockItem.purchaseOrders = stockItem.purchaseOrders.filter(po => po !== poToRemove);
        
        // Remove corresponding transaction
        stockItem.transactions = stockItem.transactions.filter(t => 
          !(t.type === 1 && 
            t.partNumber === poToRemove.purchaseOrderNumber && 
            new Date(t.dueDate).toDateString() === new Date(poToRemove.dueDate).toDateString())
        );
        
        // Regenerate orders
        generateOrders(stockItem, orderGroupBy);
        
        // Update the stock items array
        setStockItems(updatedStockItems);
      }
    }
    
    return;
  }
  
  // Regular update
  const updatedOrders = [...orderList];
  const existingOrder = {...updatedOrders[orderIndex]};
  
  // Check what fields are being updated
  const quantityChanged = updatedFields.quantity !== undefined && 
                          updatedFields.quantity !== existingOrder.quantity;
  const dueDateChanged = updatedFields.dueDate !== undefined && 
                         (updatedFields.dueDate !== existingOrder.dueDate &&
                          new Date(updatedFields.dueDate).getTime() !== new Date(existingOrder.dueDate).getTime());
  
  // Update the specified order with the new fields
  updatedOrders[orderIndex] = {
    ...existingOrder,
    ...updatedFields
  };
  
  // If either quantity or due date changed, update the corresponding transaction and PO in stockItems
  if (quantityChanged || dueDateChanged) {
    // Find the corresponding item
    const itemIndex = stockItems.findIndex(si => si.item === existingOrder.item);
    if (itemIndex >= 0) {
      const updatedStockItems = [...stockItems];
      const stockItem = updatedStockItems[itemIndex];
      
      // Find matching PO
      const matchingPOs = stockItem.purchaseOrders.filter(po => 
        new Date(po.dueDate).toDateString() === new Date(existingOrder.dueDate).toDateString()
      );
      
      let poToUpdate = null;
      
      if (matchingPOs.length === 1) {
        // Only one PO on this date, must be this one
        poToUpdate = matchingPOs[0];
      } else {
        // Multiple POs on this date, find one with matching quantity
        poToUpdate = matchingPOs.find(po => po.quantity === existingOrder.quantity);
      }
      
      if (poToUpdate) {
        // Update PO
        if (quantityChanged) {
          poToUpdate.quantity = updatedFields.quantity;
        }
        if (dueDateChanged) {
          poToUpdate.dueDate = new Date(updatedFields.dueDate);
        }
        
        // Find and update corresponding transaction
        const transactionToUpdate = stockItem.transactions.find(t => 
          t.type === 1 && 
          t.partNumber === poToUpdate.purchaseOrderNumber && 
          new Date(t.dueDate).toDateString() === new Date(existingOrder.dueDate).toDateString()
        );
        
        if (transactionToUpdate) {
          if (quantityChanged) {
            transactionToUpdate.quantity = updatedFields.quantity;
            transactionToUpdate.availableQuantity = updatedFields.quantity;
          }
          if (dueDateChanged) {
            transactionToUpdate.dueDate = new Date(updatedFields.dueDate);
          }
        }
        
        // Regenerate orders to update recommendations
        generateOrders(stockItem, orderGroupBy);
        
        // Update the stock items array
        setStockItems(updatedStockItems);
      }
    }
  }
  
  setOrderList(updatedOrders);
};

  // Handle importing orders from CSV
  const handleImportOrders = (importedOrders) => {
    if (!importedOrders || importedOrders.length === 0) return;
    
    setIsUploading(true);
    setProcessingStatus('Processing imported orders...');
    
    try {
      // Create a copy of stockItems to modify
      const updatedStockItems = [...stockItems];
      let ordersAdded = 0;
      // Create an array to collect orders for the orderList
      const newOrders = [];
      
      importedOrders.forEach(order => {
        // Find the matching item
        const itemIndex = updatedStockItems.findIndex(si => si.item === order.item);
        if (itemIndex >= 0) {
          const item = updatedStockItems[itemIndex];
          
          // Create a unique PO number for imported orders
          const poNumber = `IMP-${new Date().getTime().toString(36)}-${Math.floor(Math.random() * 1000)}`;
          
          // Create a transaction for this order (type 1 = Open PO)
          const transaction = {
            type: 1, // Open PO
            dueDate: new Date(order.dueDate),
            quantity: order.quantity,
            partNumber: poNumber,
            covered: false,
            coverType: null,
            availableQuantity: order.quantity
          };
          
          // Add to transactions array
          if (!item.transactions) {
            item.transactions = [];
          }
          item.transactions.push(transaction);
          
          // Add to purchaseOrders array
          if (!item.purchaseOrders) {
            item.purchaseOrders = [];
          }
          item.purchaseOrders.push({
            quantity: order.quantity,
            dueDate: new Date(order.dueDate),
            purchaseOrderNumber: poNumber
          });
          
          // Regenerate orders and running totals
          generateOrders(item, orderGroupBy);
          ordersAdded++;
          
          // Also add to the newOrders array to update the orderList
          newOrders.push({
            id: poNumber, // Use the PO number as ID
            item: order.item,
            vendor: item.vendor,
            category: item.category,
            quantity: order.quantity,
            date: new Date(), // Current date as creation date
            dueDate: new Date(order.dueDate),
            importedOrder: true // Flag to identify imported orders
          });
        }
      });
      
      // Update stockItems state
      setStockItems(updatedStockItems);
      
      // Update orderList state with the new orders
      if (newOrders.length > 0) {
        setOrderList(prevOrders => [...prevOrders, ...newOrders]);
      }
      
      // Show success message
      setProcessingStatus(`Successfully imported ${ordersAdded} orders as purchase orders.`);
      setTimeout(() => {
        setProcessingStatus('');
        setIsUploading(false);
      }, 3000);
    } catch (error) {
      console.error('Error processing imported orders:', error);
      setProcessingStatus('Error processing imported orders: ' + error.message);
      setTimeout(() => {
        setProcessingStatus('');
        setIsUploading(false);
      }, 3000);
    }
  };

  // Add to check list function
  // Update this function in App.js
const addToCheckList = (item, transaction, note = '') => {
  // Get the existing check on list from localStorage
  const existingCheckOnList = JSON.parse(localStorage.getItem('inventory_checkOnList') || '[]');
  
  // Check if this transaction is already in the list
  const exists = existingCheckOnList.some(entry => 
    entry.item === item.item && 
    entry.transaction.dueDate === transaction.dueDate &&
    entry.transaction.type === transaction.type &&
    entry.transaction.partNumber === transaction.partNumber
  );
  
  if (!exists) {
    const newEntry = {
      item: item.item,
      itemData: item,
      transaction,
      addedDate: new Date(),
      notes: note // Use the provided note instead of empty string
    };
    
    const updatedList = [...existingCheckOnList, newEntry];
    localStorage.setItem('inventory_checkOnList', JSON.stringify(updatedList));
    
    // Show temporary success message
    setProcessingStatus(`Added ${item.item} - ${getTransactionTypeDescription(transaction.type)} to Check On list`);
    setTimeout(() => {
      setProcessingStatus('');
    }, 3000);
  } else {
    // Item already exists in check list
    setProcessingStatus(`This transaction is already in your Check On list`);
    setTimeout(() => {
      setProcessingStatus('');
    }, 3000);
  }
};

  // Handle receiving a PO
  const handleReceivePO = (item, transaction) => {
    // Find the item in stockItems array
    const updatedStockItems = stockItems.map(stockItem => {
      if (stockItem.item === item.item) {
        // Create a copy of the item
        const updatedItem = {...stockItem};
        
        // Update the starting balance by adding the PO quantity
        updatedItem.startingBalance += transaction.quantity;
        
        // Remove the transaction from transactions array
        updatedItem.transactions = updatedItem.transactions.filter(t => 
          !(t.type === 1 && 
            t.partNumber === transaction.partNumber && 
            new Date(t.dueDate).getTime() === new Date(transaction.dueDate).getTime() &&
            t.quantity === transaction.quantity)
        );
        
        // Remove the PO from purchaseOrders array
        updatedItem.purchaseOrders = updatedItem.purchaseOrders.filter(po => 
          !(po.purchaseOrderNumber === transaction.partNumber && 
            new Date(po.dueDate).getTime() === new Date(transaction.dueDate).getTime() &&
            po.quantity === transaction.quantity)
        );
        
        // Recalculate running totals
        updatedItem.runningTotals = [];
        let balance = updatedItem.startingBalance;
        
        const sortedTransactions = _.sortBy(updatedItem.transactions, 'dueDate');
        sortedTransactions.forEach(t => {
          if (t.type === 1) { // Purchase Order
            balance += t.quantity;
          } else if (t.type === 3) { // Released WO - ADDS to inventory
            balance += t.quantity;
          } else if (t.type === 4) { // Open Sales
            // Only subtract if not covered by a work order
            if (!t.covered) {
              balance -= t.availableQuantity;
            }
          } else if (t.type === 6) { // Issued WO - SUBTRACTS from inventory
            balance -= t.quantity;
          }
          
          updatedItem.runningTotals.push({
            date: t.dueDate,
            balance,
            type: t.type,
            description: getTransactionTypeDescription(t.type)
          });
        });
        
        // Regenerate any needed orders based on the new balance
        generateOrders(updatedItem, orderGroupBy);
        
        // Return the updated item
        return updatedItem;
      }
      
      // Return unchanged item if not the target
      return stockItem;
    });
    
    // Update the stockItems state
    setStockItems(updatedStockItems);
    
    // Update the selectedItem if it matches
    if (selectedItem && selectedItem.item === item.item) {
      const updatedSelectedItem = updatedStockItems.find(i => i.item === item.item);
      setSelectedItem(updatedSelectedItem);
    }
    
    // Set a status message
    setProcessingStatus(`Received PO: ${transaction.partNumber} for ${transaction.quantity} units of ${item.item}`);
    setTimeout(() => {
      setProcessingStatus('');
    }, 3000);
  };

  // Helper function to get tomorrow's date
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  };
  
  // Sidebar search function
  const handleSidebarSearch = (e) => {
    e.preventDefault();
    
    // If there's a search term, find the item and display it
    if (sidebarSearchTerm.trim()) {
      const foundItem = stockItems.find(item => 
        item.item.toLowerCase().includes(sidebarSearchTerm.toLowerCase())
      );
      
      if (foundItem) {
        setSelectedItem(foundItem);
        setNavigationContext('search'); // Set context to search when using sidebar search
        setActiveTabWithTracking('item-detail');
      } else {
        // If not found, show a temporary message
        setProcessingStatus(`Item "${sidebarSearchTerm}" not found`);
        setTimeout(() => {
          setProcessingStatus('');
        }, 3000);
      }
    }
  };
  
  // Function to update the inventory filtered items
  const updateInventoryFilteredItems = (filteredList) => {
    setInventoryFilteredItems(filteredList);
  };

  // Modified function to set the active tab and track the previous tab
  const setActiveTabWithTracking = (tab) => {
    setPreviousTab(activeTab);
    setActiveTab(tab);
    
    // If navigating to inventory, update the navigation context
    if (tab === 'inventory') {
      setNavigationContext('inventory');
    }
    
    // If navigating to item detail directly from sidebar search, set context to 'search'
    // This is handled in handleSidebarSearch
  };
  
  // Custom function to handle item selection from inventory
  const handleSelectItemFromInventory = (item) => {
    setSelectedItem(item);
    setNavigationContext('inventory'); // Set context when selecting from inventory
  };
  
  // Filter items based on category, vendor, and search term
  const filteredItems = stockItems.filter(item => {
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesVendor = vendorFilter === 'all' || item.vendor === vendorFilter;
    const matchesSearch = !searchTerm || item.item.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesInventoryFilter = 
      inventoryFilter === 'all' ? true :
      inventoryFilter === 'negative' ? item.startingBalance < 0 :
      inventoryFilter === 'needsOrder' ? (item.orders && item.orders.length > 0) :
      true;
    
    return matchesCategory && matchesVendor && matchesSearch && matchesInventoryFilter;
  });
  
  // Find current item index in the correct filtered list
  const getCurrentItemIndex = () => {
    if (!selectedItem) return -1;
    
    // Use navigation context to determine which list to use
    if (navigationContext === 'inventory') {
      return inventoryFilteredItems.findIndex(item => item.item === selectedItem.item);
    } else {
      // For 'all' or 'search' context, use the App's filtered items
      return filteredItems.findIndex(item => item.item === selectedItem.item);
    }
  };
  
  // Get the correct list for navigation based on navigation context
  const getNavigationItems = () => {
    // Use navigation context to determine which list to use
    if (navigationContext === 'inventory') {
      return inventoryFilteredItems;
    } else {
      // For 'all' or 'search' context, use the App's filtered items
      return filteredItems;
    }
  };
  
  // Functions to handle tab switching
  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard':
        return <Dashboard 
                stockItems={stockItems} 
                onCardClick={handleDashboardCardClick}
              />;
      case 'inventory':
        return <Inventory 
                items={filteredItems} 
                onSelectItem={handleSelectItemFromInventory} // Use the custom handler
                selectedItem={selectedItem}
                onAddToOrder={addToOrderList}
                setActiveTab={setActiveTabWithTracking} // Use the tracking function
                stockItems={stockItems}
                categories={categories}
                vendors={vendors}
                updateFilteredItems={updateInventoryFilteredItems} // Pass the update function
              />;
      case 'item-detail':
        const currentItemIndex = getCurrentItemIndex();
        const navigationItems = getNavigationItems();
        
        return selectedItem ? 
              <ItemDetail 
                item={selectedItem} 
                onAddToOrder={addToOrderList}
                filteredItems={navigationItems} // Use the correct list for navigation
                currentItemIndex={currentItemIndex}
                setSelectedItem={setSelectedItem}
                orderList={orderList}
                onUpdateOrder={updateOrder} // Pass the new update function
                onAddToCheckList={addToCheckList}
                onReceivePO={handleReceivePO}
              /> : 
              <div className="p-4 text-gray-500">Please select an item</div>;
      case 'orders':
        return <OrderManager 
                orderList={orderList} 
                setOrderList={setOrderList} 
                stockItems={stockItems}
                onUpdateOrder={updateOrder} // Pass the update function here too
                onImportOrders={handleImportOrders} // Pass the import function
              />;
      default:
        return <Dashboard 
                stockItems={stockItems} 
                onCardClick={handleDashboardCardClick}
              />;
    }
  };
  
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-gray-800">MRP System</h1>
        </div>
        
        <div className="p-4">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Upload MRP Data
            <div className="mt-1 flex items-center">
              <label className="flex items-center px-4 py-2 bg-blue-600 text-white rounded cursor-pointer hover:bg-blue-700">
                <Upload size={16} className="mr-2" />
                <span>Upload CSV</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".csv" 
                  onChange={handleFileUpload} 
                  disabled={isUploading}
                />
              </label>
            </div>
          </label>
          
          {processingStatus && (
            <div className="mt-2 text-sm text-gray-600">
              {isUploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  {processingStatus}
                </div>
              ) : (
                <div className="flex items-center">
                  <CheckCircle size={16} className="text-green-500 mr-2" />
                  {processingStatus}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Sidebar Search */}
        <div className="px-4 pt-2 pb-4 border-b">
          <form onSubmit={handleSidebarSearch}>
            <div className="flex">
              <input
                type="text"
                placeholder="Search for item..."
                className="pl-10 pr-4 py-2 border rounded-l w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={sidebarSearchTerm}
                onChange={(e) => setSidebarSearchTerm(e.target.value)}
              />
              <button 
                type="submit"
                className="px-3 py-2 bg-blue-600 text-white rounded-r hover:bg-blue-700"
              >
                <Search size={16} />
              </button>
            </div>
          </form>
        </div>
        
        <nav className="mt-4">
          <button 
            className={`flex items-center w-full px-4 py-2 text-left ${activeTab === 'dashboard' ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveTabWithTracking('dashboard')}
          >
            <BarChart2 size={18} className="mr-2" />
            Dashboard
          </button>
          
          <button 
            className={`flex items-center w-full px-4 py-2 text-left ${activeTab === 'inventory' ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => {
              setInventoryFilter('all'); // Reset inventory filter when clicking directly
              setNavigationContext('inventory'); // Set context when going to inventory
              setActiveTabWithTracking('inventory');
            }}
          >
            <Package size={18} className="mr-2" />
            Inventory
          </button>
          
          {selectedItem && (
            <button 
              className={`flex items-center w-full px-4 py-2 text-left ${activeTab === 'item-detail' ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
              onClick={() => setActiveTabWithTracking('item-detail')}
            >
              <FileText size={18} className="mr-2" />
              Item Details
            </button>
          )}
          
          <button 
            className={`flex items-center w-full px-4 py-2 text-left ${activeTab === 'orders' ? 'bg-blue-100 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveTabWithTracking('orders')}
          >
            <Truck size={18} className="mr-2" />
            Order Management
            {orderList.length > 0 && (
              <span className="ml-auto bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">
                {orderList.length}
              </span>
            )}
          </button>
        </nav>
      </div>
      
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'inventory' && (() => {
              if (inventoryFilter === 'negative') return 'Inventory - Negative Balance Items';
              if (inventoryFilter === 'needsOrder') return 'Inventory - Items Requiring Orders';
              return 'Inventory';
            })()}
            {activeTab === 'item-detail' && selectedItem ? `Item: ${selectedItem.item}` : 'Item Details'}
            {activeTab === 'orders' && 'Order Management'}
          </h2>
        </div>
        
        {/* Main content area */}
        <div className="p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default App;