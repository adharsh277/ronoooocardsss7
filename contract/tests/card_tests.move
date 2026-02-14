#[test_only]
module card::card_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::test_utils::assert_eq;
    use card::card::{Self, Card};

    // Test addresses
    const OWNER: address = @0xCAFE;

    // Error constants from the card module
    const ENotOwner: u64 = 0;
    const EInsufficientBalance: u64 = 1;
    const EExceedsSpendingLimit: u64 = 2;
    const EInactiveCard: u64 = 3;

    #[test]
    fun test_create_card() {
        let mut scenario = ts::begin(OWNER);
        
        // Create a new card with a spending limit of 1000
        let spending_limit = 1000;
        test_create_card_helper(&mut scenario, spending_limit);
        
        // Check card was created correctly
        ts::next_tx(&mut scenario, OWNER);
        {
            let card = ts::take_from_sender<Card>(&scenario);
            let (owner, balance, limit, spent, is_active) = card::get_card_info(&card);
            
            assert_eq(owner, OWNER);
            assert_eq(balance, 0);
            assert_eq(limit, spending_limit);
            assert_eq(spent, 0);
            assert_eq(is_active, true);
            
            ts::return_to_sender(&scenario, card);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_deposit_and_spend() {
        let mut scenario = ts::begin(OWNER);
        
        // Create a new card with a spending limit of 1000
        let spending_limit = 1000;
        test_create_card_helper(&mut scenario, spending_limit);
        
        // Deposit SUI into the card
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            let deposit_amount = 500;
            
            // Create a test SUI coin for deposit
            let coin = coin::mint_for_testing<SUI>(deposit_amount, ts::ctx(&mut scenario));
            
            // Deposit the coin into the card
            card::deposit(&mut card, coin, ts::ctx(&mut scenario));
            
            // Verify the balance was updated
            let (_, balance, _, _, _) = card::get_card_info(&card);
            assert_eq(balance, deposit_amount);
            
            ts::return_to_sender(&scenario, card);
        };
        
        // Spend from the card
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            let spend_amount = 200;
            
            // Spend from the card
            card::spend(&mut card, spend_amount, ts::ctx(&mut scenario));
            
            // Verify the balance and amount spent were updated
            let (_, balance, _, spent, _) = card::get_card_info(&card);
            assert_eq(balance, 300); // 500 - 200
            assert_eq(spent, 200);
            
            ts::return_to_sender(&scenario, card);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 2)] // EExceedsSpendingLimit
    fun test_spend_exceeds_limit() {
        let mut scenario = ts::begin(OWNER);
        
        // Create a new card with a spending limit of 1000
        let spending_limit = 1000;
        test_create_card_helper(&mut scenario, spending_limit);
        
        // Deposit SUI into the card
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            let deposit_amount = 2000; // More than the spending limit
            
            // Create a test SUI coin for deposit
            let coin = coin::mint_for_testing<SUI>(deposit_amount, ts::ctx(&mut scenario));
            
            // Deposit the coin into the card
            card::deposit(&mut card, coin, ts::ctx(&mut scenario));
            
            // Try to spend more than the spending limit
            card::spend(&mut card, 1001, ts::ctx(&mut scenario)); // This should fail
            
            ts::return_to_sender(&scenario, card);
        };
        
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1)] // EInsufficientBalance
    fun test_spend_insufficient_balance() {
        let mut scenario = ts::begin(OWNER);
        
        // Create a new card with a spending limit of 1000
        let spending_limit = 1000;
        test_create_card_helper(&mut scenario, spending_limit);
        
        // Deposit SUI into the card
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            let deposit_amount = 500;
            
            // Create a test SUI coin for deposit
            let coin = coin::mint_for_testing<SUI>(deposit_amount, ts::ctx(&mut scenario));
            
            // Deposit the coin into the card
            card::deposit(&mut card, coin, ts::ctx(&mut scenario));
            
            // Try to spend more than the balance
            card::spend(&mut card, 600, ts::ctx(&mut scenario)); // This should fail
            
            ts::return_to_sender(&scenario, card);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_deactivate_and_reactivate() {
        let mut scenario = ts::begin(OWNER);
        
        // Create a new card with a spending limit of 1000
        let spending_limit = 1000;
        test_create_card_helper(&mut scenario, spending_limit);
        
        // Deactivate the card
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            
            card::deactivate_card(&mut card, ts::ctx(&mut scenario));
            
            // Verify the card is deactivated
            let (_, _, _, _, is_active) = card::get_card_info(&card);
            assert_eq(is_active, false);
            
            ts::return_to_sender(&scenario, card);
        };
        
        // Try to spend from a deactivated card
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            
            // Reactivate the card
            card::reactivate_card(&mut card, ts::ctx(&mut scenario));
            
            // Verify the card is reactivated
            let (_, _, _, _, is_active) = card::get_card_info(&card);
            assert_eq(is_active, true);
            
            ts::return_to_sender(&scenario, card);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_update_spending_limit() {
        let mut scenario = ts::begin(OWNER);
        
        // Create a new card with a spending limit of 1000
        let spending_limit = 1000;
        test_create_card_helper(&mut scenario, spending_limit);
        
        // Update the spending limit
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            let new_limit = 2000;
            
            card::update_spending_limit(&mut card, new_limit, ts::ctx(&mut scenario));
            
            // Verify the spending limit was updated
            let (_, _, limit, _, _) = card::get_card_info(&card);
            assert_eq(limit, new_limit);
            
            ts::return_to_sender(&scenario, card);
        };
        
        ts::end(scenario);
    }

    #[test]
    fun test_withdraw() {
        let mut scenario = ts::begin(OWNER);
        
        // Create a new card with a spending limit of 1000
        let spending_limit = 1000;
        test_create_card_helper(&mut scenario, spending_limit);
        
        // Deposit SUI into the card
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            let deposit_amount = 500;
            
            // Create a test SUI coin for deposit
            let coin = coin::mint_for_testing<SUI>(deposit_amount, ts::ctx(&mut scenario));
            
            // Deposit the coin into the card
            card::deposit(&mut card, coin, ts::ctx(&mut scenario));
            
            // Verify the balance was updated
            let (_, balance, _, _, _) = card::get_card_info(&card);
            assert_eq(balance, deposit_amount);
            
            ts::return_to_sender(&scenario, card);
        };
        
        // Withdraw from the card
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut card = ts::take_from_sender<Card>(&scenario);
            let withdraw_amount = 200;
            
            // Withdraw from the card
            card::withdraw(&mut card, withdraw_amount, ts::ctx(&mut scenario));
            
            // Verify the balance was updated
            let (_, balance, _, _, _) = card::get_card_info(&card);
            assert_eq(balance, 300); // 500 - 200
            
            ts::return_to_sender(&scenario, card);
        };
        
        ts::end(scenario);
    }

    // Helper function to create a card
    fun test_create_card_helper(scenario: &mut Scenario, spending_limit: u64) {
        ts::next_tx(scenario, OWNER);
        {
            card::create_card(spending_limit, ts::ctx(scenario));
        };
    }
}
