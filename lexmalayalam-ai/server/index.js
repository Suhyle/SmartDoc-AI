import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { GoogleGenAI } from "@google/genai";
import { YoutubeTranscript } from "youtube-transcript";

dotenv.config();

// ==========================================================
// EXPRESS APP
// ==========================================================

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

// ==========================================================
// ENVIRONMENT VARIABLES
// ==========================================================

const PORT = process.env.PORT || 5000;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const GROQ_API_KEY =
  process.env.GROQ_API_KEY;

const CEREBRAS_API_KEY =
  process.env.CEREBRAS_API_KEY;

// ==========================================================
// AI CLIENTS
// ==========================================================

const gemini = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

const groq = new Groq({
  apiKey: GROQ_API_KEY,
});

const cerebras = new Cerebras({
  apiKey: CEREBRAS_API_KEY,
});

// ==========================================================
// AI MODELS
// ==========================================================

const GEMINI_MODEL =
  "gemini-3.5-flash";

const CEREBRAS_MODEL =
  "gpt-oss-120b";

const GROQ_MODEL =
  "llama-3.3-70b-versatile";

// ==========================================================
// PROVIDER NAMES
// ==========================================================

const PROVIDERS = {
  GEMINI: "SmartDoc AI 1",
  CEREBRAS: "SmartDoc AI 2",
  GROQ: "SmartDoc AI 3",
};

// ==========================================================
// HELPER - RECORD PROVIDER
// ==========================================================

function recordProvider(
  provider,
  tracker
) {
  if (tracker) {
    tracker.push(provider);
  }
}

// ==========================================================
// GEMINI
// ==========================================================

async function askGemini(
  messages,
  options = {}
) {
  console.log(
    "Trying Gemini..."
  );

  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing."
    );
  }

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
      model: GEMINI_MODEL,

      contents: userText,

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
}

// ==========================================================
// CEREBRAS
// ==========================================================

async function askCerebras(
  messages,
  options = {}
) {
  console.log(
    "Trying Cerebras..."
  );

  if (!CEREBRAS_API_KEY) {
    throw new Error(
      "CEREBRAS_API_KEY is missing."
    );
  }

  const response =
    await cerebras.chat.completions.create({
      model: CEREBRAS_MODEL,

      messages,

      temperature: 0.2,

      // Cerebras fallback limit.
      // The current free tier supports a much larger
      // token-per-minute allowance than Groq.
      max_completion_tokens:
        Math.min(
          options.maxCompletionTokens || 8192,
          8192
        ),
    });

  const content =
    response?.choices?.[0]?.message
      ?.content;

  if (!content) {
    throw new Error(
      "Cerebras returned an empty response."
    );
  }

  recordProvider(
    PROVIDERS.CEREBRAS,
    options.providerTracker
  );

  console.log(
    "Cerebras succeeded."
  );

  return content.trim();
}

// ==========================================================
// GROQ
// ==========================================================

async function askGroq(
  messages,
  options = {}
) {
  console.log(
    "Trying Groq..."
  );

  if (!GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is missing."
    );
  }

  const response =
    await groq.chat.completions.create({
      model: GROQ_MODEL,

      messages,

      temperature: 0.2,

      // Keep Groq fallback output limited.
      // This helps reduce the chance of the previous
      // tokens-per-minute / request-too-large error.
      max_completion_tokens:
        Math.min(
          options.maxCompletionTokens || 4096,
          4096
        ),
    });

  const content =
    response?.choices?.[0]?.message
      ?.content;

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
}

// ==========================================================
// CENTRAL AI FALLBACK
//
// Gemini
//    ↓
// Cerebras
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

  } catch (error) {

    console.error(
      "Gemini failed:",
      error?.message ||
        error
    );

    console.log(
      "Switching to Cerebras..."
    );
  }

  // --------------------------------------------------------
  // CEREBRAS
  // --------------------------------------------------------

  try {

    const result =
      await askCerebras(
        messages,
        options
      );

    if (result) {
      return result;
    }

  } catch (error) {

    console.error(
      "Cerebras failed:",
      error?.message ||
        error
    );

    console.log(
      "Switching to Groq..."
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

  } catch (error) {

    console.error(
      "Groq failed:",
      error?.message ||
        error
    );
  }

  throw new Error(
    "All SmartDoc AI providers are currently unavailable."
  );
}

// ==========================================================
// YOUTUBE VIDEO ID HELPER
// ==========================================================

function getYouTubeVideoId(
  videoUrl
) {

  try {

    const url =
      new URL(videoUrl);

    const hostname =
      url.hostname.toLowerCase();

    // ------------------------------------------------------
    // youtube.com/watch?v=VIDEO_ID
    // ------------------------------------------------------

    if (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com"
    ) {

      const watchId =
        url.searchParams.get("v");

      if (watchId) {
        return watchId;
      }
    }

    // ------------------------------------------------------
    // youtu.be/VIDEO_ID
    // ------------------------------------------------------

    if (
      hostname === "youtu.be"
    ) {

      const id =
        url.pathname
          .split("/")
          .filter(Boolean)[0];

      if (id) {
        return id;
      }
    }

    // ------------------------------------------------------
    // youtube.com/shorts/VIDEO_ID
    // ------------------------------------------------------

    if (
      url.pathname.startsWith(
        "/shorts/"
      )
    ) {

      const id =
        url.pathname
          .split("/shorts/")[1]
          ?.split("/")[0];

      if (id) {
        return id;
      }
    }

    // ------------------------------------------------------
    // youtube.com/embed/VIDEO_ID
    // ------------------------------------------------------

    if (
      url.pathname.startsWith(
        "/embed/"
      )
    ) {

      const id =
        url.pathname
          .split("/embed/")[1]
          ?.split("/")[0];

      if (id) {
        return id;
      }
    }

    return null;

  } catch {

    return null;
  }
}

// ==========================================================
// TRANSCRIPT TIME HELPERS
// ==========================================================

