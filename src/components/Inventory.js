import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, X, AlertTriangle, Calendar, PrinterIcon, Clock, CheckCircle } from 'lucide-react';
import { getTransactionTypeDescription } from '../utils/helpers';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import _ from 'lodash';

function Inventory({ items, onSelectItem, selectedItem, onAddToOrder, setActiveTab, stockItems, categories, vendors, updateFilteredItems }) {
  // Refs
  const contentRef = useRef(null);
  const quantityInputRef = useRef(null);
  
  // Get persisted state from localStorage
  const getPersistedState = (key, defaultValue) => {
    const saved = localStorage.getItem(`inventory_${key}`);
    return saved !== null ? JSON.parse(saved) : defaultValue;
  };

  // State variables
  const [expandedItems, setExpandedItems] = useState({});
  const [orderQuantity, setOrderQuantity] = useState({});
  const [showOrderPrompt, setShowOrderPrompt] = useState(null);
  const [searchTerm, setSearchTerm] = useState(getPersistedState('searchTerm', ''));
  //const [sortOption, setSortOption] = useState(getPersistedState('sortOption', 'transactions'));

  // Add this with other state variables at the top of the component
const [highlightBeforeDate, setHighlightBeforeDate] = useState('');
  const [sortOption, setSortOption] = useState(() => {
    const saved = localStorage.getItem('inventory_sortOption');
    if (saved) {
      const parsedSaved = JSON.parse(saved);
      // Map old options to new ones
      if (parsedSaved === 'transactions' || parsedSaved === 'negative') {
        return 'orders';
      }
      return parsedSaved;
    }
    return 'alphabetical'; // New default is alphabetical
  });
  const [selectedCategories, setSelectedCategories] = useState(getPersistedState('selectedCategories', []));
  const [selectedVendors, setSelectedVendors] = useState(getPersistedState('selectedVendors', []));
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showVendorFilter, setShowVendorFilter] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [includeGraphs, setIncludeGraphs] = useState(true);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [weeklyOrderSuggestions, setWeeklyOrderSuggestions] = useState({});
  const [positiveBalanceTransactions, setPositiveBalanceTransactions] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [expandedGroups2, setExpandedGroups2] = useState({});  // For all transactions
  const [viewMode, setViewMode] = useState(getPersistedState('viewMode', 'list')); // 'list' or 'transactions'
  const [showOnlyActive, setShowOnlyActive] = useState(getPersistedState('showOnlyActive', true)); 
  const [scrollPosition, setScrollPosition] = useState(getPersistedState('scrollPosition', 0));
  // State for "Check On" list
  const [checkOnList, setCheckOnList] = useState(getPersistedState('checkOnList', []));
  const [showCheckOnPanel, setShowCheckOnPanel] = useState(false);
  const [orderGroupBy, setOrderGroupBy] = useState(() => {
    return localStorage.getItem('order_groupBy') || 'week';
  });
  // New state for lead time weeks
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(getPersistedState('leadTimeWeeks', 7));
  
  // Save state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('inventory_searchTerm', JSON.stringify(searchTerm));
  }, [searchTerm]);
  
  useEffect(() => {
    localStorage.setItem('inventory_sortOption', JSON.stringify(sortOption));
  }, [sortOption]);
  
  useEffect(() => {
    localStorage.setItem('inventory_selectedCategories', JSON.stringify(selectedCategories));
  }, [selectedCategories]);
  
  useEffect(() => {
    localStorage.setItem('inventory_selectedVendors', JSON.stringify(selectedVendors));
  }, [selectedVendors]);
  
  useEffect(() => {
    localStorage.setItem('inventory_viewMode', JSON.stringify(viewMode));
  }, [viewMode]);
  
  useEffect(() => {
    localStorage.setItem('inventory_showOnlyActive', JSON.stringify(showOnlyActive));
  }, [showOnlyActive]);
  
  useEffect(() => {
    localStorage.setItem('inventory_scrollPosition', JSON.stringify(scrollPosition));
  }, [scrollPosition]);
  
  useEffect(() => {
    localStorage.setItem('inventory_checkOnList', JSON.stringify(checkOnList));
  }, [checkOnList]);
  
  useEffect(() => {
    localStorage.setItem('inventory_leadTimeWeeks', JSON.stringify(leadTimeWeeks));
  }, [leadTimeWeeks]);
  
  useEffect(() => {
    localStorage.setItem('order_groupBy', orderGroupBy);
  }, [orderGroupBy]);
  
  // Restore scroll position after render
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = scrollPosition;
    }
    
    // Set up scroll position saving when user navigates away
    const handleBeforeUnload = () => {
      if (contentRef.current) {
        localStorage.setItem('inventory_scrollPosition', JSON.stringify(contentRef.current.scrollTop));
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save scroll position when component unmounts
      if (contentRef.current) {
        setScrollPosition(contentRef.current.scrollTop);
      }
    };
  }, []);
  
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
  
  // Toggle expanded state for all transactions
  const toggleExpandAllTransactions = (itemId) => {
    setExpandedGroups2(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };
  
  // Navigate to item details page
  const goToItemDetail = (item) => {
    // Save current scroll position before navigation
    if (contentRef.current) {
      setScrollPosition(contentRef.current.scrollTop);
    }
    onSelectItem(item);
    setActiveTab('item-detail');
  };
  
  // Show order quantity prompt with auto-focus and text selection
  const promptOrderQuantity = (item) => {
    // Initialize order quantity if not already set
    if (!orderQuantity[item.item]) {
      setOrderQuantity(prev => ({
        ...prev,
        [item.item]: Math.abs(item.startingBalance < 0 ? item.startingBalance : 0) || 1
      }));
    }
    setShowOrderPrompt(item.item);
    
    // Focus the input field and select all text after state update
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
        quantityInputRef.current.select(); // Select all text in the input
      }
    }, 0);
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
  
  // Add transaction to "Check On" list
  const addToCheckOnList = (item, transaction) => {
    // Check if this transaction is already in the list
    const exists = checkOnList.some(entry => 
      entry.item === item.item && 
      entry.transaction.dueDate === transaction.dueDate &&
      entry.transaction.type === transaction.type &&
      entry.transaction.partNumber === transaction.partNumber
    );
    
    if (!exists) {
      setCheckOnList([
        ...checkOnList,
        {
          item: item.item,
          itemData: item,
          transaction,
          addedDate: new Date(),
          notes: ''
        }
      ]);
    }
  };
  
  // Remove from "Check On" list
  const removeFromCheckOnList = (index) => {
    const newList = [...checkOnList];
    newList.splice(index, 1);
    setCheckOnList(newList);
  };
  
  // Update notes for a "Check On" item
  const updateCheckOnNotes = (index, notes) => {
    const newList = [...checkOnList];
    newList[index].notes = notes;
    setCheckOnList(newList);
  };
  
  // Print the Check On list
  const printCheckOnList = () => {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert("Please allow popups for this website to enable printing.");
      return;
    }
    
    // Format the date as MM/DD/YYYY
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    };
    
    // HTML content for the print window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Check On List - ${new Date().toLocaleDateString()}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 20px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 10px;
            text-align: center;
          }
          .date {
            text-align: center;
            margin-bottom: 20px;
            font-size: 14px;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .item-header {
            font-weight: bold;
            font-size: 16px;
            margin-top: 25px;
            margin-bottom: 5px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .metadata {
            font-size: 14px;
            color: #555;
            margin-bottom: 10px;
          }
          .notes {
            margin-top: 10px;
            padding: 8px;
            background-color: #f9f9f9;
            border-radius: 4px;
          }
          .notes-label {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .status-overdue {
            color: #e53e3e;
            font-weight: bold;
          }
          .status-upcoming {
            color: #dd6b20;
          }
          .status-normal {
            color: #2b6cb0;
          }
          @media print {
            body {
              margin: 0.5in;
              font-size: 12pt;
            }
            .no-print {
              display: none;
            }
            table {
              page-break-inside: avoid;
            }
            .page-break {
              page-break-before: always;
            }
          }
        </style>
      </head>
      <body>
        <h1>MRP System - Check On List</h1>
        <div class="date">Generated on ${new Date().toLocaleString()}</div>
        
        <div class="no-print" style="text-align: center; margin: 20px 0;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Print List
          </button>
        </div>
    `);
    
    // Group by vendor
    const groupedByVendor = _.groupBy(checkOnList, entry => entry.itemData?.vendor || 'No Vendor');
    
    // For each vendor, create a section
    Object.entries(groupedByVendor).forEach(([vendor, entries]) => {
      printWindow.document.write(`
        <div class="item-header">${vendor}</div>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Transaction</th>
              <th>Due Date</th>
              <th>Quantity</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
      `);
      
      // Sort entries by due date (earliest first)
      const sortedEntries = _.sortBy(entries, entry => new Date(entry.transaction.dueDate));
      
      sortedEntries.forEach(entry => {
        const dueDate = new Date(entry.transaction.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let statusClass = 'status-normal';
        if (dueDate < today) {
          statusClass = 'status-overdue';
        } else if (dueDate <= new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)) {
          statusClass = 'status-upcoming';
        }
        
        printWindow.document.write(`
          <tr>
            <td>${entry.item}</td>
            <td>${entry.itemData?.category || 'N/A'}</td>
            <td>${getTransactionTypeDescription(entry.transaction.type)}</td>
            <td class="${statusClass}">${formatDate(entry.transaction.dueDate)}</td>
            <td>${entry.transaction.quantity}</td>
            <td>${entry.transaction.partNumber}</td>
          </tr>
        `);
        
        // If there are notes, add them in a new row
        if (entry.notes && entry.notes.trim()) {
          printWindow.document.write(`
            <tr>
              <td colspan="6">
                <div class="notes">
                  <div class="notes-label">Notes:</div>
                  ${entry.notes}
                </div>
              </td>
            </tr>
          `);
        }
      });
      
      printWindow.document.write('</tbody></table>');
    });
    
    printWindow.document.write(`
        <div class="no-print" style="text-align: center; margin: 20px 0;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #4299e1; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Print List
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; margin-left: 10px; background: #a0aec0; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Close
          </button>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
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
    
    // If vendor 888888 is being added, auto-expand its items
    if (vendor === '888888') {
      setTimeout(() => {
        const vendor888Items = stockItems.filter(item => item.vendor === '888888');
        if (vendor888Items.length > 0) {
          const newExpandedItems = {...expandedItems};
          vendor888Items.forEach(item => {
            newExpandedItems[item.item] = true;
          });
          setExpandedItems(newExpandedItems);
        }
      }, 100);
    }
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
      // For each work order, add if Released or subtract if Issued
      item.workOrders.forEach(wo => {
        if (wo.isReleased) {
          // Released WO: Add to balance (production)
          balance += wo.quantity;
        } else {
          // Issued WO: Subtract from balance (consumption)
          balance -= wo.quantity;
        }
      });
    }
    return balance;
  };
  
  // Analyze orders for recommendation report
  useEffect(() => {
    if (showReportPanel) {
      analyzeAllItems();
    }
  }, [showReportPanel, selectedCategories, selectedVendors, orderGroupBy]);
  
  // Calculate "Needs to be in by" date
  const calculateNeedsToBeInByDate = (dueDate) => {
    const date = new Date(dueDate);
    date.setDate(date.getDate() - (leadTimeWeeks * 7));
    return date;
  };
  
  // Format date for display
  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };
  
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
      } else if (transaction.type === 3) { // Released WO - ADDS to inventory
        runningBalance += transaction.quantity;
      } else if (transaction.type === 4) { // Open Sales
        // Only subtract if not covered by a work order
        if (!transaction.covered) {
          runningBalance -= transaction.availableQuantity;
        }
      } else if (transaction.type === 6) { // Issued WO - SUBTRACTS from inventory
        runningBalance -= transaction.quantity;
      }
      
      previousBalance = runningBalance;
    }
    
    // If balance becomes positive, return that transaction
    if (balanceBecomesPositive) {
      return { suggestions: [], positiveTransaction };
    }
    
    // If balance doesn't become positive, analyze required orders with cumulative effects
    // Get group key for grouping
    const getGroupKey = (date) => {
      if (orderGroupBy === 'month') {
        const monthStart = getMonthStart(date);
        return `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`;
      } else {
        // Default to week
        const weekStart = getWeekStart(date);
        return `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      }
    };
    
    // Initialize with current balance
    let simulatedBalance = item.startingBalance;
    const groupNeeds = {};
    const recommendedOrders = [];
    
    // Process transactions in chronological order
    for (let i = 0; i < sortedTransactions.length; i++) {
      const transaction = sortedTransactions[i];
      const groupKey = getGroupKey(transaction.dueDate);
      
      // Update balance based on transaction type
      if (transaction.type === 1) { // Purchase Order
        simulatedBalance += transaction.quantity;
      } else if (transaction.type === 3) { // Released WO - ADDS to inventory
        simulatedBalance += transaction.quantity;
      } else if (transaction.type === 4) { // Open Sales
        // Only subtract if not covered by a work order
        if (!transaction.covered) {
          simulatedBalance -= transaction.availableQuantity;
          
          // If balance becomes negative, track in weekly needs
          if (simulatedBalance < 0) {
            if (!groupNeeds[groupKey]) {
              groupNeeds[groupKey] = {
                groupStart: orderGroupBy === 'month' 
                  ? getMonthStart(transaction.dueDate)
                  : getWeekStart(transaction.dueDate),
                totalNeeded: 0,
                transactions: []
              };
            }
            
            // Add transaction and its impact to the weekly need
            groupNeeds[groupKey].transactions.push({
              ...transaction,
              impact: Math.min(transaction.availableQuantity, Math.abs(simulatedBalance))
            });
            
            groupNeeds[groupKey].totalNeeded += Math.min(transaction.availableQuantity, Math.abs(simulatedBalance));
            
            // Create an order to bring balance back to zero
            const orderQuantity = Math.abs(simulatedBalance);
            simulatedBalance = 0; // Balance is now zero after hypothetical order
            
            // Store recommendation
            if (orderQuantity > 0) {
              recommendedOrders.push({
                groupKey,
                groupStart: groupNeeds[groupKey].groupStart,
                quantity: orderQuantity,
                transactions: [...groupNeeds[groupKey].transactions] // Copy current transactions
              });
            }
          }
        }
      } else if (transaction.type === 6) { // Issued WO - SUBTRACTS from inventory
        // Subtract the work order quantity
        simulatedBalance -= transaction.quantity;
        
        // If balance becomes negative, track in weekly needs
        if (simulatedBalance < 0) {
          if (!groupNeeds[groupKey]) {
            groupNeeds[groupKey] = {
              groupStart: orderGroupBy === 'month' 
                ? getMonthStart(transaction.dueDate)
                : getWeekStart(transaction.dueDate),
              totalNeeded: 0,
              transactions: []
            };
          }
          
          // Add transaction and its impact to the weekly need
          groupNeeds[groupKey].transactions.push({
            ...transaction,
            impact: Math.min(transaction.quantity, Math.abs(simulatedBalance))
          });
          
          groupNeeds[groupKey].totalNeeded += Math.min(transaction.quantity, Math.abs(simulatedBalance));
          
          // Create an order to bring balance back to zero
          const orderQuantity = Math.abs(simulatedBalance);
          simulatedBalance = 0; // Balance is now zero after hypothetical order
          
          // Store recommendation
          if (orderQuantity > 0) {
            recommendedOrders.push({
              groupKey,
              groupStart: groupNeeds[groupKey].groupStart,
              quantity: orderQuantity,
              transactions: [...groupNeeds[groupKey].transactions] // Copy current transactions
            });
          }
        }
      }
    }
    
    // Group recommendations by week/month and consolidate quantities
    const consolidatedOrders = {};
    
    recommendedOrders.forEach(order => {
      if (!consolidatedOrders[order.groupKey]) {
        consolidatedOrders[order.groupKey] = {
          groupStart: order.groupStart,
          quantity: 0,
          transactions: []
        };
      }
      
      consolidatedOrders[order.groupKey].quantity += order.quantity;
      order.transactions.forEach(t => {
        if (!consolidatedOrders[order.groupKey].transactions.some(existing => 
          existing.dueDate.getTime() === t.dueDate.getTime() && 
          existing.partNumber === t.partNumber &&
          existing.type === t.type
        )) {
          consolidatedOrders[order.groupKey].transactions.push(t);
        }
      });
    });
    
    // Convert to array and sort by week
    const finalRecommendations = Object.values(consolidatedOrders).sort((a, b) => 
      a.groupStart - b.groupStart
    );
    
    return { suggestions: finalRecommendations, positiveTransaction: null };
  };
  
  // Generate printable recommended orders report
  const generateReport = () => {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      alert("Please allow popups for this website to enable printing.");
      return;
    }
    
    // Start building the HTML content
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MRP Recommended Orders Report - ${new Date().toLocaleDateString()}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0.8cm;
            line-height: 1.4;
            font-size: 10pt;
          }
          .chart-container {
            height: 160px;
            margin: 100%;
            overflow: hidden; /* Ensure content doesn't overflow */
          }
          h1 {
            text-align: center;
            font-size: 18pt;
            margin-bottom: 6px;
          }
          h3 {
            font-size: 12pt;
            margin: 10px 0 6px 0;
          }
          h4 {
            font-size: 11pt;
            margin: 8px 0 4px 0;
          }
          .date {
            text-align: center;
            margin-bottom: 12px;
            font-size: 10pt;
            color: #666;
          }
          .item-section {
            margin-bottom: 20px;
            page-break-inside: avoid;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 10px;
          }
          .item-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .item-title {
            font-size: 14pt;
            font-weight: bold;
          }
          .tag {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 10px;
            font-size: 9pt;
            margin-left: 5px;
          }
          .tag-blue {
            background-color: #EBF5FF;
            color: #1E40AF;
          }
          .tag-purple {
            background-color: #F5F3FF;
            color: #6B21A8;
          }
          .metadata {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 10px;
            font-size: 9pt;
          }
          .attention-box {
            background-color: #FEF9C3;
            border: 1px solid #FDE68A;
            border-radius: 6px;
            padding: 8px;
            margin-bottom: 10px;
            font-size: 9pt;
          }
          .attention-box p {
            margin: 4px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
            font-size: 9pt;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 4px 6px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .chart-container {
            width: 100%;
            height: 160px;
            margin: 10px 0;
          }
          .transaction-details {
            margin-left: 10px;
            border-left: 1px solid #ddd;
            padding-left: 10px;
          }
          .buttons {
            text-align: center;
            margin-top: 30px;
            display: flex;
            justify-content: center;
            gap: 10px;
          }
          .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10pt;
          }
          .btn-primary {
            background-color: #3B82F6;
            color: white;
          }
          .btn-secondary {
            background-color: #6B7280;
            color: white;
          }
          @media print {
            body {
              margin: 0.5cm;
            }
            .no-print {
              display: none;
            }
            .item-section {
              break-inside: avoid;
            }
          }
          @page {
            size: landscape;
            margin: 0.5cm;
          }
        </style>
      </head>
      <body>
        <h1>MRP Recommended Orders Report</h1>
        <div class="date">Generated on ${new Date().toLocaleString()}</div>
    `;
    
    // Filter items that have recommendations
    const itemsWithRecommendations = filteredItems.filter(item => 
      (weeklyOrderSuggestions[item.item]?.length > 0) || 
      positiveBalanceTransactions[item.item]
    );
    
    if (itemsWithRecommendations.length === 0) {
      htmlContent += `
        <div style="text-align: center; padding: 40px; color: #666;">
          No recommended orders for the current selection of items.
        </div>
      `;
    } else {
      // Add each item with recommendations
      itemsWithRecommendations.forEach(item => {
        const hasSuggestions = weeklyOrderSuggestions[item.item]?.length > 0;
        const hasPositiveTransaction = positiveBalanceTransactions[item.item];
        
        htmlContent += `
          <div class="item-section">
            <div class="item-header">
              <div>
                <span class="item-title">${item.item}</span>
                <span class="tag tag-blue">${item.category || 'No Category'}</span>
                <span class="tag tag-purple">${item.vendor || 'No Vendor'}</span>
              </div>
            </div>
            
            <div class="metadata">
              <div>Current Balance: <span style="${item.startingBalance < 0 ? 'color: #DC2626; font-weight: 500;' : ''}">${item.startingBalance}</span></div>
              <div>Balance After Work Orders: <span style="${calculateBalanceAfterWO(item) < 0 ? 'color: #DC2626; font-weight: 500;' : ''}">${calculateBalanceAfterWO(item).toFixed(2)}</span></div>
            </div>
        `;
        
        // Add chart data for rendering if includeGraphs is true
        if (includeGraphs && item.runningTotals && item.runningTotals.length > 0) {
          const chartId = `chart-${item.item.replace(/\s+/g, '-').toLowerCase()}`;
          const chartData = JSON.stringify(item.runningTotals);
          
          htmlContent += `
            <div class="chart-container">
              <canvas id="${chartId}" width="100%" height="160"></canvas>
            </div>
            <script>
              // Store chart data for this specific chart
              window.chartData = window.chartData || {};
              window.chartData['${chartId}'] = ${chartData};
            </script>
          `;
        }
        
        // Add recommendations section
        htmlContent += `<h3>Order Recommendations</h3>`;
        
        // Add attention required box if there's a positive transaction
        if (hasPositiveTransaction) {
          htmlContent += `
            <div class="attention-box">
              <h4 style="margin-top: 0;">Attention Required</h4>
              <p>
                A future purchase order will bring the balance positive on ${new Date(positiveBalanceTransactions[item.item].dueDate).toLocaleDateString()}.
                Consider moving this order up to address current negative balance.
              </p>
              <div>
                <strong>PO:</strong> ${positiveBalanceTransactions[item.item].partNumber} |
                <strong>Quantity:</strong> ${positiveBalanceTransactions[item.item].quantity} |
                <strong>Date:</strong> ${new Date(positiveBalanceTransactions[item.item].dueDate).toLocaleDateString()}
              </div>
            </div>
          `;
        }
        
        // Add suggestions table
        if (hasSuggestions) {
          htmlContent += `
            <table>
              <thead>
                <tr>
                  <th>${orderGroupBy === 'month' ? 'Month' : 'Week Starting'}</th>
                  <th>Suggested Order</th>
                  <th>Needs to be in by</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          weeklyOrderSuggestions[item.item].forEach(suggestion => {
            const needsToBeInByDate = calculateNeedsToBeInByDate(suggestion.groupStart);
            
            htmlContent += `
              <tr>
                <td>${getGroupLabel(suggestion.groupStart)}</td>
                <td><strong>${suggestion.quantity.toFixed(2)}</strong></td>
                <td>${formatDate(needsToBeInByDate)}</td>
                <td>Covers ${suggestion.transactions.length} transactions</td>
              </tr>
            `;
            
            // Transaction details section removed - no longer showing individual transactions for each order
          });
          
          htmlContent += `
              </tbody>
            </table>
          `;
        }
        
        // Add all transactions if showAllTransactions is true
        if (showAllTransactions) {
          htmlContent += `
            <h3>All Transactions</h3>
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Quantity</th>
                  <th>Reference</th>
                  <th>Running Total</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          let runningTotal = item.startingBalance;
          const deduplicatedTransactions = deduplicateTransactions(item.transactions);
          
          deduplicatedTransactions.forEach(transaction => {
            // Update running total based on transaction type
            if (transaction.type === 1) { // Purchase Order
              runningTotal += transaction.quantity;
            } else if (transaction.type === 3) { // Released WO - ADDS to inventory
              runningTotal += transaction.quantity;
            } else if (transaction.type === 4) { // Open Sales
              // Only subtract if not covered by a work order
              if (!transaction.covered) {
                runningTotal -= transaction.availableQuantity;
              }
            } else if (transaction.type === 6) { // Issued WO - SUBTRACTS from inventory
              runningTotal -= transaction.quantity;
            }
            
            // Check if transaction is overdue
            const isOverdue = transaction.type === 1 && new Date(transaction.dueDate) < new Date();
            
            // Check if transaction is due soon (within 2 weeks)
            const isDueSoon = transaction.type === 1 && 
              new Date(transaction.dueDate) >= new Date() && 
              new Date(transaction.dueDate) <= new Date(new Date().setDate(new Date().getDate() + 14));
            
            // Check if this open sale is covered by a work order
            const isCovered = transaction.type === 4 && transaction.covered;
            
            htmlContent += `
              <tr style="${isOverdue ? 'background-color: #FEE2E2;' : ''} ${isDueSoon ? 'background-color: #FEF3C7;' : ''} ${isCovered ? 'background-color: #D1FAE5;' : ''}">
                <td>${getTransactionTypeDescription(transaction.type)}</td>
                <td>${new Date(transaction.dueDate).toLocaleDateString()}</td>
                <td style="${(transaction.type === 1 || transaction.type === 3) ? 'color: #059669; font-weight: 500;' : (transaction.type === 4 || transaction.type === 6) ? 'color: #DC2626; font-weight: 500;' : ''}">
                  ${(transaction.type === 1 || transaction.type === 3) ? '+' : (transaction.type === 4 || transaction.type === 6) ? '-' : ''}${transaction.quantity}
                </td>
                <td>${transaction.partNumber}</td>
                <td>${runningTotal.toFixed(2)}</td>
              </tr>
            `;
          });
          
          htmlContent += `
              </tbody>
            </table>
          `;
        }
        
        htmlContent += `</div>`;
      });
    }
    
    // Close the HTML with print and save buttons
    htmlContent += `
        <div class="buttons no-print">
          <button onclick="window.print()" class="btn btn-primary">
            Print Report
          </button>
          <button onclick="savePDF()" class="btn btn-primary">
            Save as PDF
          </button>
          <button onclick="window.close()" class="btn btn-secondary">
            Close
          </button>
        </div>
        
        <script>
          function savePDF() {
            // Hide the buttons temporarily
            document.querySelector('.buttons').style.display = 'none';
            
            // Use the browser's print functionality with Save as PDF option
            window.print();
            
            // Show the buttons again
            setTimeout(() => {
              document.querySelector('.buttons').style.display = 'flex';
            }, 1000);
          }
          
       // Function to render all charts with improved responsive behavior
        function renderCharts() {
          if (!window.chartData) return;
          
          Object.keys(window.chartData).forEach(chartId => {
            const canvas = document.getElementById(chartId);
            if (!canvas) return;
            
            // Make canvas responsive by setting its dimensions to match container width
            const container = canvas.parentElement;
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight || 200;
            
            // Increase the canvas resolution for better quality
            const dpr = window.devicePixelRatio || 1;
            canvas.width = containerWidth * dpr;
            canvas.height = containerHeight * dpr;
            canvas.style.width = containerWidth + 'px';
            canvas.style.height = containerHeight + 'px';
            
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr); // Scale for high DPI displays
            
            const data = window.chartData[chartId];
            
            // Determine chart dimensions with proper padding
            const padding = { top: 30, right: 30, bottom: 40, left: 50 };
            const chartWidth = containerWidth - padding.left - padding.right;
            const chartHeight = containerHeight - padding.top - padding.bottom;
            
            // Find min and max values for scaling
            let minDate = new Date(data[0].date);
            let maxDate = new Date(data[0].date);
            let minBalance = data[0].balance;
            let maxBalance = data[0].balance;
            
            data.forEach(point => {
              const date = new Date(point.date);
              if (date < minDate) minDate = date;
              if (date > maxDate) maxDate = date;
              if (point.balance < minBalance) minBalance = point.balance;
              if (point.balance > maxBalance) maxBalance = point.balance;
            });
            
            // Add some padding to min/max balance (10% of range)
            const balanceRange = maxBalance - minBalance;
            minBalance = minBalance - (balanceRange * 0.1);
            maxBalance = maxBalance + (balanceRange * 0.1);
            
            // Calculate scale functions
            const timeScale = value => {
              const date = new Date(value);
              return padding.left + (chartWidth * (date - minDate) / (maxDate - minDate));
            };
            
            const balanceScale = value => {
              return containerHeight - padding.bottom - (chartHeight * (value - minBalance) / (maxBalance - minBalance));
            };
            
            // Clear canvas
            ctx.clearRect(0, 0, containerWidth, containerHeight);
            
            // Draw axes
            ctx.strokeStyle = '#ccc';
            ctx.lineWidth = 1;
            
            // X-axis
            ctx.beginPath();
            ctx.moveTo(padding.left, containerHeight - padding.bottom);
            ctx.lineTo(containerWidth - padding.right, containerHeight - padding.bottom);
            ctx.stroke();
            
            // Y-axis
            ctx.beginPath();
            ctx.moveTo(padding.left, padding.top);
            ctx.lineTo(padding.left, containerHeight - padding.bottom);
            ctx.stroke();
            
            // Draw grid lines
            ctx.strokeStyle = '#eee';
            ctx.beginPath();
            
            // Horizontal grid lines (balance)
            const balanceStep = (maxBalance - minBalance) / 5;
            for (let i = 1; i <= 5; i++) {
              const y = balanceScale(minBalance + balanceStep * i);
              ctx.moveTo(padding.left, y);
              ctx.lineTo(containerWidth - padding.right, y);
            }
            
            // Vertical grid lines (time)
            const timeStep = (maxDate - minDate) / 6;
            for (let i = 1; i <= 6; i++) {
              const x = timeScale(new Date(minDate.getTime() + timeStep * i));
              ctx.moveTo(x, padding.top);
              ctx.lineTo(x, containerHeight - padding.bottom);
            }
            
            ctx.stroke();
            
            // Draw axis labels
            ctx.fillStyle = '#666';
            ctx.font = '10px Arial';
            
            // X-axis labels (dates)
            ctx.textAlign = 'center';
            for (let i = 0; i <= 6; i++) {
              const date = new Date(minDate.getTime() + timeStep * i);
              const x = timeScale(date);
              const dateStr = \`\${date.getMonth() + 1}/\${date.getDate()}\`;
              ctx.fillText(dateStr, x, containerHeight - padding.bottom + 15);
            }
            
            // Y-axis labels (balance)
            ctx.textAlign = 'right';
            for (let i = 0; i <= 5; i++) {
              const balance = minBalance + balanceStep * i;
              const y = balanceScale(balance);
              ctx.fillText(balance.toFixed(0), padding.left - 5, y + 3);
            }
            
            // Draw chart title
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Balance Trend', containerWidth / 2, padding.top - 10);
            
            // Apply clipping to ensure chart stays within its boundaries
            ctx.save();
            ctx.beginPath();
            ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
            ctx.clip();
            
            // Draw balance line
            const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
            
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            let isFirstPoint = true;
            sortedData.forEach(point => {
              const x = timeScale(point.date);
              const y = balanceScale(point.balance);
              
              if (isFirstPoint) {
                ctx.moveTo(x, y);
                isFirstPoint = false;
              } else {
                ctx.lineTo(x, y);
              }
            });
            
            ctx.stroke();
            ctx.restore();
          });
        }
        
        // Auto-render charts when the page loads
        window.onload = function() {
          // Set a small delay to ensure DOM is fully ready
          setTimeout(renderCharts, 100);
          
          // Also handle window resize to make charts responsive
          window.addEventListener('resize', renderCharts);
        }
      </script>
    </body>
    </html>
  `;
  
  // Write to the new window and prepare for printing
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
};
  
  // Get group label based on group by selection
  const getGroupLabel = (date) => {
    if (orderGroupBy === 'month') {
      const d = new Date(date);
      return `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
    } else {
      // Week grouping
      const weekStart = new Date(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `Week of ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    }
  };
  
  // Filter items based on criteria
  let filteredItems = items;
  
  // Filter out items without transactions if showOnlyActive is true
  if (showOnlyActive) {
    filteredItems = filteredItems.filter(item => 
      item.transactions && item.transactions.length > 0 // More than just the beginning balance
    );
  }
  
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
    case 'orders':
      filteredItems = _.orderBy(
        filteredItems,
        [item => item.orders?.length || 0],
        ['desc']
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
      // Default to alphabetical
      filteredItems = _.orderBy(
        filteredItems,
        [item => item.item.toLowerCase()],
        ['asc']
      );
      break;
  }

  // NEW: Add useEffect to update parent component's filtered items
  useEffect(() => {
    // Only update if the function exists
    if (updateFilteredItems) {
      updateFilteredItems(filteredItems);
    }
  }, [filteredItems, updateFilteredItems]);

  // Function to deduplicate transactions
  const deduplicateTransactions = (transactions) => {
    const deduplicatedTransactions = [];
    const transactionKeys = new Set();
    
    if (!transactions) return [];
    
    transactions.forEach(transaction => {
      // Create a unique key for each transaction
      const key = `${transaction.type}-${transaction.partNumber}-${new Date(transaction.dueDate).getTime()}-${transaction.quantity}`;
      
      // Only add if not already in our deduplicated list
      if (!transactionKeys.has(key)) {
        transactionKeys.add(key);
        deduplicatedTransactions.push(transaction);
      }
    });
    
    return deduplicatedTransactions;
  };

  // Function to check for overdue POs (due date before today)
  const getOverduePO = (item) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to beginning of day for accurate comparison
    
    // Find POs that are overdue (due date before today)
    const overduePOs = item.transactions
      .filter(t => 
        t.type === 1 && // Is a purchase order
        new Date(t.dueDate) < today
      )
      .sort((a, b) => a.dueDate - b.dueDate);
    
    return overduePOs.length > 0 ? overduePOs[0] : null;
  };
  
  // Function to check for upcoming POs within 2 weeks for negative balance items
  const getUpcomingPO = (item) => {
    if (calculateBalanceAfterWO(item) >= 0) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to beginning of day for accurate comparison
    
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    
    // Find POs due within the next 2 weeks
    const upcomingPOs = item.transactions
      .filter(t => 
        t.type === 1 && // Is a purchase order
        new Date(t.dueDate) >= today && 
        new Date(t.dueDate) <= twoWeeksFromNow
      )
      .sort((a, b) => a.dueDate - b.dueDate);
    
    return upcomingPOs.length > 0 ? upcomingPOs[0] : null;
  };

  // Render inventory content based on panel or transaction view
  const renderInventoryContent = () => {
    if (showReportPanel) {
      return renderReportPanel();
    } else if (showCheckOnPanel) {
      return renderCheckOnPanel();
    } else {
      return renderTransactionsView();
    }
  };
  
  // Render the Check On panel
  const renderCheckOnPanel = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow" id="check-on-panel">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Items to Check On</h2>
          <div className="flex space-x-2">
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
              onClick={printCheckOnList}
            >
              <PrinterIcon size={16} className="mr-2" />
              Print List
            </button>
            <button
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              onClick={() => setShowCheckOnPanel(false)}
            >
              Back to Inventory
            </button>
          </div>
        </div>
        
        {checkOnList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock size={48} className="mx-auto text-gray-400 mb-4" />
            <p>Your "Check On" list is empty. Add items from the transaction lists.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {checkOnList.map((entry, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900">{entry.item}</h3>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {entry.itemData?.category || "No Category"}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                        {entry.itemData?.vendor || "No Vendor"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">{getTransactionTypeDescription(entry.transaction.type)}</span> | 
                      Due: <span className={new Date(entry.transaction.dueDate) < new Date() ? 'text-red-600 font-medium' : ''}>
                        {new Date(entry.transaction.dueDate).toLocaleDateString()}
                      </span> | 
                      Quantity: {entry.transaction.quantity} | 
                      Reference: {entry.transaction.partNumber}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Added on: {new Date(entry.addedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <button
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      onClick={() => removeFromCheckOnList(index)}
                    >
                      Remove
                    </button>
                    <button
                      className="ml-2 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                      onClick={() => {
                        if (entry.itemData) {
                          goToItemDetail(entry.itemData);
                        }
                      }}
                    >
                      View Item
                    </button>
                  </div>
                </div>
                
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes:</label>
                  <textarea
                    className="w-full px-3 py-2 border rounded text-sm"
                    value={entry.notes}
                    onChange={(e) => updateCheckOnNotes(index, e.target.value)}
                    placeholder="Add notes about this item..."
                    rows={2}
                  ></textarea>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render the transactions view
  const renderTransactionsView = () => {
    return (
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
                      {calculateBalanceAfterWO(item) < 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                          Negative Balance
                        </span>
                      )}
                      
                      {/* Show badge for overdue POs */}
                      {getOverduePO(item) && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full flex items-center">
                          <AlertTriangle size={12} className="mr-1" />
                          Overdue PO: {new Date(getOverduePO(item).dueDate).toLocaleDateString()} ({getOverduePO(item).quantity} units)
                        </span>
                      )}
                      
                      {/* Show badge for upcoming POs */}
                      {calculateBalanceAfterWO(item) < 0 && getUpcomingPO(item) && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                          PO Due: {new Date(getUpcomingPO(item).dueDate).toLocaleDateString()} ({getUpcomingPO(item).quantity} units)
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
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 inline-flex"
                      onClick={() => promptOrderQuantity(item)}
                    >
                      Add to Order
                    </button>
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
                
                {/* Order Quantity Prompt - Updated to auto-select text */}
                {showOrderPrompt === item.item && (
                  <div className="mb-4 p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-gray-700">Enter quantity to order:</span>
                      <input
                        ref={quantityInputRef}
                        type="number"
                        min="1"
                        className="px-3 py-1 border rounded w-24 text-center"
                        value={orderQuantity[item.item] || 1}
                        onChange={(e) => handleQuantityChange(item.item, e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            confirmOrderQuantity(item);
                          }
                        }}
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
                  </div>
                )}
                
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
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(() => {
                        let runningTotal = item.startingBalance;
                        
                        // Deduplicate transactions before rendering
                        const deduplicatedTransactions = deduplicateTransactions(item.transactions);
                        
                        return deduplicatedTransactions.map((transaction, tIndex) => {
                          // Update running total based on transaction type
                          if (transaction.type === 1) { // Purchase Order
                            runningTotal += transaction.quantity;
                          } else if (transaction.type === 3) { // Released WO - ADDS to inventory
                            runningTotal += transaction.quantity;
                          } else if (transaction.type === 4) { // Open Sales
                            // Only subtract if not covered by a work order
                            if (!transaction.covered) {
                              runningTotal -= transaction.availableQuantity;
                            }
                          } else if (transaction.type === 6) { // Issued WO - SUBTRACTS from inventory
                            runningTotal -= transaction.quantity;
                          }
                          
                          // Check if transaction is already in "Check On" list
                          const isInCheckOnList = checkOnList.some(entry => 
                            entry.item === item.item && 
                            entry.transaction.dueDate === transaction.dueDate &&
                            entry.transaction.type === transaction.type &&
                            entry.transaction.partNumber === transaction.partNumber
                          );
                          
                          // Check if transaction is overdue
                          const isOverdue = transaction.type === 1 && new Date(transaction.dueDate) < new Date();
                          
                          // Check if transaction is due soon (within 2 weeks)
                          const isDueSoon = transaction.type === 1 && 
                            new Date(transaction.dueDate) >= new Date() && 
                            new Date(transaction.dueDate) <= new Date(new Date().setDate(new Date().getDate() + 14));

                          // Check if this open sale is covered by a work order
                          const isCovered = transaction.type === 4 && transaction.covered;
                          
                          return (
                            <tr key={tIndex} className={`hover:bg-gray-50 
                              ${isOverdue ? 'bg-red-50' : ''} 
                              ${isDueSoon ? 'bg-yellow-50' : ''}
                              ${isCovered ? 'bg-green-50' : ''}`
                            }>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                {getTransactionTypeDescription(transaction.type)}
                                {isOverdue && (
                                  <span className="ml-2 inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                    <AlertTriangle size={10} className="mr-1" /> Overdue
                                  </span>
                                )}
                                {isDueSoon && !isOverdue && (
                                  <span className="ml-2 inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    <Clock size={10} className="mr-1" /> Due Soon
                                  </span>
                                )}
                                {isCovered && (
                                  <span className="ml-2 inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle size={10} className="mr-1" /> 
                                    Covered by {transaction.coverType === 'released' ? 'Released WO' : 'Issued WO'}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                {new Date(transaction.dueDate).toLocaleDateString()}
                              </td>
                              <td className={`px-4 py-2 whitespace-nowrap text-xs font-medium ${
                                transaction.type === 1 || transaction.type === 3 ? 'text-green-600' : 
                                (transaction.type === 4 || transaction.type === 6) ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {transaction.type === 1 || transaction.type === 3 ? '+' : 
                                 (transaction.type === 4 || transaction.type === 6) ? '-' : ''}
                                {transaction.quantity}
                                {transaction.type === 4 && transaction.covered && (
                                  <span className="text-gray-500 ml-1">(covered)</span>
                                )}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                {transaction.partNumber}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                {runningTotal.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-xs">
                                {isInCheckOnList ? (
                                  <span className="inline-flex items-center text-green-600">
                                    <CheckCircle size={14} className="mr-1" /> In Check List
                                  </span>
                                ) : (
                                  <button
                                    className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                                    onClick={() => addToCheckOnList(item, transaction)}
                                  >
                                    Check On
                                  </button>
                                )}
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
    );
  };
  
  // Render the report panel
  const renderReportPanel = () => {
    return (
      <div id="recommended-orders-report" className="bg-white p-6 rounded-lg shadow print:shadow-none">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <h2 className="text-xl font-bold text-gray-800">Recommended Orders Report</h2>
          <div className="flex items-center space-x-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={includeGraphs}
                  onChange={() => setIncludeGraphs(!includeGraphs)}
                  className="mr-2"
                />
                <span>Include Graphs</span>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={showAllTransactions}
                  onChange={() => setShowAllTransactions(!showAllTransactions)}
                  className="mr-2"
                />
                <span>Show All Transactions</span>
              </div>
            </div>
            
            {/* Group By toggle buttons */}
            <div className="flex border rounded overflow-hidden">
              <button
                className={`px-3 py-1 text-sm ${
                  orderGroupBy === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setOrderGroupBy('week')}
              >
                Group by Week
              </button>
              <button
                className={`px-3 py-1 text-sm ${
                  orderGroupBy === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setOrderGroupBy('month')}
              >
                Group by Month
              </button>
            </div>
            
            {/* Lead Time Input */}
            <div className="flex items-center">
              <label className="mr-2 text-sm">Lead Time (weeks):</label>
              <input
                type="number"
                min="1"
                max="52"
                value={leadTimeWeeks}
                onChange={(e) => setLeadTimeWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 border rounded"
              />
            </div>
            
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
                      
                      {/* Show All Transactions button - Always visible now */}
                      <button
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center print:hidden"
                        onClick={() => toggleExpandAllTransactions(item.item)}
                      >
                        All Transactions
                        {expandedGroups2[item.item] ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />}
                      </button>
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
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                                  {orderGroupBy === 'month' ? 'Month' : 'Week Starting'}
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Suggested Order</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Needs to be in by</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Details</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {weeklyOrderSuggestions[item.item].map((suggestion, sIndex) => {
                                const needsToBeInByDate = calculateNeedsToBeInByDate(suggestion.groupStart);
                                return (
                                  <tr key={sIndex}>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                      {getGroupLabel(suggestion.groupStart)}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                      {suggestion.quantity.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                                      {formatDate(needsToBeInByDate)}
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
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    
                    {/* Expand transaction details for each suggestion */}
                    {hasSuggestions && weeklyOrderSuggestions[item.item].map((suggestion, sIndex) => (
                      expandedGroups[`${item.item}-week-${sIndex}`] && (
                        <div key={`detail-${sIndex}`} className="mt-2 p-3 bg-gray-50 border rounded">
                          <p className="text-sm text-gray-600 mb-2">
                            {orderGroupBy === 'month' ? 'Month' : 'Week'} of {getGroupLabel(suggestion.groupStart)} - 
                            {suggestion.transactions.length} transactions:
                          </p>
                          <table className="min-w-full divide-y divide-gray-200 border">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reference</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {suggestion.transactions.map((transaction, tIndex) => (
                                <tr key={tIndex} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {getTransactionTypeDescription(transaction.type)}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {new Date(transaction.dueDate).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">
                                    {transaction.partNumber}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-red-600 font-medium">
                                    {transaction.quantity.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ))}
                    
                    {/* Show All Transactions section - Moved below recommendations */}
                    {(expandedGroups2[item.item] || showAllTransactions) && (
                      <div className="mb-6 mt-6 overflow-x-auto max-h-80 overflow-y-auto border rounded">
                        <h4 className="font-medium text-gray-700 p-3 bg-gray-50 border-b">All Transactions</h4>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
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
                              
                              // Deduplicate transactions before rendering
                              const deduplicatedTransactions = deduplicateTransactions(item.transactions);
                              
                              return deduplicatedTransactions.map((transaction, tIndex) => {
                                // Update running total based on transaction type
                                if (transaction.type === 1) { // Purchase Order
                                  runningTotal += transaction.quantity;
                                } else if (transaction.type === 3) { // Released WO - ADDS to inventory
                                  runningTotal += transaction.quantity;
                                } else if (transaction.type === 4) { // Open Sales
                                  // Only subtract if not covered by a work order
                                  if (!transaction.covered) {
                                    runningTotal -= transaction.availableQuantity;
                                  }
                                } else if (transaction.type === 6) { // Issued WO - SUBTRACTS from inventory
                                  runningTotal -= transaction.quantity;
                                }
                                
                                // Check if transaction is overdue
                                const isOverdue = transaction.type === 1 && new Date(transaction.dueDate) < new Date();
                                
                                // Check if transaction is due soon (within 2 weeks)
                                const isDueSoon = transaction.type === 1 && 
                                  new Date(transaction.dueDate) >= new Date() && 
                                  new Date(transaction.dueDate) <= new Date(new Date().setDate(new Date().getDate() + 14));
                                
                                // Check if this open sale is covered by a work order
                                const isCovered = transaction.type === 4 && transaction.covered;
                                
                                return (
                                  <tr key={tIndex} className={`hover:bg-gray-50 
                                    ${isOverdue ? 'bg-red-50' : ''} 
                                    ${isDueSoon ? 'bg-yellow-50' : ''}
                                    ${isCovered ? 'bg-green-50' : ''}`
                                  }>
                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                      {getTransactionTypeDescription(transaction.type)}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                      {new Date(transaction.dueDate).toLocaleDateString()}
                                    </td>
                                    <td className={`px-4 py-2 whitespace-nowrap text-xs font-medium ${
                                      transaction.type === 1 || transaction.type === 3 ? 'text-green-600' : 
                                      (transaction.type === 4 || transaction.type === 6) ? 'text-red-600' : 'text-gray-900'
                                    }`}>
                                      {transaction.type === 1 || transaction.type === 3 ? '+' : 
                                       (transaction.type === 4 || transaction.type === 6) ? '-' : ''}
                                      {transaction.quantity}
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
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" ref={contentRef}>
      {/* Fixed top filter bar */}
      <div className="bg-white p-4 rounded-lg shadow sticky top-0 z-10">
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
              onChange={(e) => setSortOption(e.target.value)}>
              <option value="alphabetical">Alphabetical</option>
              <option value="vendor">Vendor</option>
              <option value="category">Category</option>
              <option value="orders">Orders Needed (Highest to Lowest)</option>
            </select>
          </div>
          
          {/* Active Items Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Show All</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={showOnlyActive}
                onChange={() => setShowOnlyActive(!showOnlyActive)}
              />
              <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm text-gray-600">Active Only</span>
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
            onClick={() => {
              setShowReportPanel(!showReportPanel);
              setShowCheckOnPanel(false);
            }}
          >
            <PrinterIcon size={16} className="mr-1" />
            <span>Recommended Orders Report</span>
          </button>
          
          <button
            className={`px-3 py-2 rounded flex items-center space-x-1 ${
              showCheckOnPanel ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
            } hover:bg-purple-100`}
            onClick={() => {
              setShowCheckOnPanel(!showCheckOnPanel);
              setShowReportPanel(false);
            }}
          >
            <Clock size={16} className="mr-1" />
            <span>Check On List</span>
            {checkOnList.length > 0 && (
              <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {checkOnList.length}
              </span>
            )}
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
          Showing {filteredItems.length} {showOnlyActive ? 'active' : ''} items
          {(selectedCategories.length > 0 || selectedVendors.length > 0) && (
            <span>
              {selectedCategories.length > 0 && ` from ${selectedCategories.length} categories`}
              {selectedVendors.length > 0 && ` with ${selectedVendors.length} vendors`}
            </span>
          )}
          {showOnlyActive && (
            <span className="ml-1 text-blue-600">(items with transactions only)</span>
          )}
        </div>
      </div>
      
      {/* Main Content Area */}
      {renderInventoryContent()}
    </div>
  );
}

export default Inventory;