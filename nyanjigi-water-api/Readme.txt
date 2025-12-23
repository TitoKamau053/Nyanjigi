Nyanjigi Waters Management System
A comprehensive water billing and management system featuring automated monthly billing, Equity Bank Biller Integration, contribution tracking, and real-time analytics.

Features
Customer Management
Unique Account Tracking: Auto-generated customer account numbers (e.g., NyWs-00001).

Self-Service Portal: Secure dashboard for customers to view bills, payment history, and profile details.

Admin Control: Complete management of customer statuses, locations, and connection history.

Automated Billing & Fines
Monthly Billing Cycle: Automated flat-rate bill generation on the 1st of every month.

Overdue Tracking: Automatic status updates for unpaid bills with scheduled late-fee application.

Grace Periods: Configurable grace periods before fines are applied via system settings.

Equity Bank Biller Integration
Two-Way Integration: Supports both Customer Validation and Payment Notification (Callback).

Dynamic Payment Channels: Accepts payments from Equity Branches, Agents, M-Pesa Paybill (247247), Equitel, and the Equity Mobile App.

Flexible Data Handling: Designed to accept various naming conventions (e.g., "OMNI" channels) without system crashes.

Asynchronous Processing: Immediate acknowledgement of bank callbacks with background ledger allocation to ensure high performance.

Multi-Tier Security
Internal Auth: JWT-based authentication for Admins and Customers.

External Integration Auth: Dedicated JWT Authentication for Equity Bank systems .

IP Whitelisting: Strict IP filtering for all sensitive banking endpoints.

Production Data Masking: Automatic masking of sensitive financial logs in production environments.

Notifications
SMS Integration: Powered by Africa's Talking API for real-time alerts.

Automated Triggers: Notifications for bill generation, payment receipts, and overdue reminders.

Architecture
nyanjigi-water-api/
├──  config/          # Database connection and pooling
├──  controllers/     # Business logic (Equity, Bills, Customers)
├──  middleware/      # Auth (Admin/Customer/Equity), IP Whitelisting
├──  models/          # Database schemas and abstraction layers
├──  routes/          # API endpoint definitions
├──  services/        # External APIs (Africa's Talking, Notifications)
├──  utils/           # Shared helpers and response formatters
└──  server.js        # Entry point
Quick Start
Prerequisites
Node.js: >= 16.0.0

MySQL: >= 8.0

Africa's Talking: API Key and Username for SMS.

Installation
Clone and Install

Bash

git clone <repository-url>
cd nyanjigi-water-api
npm install
PowerShell Scripting (Windows only) If running on Windows, ensure your execution policy allows npm scripts:

PowerShell

Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Database Setup

Bash

# Run the migration script to create tables
npm run migrate
Environment Configuration
Create a .env file in the root directory:

Bash

# Server & DB
PORT=5000
DB_HOST=localhost
DB_NAME=database_name
DB_USER=database_user
DB_PASSWORD=database_password

# Internal Security
JWT_SECRET=internal_secret

# Equity Bank Integration (Required)
EQUITY_API_USERNAME=equity_user
EQUITY_API_PASSWORD=complequity_password
EQUITY_JWT_SECRET=unique_secret_for_the_bank

# SMS Configuration
AT_API_KEY=your_at_key
AT_USERNAME=your_at_username
API Endpoints (v1)
Equity Bank Integration
These endpoints require IP Whitelisting and JWT Bearer Tokens.

Endpoint	Method	Description
/equity/auth/token	POST	
Exchange credentials for an Access Token .

/equity/validate-customer	POST	
Validates account existence and returns balance .

/equity/callback	POST	
Receives payment notifications from the bank .


Export to Sheets

User Authentication
Endpoint	Method	Description
/auth/admin/login	POST	Admin system access.
/auth/customer/login	POST	Customer portal access.

Export to Sheets

Management
POST /bills/generate: Triggers monthly billing.

GET /customers: Lists all registered users.

GET /payments/all: Admin view of all incoming revenue.

Automated Tasks
The system utilizes automated cron jobs for the following:

06:00 AM (Monthly): Bill generation for all active connections.

09:00 AM (Daily): SMS reminders for overdue balances.

10:00 AM (Daily): Automatic application of late-payment fines.

Security Implementation
The Equity Bank Integration is protected by a two-layer security model:

Layer 1 (IP Whitelist): Only requests from Equity's registered CIDR blocks (e.g., 196.216.242.XXX) are accepted.

Layer 2 (JWT): Every request must include an Authorization: Bearer <token> header. Tokens are short-lived (1 hour) to ensure maximum security .


License
Licensed under the ISC License. See LICENSE for details.

Nyanjigi Waters - Modernizing water utility management.

For technical support or SIT coordination, please contact the system administrator (titusmainakamau053@gmail.com).