<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { TonConnectUI } from '@tonconnect/ui'
import { TonClient, Address, beginCell, toNano } from '@ton/ton'
import { Buffer } from 'buffer'
import { mnemonicToPrivateKey, sign } from '@ton/crypto'

const connected = ref(false)
const address = ref('')
const totalPrize = ref(0)
const ticketPrice = ref(0)
const timerEnd = ref(0)
const seqno = ref(0)
const contractBalance = ref(0)
const jettonBalance = ref(0)
const gameState = ref(0)
const tokenAddress = ref('')
const lastUpdated = ref('')
const contractAddress = ref('kQDhmVttdBEcpcc9OQFw2fRunaGFiyyutsIBuElDSpF9Qexj')
const isLoading = ref(false)
const jettonWalletAddress = ref('')
const privateKey = ref<Buffer>()
let tonConnectUI: TonConnectUI

// Initialize TON Client with proper configuration
const client = new TonClient({
  endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  apiKey: import.meta.env.VITE_TONCENTER_API_KEY,
  timeout: 30000 // 30 seconds timeout
})

// Add state mapping
const STATE_LABELS: { [key: number]: string } = {
  0: 'Pending Init Pot',
  1: 'Active',
  2: 'Finished',
  3: 'Ready to Claim'
}

const fetchContractData = async () => {
  if (!contractAddress.value) return
  
  isLoading.value = true
  try {
    const address = Address.parse(contractAddress.value)
    
    // Fetch all getters with proper error handling
    const [
      prizeResult,
      priceResult,
      timerResult,
      seqnoResult,
      jettonBalanceResult,
      stateResult,
      tokenAddressResult,
      balance
    ] = await Promise.all([
      client.callGetMethod(address, 'totalPrize').catch(e => console.error('Error fetching prize:', e)),
      client.callGetMethod(address, 'ticketPrice').catch(e => console.error('Error fetching price:', e)),
      client.callGetMethod(address, 'timerEnd').catch(e => console.error('Error fetching timer:', e)),
      client.callGetMethod(address, 'seqno').catch(e => console.error('Error fetching seqno:', e)),
      client.callGetMethod(address, 'balance').catch(e => console.error('Error fetching jetton balance:', e)),
      client.callGetMethod(address, 'state').catch(e => console.error('Error fetching state:', e)),
      client.callGetMethod(address, 'tokenAddress').catch(e => console.error('Error fetching token address:', e)),
      client.getBalance(address).catch(e => console.error('Error fetching balance:', e))
    ])
    
    // Update values with null checks
    if (prizeResult) totalPrize.value = Number(prizeResult.stack.readBigNumber())
    if (priceResult) ticketPrice.value = Number(priceResult.stack.readBigNumber())
    if (timerResult) timerEnd.value = Number(timerResult.stack.readBigNumber())
    if (seqnoResult) seqno.value = Number(seqnoResult.stack.readBigNumber())
    if (balance) contractBalance.value = Number(balance)
    if (jettonBalanceResult) jettonBalance.value = Number(jettonBalanceResult.stack.readBigNumber())
    if (stateResult) gameState.value = Number(stateResult.stack.readNumber())
    if (tokenAddressResult) {
      tokenAddress.value = tokenAddressResult.stack.readAddress().toString()
      // Auto fetch jetton wallet address if wallet is connected
      if (connected.value && tonConnectUI?.account?.address) {
        await getJettonWalletAddress()
      }
    }
    
    lastUpdated.value = new Date().toLocaleString()
    console.log('Contract data fetched successfully')
  } catch (e) {
    console.error('Error fetching contract data:', e)
  } finally {
    isLoading.value = false
  }
}

const refreshData = () => {
  fetchContractData()
}

// Auto-refresh data every 10 seconds
const startDataUpdates = () => {
  fetchContractData() // Initial fetch
  setInterval(() => {
    if (!isLoading.value) { // Only fetch if not already loading
      fetchContractData()
    }
  }, 10000) // Every 10 seconds
}

const initTonConnect = async () => {
  try {
    // Initialize TonConnect UI
    tonConnectUI = new TonConnectUI({
      manifestUrl: 'https://plasticlife-art.github.io/tonconnect-manifest.json',
      buttonRootId: 'ton-connect-button'
    })

    // Listen for wallet changes
    tonConnectUI.onStatusChange((wallet) => {
      if (wallet) {
        connected.value = true
        address.value = wallet.account.address
        console.log('Wallet connected:', address.value)
      } else {
        connected.value = false
        address.value = ''
      }
    })

  } catch (e) {
    console.error('Error initializing TonConnect:', e)
  }
}

