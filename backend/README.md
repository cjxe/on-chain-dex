# on-chain CLOB DEX > back end

## Table of contents

1. [Description](#description)
2. [Getting started](#getting-started)
3. [Contributing](#contributing)

---

## Description

This directory contains the back end files (i.e., smart contracts, tests, hardhat config).

## Getting started

### Prerequisites

- [Node.js v20.0.0](https://nodejs.org/en)

### Executing the back end

The back end of this project are smart contracts that are hosted on the Sepolia network. You do not have to redeploy the smart contracts if you want to use the live app; however, feel free to read the code and deploy it for testing purposes. The steps to redeploy the back end is below the table:

| Contract          | Address                                    |
|-------------------|--------------------------------------------|
| ETH               | 0x5234D63caF31AF1871f40D77C47E7744DF732336 |
| USDb              | 0xc4FcD839C4C584684e346dBfE1ed2817f8A7bCF7 |
| Factory           | 0x7F45eafd21eDC0C176706f3E833407Ee8765e9e8 |
| ETH-USDb Exchange | 0xA11aC55dca0f39fF51eEc03A6E63A3De34B13f7B |


#### Steps:

1. Install node dependencies
```
npm install
```
2. Make a new copy of `.env.example` called `.env` and fill in the environment variables.

##### Testing on the local network

1. Start a local node (aka Hardhat network):
```
npx hardhat node
```
2. Open a new terminal and run local tests:
```
npm run test-local
```

##### Testing on the Sepolia network
1. Top up your wallets with Sepolia ETH.
2. Run:
```
npm run test-sepolia
```

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. Please use the issue labels/tags accordingly.

1. Fork this project.
2. Create your new branch:
```
git checkout -b be/<issue label>/<issue name>
```
3. Run the local tests:
```
npm run test-local
```
4. Once the updated code passes all tests, stage and commit your changes.
5. Push the local branch to the forked remote repo:
```
git push origin be/<issue label>/<issue name>
```
6. Navigate to the forked repo using your favourite browser and make a new pull request (PR).
