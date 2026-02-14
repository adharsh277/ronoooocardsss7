import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { Button, Dialog, Flex, Text } from '@radix-ui/themes'
import { useCallback, useState } from 'react'
import { type EventId } from '@mysten/sui/client'
import { CONTRACT_PACKAGE_VARIABLE_NAME } from '~~/config/network'
// Custom formatDistance function instead of using date-fns
function formatDistance(date: Date, baseDate: Date, options?: { addSuffix: boolean }): string {
  const diffMs = baseDate.getTime() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffMonth = Math.round(diffDay / 30);
  const diffYear = Math.round(diffDay / 365);

  let result = '';
  if (diffSec < 60) result = `${diffSec} seconds`;
  else if (diffMin < 60) result = `${diffMin} minutes`;
  else if (diffHour < 24) result = `${diffHour} hours`;
  else if (diffDay < 30) result = `${diffDay} days`;
  else if (diffMonth < 12) result = `${diffMonth} months`;
  else result = `${diffYear} years`;

  if (options?.addSuffix) {
    result = `${result} ago`;
  }

  return result;
}
import useNetworkConfig from '~~/hooks/useNetworkConfig'

interface CardData {
  id: string;
  owner: string;
  balance: number;
  spendingLimit: number;
  amountSpent: number;
  isActive: boolean;
}

interface TransactionHistoryProps {
  card: CardData;
}

interface TransactionEvent {
  type: 'deposit' | 'spend' | 'withdraw' | 'create' | 'update' | 'activate' | 'deactivate';
  amount?: number;
  timestamp: number;
  txDigest: string;
}

