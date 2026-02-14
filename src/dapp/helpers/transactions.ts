import { Transaction } from '@mysten/sui/transactions'
import { fullFunctionName } from '~~/helpers/network'

// Maintaining backward compatibility with counter functions
export const prepareCreateCounterTransaction = (
  packageId: string
): Transaction => {
  const tx = new Transaction()
  tx.moveCall({
    arguments: [],
    target: fullFunctionName(packageId, 'create'),
  })

  return tx
}

export const prepareIncrementCounterTransaction = (
  packageId: string,
  objectId: string
): Transaction => {
  const tx = new Transaction()
  tx.moveCall({
    arguments: [tx.object(objectId)],
    target: fullFunctionName(packageId, 'increment'),
  })

  return tx
}

export const prepareDecrementCounterTransaction = (
  packageId: string,
  objectId: string
): Transaction => {
  const tx = new Transaction()
  tx.moveCall({
    arguments: [tx.object(objectId)],
    target: fullFunctionName(packageId, 'decrement'),
  })

  return tx
}

// Card Functions
// Create a new virtual card with a spending limit
export const prepareCreateCardTransaction = (
  packageId: string,
  spendingLimit: number | string
): Transaction => {
  const tx = new Transaction()
  const spendingLimitValue = typeof spendingLimit === 'string' ? parseInt(spendingLimit) : spendingLimit
  
  tx.moveCall({
    arguments: [tx.pure.u64(spendingLimitValue)],
    target: fullFunctionName(packageId, 'create_card'),
  })

  return tx
}

// Simplified deposit that supports variable amounts with safety limits
export const prepareDepositTransaction = (
  packageId: string,
  cardId: string,
  _coinObjectId?: string, // Kept for backwards compatibility but not used
  amount?: string | number
): Transaction => {
  console.log('Creating deposit transaction')
  console.log('- Package ID:', packageId)
  console.log('- Card ID:', cardId)
  console.log('- Requested amount:', amount || '0.005 SUI (default)')
  
  // Create a new transaction with conservative gas settings
  const tx = new Transaction()
  tx.setGasBudget(30_000_000) // High gas budget to ensure success
  
  // Determine deposit amount with safety limits
  let depositAmount = 5_000_000 // Default 0.005 SUI in MIST
  
  if (amount && Number(amount) > 0) {
    // Convert amount from SUI to MIST
    const requestedAmount = Math.floor(Number(amount) * 1_000_000_000)
    
    // Cap at 0.1 SUI (100M MIST) for safety during testing
    const maxAmount = 100_000_000
    depositAmount = Math.min(requestedAmount, maxAmount)
    
    console.log('- Deposit amount in MIST:', depositAmount)
  }
  
  // Split the amount from gas and deposit directly
  const [splitCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(depositAmount)])
  
  // Call the deposit function directly
  tx.moveCall({
    target: fullFunctionName(packageId, 'deposit'),
    arguments: [tx.object(cardId), splitCoin],
  })
  
  console.log('Transaction prepared successfully')
  return tx
}

// Withdraw from a card - enhanced with our successful pattern
export const prepareWithdrawTransaction = (
  packageId: string,
  cardId: string,
  amount: string | number
): Transaction => {
  console.log('Creating withdraw transaction:')
  console.log('- Package ID:', packageId)
  console.log('- Card ID:', cardId)
  console.log('- Withdraw amount:', amount, 'SUI')
  
  // Create a transaction with explicit gas settings
  const tx = new Transaction()
  tx.setGasBudget(30_000_000) // High gas budget to ensure success
  
  // Convert amount from SUI to MIST (1 SUI = 10^9 MIST)
  const amountInMist = Math.floor(Number(amount) * 1_000_000_000)
  
  // Safety check for minimum amount
  if (amountInMist < 1_000_000) { // 0.001 SUI minimum
    throw new Error('Minimum withdrawal amount is 0.001 SUI')
  }
  
  // Call the withdraw function directly
  tx.moveCall({
    target: fullFunctionName(packageId, 'withdraw'),
    arguments: [tx.object(cardId), tx.pure.u64(amountInMist)],
  })
  
  console.log('Withdraw transaction prepared successfully')
  return tx
}

