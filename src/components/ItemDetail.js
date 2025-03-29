import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getTransactionTypeDescription } from '../utils/helpers';
import { ChevronLeft, ChevronRight, AlertTriangle, ArrowUp, ChevronDown, ChevronUp, Calendar, BarChart2, CheckCircle, RefreshCw, Edit2, Trash2, X, Clock, Package } from 'lucide-react';
import _ from 'lodash';
// Helper functions defined outside the component to avoid initialization issues
const getTomorrowDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

const formatDateForInput = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

const parseDateFromInput = (dateString) => {
  return new Date(dateString);
};

function ItemDetail({ item, onAddToOrder, onUpdateOrder, filteredItems = [], currentItemIndex = 0, setSelectedItem, orderList = [], onAddToCheckList, onReceivePO }) {
  // Initialize state with basic values first, then update in useEffect
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderDueDate, setOrderDueDate] = useState(formatDateForInput(getTomorrowDate()));
  const [weeklyOrderSuggestions, setWeeklyOrderSuggestions] = useState([]);
  const [positiveBalanceTransaction, setPositiveBalanceTransaction] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [addedOrders, setAddedOrders] = useState([]);
  const [projectedRunningTotals, setProjectedRunningTotals] = useState([]);
  const [editingOrderIndex, setEditingOrderIndex] = useState(null);
  const [editOrderQuantity, setEditOrderQuantity] = useState('');
  const [editOrderDate, setEditOrderDate] = useState('');
  const componentRef = useRef(null);
  const quantityInputRef = useRef(null);
  const [upcomingPOInfo, setUpcomingPOInfo] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [checkOnNote, setCheckOnNote] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const noteInputRef = useRef(null);

  // Get order grouping preference from localStorage with fallback
  const [orderGroupBy, setOrderGroupBy] = useState('week'); // Default to 'week' rather than using a function
  // Lead time weeks state
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(() => {
    return parseInt(localStorage.getItem('inventory_leadTimeWeeks') || '7');
  });

  // Update order grouping from localStorage after component mounts
  useEffect(() => {
    const savedGroupBy = localStorage.getItem('order_groupBy');
    if (savedGroupBy) {
      setOrderGroupBy(savedGroupBy);
    }
  }, []);

  // Set initial order quantity based on item balance when item changes
  useEffect(() => {
    if (item) {
      const initialQuantity = Math.abs(item.startingBalance < 0 ? item.startingBalance : 0) || 1;
      setOrderQuantity(initialQuantity);
    }
  }, [item]);

  // Save grouping preference to localStorage
  useEffect(() => {
    localStorage.setItem('order_groupBy', orderGroupBy);
  }, [orderGroupBy]);

  // Save lead time weeks to localStorage
  useEffect(() => {
    localStorage.setItem('inventory_leadTimeWeeks', leadTimeWeeks.toString());
  }, [leadTimeWeeks]);

  // Get existing orders for this item from the order list
  const existingOrders = item && orderList ? orderList.filter(order => order.item === item.item) : [];

  // Reset local orders completely when the item changes and sync with orderList
  useEffect(() => {
    // Reset when item changes
    if (!item || !item.item) {
      setAddedOrders([]);
      return;
    }

    // Create fresh local order objects from the order list
    const ordersFromList = existingOrders.map(order => ({
      id: order.id || Math.random().toString(36).substr(2, 9), // Use existing ID or generate one
      quantity: order.quantity,
      dueDate: new Date(order.dueDate),
      date: new Date(order.date || new Date()),
      existingOrder: true, // Mark as existing order from order list
      orderListIndex: orderList.findIndex(o =>
        o.item === order.item &&
        new Date(o.dueDate).getTime() === new Date(order.dueDate).getTime()
      ) // Store the index in orderList for easy updates
    }));

    // Replace existing orders (don't add to them)
    setAddedOrders(ordersFromList);

  }, [item?.item, JSON.stringify(existingOrders)]); // Only re-run when item or existingOrders change

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.tagName === 'SELECT') {
        return;
      }

      if (e.key === 'ArrowRight' && hasNextItem) {
        goToNextItem();
      } else if (e.key === 'ArrowLeft' && hasPreviousItem) {
        goToPreviousItem();
      }
    };

    // Add the event listener
    window.addEventListener('keydown', handleKeyDown);

    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentItemIndex, filteredItems]); // Re-add when these dependencies change

  // Navigation functions
  const goToNextItem = () => {
    if (filteredItems.length > 0 && currentItemIndex < filteredItems.length - 1) {
      setSelectedItem(filteredItems[currentItemIndex + 1]);
    }
  };

  const goToPreviousItem = () => {
    if (filteredItems.length > 0 && currentItemIndex > 0) {
      setSelectedItem(filteredItems[currentItemIndex - 1]);
    }
  };

  const hasNextItem = filteredItems.length > 0 && currentItemIndex < filteredItems.length - 1;
  const hasPreviousItem = filteredItems.length > 0 && currentItemIndex > 0;

  // Toggle expanded state for transaction group
  const toggleExpandGroup = (weekKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  // Calculate due date based on recommended order date
  const calculateDueDate = (recommendedDate) => {
    // Convert string date to Date object if needed
    const orderDate = typeof recommendedDate === 'string' ? new Date(recommendedDate) : recommendedDate;

    // Calculate date based on lead time
    const dueDate = new Date(orderDate);
    dueDate.setDate(dueDate.getDate() - (leadTimeWeeks * 7));

    // If calculated date is in the past, use tomorrow's date
    const tomorrow = getTomorrowDate();
    return dueDate < new Date() ? tomorrow : dueDate;
  };

  // Updated handleAddToCheckList function
const handleAddToCheckList = (transaction) => {
  if (!transaction) return;
  
  setSelectedTransaction(transaction);
  setCheckOnNote('');
  setShowNoteModal(true);
  
  // Focus the textarea when the modal opens
  setTimeout(() => {
    if (noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, 50);
};

// Add this new function after handleAddToCheckList
const submitCheckOn = () => {
  if (!onAddToCheckList || !selectedTransaction || !item) {
    setShowNoteModal(false);
    return;
  }
  
  // Call the parent function with the transaction and additional note
  onAddToCheckList(item, selectedTransaction, checkOnNote);
  setShowNoteModal(false);
  setSelectedTransaction(null);
};
  // Handle receiving a PO
  const handleReceivePO = (transaction) => {
    if (window.confirm(`Are you sure you want to receive PO: ${transaction.partNumber} for ${transaction.quantity} units?`)) {
      onReceivePO(item, transaction);
    }
  };

  // Handle adding item to order with due date
  const handleAddToOrder = (quantity = null, dueDate = null) => {
    if (!item) return;

    // Use provided values or fall back to form state
    const orderQty = quantity !== null ? quantity : orderQuantity;
    const orderDate = dueDate !== null ? dueDate : parseDateFromInput(orderDueDate);

    // Only one of these should happen:
    // If parent handler exists, use that (App.js will update orderList which will then update our local addedOrders via useEffect)
    if (onAddToOrder) {
      onAddToOrder(item, orderQty, orderDate);
    }
    // If no parent handler, only update local state
    else {
      // Create a unique ID for tracking this order
      const orderId = Math.random().toString(36).substr(2, 9);

      // Add to the local state for projection
      const newOrder = {
        id: orderId,
        quantity: orderQty,
        dueDate: orderDate,
        date: new Date(), // When the order was created
      };

      setAddedOrders(prev => [...prev, newOrder]);
    }
  };

  // Start editing an order
  const startEditingOrder = (index) => {
    const order = addedOrders[index];
    setEditingOrderIndex(index);
    setEditOrderQuantity(order.quantity.toString());
    setEditOrderDate(formatDateForInput(order.dueDate));
    
    // Schedule focus and select for after the component rerenders
    setTimeout(() => {
      if (quantityInputRef.current) {
        quantityInputRef.current.focus();
        quantityInputRef.current.select();
      }
    }, 0);
  };

  // Cancel editing
  const cancelEditingOrder = () => {
    setEditingOrderIndex(null);
    setEditOrderQuantity('');
    setEditOrderDate('');
  };

  // Save edited order
  const saveEditedOrder = () => {
    if (editingOrderIndex === null) return;

    const updatedOrders = [...addedOrders];
    const orderToUpdate = updatedOrders[editingOrderIndex];
    const newQuantity = parseFloat(editOrderQuantity);
    const newDueDate = parseDateFromInput(editOrderDate);

    // Validate inputs
    if (isNaN(newQuantity) || newQuantity <= 0 || !newDueDate) {
      // Show error or handle invalid input
      return;
    }

    // Check if this is an existing order from orderList that needs to be updated in the parent
    if (orderToUpdate.existingOrder && orderToUpdate.orderListIndex !== undefined && onUpdateOrder) {
      // Use the parent update function to update in orderList
      onUpdateOrder(orderToUpdate.orderListIndex, {
        quantity: newQuantity,
        dueDate: newDueDate
      });
    }

    // Update the order in local state
    updatedOrders[editingOrderIndex] = {
      ...updatedOrders[editingOrderIndex],
      quantity: newQuantity,
      dueDate: newDueDate
    };

    setAddedOrders(updatedOrders);
    setEditingOrderIndex(null);
  };

  // Remove an added order
  // Remove an added order
  const removeAddedOrder = (index) => {
    const orderToRemove = addedOrders[index];

    // If this is an existing order from orderList and we have the update function
    if (orderToRemove.existingOrder && orderToRemove.orderListIndex !== undefined && onUpdateOrder) {
      // Create a special "remove" operation that the App.js component will handle
      // This is a signal to remove the order at this index
      onUpdateOrder(orderToRemove.orderListIndex, { __remove: true });
    }

    // Remove the order from local state
    const updatedOrders = [...addedOrders];
    updatedOrders.splice(index, 1);
    setAddedOrders(updatedOrders);
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

  // Get formatted label for the group
  const getGroupLabel = (date) => {
    if (orderGroupBy === 'month') {
      return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    } else {
      const weekStart = getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Format: "Week of Jan 1-7, 2023"
      return `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
    }
  };

  // Calculate balance after work orders
  const calculateBalanceAfterWorkOrders = () => {
    if (!item) return 0;

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

  // Calculate projected running totals including added orders
  const calculateProjectedRunningTotals = useCallback(() => {
    if (!item || !item.runningTotals) return [];
  
    // Clone the original running totals
    const projectedTotals = _.cloneDeep(item.runningTotals);
  
    // Convert dates from strings to Date objects for proper comparison
    projectedTotals.forEach(point => {
      if (typeof point.date === 'string') {
        point.date = new Date(point.date);
      }
    });
  
    // Add manually added orders to the projection
    addedOrders.forEach(order => {
      // Use the order due date as arrival
      const expectedArrivalDate = new Date(order.dueDate);
  
      // Find the right spot to insert this order
      let insertIndex = 0;
      for (let i = 0; i < projectedTotals.length; i++) {
        if (projectedTotals[i].date > expectedArrivalDate) {
          insertIndex = i;
          break;
        }
        if (i === projectedTotals.length - 1) {
          insertIndex = projectedTotals.length;
        }
      }
  
      // Create a new data point for the order arrival
      if (insertIndex < projectedTotals.length) {
        // Insert the order as a new point
        const prevBalance = insertIndex > 0 ? projectedTotals[insertIndex - 1].balance : item.startingBalance;
        const newPoint = {
          date: expectedArrivalDate,
          balance: prevBalance + order.quantity,
          type: 'added-order',
          description: 'Added Order Arrives',
          quantity: order.quantity,
          orderId: order.id
        };
  
        projectedTotals.splice(insertIndex, 0, newPoint);
  
        // Update all subsequent balances
        for (let i = insertIndex + 1; i < projectedTotals.length; i++) {
          projectedTotals[i].balance += order.quantity;
        }
      } else if (projectedTotals.length > 0) {
        // Add to the end if all existing points are earlier
        projectedTotals.push({
          date: expectedArrivalDate,
          balance: projectedTotals[projectedTotals.length - 1].balance + order.quantity,
          type: 'added-order',
          description: 'Added Order Arrives',
          quantity: order.quantity,
          orderId: order.id
        });
      }
    });
  
    // Sort by date
    return _.sortBy(projectedTotals, 'date');
  }, [item, addedOrders]);

  // Analyze required orders - UPDATED to account for added orders
  // Analyze required orders for a specific item
  // Analyze required orders - UPDATED to account for incoming POs within 7 days
  // Analyze required orders - UPDATED to account for incoming POs within 7 days
  // Analyze required orders - UPDATED to account for added orders
// Analyze required orders - UPDATED to account for added orders
const analyzeRequiredOrders = () => {
  if (!item || !item.transactions) return;

  // Sort transactions chronologically, EXCLUDING manually added orders
  // (they're identified by POs with part numbers starting with "UI-")
  const sortedTransactions = _.sortBy(
    item.transactions.filter(t => 
      !(t.type === 1 && t.partNumber && t.partNumber.startsWith('UI-'))
    ), 
    'dueDate'
  );

  // Get today's date and set to midnight for proper comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate the date 7 days from now
  const sevenDaysFromNow = new Date(today);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  // Get group key for grouping
  const getGroupKey = (date) => {
    // Always use today's date for any date in the past
    const adjustedDate = new Date(date) < today ? today : new Date(date);
    
    if (orderGroupBy === 'month') {
      const monthStart = getMonthStart(adjustedDate);
      return monthStart.toISOString().split('T')[0];
    } else {
      const weekStart = getWeekStart(adjustedDate);
      return weekStart.toISOString().split('T')[0];
    }
  };

  // First, identify any POs due within the next 7 days (excluding manually added orders)
  const upcomingPOs = sortedTransactions.filter(t =>
    t.type === 1 && // Is a purchase order
    new Date(t.dueDate) >= today &&
    new Date(t.dueDate) <= sevenDaysFromNow
  );

  // Calculate total quantity coming in from POs in the next 7 days
  const upcomingPOsQuantity = upcomingPOs.reduce((sum, po) => sum + po.quantity, 0);

  // Calculate running balance over time
  let runningBalance = item.startingBalance;
  let positiveTransaction = null;
  let previousBalance = runningBalance;

  // Create a special group key for today (for past-due recommendations)
  const todayGroupKey = getGroupKey(today);
  
  // Identify if there's a current shortage (negative beginning balance)
  let currentShortage = item.startingBalance < 0 ? Math.abs(item.startingBalance) : 0;

  // Check if balance becomes positive in the future
  for (let i = 0; i < sortedTransactions.length; i++) {
    const transaction = sortedTransactions[i];

    if (transaction.type === 1) { // Purchase Order
      runningBalance += transaction.quantity;

      // If balance was negative and now positive, mark this transaction
      if (previousBalance < 0 && runningBalance >= 0 && !positiveTransaction) {
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

  // Store the positive transaction if found
  setPositiveBalanceTransaction(positiveTransaction);

  // Initialize with current balance PLUS upcoming PO quantities
  let simulatedBalance = item.startingBalance + upcomingPOsQuantity;
  
  // Add impact of manually added orders to the simulated balance
  addedOrders.forEach(order => {
    // Add the order quantity to the simulated balance
    simulatedBalance += order.quantity;
  });

  const groupNeeds = {};
  const recommendedOrders = [];

  // If we have a current shortage, create a recommendation for today
  if (currentShortage > 0) {
    const groupStart = orderGroupBy === 'month' ? getMonthStart(today) : getWeekStart(today);
    
    if (!groupNeeds[todayGroupKey]) {
      groupNeeds[todayGroupKey] = {
        groupStart,
        totalNeeded: 0,
        transactions: []
      };
    }
    
    // Add a virtual "current shortage" transaction
    groupNeeds[todayGroupKey].transactions.push({
      type: 'current-shortage',
      dueDate: today,
      impact: currentShortage,
      quantity: currentShortage,
      partNumber: 'Current Shortage',
      availableQuantity: currentShortage
    });
    
    groupNeeds[todayGroupKey].totalNeeded += currentShortage;
    
    // Create an order recommendation for current shortage
    // But only if our simulated balance (with upcoming POs) is still negative
    if (simulatedBalance < 0) {
      const orderQuantity = Math.min(currentShortage, Math.abs(simulatedBalance));
      
      if (orderQuantity > 0.01) {
        recommendedOrders.push({
          groupKey: todayGroupKey,
          groupStart,
          quantity: orderQuantity,
          transactions: [...groupNeeds[todayGroupKey].transactions]
        });
      }
      
      // Update simulated balance for future calculations
      simulatedBalance = Math.max(0, simulatedBalance);
    }
  }

  // Process transactions in chronological order, excluding the upcoming POs
  for (let i = 0; i < sortedTransactions.length; i++) {
    const transaction = sortedTransactions[i];
    const transactionDate = new Date(transaction.dueDate);
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

        // If balance becomes negative, track in group needs
        if (simulatedBalance < 0) {
          if (!groupNeeds[groupKey]) {
            groupNeeds[groupKey] = {
              groupStart: orderGroupBy === 'month'
                ? getMonthStart(transactionDate < today ? today : transactionDate)
                : getWeekStart(transactionDate < today ? today : transactionDate),
              totalNeeded: 0,
              transactions: []
            };
          }

          // Add transaction and its impact to the group need
          groupNeeds[groupKey].transactions.push({
            ...transaction,
            impact: Math.min(transaction.availableQuantity, Math.abs(simulatedBalance))
          });

          groupNeeds[groupKey].totalNeeded += Math.min(transaction.availableQuantity, Math.abs(simulatedBalance));

          // Create an order to bring balance back to zero
          const orderQuantity = Math.abs(simulatedBalance);
          simulatedBalance = 0; // Balance is now zero after hypothetical order

          // Store recommendation - only if quantity is significant (greater than 0.01)
          if (orderQuantity > 0.01) {
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
      simulatedBalance -= transaction.quantity;

      // If balance becomes negative, track in group needs
      if (simulatedBalance < 0) {
        if (!groupNeeds[groupKey]) {
          groupNeeds[groupKey] = {
            groupStart: orderGroupBy === 'month'
              ? getMonthStart(transactionDate < today ? today : transactionDate)
              : getWeekStart(transactionDate < today ? today : transactionDate),
            totalNeeded: 0,
            transactions: []
          };
        }

        // Add transaction and its impact to the group need
        groupNeeds[groupKey].transactions.push({
          ...transaction,
          impact: Math.min(transaction.quantity, Math.abs(simulatedBalance))
        });

        groupNeeds[groupKey].totalNeeded += Math.min(transaction.quantity, Math.abs(simulatedBalance));

        // Create an order to bring balance back to zero
        const orderQuantity = Math.abs(simulatedBalance);
        simulatedBalance = 0; // Balance is now zero after hypothetical order

        // Store recommendation - only if quantity is significant (greater than 0.01)
        if (orderQuantity > 0.01) {
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
        existing.dueDate && t.dueDate && existing.dueDate.getTime && t.dueDate.getTime &&
        existing.dueDate.getTime() === t.dueDate.getTime() &&
        existing.partNumber === t.partNumber &&
        existing.type === t.type
      )) {
        consolidatedOrders[order.groupKey].transactions.push(t);
      }
    });
  });

  // Convert to array, filter out orders with quantity ≤ 0.01, and sort by groupStart date
  const finalRecommendations = Object.values(consolidatedOrders)
    .filter(order => order.quantity > 0.01) // Filter out zero or nearly-zero quantity orders
    .sort((a, b) => a.groupStart - b.groupStart);

  // Add info about upcoming POs if available
  if (upcomingPOs.length > 0) {
    setUpcomingPOInfo({
      pos: upcomingPOs,
      totalQuantity: upcomingPOsQuantity,
      allocated: 0, // We're now applying the entire PO to the starting balance
      remainingAfterAllocation: 0
    });
  } else {
    setUpcomingPOInfo(null);
  }

  setWeeklyOrderSuggestions(finalRecommendations);
};

  // Reset upcomingPOInfo when item changes
  useEffect(() => {
    setUpcomingPOInfo(null);
  }, [item?.item]); // Only run when the item identifier changes

  
  // Analyze orders when item changes or grouping changes or when addedOrders changes
  useEffect(() => {
    if (item && (item.orders?.length > 0 || item.startingBalance < 0 || calculateBalanceAfterWorkOrders() < 0)) {
      analyzeRequiredOrders();
    } else {
      setWeeklyOrderSuggestions([]);
      setPositiveBalanceTransaction(null);
      setUpcomingPOInfo(null); // Clear upcomingPOInfo when no analysis is needed
    }

    // Calculate projected running totals including added orders
    const projectedTotals = calculateProjectedRunningTotals();
    setProjectedRunningTotals(projectedTotals);
  }, [item, orderGroupBy, leadTimeWeeks, addedOrders, calculateProjectedRunningTotals]);

  // Early return if no item is selected
  if (!item) {
    return <div className="p-6 text-center text-gray-500">Please select an item to view details.</div>;
  }

  // Deduplicate transactions before rendering to fix the duplicate display issue
  const deduplicatedTransactions = [];
  const transactionKeys = new Set();

  if (item.transactions) {
    item.transactions.forEach(transaction => {
      // Create a unique key for each transaction
      const key = `${transaction.type}-${transaction.partNumber}-${new Date(transaction.dueDate).getTime()}-${transaction.quantity}`;

      // Only add if not already in our deduplicated list
      if (!transactionKeys.has(key)) {
        transactionKeys.add(key);
        deduplicatedTransactions.push(transaction);
      }
    });
  }

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

  return (
    <div className="space-y-6" ref={componentRef} tabIndex="0">
      {/* Item Header with Navigation */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold">{item.item}</h2>
              <div className="flex items-center space-x-1">
                <button
                  className={`p-1 rounded ${hasPreviousItem ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-300 cursor-not-allowed'}`}
                  onClick={goToPreviousItem}
                  disabled={!hasPreviousItem}
                  title="Previous Item (Left Arrow Key)"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm text-gray-500">
                  {filteredItems.length > 0 ? `${currentItemIndex + 1} of ${filteredItems.length}` : ''}
                </span>
                <button
                  className={`p-1 rounded ${hasNextItem ? 'text-blue-600 hover:bg-blue-100' : 'text-gray-300 cursor-not-allowed'}`}
                  onClick={goToNextItem}
                  disabled={!hasNextItem}
                  title="Next Item (Right Arrow Key)"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
            <p className="text-gray-600">Category: {item.category} | Vendor: {item.vendor}</p>
          </div>

          <div className="flex items-end space-x-2">
            <div className="flex flex-col">
              <label className="text-sm text-gray-600 mb-1">Quantity:</label>
              <input
                type="number"
                min="1"
                className="p-1 border rounded w-24"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddToOrder();
                  }
                }}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm text-gray-600 mb-1">Due Date:</label>
              <input
                type="date"
                className="px-3 py-2 border rounded text-sm"
                value={orderDueDate}
                onChange={(e) => setOrderDueDate(e.target.value)}
              />
            </div>

            <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 self-end"
              onClick={() => handleAddToOrder()}
            >
              Add to Order
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-500">Current Balance</p>
            <p className={`text-xl font-semibold ${item.startingBalance < 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {item.startingBalance}
            </p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-500">Balance After WO</p>
            <p className={`text-xl font-semibold ${calculateBalanceAfterWorkOrders() < 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {calculateBalanceAfterWorkOrders().toFixed(2)}
            </p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-500">Open POs</p>
            <p className="text-xl font-semibold text-gray-800">
              {item.purchaseOrders ? item.purchaseOrders.length : 0}
            </p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-500">Work Orders</p>
            <p className="text-xl font-semibold text-gray-800">
              {item.workOrders ? item.workOrders.length : 0}
            </p>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <p className="text-sm text-gray-500">Added Orders</p>
            <p className="text-xl font-semibold text-green-600">
              {addedOrders.length > 0 ? addedOrders.length : 0}
            </p>
            {addedOrders.length > 0 && (
              <p className="text-xs text-gray-500">
                Total: {addedOrders.reduce((sum, order) => sum + order.quantity, 0)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Current Orders Panel */}
      {addedOrders.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Added Orders</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Order Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Due Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {addedOrders.map((order, index) => (
                  <tr key={order.id || index} className={editingOrderIndex === index ? "bg-blue-50" : ""}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                      {new Date(order.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {editingOrderIndex === index ? (
                        <input
                          type="date"
                          className="p-1 border rounded w-full"
                          value={editOrderDate}
                          onChange={(e) => setEditOrderDate(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveEditedOrder();
                            }
                          }}
                        />
                      ) : (
                        <span className="text-gray-500">
                          {new Date(order.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {editingOrderIndex === index ? (
                        <input
                          type="number"
                          min="1"
                          className="p-1 border rounded w-24"
                          value={editOrderQuantity}
                          onChange={(e) => setEditOrderQuantity(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveEditedOrder();
                            }
                          }}
                        />
                      ) : (
                        <span className="text-gray-900 font-medium">{order.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm space-x-2">
                      {editingOrderIndex === index ? (
                        <>
                          <button
                            className="p-1 text-green-600 hover:text-green-800"
                            onClick={saveEditedOrder}
                            title="Save"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button
                            className="p-1 text-gray-600 hover:text-gray-800"
                            onClick={cancelEditingOrder}
                            title="Cancel"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="p-1 text-blue-600 hover:text-blue-800"
                            onClick={() => startEditingOrder(index)}
                            title="Edit Order"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            className="p-1 text-red-600 hover:text-red-800"
                            onClick={() => removeAddedOrder(index)}
                            title="Remove Order"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Recommendations Section - with PO coverage info */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Order Recommendations</h3>

          <div className="flex items-center space-x-4">
            {/* Group By toggle buttons */}
            <div className="flex border rounded overflow-hidden">
              <button
                className={`px-3 py-1 text-sm ${orderGroupBy === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                onClick={() => setOrderGroupBy('week')}
              >
                Group by Week
              </button>
              <button
                className={`px-3 py-1 text-sm ${orderGroupBy === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                onClick={() => setOrderGroupBy('month')}
              >
                Group by Month
              </button>
            </div>

            {/* Lead Time input */}
            <div className="flex items-center">
              <label className="text-sm text-gray-600 mr-2">Lead Time (weeks):</label>
              <input
                type="number"
                min="1"
                className="w-16 px-2 py-1 border rounded"
                value={leadTimeWeeks}
                onChange={(e) => setLeadTimeWeeks(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
        </div>

        {/* Display upcoming PO info if available */}
        {upcomingPOInfo && upcomingPOInfo.pos.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <Calendar className="text-blue-500 mr-3 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <h5 className="font-semibold text-blue-800 text-sm">Upcoming Purchase Orders (Next 7 Days)</h5>
                <p className="text-blue-800 text-sm mt-1">
                  You have {upcomingPOInfo.pos.length} PO{upcomingPOInfo.pos.length > 1 ? 's' : ''} with
                  a total of {upcomingPOInfo.totalQuantity} units arriving in the next 7 days.
                  {upcomingPOInfo.allocated > 0 && (
                    <span> These will cover {upcomingPOInfo.allocated} units of future demand.</span>
                  )}
                </p>

                {/* Display each upcoming PO */}
                <div className="mt-2 grid gap-2">
                  {upcomingPOInfo.pos.map((po, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <Package size={14} className="mr-2 text-blue-500" />
                      <span className="font-medium">PO: {po.partNumber}</span>
                      <span className="mx-2">|</span>
                      <span>{po.quantity} units</span>
                      <span className="mx-2">|</span>
                      <span>Due: {new Date(po.dueDate).toLocaleDateString()}</span>
                      <button
                        className="ml-auto px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                        onClick={() => handleAddToCheckList(po)}
                      >
                        <Clock size={16} className="mr-1" />
                        Check On
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Display message if no recommendations */}
        {!positiveBalanceTransaction && weeklyOrderSuggestions.length === 0 ? (
          <div className="py-4 text-center">
            {upcomingPOInfo && upcomingPOInfo.pos.length > 0 ? (
              <div className="text-green-700 font-medium">
                <CheckCircle size={24} className="inline-block mr-2 align-middle" />
                <span>No additional orders needed. Upcoming POs will cover all projected demand.</span>
              </div>
            ) : (
              <p className="text-gray-500">No order recommendations at this time.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Attention Required for PO - Only show if no upcoming POs */}
            {positiveBalanceTransaction && !upcomingPOInfo && (
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                <div className="flex items-start">
                  <AlertTriangle className="text-yellow-500 mr-3 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-semibold text-yellow-800">Attention Required</h4>
                    <p className="text-yellow-800 mt-1">
                      A future purchase order will bring the balance positive on {new Date(positiveBalanceTransaction.dueDate).toLocaleDateString()}.
                      Consider moving this order up to address current negative balance.
                    </p>
                    <div className="mt-3 p-3 bg-white rounded border border-yellow-200">
                      <div className="flex items-center">
                        <ArrowUp className="text-green-500 mr-2" size={16} />
                        <p className="text-sm">
                          <span className="font-medium">PO:</span> {positiveBalanceTransaction.partNumber} |
                          <span className="font-medium"> Quantity:</span> {positiveBalanceTransaction.quantity} |
                          <span className="font-medium"> Date:</span> {new Date(positiveBalanceTransaction.dueDate).toLocaleDateString()}
                        </p>
                        <button
                          className="ml-auto px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                          onClick={() => handleAddToCheckList(positiveBalanceTransaction)}
                        >
                          <Clock size={16} className="mr-1" />
                          Check On
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Weekly/Monthly Order Suggestions */}
            {weeklyOrderSuggestions.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-700 mb-2">
                  {positiveBalanceTransaction ?
                    "Additional Orders Needed" :
                    `${orderGroupBy === 'month' ? 'Monthly' : 'Weekly'} Order Suggestions`}
                </h4>
                <div className="divide-y divide-gray-200 border rounded-lg">
                  {weeklyOrderSuggestions.map((suggestion, index) => (
                    <div key={index} className="bg-white">
                      <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpandGroup(`group-${index}`)}>
                        <div>
                          <span className="font-medium">
                            {getGroupLabel(suggestion.groupStart)}
                          </span>
                          <span className="ml-4 text-green-600 font-medium">
                            Order: {suggestion.quantity.toFixed(2)} units
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-gray-500 text-sm mr-2 flex items-center">
                            <Calendar size={14} className="mr-1" />
                            Needs to be in by: {formatDate(calculateNeedsToBeInByDate(suggestion.groupStart))}
                          </span>
                          <button
                            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 mr-4"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Directly add to order with suggested values
                              handleAddToOrder(
                                suggestion.quantity,
                                calculateDueDate(suggestion.groupStart)
                              );
                            }}
                          >
                            Add to Order
                          </button>
                          {expandedGroups[`group-${index}`] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {expandedGroups[`group-${index}`] && (
                        <div className="px-4 py-3 bg-gray-50 border-t">
                          <p className="text-sm text-gray-600 mb-2">
                            This order covers {suggestion.transactions.length} transactions:
                          </p>
                          <table className="min-w-full divide-y divide-gray-200 border rounded-lg">
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Balance Trend Chart */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Balance Trend</h3>
          {addedOrders.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                <span className="inline-flex items-center mr-2">
                  <span className="h-3 w-3 rounded-full bg-green-500 mr-1"></span>
                  Added orders included
                </span>
                <span className="inline-flex items-center">
                  <span className="h-3 w-3 rounded-full bg-blue-500 mr-1"></span>
                  Original projection
                </span>
              </span>
            </div>
          )}
        </div>

        {(item.runningTotals && item.runningTotals.length > 0) ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={addedOrders.length > 0 ? projectedRunningTotals : item.runningTotals}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "Added Orders Impact") return [`+${value}`, name];
                    return [`${value}`, name];
                  }}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const dataPoint = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded shadow">
                          <p className="font-bold">{new Date(label).toLocaleDateString()}</p>
                          <p className="text-sm">{dataPoint.description || "Balance"}: {payload[0].value}</p>
                          {dataPoint.type === 'added-order' && (
                            <p className="text-sm text-green-600">Added Order: +{dataPoint.quantity}</p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="stepAfter"
                  dataKey="balance"
                  stroke={addedOrders.length > 0 ? "#10B981" : "#3b82f6"}
                  name={addedOrders.length > 0 ? "Projected Balance with Orders" : "Projected Balance"}
                />
                {addedOrders.map((order, index) => (
                  <ReferenceLine
                    key={order.id || index}
                    x={order.dueDate}
                    stroke="#10B981"
                    strokeDasharray="3 3"
                    label={{
                      value: `+${order.quantity}`,
                      position: 'top',
                      fill: '#10B981',
                      fontSize: 10
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500">No balance trend data available.</p>
        )}
      </div>

      {/* Transactions */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Transactions</h3>

        {deduplicatedTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Running Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  let runningTotal = item.startingBalance;
                  return deduplicatedTransactions.map((transaction, index) => {
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

                    // Check if this is the positive transaction we flagged
                    const isPositiveTransaction = positiveBalanceTransaction &&
                      transaction.dueDate.getTime() === positiveBalanceTransaction.dueDate.getTime() &&
                      transaction.partNumber === positiveBalanceTransaction.partNumber &&
                      transaction.type === positiveBalanceTransaction.type;

                    // Check if this open sale is covered by a work order
                    const isCovered = transaction.type === 4 && transaction.covered;
                    const coverType = transaction.coverType; // Get the type of work order that covered this sale

                    return (
                      <tr key={index} className={`
                        ${isPositiveTransaction ? "bg-yellow-50" : "hover:bg-gray-50"} 
                        ${isCovered ? "bg-green-50" : ""}
                      `}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getTransactionTypeDescription(transaction.type)}
                          {isPositiveTransaction && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              <AlertTriangle size={12} className="mr-1" /> Move up
                            </span>
                          )}
                          {isCovered && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle size={12} className="mr-1" />
                              Covered by {coverType === 'released' ? 'Released WO' : 'Issued WO'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(transaction.dueDate).toLocaleDateString()}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${transaction.type === 1 || transaction.type === 3 ? 'text-green-600' :
                          (transaction.type === 4 || transaction.type === 6) ? 'text-red-600' : 'text-gray-900'
                          }`}>
                          {transaction.type === 1 || transaction.type === 3 ? '+' :
                            (transaction.type === 4 || transaction.type === 6) ? '-' : ''}
                          {transaction.quantity}
                          {transaction.type === 4 && transaction.covered && (
                            <span className="text-gray-500 ml-1">(covered)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {transaction.partNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {runningTotal.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-2">
                            <button
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs flex items-center"
                              onClick={() => handleAddToCheckList(transaction)}
                            >
                              <Clock size={14} className="mr-1" />
                              Check On
                            </button>

                            {/* Add Receive button only for open PO transactions */}
                            {transaction.type === 1 && (
                              <button
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs flex items-center"
                                onClick={() => handleReceivePO(transaction)}
                              >
                                <Package size={14} className="mr-1" />
                                Receive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No transactions available.</p>
        )}
      </div>

      {/* Note Modal for Check On */}
    {showNoteModal && selectedTransaction && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
          <h3 className="text-lg font-semibold mb-2">Add to Check On List</h3>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium">Item:</span> {item?.item}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium">Transaction Type:</span> {getTransactionTypeDescription(selectedTransaction.type)}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium">Due Date:</span> {new Date(selectedTransaction.dueDate).toLocaleDateString()}
            </p>
            
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Add Notes:
            </label>
            <textarea
              ref={noteInputRef}
              className="w-full px-3 py-2 border rounded text-sm min-h-[100px]"
              value={checkOnNote}
              onChange={(e) => setCheckOnNote(e.target.value)}
              placeholder="Add any notes about what needs to be checked or followed up on..."
            ></textarea>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400"
              onClick={() => setShowNoteModal(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={submitCheckOn}
            >
              Add to Check List
            </button>
          </div>
        </div>
      </div>
    )}
      
    </div>
  );
}

export default ItemDetail;