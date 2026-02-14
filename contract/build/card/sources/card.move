/// Virtual Card System - A decentralized crypto-powered virtual card system on Sui
/// This module allows users to create virtual cards, deposit crypto, set spending limits, and track spending
module card::card {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;

    /// Errors
    const ENotOwner: u64 = 0;
    const EInsufficientBalance: u64 = 1;
    const EExceedsSpendingLimit: u64 = 2;
    const EInactiveCard: u64 = 3;
    
    /// The Card object that represents a virtual debit card
    public struct Card has key, store {
        id: UID,
        owner: address,
        balance: Balance<SUI>,
        spending_limit: u64,
        amount_spent: u64,
        is_active: bool
    }
    
    /// Event emitted when a new card is created
    public struct CardCreated has copy, drop {
        card_id: address,
        owner: address,
        spending_limit: u64
    }
    
    /// Event emitted when tokens are deposited
    public struct Deposit has copy, drop {
        card_id: address,
        amount: u64,
        new_balance: u64
    }
    
    /// Event emitted when tokens are spent
    public struct Spend has copy, drop {
        card_id: address,
        amount: u64,
        new_balance: u64,
        total_spent: u64
    }
    
    /// Event emitted when tokens are directly transferred from a card
    public struct DirectTransfer has copy, drop {
        card_id: address,
        recipient: address,
        amount: u64,
        new_balance: u64
    }
    
    /// Creates a new virtual card with a specified spending limit
    public fun create_card(spending_limit: u64, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        
        let card = Card {
            id: object::new(ctx),
            owner: sender,
            balance: balance::zero<SUI>(),
            spending_limit,
            amount_spent: 0,
            is_active: true
        };
        
        let card_id = object::uid_to_address(&card.id);
        
        event::emit(CardCreated {
            card_id,
            owner: sender,
            spending_limit
        });
        
        transfer::transfer(card, sender);
    }
    
    /// Deposits SUI tokens into the card
    public fun deposit(card: &mut Card, payment: Coin<SUI>, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == card.owner, ENotOwner);
        assert!(card.is_active, EInactiveCard);
        
        let amount = coin::value(&payment);
        let deposit_balance = coin::into_balance(payment);
        let card_id = object::uid_to_address(&card.id);
        
        balance::join(&mut card.balance, deposit_balance);
        
        event::emit(Deposit {
            card_id,
            amount,
            new_balance: balance::value(&card.balance)
        });
    }
    
    /// Simulates spending from the card with a recipient
    public fun spend(card: &mut Card, amount: u64, recipient: address, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == card.owner, ENotOwner);
        assert!(card.is_active, EInactiveCard);
        assert!(balance::value(&card.balance) >= amount, EInsufficientBalance);
        
        let potential_spent = card.amount_spent + amount;
        assert!(potential_spent <= card.spending_limit, EExceedsSpendingLimit);
        
        // Transfer funds to the specified recipient
        let payment = balance::split(&mut card.balance, amount);
        let pay_coin = coin::from_balance(payment, ctx);
        transfer::public_transfer(pay_coin, recipient);
        
        card.amount_spent = potential_spent;
        
        let card_id = object::uid_to_address(&card.id);
        
        event::emit(Spend {
            card_id,
            amount,
            new_balance: balance::value(&card.balance),
            total_spent: card.amount_spent
        });
    }
    
    /// Original spend function (kept for backward compatibility)
    public fun spend_to_owner(card: &mut Card, amount: u64, ctx: &mut TxContext) {
        // Use the new spend function but with the owner as the recipient
        let sender = tx_context::sender(ctx);
        spend(card, amount, sender, ctx);
    }
    
    /// Direct transfer function that bypasses spending limits
    /// This function allows the card owner to transfer funds directly
    /// without affecting the spending limit tracking
    public fun direct_transfer(card: &mut Card, amount: u64, recipient: address, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == card.owner, ENotOwner);
        assert!(card.is_active, EInactiveCard);
        assert!(balance::value(&card.balance) >= amount, EInsufficientBalance);
        
        // Transfer funds to the specified recipient without updating spent amount
        let payment = balance::split(&mut card.balance, amount);
        let pay_coin = coin::from_balance(payment, ctx);
        transfer::public_transfer(pay_coin, recipient);
        
        let card_id = object::uid_to_address(&card.id);
        
        event::emit(DirectTransfer {
            card_id,
            recipient,
            amount,
            new_balance: balance::value(&card.balance)
        });
    }
    
    /// Returns information about a card
    public fun get_card_info(card: &Card): (address, u64, u64, u64, bool) {
        (
            card.owner,
            balance::value(&card.balance),
            card.spending_limit,
            card.amount_spent,
            card.is_active
        )
    }
    
    /// Deactivates a card
    public fun deactivate_card(card: &mut Card, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == card.owner, ENotOwner);
        
        card.is_active = false;
    }
    
    /// Reactivates a card
    public fun reactivate_card(card: &mut Card, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == card.owner, ENotOwner);
        
        card.is_active = true;
    }
    
    /// Updates the spending limit of a card
    public fun update_spending_limit(card: &mut Card, new_limit: u64, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == card.owner, ENotOwner);
        
        card.spending_limit = new_limit;
    }
    
    /// Withdraws tokens from a card
    public fun withdraw(card: &mut Card, amount: u64, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        assert!(sender == card.owner, ENotOwner);
        assert!(balance::value(&card.balance) >= amount, EInsufficientBalance);
        
        let withdraw_balance = balance::split(&mut card.balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);
        transfer::public_transfer(withdraw_coin, sender);
    }
}