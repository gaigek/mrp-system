import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import _ from 'lodash';

function Dashboard({ stockItems, onCardClick }) {
  // Calculate summary metrics
  const totalItems = stockItems.length;
  const itemsWithNegativeBalance = stockItems.filter(item => item.startingBalance < 0).length;
  const itemsRequiringOrder = stockItems.filter(item => item.orders && item.orders.length > 0).length;
  
  // Get top items requiring attention (negative balance or most orders needed)
  const topCriticalItems = _.take(
    _.orderBy(
      stockItems.filter(item => item.startingBalance < 0 || (item.orders && item.orders.length > 0)),
      [item => item.startingBalance < 0 ? 1 : 0, item => item.orders ? item.orders.length : 0],
      ['desc', 'desc']
    ),
    10
  );
  
  // Prepare data for charts
  const categoryBreakdown = _.map(
    _.groupBy(stockItems, 'category'),
    (items, category) => ({
      category: category || 'Uncategorized',
      count: items.length,
      totalOrders: _.sumBy(items, item => item.orders ? item.orders.length : 0)
    })
  ).filter(cat => cat.category !== 'undefined');
  
  // Calculate monthly material usage (only transactions that subtract from running total)
  const monthlyUsageData = [];
  
  stockItems.forEach(item => {
    // Filter to only include transactions that decrease quantity (types 4 and 6)
    // Type 4 = Open Sales, Type 6 = Issued WO (consumption)
    const usageTransactions = item.transactions ? 
      item.transactions.filter(t => t.type === 4 || t.type === 6) : 
      [];
    
    usageTransactions.forEach(transaction => {
      const date = new Date(transaction.dueDate);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const existingMonth = monthlyUsageData.find(m => m.month === month);
      
      if (existingMonth) {
        existingMonth.quantity += transaction.quantity;
        existingMonth.itemCount += 1;
      } else {
        monthlyUsageData.push({
          month,
          quantity: transaction.quantity,
          itemCount: 1,
          date: date
        });
      }
    });
  });
  
  const sortedMonthlyData = _.sortBy(monthlyUsageData, 'date');
  
  return (
    <div className="space-y-6">
      {/* Summary Cards - now clickable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          className="bg-white p-4 rounded-lg shadow cursor-pointer hover:bg-blue-50 transition-colors"
          onClick={() => onCardClick('totalItems')}
        >
          <h3 className="text-lg font-semibold text-gray-700">Total Items</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{totalItems}</p>
          <p className="text-sm text-gray-500 mt-2">Click to view all items</p>
        </div>
        
        <div 
          className="bg-white p-4 rounded-lg shadow cursor-pointer hover:bg-red-50 transition-colors"
          onClick={() => onCardClick('negativeBalance')}
        >
          <h3 className="text-lg font-semibold text-gray-700">Items with Negative Balance</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">{itemsWithNegativeBalance}</p>
          <p className="text-sm text-gray-500 mt-2">Click to view items with negative balance</p>
        </div>
        
        <div 
          className="bg-white p-4 rounded-lg shadow cursor-pointer hover:bg-yellow-50 transition-colors"
          onClick={() => onCardClick('requiresOrder')}
        >
          <h3 className="text-lg font-semibold text-gray-700">Items Requiring Orders</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{itemsRequiringOrder}</p>
          <p className="text-sm text-gray-500 mt-2">Click to view items that need orders</p>
        </div>
      </div>
      
      {/* Monthly Material Usage Trend */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Monthly Material Usage Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sortedMonthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tickFormatter={(value) => {
                  const [year, month] = value.split('-');
                  return `${month}/${year.slice(2)}`;
                }}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [`${value} units`, 'Quantity']}
                labelFormatter={(value) => {
                  const [year, month] = value.split('-');
                  return `Month: ${month}/${year}`;
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="quantity" stroke="#ef4444" name="Material Usage" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Category Breakdown */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Category Breakdown</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="#3b82f6" name="Item Count" />
              <Bar yAxisId="right" dataKey="totalOrders" fill="#f59e0b" name="Total Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Critical Items */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Critical Items Requiring Attention</h3>
        {topCriticalItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders Needed</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topCriticalItems.map((item, index) => (
                  <tr key={index} className={item.startingBalance < 0 ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.item}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.vendor}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${item.startingBalance < 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {item.startingBalance}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.orders ? item.orders.length : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500">No critical items found.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;