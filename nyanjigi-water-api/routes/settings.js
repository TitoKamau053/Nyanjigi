const express = require('express');
const { SystemSettingsController } = require('../controllers');
const { verifyAdmin } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const ValidationSchemas = require('../utils/validation');

const router = express.Router();

/**
 * System Settings Routes
 * Base path: /api/v1/settings
 */

// ===== GENERAL SETTINGS MANAGEMENT =====

/**
 * @route   GET /api/v1/settings
 * @desc    Get all system settings
 * @access  Private (Admin only)
 */
router.get('/',
  verifyAdmin,
  asyncHandler(SystemSettingsController.getAllSettings)
);

/**
 * @route   GET /api/v1/settings/validation
 * @desc    Get settings with validation status
 * @access  Private (Admin only)
 */
router.get('/validation',
  verifyAdmin,
  asyncHandler(SystemSettingsController.getSettingsWithValidation)
);

/**
 * @route   POST /api/v1/settings/initialize
 * @desc    Initialize default settings (for fresh installation)
 * @access  Private (Admin only)
 */
router.post('/initialize',
  verifyAdmin,
  asyncHandler(SystemSettingsController.initializeSettings)
);

/**
 * @route   PUT /api/v1/settings/bulk
 * @desc    Bulk update settings
 * @access  Private (Admin only)
 */
router.put('/bulk',
  verifyAdmin,
  ValidationSchemas.updateSettings,
  handleValidationErrors,
  asyncHandler(SystemSettingsController.updateSettings)
);

/**
 * @route   GET /api/v1/settings/export
 * @desc    Export settings configuration
 * @access  Private (Admin only)
 */
router.get('/export',
  verifyAdmin,
  [
    require('express-validator').query('format')
      .optional()
      .isIn(['json'])
      .withMessage('Format must be json'),
    require('express-validator').query('include_sensitive')
      .optional()
      .isBoolean()
      .withMessage('Include sensitive must be boolean')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.exportSettings)
);

/**
 * @route   POST /api/v1/settings/reset
 * @desc    Reset settings to defaults (use with caution)
 * @access  Private (Admin only)
 */
router.post('/reset',
  verifyAdmin,
  [
    require('express-validator').body('category')
      .notEmpty()
      .isIn(['general', 'billing', 'payments', 'contributions', 'notifications'])
      .withMessage('Valid category is required'),
    require('express-validator').body('confirm')
      .isBoolean()
      .custom(value => {
        if (!value) {
          throw new Error('Reset must be confirmed');
        }
        return true;
      })
      .withMessage('Reset must be confirmed by setting confirm: true')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.resetSettings)
);

// ===== CATEGORY-SPECIFIC SETTINGS =====

/**
 * @route   GET /api/v1/settings/:category
 * @desc    Get settings by category
 * @access  Private (Admin only)
 */
router.get('/:category',
  verifyAdmin,
  [
    require('express-validator').param('category')
      .isIn(['general', 'billing', 'payments', 'contributions', 'notifications'])
      .withMessage('Valid category is required')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.getSettingsByCategory)
);

// ===== BILLING SETTINGS =====

/**
 * @route   GET /api/v1/settings/billing/config
 * @desc    Get billing settings
 * @access  Private (Admin only)
 */
router.get('/billing/config',
  verifyAdmin,
  asyncHandler(SystemSettingsController.getBillingSettings)
);

/**
 * @route   PUT /api/v1/settings/billing/config
 * @desc    Update billing settings
 * @access  Private (Admin only)
 */
router.put('/billing/config',
  verifyAdmin,
  [
    require('express-validator').body('flat_rate')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Flat rate must be a positive number'),
    require('express-validator').body('billing_day')
      .optional()
      .isInt({ min: 1, max: 28 })
      .withMessage('Billing day must be between 1 and 28'),
    require('express-validator').body('payment_due_days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Payment due days must be between 1 and 365'),
    require('express-validator').body('late_fine_grace_days')
      .optional()
      .isInt({ min: 0, max: 30 })
      .withMessage('Late fine grace days must be between 0 and 30')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.updateBillingSettings)
);

// ===== PAYMENT SETTINGS =====

/**
 * @route   GET /api/v1/settings/payments/config
 * @desc    Get payment settings
 * @access  Private (Admin only)
 */
router.get('/payments/config',
  verifyAdmin,
  asyncHandler(SystemSettingsController.getPaymentSettings)
);

/**
 * @route   PUT /api/v1/settings/payments/config
 * @desc    Update payment settings
 * @access  Private (Admin only)
 */
