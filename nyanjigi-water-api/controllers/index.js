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

module.exports = {
  AdminController,
  CustomerController,
  BillController,
  PaymentController,
  ContributionController,
  SystemSettingsController,
  EquityController
};