function timeToSeconds(
  time
) {

  if (
    time === null ||
    time === undefined
  ) {
    return 0;
  }

  const value =
    String(time).trim();

  if (!value) {
    return 0;
  }

  // Plain number = seconds

  if (
    /^\d+(?:\.\d+)?$/.test(
      value
    )
  ) {

    return Number(value);
  }

  const parts =
    value
      .split(":")
      .map(Number);

  if (
    parts.some(
      (part) =>
        !Number.isFinite(part)
    )
  ) {

    return NaN;
  }

  // HH:MM:SS

  if (
    parts.length === 3
  ) {

    return (
      parts[0] * 3600 +
      parts[1] * 60 +
      parts[2]
    );
  }

  // MM:SS

  if (
    parts.length === 2
  ) {

    return (
      parts[0] * 60 +
      parts[1]
    );
  }

  return NaN;
}

// ==========================================================
// GET SEGMENT START TIME
// ==========================================================

function getSegmentStartSeconds(
  segment
) {

  const raw =
    Number(
      segment?.offset ??
      segment?.start ??
      0
    );

  if (
    !Number.isFinite(raw)
  ) {
    return 0;
  }

  /*
    youtube-transcript returns
    offset in milliseconds.
  */

  return raw / 1000;
}

// ==========================================================
// GET SEGMENT DURATION
// ==========================================================

function getSegmentDurationSeconds(
  segment
) {

  const raw =
    Number(
      segment?.duration ??
      0
    );

  if (
    !Number.isFinite(raw)
  ) {
    return 0;
  }

  /*
    youtube-transcript returns
    duration in milliseconds.
  */

  return raw / 1000;
}

// ==========================================================
// GET FULL TRANSCRIPT DURATION
// ==========================================================

function getTranscriptDurationSeconds(
  segments
) {

  if (
    !Array.isArray(
      segments
    ) ||
    segments.length === 0
  ) {

    return 0;
  }

  let maxEnd = 0;

  for (
    const segment of segments
  ) {

    const start =
      getSegmentStartSeconds(
        segment
      );

    const duration =
      getSegmentDurationSeconds(
        segment
      );

    const end =
      start + duration;

    if (
      Number.isFinite(end)
    ) {

      maxEnd =
        Math.max(
          maxEnd,
          end
        );
    }
  }

  return maxEnd;
}

// ==========================================================
// FORMAT SECONDS AS VIDEO DURATION
// ==========================================================

function formatSecondsAsDuration(
  seconds
) {

  if (
    !Number.isFinite(seconds) ||
    seconds < 0
  ) {

    return "";
  }

  const totalSeconds =
    Math.round(seconds);

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
      60
    );

  const remainingSeconds =
    totalSeconds % 60;

  if (
    hours > 0
  ) {

    return [
      String(hours).padStart(
        2,
        "0"
      ),
      String(minutes).padStart(
        2,
        "0"
      ),
      String(
        remainingSeconds
      ).padStart(
        2,
        "0"
      ),
    ].join(":");
  }

  return [
    String(minutes).padStart(
      2,
      "0"
    ),
    String(
      remainingSeconds
    ).padStart(
      2,
      "0"
    ),
  ].join(":");
}
// ==========================================================
// APPLY TRANSCRIPT TIME FILTER
// ==========================================================

function applyTranscriptTimeFilter(
  transcriptData,
  transcriptMode,
  startTime,
  endTime,
  durationLimit,
  durationUnit
) {

  if (
    !Array.isArray(transcriptData) ||
    transcriptData.length === 0
  ) {
    return transcriptData || [];
  }

  // --------------------------------------------------------
  // FULL VIDEO
  // --------------------------------------------------------

  if (
    !transcriptMode ||
    transcriptMode === "full"
  ) {
    return transcriptData;
  }

  // --------------------------------------------------------
  // CUSTOM RANGE
  // --------------------------------------------------------

  if (
    transcriptMode === "custom"
  ) {

    const startSeconds =
      timeToSeconds(startTime);

    const endSeconds =
      timeToSeconds(endTime);

    if (
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds)
    ) {
      throw new Error(
        "Please enter valid start and end times in HH:MM:SS or MM:SS format."
      );
    }

    if (
      startSeconds < 0 ||
      endSeconds <= startSeconds
    ) {
      throw new Error(
        "End time must be greater than start time."
      );
    }

    const fullDuration =
      getTranscriptDurationSeconds(
        transcriptData
      );

    if (
      startSeconds >= fullDuration
    ) {
      throw new Error(
        "The selected start time is beyond the available transcript duration."
      );
    }

    const safeEndSeconds =
      Math.min(
        endSeconds,
        fullDuration
      );

    return transcriptData.filter(
      (segment) => {

        const segmentStart =
          getSegmentStartSeconds(
            segment
          );

        const segmentEnd =
          segmentStart +
          getSegmentDurationSeconds(
            segment
          );

        return (
          segmentEnd > startSeconds &&
          segmentStart < safeEndSeconds
        );
      }
    );
  }

  // --------------------------------------------------------
  // DURATION LIMIT
  // --------------------------------------------------------

  if (
    transcriptMode === "duration"
  ) {

    const numericLimit =
      Number(durationLimit);

    if (
      !Number.isFinite(numericLimit) ||
      numericLimit <= 0
    ) {
      throw new Error(
        "Duration limit must be greater than 0."
      );
    }

    const normalizedUnit =
      String(
        durationUnit
      ).toLowerCase();

    const limitSeconds =
      normalizedUnit === "seconds"
        ? numericLimit
        : numericLimit * 60;

    return transcriptData.filter(
      (segment) => {

        const segmentStart =
          getSegmentStartSeconds(
            segment
          );

        return (
          segmentStart <
          limitSeconds
        );
      }
    );
  }

  return transcriptData;
}

// ==========================================================
// SUMMARY OUTPUT CLEANER
// ==========================================================