router.put('/payments/config',
  verifyAdmin,
  [
    require('express-validator').body('jenga_api_url')
      .optional()
      .isURL()
      .withMessage('Valid Jenga API URL is required'),
    require('express-validator').body('jenga_consumer_key')
      .optional()
      .trim()
      .isLength({ min: 10 })
      .withMessage('Valid Jenga consumer key is required'),
    require('express-validator').body('jenga_consumer_secret')
      .optional()
      .trim()
      .isLength({ min: 10 })
      .withMessage('Valid Jenga consumer secret is required'),
    require('express-validator').body('stk_push_shortcode')
      .optional()
      .trim()
      .isLength({ min: 4 })
      .withMessage('Valid STK Push shortcode is required'),
    require('express-validator').body('stk_callback_url')
      .optional()
      .isURL()
      .withMessage('Valid callback URL is required')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.updatePaymentSettings)
);

/**
 * @route   POST /api/v1/settings/payments/test-equity',
 * @desc    Test Equity External Integration
 * @access  Private (Admin only)
 */
router.post('/payments/test-equity',
  verifyAdmin,
  asyncHandler(SystemSettingsController.testEquityConnection)
);

// ===== CONTRIBUTION SETTINGS =====

/**
 * @route   GET /api/v1/settings/contributions/config
 * @desc    Get contribution settings
 * @access  Private (Admin only)
 */
router.get('/contributions/config',
  verifyAdmin,
  asyncHandler(SystemSettingsController.getContributionSettings)
);

/**
 * @route   PUT /api/v1/settings/contributions/config
 * @desc    Update contribution settings
 * @access  Private (Admin only)
 */
router.put('/contributions/config',
  verifyAdmin,
  [
    require('express-validator').body('monthly_amount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Monthly amount must be a positive number'),
    require('express-validator').body('due_days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Due days must be between 1 and 365')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.updateContributionSettings)
);

// ===== NOTIFICATION SETTINGS =====

/**
 * @route   GET /api/v1/settings/notifications/config
 * @desc    Get notification settings
 * @access  Private (Admin only)
 */
router.get('/notifications/config',
  verifyAdmin,
  asyncHandler(SystemSettingsController.getNotificationSettings)
);

/**
 * @route   PUT /api/v1/settings/notifications/config
 * @desc    Update notification settings
 * @access  Private (Admin only)
 */
router.put('/notifications/config',
  verifyAdmin,
  [
    require('express-validator').body('sms_sender_id')
      .optional()
      .trim()
      .isLength({ min: 3, max: 11 })
      .withMessage('SMS sender ID must be between 3 and 11 characters'),
    require('express-validator').body('sms_enabled')
      .optional()
      .isBoolean()
      .withMessage('SMS enabled must be boolean'),
    require('express-validator').body('email_enabled')
      .optional()
      .isBoolean()
      .withMessage('Email enabled must be boolean')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.updateNotificationSettings)
);

// ===== COMPANY SETTINGS =====

/**
 * @route   GET /api/v1/settings/company/config
 * @desc    Get company settings
 * @access  Private (Admin only)
 */
router.get('/company/config',
  verifyAdmin,
  asyncHandler(SystemSettingsController.getCompanySettings)
);

/**
 * @route   PUT /api/v1/settings/company/config
 * @desc    Update company settings
 * @access  Private (Admin only)
 */
router.put('/company/config',
  verifyAdmin,
  [
    require('express-validator').body('company_name')
      .optional()
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Company name must be between 3 and 100 characters'),
    require('express-validator').body('company_phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid phone number is required'),
    require('express-validator').body('company_email')
      .optional()
      .isEmail()
      .withMessage('Valid email is required'),
    require('express-validator').body('company_address')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Company address must be less than 500 characters'),
    require('express-validator').body('logo_url')
      .optional()
      .isURL()
      .withMessage('Valid logo URL is required')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.updateCompanySettings)
);

// ===== INDIVIDUAL SETTING OPERATIONS =====

/**
 * @route   GET /api/v1/settings/key/:key
 * @desc    Get single setting value
 * @access  Private (Admin only)
 */
router.get('/key/:key',
  verifyAdmin,
  [
    require('express-validator').param('key')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Valid setting key is required')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.getSetting)
);

/**
 * @route   PUT /api/v1/settings/key/:key
 * @desc    Update single setting
 * @access  Private (Admin only)
 */
router.put('/key/:key',
  verifyAdmin,
  [
    require('express-validator').param('key')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Valid setting key is required'),
    require('express-validator').body('value')
      .notEmpty()
      .withMessage('Setting value is required'),
    require('express-validator').body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description must be less than 500 characters'),
    require('express-validator').body('category')
      .optional()
      .isIn(['general', 'billing', 'payments', 'contributions', 'notifications'])
      .withMessage('Valid category is required')
  ],
  handleValidationErrors,
  asyncHandler(SystemSettingsController.updateSetting)
);

// ===== SYSTEM STATUS =====

/**
 * @route   GET /api/v1/settings/system/status
 * @desc    Get system status based on settings
 * @access  Public (for health checks)
 */
router.get('/system/status',
  asyncHandler(SystemSettingsController.getSystemStatus)
);

module.exports = router;