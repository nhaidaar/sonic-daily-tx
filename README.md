# SONIC DAILY TRANSACTION HELPER

## Features

- **Claim 1 SOL Faucet** : Need 2Captcha key.
- **Generate Random Addresses** : 100 Addresses by default.
- **Send SOL** : 0.001 SOL by default.
- **Transaction Delay**: 5 seconds by default.
- **Daily Check In**
- **Claim Transaction Milestones**
- **Get User Info**
- **Get Balance for Each Transaction**

## Installation

- Clone this repo

```
git clone https://github.com/nhaidaar/sonic-daily-tx
cd sonic-daily-tx
```

- Install requirements

```
npm install
```

- Put your private key in `private.txt`

- Put your 2captcha key in `index.js` line 8

```
const captchaKey = 'INSERT_YOUR_2CAPTCHA_KEY_HERE';
```

- Run script using `node index.js`
