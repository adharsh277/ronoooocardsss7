import { useCurrentAccount } from '@mysten/dapp-kit'
import { Button, Text, Dialog, Flex } from '@radix-ui/themes'
import useTransact from '@suiware/kit/useTransact'
import { useState } from 'react'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '~~/config/network'
import { 
  prepareDeactivateCardTransaction, 
  prepareReactivateCardTransaction
} from '~~/dapp/helpers/transactions'
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

interface CardManagementFormProps {
  card: CardData;
  onSuccess?: () => void;
}

const CardManagementForm = ({ card, onSuccess }: CardManagementFormProps) => {
  const currentAccount = useCurrentAccount()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  const [notificationId, setNotificationId] = useState<string>()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Create a subscription to the transaction status
  const { transact: manageCard } = useTransact({
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

  const handleToggleCardStatus = () => {
    if (card.isActive) {
      // Deactivate card
      manageCard(prepareDeactivateCardTransaction(packageId, card.id))
    } else {
      // Activate card
      manageCard(prepareReactivateCardTransaction(packageId, card.id))
    }
    setIsOpen(false)
  }

  if (!currentAccount) return null

  return (
    <>
      <Button
        color={card.isActive ? "red" : "green"}
        variant="soft"
        size="2"
        onClick={handleOpenDialog}
      >
        {card.isActive ? 'Deactivate' : 'Activate'}
      </Button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content>
          <Dialog.Title>{card.isActive ? 'Deactivate' : 'Activate'} Card</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {card.isActive 
              ? 'Deactivating will prevent any spending from this card' 
              : 'Activating will allow spending from this card'}
          </Dialog.Description>

          {isLoading ? (
            <div className="p-4 text-center">
              <Text>Processing transaction...</Text>
            </div>
          ) : (
            <Flex direction="column" gap="3">
              <div className="mb-3">
                <Text as="div" size="2" className="mb-4">
                  <span className="font-medium">Card ID:</span> {card.id.substring(0, 8)}...
                </Text>
                <Text as="div" size="2" className="mb-4">
                  <span className="font-medium">Current Status:</span> {card.isActive ? 'Active' : 'Inactive'}
                </Text>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="soft" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="solid" 
                  color={card.isActive ? "red" : "green"} 
                  disabled={isLoading}
                  onClick={handleToggleCardStatus}
                >
                  {card.isActive ? 'Deactivate Card' : 'Activate Card'}
                </Button>
              </div>
            </Flex>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

export default CardManagementForm
