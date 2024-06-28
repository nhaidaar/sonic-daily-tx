const { readFileSync } = require("fs");
const { Twisters } = require("twisters");
const sol = require("@solana/web3.js");
const bs58 = require("bs58");
const prompts = require('prompts');
const nacl = require("tweetnacl");

const captchaKey = 'INSERT_YOUR_API_KEY_HERE';
const rpc = 'https://devnet.sonic.game/';
const connection = new sol.Connection(rpc, 'confirmed');
const keypairs = [];
const twisters = new Twisters();

let defaultHeaders = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.7',
    'content-type': 'application/json',
    'priority': 'u=1, i',
    'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'sec-gpc': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
};

function generateRandomAddresses(count) {
    const addresses = [];
    for (let i = 0; i < count; i++) {
    const keypair = sol.Keypair.generate();
    addresses.push(keypair.publicKey.toString());
    }
    return addresses;
}

function getKeypairFromPrivateKey(privateKey) {
    const decoded = bs58.decode(privateKey);
    return sol.Keypair.fromSecretKey(decoded);
}

const getSolanaBalance = (fromKeypair) => {
    return new Promise(async (resolve) => {
        try {
            const balance = await connection.getBalance(fromKeypair.publicKey);
            resolve(balance / sol.LAMPORTS_PER_SOL);
        } catch (error) {
            resolve('Error getting balance!');
        }
    });
}

async function sendTransaction(transaction, keypair) {
    const hash = await sol.sendAndConfirmTransaction(connection, transaction, [keypair]);
    return hash;
}

const delay = (seconds) => {
    return new Promise((resolve) => {
        return setTimeout(resolve, seconds * 1000);
    });
}

const twocaptcha_turnstile = (sitekey, pageurl) => new Promise(async (resolve) => {
    const param = {
        'key': `${captchaKey}`, 
        'method': 'turnstile',
        'sitekey': sitekey,
        'pageurl': pageurl,
    };

    try {
        const getToken = await fetch(`https://2captcha.com/in.php?key=${param.key}&method=${param.method}&sitekey=${param.sitekey}&pageurl=${param.pageurl}&json=1`, {
            method: 'GET',
        })
        .then(res => res.text())
        .then(res => {
            if (res === 'ERROR_WRONG_USER_KEY' || res === 'ERROR_ZERO_BALANCE') {
                return resolve(res);
            } else {
                return res.split('|');
            }
        });
    
        if (getToken[0] != 'OK') {
            resolve('FAILED_GETTING_TOKEN');
        }
    
        const task = getToken[1];
        for (let i = 0; i < 60; i++) {
            const token = await fetch(`https://2captcha.com/res.php?key=${param.key}&action=get&id=${task}&json=1`, {
                method: 'GET',
            }).then(res => res.json());
            
            if (token.status == 1) {
                resolve(token.request);
                break;
            }
        }
    } catch (error) {
        resolve('FAILED_GETTING_TOKEN');
    }
});

const claimFaucet = (address) => new Promise(async (resolve) => {
    const bearer = await twocaptcha_turnstile('0x4AAAAAAAc6HG1RMG_8EHSC', 'https://faucet.sonic.game/#/');
    if (bearer == 'ERROR_WRONG_USER_KEY' || bearer == 'ERROR_ZERO_BALANCE' || bearer == 'FAILED_GETTING_TOKEN' ) {
        resolve(`Failed claim, ${bearer}`);
    }

    try {
        const res = await fetch(`https://faucet-api.sonic.game/airdrop/${address}/1/${bearer}`, {
            headers: {
              ...defaultHeaders,
              'origin': 'https://faucet.sonic.game',
              'referer': 'https://faucet.sonic.game/',
            }
        }).then(res => res.json());
        
        if (res.status == 'ok') {
            resolve(`Claimed 1 SOL for ${address}`);
        } else {
            resolve(`Failed claim, ${res.error}`);
        }
    } catch (error) {
        resolve(`Failed claim, ${error}`);
    }
});

