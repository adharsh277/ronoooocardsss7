import { useCurrentAccount } from '@mysten/dapp-kit'
import { useCallback, useEffect, useState } from 'react'
import { Button, Flex, Heading, Text } from '@radix-ui/themes'
import CustomConnectButton from '~~/components/CustomConnectButton'
import DepositCardForm from './DepositCardForm'
import WithdrawForm from './WithdrawForm'
import TransferCardForm from './TransferCardForm'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
} from '~~/config/network'
import useNetworkConfig from '~~/hooks/useNetworkConfig'
import { useSuiClient } from '@mysten/dapp-kit'
import { notification } from '~~/helpers/notification'

// Define the card data interface
interface CardData {
  id: string;
  owner: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  isActive: boolean;
}

const CardList = () => {
  const currentAccount = useCurrentAccount()
  const client = useSuiClient()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const [cards, setCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshCounter, setRefreshCounter] = useState(0)
  
  // Helper function to refresh card data
  const handleRefresh = useCallback(() => {
    setRefreshCounter(prev => prev + 1)
  }, [])

  const fetchCards = useCallback(async () => {
    if (!currentAccount || !client) return

    // Debug logs
    console.log('Fetching cards with package ID:', packageId)
    client.getChainIdentifier().then(chainId => {
      console.log('Current network chain ID:', chainId)
    })
    console.log('Current wallet address:', currentAccount.address)
    console.log('App.tsx network setting:', 'TESTNET')

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
          
          // Log the complete object data to see its structure
          console.log('Card object data:', JSON.stringify(objectData, null, 2))
          
          const content = objectData.data?.content
          if (!content || content.dataType !== 'moveObject') return null
          
          // Inspect the content fields structure
          console.log('Card content fields:', content.fields)
          
          const fields = content.fields as any
          
          // Extract balance with proper SUI representation (divide by 10^9)
          let cardBalance = 0;
          try {
            // Based on the Move contract, balance is stored as a Balance<SUI> type
            // which is represented as an object with a value field in the JSON
            
            // First check standard structure (fields.balance.fields.value)
            if (fields.balance?.fields?.value) {
              cardBalance = Number(fields.balance.fields.value) / 1_000_000_000;
              console.log('Balance found at standard path:', cardBalance, 'SUI');
            } 
            // Try alternate structure (object with direct value)
            else if (fields.balance?.value) {
              cardBalance = Number(fields.balance.value) / 1_000_000_000;
              console.log('Balance found at alternate path:', cardBalance, 'SUI');
            }
            // Handle direct value in MIST (no object nesting)
            else if (typeof fields.balance === 'string' || typeof fields.balance === 'number') {
              cardBalance = Number(fields.balance) / 1_000_000_000;
              console.log('Balance found as direct value:', cardBalance, 'SUI');
            }
            // Last resort: search for any value field in the balance object 
            else if (typeof fields.balance === 'object') {
              // Log the balance object for debugging
              console.log('Complex balance object:', fields.balance);
              
              // Try to find any field that might contain the value
              const findValueInObject = (obj: any, depth = 0, maxDepth = 3): number | null => {
                if (depth > maxDepth) return null;
                if (!obj || typeof obj !== 'object') return null;
                
                // Check if this object has a value property
                if ('value' in obj && (typeof obj.value === 'string' || typeof obj.value === 'number')) {
                  return Number(obj.value);
                }
                
                // Recursively search in all object properties
                for (const key in obj) {
                  if (typeof obj[key] === 'object') {
                    const result = findValueInObject(obj[key], depth + 1, maxDepth);
                    if (result !== null) return result;
                  }
                }
                
                return null;
              };
              
              const valueFound = findValueInObject(fields.balance);
              if (valueFound !== null) {
                cardBalance = valueFound / 1_000_000_000;
                console.log('Balance found by deep search:', cardBalance, 'SUI');
              }
            }
          } catch (error) {
            console.error('Error parsing card balance:', error);
          }
          
          // Convert balance to SUI format (from MIST to SUI) for display
          console.log('Final card balance for display:', cardBalance, 'SUI');
          
          // IMPORTANT: Based on our investigation, we now understand that:
          // 1. Balance is stored in MIST (1 SUI = 10^9 MIST) and needs conversion to SUI
          // 2. spending_limit and amount_spent are stored directly in their original value (not converted to MIST)
          
          console.log('All fields from blockchain:', JSON.stringify(fields, null, 2));
          
          // Extract spending_limit - this should be the raw number as input by the user
          let spendingLimit = 0;
          if (fields.spending_limit !== undefined) {
            console.log('Found spending_limit:', fields.spending_limit);
            // Direct value - do NOT divide by 10^9
            spendingLimit = Number(fields.spending_limit);
          } else if (fields.spendingLimit !== undefined) {
            console.log('Found spendingLimit:', fields.spendingLimit);
            spendingLimit = Number(fields.spendingLimit);
          }
          
          // Extract amount_spent - same approach, should be a raw number
          let amountSpent = 0;
          if (fields.amount_spent !== undefined) {
            console.log('Found amount_spent:', fields.amount_spent);
            // Direct value - do NOT divide by 10^9
            amountSpent = Number(fields.amount_spent);
          } else if (fields.amountSpent !== undefined) {
            console.log('Found amountSpent:', fields.amountSpent);
            amountSpent = Number(fields.amountSpent);
          }
          
          // Log the values we extracted
          console.log('Raw extracted values:', { 
            cardBalance, 
            spendingLimit, 
            amountSpent 
          });
          
          // If the spending limit and amount spent appear to be stored in MIST
          // (could vary based on contract implementation), convert them to SUI
          // We'll determine this based on their magnitude - if they're very large numbers,
          // they're likely in MIST
          
          // Only very large values (> 1M) need conversion from MIST to SUI
          // Typical spending limits would be like 10, 100, 1000 SUI
          if (spendingLimit > 1_000_000) {
            spendingLimit = spendingLimit / 1_000_000_000;
            console.log('Converted spending limit from MIST to SUI:', spendingLimit);
          }
          
          if (amountSpent > 1_000_000) {
            amountSpent = amountSpent / 1_000_000_000;
            console.log('Converted amount spent from MIST to SUI:', amountSpent);
          }
          
          // Log final values after all processing
          console.log('Final processed values:', {
            balance: cardBalance,
            spendingLimit: spendingLimit, 
            amountSpent: amountSpent
          });
          
          return {
            id: item.data.objectId,
            owner: currentAccount.address,
            balance: cardBalance,
            spendingLimit: spendingLimit,
            amountSpent: amountSpent,
            isActive: Boolean(fields.is_active || false)
          }
        } catch (error) {
          console.error('Error fetching card details:', error)
          return null
        }
      }))
      
      // Filter out null values and set the cards
      setCards(fetchedCards.filter(Boolean) as CardData[])
    } catch (error) {
      console.error('Error fetching cards:', error)
      notification.error(new Error('Failed to fetch cards. Please try again.'))
    } finally {
      setLoading(false)
    }
  }, [client, currentAccount, packageId])

  useEffect(() => {
    if (currentAccount) {
      fetchCards()
    }
  }, [currentAccount, fetchCards, refreshCounter])

  if (!currentAccount) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
        <Heading size="4" className="mb-3 text-gray-800">Your Cards</Heading>
        <Text className="mb-4 text-gray-600">Connect your wallet to view your cards.</Text>
        <CustomConnectButton />
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
      <div className="mb-4 flex items-center justify-between">
        <Heading size="4" className="text-gray-800">Your Cards</Heading>
        <Button 
          variant="soft" 
          color="blue"
          size="2"
          onClick={() => setRefreshCounter(prev => prev + 1)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="p-4 text-center">
          <Text className="text-gray-600">Loading your cards...</Text>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-lg bg-blue-50 p-4 text-center">
          <Text className="text-blue-600">You don't have any cards yet. Create one to get started!</Text>
        </div>
      ) : (
        <Flex direction="column" gap="3">
          {cards.map((card) => (
            <div key={card.id} className="rounded-lg border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="mb-4 flex items-center justify-between">
                <Heading size="3" className="text-blue-600">
                  Card {card.id.substring(0, 6)}...{card.id.substring(62)}
                </Heading>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${card.isActive ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>
                  {card.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Text size="1" className="text-gray-600 mb-1">Balance</Text>
                  <Text className="font-medium text-blue-600 text-lg">
                    {card.balance > 0 ? card.balance.toFixed(4) : '0.0000'} SUI
                  </Text>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Text size="1" className="text-gray-600 mb-1">Spending Limit</Text>
                  <Text className="font-medium text-gray-800 text-lg">
                    {card.spendingLimit > 0 ? card.spendingLimit.toFixed(2) : '0.00'} SUI
                  </Text>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Text size="1" className="text-gray-600 mb-1">Amount Spent</Text>
                  <Text className="font-medium text-gray-800 text-lg">
                    {card.amountSpent > 0 ? card.amountSpent.toFixed(4) : '0.0000'} SUI
                  </Text>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Text size="1" className="text-gray-600 mb-1">Available to Spend</Text>
                  <Text className="font-medium text-gray-800 text-lg">
                    {Math.max(0, card.spendingLimit - card.amountSpent) > 0 ? 
                      Math.max(0, card.spendingLimit - card.amountSpent).toFixed(2) : '0.00'} SUI
                  </Text>
                </div>
                
                <div className="col-span-2 mt-4 flex flex-wrap gap-3">
                  <DepositCardForm
                    card={card}
                    onSuccess={handleRefresh}
                  />
                  <WithdrawForm 
                    card={card}
                    onSuccess={handleRefresh}
                  />
                  {/* <SpendCardForm
                    card={card}
                    onSuccess={handleRefresh}
                  /> */}
                  <TransferCardForm
                    card={card}
                    onSuccess={handleRefresh}
                  />
                </div>
              </div>
            </div>
          ))}
        </Flex>
      )}
    </div>
  )
}

export default CardList
