import { useCurrentAccount } from '@mysten/dapp-kit'
import { Button, Text, Dialog, Flex } from '@radix-ui/themes'
import useTransact from '@suiware/kit/useTransact'
import { FormEvent, useState } from 'react'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '~~/config/network'
import { prepareDepositTransaction } from '~~/dapp/helpers/transactions'
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

interface DepositCardFormProps {
  card: CardData;
  onSuccess?: () => void;
}

/**
 * Form for depositing SUI into a card - simplified for testnet
 */
const DepositCardForm = ({ card, onSuccess }: DepositCardFormProps) => {
  // Hooks
  const currentAccount = useCurrentAccount()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  
  // State
  const [depositAmount, setDepositAmount] = useState<string>('0.01')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [notificationId, setNotificationId] = useState<string>()

  // Transaction hook
  const { transact: deposit } = useTransact({
    onBeforeStart: () => {
      const nId = notification.txLoading()
      setNotificationId(nId)
    },
    onSuccess: (data) => {
      notification.txSuccess(
        transactionUrl(explorerUrl, data.digest),
        notificationId
      )
      
      setIsOpen(false)
      setIsLoading(false)
      
      // Wait for blockchain state to update before calling onSuccess
      setTimeout(() => {
        if (onSuccess) onSuccess()
      }, 2000)
    },
    onError: (e) => {
      notification.txError(e, null, notificationId)
      setIsLoading(false)
    },
    waitForTransactionOptions: {
      showEffects: true,
    },
  })

  // Open the deposit dialog
  const handleOpenDialog = () => {
    setIsOpen(true)
  }

  // Submit deposit transaction with improved handling
  const handleDepositSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    if (!depositAmount || Number(depositAmount) <= 0) {
      notification.error(new Error('Please enter a valid amount to deposit'))
      return
    }
    
    const amount = Number(depositAmount)
    
    // Limit to 0.1 SUI maximum for testing
    if (amount > 0.1) {
      notification.error(new Error('For testing, deposits are limited to 0.1 SUI maximum'))
      return
    }
    
    setIsLoading(true)
    
    try {
      console.log('Creating deposit transaction:')
      console.log('- Package ID:', packageId)
      console.log('- Card ID:', card.id)
      console.log('- Deposit amount:', amount, 'SUI')
      
      // Create transaction with our working deposit approach
      const tx = prepareDepositTransaction(packageId, card.id, '', amount)
      deposit(tx)
    } catch (error) {
      console.error('Error preparing deposit transaction:', error)
      notification.error(new Error('Failed to prepare deposit transaction'))
      setIsLoading(false)
    }
  }

  // Don't render if user is not connected
  if (!currentAccount) return null

  return (
    <div>
      <Button onClick={handleOpenDialog} variant="soft" color="blue" disabled={!card.isActive}>
        Deposit
      </Button>
    
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content>
          <Dialog.Title>Deposit to Card</Dialog.Title>
          
          <Dialog.Description size="2" mb="4">
            Deposit SUI tokens to increase your card balance.
          </Dialog.Description>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <form onSubmit={handleDepositSubmit}>
              <Flex direction="column" gap="3">
                <div className="mb-3">
                  <Text as="div" size="2" className="text-blue-600 font-semibold mb-1">
                    Note: For testing, deposits are limited to 0.1 SUI max
                  </Text>
                  <Text as="div" size="2" className="text-gray-600 mb-1">
                    Deposits are taken directly from your gas balance, not from your selected coins.
                  </Text>
                </div>
                
                <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                  <Text as="div" size="2" className="text-gray-800">
                    <span className="font-semibold text-blue-600">Current Card Balance:</span> {card.balance} SUI
                  </Text>
                </div>
                
                <div className="mb-3">
                  <Text as="label" htmlFor="amount-input" size="2" className="block mb-1">
                    Amount (SUI)
                  </Text>
                  <input
                    id="amount-input"
                    type="number"
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    step="0.001"
                    min="0.001"
                    max="0.1"
                  />
                </div>
                
                <Flex gap="3" mt="4" justify="end">
                  <Dialog.Close>
                    <Button variant="soft" color="gray">
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button type="submit" variant="solid" color="blue">
                    Deposit
                  </Button>
                </Flex>
              </Flex>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </div>
  )
}

export default DepositCardForm
