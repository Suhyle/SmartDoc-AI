import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();

// ==========================================================
// BASIC SERVER SETTINGS
// ==========================================================

app.use(cors());

app.use(
  express.json({
    limit: "100mb",
  })
);

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ==========================================================
// ERROR HELPER
// ==========================================================

function sendError(res, status, message, details = "") {
  return res.status(status).json({
    error: message,
    ...(details ? { details } : {}),
  });
}

// ==========================================================
// AI CLIENTS
// ==========================================================

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY;

// ==========================================================
// AI MODELS
// ==========================================================

const GEMINI_MODEL = "gemini-3.5-flash";

const OPENROUTER_MODEL =
  "openai/gpt-oss-120b:free";

const GROQ_MODEL =
  "llama-3.3-70b-versatile";

// ==========================================================
// PROVIDERS
// ==========================================================

const PROVIDERS = {
  GEMINI: "SmartDoc AI 1",
  OPENROUTER: "SmartDoc AI 2",
  GROQ: "SmartDoc AI 3",
};

// ==========================================================
// CONFIGURATION
// ==========================================================

// Size of each document section sent to AI
const CHUNK_SIZE = 7000;

// Number of summaries combined at one time
const SUMMARY_GROUP_SIZE = 4;

// Delay between AI requests
const REQUEST_DELAY = 1200;

// Maximum document size
const MAX_DOCUMENT_CHARACTERS = 20000000;

// Maximum question size
const MAX_QUESTION_CHARACTERS = 10000;

// ==========================================================
// WAIT
// ==========================================================

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ==========================================================
// PROVIDER TRACKING
// ==========================================================

function recordProvider(provider, tracker) {
  if (tracker) {
    tracker.push(provider);
  }
}

function getGeneratedBy(tracker) {
  if (!tracker || tracker.length === 0) {
    return "SmartDoc AI";
  }

  return tracker[tracker.length - 1];
}

function getProvidersUsed(tracker) {
  if (!tracker) {
    return [];
  }

  return [...new Set(tracker)];
}

// ==========================================================
// DOCUMENT CLEANING
// ==========================================================

function normalizeDocumentText(text) {
  if (typeof text !== "string") {
    return "";
  }

  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

// ==========================================================
// DOCUMENT VALIDATION
// ==========================================================

function validateDocument(text) {
  const documentText =
    normalizeDocumentText(text);

  if (!documentText) {
    const error = new Error(
      "No readable text was extracted from the document."
    );

    error.status = 400;

    throw error;
  }

  if (
    documentText.length >
    MAX_DOCUMENT_CHARACTERS
  ) {
    const error = new Error(
      "Document is too large for the current server limit."
    );

    error.status = 413;

    throw error;
  }

  return documentText;
}

// ==========================================================
// QUESTION CLEANING
// ==========================================================

function normalizeQuestion(question) {
  return String(question || "")
    .trim()
    .slice(0, MAX_QUESTION_CHARACTERS);
}

// ==========================================================
// DOCUMENT INFORMATION
// ==========================================================

function getDocumentStats(documentText) {
  const words =
    documentText
      .split(/\s+/)
      .filter(Boolean).length;

  return {
    characters: documentText.length,
    words,
    estimatedPages: Math.max(
      1,
      Math.ceil(documentText.length / 3000)
    ),
  };
}

// ==========================================================
// SPLIT LARGE DOCUMENT
// ==========================================================

function splitDocument(
  text,
  chunkSize = CHUNK_SIZE
) {
  const documentText =
    normalizeDocumentText(text);

  if (!documentText) {
    return [];
  }

  const chunks = [];

  let start = 0;

  while (start < documentText.length) {
    let end = Math.min(
      start + chunkSize,
      documentText.length
    );

    if (end < documentText.length) {

      // Try paragraph boundary
      const paragraphBreak =
        documentText.lastIndexOf(
          "\n\n",
          end
        );

      if (
        paragraphBreak >
        start + chunkSize * 0.55
      ) {
        end = paragraphBreak;
      }

      // Try sentence boundary
      else {
        const sentenceBreak =
          documentText.lastIndexOf(
            ".",
            end
          );

        if (
          sentenceBreak >
          start + chunkSize * 0.55
        ) {
          end =
            sentenceBreak + 1;
        }

        // Otherwise try space
        else {
          const spaceBreak =
            documentText.lastIndexOf(
              " ",
              end
            );

          if (
            spaceBreak >
            start + chunkSize * 0.55
          ) {
            end = spaceBreak;
          }
        }
      }
    }

    const chunk =
      documentText
        .slice(start, end)
        .trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end <= start) {
      end =
        start + chunkSize;
    }

    start = end;
  }

  return chunks;
}