function cleanSummaryOutput(
  text,
  summaryType = "detailed"
) {

  if (!text) {
    return "";
  }

  let cleaned =
    String(text);

  // REMOVE CODE FENCES

  cleaned =
    cleaned.replace(
      /```(?:markdown|md|text)?/gi,
      ""
    );

  cleaned =
    cleaned.replace(
      /```/g,
      ""
    );

  // REMOVE HORIZONTAL MARKDOWN RULES

  cleaned =
    cleaned.replace(
      /^\s*([-*_]){3,}\s*$/gm,
      ""
    );

  // REMOVE MARKDOWN HEADINGS

  cleaned =
    cleaned.replace(
      /^\s*#{1,6}\s+/gm,
      ""
    );

  // REMOVE BOLD MARKERS

  cleaned =
    cleaned.replace(
      /\*\*(.*?)\*\*/g,
      "$1"
    );

  cleaned =
    cleaned.replace(
      /__(.*?)__/g,
      "$1"
    );

  // REMOVE ITALIC MARKERS

  cleaned =
    cleaned.replace(
      /(^|[^\w])\*([^\n*]+)\*(?=\s|$)/g,
      "$1$2"
    );

  cleaned =
    cleaned.replace(
      /(^|[^\w])_([^\n_]+)_(?=\s|$)/g,
      "$1$2"
    );

  // CONVERT MARKDOWN BULLETS

  cleaned =
    cleaned.replace(
      /^\s*[-*+]\s+/gm,
      "• "
    );

  // KEEP NUMBERED LISTS CLEAN

  cleaned =
    cleaned.replace(
      /^\s{0,3}\d+\.\s+/gm,
      (match) => {

        const number =
          match.match(
            /\d+/
          )?.[0] || "";

        return `${number}. `;
      }
    );

  // REMOVE BLOCKQUOTE MARKERS

  cleaned =
    cleaned.replace(
      /^\s*>\s?/gm,
      ""
    );

  // REMOVE EXTRA SEPARATORS

  cleaned =
    cleaned.replace(
      /^\s*[-_=]{3,}\s*$/gm,
      ""
    );

  // REMOVE EXCESSIVE BLANK LINES

  cleaned =
    cleaned.replace(
      /\n{3,}/g,
      "\n\n"
    );

  // REMOVE SPACES BEFORE PUNCTUATION

  cleaned =
    cleaned.replace(
      /\s+([,.!?;:])/g,
      "$1"
    );

  // REMOVE UNNECESSARY SPACES

  cleaned =
    cleaned.replace(
      /[ \t]{2,}/g,
      " "
    );

  // FIX BULLET SPACING

  cleaned =
    cleaned.replace(
      /•\s+/g,
      "• "
    );

  // REMOVE EMPTY BULLETS

  cleaned =
    cleaned.replace(
      /^\s*•\s*$/gm,
      ""
    );

  // TRIM EACH LINE

  cleaned =
    cleaned
      .split("\n")
      .map(
        (line) =>
          line.trim()
      )
      .join("\n");

  // FINAL BLANK-LINE CLEANUP

  cleaned =
    cleaned.replace(
      /\n{3,}/g,
      "\n\n"
    );

  return cleaned.trim();
}

// ==========================================================
// BASIC API
// ==========================================================

app.get(
  "/api",
  (req, res) => {

    res.json({

      success: true,

      message:
        "SmartDoc AI backend is running.",
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
        "SmartDoc AI",

      status:
        "online",

      aiProviders: [

        PROVIDERS.GEMINI,

        PROVIDERS.CEREBRAS,

        PROVIDERS.GROQ,
      ],
    });
  }
);

// ==========================================================
// TEST AI ENDPOINT
// ==========================================================

app.post(
  "/api/test-ai",
  async (req, res) => {

    try {

      const message =
        String(
          req.body?.message || ""
        ).trim();

      if (!message) {

        return res.status(400).json({

          success: false,

          error:
            "Message is required.",
        });
      }

      const providerTracker =
        [];

      const response =
        await askAI(

          [

            {
              role: "system",

              content:
                "You are SmartDoc AI. Give a short, accurate response.",
            },

            {
              role: "user",

              content:
                message,
            },

          ],

          {

            maxCompletionTokens:
              1024,

            providerTracker,
          }
        );

      return res.json({

        success: true,

        response,

        generatedBy:
          providerTracker[
            providerTracker.length - 1
          ] ||
          "SmartDoc AI",

        providersUsed: [
          ...new Set(
            providerTracker
          ),
        ],
      });

    } catch (error) {

      console.error(
        "AI Test Error:",
        error?.message || error
      );

      return res.status(500).json({

        success: false,

        error:
          "AI request failed.",

        details:
          error?.message ||
          "Unknown error.",
      });
    }
  }
);

// ==========================================================
// REAL YOUTUBE TRANSCRIPT ENDPOINT
// ==========================================================

