# ton-viewer-magic-pot
Vue application to get data from magic-pot contract and send transactions to it

## Environment Setup

Before running the application, you need to set up your environment variables:

1. Copy `.env.example` to `.env`:
```sh
cp .env.example .env
```

2. Configure the following variables in your `.env` file:

- `VITE_TONCENTER_API_KEY`: Your TON Center API key (get it from https://toncenter.com)
- `VITE_WALLET_MNEMONICS`: 24 comma-separated mnemonic words for the wallet private key

Example `.env` format:
```
VITE_TONCENTER_API_KEY=your_api_key_here
VITE_WALLET_MNEMONICS=word1,word2,word3,...,word24
```

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```
