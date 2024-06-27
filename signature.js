const sol = require("@solana/web3.js");
const bs58 = require("bs58");
const { readFileSync } = require("fs");
const nacl = require("tweetnacl");

const rpc = 'https://devnet.sonic.game/';
const connection = new sol.Connection(rpc, 'confirmed');

function getKeypairFromPrivateKey(privateKey) {
    const decoded = bs58.decode(privateKey);
    return sol.Keypair.fromSecretKey(decoded);
}

async function Tx(trans, keyPair) {
    const tx = await sol.sendAndConfirmTransaction(connection, trans, [
        keyPair,
    ]);
    console.log(`Tx Url: https://explorer.sonic.game/tx/${tx}`);
    return tx;
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
const getDailyLogin = (keyPair, auth) => new Promise(async (resolve, reject) => {
    const data = await fetch(`https://odyssey-api.sonic.game/user/check-in/transaction`, {
        headers: {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.6',
            'if-none-match': 'W/"192-D/PuxxsvlPPenys+YyKzNiw6SKg"',
            'origin': 'https://odyssey.sonic.game',
            'priority': 'u=1, i',
            'referer': 'https://odyssey.sonic.game/',
            'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'sec-gpc': '1',
            'Authorization': `${auth}`,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        }
    }).then(response => response.json());
    if (data.data) {
        const transactionBuffer = Buffer.from(data.data.hash, "base64");
        const transaction = sol.Transaction.from(transactionBuffer);
        const signature = await Tx(transaction, keyPair);
        const checkin = await fetch('https://odyssey-api.sonic.game/user/check-in', {
            method: 'POST',
            headers: {
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.6',
                'content-type': 'application/json',
                'origin': 'https://odyssey.sonic.game',
                'priority': 'u=1, i',
                'referer': 'https://odyssey.sonic.game/',
                'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'sec-gpc': '1',
                'Authorization': `${auth}`,
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                'hash': `${signature}`
            })
        }).then(response => response.json());
        resolve(checkin)
    } else {
        resolve(data)
    }
})

// const openBox = (keyPair, auth) => new Promise(async (resolve, reject) => {
// console.log(anu ga ada :v)
// })


const getTokenLogin = (keyPair) => new Promise(async (resolve, reject) => {
    const message = await fetch(`https://odyssey-api.sonic.game/auth/sonic/challenge?wallet=${keyPair.publicKey}`, {
        headers: {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.6',
            'if-none-match': 'W/"192-D/PuxxsvlPPenys+YyKzNiw6SKg"',
            'origin': 'https://odyssey.sonic.game',
            'priority': 'u=1, i',
            'referer': 'https://odyssey.sonic.game/',
            'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'sec-gpc': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        }
    }).then(response => response.json());

    const sign = nacl.sign.detached(Buffer.from(message.data), keyPair.secretKey);
    const signature = Buffer.from(sign).toString('base64');
    const publicKey = keyPair.publicKey.toBase58();
    const addressEncoded = Buffer.from(keyPair.publicKey.toBytes()).toString("base64")
    const authorize = await fetch('https://odyssey-api.sonic.game/auth/sonic/authorize', {
        method: 'POST',
        headers: {
            'accept': '*/*',
            'accept-language': 'en-US,en;q=0.6',
            'content-type': 'application/json',
            'origin': 'https://odyssey.sonic.game',
            'priority': 'u=1, i',
            'referer': 'https://odyssey.sonic.game/',
            'sec-ch-ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Brave";v="126"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'sec-gpc': '1',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
            'address': `${publicKey}`,
            'address_encoded': `${addressEncoded}`,
            'signature': `${signature}`
        })
    }).then(response => response.json());
    const token = authorize.data.token;
    resolve(token);
});

(async () => {
    const keypairs = [];
    // const privateKey = "paste PK disini"
    const listAccounts = readFileSync("./private.txt", "utf-8")
        .split("\n")
        .map((a) => a.trim());

    for (const privateKey of listAccounts) {
        keypairs.push(getKeypairFromPrivateKey(privateKey));
    }

    if (keypairs.length === 0) {
        throw new Error('Please fill at least 1 private key in private.txt');
    }
    for (const [index, keypair] of keypairs.entries()) {
        const publicKey = keypair.publicKey.toBase58()
        const initialBalance = (await getSolanaBalance(keypair))
        console.log(publicKey)
        console.log(initialBalance)
        const getToken = await getTokenLogin(keypair)           // ini buat ngambil token login
        const getdaily = await getDailyLogin(keypair, getToken) // ini buat claim daily check-in
        console.log(getdaily)
        // const getOpenBox = await openBox(keypair, getToken)
        // console.log(getOpenBox)
    }
})()
