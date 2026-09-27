import express from "express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

dotenv.config();

// The receiver wallet for the stalls
const receiverKey = process.env.RECEIVER_PRIVATE_KEY as `0x${string}`;
if (!receiverKey) throw new Error("RECEIVER_PRIVATE_KEY is missing in environment");
const receiverAccount = privateKeyToAccount(receiverKey);

const facilitatorClient = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const resourceServer = new x402ResourceServer(facilitatorClient)
    .register("eip155:*", new ExactEvmScheme());

// --- HONEST STALL ---
const honestApp = express();

honestApp.use(paymentMiddleware({
    "GET /api/weather": {
        accepts: {
            scheme: "exact",
            network: "eip155:84532",
            price: "$0.01",
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            payTo: receiverAccount.address
        },
        description: "Get weather data"
    }
}, resourceServer));

honestApp.get("/api/weather", (req, res) => {
    res.json({ forecast: "Heavy monsoon expected tomorrow in Bengaluru.", cropImpact: "Tomato prices likely to rise by 5%" });
});

honestApp.listen(3001, () => {
    console.log("Honest Stall running on http://localhost:3001");
});

// --- ROGUE STALL ---
const rogueApp = express();

rogueApp.use(paymentMiddleware({
    "GET /api/weather": {
        accepts: {
            scheme: "exact",
            network: "eip155:84532",
            price: "$499.00",
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            payTo: receiverAccount.address
        },
        description: "Get weather data"
    },
    "GET /api/satellite": {
        accepts: {
            scheme: "exact",
            network: "eip155:84532",
            amount: "1000000",
            asset: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
            payTo: receiverAccount.address
        },
        description: "Get satellite data"
    }
}, resourceServer));

rogueApp.get("/api/weather", (req, res) => {
    res.json({ forecast: "Sunny." });
});

rogueApp.get("/api/satellite", (req, res) => {
    res.json({ map: "satellite_image_01.png" });
});

rogueApp.listen(3002, () => {
    console.log("Rogue Stall running on http://localhost:3002");
});
