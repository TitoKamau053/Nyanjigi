-- Nyanjigi Waters Management System Database Schema
-- Complete schema for water billing and management system

-- ============================================
-- CORE USER MANAGEMENT
-- ============================================

-- Single admin user table (full system rights)
CREATE TABLE admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- Customer users table with custom ID format
CREATE TABLE customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_number VARCHAR(20) UNIQUE NOT NULL, -- Zone-based formats: NyWs-001, G3-001, Githunguri-0001, etc.
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    email VARCHAR(100) NULL,
    location TEXT NOT NULL,
    zone ENUM('Nyakahura', 'G3', 'Githunguri') NOT NULL DEFAULT 'Nyakahura',
    meter_number VARCHAR(50) NULL, -- Future-ready for meters
    connection_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    password_hash VARCHAR(255) NULL, -- For customer portal access
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_account_number (account_number),
    INDEX idx_phone (phone),
    INDEX idx_zone (zone),
    INDEX idx_meter_number (meter_number),
    INDEX idx_active (is_active),
    INDEX idx_connection_date (connection_date)
);

-- Account number sequence for zone-based formats
CREATE TABLE account_sequence (
    id INT PRIMARY KEY AUTO_INCREMENT,
    zone ENUM('Nyakahura', 'G3', 'Githunguri') NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_zone (zone)
);

-- Insert initial sequences for each zone
INSERT INTO account_sequence (zone, last_number) VALUES
('Nyakahura', 0),
('G3', 0),
('Githunguri', 0);

-- ============================================
-- BILLING SYSTEM
-- ============================================

-- Bill generation table
CREATE TABLE bills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    bill_number VARCHAR(30) UNIQUE NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    previous_balance DECIMAL(10,2) DEFAULT 0.00,
    current_charges DECIMAL(10,2) NOT NULL, -- Flat rate or calculated usage
    fines_applied DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('pending', 'paid', 'overdue', 'partially_paid') DEFAULT 'pending',
    meter_reading_previous DECIMAL(10,2) NULL, -- For future meter integration
    meter_reading_current DECIMAL(10,2) NULL,
    units_consumed DECIMAL(10,2) NULL,
    rate_per_unit DECIMAL(10,4) NULL,
    bill_type ENUM('flat_rate', 'metered') DEFAULT 'flat_rate',
    notes TEXT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_bill_number (bill_number),
    INDEX idx_billing_period (billing_period_start, billing_period_end),
    INDEX idx_due_date (due_date),
    INDEX idx_status (status),
    INDEX idx_generated_at (generated_at)
);

-- Billing rates configuration
CREATE TABLE billing_rates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rate_type ENUM('flat_rate', 'tiered', 'uniform') DEFAULT 'flat_rate',
    rate_name VARCHAR(50) NOT NULL,
    rate_value DECIMAL(10,4) NOT NULL,
    tier_min DECIMAL(10,2) NULL, -- For tiered billing (future)
    tier_max DECIMAL(10,2) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rate_type (rate_type),
    INDEX idx_effective_dates (effective_from, effective_to),
    INDEX idx_active (is_active)
);

-- ============================================
-- PAYMENT SYSTEM (Jenga API STK Push focused)
-- ============================================

-- Payment transactions table
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    transaction_id VARCHAR(50) UNIQUE NOT NULL, -- Unique transaction reference
    payment_method ENUM('equity_branch', 'equity_agent', 'equity_equitel', 'equity_mpesa', 'equity_ussd', 'equity_app') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'reversed') DEFAULT 'pending',
    equity_reference VARCHAR(100) NULL, -- Equity API reference number
    equity_member_number VARCHAR(50) NULL, -- Customer member number from Equity
    phone_number VARCHAR(15) NULL, -- Customer phone for reference
    callback_response JSON NULL, -- Store full callback data
    equity_callback_response JSON NULL, -- Equity-specific callback data
    notes TEXT NULL,
    processed_by INT NULL, -- Admin who processed (for manual entries)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by) REFERENCES admins(id) ON DELETE SET NULL,
    INDEX idx_customer_id (customer_id),
    INDEX idx_transaction_id (transaction_id),
    INDEX idx_payment_method (payment_method),
    INDEX idx_payment_date (payment_date),
    INDEX idx_status (status),
    INDEX idx_equity_reference (equity_reference),
    INDEX idx_equity_member_number (equity_member_number)
);

