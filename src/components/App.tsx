import '@mysten/dapp-kit/dist/index.css'
import '@radix-ui/themes/styles.css'
import '@suiware/kit/main.css'
import SuiProvider from '@suiware/kit/SuiProvider'
import { FC, StrictMode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { APP_NAME } from '~~/config/main'
import { getThemeSettings } from '~~/helpers/theme'
import useNetworkConfig from '~~/hooks/useNetworkConfig'
import CounterPage from '~~/dapp/pages/CounterPage'
import IndexPage from '~~/dapp/pages/IndexPage'
import CardPage from '~~/dapp/pages/CardPage'
import ManageCardsPage from '~~/dapp/pages/ManageCardsPage'
import SpendPage from '~~/dapp/pages/SpendPage'
import HistoryPage from '~~/dapp/pages/HistoryPage'
import ThemeProvider from '~~/providers/ThemeProvider'
import '~~/styles/index.css'
import { ENetwork } from '~~/types/ENetwork'

const themeSettings = getThemeSettings()

const App: FC = () => {
  const { networkConfig } = useNetworkConfig()

  return (
    <StrictMode>
      <BrowserRouter basename="/">
        <ThemeProvider>
          <SuiProvider
            customNetworkConfig={networkConfig}
            defaultNetwork={ENetwork.TESTNET}
            walletAutoConnect={true}
            walletStashedName={APP_NAME}
            themeSettings={themeSettings}
          >
            <Routes>
              <Route index path="/" element={<IndexPage />} />
              <Route path="/dashboard" element={<IndexPage />} />
              <Route path="/counter/:counterId" element={<CounterPage />} />
              <Route path="/cards" element={<CardPage />} />
              <Route path="/create-card" element={<CardPage />} />
              <Route path="/manage-cards" element={<ManageCardsPage />} />
              <Route path="/spend" element={<SpendPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Routes>
          </SuiProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>
  )
}

export default App