app.post(
  "/api/transcript",
  async (req, res) => {

    try {

      const {

        videoUrl,

        // Backward compatibility.
        language =
          "English",

        // Transcript settings.
        transcriptMode =
          "full",

        startTime =
          "00:00:00",

        endTime =
          "00:15:00",

        durationLimit =
          15,

        durationUnit =
          "minutes",

        additionalOptions = {},

      } = req.body;

      // ------------------------------------------------------
      // CHECK URL
      // ------------------------------------------------------

      if (!videoUrl) {

        return res.status(400).json({

          success: false,

          error:
            "YouTube video URL is required.",
        });
      }

      // ------------------------------------------------------
      // GET VIDEO ID
      // ------------------------------------------------------

      const videoId =
        getYouTubeVideoId(
          videoUrl
        );

      if (!videoId) {

        return res.status(400).json({

          success: false,

          error:
            "Invalid YouTube video URL.",
        });
      }

      console.log(
        "========================================"
      );

      console.log(
        "Transcript request received"
      );

      console.log(
        "Video URL:",
        videoUrl
      );

      console.log(
        "Video ID:",
        videoId
      );

      console.log(
        "Transcript mode:",
        transcriptMode
      );

      console.log(
        "Start time:",
        startTime
      );

      console.log(
        "End time:",
        endTime
      );

      console.log(
        "Duration limit:",
        durationLimit,
        durationUnit
      );

      console.log(
        "Additional options:",
        additionalOptions
      );

      // ------------------------------------------------------
      // FETCH YOUTUBE TRANSCRIPT
      // ------------------------------------------------------

      let transcriptData;

      try {

        transcriptData =
          await YoutubeTranscript.fetchTranscript(
            videoId
          );

      } catch (error) {

        console.error(
          "YouTube transcript fetch error:",
          error?.message || error
        );

        return res.status(400).json({

          success: false,

          error:
            "Unable to retrieve the YouTube transcript.",

          details:
            error?.message ||
            "The video may not contain accessible captions.",
        });
      }

      if (
        !Array.isArray(
          transcriptData
        ) ||
        transcriptData.length === 0
      ) {

        return res.status(400).json({

          success: false,

          error:
            "No transcript was found for this YouTube video.",
        });
      }

      // ------------------------------------------------------
      // FULL VIDEO DURATION
      // ------------------------------------------------------

      const fullDurationSeconds =
        getTranscriptDurationSeconds(
          transcriptData
        );

      // ------------------------------------------------------
      // APPLY USER'S TRANSCRIPT RANGE
      // ------------------------------------------------------

      let selectedSegments;

      try {

        selectedSegments =
          applyTranscriptTimeFilter(
            transcriptData,
            transcriptMode,
            startTime,
            endTime,
            durationLimit,
            durationUnit
          );

      } catch (error) {

        return res.status(400).json({

          success: false,

          error:
            error?.message ||
            "Invalid transcript settings.",
        });
      }

      if (
        !Array.isArray(
          selectedSegments
        ) ||
        selectedSegments.length === 0
      ) {

        return res.status(400).json({

          success: false,

          error:
            "No transcript content exists in the selected time range.",
        });
      }

      // ------------------------------------------------------
      // FORMAT TRANSCRIPT
      // ------------------------------------------------------

      const includeTimestamps =
        additionalOptions
          ?.includeTimestamps !== false;

      const transcript =
        selectedSegments
          .map(
            (segment) => {

              const text =
                String(
                  segment?.text || ""
                ).trim();

              if (!text) {
                return "";
              }

              if (
                !includeTimestamps
              ) {
                return text;
              }

              const timestamp =
                formatSecondsAsDuration(
                  getSegmentStartSeconds(
                    segment
                  )
                );

              return `[${timestamp}] ${text}`;
            }
          )
          .filter(Boolean)
          .join("\n");

      if (!transcript.trim()) {

        return res.status(400).json({

          success: false,

          error:
            "The selected transcript was empty.",
        });
      }

      // ------------------------------------------------------
      // SELECTED TRANSCRIPT DURATION
      // ------------------------------------------------------

      const selectedDurationSeconds =
        getTranscriptDurationSeconds(
          selectedSegments
        );

      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      console.log(
        "Transcript successfully retrieved."
      );

      console.log(
        "Full transcript segments:",
        transcriptData.length
      );

      console.log(
        "Selected transcript segments:",
        selectedSegments.length
      );

      console.log(
        "Transcript characters:",
        transcript.length
      );

      console.log(
        "Full video duration:",
        formatSecondsAsDuration(
          fullDurationSeconds
        )
      );

      console.log(
        "Selected transcript duration:",
        formatSecondsAsDuration(
          selectedDurationSeconds
        )
      );

      console.log(
        "========================================"
      );

      return res.json({

        success: true,

        transcript,

        videoId,

        videoUrl,

        language,

        sourceLanguage:
          language,

        transcriptMode,

        duration:
          formatSecondsAsDuration(
            fullDurationSeconds
          ),

        fullDuration:
          formatSecondsAsDuration(
            fullDurationSeconds
          ),

        selectedDuration:
          formatSecondsAsDuration(
            selectedDurationSeconds
          ),

        fullDurationSeconds,

        selectedDurationSeconds,

        segmentCount:
          selectedSegments.length,

        status:
          "completed",

        additionalOptions,
      });

    } catch (error) {

      console.error(
        "Transcript Endpoint Error:",
        error?.message || error
      );

      return res.status(500).json({

        success: false,

        error:
          "Unable to retrieve transcript.",

        details:
          error?.message ||
          "Unknown transcript error.",
      });
    }
  }
);
// ==========================================================
// TRANSCRIPT TEST ENDPOINT
// ==========================================================

app.post(
  "/api/transcript-test",
  async (req, res) => {

    try {

      const {

        videoUrl,

        language =
          "English",

      } = req.body;

      if (!videoUrl) {

        return res.status(400).json({

          success: false,

          error:
            "YouTube video URL is required.",

        });

      }

      const videoId =
        getYouTubeVideoId(
          videoUrl
        );

      if (!videoId) {

        return res.status(400).json({

          success: false,

          error:
            "Invalid YouTube video URL.",

        });

      }

      console.log(
        "Transcript test request:"
      );

      console.log(
        "Video:",
        videoUrl
      );

      console.log(
        "Video ID:",
        videoId
      );

      console.log(
        "Language:",
        language
      );

      return res.json({

        success: true,

        message:
          "Transcript backend connection is working.",

        videoUrl,

        videoId,

        language,

        status:
          "ready",

      });

    } catch (error) {

      console.error(
        "Transcript Test Error:",
        error?.message ||
          error
      );

      return res.status(500).json({

        success: false,

        error:
          "Transcript test failed.",

        details:
          error?.message ||
          "Unknown error.",

      });

    }

  }
);

// ==========================================================
// AI TRANSCRIPT SUMMARY
// ==========================================================

