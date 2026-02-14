import React from 'react';
import { Container, Box, Flex, Text, Button, Separator, Link } from '@radix-ui/themes';
import { useSuiClient } from '@mysten/dapp-kit';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useCards } from '../hooks/useCards';
import useNetworkConfig from '~~/hooks/useNetworkConfig';
import { ArrowUp, ArrowDown, CreditCard, RefreshCw, ExternalLink } from 'lucide-react';
import Header from '../components/Header';

// Define transaction types to match the Sui events
type EventType = 'deposit' | 'withdraw' | 'spend' | 'transfer' | 'create';
type FilterType = EventType | 'all';

// Define the transaction interface
interface Transaction {
  id: string;
  type: EventType;
  cardId: string;
  timestamp: number;
  amount: string;
  digest: string;
}

const HistoryPage: React.FC = () => {
  const client = useSuiClient();
  const currentAccount = useCurrentAccount();
  const networkConfig = useNetworkConfig();
  const packageId = networkConfig.networkConfig.localnet.variables.contractPackageId;
  const explorerUrl = networkConfig.networkConfig.localnet.variables.explorerUrl;
  const { cards } = useCards();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filterType, setFilterType] = React.useState<FilterType>('all');

  // Helper function to format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const month = date.toLocaleString('default', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    return `${month} ${day}, ${year} at ${time}`;
  };

  // Helper function to get icon for transaction type
  const getTransactionIcon = (type: EventType) => {
    switch (type) {
      case 'deposit': return <ArrowDown className="text-green-400" />;
      case 'withdraw': return <ArrowUp className="text-red-400" />;
      case 'spend': return <CreditCard className="text-yellow-400" />;
      case 'transfer': return <ArrowUp className="text-blue-400" />;
      case 'create': return <CreditCard className="text-purple-400" />;
      default: return <CreditCard className="text-gray-400" />;
    }
  };

  // Fetch transaction data from Sui
  const fetchTransactionData = React.useCallback(async () => {
    if (!client || !currentAccount || !packageId) {
      console.log('Missing prerequisites:', { client: !!client, currentAccount: !!currentAccount, packageId });
      return;
    }
    
    console.log('Fetching transaction data for account:', currentAccount.address);
    console.log('Using package ID:', packageId);
    
    setLoading(true);
    try {
      // Get all events for the package
      const eventsResponse = await client.queryEvents({
        query: { MoveEventModule: { package: packageId, module: 'smart_card' }}
      });
      
      console.log('Events response:', eventsResponse.data.length, 'events found');
      if (eventsResponse.data.length > 0) {
        console.log('Sample event types:', eventsResponse.data.slice(0, 3).map(e => e.type));
      }
      
      // Process the events
      const txEvents = eventsResponse.data
        .map(event => {
          try {
            const parsedJson = typeof event.parsedJson === 'string' 
              ? JSON.parse(event.parsedJson) 
              : event.parsedJson;
            
            // Only include events for the current wallet
            if (parsedJson.user !== currentAccount.address) {
              return null;
            }
            
            // Parse event type
            const eventType = parseEventType(event.type);
            
            // Extract amount if available
            let amount = '0';
            if ('amount' in parsedJson) {
              amount = parsedJson.amount;
            } else if ('value' in parsedJson) {
              amount = parsedJson.value;
            }
            
            // Format transaction object
            return {
              id: event.id.txDigest + event.id.eventSeq,
              type: eventType,
              amount: amount,
              timestamp: Number(event.timestampMs),
              cardId: parsedJson.card_id || '',
              digest: event.id.txDigest
            };
          } catch (error) {
            console.error('Error processing event:', error);
            return null;
          }
        })
        .filter(Boolean) as Transaction[];
      
      console.log('Filtered transactions for current account:', txEvents.length);
      
      // Sort transactions by timestamp (newest first)
      const sortedTxs = [...txEvents].sort((a, b) => b.timestamp - a.timestamp);
      
      setTransactions(sortedTxs);
    } catch (error) {
      console.error('Error fetching transaction data:', error);
    } finally {
      setLoading(false);
    }
  }, [client, currentAccount, packageId]);
  
  // Helper function to parse event type
  const parseEventType = (eventType: string): EventType => {
    const eventName = eventType.split('::').pop()?.toLowerCase() || '';
    if (eventName.includes('deposit')) return 'deposit';
    if (eventName.includes('withdraw')) return 'withdraw';
    if (eventName.includes('spend')) return 'spend';
    if (eventName.includes('directtransfer')) return 'transfer';
    if (eventName.includes('cardcreated')) return 'create';
    return 'create'; // Default fallback
  };

  // Fetch data when wallet is connected
  React.useEffect(() => {
    if (currentAccount) {
      console.log('Triggering transaction fetch - wallet connected');
      fetchTransactionData();
    } else {
      console.log('Not fetching transactions - wallet not connected');
    }
  }, [currentAccount, fetchTransactionData]);
  
  // Handle refresh button click
  const handleRefresh = () => {
    console.log('Manual fetch triggered');
    fetchTransactionData();
  };
  
  // Filter transactions based on selected type
  const filteredTransactions = filterType === 'all' 
    ? transactions 
    : transactions.filter(tx => tx.type === filterType);

  // Helper function to get a readable card ID
  const getCardName = (cardId: string) => {
    if (!cardId) return 'No card';
    
    const card = cards.find(c => c.id === cardId);
    if (!card) return `Card ID: ${cardId.substring(0, 8)}...`;
    
    // Get position in cards array for a simpler display
    const cardIndex = cards.findIndex(c => c.id === cardId);
    return `Card #${cardIndex !== -1 ? cardIndex + 1 : '?'}`;
  };
  
  return (
    <Container>
      <Header />
      <Box my="6" pt="8">
        <Flex justify="between" align="center" mb="4">
          <Text size="6" weight="bold" color="gray">Transaction History</Text>
          <Button variant="soft" color="blue" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={16} />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </Flex>
        
        {/* Filter buttons */}
        <Flex gap="2" wrap="wrap" mb="6">
          <Button 
            variant={filterType === 'all' ? 'solid' : 'soft'} 
            color="blue"
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button 
            variant={filterType === 'deposit' ? 'solid' : 'soft'} 
            color="blue"
            onClick={() => setFilterType('deposit')}
          >
            <ArrowDown />
            Deposits
          </Button>
          <Button 
            variant={filterType === 'withdraw' ? 'solid' : 'soft'} 
            color="blue"
            onClick={() => setFilterType('withdraw')}
          >
            <ArrowUp />
            Withdrawals
          </Button>
          <Button 
            variant={filterType === 'spend' ? 'solid' : 'soft'} 
            color="blue"
            onClick={() => setFilterType('spend')}
          >
            <CreditCard />
            Spend
          </Button>
          <Button 
            variant={filterType === 'transfer' ? 'solid' : 'soft'} 
            color="blue"
            onClick={() => setFilterType('transfer')}
          >
            <ArrowUp />
            Transfers
          </Button>
        </Flex>
        
        {currentAccount ? (
          <>
            {loading ? (
              <Flex direction="column" align="center" justify="center" py="8">
                <Text size="2">Loading transaction history...</Text>
              </Flex>
            ) : (
              <Box>
                {filteredTransactions.length > 0 ? (
                  <Flex direction="column" gap="3">
                    {filteredTransactions.map(transaction => {
                      const cardName = getCardName(transaction.cardId);
                      
                      return (
                        <Box key={transaction.id} p="4" style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <Flex gap="4" align="start">
                            <Box 
                              p="3" 
                              style={{ 
                                borderRadius: '50%', 
                                background: transaction.type === 'deposit' 
                                  ? 'rgba(37, 99, 235, 0.1)' 
                                  : transaction.type === 'withdraw' 
                                    ? 'rgba(37, 99, 235, 0.1)' 
                                    : 'rgba(37, 99, 235, 0.1)',
                                width: '48px',
                                height: '48px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {getTransactionIcon(transaction.type)}
                            </Box>
                            <Flex direction="column" className="flex-grow" gap="1">
                              <Flex justify="between" align="start">
                                <Box>
                                  <Text size="3" weight="bold" style={{ textTransform: 'capitalize' }} color="gray">
                                    {transaction.type}
                                  </Text>
                                  <Text size="2" color="gray">
                                    {formatDate(transaction.timestamp)}
                                  </Text>
                                </Box>
                                <Box style={{ textAlign: 'right' }}>
                                  <Text 
                                    size="3" 
                                    weight="bold" 
                                    color={transaction.type === 'deposit' ? 'blue' : 'gray'}
                                  >
                                    {transaction.type === 'deposit' ? '+' : '-'}{transaction.amount} SUI
                                  </Text>
                                  <Text size="2" color="gray">
                                    {cardName}
                                  </Text>
                                </Box>
                              </Flex>
                              <Flex justify="between" align="center" mt="2">
                                <Text size="1" color="gray" style={{ wordBreak: 'break-all' }}>
                                  TX: {transaction.digest.substring(0, 10)}...{transaction.digest.substring(transaction.digest.length - 5)}
                                </Text>
                                <Link 
                                  href={`${explorerUrl}/tx/${transaction.digest}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  size="1"
                                  color="blue"
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  View on Explorer <ExternalLink size={12} />
                                </Link>
                              </Flex>
                            </Flex>
                          </Flex>
                        </Box>
                      );
                    })}
                  </Flex>
                ) : (
                  <Box p="8" style={{ textAlign: 'center', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <Text color="gray">
                      {filterType === 'all' 
                        ? 'No transactions to display' 
                        : `No ${filterType} transactions found`}
                    </Text>
                  </Box>
                )}
                
                {/* Transaction count */}
                <Separator my="4" size="4" color="blue" />
                <Text size="2" color="gray" align="center">
                  Showing {filteredTransactions.length} {filterType === 'all' ? '' : filterType} transaction{filteredTransactions.length !== 1 ? 's' : ''}
                </Text>
              </Box>
            )}
          </>
        ) : (
          <Box p="8" style={{ textAlign: 'center' }}>
            <Text color="gray">Connect your wallet to view transaction history</Text>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default HistoryPage;