// ==========================================================
// GEMINI
// SMARTDOC AI 1
// ==========================================================

async function askGemini(
  messages,
  options = {}
) {
  try {

    console.log(
      "Trying Gemini - SmartDoc AI 1..."
    );

    const systemMessage =
      messages.find(
        (message) =>
          message.role === "system"
      );

    const userText =
      messages
        .filter(
          (message) =>
            message.role === "user"
        )
        .map(
          (message) =>
            message.content
        )
        .join("\n\n");

    const response =
      await gemini.models.generateContent({

        model:
          GEMINI_MODEL,

        contents:
          userText,

        config: {

          systemInstruction:
            systemMessage?.content ||
            "You are SmartDoc AI.",

          maxOutputTokens:
            options.maxCompletionTokens ||
            4096,
        },
      });

    const content =
      response?.text;

    if (!content) {
      throw new Error(
        "Gemini returned an empty response."
      );
    }

    recordProvider(
      PROVIDERS.GEMINI,
      options.providerTracker
    );

    console.log(
      "Gemini succeeded."
    );

    return content.trim();

  } catch (error) {

    console.error(
      "Gemini failed:",
      error?.message ||
        error
    );

    throw error;
  }
}

// ==========================================================
// OPENROUTER
// SMARTDOC AI 2
// ==========================================================

async function askOpenRouter(
  messages,
  options = {}
) {
  try {

    console.log(
      "Trying OpenRouter - SmartDoc AI 2..."
    );

    if (!OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is missing."
      );
    }

    const response =
      await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",

          headers: {

            Authorization:
              `Bearer ${OPENROUTER_API_KEY}`,

            "Content-Type":
              "application/json",

            "HTTP-Referer":
              "http://localhost:5173",

            "X-Title":
              "SmartDoc AI",
          },

          body: JSON.stringify({

            model:
              OPENROUTER_MODEL,

            messages,

            temperature: 0.2,

            max_tokens:
              options.maxCompletionTokens ||
              4096,
          }),
        }
      );

    const rawResponse =
      await response.text();

    let data = {};

    try {

      data =
        rawResponse
          ? JSON.parse(
              rawResponse
            )
          : {};

    } catch {

      throw new Error(
        `OpenRouter returned invalid JSON. HTTP ${response.status}`
      );
    }

    if (!response.ok) {

      throw new Error(
        data?.error?.message ||
        `OpenRouter failed. HTTP ${response.status}`
      );
    }

    const content =
      data
        ?.choices?.[0]
        ?.message?.content;

    if (!content) {
      throw new Error(
        "OpenRouter returned an empty response."
      );
    }

    recordProvider(
      PROVIDERS.OPENROUTER,
      options.providerTracker
    );

    console.log(
      "OpenRouter succeeded."
    );

    return content.trim();

  } catch (error) {

    console.error(
      "OpenRouter failed:",
      error?.message ||
        error
    );

    throw error;
  }
}

// ==========================================================
// GROQ
// SMARTDOC AI 3
// ==========================================================