const getJettonWalletAddress = async () => {
  if (!connected.value || !tokenAddress.value || !address.value || !tonConnectUI?.account) return
  
  try {
    const tokenContract = Address.parse(tokenAddress.value)
    const ownerAddress = tonConnectUI.account.address
    
    // Call getWalletAddress method of token contract
    const result = await client.callGetMethod(tokenContract, 'get_wallet_address', [
      { type: 'slice', cell: beginCell().storeAddress(Address.parse(ownerAddress)).endCell() }
    ])
    
    jettonWalletAddress.value = result.stack.readAddress().toString()
    console.log('Jetton wallet address fetched:', jettonWalletAddress.value)
  } catch (e) {
    console.error('Error fetching jetton wallet address:', e)
  }
}

// Helper function to convert string to bytes
const stringToBytes = (str: string) => {
  return new TextEncoder().encode(str)
}

// Initialize private key
const initPrivateKey = async () => {
  const mnemonics = import.meta.env.VITE_WALLET_MNEMONICS?.split(',') || []
  
  if (mnemonics.length !== 24) {
    console.error('Invalid mnemonics configuration')
    return
  }
  
  try {
    const keyPair = await mnemonicToPrivateKey(mnemonics)
    privateKey.value = keyPair.secretKey
    console.log('Private key initialized')
  } catch (e) {
    console.error('Error initializing private key:', e)
  }
}

// Helper function to create signature
const getSign = (referer: Address, user: Address, privateKey: Buffer, amount: bigint = 10n) => {
  const hash = beginCell()
    .storeUint(0n, 64)
    .storeCoins(amount)
    .storeAddress(referer)
    .storeAddress(user)
    .endCell()
    .hash()

  const signature = sign(hash, privateKey)
  return beginCell().storeBuffer(signature).endCell()
}

const sendJettons = async () => {
  if (!connected.value || !tonConnectUI?.account || !jettonWalletAddress.value || !privateKey.value) return

  try {
    const jettonAmount = ticketPrice.value
    const forwardTonAmount = toNano('0.04')
    
    const rawAddress = tonConnectUI.account.address
    const formattedAddress = rawAddress.startsWith('0:') ? rawAddress : `0:${rawAddress}`
    
    const myAddress = Address.parse(formattedAddress)
    const destinationAddress = Address.parse(contractAddress.value)
    const jettonWallet = Address.parse(jettonWalletAddress.value)

    console.log('Addresses:', {
      myAddress: myAddress.toString(),
      destinationAddress: destinationAddress.toString(),
      jettonWallet: jettonWallet.toString()
    })

    const forwardData = beginCell()
      .storeAddress(myAddress) // referer
      .storeRef(
        beginCell()
          .storeBuffer(Buffer.from('plasticlife'))
          .endCell()
      ) //username
      .storeRef(getSign(myAddress, myAddress, privateKey.value, BigInt(jettonAmount)))
      .endCell()

    const transferBody = beginCell()
      .storeUint(0xf8a7ea5, 32) // op_code JettonTransfer
      .storeUint(0, 64)
      .storeCoins(jettonAmount)
      .storeAddress(destinationAddress)
      .storeAddress(myAddress)
      .storeMaybeRef(null)
      .storeCoins(forwardTonAmount)
      .storeMaybeRef(forwardData)
      .endCell()

    // Send transaction using TonConnect
    await tonConnectUI.sendTransaction({
      validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
      messages: [
        {
          address: jettonWallet.toString(),
          amount: toNano('0.075').toString(),
          payload: transferBody.toBoc().toString('base64'),
        },
      ],
    })

    console.log('Transaction sent successfully')
  } catch (e) {
    console.error('Error sending transaction:', e)
    if (e instanceof Error) {
      console.error('Error details:', {
        message: e.message,
        stack: e.stack
      })
    }
  }
}

onMounted(() => {
  // Wait a tick for the DOM to be ready
  setTimeout(async () => {
    await initPrivateKey()
    initTonConnect()
    startDataUpdates()
  }, 0)
})

// Helper function to format timestamp
const formatTimeRemaining = (timestamp: number) => {
  const now = Math.floor(Date.now() / 1000)
  const remaining = timestamp - now
  if (remaining <= 0) return 'Ended'
  
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60
  
  return `${hours}h ${minutes}m ${seconds}s`
}
</script>

