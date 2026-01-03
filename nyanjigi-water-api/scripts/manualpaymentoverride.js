// scripts/reconcile_advances.js
const { executeQuery, pool } = require('../config/database');
const Payment = require('../models/Payment');

async function reconcileAll() {
  console.log('STARTING SYSTEM-WIDE RECONCILIATION');
  console.log('Checking for customers with unused Advances and Unpaid Bills...');

  try {
    // 1. Find all customers who have BOTH:
    //    a) An unused 'advance' balance > 0
    //    b) Pending bills OR pending contributions OR pending fines
    const candidatesQuery = `
      SELECT DISTINCT p.customer_id, c.full_name, c.account_number
      FROM payment_allocations pa
      JOIN payments p ON pa.payment_id = p.id
      JOIN customers c ON p.customer_id = c.id
      WHERE pa.allocation_type = 'advance' 
      AND pa.amount > 0
      AND c.is_active = TRUE
    `;
    
    const candidates = await executeQuery(candidatesQuery);

    if (candidates.length === 0) {
      console.log('No customers found with unused advances.');
      return;
    }

    console.log(`   found ${candidates.length} candidates for reconciliation.\n`);

    let totalProcessed = 0;
    let totalAllocated = 0;

    // 2. Process each candidate
    for (const customer of candidates) {
      console.log(`Processing: ${customer.full_name} (${customer.account_number})...`);
      
      try {
        // This is the core logic we added to Payment.js
        const result = await Payment.processCustomerAdvances(customer.customer_id);
        
        if (result.processed && result.allocations_made > 0) {
          console.log(`Success! Allocated funds to ${result.allocations_made} items.`);
          console.log(`Remaining Advance: ${result.remaining_advance}`);
          totalProcessed++;
        } else {
          console.log(`No matching unpaid items found.`);
        }
      } catch (err) {
        console.error(`Failed for customer ${customer.account_number}:`, err.message);
      }
      console.log('   ---------------------------------------------------');
    }

    console.log(`\nRECONCILIATION COMPLETE`);
    console.log(`   Customers Processed: ${totalProcessed}/${candidates.length}`);

  } catch (error) {
    console.error('FATAL ERROR:', error);
  } finally {
    process.exit();
  }
}

reconcileAll();