async function askGroq(
  messages,
  options = {}
) {
  try {

    console.log(
      "Trying Groq - SmartDoc AI 3..."
    );

    const response =
      await groq.chat.completions.create({

        model:
          GROQ_MODEL,

        messages,

        temperature: 0.2,

        max_completion_tokens:
          options.maxCompletionTokens ||
          4096,
      });

    const content =
      response
        ?.choices?.[0]
        ?.message?.content;

    if (!content) {
      throw new Error(
        "Groq returned an empty response."
      );
    }

    recordProvider(
      PROVIDERS.GROQ,
      options.providerTracker
    );

    console.log(
      "Groq succeeded."
    );

    return content.trim();

  } catch (error) {

    console.error(
      "Groq failed:",
      error?.message ||
        error
    );

    throw error;
  }
}

// ==========================================================
// CENTRAL AI FALLBACK
//
// Gemini
//    ↓
// OpenRouter
//    ↓
// Groq
//    ↓
// Error
// ==========================================================

async function askAI(
  messages,
  options = {}
) {

  // --------------------------------------------------------
  // GEMINI
  // --------------------------------------------------------

  try {

    const result =
      await askGemini(
        messages,
        options
      );

    if (result) {
      return result;
    }

  } catch {

    console.log(
      "Switching from Gemini to OpenRouter..."
    );
  }

  // --------------------------------------------------------
  // OPENROUTER
  // --------------------------------------------------------

  try {

    const result =
      await askOpenRouter(
        messages,
        options
      );

    if (result) {
      return result;
    }

  } catch {

    console.log(
      "Switching from OpenRouter to Groq..."
    );
  }

  // --------------------------------------------------------
  // GROQ
  // --------------------------------------------------------

  try {

    const result =
      await askGroq(
        messages,
        options
      );

    if (result) {
      return result;
    }

  } catch {

    console.log(
      "Groq also failed."
    );
  }

  throw new Error(
    "All available AI APIs are currently unavailable."
  );
}

// ==========================================================
// SUMMARIZE ONE CHUNK
// ==========================================================

async function summarizeChunk(
  chunk,
  index,
  total,
  options = {}
) {

  console.log(
    `Processing chunk ${index}/${total}`
  );

  const prompt = `

You are SmartDoc AI.

You are processing PART ${index} OF ${total}
of a larger document.

Create a detailed and accurate Malayalam
summary of this document section.

IMPORTANT RULES:

- Use ONLY information in this section.
- Do NOT add outside information.
- Do NOT invent facts.
- Preserve names.
- Preserve dates.
- Preserve numbers.
- Preserve definitions.
- Preserve examples.
- Preserve procedures.
- Preserve findings.
- Preserve conclusions.
- Explain important concepts clearly.
- Use simple natural Malayalam.
- Keep important English technical terms when necessary.
- Avoid unnecessary repetition.
- Do not use Markdown symbols.

DOCUMENT SECTION:

${chunk}

Now create the detailed Malayalam summary.
`;

  return askAI(
    [
      {
        role: "system",

        content:
          "You are SmartDoc AI, an accurate Malayalam document summarization assistant.",
      },

      {
        role: "user",

        content:
          prompt,
      },
    ],

    {
      maxCompletionTokens:
        4096,

      providerTracker:
        options.providerTracker,
    }
  );
}

// ==========================================================
// COMBINE SUMMARIES
// ==========================================================

async function combineSummaries(
  summaries,
  options = {}
) {

  if (summaries.length === 1) {
    return summaries[0];
  }

  const combinedText =
    summaries
      .map(
        (summary, index) =>
          `SECTION ${index + 1}:\n${summary}`
      )
      .join("\n\n");

  const prompt = `

You are SmartDoc AI.

The following are summaries of
different sections of the SAME document.

Combine them into ONE detailed,
accurate Malayalam summary.

IMPORTANT RULES:

- Use ONLY the provided summaries.
- Do NOT add outside information.
- Do NOT invent facts.
- Preserve important information.
- Remove unnecessary repetition.
- Combine related information.
- Preserve names.
- Preserve dates.
- Preserve numbers.
- Preserve definitions.
- Preserve examples.
- Preserve procedures.
- Preserve findings.
- Preserve conclusions.
- Use simple Malayalam.
- Keep important English technical terms.
- Do not use Markdown symbols.

Suggested structure:

മലയാളം സംഗ്രഹം

1. പ്രധാന വിഷയം

2. പ്രധാന ആശയങ്ങൾ

3. പ്രധാന വിവരങ്ങൾ

4. വിശദമായ വിശദീകരണം

5. പ്രധാന പോയിന്റുകൾ

6. പ്രധാന കണ്ടെത്തലുകൾ

7. നിഗമനം

Only use sections that are relevant.

SUMMARIES:

${combinedText}

Now create the final Malayalam summary.
`;

  return askAI(
    [
      {
        role: "system",

        content:
          "You are SmartDoc AI, an accurate Malayalam document summarization assistant.",
      },

      {
        role: "user",

        content:
          prompt,
      },
    ],

    {
      maxCompletionTokens:
        4096,

      providerTracker:
        options.providerTracker,
    }
  );
}

