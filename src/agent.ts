import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";
import sqlite3 from "sqlite3";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const db = new sqlite3.Database("agent-purse.db");
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS spending_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT,
        amount TEXT,
        asset TEXT,
        decision TEXT,
        reason TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

const privateKey = process.env.BUYER_PRIVATE_KEY;
if (!privateKey) throw new Error("BUYER_PRIVATE_KEY is missing in environment");
const signer = privateKeyToAccount(privateKey as `0x${string}`);

const client = x402Client.fromConfig({
    schemes: [
        { network: "eip155:*", client: new ExactEvmScheme(signer) }
    ],
    spendControls: {
        maxAmountPerPayment: "5000000", // 5 USDC in base units (6 decimals)
        allowedAssets: [
            { network: "eip155:84532", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" } // Base Sepolia test USDC only
        ]
    }
});

client.onBeforePaymentCreation(async (context) => {
    const currentAmount = BigInt(context.selectedRequirements?.amount || "0");
    const BUDGET = 10000000n; // 10 USDC in base units

    const totalSpent = await new Promise<bigint>((resolve, reject) => {
        db.all("SELECT amount FROM spending_log WHERE decision = 'APPROVED'", (err, rows: any[]) => {
            if (err) reject(err);
            else {
                const sum = rows.reduce((acc, row) => {
                    try { return acc + BigInt(row.amount); } catch { return acc; }
                }, 0n);
                resolve(sum);
            }
        });
    });

    if (totalSpent + currentAmount > BUDGET) {
        return { abort: true, reason: "Cumulative budget exceeded" };
    }

    return new Promise<void>((resolve) => {
        db.run("INSERT INTO spending_log (endpoint, amount, asset, decision, reason) VALUES (?, ?, ?, ?, ?)", 
            [context.paymentRequired?.resource?.url || "unknown_url", currentAmount.toString(), context.selectedRequirements?.asset, "APPROVED", "Within budget and allowed asset"],
            () => resolve()
        );
    });
});

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function queryMandiData(url: string) {
    try {
        const response = await fetchWithPayment(url);
        const data = await response.text();
        return data;
    } catch (error: any) {
        // If it was blocked by x402 spend controls, log the refusal
        const reason = error.message || "Unknown error";
        console.error(`[Agent] Failed to buy from ${url}. Reason: ${reason}`);
        db.run("INSERT INTO spending_log (endpoint, amount, asset, decision, reason) VALUES (?, ?, ?, ?, ?)", 
            [url, "unknown", "unknown", "REFUSED", reason]
        );
        return `Failed to fetch: ${reason}`;
    }
}

export async function runAgent() {
    console.log("Agent waking up to research mandi prices...");
    
    let contents: any[] = [{
        role: "user",
        parts: [{ text: "Please gather monsoon data to predict mandi crop prices. Check both http://localhost:3001/api/weather (honest stall) and http://localhost:3002/api/weather (rogue stall) and http://localhost:3002/api/satellite (rogue token stall)." }]
    }];

    const fetch_data_decl = {
        name: "fetch_data",
        description: "Fetch data from a given API endpoint url.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                url: { type: Type.STRING }
            },
            required: ["url"]
        }
    };

    let response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
            tools: [{ functionDeclarations: [fetch_data_decl] }]
        }
    });
    
    // Handle function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
        // Append the model's response to contents
        contents.push(response.candidates?.[0]?.content);

        let functionResponses: any[] = [];
        for (const call of response.functionCalls) {
            if (call.name === "fetch_data") {
                const url = (call.args as any).url as string;
                console.log(`[Agent] LLM requested data from ${url}`);
                const data = await queryMandiData(url);
                
                functionResponses.push({
                    functionResponse: {
                        name: "fetch_data",
                        response: { data }
                    }
                });
            }
        }

        // Send function result back to Gemini
        contents.push({
            role: "user",
            parts: functionResponses
        });

        response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents,
            config: {
                tools: [{ functionDeclarations: [fetch_data_decl] }]
            }
        });
    }

    console.log("Agent finished research.");
    console.log("Final Report:", response.text);
}

if (require.main === module) {
    runAgent();
}
