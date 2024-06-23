const { readFileSync } = require("fs");
const { Twisters } = require("twisters");
const sol = require("@solana/web3.js");
const bs58 = require("bs58");
// const nacl = require("tweetnacl");

const rpc = 'https://devnet.sonic.game/';
const connection = new sol.Connection(rpc, 'confirmed');
const keypairs = [];
const twisters = new Twisters();

// const getDailyTxCount = (keyPair) => new Promise(async (resolve, reject) => {
//     const message = await fetch(`https://odyssey-api.sonic.game/auth/sonic/challenge?wallet=${keyPair.publicKey}`, {
//         headers: {
//             'accept': '*/*',
//             'accept-language': 'en-US,en;q=0.6',
//             'if-none-match': 'W/"192-D/PuxxsvlPPenys+YyKzNiw6SKg"',
//             'origin': 'https://odyssey.sonic.game',
//             'priority': 'u=1, i',
//             'referer': 'https://odyssey.sonic.game/',
//             'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"',
//             'sec-ch-ua-mobile': '?0',
//             'sec-ch-ua-platform': '"Windows"',
//             'sec-fetch-dest': 'empty',
//             'sec-fetch-mode': 'cors',
//             'sec-fetch-site': 'same-site',
//             'sec-gpc': '1',
//             'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
//         }
//     }).then(response => response.json());

//     const sign = nacl.sign.detached(Buffer.from(message.data), keyPair.secretKey);
//     const signature = Buffer.from(sign).toString('base64');
//     const publicKey = keyPair.publicKey.toBase58();
    
//     console.log(publicKey);
//     console.log(Buffer.from(publicKey).toString('base64'));
//     console.log(signature);

//     const authorize = await fetch('https://odyssey-api.sonic.game/auth/sonic/authorize', {
//         method: 'POST',
//         headers: {
//             'accept': '*/*',
//             'accept-language': 'en-US,en;q=0.6',
//             'content-type': 'application/json',
//             'origin': 'https://odyssey.sonic.game',
//             'priority': 'u=1, i',
//             'referer': 'https://odyssey.sonic.game/',
//             'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"',
//             'sec-ch-ua-mobile': '?0',
//             'sec-ch-ua-platform': '"Windows"',
//             'sec-fetch-dest': 'empty',
//             'sec-fetch-mode': 'cors',
//             'sec-fetch-site': 'same-site',
//             'sec-gpc': '1',
//             'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
//         },
//         body: JSON.stringify({
//             'address': `${publicKey}`,
//             'address_encoded': `${Buffer.from(publicKey).toString('base64')}`,
//             'signature': `${signature}`
//         })
//     }).then(response => response.json());
//     console.log(authorize);
//     const token = authorize.data.token;
//     console.log(token);
//     resolve();
// });

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

async function getSolanaBalance(fromKeypair) {
  return connection.getBalance(fromKeypair.publicKey);
}

const delay = (seconds) => {
    return new Promise((resolve) => {
        return setTimeout(resolve, seconds * 1000);
    });
}

(async () => {
    const listAccounts = readFileSync("./private.txt", "utf-8")
        .split("\n")
        .map((a) => a.trim());

    for (const privateKey of listAccounts) {
        keypairs.push(getKeypairFromPrivateKey(privateKey));
    }

    if (keypairs.length === 0) {
        throw new Error('Please fill at least 1 private key in private.txt');
    }

    for(const [index, keypair] of keypairs.entries()) {
        // getDailyTxCount(keypair);
        const randomAddresses = generateRandomAddresses(100);
        const amountToSend = 0.001;
        const delayBetweenRequests = 5; // in seconds
        const publicKey = keypair.publicKey.toBase58();
        const initialBalance = (await getSolanaBalance(keypair)) / sol.LAMPORTS_PER_SOL;
        
        twisters.put(`${publicKey}`, { 
            text: ` === ACCOUNT ${(index + 1)} ===
Address : ${publicKey}
Balance : ${initialBalance} SOL
Status  : -
`
        });

        for (const [i, address] of randomAddresses.entries()) {
            const balance = (await getSolanaBalance(keypair)) / sol.LAMPORTS_PER_SOL;
            const toPublicKey = new sol.PublicKey(address);
            
            try {
                const transaction = new sol.Transaction().add(
                    sol.SystemProgram.transfer({
                        fromPubkey: keypair.publicKey,
                        toPubkey: toPublicKey,
                        lamports: amountToSend * sol.LAMPORTS_PER_SOL,
                    })
                );
                
                await sol.sendAndConfirmTransaction(connection, transaction, [keypair]);
                twisters.put(`${publicKey}`, { 
                    text: ` === ACCOUNT ${(index + 1)} ===
Address : ${publicKey}
Balance : ${balance} SOL
Status  : [${(i + 1)}/${randomAddresses.length}] Successfully sent ${amountToSend} SOL to ${address}
`
                });

            } catch (error) {
                twisters.put(`${publicKey}`, { 
                    text: ` === ACCOUNT ${(index + 1)} ===
Address : ${publicKey}
Balance : ${balance} SOL
Status  : [${(i + 1)}/${randomAddresses.length}] Failed to send SOL to ${address}, ${error}
`
                });
            }

            await delay(delayBetweenRequests);
        }

        const finalBalance = (await getSolanaBalance(keypair)) / sol.LAMPORTS_PER_SOL;
        twisters.put(`${publicKey}`, { 
            active: false,
            text: ` === ACCOUNT ${(index + 1)} ===
Address : ${publicKey}
Balance : ${finalBalance} SOL
Status  : [${randomAddresses.length}/${randomAddresses.length}] Done
`
        });
    }
})();