// ==========================================================
// LARGE DOCUMENT SUMMARY
// ==========================================================

async function createLargeDocumentSummary(
  documentText,
  options = {}
) {

  const chunks =
    splitDocument(
      documentText
    );

  console.log(
    "Document characters:",
    documentText.length
  );

  console.log(
    "Document chunks:",
    chunks.length
  );

  // --------------------------------------------------------
  // SMALL DOCUMENT
  // --------------------------------------------------------

  if (chunks.length === 1) {

    const prompt = `

You are SmartDoc AI.

Read this document carefully and
create a detailed Malayalam summary.

RULES:

- Use ONLY the document.
- Do NOT add outside information.
- Do NOT invent facts.
- Preserve important names.
- Preserve dates.
- Preserve numbers.
- Preserve definitions.
- Preserve examples.
- Preserve procedures.
- Preserve findings.
- Preserve conclusions.
- Explain important concepts.
- Use simple Malayalam.
- Keep important English technical terms.
- Avoid unnecessary repetition.
- Do not use Markdown symbols.

DOCUMENT:

${documentText}

Now provide the detailed Malayalam summary.
`;

    return askAI(
      [
        {
          role: "system",

          content:
            "You are SmartDoc AI, an accurate Malayalam document summarization assistant.",
        },

        {
          role: "user",

          content:
            prompt,
        },
      ],

      {
        maxCompletionTokens:
          4096,

        providerTracker:
          options.providerTracker,
      }
    );
  }

  // --------------------------------------------------------
  // LARGE DOCUMENT
  // --------------------------------------------------------

  const chunkSummaries = [];

  for (
    let i = 0;
    i < chunks.length;
    i++
  ) {

    const summary =
      await summarizeChunk(
        chunks[i],
        i + 1,
        chunks.length,
        options
      );

    chunkSummaries.push(
      summary
    );

    if (
      i <
      chunks.length - 1
    ) {

      await sleep(
        REQUEST_DELAY
      );
    }
  }

  console.log(
    "All chunks summarized."
  );

  // --------------------------------------------------------
  // HIERARCHICAL COMBINATION
  // --------------------------------------------------------

  let current =
    chunkSummaries;

  while (
    current.length > 1
  ) {

    const next = [];

    for (
      let i = 0;
      i < current.length;
      i += SUMMARY_GROUP_SIZE
    ) {

      const group =
        current.slice(
          i,
          i + SUMMARY_GROUP_SIZE
        );

      const combined =
        await combineSummaries(
          group,
          options
        );

      next.push(
        combined
      );

      if (
        i + SUMMARY_GROUP_SIZE <
        current.length
      ) {

        await sleep(
          REQUEST_DELAY
        );
      }
    }

    current =
      next;
  }

  return current[0];
}

// ==========================================================
// HOME / TEST API
// ==========================================================

app.get(
  "/api",
  (req, res) => {

    res.json({

      success: true,

      message:
        "SmartDoc AI server is running.",
    });
  }
);

// ==========================================================
// HEALTH CHECK
// ==========================================================

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      service:
        "SmartDoc AI API",

      status:
        "online",

      endpoints: {

        summary:
          "/api/summarize",

        ask:
          "/api/ask",
      },
    });
  }
);

