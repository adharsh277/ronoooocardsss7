import React, { useState, useEffect, useCallback } from 'react'
import { Container, Box, Flex, Heading, Text, Button, Separator } from '@radix-ui/themes'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useSuiClient } from '@mysten/dapp-kit'
import { RefreshCw, Clock, ArrowUp, ArrowDown, CreditCard, Shield } from 'lucide-react'
import Header from '../components/Header'
import { CONTRACT_PACKAGE_VARIABLE_NAME, EXPLORER_URL_VARIABLE_NAME } from '~~/config/network'
import { useCards } from '../hooks/useCards'
import useNetworkConfig from '~~/hooks/useNetworkConfig'
import NetworkSupportChecker from '~~/components/NetworkSupportChecker'
import CustomConnectButton from '~~/components/CustomConnectButton'

// Define transaction types to match the Sui events
type EventType = 'deposit' | 'withdraw' | 'spend' | 'transfer' | 'create';

// Define the transaction interface
interface Transaction {
  id: string;
  type: EventType;
  cardId: string;
  timestamp: string;
  amount: string;
  digest: string;
}

// Define stats for cards
interface CardStats {
  id: string;
  transactions: number;
  spent: number;
  balance: number;
}

// Helper function to parse event type
const parseEventType = (eventType: string): EventType => {
  const eventName = eventType.split('::').pop()?.toLowerCase() || '';
  if (eventName.includes('deposit')) return 'deposit';
  if (eventName.includes('withdraw')) return 'withdraw';
  if (eventName.includes('spend')) return 'spend';
  if (eventName.includes('directtransfer')) return 'transfer';
  if (eventName.includes('cardcreated')) return 'create';
  return 'create'; // Default fallback
}

