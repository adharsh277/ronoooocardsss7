import { useCurrentAccount } from '@mysten/dapp-kit'
import useTransact from '@suiware/kit/useTransact'
import { FormEvent, useState, useEffect } from 'react'
import { Loader2, X, ArrowRight, SendHorizontal } from 'lucide-react'
import {
  CONTRACT_PACKAGE_VARIABLE_NAME,
  EXPLORER_URL_VARIABLE_NAME,
} from '~~/config/network'
import { prepareDirectTransferTransaction } from '~~/dapp/helpers/transactions'
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

interface TransferCardFormProps {
  card: CardData;
  onSuccess?: () => void;
}

const TransferCardForm = ({ card, onSuccess }: TransferCardFormProps) => {
  const currentAccount = useCurrentAccount()
  const { useNetworkVariable } = useNetworkConfig()
  const packageId = useNetworkVariable(CONTRACT_PACKAGE_VARIABLE_NAME)
  const explorerUrl = useNetworkVariable(EXPLORER_URL_VARIABLE_NAME)
  const [transferAmount, setTransferAmount] = useState<string>('0.01')
  const [recipientAddress, setRecipientAddress] = useState<string>('')
  const [notificationId, setNotificationId] = useState<string>()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [addressError, setAddressError] = useState<string>('')

  // Calculate available amount to transfer - just based on balance, no spending limit
  console.log('Card balance:', card.balance)

  // Create a subscription to the transaction status
  const { transact: transfer } = useTransact({
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

  const handleTransferSubmit = (e: FormEvent) => {
    e.preventDefault()
    setAddressError('')

    // Validate amount
    if (!transferAmount || Number(transferAmount) <= 0) {
      notification.error(new Error('Please enter a valid amount to transfer'))
      return
    }
    
    const transferAmountNum = Number(transferAmount)
    
    // Check against card balance
    if (transferAmountNum > card.balance) {
      notification.error(new Error(`Amount exceeds your card balance of ${card.balance.toFixed(2)} SUI`))
      return
    }

    // Validate recipient address
    if (!recipientAddress || !validateSuiAddress(recipientAddress)) {
      setAddressError('Please enter a valid Sui address')
      return
    }

    // Use the direct transfer function to bypass spending limit checks
    transfer(prepareDirectTransferTransaction(packageId, card.id, transferAmount, recipientAddress))
  }

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  if (!currentAccount) return null
  
  return (
    <>
      <button
        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
        onClick={handleOpenDialog}
        disabled={!card.isActive || card.balance <= 0}
      >
        <SendHorizontal size={16} />
        Spend
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">
                Spend from Card
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/50 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

          {isLoading ? (
            <div className="p-6 flex flex-col items-center justify-center space-y-4">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-white">Processing transaction...</p>
            </div>
          ) : card.balance <= 0 ? (
            <div className="p-6 rounded-lg bg-red-900/30 border border-red-500/20 text-center">
              <p className="text-blue-100">
                Your card has insufficient balance for a transfer.
              </p>
            </div>
          ) : (
            <form onSubmit={handleTransferSubmit} className="p-6 space-y-4">
                <div className="mb-4">
                  <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                    <p className="text-blue-200 text-sm mb-1">Available Balance</p>
                    <p className="text-white text-xl font-bold">
                      {card.balance.toFixed(2)} SUI
                    </p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="recipient-address" className="block mb-2 text-white/80 text-sm">
                    Recipient Address
                  </label>
                  <div className="relative">
                    <input
                      id="recipient-address"
                      type="text"
                      className={`w-full rounded-xl border ${addressError ? 'border-red-500' : 'border-white/20'} bg-white/5 backdrop-blur-sm px-4 py-3 text-white placeholder-white/30 focus:border-blue-500 focus:outline-none`}
                      value={recipientAddress}
                      onChange={(e) => {
                        setRecipientAddress(e.target.value);
                        setAddressError('');
                      }}
                      placeholder="0x..."
                      required
                    />
                  </div>
                  {addressError && (
                    <p className="mt-1 text-red-400 text-sm">{addressError}</p>
                  )}
                </div>
                
                <div className="mb-4">
                  <label htmlFor="transfer-amount" className="block mb-2 text-white/80 text-sm">
                    Spend Amount (SUI)
                  </label>
                  <div className="relative">
                    <input
                      id="transfer-amount"
                      type="number"
                      className="w-full rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-4 py-3 text-white placeholder-white/30 focus:border-blue-500 focus:outline-none"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      step="0.001"
                      min="0.001"
                      max={card.balance}
                      placeholder="0.00"
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50">
                      SUI
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/20">
                    <p className="text-blue-300 font-medium mb-2">Note:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-blue-200/80">
                      <li>This will transfer funds directly without spending limit checks</li>
                      <li>For testing, transfers are limited to 0.001-0.2 SUI</li>
                      <li>Each transaction requires a sufficient gas budget</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-white/70 hover:text-white transition-colors"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isLoading && <Loader2 size={18} className="animate-spin" />}
                    Transfer <ArrowRight size={16} />
                  </button>
                </div>
            </form>
          )}
          </div>
        </div>
      )}
    </>
  )
}

export default TransferCardForm