const getLoginToken = (keyPair) => new Promise(async (resolve) => {
    let success = false;

    while (!success) {
        try {
            const message = await fetch(`https://odyssey-api.sonic.game/auth/sonic/challenge?wallet=${keyPair.publicKey}`, {
                headers: defaultHeaders
            }).then(res => res.json());
        
            const sign = nacl.sign.detached(Buffer.from(message.data), keyPair.secretKey);
            const signature = Buffer.from(sign).toString('base64');
            const publicKey = keyPair.publicKey.toBase58();
            const addressEncoded = Buffer.from(keyPair.publicKey.toBytes()).toString("base64")
            const authorize = await fetch('https://odyssey-api.sonic.game/auth/sonic/authorize', {
                method: 'POST',
                headers: defaultHeaders,
                body: JSON.stringify({
                    'address': `${publicKey}`,
                    'address_encoded': `${addressEncoded}`,
                    'signature': `${signature}`
                })
            }).then(res => res.json());
        
            const token = authorize.data.token;
            success = true;
            resolve(token);
        } catch (e) {}
    }
});

const dailyCheckin = (keyPair, auth) => new Promise(async (resolve) => {
    try {
        const data = await fetch(`https://odyssey-api.sonic.game/user/check-in/transaction`, {
            headers: {
                ...defaultHeaders,
                'Authorization': `${auth}`
            }
        }).then(res => res.json());
        
        if (data.data) {
            const transactionBuffer = Buffer.from(data.data.hash, "base64");
            const transaction = sol.Transaction.from(transactionBuffer);
            const signature = await sendTransaction(transaction, keyPair);
            const checkin = await fetch('https://odyssey-api.sonic.game/user/check-in', {
                method: 'POST',
                headers: {
                    ...defaultHeaders,
                    'authorization': `${auth}`
                },
                body: JSON.stringify({
                    'hash': `${signature}`
                })
            }).then(res => res.json());
            
            resolve(`Successfully to check in, day ${checkin.data.accumulative_days}`);
        }
        resolve('Failed to check in.');
    } catch (error) {
        resolve('Failed to check in.');
    }
});

const dailyMilestone = (auth, stage) => new Promise(async (resolve) => {
    try {
        await fetch('https://odyssey-api.sonic.game/user/transactions/state/daily', {
            method: 'GET',
            headers: {
              ...defaultHeaders,
              'authorization': `${auth}`
            },
        });

        const data = await fetch('https://odyssey-api.sonic.game/user/transactions/rewards/claim', {
            method: 'POST',
            headers: {
              ...defaultHeaders,
              'authorization': `${auth}`
            },
            body: JSON.stringify({
              'stage': stage
            })
        }).then(res => res.json());

        if (data.data) {
            resolve(`Successfully to claim milestone ${stage}.`)
        }
        resolve(`Failed to claim milestone ${stage}.`);
    } catch (error) {
        resolve(`Failed to claim milestone ${stage}.`);
    }
});

const getUserInfo = (auth) => new Promise(async (resolve) => {
    let success = false;
    while (!success) {
        try {
            const data = await fetch('https://odyssey-api.sonic.game/user/rewards/info', {
                headers: {
                  ...defaultHeaders,
                  'authorization': `${auth}`,
                }
            }).then(res => res.json());
            
            if (data.data) {
                success = true;
                resolve(data.data);
            }
        } catch (error) {}
    }
});

const tgMessage = async (message) => {
    const token = 'INSERT_YOUR_TELEGRAM_BOT_TOKEN_HERE';
    const chatid = 'INSERT_YOUR_TELEGRAM_BOT_CHATID_HERE';
    const boturl = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
        await fetch(boturl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatid,
                link_preview_options: {is_disabled: true},
                text: message,
            }),
        });
    } catch (error) {}
};

function extractAddressParts(address) {
    const firstThree = address.slice(0, 4);
    const lastFour = address.slice(-4);
    return `${firstThree}...${lastFour}`;
}

