-- Add customer welcome/password SMS template

INSERT INTO notification_templates (description, type, trigger_event, message_template, is_active, created_at)
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
  description = VALUES(description),
  is_active = VALUES(is_active),
  created_at = VALUES(created_at);