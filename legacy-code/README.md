# Cardmarket Sales Tracker

A simple, browser-based tool to analyze your Magic: The Gathering sales data exported from Cardmarket.

**Live Tool:** [https://danmoreng.github.io/cardmarket-tracker/](https://danmoreng.github.io/cardmarket-tracker/)

![Screenshot of the Site](./screenshots/example.png)

## What it Does

This tool helps you visualize and understand your Cardmarket sales performance by processing the CSV files you can download from your Cardmarket account. It provides:

* A quick summary of total revenue, fees, shipping charged, and net earnings.
* A sortable table listing all your transactions with financial details.
* A sortable table listing every individual item sold, linked to its Cardmarket page and associated transaction.
* A modal view showing the specific items contained within any selected transaction.

## Features

* **CSV Upload:** Accepts standard Cardmarket "Sales" and "Sold Articles" CSV exports (semicolon-delimited).
* **Sales Summary:** Calculates and displays key financial metrics.
* **Transaction Table:** View all sales transactions, sortable by ID, Date (if available), Item Count, Financials.
* **Sold Items Table:** View all individual articles sold, sortable by Transaction ID, Set, Card Name, and Price. Includes links to the Cardmarket product page.
* **Interactive Details:** Click on a Transaction ID in either table to see a detailed list of items for that specific transaction in a pop-up modal. The modal title also links directly to the order page on Cardmarket.
* **Local Data Storage:** Uses your browser's Local Storage to remember uploaded data between sessions.
* **Data Privacy:** All data processing happens entirely within your browser using JavaScript. **No data is ever uploaded or sent to any external server.**

## How to Use

1.  **Access the Tool:** Go to [https://danmoreng.github.io/cardmarket-tracker/](https://danmoreng.github.io/cardmarket-tracker/).
2.  **Upload Data:**
    * Click the "Upload Sales Data" button.
    * In the modal that appears, use the file inputs to select:
        * Your **Sales CSV** (downloaded from Cardmarket → My Account → Transactions → All Transactions → Download CSV). https://www.cardmarket.com/de/Magic/Account/Transactions/Details
        * Your **Sold Articles CSV** (downloaded from Cardmarket → My Account → Statistics → Sold Articles -> CSV Export). https://www.cardmarket.com/de/Magic/Account/Statistics
    * The tool will parse the files and display feedback. Click "Done" to close the modal.
3.  **View Summary:** The summary boxes will update with calculated totals based on the uploaded data.
4.  **Explore Tabs:**
    * **Transactions Tab:** Shows a table of your sales transactions. Click column headers to sort. Click on a Transaction ID to view the items in that order.
    * **Sold Items List Tab:** Shows a table of every individual item sold. Click column headers to sort. Click on a Card Name to go to its Cardmarket page. Click on a Transaction ID to view all items in that order.
5.  **Clear Data:** Use the "Clear Stored Data" button to remove all data stored in your browser's Local Storage for this tool.

*Note: Ensure your CSV files use the expected headers (e.g., 'Reference', 'Amount', 'Shipment nr.', 'Article Value', 'Expansion', 'Article'). If columns are missing, some calculations or views might be incomplete.*

## Data Privacy

**Your data stays on your computer.** This tool is built purely with HTML, CSS (Tailwind), and client-side JavaScript.

* **No Server:** There is no backend server involved.
* **Local Processing:** CSV parsing and calculations happen directly in your web browser.
* **Local Storage:** Uploaded data is saved in your browser's Local Storage *only* so you don't have to re-upload files every time you visit. This data is not transmitted anywhere. You can clear it anytime using the "Clear Stored Data" button.

## Technology

* HTML
* Tailwind CSS
* Vanilla JavaScript (ES6+)

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.