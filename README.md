# PMS-HSG

**PMS-HSG** is a hotel management monorepo for the Hotel Sandhya Grand property:
a backend API, an admin dashboard, a public website, and a separate multi-tenant
control plane for running more than one hotel on the same codebase.

## Repository Structure

| Path        | What it is | Runs as |
|-------------|-----------|---------|
| `server/`   | Node/Express API. Also serves the built admin SPA. | PM2 app `sandhya-api`, port 5002 |
| `client/`   | Admin dashboard (React 19 + MUI 9, CRA). | Static bundle served by `server/` |
| `website/`  | Public marketing site + booking enquiry + in-room service menu. | Static bundle behind nginx |
| `platform/` | **Control plane.** Creates, suspends and reconfigures hotels; owns the tenant registry and operator accounts. Imports no hotel schemas. | PM2 app `sandhya-platform`, port 5100 — **optional** |
| `deploy/`   | Production runbook, PM2 config, nginx vhosts, env templates. | — |

### How the pieces relate

```
                       platform/  (control plane, optional)
                            |
                            |  writes the tenant registry (pms_control DB)
                            v
  website/  ──/api──>  server/  ──> MongoDB: one database per hotel
  client/   ──/api──>     ^
                          |
              resolves the hotel from the request host
```

A **single-hotel deployment does not run `platform/` at all** — `server/` falls
back to the base database when no tenant is configured, and behaves exactly as
it did before multi-tenancy existed. Read `server/MULTI_TENANT.md` before
touching anything under `server/db/`, and `deploy/DEPLOY.md` section 11 before
standing the control plane up.

### Where the deeper documentation lives

- `server/MULTI_TENANT.md` — database-per-hotel, host→tenant resolution, and the
  verified reasons the API runs as a single process.
- `platform/README.md` — control-plane setup and the operator console.
- `client/README.md` — admin app: auth model, route/permission config, PWA.
- `deploy/DEPLOY.md` — the production runbook.

## Key Features

- Room booking and reservation management
- Guest and customer management
- Invoice generation and payments
- Banquet and restaurant management
- Housekeeping and maintenance tracking
- Staff attendance, payroll, and role management
- Channel management and online booking integrations
- File uploads for documents, menus, and assets
- Real-time updates using Socket.IO
- API documentation via Swagger

## Tech Stack

### Server

- Node.js with ES modules
- Express.js
- MongoDB with Mongoose
- Socket.IO
- JWT authentication
- Swagger/OpenAPI
- Multer file uploads
- Structured console logging (level-filtered; PM2 captures stdout/stderr to /var/log/sandhya/)

### Client

- React
- Material UI
- React Router DOM
- React Query
- Axios
- Chart.js, Recharts, PDF export, QR codes
- Tesseract OCR support

### Website

- React
- Tailwind CSS
- Headless UI
- Heroicons
- Swiper

## Prerequisites

- Node.js (recommend v18+ or latest LTS)
- npm
- MongoDB database or Atlas cluster

## Setup

### 1. Clone the repository

```bash
git clone <repository-url> PMS-HSG
cd PMS-HSG
```

### 2. Configure the server environment

Create a `.env` file inside `server/` with the values required by the API.

Example variables:

```env
MONGODB_URI=mongodb://localhost:27017/pms-hsg
JWT_SECRET=your_jwt_secret
PORT=5002
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3002
UPLOAD_DIR=uploads
REQUEST_TIMEOUT_MS=30000
TRUST_PROXY=false
```

> The server loads environment variables from `server/config/env.js`.

### 3. Install dependencies

```bash
cd server
npm install

cd ../client
npm install

cd ../website
npm install
```

### 4. Start services

Run the API server:

```bash
cd server
npm run dev
```

Run the admin dashboard:

```bash
cd client
npm start
```

Run the public website:

```bash
cd website
npm start
```

## Available Scripts

### Server

- `npm start` - start the API server
- `npm run dev` - start the server in development mode with `nodemon`

### Client

- `npm start` - run the admin dashboard locally on `http://localhost:3001`
- `npm run build` - build the production bundle
- `npm test` - run tests

### Website

- `npm start` - run the public website locally on `http://localhost:3002`
- `npm run build` - build the production bundle
- `npm test` - run tests

## Notes on Proxies and CORS

- `client/package.json` and `website/package.json` both proxy API requests to `http://localhost:5002`.
- The server CORS configuration permits local origins in development and uses `ALLOWED_ORIGINS` in production.

## Uploads and Storage

The backend initializes upload directories under `server/uploads/` by default. It creates subfolders such as:

- `id-cards`
- `logos`
- `backgrounds`
- `menu-items`
- `aadhar`

You can override the base upload path with `UPLOAD_DIR`.

## Project Notes

- The backend requires `MONGODB_URI` and `JWT_SECRET` to start.
- The API is designed around multiple modules such as bookings, staff, restaurant, housekeeping, and reports.
- The admin client includes advanced UI features like charts, forms, file uploads, and real-time socket updates.

## Deployment

For production deployment:

1. Build frontends:

```bash
cd client
npm run build

cd ../website
npm run build
```

2. Deploy the server and point it to a production MongoDB instance.
3. Configure environment variables for production mode.

## Useful Files

- `server/app.js` - Express app setup and middleware
- `server/server.js` - server bootstrap, MongoDB connection, and graceful shutdown
- `server/config/db.js` - MongoDB configuration
- `client/package.json` - admin dashboard dependencies and scripts
- `website/package.json` - public website dependencies and scripts

## Contact

If you need help with setup or want to extend this project, review the server controllers and route definitions under `server/controllers/` and `server/routes/`.