-- Payment allocation table (tracks which bills were paid)
CREATE TABLE payment_allocations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    payment_id INT NOT NULL,
    bill_id INT NULL, -- NULL for advance payments or contributions
    allocation_type ENUM('bill_payment', 'contribution', 'fine', 'advance') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    INDEX idx_payment_id (payment_id),
    INDEX idx_bill_id (bill_id),
    INDEX idx_allocation_type (allocation_type)
);

-- ============================================
-- FINES AND PENALTIES
-- ============================================

-- Fines configuration
CREATE TABLE fine_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fine_name VARCHAR(100) NOT NULL,
    fine_type ENUM('late_payment', 'reconnection', 'meter_tampering', 'other') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    is_percentage BOOLEAN DEFAULT FALSE, -- TRUE if percentage of bill amount
    grace_period_days INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_fine_type (fine_type),
    INDEX idx_active (is_active)
);

-- Applied fines table
CREATE TABLE applied_fines (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    bill_id INT NULL, -- NULL for general fines
    fine_type_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reason TEXT NOT NULL,
    applied_date DATE NOT NULL,
    status ENUM('pending', 'paid', 'waived') DEFAULT 'pending',
    waived_by INT NULL,
    waived_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (fine_type_id) REFERENCES fine_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (waived_by) REFERENCES admins(id) ON DELETE SET NULL,
    INDEX idx_customer_id (customer_id),
    INDEX idx_bill_id (bill_id),
    INDEX idx_applied_date (applied_date),
    INDEX idx_status (status)
);

-- ============================================
-- CONTRIBUTIONS SYSTEM (Monthly uniform contributions)
-- ============================================

-- Customer monthly contributions
CREATE TABLE contributions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    contribution_month DATE NOT NULL, -- First day of the month (YYYY-MM-01)
    amount_required DECIMAL(10,2) NOT NULL, -- Set from system settings
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    status ENUM('pending', 'partial', 'completed', 'overdue') DEFAULT 'pending',
    due_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_contribution_month (contribution_month),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    
    UNIQUE KEY unique_customer_month (customer_id, contribution_month)
);

-- ============================================
-- NOTIFICATIONS SYSTEM
-- ============================================

-- Notification templates
CREATE TABLE notification_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    type ENUM('sms', 'email') NOT NULL,
    trigger_event VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NULL, -- For emails
    message_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_trigger_event (trigger_event),
    INDEX idx_type (type),
    INDEX idx_active (is_active)
);

-- Sent notifications log
CREATE TABLE notifications_sent (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    template_id INT NOT NULL,
    recipient VARCHAR(100) NOT NULL, -- Phone or email
    message TEXT NOT NULL,
    status ENUM('pending', 'sent', 'failed', 'delivered') DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES notification_templates(id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at)
);

-- ============================================
-- SYSTEM CONFIGURATION
-- ============================================

-- System settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT NULL,
    category VARCHAR(50) DEFAULT 'general',
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (updated_by) REFERENCES admins(id) ON DELETE SET NULL,
    INDEX idx_setting_key (setting_key),
    INDEX idx_category (category)
);

-- Audit log for important changes
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    user_id INT NULL,
    user_type ENUM('admin', 'customer', 'system') NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES admins(id) ON DELETE SET NULL,
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_action (action),
    INDEX idx_user (user_id, user_type),
    INDEX idx_created_at (created_at)
);

-- ============================================
-- STORED PROCEDURES FOR ACCOUNT GENERATION
-- ============================================

DELIMITER //

-- Generate next account number based on zone
CREATE FUNCTION generate_account_number(zone_param ENUM('Nyakahura', 'G3', 'Githunguri')) RETURNS VARCHAR(20)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE next_num INT;
    DECLARE formatted_number VARCHAR(20);

    -- Get and increment the sequence for the specific zone
    UPDATE account_sequence SET last_number = last_number + 1 WHERE zone = zone_param;
    SELECT last_number INTO next_num FROM account_sequence WHERE zone = zone_param LIMIT 1;

    -- Format based on zone - all use NyWs- prefix with different padding
    CASE zone_param
        WHEN 'Nyakahura' THEN SET formatted_number = CONCAT('NyWs-', LPAD(next_num, 2, '0'));
        WHEN 'G3' THEN SET formatted_number = CONCAT('NyWs-', LPAD(next_num, 3, '0'));
        WHEN 'Githunguri' THEN SET formatted_number = CONCAT('NyWs-', LPAD(next_num, 4, '0'));
        ELSE SET formatted_number = CONCAT('NyWs-', LPAD(next_num, 2, '0'));
    END CASE;

    RETURN formatted_number;
