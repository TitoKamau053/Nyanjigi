# Nyanjigi Waters Management System

A comprehensive water billing and management system with automated billing, Equity Bank External Payment integration, contribution management, and real-time analytics.

## 🌟 Features

### 🏢 Customer Management
- Auto-generated customer account numbers (NyWs-00001 format)
- Customer registration with unique account tracking
- Self-service customer portal for bill viewing and payments
- Customer authentication with secure password management

### 💧 Billing System
- **Automated Monthly Billing** - Flat rate billing with future meter support
- Bill generation for all active customers on the 1st of each month
- Overdue bill tracking with automatic fine application
- Flexible billing configuration through system settings
- Bill preview and bulk operations

### 💰 Payment Processing
- **Full Equity Bank External Payment Integration** for seamless payments
- Real-time payment callbacks and verification
- Multiple payment methods (Equity Branch, Agent, M-Pesa Paybill, USSD, Equitel, Mobile App)
- Automatic payment allocation to bills and contributions
- Payment retry and verification mechanisms

### 📊 Contribution Management
- Monthly uniform contributions for all customers
- Automated contribution generation and tracking
- Contribution payment processing and status updates
- Flexible contribution amount management

### 📱 Notifications
- SMS notifications via Africa's Talking API
- Automated notifications for bill generation, payment confirmations
- Overdue notices and contribution reminders
- Template-based messaging system

### 🤖 Automation
- Automated monthly billing and contribution generation
- Scheduled fine application for overdue payments
- System maintenance and cleanup tasks
- Configurable cron jobs for all automated processes

### 📈 Analytics & Reporting
- Real-time dashboard with key metrics
- Revenue analytics and collection rates
- Payment statistics and success rates
- Customer analytics and outstanding balances
- Exportable reports (CSV/JSON)

### ⚙️ System Configuration
- Dynamic system settings management
- Category-based configuration (billing, payments, notifications)
- Equity Bank API connection testing
- System health monitoring

## 🏗️ Architecture

```
nyanjigi-water-api/
├── 📁 config/           # Database and system configuration
├── 📁 controllers/      # Business logic controllers
├── 📁 middleware/       # Authentication and error handling
├── 📁 models/           # Database models and operations
├── 📁 routes/           # API endpoints and routing
├── 📁 services/         # External service integrations
├── 📁 utils/            # Utility functions and helpers
├── 📁 scripts/          # Database migration and startup scripts
├── 📁 tests/            # Test suites (future)
├── 🔧 server.js         # Main Express server
├── 📋 package.json      # Dependencies and scripts
└── 📖 README.md         # Project documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.0.0
- MySQL >= 8.0
- Jenga API credentials (for payments)
- Africa's Talking account (for SMS)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd nyanjigi-water-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Setup database**
```bash
# Create MySQL database
mysql -u root -p -e "CREATE DATABASE nyanjigi_water_db;"

# Run migrations
npm run migrate

# Seed with initial data
node scripts/migrate.js seed
```

5. **Start the server**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📋 Environment Configuration

### Required Environment Variables

```bash
# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=nyanjigi_water_db

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key

# Equity Bank API (Required for payments)
EQUITY_API_ENDPOINT=https://api.equity.co.ke
EQUITY_API_KEY=your_equity_api_key
EQUITY_API_SECRET=your_equity_api_secret
EQUITY_MERCHANT_ID=your_merchant_id
EQUITY_WEBHOOK_SECRET=your_webhook_secret
EQUITY_PAYBILL_ACCOUNT=123456
EQUITY_TILL_ACCOUNT=654321

# SMS Notifications (Optional)
AT_API_KEY=your_africastalking_api_key
AT_USERNAME=your_africastalking_username