// ==========================================================
// MALAYALAM SUMMARY API
// ==========================================================

app.post(
  "/api/summarize",

  async (req, res) => {

    try {

      const documentText =
        validateDocument(
          req.body?.documentText
        );

      const stats =
        getDocumentStats(
          documentText
        );

      console.log(
        "================================"
      );

      console.log(
        "New summary request"
      );

      console.log(
        "Characters:",
        stats.characters
      );

      console.log(
        "Estimated pages:",
        stats.estimatedPages
      );

      console.log(
        "================================"
      );

      const providerTracker =
        [];

      const summary =
        await createLargeDocumentSummary(
          documentText,
          {
            providerTracker,
          }
        );

      if (!summary) {

        return sendError(
          res,
          500,
          "No summary was generated."
        );
      }

      return res.json({

        success: true,

        summary,

        document:
          stats,

        generatedBy:
          getGeneratedBy(
            providerTracker
          ),

        providersUsed:
          getProvidersUsed(
            providerTracker
          ),
      });

    } catch (error) {

      console.error(
        "Summary Error:",
        error
      );

      return sendError(

        res,

        error?.status || 500,

        error?.status === 413
          ? error.message
          : "AI failed to generate the summary.",

        error?.message ||
          "Unknown error."
      );
    }
  }
);

// ==========================================================
// ASK QUESTION ABOUT DOCUMENT
// ==========================================================

