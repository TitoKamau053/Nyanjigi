-- SMS Notification Templates
-- This file creates the notification templates table and inserts default SMS templates

-- Create notification templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trigger_event VARCHAR(50) NOT NULL UNIQUE COMMENT 'Event that triggers the notification',
    type ENUM('sms', 'email') NOT NULL COMMENT 'Type of notification',
    message_template TEXT NOT NULL COMMENT 'Template with variables like {{customer_name}}',
    description VARCHAR(255) COMMENT 'Description of the template',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether this template is active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_trigger_event (trigger_event),
    INDEX idx_type (type),
    INDEX idx_active (is_active)
);

-- Create notifications sent log table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications_sent (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT COMMENT 'Customer who received the notification',
    template_id VARCHAR(50) COMMENT 'Template used (can be null for custom messages)',
    recipient VARCHAR(20) NOT NULL COMMENT 'Phone number or email',
    message TEXT NOT NULL COMMENT 'Actual message sent',
    status ENUM('sent', 'failed', 'pending') DEFAULT 'pending' COMMENT 'Delivery status',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT COMMENT 'Error message if failed',
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at)
);

-- Insert default SMS templates
INSERT INTO notification_templates (trigger_event, type, message_template, description, is_active) VALUES
-- Bill Generation Template
('bill_generated', 'sms',
'Dear {{customer_name}}, your water bill for {{period}} is KES {{amount}}. Due date: {{due_date}}. Pay via M-Pesa to {{shortcode}} or visit our office. Account: {{account_number}}',
'Template for bill generation notifications', TRUE),

-- Payment Confirmation Template
('payment_received', 'sms',
'Payment confirmed! KES {{amount}} received on {{date}} for account {{account_number}}. Reference: {{reference}}. Thank you {{customer_name}}!',
'Template for payment confirmation notifications', TRUE),

-- Overdue Notice Template
('overdue_notice', 'sms',
'URGENT: {{customer_name}}, your bill of KES {{amount}} is {{days_overdue}} days overdue. Please pay immediately to avoid disconnection. Account: {{account_number}}',
'Template for overdue payment notifications', TRUE),

-- Contribution Reminder Template
('contribution_reminder', 'sms',
'{{customer_name}}, your monthly contribution of KES {{amount}} is due on {{due_date}}. Please pay to keep your account active. Account: {{account_number}}',
'Template for contribution payment reminders', TRUE),

-- Fine Applied Template
('fine_applied', 'sms',
'{{customer_name}}, a fine of KES {{amount}} has been applied to your account for {{reason}}. Due date: {{due_date}}. Account: {{account_number}}',
'Template for fine application notifications', TRUE),

-- Welcome Message Template
('customer_welcome', 'sms',
'Welcome {{customer_name}}! Your Nyanjigi Water account {{account_number}} is ready. Login with temporary password: {{password}}. Please change your password after first login.',
'Template for customer welcome messages', TRUE),

-- Disconnection Warning Template
('disconnection_warning', 'sms',
'FINAL NOTICE: {{customer_name}}, your account will be disconnected in 48 hours due to unpaid bills totaling KES {{amount}}. Pay immediately to avoid disconnection. Account: {{account_number}}',
'Template for disconnection warnings', TRUE),

-- Service Restored Template
('service_restored', 'sms',
'Good news {{customer_name}}! Your water service has been restored. Thank you for your payment. Account: {{account_number}}',
'Template for service restoration notifications', TRUE),

-- Payment Reminder Template
('payment_reminder', 'sms',
'{{customer_name}}, friendly reminder: your bill of KES {{amount}} is due soon. Please pay before {{due_date}} to avoid late fees. Account: {{account_number}}',
'Template for general payment reminders', TRUE),

-- Account Status Template
('account_status', 'sms',
'{{customer_name}}, your account status: Outstanding: KES {{outstanding_amount}}, Last payment: {{last_payment_date}}. Contact us for assistance. Account: {{account_number}}',
'Template for account status notifications', TRUE)

ON DUPLICATE KEY UPDATE
    message_template = VALUES(message_template),
    description = VALUES(description),
    is_active<create_file>
<path>database/sms_notification_templates.sql</path>
<content>
-- SMS Notification Templates
-- This file creates the notification templates table and inserts default SMS templates

