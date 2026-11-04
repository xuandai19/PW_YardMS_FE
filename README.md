# Yard Management System (YMS) — Web Application

This is the web frontend client for the Yard Management System (YMS). It provides management interfaces for operations, tracking, goods management, driver confirmations, finance & invoicing, and reporting dashboards.

## 🛠 Technology Stack

* **Core Framework**: React 19, TypeScript
* **Build Tool**: Vite
* **Routing**: React Router 7
* **UI Components & Icons**: Ant Design (antd), Ant Design Icons
* **Styling**: Tailwind CSS
* **HTTP Client**: Axios
* **Realtime Communication**: STOMP over WebSockets (`@stomp/stompjs`)
* **GIS & Mapping**: Leaflet, React-Leaflet, OpenStreetMap
* **Testing**: Vitest, React Testing Library

## 📁 Project Structure

```
frontend-web/
├── public/                 # Static assets
├── src/
│   ├── api/                # Axios instance & domain API clients
│   ├── assets/             # Images and design resources
│   ├── components/         # Reusable UI components (Sidebar, Header, Layout, etc.)
│   ├── context/            # AuthContext and global state providers
│   ├── pages/              # Workspace pages by feature
│   │   ├── auth/           # Login screen
│   │   ├── operations/     # Vehicle pre-notification, check-in/out, yard capacity
│   │   ├── tracking/       # GPS tracking, geofencing, route playback
│   │   ├── goods/          # Goods QR creation, camera scanning, reconciliation
│   │   ├── confirmation/   # SLA confirmations & driver signature pad
│   │   ├── finance/        # Debt management, invoices, bank payments
│   │   └── reports/        # Realtime dashboard, monthly/quarterly exports
│   ├── router/             # React Router 7 setup & ProtectedRoute wrapper
│   ├── types/              # TypeScript interfaces & API DTO definitions
│   └── utils/              # Helper functions, formatting, token storage
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

## 🚀 Getting Started

### 1. Prerequisites

Ensure Node.js (v18+) and `npm` are installed on your machine. Ensure the backend service is running locally at `http://localhost:8080`.

### 2. Environment Setup

Create or update the `.env` file inside the `frontend-web` root directory:

```env
VITE_API_BASE_URL=http://localhost:8080/api
VITE_PUBLIC_APP_URL=http://localhost:5173
```

> **Mobile QR Testing**: To allow physical smartphones to scan vehicle/goods QR codes and open details on your local network:
> 1. Replace `localhost` in `.env` with your computer's LAN IP address (e.g., `http://192.168.1.100:8080/api`).
> 2. Launch Vite bound to host `0.0.0.0`: `npm run dev -- --host 0.0.0.0`

## 🔨 Available Scripts

Run commands from the `/frontend-web` directory:

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

### Run Tests

```bash
npm test
```

### Build for Production

```bash
npm run build
```

The compiled output will be generated in the `/dist` directory.

### Preview Production Build

```bash
npm run preview
```

## 💻 Workspaces & Features

1. **Vận hành (Operations - Sprint 2)**:
   * Partner A vehicle pre-notification with a 4-hour advance requirement.
   * HMAC QR display for vehicles.
   * Camera/manual QR scanner for gate check-in/out.
   * Yard allocation, layout schematic, and alerts for yards > 90% capacity.
   * Hourly service dispatch with real-time timers.

2. **Theo dõi GPS (Tracking - Sprint 3)**:
   * Leaflet/OpenStreetMap integration for live vehicle telemetry.
   * Authenticated STOMP updates (`/ws` endpoint).
   * Circular geofence configuration and route deviation warning panels.

3. **Hàng hóa QR (Goods QR - Sprint 3)**:
   * Batch generation of unique item-level QR codes.
   * Camera-based reconciliation scan against original manifests.
   * Discrepancy report highlighting quantity mismatches.

4. **Xác nhận tài xế (Driver Confirmation - Sprint 3)**:
   * Realtime SLA monitor (30-minute response SLA).
   * Touch signature capture pad for driver arrivals/departures.

5. **Công nợ & Hóa đơn (Finance & Invoices - Sprint 4)**:
   * Partner balance query and daily interest history.
   * Invoice generation for completed service orders.
   * Bank transfer payment entry with image proof preview/upload.
   * PDF invoice view and download.

6. **Báo cáo (Reports - Sprint 4)**:
   * Monthly and quarterly financial/operational aggregations.
   * Partner A vs Partner C reconciliation tables.
   * Realtime KPI dashboard via STOMP subscription (`/topic/dashboard`).
   * Excel (`.xlsx`) and PDF export options for financial data.