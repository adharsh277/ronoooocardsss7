import { useCurrentAccount } from '@mysten/dapp-kit'
import { SuiTransactionBlockResponse } from '@mysten/sui/client'
import { SuiSignAndExecuteTransactionOutput } from '@mysten/wallet-standard'
import { Button, Flex, Text } from '@radix-ui/themes'
import useTransact from '@suiware/kit/useTransact'
import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import CustomConnectButton from '~~/components/CustomConnectButton'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '~~/config/network'
import { prepareCreateCardTransaction } from '~~/dapp/helpers/transactions'
import { transactionUrl } from '~~/helpers/network'
import { notification } from '~~/helpers/notification'
import useNetworkConfig from '~~/hooks/useNetworkConfig'

const CreateCardForm = () => {
  const currentAccount = useCurrentAccount()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const [notificationId, setNotificationId] = useState<string>()
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  const navigate = useNavigate()
  const [spendingLimit, setSpendingLimit] = useState<string>('100')

  const { transact: create } = useTransact({
    onBeforeStart: () => {
      const nId = notification.txLoading()
      setNotificationId(nId)
    },
    onSuccess: (
      data: SuiSignAndExecuteTransactionOutput,
      response: SuiTransactionBlockResponse
    ) => {
      notification.txSuccess(
        transactionUrl(explorerUrl, data.digest),
        notificationId
      )

      // Navigate to card details page if available
      const cardId = response.effects?.created?.[0]?.reference?.objectId
      if (cardId) {
        navigate(`/card/${cardId}`)
      }
    },
    onError: (e: Error) => {
      notification.txError(e, null, notificationId)
    },
    waitForTransactionOptions: {
      showEffects: true,
    },
  })

  const handleCreateCardSubmit = (e: FormEvent) => {
    e.preventDefault()

    if (!spendingLimit || parseInt(spendingLimit) <= 0) {
      notification.error(new Error('Please enter a valid spending limit'))
      return
    }

    create(prepareCreateCardTransaction(packageId, spendingLimit))
  }

  if (currentAccount == null) return <CustomConnectButton />

  return (
    <div className="my-2 flex flex-grow flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl font-bold text-gray-800">Create New Card</h2>
        <form onSubmit={handleCreateCardSubmit}>
          <Flex direction="column" gap="3">
            <div className="mb-3">
              <Text as="label" htmlFor="spending-limit" size="2" className="block mb-1 text-gray-700">
                Spending Limit
              </Text>
              <input
                id="spending-limit"
                type="number"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                value={spendingLimit}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSpendingLimit(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="solid" size="3">
              Create Card
            </Button>
          </Flex>
        </form>
      </div>
    </div>
  )
}

export default CreateCardForm
