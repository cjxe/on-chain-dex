# on-chain CLOB DEX > front end

## Table of contents

1. [Description](#description)
2. [Getting started](#getting-started)
3. [Contributing](#contributing)

---

## Description

This directory contains the front end files (i.e., HTML, CSS, JS, Application Binary Interface (ABI) of smart contracts).

## Getting started

### Prerequisites

- [The MetaMask extension](https://metamask.io/) (see [the list of supported browsers](https://metamask.io/download/))

### Executing the front end

Access the front end by hosting your own server (see "option 2" and "option 3") or visiting the already hosted server (see "option 1").

#### Option 1: Access the hosted server

1. Visit [https://on-chain-dex.vercel.app/](https://on-chain-dex.vercel.app/).

#### Option 2: use Node.js

1. [Install the latest version of Node.js](https://nodejs.org/en).  *(This application has been tested with Node.js v20.0.0)*
2. Navigate to `/frontend/public`.
3. Open up a terminal and run the following command to set up an http server on port 3002: 
```
npx http-server -p 9002
```
4. Access the application by visiting `http://localhost:3002`

#### Option 3: use Python

1. [Install the latest version of Python](https://www.python.org/downloads/). *(This application has been tested with Python v3.11.3)*
2. Navigate to `/frontend/public`.
3. Open up a terminal and run the following command to set up an http server on port 3002: 
```
python -m http.server 3002
```
4. Access the application by visiting `http://localhost:3002`

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. Please use the issue labels/tags accordingly.

1. Fork this project.
2. Create your new branch:
```
git checkout -b fe/<issue label>/<issue name>
```
3. Do your changes.
4. Stage and commit your changes.
5. Push the local branch to the forked remote repo:
```
git push origin fe/<issue label>/<issue name>
```
6. Navigate to the forked repo using your favourite browser and make a new pull request (PR).