// Spend from a card with recipient - enhanced with our reliable transaction pattern
export const prepareSpendTransaction = (
  packageId: string,
  cardId: string,
  amount: number | string,
  recipientAddress?: string // Optional recipient address
): Transaction => {
  console.log('Creating spend transaction:')
  console.log('- Package ID:', packageId)
  console.log('- Card ID:', cardId)
  console.log('- Spend amount:', amount, 'SUI')
  
  // Create transaction with explicit gas settings
  const tx = new Transaction()
  tx.setGasBudget(30_000_000) // High gas budget to ensure success
  
  // Convert amount from SUI to MIST (1 SUI = 10^9 MIST)
  const amountInMist = Math.floor(Number(amount) * 1_000_000_000)
  
  // Safety check for minimum amount
  if (amountInMist < 1_000_000) { // 0.001 SUI minimum
    throw new Error('Minimum spend amount is 0.001 SUI')
  }
  
  // Safety check for maximum amount - use very small amounts to avoid exceeding spending limit
  const maxAmount = 5_000_000 // 0.005 SUI in MIST - much lower limit for safety
  if (amountInMist > maxAmount) {
    throw new Error('Maximum spend amount is 0.005 SUI during testing')
  }
  
  if (recipientAddress) {
    // Use the new spend function with recipient parameter
    console.log('- Sending to recipient:', recipientAddress)
    tx.moveCall({
      arguments: [
        tx.object(cardId), 
        tx.pure.u64(amountInMist),
        tx.pure.address(recipientAddress)
      ],
      target: fullFunctionName(packageId, 'spend'),
    })
  } else {
    // If no recipient specified, use the backward-compatible function
    console.log('- No recipient specified, sending back to owner')
    tx.moveCall({
      arguments: [tx.object(cardId), tx.pure.u64(amountInMist)],
      target: fullFunctionName(packageId, 'spend_to_owner'),
    })
  }

  console.log('Spend transaction prepared successfully')
  return tx
}

// Direct transfer from a card - a more reliable approach that bypasses spending limits
export const prepareDirectTransferTransaction = (
  packageId: string,
  cardId: string,
  amount: number | string,
  recipientAddress: string // Required recipient address
): Transaction => {
  console.log('Creating direct transfer transaction:')
  console.log('- Package ID:', packageId)
  console.log('- Card ID:', cardId)
  console.log('- Transfer amount:', amount, 'SUI')
  console.log('- Recipient:', recipientAddress)
  
  // Create transaction with explicit gas settings
  const tx = new Transaction()
  tx.setGasBudget(30_000_000) // High gas budget to ensure success
  
  // Convert amount from SUI to MIST (1 SUI = 10^9 MIST)
  const amountInMist = Math.floor(Number(amount) * 1_000_000_000)
  
  // Safety check for minimum amount
  if (amountInMist < 1_000_000) { // 0.001 SUI minimum
    throw new Error('Minimum transfer amount is 0.001 SUI')
  }
  
  // Safety check for maximum amount - limit to 0.2 SUI during testing
  const maxAmount = 200_000_000 // 0.2 SUI in MIST
  if (amountInMist > maxAmount) {
    throw new Error('Maximum transfer amount is 0.2 SUI during testing')
  }
  
  // Call the direct_transfer function with recipient parameter
  tx.moveCall({
    arguments: [
      tx.object(cardId), 
      tx.pure.u64(amountInMist),
      tx.pure.address(recipientAddress)
    ],
    target: fullFunctionName(packageId, 'direct_transfer'),
  })

  console.log('Direct transfer transaction prepared successfully')
  return tx
}

// Deactivate a card
export const prepareDeactivateCardTransaction = (
  packageId: string,
  cardId: string
): Transaction => {
  const tx = new Transaction()
  tx.setGasBudget(30_000_000) // High gas budget to ensure success
  
  tx.moveCall({
    arguments: [tx.object(cardId)],
    target: fullFunctionName(packageId, 'deactivate_card'),
  })

  return tx
}

// Update the spending limit of a card - using our reliable transaction pattern
export const prepareUpdateSpendingLimitTransaction = (
  packageId: string,
  cardId: string,
  newLimit: number | string
): Transaction => {
  console.log('Creating update spending limit transaction:')
  console.log('- Package ID:', packageId)
  console.log('- Card ID:', cardId)
  console.log('- New limit:', newLimit, 'SUI')
  
  // Create transaction with explicit gas settings
  const tx = new Transaction()
  tx.setGasBudget(30_000_000) // High gas budget to ensure success
  
  // Convert new limit from SUI to MIST (1 SUI = 10^9 MIST)
  const newLimitInMist = Math.floor(Number(newLimit) * 1_000_000_000)
  
  // Call the update_spending_limit function 
  tx.moveCall({
    arguments: [tx.object(cardId), tx.pure.u64(newLimitInMist)],
    target: fullFunctionName(packageId, 'update_spending_limit'),
  })

  console.log('Update spending limit transaction prepared successfully')
  return tx
}

// Reactivate a card
export const prepareReactivateCardTransaction = (
  packageId: string,
  cardId: string
): Transaction => {
  const tx = new Transaction()
  tx.moveCall({
    arguments: [tx.object(cardId)],
    target: fullFunctionName(packageId, 'reactivate_card'),
  })

  return tx
}
