# MRP System

An interactive web application for MRP (Material Requirements Planning) data visualization and order management.

## Features

- Upload and process MRP data from CSV files
- Interactive dashboard with inventory status visualization
- Inventory management with searchable and filterable items
- Detailed item view with transaction history and balance trends
- Order management system for creating and exporting purchase orders
- Data visualization tools for inventory trends and category analysis

## Prerequisites

- Node.js (v14 or newer)
- npm (v6 or newer)

## Installation

1. Clone this repository or extract the files to your local machine
2. Navigate to the project directory in your terminal
3. Install dependencies:

```bash
npm install
```

## Running the Application

To start the development server:

```bash
npm start
```

This will run the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

## Using the Application

1. **Upload MRP Data**:
   - Use the "Upload CSV" button in the sidebar
   - Select your MRP data CSV file with the proper format

2. **Navigate Through Sections**:
   - Dashboard: Overview of inventory status and trends
   - Inventory: List of all stock items with filtering options
   - Item Details: Detailed view of selected item with transactions and orders
   - Order Management: Create, manage, and export orders

3. **Creating Orders**:
   - Add items to the order list from the Inventory or Item Details pages
   - Adjust quantities in the Order Management page
   - Group orders by vendor or category
   - Export orders as CSV

## MRP Data Format

The application expects a CSV file with columns in the following order:

1. Transaction Type (0-8)
2. Stock Item Number
3. Due Date
4. Part Number
5. Quantity
6. Vendor
7. Purchase Order
8. Category

Transaction Types:
- 0: Beginning Balance
- 1: Open PO
- 2: Open WO
- 3: Released WO
- 4: Open Sale
- 5: Planned Requirement
- 6: Issued
- 7: Quote
- 8: Min Balance

## Building for Production

To build the app for production:

```bash
npm run build
```

This will create an optimized build in the `build` folder ready for deployment.