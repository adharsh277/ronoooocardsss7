import { useCurrentAccount } from '@mysten/dapp-kit'
import { Button, Text, Dialog, Flex } from '@radix-ui/themes'
import useTransact from '@suiware/kit/useTransact'
import { FormEvent, useState, ChangeEvent } from 'react'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '~~/config/network'
import { prepareUpdateSpendingLimitTransaction } from '~~/dapp/helpers/transactions'
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

interface UpdateLimitFormProps {
  card: CardData;
  onSuccess?: () => void;
}

const UpdateLimitForm = ({ card, onSuccess }: UpdateLimitFormProps) => {
  const currentAccount = useCurrentAccount()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  
  // Convert from MIST to SUI for display
  const currentLimitSui = card.spendingLimit / 1_000_000_000
  
  const [newLimit, setNewLimit] = useState<string>(currentLimitSui.toString())
  const [notificationId, setNotificationId] = useState<string>()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Create a subscription to the transaction status
  const { transact: updateLimit } = useTransact({
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
    setNewLimit(currentLimitSui.toString())
    setIsOpen(true)
  }

  const handleUpdateLimit = (e: FormEvent) => {
    e.preventDefault()

    // Validate amount
    if (!newLimit || Number(newLimit) <= 0) {
      notification.error(new Error('Please enter a valid spending limit'))
      return
    }
    
    // Update the spending limit
    updateLimit(prepareUpdateSpendingLimitTransaction(packageId, card.id, newLimit))
  }

  if (!currentAccount) return null

  return (
    <>
      <Button
        color="indigo"
        variant="soft"
        size="2"
        onClick={handleOpenDialog}
      >
        Update Limit
      </Button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content>
          <Dialog.Title>Update Spending Limit</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Set a new spending limit for your card
          </Dialog.Description>

          {isLoading ? (
            <div className="p-4 text-center">
              <Text>Processing transaction...</Text>
            </div>
          ) : (
            <form onSubmit={handleUpdateLimit}>
              <Flex direction="column" gap="3">
                <div className="mb-3">
                  <Text as="div" size="2" className="block mb-1">
                    <span className="font-medium">Current Limit:</span> {currentLimitSui.toFixed(2)} SUI
                  </Text>
                </div>
                
                <div className="mb-3">
                  <Text as="label" htmlFor="new-limit" size="2" className="block mb-1">
                    New Spending Limit (SUI)
                  </Text>
                  <input
                    id="new-limit"
                    type="number"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                    value={newLimit}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewLimit(e.target.value)}
                    step="0.001"
                    min="0.001"
                    required
                  />
                  <Text as="div" size="1" className="mt-1 text-gray-400">
                    Note: Card spending limits apply to the total amount spent, not the balance.
                  </Text>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="soft" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="solid" color="indigo" disabled={isLoading}>
                    Update Limit
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

export default UpdateLimitForm
