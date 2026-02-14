import React, { useCallback, useEffect, useState, FormEvent } from 'react'
import { Container, Flex, Text, Heading, Box, Select, Button } from '@radix-ui/themes'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import useTransact from '@suiware/kit/useTransact'
import { ArrowRight, Loader2, CreditCard } from 'lucide-react'
import Header from '../components/Header'
import { CONTRACT_PACKAGE_VARIABLE_NAME, EXPLORER_URL_VARIABLE_NAME } from '~~/config/network'
import useNetworkConfig from '~~/hooks/useNetworkConfig'
import { notification } from '~~/helpers/notification'
import { prepareDirectTransferTransaction } from '~~/dapp/helpers/transactions'
import { transactionUrl } from '~~/helpers/network'
import CustomConnectButton from '~~/components/CustomConnectButton'

// Define the card data interface
interface CardData {
  id: string;
  owner: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  isActive: boolean;
}

export default function SpendPage() {
  const currentAccount = useCurrentAccount()
  const client = useSuiClient()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  
  const [cards, setCards] = useState<CardData[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string>('')
  const [recipientAddress, setRecipientAddress] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('0.01')
  const [addressError, setAddressError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [refreshCounter, setRefreshCounter] = useState(0)
  const [notificationId, setNotificationId] = useState<string>()
  
  // Helper function to refresh card data
  const handleRefresh = useCallback(() => {
    setRefreshCounter(prev => prev + 1)
  }, [])

  // Create a transaction subscription
  const { transact: transfer } = useTransact({
    onBeforeStart: () => {
      const nId = notification.txLoading()
      setNotificationId(nId)
      setLoading(true)
    },
    onSuccess: (
      data,
      _response
    ) => {
      notification.txSuccess(
        transactionUrl(explorerUrl, data.digest),
        notificationId
      )
      
      setLoading(false)
      setRecipientAddress('')
      setTransferAmount('0.01')
      
      // Wait for 2 seconds to allow blockchain state to update, then refresh
      setTimeout(() => {
        handleRefresh()
      }, 2000)
    },
    onError: (e: Error) => {
      notification.txError(e, null, notificationId)
      setLoading(false)
    },
    waitForTransactionOptions: {
      showEffects: true,
    },
  })

  // Fetch the user's cards
  const fetchCards = useCallback(async () => {
    if (!currentAccount || !client) return

    setLoading(true)
    try {
      // Query for owned objects of type Card
      const { data } = await client.getOwnedObjects({
        owner: currentAccount.address,
        filter: {
          StructType: `${packageId}::card::Card`
        },
        options: {
          showContent: true,
          showDisplay: true,
        }
      })

      // Map the response to CardData objects
      const fetchedCards = await Promise.all(data.map(async (item) => {
        try {
          if (!item.data?.objectId) return null
          
          // Fetch object details to get the complete card information
          const objectData = await client.getObject({
            id: item.data.objectId,
            options: {
              showContent: true,
              showDisplay: true,
              showOwner: true,
            }
          })
          
          const content = objectData.data?.content
          if (!content || content.dataType !== 'moveObject') return null
          
          const fields = content.fields as any
          
          // Extract balance with proper SUI representation (divide by 10^9)
          let cardBalance = 0;
          if (fields.balance?.fields?.value) {
            cardBalance = Number(fields.balance.fields.value) / 1_000_000_000;
          } else if (fields.balance?.value) {
            cardBalance = Number(fields.balance.value) / 1_000_000_000;
          }
          
          // Extract spending limit and amount spent
          const spendingLimit = Number(fields.spending_limit) / 1_000_000_000;
          const amountSpent = Number(fields.amount_spent) / 1_000_000_000;
          const isActive = fields.is_active === true;
          
          // Return the formatted card data
          return {
            id: item.data.objectId,
            owner: currentAccount.address,
            balance: cardBalance,
            spendingLimit,
            amountSpent,
            isActive
          };
        } catch (err) {
          console.error('Error processing card:', err);
          return null;
        }
      }))
      
      // Filter out any null values and sort by balance
      const validCards = fetchedCards.filter(card => card !== null) as CardData[];
      validCards.sort((a, b) => b.balance - a.balance);
      
      setCards(validCards);
      
      // Auto-select the first card if available and none is selected
      if (validCards.length > 0 && !selectedCardId) {
        setSelectedCardId(validCards[0].id);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
      notification.error(new Error('Failed to fetch your cards. Please try again later.'));
    } finally {
      setLoading(false);
    }
  }, [client, currentAccount, packageId, selectedCardId])

  // Validate Sui address format
  const validateSuiAddress = (address: string): boolean => {
    // Basic validation: Sui addresses start with '0x' and are 66 characters long (including 0x)
    return /^0x[a-fA-F0-9]{64}$/.test(address);
  }

  // Handle form submission for transfers
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAddressError('')

    // Ensure a card is selected
    if (!selectedCardId) {
      notification.error(new Error('Please select a card to transfer from'))
      return
    }

    const selectedCard = cards.find(card => card.id === selectedCardId)
    if (!selectedCard) {
      notification.error(new Error('Selected card not found'))
      return
    }

    // Validate amount
    if (!transferAmount || Number(transferAmount) <= 0) {
      notification.error(new Error('Please enter a valid amount to transfer'))
      return
    }
    
    const transferAmountNum = Number(transferAmount)
    
    // Check against card balance
    if (transferAmountNum > selectedCard.balance) {
      notification.error(new Error(`Amount exceeds your card balance of ${selectedCard.balance.toFixed(2)} SUI`))
      return
    }

    // Validate recipient address
    if (!recipientAddress || !validateSuiAddress(recipientAddress)) {
      setAddressError('Please enter a valid Sui address')
      return
    }

    // Use the direct transfer function to transfer funds
    transfer(prepareDirectTransferTransaction(packageId, selectedCardId, transferAmount, recipientAddress))
  }

  useEffect(() => {
    if (currentAccount) {
      fetchCards()
    }
  }, [currentAccount, fetchCards, refreshCounter])

  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <Container size="3" className="py-8">
          <div className="mt-24"> 
            <Flex direction="column" align="center" justify="center" className="p-8 bg-gray-800 rounded-xl text-center">
              <Text size="6" weight="bold" className="text-white mb-4">Card Transfer</Text>
              <Text className="text-gray-300 mb-6">
                Connect your wallet to transfer funds from your cards.
              </Text>
              <CustomConnectButton />
            </Flex>
          </div>
        </Container>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <Container size="3" className="py-8">
        <div className="mt-12"> 
          <Flex direction="column" className="p-8 bg-gray-800 rounded-xl">
            <Heading size="5" className="text-white mb-6">Card Transfer</Heading>
            
            <form onSubmit={handleSubmit}>
              {/* Card Selection */}
              <Box className="mb-6">
                <Text as="label" size="2" className="block mb-2 text-white/80">
                  Select Card
                </Text>
                {loading && cards.length === 0 ? (
                  <Text className="text-white/60 italic">Loading your cards...</Text>
                ) : cards.length === 0 ? (
                  <Text className="text-white/60 italic">You don't have any cards. Create one first.</Text>
                ) : (
                  <Select.Root 
                    value={selectedCardId} 
                    onValueChange={setSelectedCardId}
                    size="3"
                  >
                    <Select.Trigger 
                      className="w-full bg-gray-700 border-gray-600 text-white" 
                      placeholder="Select a card"
                    />
                    <Select.Content>
                      {cards.map(card => (
                        <Select.Item key={card.id} value={card.id}>
                          <Flex align="center" gap="2">
                            <CreditCard size={16} />
                            <span className="truncate">
                              Card {card.id.substring(0, 6)}...{card.id.substring(62)}
                            </span>
                            <span className="ml-2 text-blue-400">
                              {card.balance.toFixed(4)} SUI
                            </span>
                          </Flex>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                )}
              </Box>
              
              {/* Selected Card Details */}
              {selectedCardId && (
                <Box className="mb-6 p-4 rounded-lg bg-gray-700/50 border border-gray-600">
                  {(() => {
                    const card = cards.find(c => c.id === selectedCardId);
                    if (!card) return null;
                    
                    return (
                      <Flex direction="column" gap="2">
                        <Flex justify="between">
                          <Text size="2" className="text-gray-300">Card Balance:</Text>
                          <Text size="2" className="text-white font-medium">{card.balance.toFixed(4)} SUI</Text>
                        </Flex>
                        <Flex justify="between">
                          <Text size="2" className="text-gray-300">Spending Limit:</Text>
                          <Text size="2" className="text-white font-medium">{card.spendingLimit.toFixed(4)} SUI</Text>
                        </Flex>
                        <Flex justify="between">
                          <Text size="2" className="text-gray-300">Status:</Text>
                          <Text size="2" className={card.isActive ? 'text-green-400' : 'text-red-400'}>
                            {card.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </Flex>
                      </Flex>
                    );
                  })()}
                </Box>
              )}
              
              {/* Recipient Address */}
              <Box className="mb-6">
                <Text as="label" htmlFor="recipient" size="2" className="block mb-2 text-white/80">
                  Recipient Address
                </Text>
                <input
                  id="recipient"
                  type="text"
                  placeholder="0x..."
                  value={recipientAddress}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setRecipientAddress(e.target.value);
                    setAddressError('');
                  }}
                  className={`w-full rounded-xl border ${addressError ? 'border-red-500' : 'border-gray-600'} bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none`}
                />
                {addressError && (
                  <Text size="1" className="mt-1 text-red-400">{addressError}</Text>
                )}
              </Box>
              
              {/* Transfer Amount */}
              <Box className="mb-6">
                <Text as="label" htmlFor="amount" size="2" className="block mb-2 text-white/80">
                  Transfer Amount (SUI)
                </Text>
                <Flex gap="2" align="center">
                  <div className="w-full">
                    <input
                      id="amount"
                      type="number"
                      placeholder="0.01"
                      value={transferAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTransferAmount(e.target.value)}
                      min="0.001"
                      step="0.001"
                      className="w-full rounded-xl border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <Box className="text-white/70 whitespace-nowrap">
                    SUI
                  </Box>
                </Flex>
                <Text size="1" className="mt-1 text-blue-300">
                  For testing, transfers are limited to 0.001-0.2 SUI
                </Text>
              </Box>
              
              {/* Submit Button */}
              <Box className="mt-8">
                <Button 
                  type="submit" 
                  disabled={loading || !selectedCardId || cards.length === 0}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-xl"
                >
                  {loading ? (
                    <Flex align="center" gap="2">
                      <Loader2 size={16} className="animate-spin" />
                      Processing...
                    </Flex>
                  ) : (
                    <Flex align="center" gap="2" justify="center">
                      Transfer Funds <ArrowRight size={16} />
                    </Flex>
                  )}
                </Button>
              </Box>
            </form>
          </Flex>
        </div>
      </Container>
    </div>
  )
}