<template>
  <main>
    <div class="container">
      <h1>TON Prize Pool</h1>
      
      <div class="contract-input">
        <input 
          v-model="contractAddress" 
          placeholder="Enter contract address" 
          class="address-input"
        >
        <button @click="refreshData" class="refresh-button" :disabled="isLoading">
          {{ isLoading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
      
      <div class="info-grid">
        <div class="info-card balance">
          <h2>Contract Balance</h2>
          <div class="value-large">{{ (contractBalance / 1000000000).toFixed(2) }} TON</div>
          <div class="details">Raw: {{ contractBalance }}</div>
        </div>

        <div class="info-card state">
          <h2>Game State</h2>
          <div class="value-large">{{ STATE_LABELS[gameState] }}</div>
          <div class="details">State ID: {{ gameState }}</div>
        </div>

        <div class="info-card jetton">
          <h2>Jetton Balance</h2>
          <div class="value-large">{{ (jettonBalance / 1000000000).toFixed(2) }} JTON</div>
          <div class="details">Raw: {{ jettonBalance }}</div>
        </div>

        <div class="info-card token">
          <h2>Token Address</h2>
          <div class="value-large address-text">{{ tokenAddress }}</div>
          <div class="details">Jetton Contract</div>
        </div>

        <div class="info-card prize">
          <h2>Total Prize Pool</h2>
          <div class="value-large">{{ (totalPrize / 1000000000).toFixed(2) }} JTON</div>
          <div class="details">Raw: {{ totalPrize }}</div>
        </div>

        <div class="info-card price">
          <h2>Ticket Price</h2>
          <div class="value-large">{{ (ticketPrice / 1000000000).toFixed(2) }} JTON</div>
          <div class="details">Raw: {{ ticketPrice }}</div>
        </div>

        <div class="info-card timer">
          <h2>Timer</h2>
          <div class="value-large">{{ formatTimeRemaining(timerEnd) }}</div>
          <div class="details">End: {{ new Date(timerEnd * 1000).toLocaleString() }}</div>
        </div>

        <div class="info-card seqno">
          <h2>Sequence Number</h2>
          <div class="value-large">#{{ seqno }}</div>
          <div class="details">Transactions Count</div>
        </div>
      </div>

      <div class="update-info">
        Last updated: {{ lastUpdated }}
      </div>

      <div class="wallet-section">
        <div id="ton-connect-button"></div>
      </div>

      <div class="action-section" v-if="connected && jettonWalletAddress">
        <button 
          @click="sendJettons" 
          class="action-button"
          :disabled="isLoading"
        >
          Send Jettons
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: calc(100% - 4rem);
}

@media (max-width: 640px) {
  .container {
    width: calc(100% - 2rem);
    padding: 1rem;
    position: relative;
    transform: none;
    top: 0;
    left: 0;
    margin: 1rem auto;
  }
}

h1 {
  font-size: 1.8rem;
  margin: 1rem 0;
  text-align: center;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin: 1rem 0;
}

.info-card {
  background: linear-gradient(145deg, #0088CC, #006699);
  color: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.info-card[class*="state"] .value-large {
  font-size: 1.3rem;
}

.info-card h2 {
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: rgba(255,255,255,0.9);
}

.value-large {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0.25rem 0;
  text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.details {
  font-size: 0.8rem;
  opacity: 0.8;
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  border-top: 1px solid rgba(255,255,255,0.2);
}

.update-info {
  text-align: center;
  color: #666;
  margin: 0.5rem 0;
  font-size: 0.8rem;
}

.wallet-section {
  margin-top: 1rem;
  text-align: center;
}

.wallet-info {
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
}

.address {
  font-family: monospace;
  font-size: 0.8rem;
  word-break: break-all;
}

.jetton-wallet-info {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.jetton-wallet-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
  background-color: white;
}

.fetch-button {
  background: linear-gradient(145deg, #0088CC, #006699);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.fetch-button:hover:not(:disabled) {
  background: linear-gradient(145deg, #006699, #005588);
}

.fetch-button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

.contract-input {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.address-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9rem;
}

.refresh-button {
  background-color: #0088CC;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.3s;
}

.refresh-button:hover:not(:disabled) {
  background-color: #006699;
}

.refresh-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.address-text {
  font-size: 0.9rem;
  word-break: break-all;
  font-family: monospace;
}

.action-section {
  margin-top: 1rem;
  text-align: center;
}

.action-button {
  background: linear-gradient(145deg, #3498db, #2980b9);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.action-button:hover:not(:disabled) {
  background: linear-gradient(145deg, #2980b9, #2471a3);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.15);
}

.action-button:disabled {
  background: #95a5a6;
  cursor: not-allowed;
}
</style>