(async () => {
    // GET PRIVATE KEY
    const listAccounts = readFileSync("./private.txt", "utf-8")
        .split("\n")
        .map((a) => a.trim());
    for (const privateKey of listAccounts) {
        keypairs.push(getKeypairFromPrivateKey(privateKey));
    }
    if (keypairs.length === 0) {
        throw new Error('Please fill at least 1 private key in private.txt');
    }
    
    // ASK TO CLAIM FAUCET
    const q = await prompts([
        {
            type: 'confirm',
            name: 'claim',
            message: 'Claim Faucet? (need 2captcha key)',
        },
        {
            type: 'confirm',
            name: 'useBot',
            message: 'Use Telegram Bot as Notification?',
        }
    ]);
    

    // CUSTOM YOURS
    const addressCount = 100;
    const amountToSend = 0.001; // in SOL
    const delayBetweenRequests = 5; // in seconds

    // DOING TASK FOR EACH PRIVATE KEY
    while (true) {
        for(const [index, keypair] of keypairs.entries()) {
            const publicKey = keypair.publicKey.toBase58();
            const randomAddresses = generateRandomAddresses(addressCount);
            const initialBalance = await getSolanaBalance(keypair);
                    
            let token = await getLoginToken(keypair);
            const initialInfo = await getUserInfo(token);
    
            twisters.put(`${publicKey}`, { 
                text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${initialBalance} SOL
Points       : ${initialInfo.ring}
Mystery Box  : ${initialInfo.ring_monitor}
Status       : -`
            });
    
            // CLAIM FAUCET
            if (q.claim) {
                const faucetStatus = await claimFaucet(keypair.publicKey.toBase58());
                twisters.put(`${publicKey}`, { 
                    text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${initialBalance} SOL
Points       : ${initialInfo.ring}
Mystery Box  : ${initialInfo.ring_monitor}
Status       : ${faucetStatus}`
                });
            }
    
            // SENDING SOL
            for (const [i, address] of randomAddresses.entries()) {
                const balance = await getSolanaBalance(keypair);
                const toPublicKey = new sol.PublicKey(address);
                
                try {
                    const transaction = new sol.Transaction().add(
                        sol.SystemProgram.transfer({
                            fromPubkey: keypair.publicKey,
                            toPubkey: toPublicKey,
                            lamports: amountToSend * sol.LAMPORTS_PER_SOL,
                        })
                    );
                    await sendTransaction(transaction, keypair);
                    
                    twisters.put(`${publicKey}`, { 
                        text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${balance} SOL
Points       : ${initialInfo.ring}
Mystery Box  : ${initialInfo.ring_monitor}
Status       : [${(i + 1)}/${randomAddresses.length}] Successfully sent ${amountToSend} SOL to ${address}`
                    });
    
                } catch (error) {
    
                    twisters.put(`${publicKey}`, { 
                        text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${balance} SOL
Points       : ${initialInfo.ring}
Mystery Box  : ${initialInfo.ring_monitor}
Status       : [${(i + 1)}/${randomAddresses.length}] Failed to send ${amountToSend} SOL to ${address}`
                    });
    
                }
                await delay(delayBetweenRequests);
            }
            const finalBalance = await getSolanaBalance(keypair);
            token = await getLoginToken(keypair);
    
            // CHECK IN TASK
            twisters.put(`${publicKey}`, { 
                text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${finalBalance} SOL
Points       : ${initialInfo.ring}
Mystery Box  : ${initialInfo.ring_monitor}
Status       : Try to daily check in...`
            });
            const checkin = await dailyCheckin(keypair, token);
            let info = await getUserInfo(token);
            twisters.put(`${publicKey}`, { 
                text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${finalBalance} SOL
Points       : ${info.ring}
Mystery Box  : ${info.ring_monitor}
Status       : ${checkin}`
            });
    
            // CLAIM MILESTONES
            twisters.put(`${publicKey}`, { 
                text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${finalBalance} SOL
Points       : ${info.ring}
Mystery Box  : ${info.ring_monitor}
Status       : Try to claim milestones...`
            });
            for (let i = 1; i <= 3; i++) {
                const milestones = await dailyMilestone(token, i);
                twisters.put(`${publicKey}`, { 
                    text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${finalBalance} SOL
Points       : ${info.ring}
Mystery Box  : ${info.ring_monitor}
Status       : ${milestones}`
                });
                info = await getUserInfo(token);
            }
    
            const msg = `Earned ${(info.ring_monitor - initialInfo.ring_monitor)} Mystery Box`;

            if (q.useBot) {
                await tgMessage(`${extractAddressParts(publicKey)} | ${msg}`);
            }
    
            // DONE
            twisters.put(`${publicKey}`, { 
                active: false,
                text: ` === ACCOUNT ${(index + 1)} ===
Address      : ${publicKey}
Balance      : ${finalBalance} SOL
Points       : ${info.ring}
Mystery Box  : ${info.ring_monitor}
Status       : ${msg}`
            });
        }

        console.log('Waiting 24 hrs for next claim.');
        await delay(24*60*60);
    }
})();