app.post(
  "/api/summarize-transcript",
  async (req, res) => {

    try {

      const {

        transcript,

        outputLanguage,

        language =
          "English",

        summaryType =
          "detailed",

        aiPrompt =
          "",

      } = req.body;

      // ------------------------------------------------------
      // FINAL OUTPUT LANGUAGE
      // ------------------------------------------------------

      const finalLanguage =
        outputLanguage ||
        language ||
        "English";

      // ------------------------------------------------------
      // SUMMARY TYPE
      // ------------------------------------------------------

      const normalizedSummaryType =
        String(
          summaryType
        ).toLowerCase();

      const allowedSummaryTypes = [

        "detailed",

        "bullet",

        "abstract",

      ];

      const selectedSummaryType =
        allowedSummaryTypes.includes(
          normalizedSummaryType
        )
          ? normalizedSummaryType
          : "detailed";

      // ------------------------------------------------------
      // CHECK TRANSCRIPT
      // ------------------------------------------------------

      if (
        !transcript ||
        !String(
          transcript
        ).trim()
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Transcript is required.",

        });

      }

      console.log(
        "========================================"
      );

      console.log(
        "Transcript summary request received"
      );

      console.log(
        "Output language:",
        finalLanguage
      );

      console.log(
        "Summary type:",
        selectedSummaryType
      );

      console.log(
        "Custom AI prompt:",
        aiPrompt
          ? "Provided"
          : "Not provided"
      );

      console.log(
        "Transcript length:",
        transcript.length
      );

      // ------------------------------------------------------
      // PROVIDER TRACKER
      // ------------------------------------------------------

      const providerTracker =
        [];

      // ------------------------------------------------------
      // SUMMARY TYPE INSTRUCTIONS
      // ------------------------------------------------------

      const summaryTypeInstructions = {

        detailed: `

Create a DETAILED STUDY SUMMARY.

Requirements:

- Explain the main concepts clearly and sufficiently.
- Organize the summary using meaningful plain-text headings.
- Include important definitions.
- Include important facts.
- Include formulas when present.
- Include processes and steps when present.
- Include technically important examples when present.
- Explain relationships between important concepts.
- Remove repetition.
- Keep the content useful for serious exam preparation.
- Do not make the summary unnecessarily long.
- Focus on educational, technical, factual and study-relevant information.

The final result must look like a professional study note.

`,

        bullet: `

Create a BULLET STUDY SUMMARY.

Requirements:

- Organize the information under meaningful plain-text headings.
- Use concise bullet points.
- Use sub-bullets when necessary.
- Include important definitions.
- Include important facts.
- Include formulas when present.
- Include important examples when present.
- Include processes and steps when present.
- Avoid unnecessary long paragraphs.
- Remove repetition.
- Make the result suitable for quick revision and exam preparation.

The final result must look like a professional revision note.

`,

        abstract: `

Create an ABSTRACT SUMMARY.

Requirements:

- Write a concise professional overview.
- Explain the main topic.
- Explain the purpose or central idea.
- Include the most important concepts.
- Preserve the essential meaning of the source.
- Do not include unnecessary examples.
- Do not include repetition.
- Normally use well-structured paragraphs.
- Keep the result concise and academic.

The final result must look like a professional academic abstract.

`,

      };

      // ------------------------------------------------------
      // SYSTEM PROMPT
      // ------------------------------------------------------

      const systemPrompt = `

You are SmartDoc AI,
an AI learning and study assistant.

Your task is to convert a YouTube video transcript
into a professional, study-oriented summary.

==========================================================
LANGUAGE REQUIREMENT
==========================================================

The transcript may be written in ANY language.

The user's selected FINAL OUTPUT LANGUAGE is:

${finalLanguage}

You MUST write the FINAL SUMMARY entirely in
${finalLanguage}.

If the transcript is written in a different language,
understand the source meaning first and then produce
the summary in ${finalLanguage}.

Do NOT assume that the transcript language and output
language are the same.

For example:

Hindi transcript + English selected
= English summary.

Hindi transcript + Malayalam selected
= Malayalam summary.

Malayalam transcript + English selected
= English summary.

Malayalam transcript + Malayalam selected
= Malayalam summary.

==========================================================
CONTENT FILTERING
==========================================================

This is extremely important.

The transcript may contain conversational and
non-educational material.

You MUST separate useful study content from filler.

INCLUDE:

- Important educational information
- Technical concepts
- Definitions
- Explanations
- Important facts
- Formulas
- Rules
- Processes
- Steps
- Examples that explain the subject
- Important comparisons
- Important conclusions
- Exam-relevant information
- Subject-specific terminology

EXCLUDE:

- Greetings
- Good morning / good afternoon / good evening
- "How are you?"
- "Can everyone hear me?"
- "Are you ready?"
- Classroom management
- Personal conversations
- Casual conversations
- Unrelated stories
- Repeated statements
- Repeated explanations
- Unnecessary introductions
- Unnecessary conclusions
- "Let's begin"
- "Today we are going to..."
  when it does not contain useful subject information
- "Please listen"
- "Please subscribe"
- "Like and share"
- "Subscribe to my channel"
- YouTube promotional content
- Requests to comment
- Requests to follow social media
- Sponsor advertisements
- Unrelated personal opinions
- Filler words and conversational phrases
- Any content that does not contribute to understanding
  the subject

If a sentence contains both useful information and
filler, keep only the useful information.

DO NOT mention that you removed filler.

Do not write statements such as:
"Greetings were removed."

Simply provide the useful study content.

==========================================================
ACCURACY
==========================================================

1. Do not invent facts.

2. Do not add information that is not supported
   by the transcript.

3. Preserve the meaning of the source.

4. Preserve important technical terms.

5. Do not change formulas or numerical values.

6. Do not create false examples.

7. If the transcript contains an unclear statement,
   do not invent a replacement.

8. Remove repetition without removing important meaning.

9. Prefer clear academic language.

10. Make the summary useful for students.

==========================================================
PROFESSIONAL FORMATTING
==========================================================

IMPORTANT:

The frontend displays the returned text directly.

Therefore DO NOT use Markdown formatting.

DO NOT use:

#
##
###
****
**
*
---
___
backticks
Markdown tables

DO NOT put Markdown syntax in the answer.

For headings, simply write the heading as normal text.

Example:

Artificial Intelligence

Definition:
Artificial Intelligence is...

NOT:

# Artificial Intelligence

NOT:

### Artificial Intelligence

For bullet summaries, use the Unicode bullet character:

•

Example:

• Artificial Intelligence is a broad field.
• Machine Learning is a subset of AI.
• Deep Learning uses neural networks.

Do NOT use:

* Artificial Intelligence
- Machine Learning
+ Deep Learning

For important terms, simply write:

Definition:
Machine Learning is...

instead of Markdown bold formatting.

==========================================================
SUMMARY TYPE
==========================================================

Requested summary type:

${selectedSummaryType}

${summaryTypeInstructions[selectedSummaryType]}

==========================================================
OPTIONAL USER INSTRUCTIONS
==========================================================

${
  aiPrompt
    ? aiPrompt
    : "No additional instructions were provided."
}

==========================================================
FINAL QUALITY CHECK
==========================================================

Before returning the final summary, silently check:

1. Is the output entirely in ${finalLanguage}?

2. Did I remove greetings and casual conversation?

3. Did I remove YouTube promotional content?

4. Did I remove repeated information?

5. Did I preserve important educational content?

6. Did I follow the requested summary type?

7. Did I avoid Markdown symbols?

8. Does the result look like a professional study note?

Return ONLY the final summary.

`;

      // ------------------------------------------------------
      // USER PROMPT
      // ------------------------------------------------------

      const userPrompt = `

Process the following YouTube transcript.

Create a ${selectedSummaryType} study summary.

Final output language:
${finalLanguage}

Remember:

- The transcript may be in any language.
- Translate the meaning when necessary.
- Keep only useful study content.
- Remove greetings, casual conversation,
  promotional content and filler.
- Do not invent information.
- Do not use Markdown symbols.
- Follow the requested summary type.

TRANSCRIPT:

${transcript}

`;

      // ------------------------------------------------------
      // AI GENERATION
      // ------------------------------------------------------

      const rawSummary =
        await askAI(

          [

            {
              role: "system",

              content:
                systemPrompt,

            },

            {
              role: "user",

              content:
                userPrompt,

            },

          ],

          {

            maxCompletionTokens:
              8192,

            providerTracker,

          }

        );

      // ------------------------------------------------------
      // CLEAN AI OUTPUT
      // ------------------------------------------------------

      const summary =
        cleanSummaryOutput(
          rawSummary,
          selectedSummaryType
        );

      // ------------------------------------------------------
      // FINAL LOG
      // ------------------------------------------------------

      console.log(
        "Transcript summary generated."
      );

      console.log(
        "Summary cleaned successfully."
      );

      console.log(
        "========================================"
      );

      // ------------------------------------------------------
      // RETURN RESULT
      // ------------------------------------------------------

      return res.json({

        success: true,

        summary,

        language:
          finalLanguage,

        outputLanguage:
          finalLanguage,

        summaryType:
          selectedSummaryType,

        generatedBy:
          providerTracker[
            providerTracker.length - 1
          ] ||
          "SmartDoc AI",

        providersUsed: [

          ...new Set(
            providerTracker
          ),

        ],

        status:
          "completed",

      });

    } catch (error) {

      console.error(
        "Transcript Summary Error:",
        error?.message ||
          error
      );

      return res.status(500).json({

        success: false,

        error:
          "Unable to generate transcript summary.",

        details:
          error?.message ||
          "Unknown summary error.",

      });

    }

  }
);
// ==========================================================
// MULTIPLE VIDEO — COMBINED SUMMARY
// ==========================================================
//
// Purpose:
//
// Video 1 transcript
//        +
// Video 2 transcript
//        +
// Video 3 transcript
//        ...
//        ↓
// ONE combined AI summary
//
// The AI will:
// - understand all videos together
// - merge related topics
// - remove repeated information
// - combine complementary information
// - avoid separate summaries
// - produce ONE final study summary
//
// ==========================================================

