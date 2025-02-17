# my-ton-app

This template should help get you started developing with Vue 3 in Vite.

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

**Note:** Never commit your `.env` file to version control. It contains sensitive information.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

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

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```
