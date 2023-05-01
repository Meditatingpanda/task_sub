import { existsSync, readFileSync, writeFileSync } from 'fs';
import inquirer from 'inquirer';
import axios from 'axios';
import { generateMnemonic, mnemonicToSeed, validateMnemonic } from 'bip39';
import pkg from 'hdkey';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import * as dotenv from 'dotenv';
dotenv.config();
const apiKey = process.env.API_KEY;
//const JSON_RPC_ENDPOINT = `https://btc.getblock.io/testnet/?api_key=${API_KEY}`;

const { fromMasterSeed } = pkg;
const ECPair = ECPairFactory(ecc);
// Load existing wallets from file if present, else initialize empty array
let wallets = [];
if (existsSync('./wallets.json')) {
    wallets = JSON.parse(readFileSync('./wallets.json', 'utf8'));
}

const questions = [
    {
        type: 'list',
        name: 'action',
        message: 'What do you want to do?',
        choices: [
            'Create a new wallet',
            'Import an existing wallet',
            'List all wallets',
            'Get bitcoin balance of a wallet',
            'Get the list of bitcoin transactions of a wallet',
            'Generate an unused bitcoin address for a wallet',
            'Exit'
        ]
    }
];

const createWalletQuestions = [
    {
        type: 'input',
        name: 'walletName',
        message: 'Enter a name for your new wallet:'
    }
];

const importWalletQuestions = [
    {
        type: 'input',
        name: 'mnemonic',
        message: 'Enter your BIP39 mnemonic phrase:'
    },
    {
        type: 'input',
        name: 'walletName',
        message: 'Enter a name for your imported wallet:'
    }
];

const getBalanceQuestions = [
    {
        type: 'list',
        name: 'wallet',
        message: 'Select the wallet whose balance you want to check:',
        choices: wallets.map((wallet) => wallet.name)
    }
];

const getTransactionsQuestions = [
    {
        type: 'list',
        name: 'wallet',
        message: 'Select the wallet whose transactions you want to view:',
        choices: wallets.map((wallet) => wallet.name)
    }
];

const generateAddressQuestions = [
    {
        type: 'list',
        name: 'wallet',
        message: 'Select the wallet to generate the address for:',
        choices: wallets.map((wallet) => wallet.name)
    }
];

async function createWallet() {
    const { walletName } = await inquirer.prompt(createWalletQuestions);
    const mnemonic = generateMnemonic();
    const seed = await mnemonicToSeed(mnemonic);
    const root = fromMasterSeed(seed);
    const masterPrivateKey = root.privateKey.toString('hex');
    const network = bitcoin.networks.testnet;
    const { publicKey } = ECPair.fromPrivateKey(Buffer.from(masterPrivateKey, 'hex'));
    const address = bitcoin.payments.p2pkh({ pubkey: publicKey, network }).address;

    wallets.push({ name: walletName, mnemonic, address });
    writeFileSync('./wallets.json', JSON.stringify(wallets));
    console.log(`Wallet created successfully!\nMnemonic: ${mnemonic}\nAddress: ${address}`);
}

async function importWallet() {
    const { mnemonic, walletName } = await inquirer.prompt(importWalletQuestions);
    if (!validateMnemonic(mnemonic)) {
        console.log('Invalid mnemonic phrase!');
        return;
    }
    const seed = await mnemonicToSeed(mnemonic);
    const root = fromMasterSeed(seed);
    const masterPrivateKey = root.privateKey.toString('hex');
    const network = bitcoin.networks.testnet;
    const { publicKey } = ECPair.fromPrivateKey(Buffer.from(masterPrivateKey, 'hex'));
    const address = bitcoin.payments.p2pkh({ pubkey: publicKey, network }).address;

    wallets.push({ name: walletName, mnemonic, address });
    writeFileSync('./wallets.json', JSON.stringify(wallets));
    console.log(`Wallet imported successfully!\nMnemonic: ${mnemonic}\nAddress: ${address}`);
}


async function getBalance() {
    const { wallet } = await inquirer.prompt(getBalanceQuestions);
    const walletToCheck = wallets.find((w) => w.name === wallet);
    const { address } = walletToCheck;
    axios.get(`https://api.blockcypher.com/v1/btc/test3/addrs/${address}/balance?token=${apiKey}`)
        .then(response => {
            const balanceInSatoshis = response.data.balance;
            const balanceInBTC = balanceInSatoshis / 100000000;
            console.log(`Balance for ${address}: ${balanceInBTC} BTC`);
        })
        .catch(error => {
            console.error(error);
        });



}

async function getTransactions() {
    const { wallet } = await inquirer.prompt(getTransactionsQuestions);
    const walletToCheck = wallets.find((w) => w.name === wallet);
    const { address } = walletToCheck;
    axios.get(`https://api.blockcypher.com/v1/btc/test3/addrs/${address}/full?token=${apiKey}`)
        .then(response => {
            const transactions = response.data.txs;
            transactions.forEach(transaction => {
                console.log(`Transaction ID: ${transaction.hash}`);
                console.log(`Block Height: ${transaction.block_height}`);
                console.log(`Total Output Value: ${transaction.total}`);
                console.log('Output Addresses:');
                transaction.outputs.forEach(output => {
                    console.log(`- ${output.addresses}`);
                });
                console.log('---');
            });
        })
        .catch(error => {
            console.error(error);
        });


}


async function generateAddress() {
    const { wallet } = await inquirer.prompt(generateAddressQuestions);
    const walletToCheck = wallets.find((w) => w.name === wallet);
    const { mnemonic } = walletToCheck;
    const seed = await mnemonicToSeed(mnemonic);
    const root = fromMasterSeed(seed);
    const masterPrivateKey = root.privateKey.toString('hex');
    const network = bitcoin.networks.testnet;
    const { publicKey } = ECPair.fromPrivateKey(Buffer.from(masterPrivateKey, 'hex'));
    const { address } = bitcoin.payments.p2pkh({ pubkey: publicKey, network });
    console.log(`New address for wallet ${wallet} is ${address}`);
}

async function main() {
    const { action } = await inquirer.prompt(questions);
    switch (action) {
        case 'Create a new wallet':
            await createWallet();
            break;
        case 'Import an existing wallet':
            await importWallet();
            break;
        case 'List all wallets':
            console.log(wallets);
            break;
        case 'Get bitcoin balance of a wallet':
            await getBalance();
            break;
        case 'Get the list of bitcoin transactions of a wallet':
            await getTransactions();
            break;
        case 'Generate an unused bitcoin address for a wallet':
            await generateAddress();
            break;
        case 'Exit':
            return;
    }

}

main();