app.post(
  "/api/summarize-multiple-transcripts",
  async (req, res) => {

    try {

      const {

        // Preferred format:
        //
        // videos: [
        //   {
        //     videoUrl: "...",
        //     transcript: "..."
        //   },
        //   {
        //     videoUrl: "...",
        //     transcript: "..."
        //   }
        // ]

        videos = [],

        // Also allow frontend to directly send
        // transcript objects if already available.

        transcripts = [],

        outputLanguage,

        language =
          "English",

        summaryType =
          "detailed",

        aiPrompt =
          "",

      } = req.body;

      // ------------------------------------------------------
      // FINAL OUTPUT LANGUAGE
      // ------------------------------------------------------

      const finalLanguage =
        outputLanguage ||
        language ||
        "English";

      // ------------------------------------------------------
      // SUMMARY TYPE
      // ------------------------------------------------------

      const normalizedSummaryType =
        String(
          summaryType
        ).toLowerCase();

      const allowedSummaryTypes = [

        "detailed",

        "bullet",

        "abstract",

      ];

      const selectedSummaryType =
        allowedSummaryTypes.includes(
          normalizedSummaryType
        )
          ? normalizedSummaryType
          : "detailed";

      // ------------------------------------------------------
      // NORMALIZE INPUT
      // ------------------------------------------------------

      let videoItems = [];

      // ------------------------------------------------------
      // CASE 1:
      // FRONTEND SENDS videos[]
      // ------------------------------------------------------

      if (
        Array.isArray(videos) &&
        videos.length > 0
      ) {

        videoItems =
          videos.map(
            (video, index) => ({

              videoNumber:
                index + 1,

              videoUrl:
                video?.videoUrl ||
                video?.url ||
                "",

              videoId:
                video?.videoId ||
                "",

              transcript:
                video?.transcript ||
                "",

              title:
                video?.title ||
                `Video ${index + 1}`,

            })
          );

      }

      // ------------------------------------------------------
      // CASE 2:
      // FRONTEND SENDS transcripts[]
      // ------------------------------------------------------

      else if (
        Array.isArray(
          transcripts
        ) &&
        transcripts.length > 0
      ) {

        videoItems =
          transcripts.map(
            (item, index) => ({

              videoNumber:
                index + 1,

              videoUrl:
                item?.videoUrl ||
                item?.url ||
                "",

              videoId:
                item?.videoId ||
                "",

              transcript:
                item?.transcript ||
                item?.text ||
                String(
                  item || ""
                ),

              title:
                item?.title ||
                `Video ${index + 1}`,

            })
          );

      }

      // ------------------------------------------------------
      // CHECK VIDEO COUNT
      // ------------------------------------------------------

      if (
        videoItems.length < 2
      ) {

        return res.status(400).json({

          success: false,

          error:
            "At least two videos are required for combined summary.",

        });

      }

      // ------------------------------------------------------
      // LIMIT
      // ------------------------------------------------------

      if (
        videoItems.length > 20
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Maximum 20 videos can be processed together.",

        });

      }

      console.log(
        "========================================"
      );

      console.log(
        "MULTIPLE VIDEO COMBINED SUMMARY"
      );

      console.log(
        "Number of videos:",
        videoItems.length
      );

      console.log(
        "Output language:",
        finalLanguage
      );

      console.log(
        "Summary type:",
        selectedSummaryType
      );

      // ------------------------------------------------------
      // FETCH MISSING TRANSCRIPTS
      // ------------------------------------------------------

      for (
        let i = 0;
        i < videoItems.length;
        i++
      ) {

        const item =
          videoItems[i];

        // If transcript is already provided,
        // don't fetch it again.

        if (
          item.transcript &&
          String(
            item.transcript
          ).trim()
        ) {

          console.log(
            `Video ${i + 1}: transcript already provided`
          );

          continue;
        }

        // ----------------------------------------------------
        // GET VIDEO ID
        // ----------------------------------------------------

        if (
          !item.videoUrl
        ) {

          return res.status(400).json({

            success: false,

            error:
              `Video ${i + 1} does not contain a valid YouTube URL.`,

          });

        }

        const videoId =
          getYouTubeVideoId(
            item.videoUrl
          );

        if (!videoId) {

          return res.status(400).json({

            success: false,

            error:
              `Invalid YouTube URL for Video ${i + 1}.`,

          });

        }

        item.videoId =
          videoId;

        // ----------------------------------------------------
        // FETCH TRANSCRIPT
        // ----------------------------------------------------

        try {

          console.log(
            `Fetching transcript for Video ${i + 1}...`
          );

          const transcriptData =
            await YoutubeTranscript.fetchTranscript(
              videoId
            );

          if (
            !Array.isArray(
              transcriptData
            ) ||
            transcriptData.length === 0
          ) {

            return res.status(400).json({

              success: false,

              error:
                `No transcript found for Video ${i + 1}.`,

            });

          }

          item.transcript =
            transcriptData
              .map(
                (segment) =>
                  String(
                    segment?.text ||
                    ""
                  ).trim()
              )
              .filter(Boolean)
              .join(" ");

          console.log(
            `Video ${i + 1} transcript retrieved.`
          );

        } catch (error) {

          console.error(
            `Video ${i + 1} transcript error:`,
            error?.message ||
              error
          );

          return res.status(400).json({

            success: false,

            error:
              `Unable to retrieve transcript for Video ${i + 1}.`,

            details:
              error?.message ||
              "Transcript unavailable.",

          });

        }

      }

      // ------------------------------------------------------
      // CHECK ALL TRANSCRIPTS
      // ------------------------------------------------------

      const validVideos =
        videoItems.filter(
          (item) =>
            item.transcript &&
            String(
              item.transcript
            ).trim()
        );

      if (
        validVideos.length < 2
      ) {

        return res.status(400).json({

          success: false,

          error:
            "At least two valid transcripts are required.",

        });

      }

      // ------------------------------------------------------
      // BUILD COMBINED SOURCE
      // ------------------------------------------------------

      let combinedTranscript =
        "";

      validVideos.forEach(
        (video, index) => {

          combinedTranscript += `

==========================================================
SOURCE VIDEO ${index + 1}
==========================================================

Video title:
${video.title}

Video URL:
${video.videoUrl || "Not provided"}

Transcript:

${video.transcript}

==========================================================
END SOURCE VIDEO ${index + 1}
==========================================================

`;

        }
      );

      // ------------------------------------------------------
      // SUMMARY INSTRUCTIONS
      // ------------------------------------------------------

      let summaryTypeInstructions =
        "";

      if (
        selectedSummaryType ===
        "detailed"
      ) {

        summaryTypeInstructions = `

Create ONE DETAILED COMBINED STUDY SUMMARY.

The information from all videos must be integrated
into one coherent study note.

Do NOT create:

Video 1 Summary
Video 2 Summary

Instead, merge the information according to topics
and concepts.

If Video 1 explains a concept and Video 2 provides
additional information about the same concept,
combine them into the same section.

If both videos repeat the same information,
mention it only once.

If one video contains information that the other
does not contain, include that additional information
in the appropriate topic section.

Organize the final result logically.

`;

      }

      else if (
        selectedSummaryType ===
        "bullet"
      ) {

        summaryTypeInstructions = `

Create ONE COMBINED BULLET STUDY SUMMARY.

Combine the useful information from all videos
into one revision-oriented note.

Do NOT create separate bullet sections for each video.

Merge related concepts.

Remove repeated information.

Use the Unicode bullet character:

•

Use meaningful plain-text topic headings.

`;

      }

      else {

        summaryTypeInstructions = `

Create ONE COMBINED ABSTRACT.

The abstract must represent the important information
contained across ALL videos.

Do NOT write separate abstracts.

Combine related information into one coherent
academic overview.

Remove repetition and unnecessary details.

`;

      }

      // ------------------------------------------------------
      // AI PROVIDER TRACKER
      // ------------------------------------------------------

      const providerTracker =
        [];

      // ------------------------------------------------------
      // SYSTEM PROMPT
      // ------------------------------------------------------

      const systemPrompt = `

You are SmartDoc AI,
an AI-powered learning and study assistant.

You are processing MULTIPLE YouTube videos.

Your task is to create ONE UNIFIED SUMMARY
from all provided video transcripts.

==========================================================
MOST IMPORTANT RULE
==========================================================

DO NOT summarize the videos separately.

The final output must be ONE combined summary.

For example, DO NOT produce:

Video 1 Summary
...

Video 2 Summary
...

Instead produce:

Topic A
...

Topic B
...

Topic C
...

Information from all videos must be integrated
according to the subject matter.

==========================================================
MERGING RULE
==========================================================

If two or more videos discuss the same concept:

MERGE their information.

Example:

Video 1:
Machine Learning is a subset of AI.

Video 2:
Machine Learning uses algorithms to learn from data.

Final:

Machine Learning

Machine Learning is a subset of AI that uses
algorithms to learn patterns from data.

Do not repeat the same concept twice.

==========================================================
COMPLEMENTARY INFORMATION
==========================================================

If one video contains information that another
video does not contain:

KEEP IT.

Add it under the appropriate topic.

The final summary should contain the useful
information from ALL videos.

==========================================================
DUPLICATE REMOVAL
==========================================================

Remove:

- repeated explanations
- repeated definitions
- repeated examples
- repeated conclusions
- unnecessary repetition

But do NOT remove unique information.

==========================================================
LANGUAGE
==========================================================

The final output language is:

${finalLanguage}

The source videos may use different languages.

Understand the meaning of the transcripts and
produce the FINAL SUMMARY entirely in:

${finalLanguage}

==========================================================
CONTENT FILTERING
==========================================================

KEEP:

- important concepts
- definitions
- technical information
- facts
- formulas
- processes
- steps
- examples
- comparisons
- conclusions
- exam-relevant information

REMOVE:

- greetings
- introductions without useful information
- casual conversation
- classroom management
- personal conversation
- repeated statements
- YouTube promotions
- subscribe requests
- like/share requests
- sponsor advertisements
- unrelated stories
- filler words
- unrelated information

==========================================================
ACCURACY
==========================================================

Do not invent information.

Do not add information that is not supported
by the provided transcripts.

Preserve important technical terminology.

Preserve numerical values and formulas.

Do not create unsupported examples.

==========================================================
FORMATTING
==========================================================

DO NOT use Markdown.

Do not use:

#
##
###
**
****
---
___
backticks
Markdown tables

Use plain-text headings.

For bullet summaries use:

•

Example:

• Point one
• Point two
• Point three

==========================================================
SUMMARY TYPE
==========================================================

${summaryTypeInstructions}

==========================================================
USER INSTRUCTIONS
==========================================================

${
  aiPrompt
    ? aiPrompt
    : "No additional instructions were provided."
}

==========================================================
FINAL QUALITY CHECK
==========================================================

Before returning the answer, silently verify:

1. Is it ONE combined summary?

2. Did I merge related information?

3. Did I remove duplicates?

4. Did I retain unique information from every video?

5. Did I remove greetings and filler?

6. Is everything written in ${finalLanguage}?

7. Did I follow the requested summary type?

8. Did I avoid Markdown?

9. Did I avoid separate Video 1 / Video 2 summaries?

Return ONLY the final combined summary.

`;

      // ------------------------------------------------------
      // USER PROMPT
      // ------------------------------------------------------

      const userPrompt = `

Create ONE combined study summary from the
following ${validVideos.length} YouTube videos.

Final output language:

${finalLanguage}

Summary type:

${selectedSummaryType}

IMPORTANT:

The videos must NOT be summarized separately.

Merge related concepts.

Remove repeated information.

Keep unique information from every video.

Create one coherent final study document.

Here are the source transcripts:

${combinedTranscript}

`;

      // ------------------------------------------------------
      // AI REQUEST
      // ------------------------------------------------------

      const rawSummary =
        await askAI(

          [

            {
              role:
                "system",

              content:
                systemPrompt,

            },

            {
              role:
                "user",

              content:
                userPrompt,

            },

          ],

          {

            maxCompletionTokens:
              12000,

            providerTracker,

          }

        );

      // ------------------------------------------------------
      // CLEAN RESULT
      // ------------------------------------------------------

      const summary =
        cleanSummaryOutput(
          rawSummary,
          selectedSummaryType
        );

      // ------------------------------------------------------
      // FINAL VALIDATION
      // ------------------------------------------------------

      if (
        !summary ||
        !summary.trim()
      ) {

        return res.status(500).json({

          success: false,

          error:
            "AI returned an empty combined summary.",

        });

      }

      // ------------------------------------------------------
      // LOGGING
      // ------------------------------------------------------

      console.log(
        "========================================"
      );

      console.log(
        "Combined summary generated successfully."
      );

      console.log(
        "Videos processed:",
        validVideos.length
      );

      console.log(
        "Summary length:",
        summary.length
      );

      console.log(
        "Generated by:",
        providerTracker[
          providerTracker.length - 1
        ] ||
          "SmartDoc AI"
      );

      console.log(
        "========================================"
      );

      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.json({

        success: true,

        summary,

        language:
          finalLanguage,

        outputLanguage:
          finalLanguage,

        summaryType:
          selectedSummaryType,

        videoCount:
          validVideos.length,

        videos:
          validVideos.map(
            (video, index) => ({

              videoNumber:
                index + 1,

              videoId:
                video.videoId ||
                null,

              videoUrl:
                video.videoUrl ||
                null,

              title:
                video.title ||
                `Video ${index + 1}`,

            })
          ),

        generatedBy:
          providerTracker[
            providerTracker.length - 1
          ] ||
          "SmartDoc AI",

        providersUsed: [

          ...new Set(
            providerTracker
          ),

        ],

        status:
          "completed",

      });

    } catch (error) {

      console.error(
        "Multiple Video Summary Error:",
        error?.message ||
          error
      );

      return res.status(500).json({

        success: false,

        error:
          "Unable to generate combined multiple-video summary.",

        details:
          error?.message ||
          "Unknown multiple-video summary error.",

      });

    }

  }
);

// ==========================================================
// START SERVER
// ==========================================================

export default app;

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log("========================================");
    console.log("SmartDoc AI backend started");
    console.log(`Server running on port ${PORT}`);
    console.log("========================================");
  });
}