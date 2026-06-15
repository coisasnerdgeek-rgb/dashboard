import { supabase } from '../services/supabaseClient';

/**
 * Diagnostic Script: Check RLS Policies for saved_orders table
 * 
 * This script tests whether the current user/service has proper
 * DELETE permissions on the saved_orders table.
 * 
 * Run this with: npx ts-node scripts/check-rls.ts
 */

async function checkRLSPolicies() {
    console.log('🔍 Checking RLS Policies for saved_orders table...\n');

    // Test 1: Check if we can read data
    console.log('Test 1: SELECT permissions');
    const { data: selectData, error: selectError, count: selectCount } = await supabase
        .from('saved_orders')
        .select('*', { count: 'exact', head: true });

    if (selectError) {
        console.error('❌ SELECT failed:', selectError.message);
    } else {
        console.log(`✅ SELECT successful - ${selectCount} rows accessible`);
    }

    // Test 2: Check if we can insert data (test row)
    console.log('\nTest 2: INSERT permissions');
    const testOrder = {
        id: 'TEST_RLS_CHECK_' + Date.now(),
        data_json: {
            id: 'TEST_RLS_CHECK_' + Date.now(),
            product: 'TEST',
            store: 'TEST',
            cnpj: 'TEST',
            quantities: {},
            totals: { totalQuantity: 0, totalCost: 0 },
            colors: [],
            sizes: []
        },
        archived_date: null
    };

    const { data: insertData, error: insertError } = await supabase
        .from('saved_orders')
        .insert(testOrder)
        .select()
        .single();

    if (insertError) {
        console.error('❌ INSERT failed:', insertError.message);
    } else {
        console.log('✅ INSERT successful - test row created');

        // Test 3: Check if we can delete data
        console.log('\nTest 3: DELETE permissions');
        const { data: deleteData, error: deleteError, count: deleteCount } = await supabase
            .from('saved_orders')
            .delete({ count: 'exact' })
            .eq('id', testOrder.id)
            .select();

        if (deleteError) {
            console.error('❌ DELETE failed:', deleteError.message);
            console.error('   Error code:', deleteError.code);
            console.error('   Error hint:', deleteError.hint);
            console.error('   Error details:', deleteError.details);

            // Try to clean up manually
            console.log('\n⚠️  Attempting cleanup with service role...');
            // Note: This would require a separate service role client

        } else {
            console.log(`✅ DELETE successful - ${deleteCount} rows deleted`);
            console.log('   Deleted data:', deleteData);
        }
    }

    // Test 4: Check if we can update data
    console.log('\nTest 4: UPDATE permissions');
    const { data: updateData, error: updateError } = await supabase
        .from('saved_orders')
        .update({ archived_date: new Date().toISOString() })
        .eq('id', testOrder.id)
        .select();

    if (updateError) {
        console.error('❌ UPDATE failed:', updateError.message);
    } else {
        console.log('✅ UPDATE successful');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log('='.repeat(60));
    console.log('SELECT:', selectError ? '❌ FAILED' : '✅ OK');
    console.log('INSERT:', insertError ? '❌ FAILED' : '✅ OK');
    console.log('DELETE:', deleteError ? '❌ FAILED' : '✅ OK');
    console.log('UPDATE:', updateError ? '❌ FAILED' : '✅ OK');
    console.log('='.repeat(60));

    if (deleteError) {
        console.log('\n⚠️  DELETE PERMISSION ISSUE DETECTED!');
        console.log('\nPossible causes:');
        console.log('1. RLS policy does not allow DELETE for current user');
        console.log('2. Using anon key instead of service role key');
        console.log('3. RLS policies are misconfigured');
        console.log('\nRecommended actions:');
        console.log('1. Check Supabase Dashboard → Authentication → Policies → saved_orders');
        console.log('2. Ensure DELETE policy exists and is enabled');
        console.log('3. Verify you\'re using the correct API key in .env');
        console.log('4. Consider using service role key for backend operations');
    }
}

// Run the check
checkRLSPolicies()
    .then(() => {
        console.log('\n✅ RLS policy check complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error during RLS check:', error);
        process.exit(1);
    });