app.post(
  "/api/ask",

  async (req, res) => {

    try {

      const question =
        normalizeQuestion(
          req.body?.question
        );

      const documentText =
        validateDocument(
          req.body?.documentText
        );

      if (!question) {

        return sendError(
          res,
          400,
          "Question is required."
        );
      }

      const providerTracker =
        [];

      const chunks =
        splitDocument(
          documentText
        );

      // ------------------------------------------------------
      // SMALL DOCUMENT
      // ------------------------------------------------------

      if (chunks.length === 1) {

        const prompt = `

You are SmartDoc AI.

Answer the question using ONLY
information from the document.

RULES:

- Do NOT add outside information.
- Do NOT invent facts.
- If the answer is not present,
  say:

"The answer is not available
in the provided document."

- If the question is in Malayalam,
  answer in Malayalam.
- Keep the answer simple.
- Preserve important names,
  dates and numbers.
- Do not use Markdown symbols.

DOCUMENT:

${documentText}

QUESTION:

${question}

Now answer the question.
`;

        const answer =
          await askAI(

            [
              {
                role: "system",

                content:
                  "You are SmartDoc AI, an accurate document question-answering assistant.",
              },

              {
                role: "user",

                content:
                  prompt,
              },
            ],

            {
              maxCompletionTokens:
                4096,

              providerTracker,
            }
          );

        return res.json({

          success: true,

          answer,

          generatedBy:
            getGeneratedBy(
              providerTracker
            ),

          providersUsed:
            getProvidersUsed(
              providerTracker
            ),
        });
      }

      // ------------------------------------------------------
      // LARGE DOCUMENT
      // ------------------------------------------------------

      // Find chunks that are likely related
      // to the user's question.

      const terms =
        [
          ...new Set(

            question
              .toLowerCase()

              .replace(
                /[^\p{L}\p{N}\s]/gu,
                " "
              )

              .split(/\s+/)

              .filter(
                (word) =>
                  word.length >= 3
              )
          ),
        ];

      const scoredChunks =
        chunks
          .map(
            (
              chunk,
              index
            ) => {

              const lower =
                chunk.toLowerCase();

              let score = 0;

              for (
                const term
                of terms
              ) {

                let position =
                  lower.indexOf(
                    term
                  );

                while (
                  position !== -1
                ) {

                  score++;

                  position =
                    lower.indexOf(
                      term,
                      position +
                        term.length
                    );
                }
              }

              return {
                chunk,
                index,
                score,
              };
            }
          )

          .sort(
            (a, b) =>
              b.score - a.score
          );

      // Maximum 12 relevant sections
      const selected =
        scoredChunks
          .slice(
            0,
            Math.min(
              12,
              scoredChunks.length
            )
          )
          .filter(
            (item) =>
              item.score > 0
          );

      // If no keyword match,
      // use first few chunks.
      const candidates =
        selected.length > 0
          ? selected
          : scoredChunks.slice(
              0,
              Math.min(
                4,
                scoredChunks.length
              )
            );

      console.log(
        "Total chunks:",
        chunks.length
      );

      console.log(
        "Selected chunks:",
        candidates.length
      );

      // ------------------------------------------------------
      // ASK AI ABOUT RELEVANT CHUNKS
      // ------------------------------------------------------

      const relevantAnswers =
        [];

      for (
        let i = 0;
        i < candidates.length;
        i++
      ) {

        const item =
          candidates[i];

        const prompt = `

You are SmartDoc AI.

Check whether this document
section contains information
that can answer the question.

QUESTION:

${question}

DOCUMENT SECTION:

${item.chunk}

RULES:

- Use ONLY this section.
- Do NOT use outside knowledge.
- Do NOT invent facts.
- If this section is not useful,
  reply exactly:

NOT_RELEVANT

- If useful, provide the
  relevant information.
- If question is in Malayalam,
  answer in Malayalam.
- Do not use Markdown symbols.
`;

        const answer =
          await askAI(

            [
              {
                role: "system",

                content:
                  "You are SmartDoc AI, an accurate document retrieval assistant.",
              },

              {
                role: "user",

                content:
                  prompt,
              },
            ],

            {
              maxCompletionTokens:
                2048,

              providerTracker,
            }
          );

        if (
          answer &&
          answer
            .trim()
            .toUpperCase() !==
            "NOT_RELEVANT"
        ) {

          relevantAnswers.push(

            `DOCUMENT SECTION ${
              item.index + 1
            }:

${answer}`
          );
        }

        if (
          i <
          candidates.length - 1
        ) {

          await sleep(
            REQUEST_DELAY
          );
        }
      }

      // ------------------------------------------------------
      // NO ANSWER
      // ------------------------------------------------------

      if (
        relevantAnswers.length === 0
      ) {

        return res.json({

          success: true,

          answer:
            "The answer is not available in the provided document.",

          generatedBy:
            getGeneratedBy(
              providerTracker
            ),

          providersUsed:
            getProvidersUsed(
              providerTracker
            ),
        });
      }

      // ------------------------------------------------------
      // FINAL ANSWER
      // ------------------------------------------------------

      const finalPrompt = `

You are SmartDoc AI.

Answer the user's question using
ONLY the information retrieved
from the document.

QUESTION:

${question}

RELEVANT DOCUMENT INFORMATION:

${relevantAnswers.join(
  "\n\n"
)}

RULES:

- Do NOT add outside information.
- Do NOT invent facts.
- Combine the information accurately.
- Remove repetition.
- Include important details.
- Preserve names.
- Preserve dates.
- Preserve numbers.
- If the answer is not available,
  say:

"The answer is not available
in the provided document."

- If the question is in Malayalam,
  answer completely in Malayalam.
- Keep the answer simple.
- Do not use Markdown symbols.

Now provide the final answer.
`;

      const finalAnswer =
        await askAI(

          [
            {
              role: "system",

              content:
                "You are SmartDoc AI, an accurate Malayalam document question-answering assistant.",
            },

            {
              role: "user",

              content:
                finalPrompt,
            },
          ],

          {
            maxCompletionTokens:
              4096,

            providerTracker,
          }
        );

      return res.json({

        success: true,

        answer:
          finalAnswer,

        generatedBy:
          getGeneratedBy(
            providerTracker
          ),

        providersUsed:
          getProvidersUsed(
            providerTracker
          ),
      });

    } catch (error) {

      console.error(
        "Ask Error:",
        error
      );

      return sendError(

        res,

        error?.status || 500,

        "AI failed to answer the question.",

        error?.message ||
          "Unknown error."
      );
    }
  }
);

// ==========================================================
// EXPORT SERVER
// ==========================================================

export default app;