const TransactionHistory = ({ card }: TransactionHistoryProps) => {
  const currentAccount = useCurrentAccount()
  const suiClient = useSuiClient()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [transactions, setTransactions] = useState<TransactionEvent[]>([])
  const [cursor, setCursor] = useState<EventId | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const fetchTransactionHistory = useCallback(async () => {
    if (!currentAccount || !card.id) return
    
    setIsLoading(true)
    
    try {
      // Query for events related to this card
      
      // Query for events related to this card
      const response = await suiClient.queryEvents({
        query: {
          MoveEventModule: {
            package: packageId,
            module: 'card'
          }
        },
        cursor,
        limit: 20
      })
      
      // Process events
      const newTransactions = response.data
        .filter(event => {
          // Filter to only include events for this specific card
          const parsedJson = JSON.parse(event.parsedJson as string)
          return parsedJson.card_id === card.id
        })
        .map(event => {
          const parsedJson = JSON.parse(event.parsedJson as string)
          const eventType = event.type
          
          let type: TransactionEvent['type'] = 'create' // Default
          let amount = 0
          
          // Determine transaction type from event type
          if (eventType.includes('DepositEvent')) {
            type = 'deposit'
            amount = Number(parsedJson.amount || 0)
          } else if (eventType.includes('SpendEvent')) {
            type = 'spend'
            amount = Number(parsedJson.amount || 0)
          } else if (eventType.includes('WithdrawEvent')) {
            type = 'withdraw'
            amount = Number(parsedJson.amount || 0)
          } else if (eventType.includes('DeactivateCardEvent')) {
            type = 'deactivate'
          } else if (eventType.includes('ReactivateCardEvent')) {
            type = 'activate'
          } else if (eventType.includes('UpdateSpendingLimitEvent')) {
            type = 'update'
            amount = Number(parsedJson.new_limit || 0)
          }
          
          return {
            type,
            amount: amount / 1_000_000_000, // Convert from MIST to SUI
            timestamp: Number(event.timestampMs),
            txDigest: event.id.txDigest
          }
        })
      
      // Update state
      setTransactions(prev => [...prev, ...newTransactions])
      if (response.nextCursor) {
        setCursor(response.nextCursor)
      }
      setHasMore(response.hasNextPage)
    } catch (error) {
      console.error('Error fetching transaction history:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentAccount, card.id, packageId, suiClient, cursor])

  const handleOpenDialog = async () => {
    setIsOpen(true)
    
    // Reset state when opening dialog
    setTransactions([])
    setCursor(null)
    setHasMore(false)
    
    // Fetch transactions
    await fetchTransactionHistory()
  }
  
  const handleLoadMore = async () => {
    await fetchTransactionHistory()
  }

  // Helper function to get appropriate icon and text for transaction type
  const getTransactionDetails = (type: TransactionEvent['type'], amount?: number) => {
    switch (type) {
      case 'deposit':
        return {
          icon: '⬆️',
          label: 'Deposit',
          description: `Added ${amount?.toFixed(2)} SUI to card`,
          color: 'text-green-600'
        }
      case 'spend':
        return {
          icon: '💳',
          label: 'Spend',
          description: `Spent ${amount?.toFixed(2)} SUI from card`,
          color: 'text-amber-600'
        }
      case 'withdraw':
        return {
          icon: '⬇️',
          label: 'Withdraw',
          description: `Withdrew ${amount?.toFixed(2)} SUI from card`,
          color: 'text-blue-600'
        }
      case 'create':
        return {
          icon: '🆕',
          label: 'Create',
          description: 'Card created',
          color: 'text-indigo-600'
        }
      case 'update':
        return {
          icon: '✏️',
          label: 'Update',
          description: `Spending limit updated to ${amount?.toFixed(2)} SUI`,
          color: 'text-purple-600'
        }
      case 'activate':
        return {
          icon: '✅',
          label: 'Activate',
          description: 'Card activated',
          color: 'text-green-600'
        }
      case 'deactivate':
        return {
          icon: '❌',
          label: 'Deactivate',
          description: 'Card deactivated',
          color: 'text-red-600'
        }
      default:
        return {
          icon: '❓',
          label: 'Unknown',
          description: 'Unknown transaction',
          color: 'text-gray-600'
        }
    }
  }

  if (!currentAccount) return null

  return (
    <>
      <Button
        color="gray"
        variant="soft"
        size="2"
        onClick={handleOpenDialog}
      >
        History
      </Button>

      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Content className="max-w-xl">
          <Dialog.Title>Transaction History</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            Recent transactions for this card
          </Dialog.Description>

          {transactions.length === 0 && !isLoading ? (
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <Text className="text-gray-800">
                No transactions found for this card.
              </Text>
            </div>
          ) : (
            <Flex direction="column" gap="3">
              <div className="max-h-[400px] overflow-y-auto">
                {transactions.map((tx, index) => {
                  const { icon, label, description, color } = getTransactionDetails(tx.type, tx.amount)
                  const date = new Date(tx.timestamp)
                  const timeAgo = formatDistance(date, new Date(), { addSuffix: true })
                  
                  return (
                    <div 
                      key={`${tx.txDigest}-${index}`}
                      className="flex items-start p-3 border-b border-gray-200 last:border-b-0"
                    >
                      <div className="mr-3 text-xl">{icon}</div>
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <Text weight="medium" className={color}>{label}</Text>
                          <Text size="1" className="text-gray-500">{timeAgo}</Text>
                        </div>
                        <Text size="2">{description}</Text>
                        <Text size="1" className="text-gray-500 mt-1 truncate">
                          TX: {tx.txDigest.substring(0, 8)}...
                        </Text>
                      </div>
                    </div>
                  )
                })}
                
                {isLoading && (
                  <div className="p-4 text-center">
                    <Text className="text-gray-500">Loading transactions...</Text>
                  </div>
                )}
              </div>
              
              {hasMore && (
                <div className="text-center mt-2">
                  <Button 
                    size="2" 
                    variant="soft" 
                    onClick={handleLoadMore}
                    disabled={isLoading}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </Flex>
          )}
          
          <div className="flex justify-end mt-4">
            <Button type="button" variant="soft" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}

export default TransactionHistory
