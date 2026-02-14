import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { useCallback, useEffect, useState } from 'react'
// Using any type since we don't need the specific SuiObjectData type
type SuiObjectData = any

// Define the Card type based on the fields used in the ManageCardsPage
export interface Card {
  id: string
  balance: string
  spendingLimit: string
  amountSpent: string
  isActive: boolean
}

export function useCards() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const currentAccount = useCurrentAccount()
  const suiClient = useSuiClient()

  const fetchCards = useCallback(async () => {
    if (!currentAccount?.address) {
      setCards([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Fetch objects owned by the current account
      const objects = await suiClient.getOwnedObjects({
        owner: currentAccount.address,
        // You may need to adjust this filter to target specific card objects
        // This is a placeholder that assumes cards have a specific type
        filter: {
          StructType: '0x4fc02416d8a5e280bd5d640435378fdb2ec786748dbb1d52884da4784d5fa2ec::card::Card'
        },
        options: {
          showContent: true,
          showDisplay: true,
        },
      })

      // Transform objects into Card type
      const cardObjects = objects.data
        .filter(obj => obj.data && obj.data.content)
        .map((obj): Card => {
          const data = obj.data as SuiObjectData
          const fields = data.content?.dataType === 'moveObject' ? 
            data.content.fields as Record<string, any> : {}
          
          return {
            id: data.objectId,
            balance: fields.balance?.toString() || '0',
            spendingLimit: fields.spending_limit?.toString() || '0',
            amountSpent: fields.amount_spent?.toString() || '0',
            isActive: fields.is_active || true,
          }
        })

      setCards(cardObjects)
    } catch (error) {
      console.error('Error fetching cards:', error)
    } finally {
      setLoading(false)
    }
  }, [currentAccount, suiClient])

  // Initial fetch
  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  return {
    cards,
    loading,
    refreshCards: fetchCards
  }
}
