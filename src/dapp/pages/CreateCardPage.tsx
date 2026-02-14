import React from 'react'
import { Container, Flex, Text, Box } from '@radix-ui/themes'
import { useCurrentAccount } from '@mysten/dapp-kit'
import Header from '../components/Header'
import CreateCardForm from '../components/CreateCardForm'

const CreateCardPage: React.FC = () => {
  const currentAccount = useCurrentAccount()
  
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <Container size="3" className="py-8">
        <Flex direction="column" gap="6">
          <Box className="p-6 bg-gray-800 rounded-xl text-white">
            <Text size="6" weight="bold" className="mb-4">Create Card</Text>
            
            {currentAccount ? (
              <div className="mt-4">
                <CreateCardForm />
              </div>
            ) : (
              <div className="text-center py-8">
                <Text>Please connect your wallet to create a card.</Text>
              </div>
            )}
          </Box>
        </Flex>
      </Container>
    </div>
  )
}

export default CreateCardPage