# System Configuration
DEFAULT_FLAT_RATE=300.00
DEFAULT_CONTRIBUTION_AMOUNT=100.00
```

## 🔧 Available Scripts

```bash
npm start              # Start production server
npm run dev            # Start development server with nodemon
npm run migrate        # Run database migrations
npm test              # Run test suite
node scripts/migrate.js seed    # Seed database with initial data
node scripts/start.js           # System startup with health checks
```

## 🌐 API Endpoints

### Authentication
- `POST /api/v1/auth/admin/login` - Admin login
- `POST /api/v1/auth/customer/login` - Customer login
- `GET /api/v1/auth/admin/profile` - Get admin profile
- `GET /api/v1/auth/customer/dashboard` - Customer dashboard

### Customer Management
- `POST /api/v1/customers` - Create customer (Admin)
- `GET /api/v1/customers` - List customers with pagination
- `GET /api/v1/customers/:id` - Get customer details
- `PUT /api/v1/customers/:id` - Update customer

### Billing
- `POST /api/v1/bills/generate` - Generate monthly bills
- `GET /api/v1/bills` - List bills with filters
- `GET /api/v1/bills/overdue` - Get overdue bills
- `PUT /api/v1/bills/:id/status` - Update bill status

### Payments
- `POST /api/v1/payments/stk-push` - Initiate STK Push payment
- `POST /api/v1/payments/jenga-callback` - Jenga webhook callback
- `GET /api/v1/payments` - List payments
- `POST /api/v1/payments/:id/verify` - Verify payment status

### Contributions
- `POST /api/v1/contributions/generate` - Generate contributions
- `GET /api/v1/contributions` - List contributions
- `PUT /api/v1/contributions/amount` - Update contribution amount

### System Settings
- `GET /api/v1/settings` - Get all settings
- `PUT /api/v1/settings/billing/config` - Update billing settings
- `POST /api/v1/settings/payments/test-equity` - Test Equity Bank connection

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in requests:

```bash
Authorization: Bearer <your-jwt-token>
```

### Default Credentials

After seeding the database:
- **Admin**: username: `admin`, password: `admin123`
- **Sample Customer**: account: `NyWs-00001`, password: `customer123`

## 💰 Payment Integration

### Jenga API STK Push Flow

1. **Initiate Payment**
```bash
POST /api/v1/payments/stk-push
{
  "customer_id": 1,
  "amount": 300,
  "phone_number": "254712345678"
}
```

2. **Customer receives STK Push on phone**

3. **Jenga sends callback to webhook**
```bash
POST /api/v1/payments/jenga-callback
# Automatically processes payment and allocates to bills
```

4. **Payment automatically allocated to outstanding bills**

## 🤖 Automated Tasks

The system runs several automated tasks:

- **Monthly Billing** (1st of month, 6:00 AM) - Generate bills for all customers
- **Monthly Contributions** (1st of month, 7:00 AM) - Generate contributions
- **Overdue Notifications** (Daily, 9:00 AM) - Send overdue notices
- **Fine Application** (Daily, 10:00 AM) - Apply late payment fines
- **System Maintenance** (Daily, 2:00 AM) - Cleanup and maintenance

### Manual Task Execution

```bash
# Generate bills manually
curl -X POST http://localhost:5000/api/v1/bills/generate \
  -H "Authorization: Bearer <token>" \
  -d '{"billing_month": "2025-01-01"}'

# Generate contributions manually  
curl -X POST http://localhost:5000/api/v1/contributions/generate \
  -H "Authorization: Bearer <token>" \
  -d '{"contribution_month": "2025-01-01"}'
```

## 📊 System Monitoring

### Health Check Endpoints

- `GET /api/v1/health` - Basic health check
- `GET /api/v1/settings/system/status` - Detailed system status
- `GET /api/v1/admin/system-health` - Comprehensive health report

### Dashboard Access

- Admin Dashboard: `GET /api/v1/admin/dashboard`
- Customer Dashboard: `GET /api/v1/auth/customer/dashboard`

## 🔍 Logging and Monitoring

- Request logging with Morgan
- Error tracking with stack traces
- Payment callback logging
- Scheduled task execution logs
- SMS delivery status tracking

## 📈 Performance Features

- Database connection pooling
- Query optimization with proper indexing
- Pagination for large datasets
- Rate limiting for API protection
- Response compression
- Efficient bulk operations

## 🛡️ Security Features

- JWT authentication with bcrypt password hashing
- Input validation with express-validator
- SQL injection prevention with parameterized queries
- CORS protection and security headers (Helmet)
- Rate limiting to prevent abuse
- Secure environment variable handling

## 🧪 Testing

### Manual Testing

```bash
# Health check
curl http://localhost:5000/api/v1/health

# Admin login
curl -X POST http://localhost:5000/api/v1/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Create customer
curl -X POST http://localhost:5000/api/v1/customers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Doe",
    "phone": "254712345679",
    "email": "jane@example.com",
    "location": "Nairobi",
    "connection_date": "2025-01-01"
  }'
```

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**
```bash
NODE_ENV=production
ENABLE_SCHEDULER=true
# Set production database and API credentials
```

2. **Database Migration**
```bash
npm run migrate
node scripts/migrate.js seed
```

3. **Start Application**
```bash
npm start
# or use PM2 for process management
pm2 start server.js --name nyanjigi-api
```

4. **Setup Reverse Proxy** (Nginx/Apache)
5. **Configure SSL/HTTPS**
6. **Setup Monitoring and Backups**

### Docker Deployment (Optional)

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 📞 Support and Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL service is running
   - Verify database credentials in .env
   - Ensure database exists

2. **Jenga API Errors**
   - Verify API credentials in system settings
   - Check callback URL is accessible
   - Test connection: `POST /api/v1/settings/payments/test-jenga`

3. **SMS Not Working**
   - Check Africa's Talking credentials
   - Verify account balance
   - Test connection in admin panel

### Support Channels

- **Technical Issues**: Create GitHub issue
- **System Status**: `/api/v1/health`
- **Documentation**: `/api/v1/docs`

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Jenga API](https://developer.jengahq.io/) for payment processing
- [Africa's Talking](https://africastalking.com/) for SMS services
- [Express.js](https://expressjs.com/) for the web framework
- [MySQL](https://www.mysql.com/) for the database

---

**Nyanjigi Waters Management System** - Streamlining water billing and management with modern technology.

For more information, visit our [API documentation](/api/v1/docs) or contact support.