const IndexPage = () => {
  // Wallet connection state
  const currentAccount = useCurrentAccount()
  
  // Network and data hooks
  const client = useSuiClient()
  const { cards, loading: cardsLoading, refreshCards } = useCards()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  
  // Dashboard state
  const [loading, setLoading] = useState(false)
  const [totalBalance, setTotalBalance] = useState('0.00')
  const [totalSpent, setTotalSpent] = useState('0.00')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  // Used for internal tracking but not displayed in UI
  // Using underscore prefix to indicate intentionally unused variables
  const [_cardStats, _setCardStats] = useState<CardStats[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return `${date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }
  
  // Get transaction icon based on type
  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'deposit':
        return <ArrowDown className="text-blue-600" />
      case 'withdraw':
        return <ArrowUp className="text-blue-600" />
      case 'spend':
        return <CreditCard className="text-blue-600" />
      case 'transfer':
        return <ArrowUp className="text-blue-600" />
      case 'create':
        return <CreditCard className="text-blue-600" />
      default:
        return <Clock className="text-gray-500" />
    }
  }
  
  // Handle refresh click
  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
    refreshCards()
  }, [refreshCards])
  
  // Fetch transaction data from blockchain
  const fetchTransactionData = useCallback(async () => {
    if (!currentAccount || !packageId || !client || cards.length === 0) return
    
    setLoading(true)
    
    try {
      const eventTypes = [
        `${packageId}::card::Deposit`,
        `${packageId}::card::Withdraw`,
        `${packageId}::card::Spend`,
        `${packageId}::card::DirectTransfer`,
        `${packageId}::card::CardCreated`
      ]
      
      // Create stats map for all cards
      const stats = cards.map(card => ({
        id: card.id,
        transactions: 0,
        spent: 0,
        balance: Number(card.balance)
      }))
      
      // Overall totals
      let totalBalanceAmount = 0
      let totalSpentAmount = 0
      
      // Process each card balance
      stats.forEach(stat => {
        totalBalanceAmount += stat.balance
      })
      
      // Prepare to store all transactions
      const allTransactions: Transaction[] = []
      
      // Fetch events for each event type
      const eventPromises = eventTypes.map(async (eventType) => {
        const events = await client.queryEvents({
          query: { MoveEventType: eventType }
        })
        
        return { type: eventType, events: events.data }
      })
      
      const results = await Promise.all(eventPromises)
      
      // Process all events
      results.forEach(result => {
        const { type, events } = result
        
        events.forEach(event => {
          try {
            const parsedJson = event.parsedJson as any
            const eventType = parseEventType(type)
            let cardId = parsedJson.card_id || ''
            
            // Create transaction object
            const transaction: Transaction = {
              id: event.id.txDigest + event.id.eventSeq,
              type: eventType,
              cardId: cardId,
              timestamp: event.timestampMs || new Date().toISOString(),
              amount: parsedJson.amount ? (Number(parsedJson.amount) / 1000000000).toFixed(4) : '0',
              digest: event.id.txDigest
            }
            
            // Update stats if this is a card event
            if (cardId) {
              const cardIndex = stats.findIndex(s => s.id === cardId)
              if (cardIndex !== -1) {
                // Increment transaction count
                stats[cardIndex].transactions += 1
                
                // Update spent amount for withdrawals and spending
                if (eventType === 'withdraw' || eventType === 'spend') {
                  const amount = Number(transaction.amount)
                  stats[cardIndex].spent += amount
                  totalSpentAmount += amount
                }
              }
            }
            
            // Add transaction to the list
            allTransactions.push(transaction)
          } catch (error) {
            console.error('Error processing event:', error)
          }
        })
      })
      
      // Sort transactions by timestamp (newest first)
      allTransactions.sort((a, b) => {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })
      
      // Update state
      setTransactions(allTransactions)
      _setCardStats(stats)
      
      // Convert balance from MIST to SUI (1 SUI = 10^9 MIST)
      const totalBalanceSui = totalBalanceAmount / 1_000_000_000
      setTotalBalance(totalBalanceSui.toFixed(4))
      setTotalSpent(totalSpentAmount.toFixed(4))
    } catch (error) {
      console.error('Error fetching transaction data:', error)
    } finally {
      setLoading(false)
    }
  }, [client, currentAccount, packageId, cards])
  
  // Fetch data when connected and cards are loaded
  useEffect(() => {
    if (currentAccount && packageId && cards.length > 0 && !cardsLoading) {
      fetchTransactionData()
    }
  }, [currentAccount, packageId, cards, cardsLoading, fetchTransactionData, refreshKey])
  
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {!currentAccount ? (
        <Container>
          <div className="pt-32 pb-20">
            {/* Hero Section */}
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-5xl font-bold text-gray-800 mb-6">
                Smart Cards on the <span className="text-blue-600">Sui</span> Blockchain
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Create, manage, and use digital cards with programmable money on the Sui blockchain. Fast, secure, and simple.
              </p>
              
              <div className="flex justify-center gap-4 mb-12">
                <CustomConnectButton />
                <a 
                  href="#features" 
                  className="px-6 py-3 rounded-lg border border-blue-200 text-blue-600 font-medium hover:bg-blue-50 transition-colors duration-200"
                >
                  Learn More
                </a>
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="text-3xl font-bold text-gray-800 mb-2">Fast & Secure</div>
                  <p className="text-gray-600">Built on Sui's high-performance blockchain</p>
                </div>
                <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="text-3xl font-bold text-gray-800 mb-2">Programmable</div>
                  <p className="text-gray-600">Customize how your cards work and interact</p>
                </div>
                <div className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="text-3xl font-bold text-gray-800 mb-2">Private</div>
                  <p className="text-gray-600">You control your funds and data</p>
                </div>
              </div>
            </div>
            
            {/* Features Section */}
            <div id="features" className="mt-24">
              <div className="mb-12 text-center">
                <Heading size="7" className="text-gray-800 mb-4">Key Features</Heading>
                <Text className="text-gray-600 max-w-2xl mx-auto">
                  Sui Cards offers a range of features to help you manage your digital finances with ease and security.
                </Text>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                <FeatureCard 
                  icon={<CreditCard className="text-blue-600" size={32} />}
                  title="Digital Smart Cards"
                  description="Create virtual cards that function as programmable mini-wallets with custom settings."
                />
                
                <FeatureCard 
                  icon={<Shield className="text-blue-600" size={32} />}
                  title="Enhanced Security"
                  description="Virtual cards act as sub-wallets with spending limits, protecting your main funds from potential risks."
                />
                
                <FeatureCard 
                  icon={<Clock className="text-blue-600" size={32} />}
                  title="Transaction History"
                  description="View detailed transaction history showing all card activity with timestamps and amounts."
                />
              </div>
            </div>
          </div>
        </Container>
      ) : (
        <Container>
          <Box pt="9" pb="8">
            <NetworkSupportChecker />
            
            {/* Dashboard Header */}
            <Flex justify="between" align="center" mb="6">
              <Heading size="7" color="gray">Dashboard</Heading>
              <Button 
                onClick={handleRefresh} 
                variant="soft" 
                color="blue" 
                disabled={loading || cardsLoading}
              >
                <RefreshCw size={16} />
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
            </Flex>
            
            {/* Stats Overview */}
            <Flex gap="4" direction={{ initial: 'column', sm: 'row' }} mb="6">
              <Box className="bg-white border border-gray-100 rounded-lg shadow-sm flex-1 p-4">
                <Text size="2" color="gray" weight="medium" mb="1">Total Balance</Text>
                <Heading color="blue" size="6">{totalBalance} SUI</Heading>
              </Box>
              <Box className="bg-white border border-gray-100 rounded-lg shadow-sm flex-1 p-4">
                <Text size="2" color="gray" weight="medium" mb="1">Total Spent</Text>
                <Heading color="gray" size="6">{totalSpent} SUI</Heading>
              </Box>
              <Box className="bg-white border border-gray-100 rounded-lg shadow-sm flex-1 p-4">
                <Text size="2" color="gray" weight="medium" mb="1">Active Cards</Text>
                <Heading color="gray" size="6">{cards.length}</Heading>
              </Box>
            </Flex>
            
            {/* Transaction History */}
            <Box className="mb-8">
              <Flex justify="between" align="center" mb="4">
                <Heading size="4" color="gray">Recent Transactions</Heading>
                <Button 
                  variant="ghost" 
                  color="blue" 
                  asChild
                >
                  <a href="/history">View All</a>
                </Button>
              </Flex>
              
              <Separator size="4" mb="4" color="gray" />
              
              <div className="flex flex-col gap-3">
                {transactions.length > 0 ? (
                  transactions.slice(0, 5).map((transaction) => {
                    // Find card index (used to display card number)
                    const cardPositionIndex = cards.findIndex(c => c.id === transaction.cardId);
                    const prefix = transaction.type === 'deposit' ? '+' : 
                                 (transaction.type === 'withdraw' || transaction.type === 'spend' || transaction.type === 'transfer') ? '-' : '';
                    
                    return (
                      <Box key={transaction.id} className="p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                        <Flex justify="between" align="center">
                          <Flex gap="3" align="center">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              {getTransactionIcon(transaction.type)}
                            </div>
                            <Flex direction="column">
                              <Text className="text-gray-800 font-medium">
                                {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                              </Text>
                              <Text size="2" color="gray">
                                {transaction.cardId ? `Card #${cardPositionIndex !== -1 ? cardPositionIndex + 1 : '?'}` : 'No card'}
                              </Text>
                            </Flex>
                          </Flex>
                          <Flex direction="column" align="end">
                            <Text className={`font-medium ${transaction.type === 'deposit' ? 'text-blue-600' : 'text-gray-800'}`}>
                              {prefix}{transaction.amount} SUI
                            </Text>
                            <Text size="2" color="gray">
                              {formatDate(transaction.timestamp)}
                            </Text>
                            <a
                              href={`${explorerUrl}/txblock/${transaction.digest}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 text-xs hover:underline flex items-center gap-1 mt-1"
                            >
                              View on explorer
                            </a>
                          </Flex>
                        </Flex>
                      </Box>
                    );
                  })
                ) : (
                  <Text className="text-gray-500 text-center py-8">No transactions found</Text>
                )}
              </div>
            </Box>
          </Box>
        </Container>
      )}
    </div>
  )
}

// Helper components
const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <Box className="p-6 bg-white rounded-xl border border-gray-100 shadow-sm">
    <div className="p-3 bg-blue-50 rounded-lg w-fit mb-4">
      {icon}
    </div>
    <Heading size="4" className="text-gray-800 mb-2">{title}</Heading>
    <Text className="text-gray-600">{description}</Text>
  </Box>
)

export default IndexPage
