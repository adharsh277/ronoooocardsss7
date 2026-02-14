import React, { useState, useEffect } from 'react';
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { Wallet, Copy, Menu, X, CreditCard, Layers, LayoutDashboard, History, LogOut } from 'lucide-react';

const Header: React.FC = () => {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Handle disconnect wallet
  const handleDisconnect = () => {
    disconnectWallet();
  };
  
  // Function to truncate wallet address
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
  };

  // Handle copy address to clipboard
  const copyAddressToClipboard = () => {
    if (currentAccount) {
      navigator.clipboard.writeText(currentAccount.address);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Add scroll event listener to detect when the user scrolls down
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { href: '/create-card', label: 'Create', icon: <CreditCard size={16} /> },
    { href: '/manage-cards', label: 'Manage', icon: <Layers size={16} /> },
    { href: '/history', label: 'History', icon: <History size={16} /> }
  ];
  
  return (
    <header className={`fixed w-full top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white shadow-sm' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="relative">
                <div className="relative rounded-lg p-1">
                  <svg 
                    className="h-8 w-8 text-blue-600"
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="14" x="3" y="5" rx="2" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                </div>
              </div>
              <span className="ml-2 text-gray-800 font-bold text-lg tracking-tight">
                <span className="text-blue-600">Sui</span>Cards
              </span>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-1 items-center">
            {navItems.map((item) => (
              <a 
                key={item.href}
                href={item.href} 
                className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 flex items-center gap-1.5"
              >
                {item.icon}
                {item.label}
              </a>
            ))}
          </nav>
          
          {/* Wallet Address and Disconnect */}
          <div className="flex items-center gap-2">
            {currentAccount ? (
              <>
                <div 
                  onClick={copyAddressToClipboard}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-blue-50 text-blue-700 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-all duration-200 relative"
                >
                  <Wallet size={14} className="text-blue-600" />
                  <span>{truncateAddress(currentAccount.address)}</span>
                  <Copy size={12} className={`${copySuccess ? 'text-green-600' : 'text-gray-400'} hover:text-blue-600 transition-colors duration-200`} />
                  
                  {copySuccess && (
                    <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-md whitespace-nowrap border border-green-100">
                      Copied!
                    </span>
                  )}
                </div>
                
                {/* Disconnect button */}
                <button 
                  onClick={handleDisconnect}
                  className="flex items-center gap-1 text-sm px-3 py-2 rounded-md bg-gray-50 text-gray-700 border border-gray-100 hover:bg-gray-100 transition-all duration-200"
                  title="Disconnect Wallet"
                >
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <button className="text-sm px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors duration-200">
                Connect Wallet
              </button>
            )}

            {/* Mobile menu button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            >
              <span className="sr-only">Open main menu</span>
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      <div className={`md:hidden ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white shadow-lg">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-gray-600 hover:bg-blue-50 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium flex items-center gap-2"
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </header>
  );
};

export default Header;
