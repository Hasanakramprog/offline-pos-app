# MiniMarket POS

An offline Point of Sale (POS) system tailored for minimarkets, built with modern web technologies and packaged as a desktop application.

## 🚀 Features

- **Offline First**: Entirely offline architecture ensuring your POS works even without an internet connection.
- **Inventory Management**: Track and manage your products, stock levels, and categories seamlessly.
- **Sales & Transactions**: Fast checkout process, barcode scanning support, and receipt generation.
- **Dashboard & Analytics**: Real-time insights into your daily sales, revenue, top products, and expenses.
- **Multi-currency Support**: Configurable currency rates (e.g., USD to LBP).

## 🛠️ Technology Stack

- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Lucide Icons](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Charts**: [Recharts](https://recharts.org/)
- **Desktop Packaging**: [Electron](https://www.electronjs.org/) + [Electron Builder](https://www.electron.build/)
- **Database**: SQLite (via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) & [sql.js](https://github.com/sql-js/sql.js/))

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Hasanakramprog/offline-pos-app.git
   cd offline-pos-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Initialize the local database:
   ```bash
   npm run db:init
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Building for Production

To build the executable application for Windows:
```bash
npm run build
```
The compiled installer and portable executables will be available in the `release/` directory.

## 📄 License

This project is licensed under the MIT License.
