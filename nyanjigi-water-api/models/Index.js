/**
 * Models Index - Centralized model exports
 */

const BaseModel = require('./BaseModel');
const Admin = require('./Admin');
const Customer = require('./Customer');
const Bill = require('./Bill');
const Payment = require('./Payment');
const Contribution = require('./Contribution');
const SystemSettings = require('./SystemSettings');
const Fine = require ('./Fine')

module.exports = {
  BaseModel,
  Admin,
  Customer,
  Bill,
  Payment,
  Contribution,
  SystemSettings,
  Fine
};