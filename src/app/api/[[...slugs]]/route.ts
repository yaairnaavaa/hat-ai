import { swagger } from "@elysiajs/swagger";
import {
  WRAP_NEAR_CONTRACT_ID,
  estimateSwap,
  fetchAllPools,
  ftGetTokenMetadata,
  getStablePools,
  instantSwap,
  nearDepositTransaction,
  nearWithdrawTransaction,
  transformTransactions,
  type EstimateSwapView,
  type Transaction,
  type TransformedTransaction,
} from "@ref-finance/ref-sdk";
import { Elysia } from "elysia";
import { searchToken } from "@/utils/search-token";
import { formatDate, convertAsciiArrayToNumber, ClaimVault } from "@/utils/methods";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const CONTRACT_ID_VAULT = "diamondvault.hat-coin.near";
const CONTRACT_ID_AUCTION = "auctions.hat-coin.near";
const CONTRACT_ID_HAT = "hat.tkn.near";

const app = new Elysia({ prefix: "/api", aot: false })
  .use(swagger())
  // Método GET para obtener el balance de un token
  .get("/ft_balance_of", async ({ query }) => {
    const { account_id } = query; // Ahora account_id viene de los query params
    if (typeof account_id !== "string") {
      return { error: "account_id must be a string" };
    }

    const response = await fetch("https://rpc.mainnet.near.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: CONTRACT_ID_HAT,
          method_name: "ft_balance_of",
          args_base64: Buffer.from(JSON.stringify({ account_id })).toString("base64"),
        },
      }),
    });

    const data = await response.json();
    let deserializedResult = Array.isArray(data.result.result)
      ? convertAsciiArrayToNumber(data.result.result)
      : data.result.result;

    const balanceInBase10 = deserializedResult / 1e18;
    let tokenAmountCompleteConverted = balanceInBase10;
    if (Math.abs(tokenAmountCompleteConverted - Math.round(tokenAmountCompleteConverted)) < 1e-10) {
      tokenAmountCompleteConverted = Math.round(tokenAmountCompleteConverted);
    }

    return { balance: tokenAmountCompleteConverted };
  })
  // Método GET para obtener el último vault
  .get("/get_last_vault", async () => {
    const response = await fetch("https://rpc.mainnet.near.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: CONTRACT_ID_VAULT,
          method_name: "get_last_vault",
          args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
        },
      }),
    });

    const data = await response.json();
    let deserializedResult = data.result.result;

    if (Array.isArray(deserializedResult)) {
      const resultString = String.fromCharCode(...deserializedResult);
      try {
        deserializedResult = JSON.parse(resultString);

        if (Array.isArray(deserializedResult) && deserializedResult.length > 1) {
          const vaultData = deserializedResult[1];
          if (vaultData.token_amount) vaultData.token_amount /= 1e18;
          if (vaultData.token_amount_complete) {
            const tokenAmountCompleteConverted = vaultData.token_amount_complete / 1e18;
            vaultData.token_amount_complete =
              Math.abs(tokenAmountCompleteConverted - Math.round(tokenAmountCompleteConverted)) < 1e-10
                ? Math.round(tokenAmountCompleteConverted)
                : tokenAmountCompleteConverted;
          }
          if (vaultData.date_start && vaultData.date_end) {
            vaultData.date_start = formatDate(new Date(vaultData.date_start / 1e6));
            vaultData.date_end = formatDate(new Date(vaultData.date_end / 1e6));
          }
          deserializedResult[1] = vaultData;
        }
      } catch (err) {
        console.error("Error parsing JSON:", err);
      }
    }

    return deserializedResult;
  })
  // Método GET para obtener información de una subasta
  .get("/get_auction_info", async () => {
    const response = await fetch("https://rpc.mainnet.near.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: CONTRACT_ID_AUCTION,
          method_name: "get_auction_info",
          args_base64: Buffer.from(JSON.stringify({})).toString("base64"),
        },
      }),
    });

    const data = await response.json();
    let deserializedResult = Array.isArray(data.result.result)
      ? String.fromCharCode(...data.result.result)
      : data.result.result;

    try {
      deserializedResult = JSON.parse(deserializedResult);
      if (deserializedResult.start_time) {
        deserializedResult.start_time = formatDate(new Date(deserializedResult.start_time / 1e6));
      }
      if (deserializedResult.end_time) {
        deserializedResult.end_time = formatDate(new Date(deserializedResult.end_time / 1e6));
      }
      if (deserializedResult.highest_bid !== undefined) {
        deserializedResult.highest_bid /= 1e24;
      }
      if (deserializedResult.highest_bid_temp !== undefined) {
        delete deserializedResult.highest_bid_temp;
      }
    } catch (err) {
      console.error("Error processing response:", err);
      return { error: "Error processing auction response" };
    }

    return deserializedResult;
  })
  // Método POST para transferir tokens a un vault
  .post("/ft_transfer_call", ({ body }) => {
    const { amount } = body as { amount: number | string };
    const parsedAmount = typeof amount === "number" ? amount.toString() : amount;

    if (!/^\d+(\.\d+)?$/.test(parsedAmount)) {
      return { error: "Invalid amount provided. It should be a valid positive number." };
    }

    const [integerPart, decimalPart = ""] = parsedAmount.split(".");
    const fullAmount = integerPart + decimalPart.padEnd(18, "0");
    const yoctoAmount = BigInt(fullAmount).toString();

    return {
      type: "FunctionCall",
      params: {
        methodName: "ft_transfer_call",
        args: {
          receiver_id: CONTRACT_ID_VAULT,
          amount: yoctoAmount,
          msg: '{"action_to_execute":"increase_deposit"}',
        },
        gas: "200000000000000",
        deposit: "1",
      },
    };
  })
  // Método POST para reclamar un vault
  .post("/claim_vault", ({ body }) => {
    const { index } = body as ClaimVault;
    if (typeof index !== "number") {
      return { error: "index must be a number" };
    }

    return {
      type: "FunctionCall",
      params: {
        methodName: "claim_vault",
        args: { index },
        gas: "30000000000000",
        deposit: "0",
      },
    };
  })
  // Método POST para iniciar o colocar una oferta en una subasta
  .post("/start_or_place_bid", () => {
    return {
      type: "FunctionCall",
      params: {
        methodName: "start_or_place_bid",
        args: {},
        gas: "30000000000000",
        deposit: "1",
      },
    };
  })
  // Método POST para reclamar tokens de una subasta
  .post("/claim_tokens", () => {
    return {
      type: "FunctionCall",
      params: {
        methodName: "claim_tokens",
        args: {},
        gas: "300000000000000",
        deposit: "10000000000000000000",
      },
    };
  })
  .get("/:token", async ({ params: { token } }) => {
    const tokenMatch = searchToken(token)[0];
    if (!tokenMatch) {
      return {
        error: `Token ${token} not found`,
      };
    }
    const tokenMetadata = await ftGetTokenMetadata(tokenMatch.id);
    if (!tokenMetadata) {
      return {
        error: `Metadata for token ${token} not found`,
      };
    }

    return {
      ...tokenMetadata,
      icon: "",
    };
  })
  .get(
    "/swap/:tokenIn/:tokenOut/:quantity",
    async ({
      params: { tokenIn, tokenOut, quantity },
      headers,
    }): Promise<TransformedTransaction[] | { error: string }> => {
      const mbMetadata: { accountId: string } | undefined =
        headers["mb-metadata"] && JSON.parse(headers["mb-metadata"]);
      const accountId = mbMetadata?.accountId || "near";

      const { ratedPools, unRatedPools, simplePools } = await fetchAllPools();

      const stablePools = unRatedPools.concat(ratedPools);

      const stablePoolsDetail = await getStablePools(stablePools);

      const isNearIn = tokenIn.toLowerCase() === "near";
      const isNearOut = tokenOut.toLowerCase() === "near";

      const tokenInMatch = searchToken(tokenIn)[0];
      const tokenOutMatch = searchToken(tokenOut)[0];

      if (!tokenInMatch || !tokenOutMatch) {
        return {
          error: `Unable to find token(s) tokenInMatch: ${tokenInMatch?.name} tokenOutMatch: ${tokenOutMatch?.name}`,
        };
      }

      const [tokenInData, tokenOutData] = await Promise.all([
        ftGetTokenMetadata(tokenInMatch.id),
        ftGetTokenMetadata(tokenOutMatch.id),
      ]);

      if (tokenInData.id === WRAP_NEAR_CONTRACT_ID && isNearOut) {
        return transformTransactions(
          [nearWithdrawTransaction(quantity)],
          accountId
        );
      }

      if (isNearIn && tokenOutData.id === WRAP_NEAR_CONTRACT_ID) {
        return transformTransactions(
          [nearDepositTransaction(quantity)],
          accountId
        );
      }

      if (tokenInData.id === tokenOutData.id && isNearIn === isNearOut) {
        return { error: "TokenIn and TokenOut cannot be the same" };
      }

      const refEstimateSwap = (enableSmartRouting: boolean) => {
        return estimateSwap({
          tokenIn: tokenInData,
          tokenOut: tokenOutData,
          amountIn: quantity,
          simplePools,
          options: {
            enableSmartRouting,
            stablePools,
            stablePoolsDetail,
          },
        });
      };
      const swapTodos: EstimateSwapView[] = await refEstimateSwap(true).catch(
        () => {
          return refEstimateSwap(false); // fallback to non-smart routing if unsupported
        }
      );

      const transactionsRef: Transaction[] = await instantSwap({
        tokenIn: tokenInData,
        tokenOut: tokenOutData,
        amountIn: quantity,
        swapTodos,
        slippageTolerance: 0.05,
        AccountId: accountId,
        referralId: "mintbase.near",
      });

      if (isNearIn) {
        // wrap near
        transactionsRef.splice(-1, 0, nearDepositTransaction(quantity));
      }

      if (isNearOut) {
        // unwrap near
        const lastFunctionCall = transactionsRef[transactionsRef.length - 1]
          .functionCalls[0] as {
            args: {
              msg: string;
            };
          };
        const parsedActions = JSON.parse(lastFunctionCall.args.msg);
        parsedActions["skip_unwrap_near"] = false;
        lastFunctionCall.args.msg = JSON.stringify(parsedActions);
      }

      return transformTransactions(transactionsRef, accountId);
    }
  )
  .compile();

export const GET = app.handle;
export const POST = app.handle;
