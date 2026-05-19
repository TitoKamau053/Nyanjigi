const express = require('express');
const { body, query } = require('express-validator');
const { NotificationController } = require('../controllers');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Middleware - All routes require admin authentication
 */
router.use(verifyAdmin);

/**
 * POST /notifications/send
 * Send manual notifications to customers
 */
router.post(
  '/send',
  [
    body('notification_type')
      .isIn(['bill', 'contribution'])
      .withMessage('Invalid notification_type'),
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 500 })
      .withMessage('Message must be less than 500 characters'),
    body('send_to_all')
      .optional()
      .isBoolean(),
    body('customer_ids')
      .if(body => body.send_to_all !== true)
      .isArray({ min: 1 })
      .withMessage('customer_ids must be a non-empty array when not sending to all')
  ],
  NotificationController.sendNotifications
);

/**
 * GET /notifications/history
 * Get notification sending history
 */
router.get(
  '/history',
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('notification_type')
      .optional()
      .isIn(['bill', 'contribution'])
      .withMessage('Invalid notification_type'),
    query('start_date')
      .optional()
      .isISO8601()
      .withMessage('Invalid start_date format'),
    query('end_date')
      .optional()
      .isISO8601()
      .withMessage('Invalid end_date format')
  ],
  NotificationController.getNotificationHistory
);

/**
 * GET /notifications/customers
 * Get customers for notification selection
 */
router.get(
  '/customers',
  [
    query('search')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Search must be less than 100 characters'),
    query('zone')
      .optional()
      .trim()
  ],
  NotificationController.getCustomersForNotification
);

module.exports = router;
