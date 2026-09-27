import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";

dotenv.config();

const db = new sqlite3.Database("agent-purse.db");
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS spending_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT,
        amount TEXT,
        asset TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

const signer = privateKeyToAccount((process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`);

const client = new x402Client({
    spendControls: {
        maxAmountPerPayment: "$1", // strict per-payment limit
        allowedAssets: [
            { network: "eip155:84532", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" } // Base Sepolia test USDC
        ]
    }
});

client.register("eip155:*", new ExactEvmScheme(signer));

// Add hooks to log payments
client.hooks.on("beforePaymentCreation", (context) => {
    return new Promise((resolve) => {
        db.run("INSERT INTO spending_log (endpoint, amount, asset, status) VALUES (?, ?, ?, ?)", [context.request.url, context.requirements[0]?.amount, context.requirements[0]?.asset, "pending"]);
        resolve();
    });
});

export const fetchWithPayment = wrapFetchWithPayment(fetch, client);

export async function runAgent() {
    // LLM tool calling logic goes here
}
