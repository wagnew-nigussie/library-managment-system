# Library Management System (Libra)

A modern, web-based Library Management System designed to help institutions manage library operations, users, book collections, memberships, and book circulation from one application.

**GitHub Repository:** https://github.com/wagnew-nigussie/library-managment-system

## Overview

Libra provides a role-based environment for managing library resources and lending activities. It uses a React frontend, an Express.js backend, PostgreSQL, and Prisma ORM.

The system supports institution-specific management and separates administrative permissions from day-to-day library operations.

## Features

### User and Access Management
- JWT-based authentication.
- Role-based access for Super Admin, Institution Admin, and Librarian.
- Institution-specific user management.
- Protected API endpoints.
- Separate permissions for administrative and circulation tasks.

### Institution Management
- View and manage institutions.
- Institution-specific circulation settings.
- Configurable loan duration, maximum active loans, and daily overdue fine.

### Book Catalog and Copies
- Create and manage book catalog records.
- Register physical copies of catalog books.
- Record unique barcodes and shelf locations.
- Track copy availability and loan status.

### Members
- Register library members.
- Store membership numbers and member contact details.
- View institution-specific member records.

### Loans and Returns
- Register book loans to library members.
- Calculate due dates using the institution's configured loan period.
- Record book returns.
- Mark overdue active loans automatically when the backend checks their status.
- Calculate overdue fines when a late book is returned.
- Display loan status and fine amounts.

### Security
- Password hashing with bcrypt.
- JWT authentication.
- Role and institution permission checks.
- Environment variables for database credentials and application secrets.

## Technology Stack

**Frontend**
- React
- Vite
- JavaScript
- CSS

**Backend**
- Node.js
- Express.js
- JavaScript ES Modules
- JWT authentication
- bcryptjs

**Database**
- PostgreSQL
- Prisma ORM

## Project Structure

```text
library-management-system/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── modules/
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Root.jsx
│   │   ├── components/
│   │   ├── features/
│   │   ├── services/
│   │   └── styles/
│   └── package.json
└── README.md
```

## Requirements

Install the following before running the project:

- Node.js and npm.
- PostgreSQL.
- Git.

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/wagnew-nigussie/library-managment-system.git
cd library-management-system
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Open `backend/.env` and configure the required variables:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/library_management?schema=public"
JWT_SECRET="REPLACE_WITH_A_LONG_RANDOM_SECRET"
```

Replace the example database username and password with your own PostgreSQL credentials. Generate a strong JWT secret and keep it private.

Ensure that the PostgreSQL database exists and that the configured database user has the necessary permissions.

### 3. Set up the database

From the `backend` directory, run:

```bash
npm run db:migrate
npm run db:generate
```

These commands apply the Prisma database migrations and generate the Prisma Client.

**Initial administrator:** Before using a fresh installation, ensure that an active Super Admin account has been provisioned through an authorized setup process. Do not rely on default credentials.

### 4. Start the backend

From the `backend` directory:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

### 5. Start the frontend

Open a **second terminal** in VS Code and run:

```bash
cd ~/library-management-system/frontend
npm install
npm run dev
```

Open the local URL printed by Vite, typically:

```text
http://localhost:5173
```

Keep both development servers running while using the application.

## Useful Development Commands

### Backend

```bash
cd backend

npm run dev
npm start
npm run db:generate
npm run db:migrate
npm run db:studio
```

### Frontend

```bash
cd frontend

npm run dev
npm run build
```

## Security Notes

- Never commit `.env` files, passwords, database credentials, or JWT secrets.
- Keep `.env.example` limited to placeholder values.
- Use strong, unique secrets for each environment.
- Restrict database access and back up PostgreSQL regularly.
- Use HTTPS and suitable production configuration before public deployment.
- The frontend's hidden menus are not a substitute for backend authorization checks.
- Configure appropriate password recovery and account administration procedures for production.

## Project Status

The project includes core library workflows for authentication, institution management, book cataloging, physical book copies, members, loans, returns, circulation settings, overdue status, and fine calculation.

Further testing and production hardening are recommended before deploying the system for real institutional use.

## Author

**Wagnew Nigussie**

GitHub: https://github.com/wagnew-nigussie
