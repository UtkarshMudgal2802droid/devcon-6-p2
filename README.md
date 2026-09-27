# The Coin Purse: An Agent That Pays but Can't Be Drained

An LLM research agent that autonomously purchases data from x402-enabled endpoints to predict mandi crop prices. The agent is given a strict spending limit per call to protect it from rogue stalls.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables. Copy `.env.example` to `.env` and fill in:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `BUYER_PRIVATE_KEY`: A Base Sepolia testnet private key funded with test USDC and ETH for gas.
   - `RECEIVER_PRIVATE_KEY`: A separate private key for the stalls to receive funds.

3. Start the test stalls (in a separate terminal):
   ```bash
   npx tsx src/stalls.ts
   ```

4. Run the agent:
   ```bash
   npx tsx src/agent.ts
   ```

## Architecture

- **`src/agent.ts`**: The LLM agent (GPT-4o) equipped with a `fetch_data` tool powered by `@x402/fetch`. It is constrained by `spendControls` to ensure it never spends more than $5 per call and only uses Base Sepolia Test USDC.
- **`src/stalls.ts`**: Contains both an honest stall (charging 0.01 USDC) and rogue stalls (charging $499 or unrecognized tokens).
- **SQLite Logging**: Every payment decision (APPROVED or REFUSED) is logged to `agent-purse.db` before execution, proving the agent respects limits and refuses hostile endpoints.
