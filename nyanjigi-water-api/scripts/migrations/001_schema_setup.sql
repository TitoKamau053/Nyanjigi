-- SMS Notification Templates
-- This file creates the notification templates table and inserts default SMS templates

DROP TABLE IF EXISTS notifications_sent;
DROP TABLE IF EXISTS notification_templates;

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