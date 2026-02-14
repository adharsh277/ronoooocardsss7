import { Heading, Text, Flex } from '@radix-ui/themes'
import CreateCardForm from '~~/dapp/components/CreateCardForm'
// CardList component is available but not used in this page
import Header from '../components/Header'

const CardPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        <div>
          <Heading size="8" className="font-display text-gray-900">
            Sui Card System
          </Heading>
          <Text className="mt-2 text-lg text-gray-600">
            Create and manage your virtual crypto cards on Sui
          </Text>
        </div>

        <div className="mt-8">
          <Flex direction="column" gap="6">
            {/* <CardList /> */}
            <CreateCardForm />
          </Flex>
        </div>
      </div>
    </div>
  )
}

export default CardPage