-- Create notification templates table if it doesn't exist
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trigger_event VARCHAR(50) NOT NULL UNIQUE COMMENT 'Event that triggers the notification (bill_generated, payment_received, etc.)',
    type ENUM('sms', 'email') NOT NULL COMMENT 'Type of notification',
    message_template TEXT NOT NULL COMMENT 'Template with placeholders like {{customer_name}}, {{amount}}, etc.',
    description VARCHAR(255) COMMENT 'Description of the template',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Whether this template is active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_trigger_event (trigger_event),
    INDEX idx_type (type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default SMS templates
INSERT INTO notification_templates (trigger_event, type, message_template, description, is_active) VALUES
-- Bill Generation Template
('bill_generated', 'sms',
'Dear {{customer_name}}, your water bill for {{period}} is ready. Amount: KES {{amount}}. Due: {{due_date}}. Pay via M-Pesa to {{shortcode}}. Account: {{account_number}}',
'Template for bill generation notifications', TRUE),

-- Payment Confirmation Template
('payment_received', 'sms',
'Payment confirmed! KES {{amount}} received on {{date}} for {{account_number}}. Ref: {{reference}}. Thank you for your payment.',
'Template for payment confirmation notifications', TRUE),

-- Overdue Notice Template
('overdue_notice', 'sms',
'{{customer_name}}, your bill of KES {{amount}} is {{days_overdue}} days overdue. Please pay immediately to avoid disconnection. Account: {{account_number}}',
'Template for overdue payment notifications', TRUE),

-- Contribution Reminder Template
('contribution_reminder', 'sms',
'{{customer_name}}, your monthly contribution of KES {{amount}} is due on {{due_date}}. Please pay via M-Pesa. Account: {{account_number}}',
'Template for contribution payment reminders', TRUE),

-- Fine Applied Template
('fine_applied', 'sms',
'{{customer_name}}, a fine of KES {{amount}} has been applied for {{reason}}. Due: {{due_date}}. Total outstanding: KES {{total_amount}}. Account: {{account_number}}',
'Template for fine application notifications', TRUE),

-- Welcome Message Template
('customer_welcome', 'sms',
'Welcome {{customer_name}}! Your Nyanjigi Water account {{account_number}} is ready. Login with temporary password: {{password}}. Please change your password after first login.',
'Template for new customer welcome messages', TRUE),

-- Payment Reminder Template
('payment_reminder', 'sms',
'{{customer_name}}, you have an outstanding balance of KES {{amount}}. Please make payment to avoid service interruption. Account: {{account_number}}',
'Template for general payment reminders', TRUE),

-- Disconnection Notice Template
('disconnection_notice', 'sms',
'FINAL NOTICE: {{customer_name}}, your water service will be disconnected in 48 hours due to unpaid balance of KES {{amount}}. Pay immediately. Account: {{account_number}}',
'Template for disconnection warnings', TRUE),

-- Service Restored Template
('service_restored', 'sms',
'{{customer_name}}, your water service has been restored after payment of KES {{amount}}. Thank you for your payment. Account: {{account_number}}',
'Template for service restoration notifications', TRUE),

-- Account Statement Template
('account_statement', 'sms',
'{{customer_name}}, your account statement is ready. Total due: KES {{total_due}}. Bills: {{bill_count}}, Fines: {{fine_count}}. Account: {{account_number}}',
'Template for account statement notifications', TRUE)

ON DUPLICATE KEY UPDATE
    message_template = VALUES(message_template),
    description = VALUES(description),
    is_active = VALUES(is_active),
    updated_at = CURRENT_TIMESTAMP;

-- Create notifications sent log table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications_sent (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT COMMENT 'Customer who received the notification',
    template_id VARCHAR(50) COMMENT 'Template used (can be null for custom messages)',
    recipient VARCHAR(20) NOT NULL COMMENT 'Phone number or email address',
    message TEXT NOT NULL COMMENT 'Actual message sent',
    status ENUM('sent', 'failed', 'pending') DEFAULT 'pending' COMMENT 'Delivery status',
    provider_message_id VARCHAR(100) COMMENT 'Message ID from SMS provider',
    error_message TEXT COMMENT 'Error message if delivery failed',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_id (customer_id),
    INDEX idx_template_id (template_id),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraint if customers table exists
-- ALTER TABLE notifications_sent ADD CONSTRAINT fk_notifications_customer
-- FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- Insert some sample notification logs (for testing)
INSERT INTO notifications_sent (customer_id, template_id, recipient, message, status, sent_at) VALUES
(1, 'customer_welcome', '+254700000000', 'Welcome John Doe! Your Nyanjigi Water account NyWs-00001 is ready. Login with temporary password: temp123. Please change your password after first login.', 'sent', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(2, 'bill_generated', '+254711111111', 'Dear Jane Smith, your water bill for January 2024 is ready. Amount: KES 300.00. Due: 2024-02-01. Pay via M-Pesa to 123456. Account: NyWs-00002', 'sent', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(3, 'payment_received', '+254722222222', 'Payment confirmed! KES 300.00 received on 2024-01-15 for NyWs-00003. Ref: ABC123. Thank you for your payment.', 'sent', DATE_SUB(NOW(), INTERVAL 30 MINUTE))
ON DUPLICATE KEY UPDATE message = VALUES(message);