END //

DELIMITER ;

-- ============================================
-- INITIAL CONFIGURATION DATA
-- ============================================

-- Insert default billing rate (Ksh 300 flat rate)
INSERT INTO billing_rates (rate_name, rate_type, rate_value, effective_from) 
VALUES ('Flat Rate Monthly', 'flat_rate', 300.0000, CURDATE());

-- Insert default fine types
INSERT INTO fine_types (fine_name, fine_type, amount, grace_period_days) VALUES
('Late Payment Fine', 'late_payment', 50.00, 5),
('Reconnection Fee', 'reconnection', 200.00, 0);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, description, category) VALUES
('company_name', 'Nyanjigi Waters Management System', 'Company name for billing', 'general'),
('default_billing_day', '1', 'Day of month to generate bills', 'billing'),
('payment_due_days', '5', 'Days after bill generation for due date', 'billing'),
('late_fine_grace_days', '5', 'Grace period before applying late fines', 'billing'),
('monthly_contribution_amount', '100.00', 'Monthly contribution amount for all customers', 'contributions'),
('contribution_due_days', '30', 'Days after month start for contribution due date', 'contributions'),
('sms_sender_id', 'NYANJIGI', 'SMS sender ID', 'notifications'),
('company_phone', '+254700000000', 'Company contact phone', 'general'),
('company_email', 'info@nyanjigi.co.ke', 'Company contact email', 'general'),
('jenga_api_url', 'https://uat.jengahq.io', 'Jenga API base URL', 'payments'),
('jenga_consumer_key', '', 'Jenga API consumer key', 'payments'),
('jenga_consumer_secret', '', 'Jenga API consumer secret', 'payments'),
('stk_push_shortcode', '', 'STK Push shortcode', 'payments'),
('stk_callback_url', '', 'STK Push callback URL', 'payments');

-- Insert notification templates
INSERT INTO notification_templates (name, type, trigger_event, message_template) VALUES
('Bill Generated SMS', 'sms', 'bill_generated', 'Dear {{customer_name}}, your water bill of Ksh {{amount}} for {{period}} is ready. Due date: {{due_date}}. Pay via STK Push or Paybill. Thank you.'),
('Payment Received SMS', 'sms', 'payment_received', 'Dear {{customer_name}}, we have received your payment of Ksh {{amount}} on {{date}}. M-Pesa Ref: {{reference}}. Thank you.'),
('Overdue Notice SMS', 'sms', 'overdue_notice', 'Dear {{customer_name}}, your bill of Ksh {{amount}} is overdue. A fine of Ksh {{fine}} has been applied. Please pay to avoid disconnection.'),
('Fine Applied SMS', 'sms', 'fine_applied', 'Dear {{customer_name}}, a fine of Ksh {{amount}} has been applied to your account for {{reason}}. Total balance: Ksh {{balance}}.'),
('Contribution Due SMS', 'sms', 'bill_generated', 'Dear {{customer_name}}, your monthly contribution of Ksh {{amount}} for {{month}} is due on {{due_date}}. Thank you.'),
('Password Notification SMS', 'sms', 'password_notification', 'Hello {{customer_name}}, welcome to Nyanjigi Water! Your account password is: {{password}}. Please keep it safe. Account: {{account_number}}', TRUE, NOW())
ON DUPLICATE KEY UPDATE
  message_template = VALUES(message_template),
  is_active = VALUES(is_active),
  created_at = VALUES(created_at);

-- Create indexes for better performance on common queries
CREATE INDEX idx_customer_bills_period ON bills(customer_id, billing_period_start, billing_period_end);
CREATE INDEX idx_payments_customer_date ON payments(customer_id, payment_date);
CREATE INDEX idx_bills_due_status ON bills(due_date, status);
CREATE INDEX idx_customers_active_created ON customers(is_active, created_at);