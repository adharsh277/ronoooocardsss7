import { useCurrentAccount } from '@mysten/dapp-kit'
import useTransact from '@suiware/kit/useTransact'
import { FormEvent, useState, useEffect } from 'react'
import { Loader2, CreditCard, ArrowRight } from 'lucide-react'
import { Button, Text, Dialog, Flex } from '@radix-ui/themes'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '~~/config/network'
import { prepareSpendTransaction } from '~~/dapp/helpers/transactions'
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

interface SpendCardFormProps {
  card: CardData;
  onSuccess?: () => void;
}

const SpendCardForm = ({ card, onSuccess }: SpendCardFormProps) => {
  const currentAccount = useCurrentAccount()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  const [spendAmount, setSpendAmount] = useState<string>('0.001')
  const [recipientAddress, setRecipientAddress] = useState<string>('')
  const [notificationId, setNotificationId] = useState<string>()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [addressError, setAddressError] = useState<string>('')

  // Calculate available amount to spend
  // Note: card.balance, card.spendingLimit, and card.amountSpent are already in SUI format from CardList
  const remainingLimit = Math.max(0, card.spendingLimit - card.amountSpent)
  
  // The available to spend is the minimum of the balance and remaining limit
  const availableToSpend = Math.min(
    card.balance, 
    remainingLimit
  )

  // Create a subscription to the transaction status
  const { transact: spend } = useTransact({
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
    setIsOpen(true)
  }

  // Validate Sui address format
  const validateSuiAddress = (address: string): boolean => {
    // Basic validation: Sui addresses start with '0x' and are 66 characters long (including 0x)
    return /^0x[a-fA-F0-9]{64}$/.test(address);
  }

  const handleSpendSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAddressError('')

    // Safety check for maximum amount
    const maxAmount = 0.01 // 0.01 SUI - lower limit for safety
    const amountNum = Number(spendAmount)
    
    if (amountNum > maxAmount) {
      notification.error(new Error(`Maximum spend amount is ${maxAmount} SUI during testing`))
      return
    }
    
    // Check against balance and spending limit
    if (amountNum > availableToSpend) {
      if (amountNum > card.balance) {
        notification.error(new Error(`Amount exceeds your card balance of ${card.balance.toFixed(2)} SUI`))
      } else if (amountNum > remainingLimit) {
        notification.error(new Error(`Amount exceeds your remaining spending limit of ${remainingLimit.toFixed(2)} SUI`))
      }
      return
    }
    
    // Validate address if provided
    if (recipientAddress && !validateSuiAddress(recipientAddress)) {
      setAddressError('Please enter a valid Sui address (0x followed by 64 hex characters)')
      return
    }
    
    try {
      console.log('Creating spend transaction:')
      console.log('- Package ID:', packageId)
      console.log('- Card ID:', card.id)
      console.log('- Spend amount:', spendAmount, 'SUI')
      console.log('- Recipient:', recipientAddress || 'Self (wallet owner)')
      
      // Process spend with transaction helper
      const tx = prepareSpendTransaction(packageId, card.id, spendAmount, recipientAddress)
      spend(tx)
    } catch (error) {
      console.error('Error preparing spend transaction:', error)
      notification.error(new Error('Failed to prepare spend transaction'))
    }
  }

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);
  
  if (!currentAccount) return null

  return (
    <>
      <Button
        onClick={handleOpenDialog}
        color="blue"
        variant="soft"
        size="2"
        disabled={!card.isActive || card.balance <= 0 || card.spendingLimit <= 0}
      >
        Spend
      </Button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content>
          <Dialog.Title>Spend from Card</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Transfer funds from your card to a recipient
          </Dialog.Description>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
              <Text className="mt-4 text-gray-600">Processing your transaction...</Text>
            </div>
          ) : availableToSpend <= 0 ? (
            <div className="mb-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-white rounded-lg">
                  <CreditCard className="text-blue-600" size={20} />
                </div>
                <div>
                  <Text className="font-medium text-gray-800">
                    Card {card.id.substring(0, 6)}...{card.id.substring(62)}
                  </Text>
                  <Text size="2" className="text-gray-600">
                    <span className="text-gray-700">Balance:</span> {card.balance.toFixed(4)} SUI
                  </Text>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-2 gap-4">
                <div>
                  <Text size="1" className="text-gray-600 mb-1">Spending Limit</Text>
                  <Text className="text-gray-800 font-medium">{card.spendingLimit.toFixed(4)} SUI</Text>
                </div>
                <div>
                  <Text size="1" className="text-gray-600 mb-1">Already Spent</Text>
                  <Text className="text-gray-800 font-medium">{card.amountSpent.toFixed(4)} SUI</Text>
                </div>
                <div>
                  <Text size="1" className="text-gray-600 mb-1">Available Limit</Text>
                  <Text className="text-blue-600 font-medium">{remainingLimit.toFixed(4)} SUI</Text>
                </div>
                <div>
                  <Text size="1" className="text-gray-600 mb-1">Can Spend</Text>
                  <Text className="text-blue-600 font-medium">{availableToSpend.toFixed(4)} SUI</Text>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSpendSubmit} className="p-6 space-y-4">
              <div className="mb-4">
                <Text as="label" htmlFor="recipient-address" size="2" className="block mb-2">
                  Recipient Address (optional)
                </Text>
                <div className="relative">
                  <input
                    id="recipient-address"
                    type="text"
                    className={`w-full rounded-md border ${addressError ? 'border-red-400' : 'border-gray-200'} px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500`}
                    value={recipientAddress}
                    onChange={(e) => {
                      setRecipientAddress(e.target.value);
                      setAddressError('');
                    }}
                    placeholder="0x..."
                  />
                </div>
                {addressError && (
                  <Text className="mt-1 text-red-500 text-sm">{addressError}</Text>
                )}
                <Text as="p" size="1" className="mt-1 text-gray-500">
                  Enter a Sui address to send funds to another wallet, or leave empty to send back to your wallet
                </Text>
              </div>
              
              <div className="mb-4">
                <Text as="label" htmlFor="spend-amount" size="2" className="block mb-2">
                  Spend Amount (SUI)
                </Text>
                <div className="relative">
                  <input
                    id="spend-amount"
                    type="number"
                    className="w-full rounded-md border border-gray-200 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    step="0.001"
                    min="0.001"
                    max={availableToSpend}
                    placeholder="0.00"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    SUI
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                  <Text className="text-blue-600 font-medium mb-2">Note:</Text>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    <li>This will transfer funds from your card to the specified recipient</li>
                    <li>If no recipient is specified, funds will be sent back to your wallet</li>
                    <li>For testing, spend amounts are limited to 0.001-0.01 SUI</li>
                    <li>Each transaction requires a sufficient gas budget</li>
                  </ul>
                </div>
              </div>

              <Flex gap="3" mt="4" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray" disabled={isLoading}>
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="submit" variant="solid" color="blue" disabled={isLoading}>
                  {isLoading && <Loader2 size={16} className="mr-2 animate-spin" />}
                  Spend <ArrowRight size={16} className="ml-1" />
                </Button>
              </Flex>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

export default SpendCardForm
