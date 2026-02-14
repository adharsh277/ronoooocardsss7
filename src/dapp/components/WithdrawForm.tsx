import { useCurrentAccount } from '@mysten/dapp-kit'
import { Button, Text, Dialog, Flex } from '@radix-ui/themes'
import useTransact from '@suiware/kit/useTransact'
import { FormEvent, useState } from 'react'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '~~/config/network'
import { prepareWithdrawTransaction } from '~~/dapp/helpers/transactions'
import { transactionUrl } from '~~/helpers/network'
import { notification } from '~~/helpers/notification'
import useNetworkConfig from '~~/hooks/useNetworkConfig'

interface CardData {
  id: string;
  owner: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  isActive: boolean;
}

interface WithdrawFormProps {
  card: CardData;
  onSuccess?: () => void;
}

const WithdrawForm = ({ card, onSuccess }: WithdrawFormProps) => {
  const currentAccount = useCurrentAccount()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  
  // The card.balance is already in SUI format from our CardList component's processing
  // so we don't need additional conversion here
  const balanceSui = card.balance
  
  const [withdrawAmount, setWithdrawAmount] = useState<string>('')
  const [notificationId, setNotificationId] = useState<string>()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Create a subscription to the transaction status
  const { transact: withdraw } = useTransact({
    onBeforeStart: () => {
      const nId = notification.txLoading()
      setNotificationId(nId)
      setIsLoading(true)
    },
    onSuccess: (
      data,
      _response
    ) => {
      notification.txSuccess(
        transactionUrl(explorerUrl, data.digest),
        notificationId
      )
      
      setIsOpen(false)
      setIsLoading(false)
      setWithdrawAmount('')
      
      // Wait for 2 seconds to allow blockchain state to update, then call refresh callback
      setTimeout(() => {
        if (onSuccess) {
          onSuccess()
        }
      }, 2000)
    },
    onError: (e: Error) => {
      notification.txError(e, null, notificationId)
      setIsLoading(false)
    },
    waitForTransactionOptions: {
      showEffects: true,
    },
  })

  const handleOpenDialog = async () => {
    setWithdrawAmount('')
    setIsOpen(true)
  }

  const handleWithdrawSubmit = (e: FormEvent) => {
    e.preventDefault()

    // Validate amount
    if (!withdrawAmount || Number(withdrawAmount) <= 0) {
      notification.error(new Error('Please enter a valid amount to withdraw'))
      return
    }
    
    const withdrawAmountNum = Number(withdrawAmount)
    
    // Reserve at least 0.001 SUI for transaction
    const minAmount = 0.001
    if (withdrawAmountNum < minAmount) {
      notification.error(new Error(`Minimum withdrawal amount is ${minAmount} SUI`))
      return
    }
    
    // Cap at max 0.5 SUI for testing to be safe
    const maxAmount = 0.5
    if (withdrawAmountNum > maxAmount) {
      notification.error(new Error(`For testing, withdrawals are limited to ${maxAmount} SUI maximum`))
      return
    }
    
    // Check against balance
    if (withdrawAmountNum > balanceSui) {
      notification.error(new Error(`Withdrawal amount exceeds available balance (${balanceSui.toFixed(4)} SUI)`))
      return
    }
    
    try {
      console.log('Creating withdrawal transaction:')
      console.log('- Package ID:', packageId)
      console.log('- Card ID:', card.id)
      console.log('- Withdraw amount:', withdrawAmountNum, 'SUI')
      
      // Process withdrawal with our enhanced transaction helper
      // Pass the numeric value directly to avoid string-to-number conversion issues
      const tx = prepareWithdrawTransaction(packageId, card.id, withdrawAmountNum)
      withdraw(tx)
    } catch (error) {
      console.error('Error preparing withdraw transaction:', error)
      notification.error(new Error('Failed to prepare withdraw transaction'))
    }
  }

  const handleMaxClick = () => {
    // Set to either balance or max test amount (0.5 SUI), whichever is smaller
    const maxTestAmount = 0.5
    const maxAmount = Math.min(balanceSui, maxTestAmount)
    setWithdrawAmount(maxAmount.toString())
  }

  if (!currentAccount) return null

  return (
    <>
      <Button
        color="blue"
        variant="soft"
        size="2"
        onClick={handleOpenDialog}
        disabled={card.balance <= 0}
      >
        Withdraw
      </Button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content>
          <Dialog.Title>Withdraw Funds</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Withdraw SUI from your card to your wallet
          </Dialog.Description>

          {isLoading ? (
            <div className="p-4 text-center">
              <div className="flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              </div>
              <Text className="text-gray-600 mt-2">Processing transaction...</Text>
            </div>
          ) : card.balance <= 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <Text className="text-blue-600">
                Your card has no balance to withdraw.
              </Text>
            </div>
          ) : (
            <form onSubmit={handleWithdrawSubmit}>
              <Flex direction="column" gap="3">
                <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                  <Text as="div" size="2" className="text-gray-600 mb-1">
                    Available Balance
                  </Text>
                  <Text as="div" size="4" className="font-semibold text-blue-600">
                    {balanceSui.toFixed(2)} SUI
                  </Text>
                </div>
                
                <div className="mb-3">
                  <Text as="div" size="2" className="text-blue-600 font-semibold mb-1">
                    Note: For testing, withdrawals are limited to 0.5 SUI max
                  </Text>
                </div>
                
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <Text as="label" htmlFor="withdraw-amount" size="2">
                      Withdraw Amount (SUI)
                    </Text>
                    <Button 
                      type="button" 
                      variant="soft" 
                      color="blue"
                      size="1" 
                      onClick={handleMaxClick}
                    >
                      Max
                    </Button>
                  </div>
                  <input
                    id="withdraw-amount"
                    type="number"
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    step="0.001"
                    min="0.001"
                    max="0.5"
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <Button type="button" variant="soft" color="gray" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="solid" color="blue" disabled={isLoading}>
                    Withdraw
                  </Button>
                </div>
              </Flex>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
// Export the component as default
export default WithdrawForm