import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { TypeSafeClient, choice } from "@typesafe-ai/sdk";
import { z } from "zod";

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY is missing");
const router = createOpenRouter({ apiKey: key });
const jev = new TypeSafeClient({
  apiKey: key,
  baseURL: "https://openrouter.ai/api",
});
const start = performance.now();
const luna = await generateText({
  model: router("~openai/gpt-luna-latest"),
  output: Output.object({
    schema: z.object({
      dilemma: z.string(),
      left: z.string(),
      right: z.string(),
    }),
  }),
  prompt:
    "Write one sharp political game crisis in a Mars colony. Max 40 words. Two viable options under 7 words each. No explanatory text.",
  maxOutputTokens: 450,
  maxRetries: 0,
  abortSignal: AbortSignal.timeout(45000),
});
console.log(
  JSON.stringify({
    model: "luna",
    ms: Math.round(performance.now() - start),
    card: luna.output,
    usage: luna.usage,
    cost: (luna.providerMetadata?.openrouter as any)?.usage?.cost,
  }),
);
const t = performance.now();
const score = await jev.systemOne({
  model: "jev-latest",
  state: {
    card: luna.output,
    faction: {
      name: "Life support crews",
      priorities: ["safe working conditions", "equal oxygen access"],
    },
  },
  questions: {
    left: choice(
      "How does faction support for the ruler change after card.left?",
      {
        oppose: "Harms their priorities",
        neutral: "No material effect",
        support: "Benefits their priorities",
      },
    ),
    right: choice(
      "How does faction support for the ruler change after card.right?",
      {
        oppose: "Harms their priorities",
        neutral: "No material effect",
        support: "Benefits their priorities",
      },
    ),
  },
});
console.log(
  JSON.stringify({
    model: "jev",
    ms: Math.round(performance.now() - t),
    result: score,
  }),
);
