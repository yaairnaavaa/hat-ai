import { NextResponse } from "next/server";
import { DEPLOYMENT_URL } from "vercel-url";
import { ethers } from "ethers";

const key = JSON.parse(process.env.BITTE_KEY || "{}");
const config = JSON.parse(process.env.BITTE_CONFIG || "{}");

const HARDHATCOIN_CONTRACT = process.env.HARDHATCOIN_CONTRACT || "";
const DIAMONDVAULT_CONTRACT = process.env.DIAMONDVAULT_CONTRACT || "";
const RPC_URL = process.env.RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

if (!key?.accountId) {
  console.warn("Missing account info.");
}
if (!config || !config.url) {
  console.warn("Missing config or url in config.");
}

if (
  !HARDHATCOIN_CONTRACT ||
  !DIAMONDVAULT_CONTRACT ||
  !RPC_URL ||
  !PRIVATE_KEY
) {
  console.warn("Missing environment variables for HAT integration.");
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const hardHatCoinAbi = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
];
const diamondVaultAbi = [
  "function deposit(uint256) returns (bool)",
  "function withdraw(uint256) returns (bool)",
];

const hardHatCoinContract = new ethers.Contract(
  HARDHATCOIN_CONTRACT,
  hardHatCoinAbi,
  wallet
);
const diamondVaultContract = new ethers.Contract(
  DIAMONDVAULT_CONTRACT,
  diamondVaultAbi,
  wallet
);

export async function GET() {
  const pluginData = {
    openapi: "3.0.0",
    info: {
      title: "Ref Finance and HAT API",
      description: "API for interacting with Ref Finance and HAT contracts.",
      version: "1.0.0",
    },
    servers: [
      {
        url: config?.url || DEPLOYMENT_URL,
      },
    ],
    "x-mb": {
      "account-id": key.accountId || "",
      assistant: {
        name: "Ref Finance and HAT Agent",
        description:
          "An assistant that provides token metadata, swaps tokens, and interacts with HAT contracts.",
        instructions:
          "Get information for a given fungible token, swap tokens, check balances, transfer HAT tokens, and manage deposits or withdrawals from the DiamondVault contract.",
        tools: [{ type: "generate-transaction" }],
      },
    },
    paths: {
      "/api/hat/balance/{account}": {
        get: {
          operationId: "get-hat-balance",
          description: "Get the balance of HAT tokens for a given account.",
          parameters: [
            {
              name: "account",
              in: "path",
              description: "The account address to query the balance for.",
              required: true,
              schema: {
                type: "string",
              },
            },
          ],
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      balance: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/hat/transfer": {
        post: {
          operationId: "transfer-hat-tokens",
          description:
            "Transfer HAT tokens from the connected wallet to a recipient.",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    recipient: {
                      type: "string",
                      description: "The address of the recipient.",
                    },
                    amount: {
                      type: "string",
                      description: "The amount of HAT tokens to transfer.",
                    },
                  },
                  required: ["recipient", "amount"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful transfer",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: {
                        type: "boolean",
                      },
                      txHash: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/hat/deposit": {
        post: {
          operationId: "deposit-hat-tokens",
          description: "Deposit HAT tokens into the DiamondVault contract.",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    amount: {
                      type: "string",
                      description: "The amount of HAT tokens to deposit.",
                    },
                  },
                  required: ["amount"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful deposit",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: {
                        type: "boolean",
                      },
                      txHash: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/hat/withdraw": {
        post: {
          operationId: "withdraw-hat-tokens",
          description: "Withdraw HAT tokens from the DiamondVault contract.",
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    amount: {
                      type: "string",
                      description: "The amount of HAT tokens to withdraw.",
                    },
                  },
                  required: ["amount"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful withdrawal",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: {
                        type: "boolean",
                      },
                      txHash: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Bad request",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      error: {
                        type: "string",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  return NextResponse.json(pluginData);
}
