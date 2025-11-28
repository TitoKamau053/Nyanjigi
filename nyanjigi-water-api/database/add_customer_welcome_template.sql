-- Add customer welcome SMS template

-- Add password notification SMS template for new customers
INSERT INTO notification_templates (name, type, trigger_event, message_template, is_active, created_at)
VALUES (
  'Password Notification SMS',
  'sms',
  'password_notification',
  'Hello {{customer_name}}, welcome to Nyanjigi Water! Your account password is: {{password}}. Please keep it safe. Account: {{account_number}}',
  TRUE,
  NOW()
)
ON DUPLICATE KEY UPDATE
  message_template = VALUES(message_template),
  is_active = VALUES(is_active),
  created_at = VALUES(created_at);
