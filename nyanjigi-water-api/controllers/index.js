/**
 * Controllers Index - Centralized controller exports
 */

const AdminController = require('./AdminController');
const CustomerController = require('./CustomerController');
const BillController = require('./BillController');
const PaymentController = require('./PaymentController');
const ContributionController = require('./ContributionController');
const SystemSettingsController = require('./SystemSettingsController');
const EquityController = require('./EquityController');
const MeterReadingController = require('./MeterReadingController');
const ReceiptController = require('./ReceiptController');
const FineController = require('./FineController');

module.exports = {
  AdminController,
  CustomerController,
  BillController,
  PaymentController,
  ContributionController,
  SystemSettingsController,
  EquityController,
  MeterReadingController,
  ReceiptController,
  FineController
};