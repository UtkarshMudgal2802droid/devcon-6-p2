"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchWithPayment = void 0;
exports.runAgent = runAgent;
const client_1 = require("@x402/core/client");
const fetch_1 = require("@x402/fetch");
const client_2 = require("@x402/evm/exact/client");
const accounts_1 = require("viem/accounts");
const sqlite3_1 = __importDefault(require("sqlite3"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db = new sqlite3_1.default.Database("agent-purse.db");
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
const signer = (0, accounts_1.privateKeyToAccount)((process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"));
const client = new client_1.x402Client({
    spendControls: {
        maxAmountPerPayment: "$1", // strict per-payment limit
        allowedAssets: [
            { network: "eip155:84532", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" } // Base Sepolia test USDC
        ]
    }
});
client.register("eip155:*", new client_2.ExactEvmScheme(signer));
// Add hooks to log payments
client.hooks.on("beforePaymentCreation", (context) => {
    return new Promise((resolve) => {
        db.run("INSERT INTO spending_log (endpoint, amount, asset, status) VALUES (?, ?, ?, ?)", [context.request.url, context.requirements[0]?.amount, context.requirements[0]?.asset, "pending"]);
        resolve();
    });
});
exports.fetchWithPayment = (0, fetch_1.wrapFetchWithPayment)(fetch, client);
async function runAgent() {
    // LLM tool calling logic goes here
}
//# sourceMappingURL=index.js.map