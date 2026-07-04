# PMS-HSG

**PMS-HSG** is a hotel management monorepo for the Hotel Sandhya Grand property. It includes a backend API, an admin dashboard client, and a public website front-end.

## Repository Structure

- `server/` - Node.js / Express API server
- `client/` - Admin dashboard React application
- `website/` - Public-facing React website

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
- Winston logging

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
