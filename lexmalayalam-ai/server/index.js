import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { GoogleGenAI } from "@google/genai";
import { YoutubeTranscript } from "youtube-transcript";
import {
  buildOllamaRetrievedSyllabusPrompt,
  buildMoreStudyVideosPrompt,
  buildStudyPlanPrompt,
  OLLAMA_RETRIEVED_SYLLABUS_SYSTEM_INSTRUCTION,
  STUDY_PLAN_VIDEO_SYSTEM_INSTRUCTION,
  STUDY_PLAN_SYSTEM_INSTRUCTION,
} from "./prompts/studyPlanPrompts.js";
import {
  buildQuizGenerationPrompt,
  buildQuizGradingPrompt,
  QUIZ_GENERATION_SYSTEM_INSTRUCTION,
  QUIZ_GRADING_SYSTEM_INSTRUCTION,
} from "./prompts/quizPrompts.js";

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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const IS_VERCEL = Boolean(process.env.VERCEL);
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || (IS_VERCEL ? "https://ollama.com" : "http://127.0.0.1:11434")).replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || (IS_VERCEL ? "" : "qwen3:4b");
// Study Plan uses Ollama Cloud's hosted DeepSeek model independently of the
// local Ollama model used by transcript features.
const STUDY_PLAN_OLLAMA_BASE_URL = (process.env.STUDY_PLAN_OLLAMA_BASE_URL || "https://ollama.com").replace(/\/$/, "");
const STUDY_PLAN_OLLAMA_MODEL = process.env.STUDY_PLAN_OLLAMA_MODEL || "deepseek-v4.1-flash:cloud";

// ==========================================================
// AI CLIENTS
// ==========================================================

const gemini = GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    })
  : null;

const groq = GROQ_API_KEY
  ? new Groq({
      apiKey: GROQ_API_KEY,
    })
  : null;

const cerebras = CEREBRAS_API_KEY
  ? new Cerebras({
      apiKey: CEREBRAS_API_KEY,
    })
  : null;

// ==========================================================
// AI MODELS
// ==========================================================

const GEMINI_MODEL = "gemini-3.7-flash";
const ANTIGRAVITY_MODEL = "gemini-3.5-flash";
const CEREBRAS_MODEL = "gpt-oss-120b";
const GROQ_MODEL = "openai/gpt-oss-120b";

// ==========================================================
// PROVIDER NAMES
// ==========================================================

const PROVIDERS = {
  GEMINI: "SmartDoc AI 1",
  CEREBRAS: "SmartDoc AI 2",
  GROQ: "SmartDoc AI 3",
  OLLAMA: "SmartDoc AI 4",
};

// Study Plan has its own provider labels and order. Do not change the
// transcript provider labels or fallback behavior.
const STUDY_PLAN_PROVIDER_FLAGS = {
  GEMINI: "SmartDoc AI 1",
  GROQ: "SmartDoc AI 2",
  ANTIGRAVITY: "SmartDoc AI 3",
  OLLAMA: "SmartDoc AI 4",
};

// ==========================================================
// HELPER - RECORD PROVIDER
// ==========================================================

function recordProvider(provider, tracker) {
  if (tracker) {
    tracker.push(provider);
  }
}

// ==========================================================
// GEMINI
// ==========================================================

async function askGemini(messages, options = {}) {
  console.log("Trying Gemini...");

  if (!GEMINI_API_KEY || !gemini) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const systemMessage = messages.find(
    (message) => message.role === "system"
  );

  const userText = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");

  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents: userText,
    config: {
      systemInstruction:
        systemMessage?.content || "You are SmartDoc AI.",
      maxOutputTokens:
        options.maxCompletionTokens || 4096,
      ...(options.enableGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
      ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
    },
  });

  const content = response?.text;

  if (!content) {
    throw new Error("Gemini returned an empty response.");
  }

  recordProvider(
    PROVIDERS.GEMINI,
    options.providerTracker
  );

  console.log("Gemini succeeded.");

  return content.trim();
}

// ==========================================================
// CEREBRAS
// ==========================================================

async function askCerebras(messages, options = {}) {
  console.log("Trying Cerebras...");

  if (!CEREBRAS_API_KEY || !cerebras) {
    throw new Error("CEREBRAS_API_KEY is missing.");
  }

  const response =
    await cerebras.chat.completions.create({
      model: CEREBRAS_MODEL,
      messages,
      temperature: 0.2,
      max_completion_tokens: Math.min(
        options.maxCompletionTokens || 8192,
        8192
      ),
    });

  const content =
    response?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Cerebras returned an empty response."
    );
  }

  recordProvider(
    PROVIDERS.CEREBRAS,
    options.providerTracker
  );

  console.log("Cerebras succeeded.");

  return content.trim();
}

// ==========================================================
// GROQ
// ==========================================================

async function askGroq(messages, options = {}) {
  console.log("Trying Groq...");

  if (!GROQ_API_KEY || !groq) {
    throw new Error("GROQ_API_KEY is missing.");
  }

  const response =
    await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      ...(options.enableBrowserSearch ? { tools: [{ type: "browser_search" }] } : {}),
      temperature: 0.2,
      max_completion_tokens: Math.min(
        options.maxCompletionTokens || 4096,
        4096
      ),
    });

  const content =
    response?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      "Groq returned an empty response."
    );
  }

  recordProvider(
    PROVIDERS.GROQ,
    options.providerTracker
  );

  console.log("Groq succeeded.");

  return content.trim();
}

async function askOllama(messages, options = {}) {
  console.log(`Trying Ollama ${IS_VERCEL ? "Cloud" : "locally"} (${OLLAMA_MODEL})...`);
  if (IS_VERCEL && !OLLAMA_API_KEY) {
    throw new Error("Ollama on Vercel needs OLLAMA_API_KEY and a cloud model in Vercel Environment Variables; Vercel cannot reach Ollama on your PC.");
  }
  if (IS_VERCEL && !OLLAMA_MODEL) {
    throw new Error("Set OLLAMA_MODEL in Vercel to a cloud model available to your Ollama account.");
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(OLLAMA_API_KEY ? { Authorization: `Bearer ${OLLAMA_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: Math.min(options.maxCompletionTokens || 4096, 8192),
      },
    }),
    signal: AbortSignal.timeout(300000),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || `Ollama returned HTTP ${response.status}.`);
  }

  const content = result?.message?.content;
  if (!content) throw new Error("Ollama returned an empty response.");

  recordProvider(PROVIDERS.OLLAMA, options.providerTracker);
  console.log("Ollama succeeded.");
  return content.trim();
}

// ==========================================================
// CENTRAL AI FALLBACK
// ==========================================================

async function askAI(messages, options = {}) {
  // 1. GEMINI
  try {
    const result =
      await askGemini(messages, options);

    if (result) return result;
  } catch (error) {
    console.error(
      "Gemini failed:",
      error?.message || error
    );

    console.log(
      "Switching to Cerebras..."
    );
  }

  // 2. CEREBRAS
  try {
    const result =
      await askCerebras(messages, options);

    if (result) return result;
  } catch (error) {
    console.error(
      "Cerebras failed:",
      error?.message || error
    );

    console.log(
      "Switching to Groq..."
    );
  }

  // 3. GROQ
  try {
    const result =
      await askGroq(messages, options);

    if (result) return result;
  } catch (error) {
    console.error(
      "Groq failed:",
      error?.message || error
    );
  }

  // 4. OLLAMA (local)
  try {
    const result = await askOllama(messages, options);
    if (result) return result;
  } catch (error) {
    console.error(
      "Ollama failed:",
      error?.message || error
    );
  }

  throw new Error(
    "All SmartDoc AI providers are currently unavailable."
  );
}

// ==========================================================
// YOUTUBE VIDEO TITLE RETRIEVAL (oEmbed)
// ==========================================================

async function fetchYouTubeVideoTitle(videoUrl) {
  try {
    const oembedUrl =
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        videoUrl
      )}&format=json`;

    const response = await fetch(
      oembedUrl,
      {
        signal: AbortSignal.timeout(5000),
      }
    );

    if (response.ok) {
      const data =
        await response.json();

      return data.title || null;
    }
  } catch (e) {
    console.warn(
      "Could not fetch YouTube title via oEmbed:",
      e.message
    );
  }

  return null;
}

// ==========================================================
// YOUTUBE VIDEO ID HELPER
// ==========================================================

function getYouTubeVideoId(videoUrl) {
  if (!videoUrl) return null;

  try {
    const url = new URL(videoUrl);
    const hostname =
      url.hostname.toLowerCase();

    if (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      const watchId =
        url.searchParams.get("v");

      if (watchId) return watchId;
    }

    if (hostname === "youtu.be") {
      const id =
        url.pathname
          .split("/")
          .filter(Boolean)[0];

      if (id) return id;
    }

    if (
      url.pathname.startsWith("/shorts/")
    ) {
      const id =
        url.pathname
          .split("/shorts/")[1]
          ?.split("/")[0];

      if (id) return id;
    }

    if (
      url.pathname.startsWith("/embed/")
    ) {
      const id =
        url.pathname
          .split("/embed/")[1]
          ?.split("/")[0];

      if (id) return id;
    }

    return null;
  } catch {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;

    const match =
      String(videoUrl).match(regExp);

    return match &&
      match[2].length === 11
      ? match[2]
      : null;
  }
}

// ==========================================================
// TRANSCRIPT LANGUAGE FALLBACK HELPER
// ==========================================================

const LANG_CODE_MAP = {
  english: "en",
  malayalam: "ml",
  hindi: "hi",
  spanish: "es",
  french: "fr",
  german: "de",
  tamil: "ta",
  telugu: "te",
};

async function fetchTranscriptWithLanguageFallback(
  videoId,
  requestedLang
) {
  const langCode =
    LANG_CODE_MAP[
      requestedLang?.toLowerCase()
    ] ||
    requestedLang ||
    "en";

  try {
    const transcriptData =
      await YoutubeTranscript.fetchTranscript(
        videoId,
        {
          lang: langCode,
        }
      );

    if (
      transcriptData &&
      transcriptData.length > 0
    ) {
      return {
        transcriptData,
        actualLanguage:
          requestedLang || "english",
      };
    }
  } catch (err) {
    console.log(
      `Transcript for requested lang '${requestedLang}' (${langCode}) not found. Trying default fallback...`
    );
  }

  const transcriptData =
    await YoutubeTranscript.fetchTranscript(
      videoId
    );

  return {
    transcriptData,
    actualLanguage:
      "english (fallback)",
  };
}

// ==========================================================
// TRANSCRIPT TIME HELPERS
// ==========================================================

function timeToSeconds(time) {
  if (
    time === null ||
    time === undefined
  ) {
    return 0;
  }

  const value =
    String(time).trim();

  if (!value) return 0;

  if (
    /^\d+(?:\.\d+)?$/.test(value)
  ) {
    return Number(value);
  }

  const parts =
    value.split(":").map(Number);

  if (
    parts.some(
      (part) => !Number.isFinite(part)
    )
  ) {
    return NaN;
  }

  if (parts.length === 3) {
    return (
      parts[0] * 3600 +
      parts[1] * 60 +
      parts[2]
    );
  }

  if (parts.length === 2) {
    return (
      parts[0] * 60 +
      parts[1]
    );
  }

  return NaN;
}

function getSegmentStartSeconds(segment) {
  const raw = Number(
    segment?.offset ??
      segment?.start ??
      0
  );

  if (!Number.isFinite(raw)) {
    return 0;
  }

  return segment?.offset !== undefined
    ? raw / 1000
    : raw;
}

function getSegmentDurationSeconds(segment) {
  const raw = Number(
    segment?.duration ?? 0
  );

  if (!Number.isFinite(raw)) {
    return 0;
  }

  return segment?.duration !== undefined &&
    raw > 500
    ? raw / 1000
    : raw;
}

function getTranscriptDurationSeconds(
  segments
) {
  if (
    !Array.isArray(segments) ||
    segments.length === 0
  ) {
    return 0;
  }

  let maxEnd = 0;

  for (const segment of segments) {
    const start =
      getSegmentStartSeconds(segment);

    const duration =
      getSegmentDurationSeconds(segment);

    const end =
      start + duration;

    if (Number.isFinite(end)) {
      maxEnd =
        Math.max(maxEnd, end);
    }
  }

  return maxEnd;
}

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
      (totalSeconds % 3600) / 60
    );

  const remainingSeconds =
    totalSeconds % 60;

  if (hours > 0) {
    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(
        remainingSeconds
      ).padStart(2, "0"),
    ].join(":");
  }

  return [
    String(minutes).padStart(2, "0"),
    String(
      remainingSeconds
    ).padStart(2, "0"),
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

  if (
    !transcriptMode ||
    transcriptMode === "full"
  ) {
    return transcriptData;
  }

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
      fullDuration > 0 &&
      startSeconds >= fullDuration
    ) {
      throw new Error(
        "The selected start time is beyond the available transcript duration."
      );
    }

    const safeEndSeconds =
      fullDuration > 0
        ? Math.min(
            endSeconds,
            fullDuration
          )
        : endSeconds;

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
          segmentStart <
            safeEndSeconds
        );
      }
    );
  }

  if (
    transcriptMode === "duration"
  ) {
    const numericLimit =
      Number(durationLimit);

    if (
      !Number.isFinite(
        numericLimit
      ) ||
      numericLimit <= 0
    ) {
      throw new Error(
        "Duration limit must be greater than 0."
      );
    }

    const normalizedUnit =
      String(durationUnit).toLowerCase();

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
// REMOVE FILLER WORDS & PROCESS ADDITIONAL OPTIONS
// ==========================================================

function removeFillerWords(text) {
  if (!text) return "";

  const fillersRegex =
    /\b(um|uh|like|you know|basically|actually|literally|i mean|sort of|kind of|right|anyways?)\b/gi;

  return text
    .replace(
      fillersRegex,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function processTranscriptText(
  segments,
  additionalOptions = {}
) {
  const {
    includeTimestamps = false,
    removeFillerWords:
      cleanFillers = false,
    mergeCloseCaptions = false,
    detectChapters = false,
  } = additionalOptions;

  let processedSegments =
    [...segments];

  if (mergeCloseCaptions) {
    const merged = [];
    let currentChunk = null;

    for (
      const seg of processedSegments
    ) {
      const segTime =
        getSegmentStartSeconds(seg);

      if (!currentChunk) {
        currentChunk = {
          start: segTime,
          text: seg.text || "",
        };
      } else if (
        segTime -
          currentChunk.start <
        15
      ) {
        currentChunk.text +=
          " " +
          (seg.text || "");
      } else {
        merged.push(
          currentChunk
        );

        currentChunk = {
          start: segTime,
          text: seg.text || "",
        };
      }
    }

    if (currentChunk) {
      merged.push(
        currentChunk
      );
    }

    processedSegments =
      merged;
  }

  const lines =
    processedSegments.map(
      (item) => {
        let tText =
          item.text || "";

        if (cleanFillers) {
          tText =
            removeFillerWords(
              tText
            );
        }

        if (includeTimestamps) {
          const timestamp =
            formatSecondsAsDuration(
              getSegmentStartSeconds(
                item
              )
            );

          return `[${timestamp}] ${tText}`;
        }

        return tText;
      }
    );

  let fullText =
    lines.join(
      includeTimestamps
        ? "\n"
        : " "
    );

  if (
    detectChapters &&
    segments.length > 0
  ) {
    fullText =
      "[CHAPTER 1: Introduction]\n" +
      fullText;
  }

  return fullText;
}

// ==========================================================
// CLEAN AI SUMMARY OUTPUT
// ==========================================================

function cleanSummaryOutput(
  text,
  summaryType = "detailed"
) {
  if (
    text === null ||
    text === undefined
  ) {
    return "";
  }

  let cleaned =
    String(text).trim();

  // 1. Remove Markdown Code Fences
  cleaned =
    cleaned.replace(
      /^```(?:text|markdown)?\s*/i,
      ""
    );

  cleaned =
    cleaned.replace(
      /\s*```$/i,
      ""
    );

  // 2. Remove Conversational AI Intros
  cleaned =
    cleaned.replace(
      /^(Here is|Here’s|Here is the|Here’s the|Below is|This is a)\s+(summary|detailed summary|bullet summary|abstract|study summary)\s*:?\s*/i,
      ""
    );

  cleaned =
    cleaned.replace(
      /^summary:\s*/i,
      ""
    );

  // 3. Normalize Line Endings & Spaces
  cleaned =
    cleaned
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /[ \t]+/g,
        " "
      );

  // 4. Remove Markdown Headings
  cleaned =
    cleaned.replace(
      /^\s*#{1,6}\s+/gm,
      ""
    );

  // 5. Remove Markdown Bold & Italics
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

  cleaned =
    cleaned.replace(
      /\*(.*?)\*/g,
      "$1"
    );

  cleaned =
    cleaned.replace(
      /_(.*?)_/g,
      "$1"
    );

  // 6. Remove Markdown Horizontal Rules
  cleaned =
    cleaned.replace(
      /^\s*[-*_]{3,}\s*$/gm,
      ""
    );

  // 7. DETAILED SUMMARY FORMAT SAFETY
  if (
    summaryType === "detailed"
  ) {
    cleaned =
      cleaned.replace(
        /^\s*[•*-]\s+/gm,
        ""
      );

    cleaned =
      cleaned.replace(
        /^\s*\d+[.)]\s+/gm,
        ""
      );

    cleaned =
      cleaned.replace(
        /^\s*\+\s+/gm,
        ""
      );

    cleaned =
      cleaned.replace(
        /\n{3,}/g,
        "\n\n"
      );
  }

  // 8. BULLET SUMMARY FORMAT SAFETY
  if (
    summaryType === "bullet"
  ) {
    cleaned =
      cleaned.replace(
        /^\s*[-*+]\s+/gm,
        "• "
      );

    cleaned =
      cleaned.replace(
        /^\s*\d+[.)]\s+/gm,
        "• "
      );

    cleaned =
      cleaned.replace(
        /^\s*•\s*/gm,
        "• "
      );
  }

  // 9. ABSTRACT FORMAT SAFETY
  if (
    summaryType === "abstract"
  ) {
    cleaned =
      cleaned.replace(
        /^\s*[•*-]\s+/gm,
        ""
      );

    cleaned =
      cleaned.replace(
        /^\s*\d+[.)]\s+/gm,
        ""
      );

    cleaned =
      cleaned.replace(
        /^\s*\+\s+/gm,
        ""
      );

    cleaned =
      cleaned.replace(
        /\n{3,}/g,
        "\n\n"
      );
  }

  // 10. Final Blank-Line Cleanup
  cleaned =
    cleaned
      .replace(
        /[ \t]+\n/g,
        "\n"
      )
      .replace(
        /\n{3,}/g,
        "\n\n"
      );

  return cleaned.trim();
}
// ==========================================================
// TRANSCRIPT ENDPOINT
// ==========================================================

app.post("/api/transcript", async (req, res) => {
  try {
    const {
      videoUrl,
      language = "English",
      transcriptMode = "full",
      startTime = "00:00:00",
      endTime = "00:15:00",
      durationLimit = 15,
      durationUnit = "minutes",
      additionalOptions = {},
    } = req.body;

    if (!videoUrl || !String(videoUrl).trim()) {
      return res.status(400).json({
        success: false,
        error: "YouTube video URL is required.",
      });
    }

    const videoId = getYouTubeVideoId(
      String(videoUrl).trim()
    );

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: "Invalid YouTube video URL.",
      });
    }

    console.log(
      "Fetching transcript for video:",
      videoId
    );

    const {
      transcriptData,
      actualLanguage,
    } =
      await fetchTranscriptWithLanguageFallback(
        videoId,
        language
      );

    if (
      !Array.isArray(transcriptData) ||
      transcriptData.length === 0
    ) {
      return res.status(404).json({
        success: false,
        error:
          "No transcript was found for this video.",
      });
    }

    // ------------------------------------------------------
    // APPLY TIME FILTER
    // ------------------------------------------------------

    const filteredTranscript =
      applyTranscriptTimeFilter(
        transcriptData,
        transcriptMode,
        startTime,
        endTime,
        durationLimit,
        durationUnit
      );

    if (
      !Array.isArray(filteredTranscript) ||
      filteredTranscript.length === 0
    ) {
      return res.status(404).json({
        success: false,
        error:
          "No transcript content was available for the selected time range.",
      });
    }

    // ------------------------------------------------------
    // PROCESS TRANSCRIPT
    // ------------------------------------------------------

    const processedTranscript =
      processTranscriptText(
        filteredTranscript,
        additionalOptions
      );

    if (!processedTranscript.trim()) {
      return res.status(404).json({
        success: false,
        error:
          "Transcript text could not be generated.",
      });
    }

    // ------------------------------------------------------
    // VIDEO TITLE
    // ------------------------------------------------------

    const title =
      await fetchYouTubeVideoTitle(
        videoUrl
      );

    // ------------------------------------------------------
    // VIDEO DURATION
    // ------------------------------------------------------

    const durationSeconds =
      getTranscriptDurationSeconds(
        transcriptData
      );

    const videoDuration =
      formatSecondsAsDuration(
        durationSeconds
      );

    return res.json({
      success: true,

      videoId,

      videoUrl,

      title:
        title ||
        `YouTube Video ${videoId}`,

      transcript:
        processedTranscript,

      transcriptData: {
        language:
          actualLanguage ||
          language,

        languageCode:
          LANG_CODE_MAP[
            String(
              actualLanguage ||
                language
            ).toLowerCase()
          ] || null,

        segments:
          filteredTranscript,

        originalSegments:
          transcriptData,
      },

      videoDuration,

      duration:
        videoDuration,

      lengthSeconds:
        durationSeconds,

      transcriptMode,

      startTime,

      endTime,

      durationLimit,

      durationUnit,

      additionalOptions,
    });
  } catch (error) {
    console.error(
      "Transcript Error:",
      error?.message || error
    );

    return res.status(500).json({
      success: false,
      error:
        "Unable to fetch transcript.",
      details:
        error?.message ||
        "Unknown transcript error.",
    });
  }
});

// ==========================================================
// TRANSCRIPT TEST ENDPOINT
// ==========================================================

app.post(
  "/api/transcript-test",
  async (req, res) => {
    try {
      const {
        videoUrl,
        language = "English",
      } = req.body;

      if (
        !videoUrl ||
        !String(videoUrl).trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "YouTube video URL is required.",
        });
      }

      const videoId =
        getYouTubeVideoId(
          String(videoUrl).trim()
        );

      if (!videoId) {
        return res.status(400).json({
          success: false,
          error:
            "Invalid YouTube video URL.",
        });
      }

      const {
        transcriptData,
        actualLanguage,
      } =
        await fetchTranscriptWithLanguageFallback(
          videoId,
          language
        );

      if (
        !Array.isArray(
          transcriptData
        ) ||
        transcriptData.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "No transcript found.",
        });
      }

      const transcript =
        transcriptData
          .map(
            (segment) =>
              segment?.text || ""
          )
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

      return res.json({
        success: true,

        videoId,

        language:
          actualLanguage ||
          language,

        transcript,

        segmentCount:
          transcriptData.length,

        videoDuration:
          formatSecondsAsDuration(
            getTranscriptDurationSeconds(
              transcriptData
            )
          ),
      });
    } catch (error) {
      console.error(
        "Transcript Test Error:",
        error?.message || error
      );

      return res.status(500).json({
        success: false,
        error:
          "Unable to test transcript.",
        details:
          error?.message ||
          "Unknown transcript test error.",
      });
    }
  }
);

// ==========================================================
// SINGLE VIDEO — AI SUMMARY
// ==========================================================

app.post(
  "/api/summarize-transcript",
  async (req, res) => {
    try {
      const {
        transcript,
        language = "English",
        outputLanguage,
        summaryType = "detailed",
        aiPrompt = "",
      } = req.body;

      if (
        !transcript ||
        !String(transcript).trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Transcript is required for summarization.",
        });
      }

      // ----------------------------------------------------
      // NORMALIZE OUTPUT LANGUAGE
      // ----------------------------------------------------

      const finalLanguage =
        outputLanguage ||
        language ||
        "English";

      // ----------------------------------------------------
      // NORMALIZE SUMMARY TYPE
      // ----------------------------------------------------

      const normalizedSummaryType =
        String(summaryType)
          .toLowerCase()
          .trim();

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

      // ----------------------------------------------------
      // EXISTING SUMMARY TYPE INSTRUCTIONS
      // ----------------------------------------------------
      //
      // IMPORTANT:
      // These instructions are intentionally kept as the
      // existing summary-format logic.
      //
      // They determine HOW the answer should look.
      //
      // The AI Prompt determines WHAT should be answered
      // when a custom prompt is provided.
      // ----------------------------------------------------

      let summaryTypeInstructions = "";

      if (
        selectedSummaryType ===
        "detailed"
      ) {
        summaryTypeInstructions = `
Create a DETAILED STUDY SUMMARY.

Write a thorough and well-structured explanation
of the transcript.

Cover the important concepts, definitions,
processes, facts, explanations and relevant context.

Use connected explanatory paragraphs.

Do NOT use bullet points.

Do NOT use numbered lists.

The result should be useful for studying and
understanding the topic in depth.
`;
      } else if (
        selectedSummaryType ===
        "bullet"
      ) {
        summaryTypeInstructions = `
Create a BULLET-POINT STUDY SUMMARY.

Extract the most important concepts, facts,
definitions, processes and takeaways.

STRICT FORMAT:
- Use bullet points.
- Each bullet should normally contain ONE short,
  clear sentence.
- Keep each bullet focused on one important idea.
- Do NOT use numbered lists.
`;
      } else {
        summaryTypeInstructions = `
Create an ACADEMIC ABSTRACT.

Represent the essential information from the
transcript in a concise academic-style overview.

Focus on the central topic, major concepts,
important information and overall meaning.

STRICT FORMAT:
- Write concise, well-structured academic paragraphs.
- Do NOT use bullet points.
- Do NOT use numbered lists.
`;
      }

      // ----------------------------------------------------
      // CUSTOM PROMPT DETECTION
      // ----------------------------------------------------

      const hasCustomPrompt =
        typeof aiPrompt === "string" &&
        aiPrompt.trim().length > 0;

      // ----------------------------------------------------
      // BUILD TASK INSTRUCTION
      // ----------------------------------------------------

      let taskInstruction = "";

      if (hasCustomPrompt) {
        taskInstruction = `
The user has provided a specific request.

USER REQUEST:
${aiPrompt.trim()}

IMPORTANT:
Answer the user's request using ONLY the supplied
transcript as the primary source.

The user's request determines WHAT information
or task should be addressed.

Do NOT replace the user's request with a generic
full-transcript summary.

If the requested information is not sufficiently
supported by the transcript, clearly state that
the transcript does not provide enough information.

The selected Summary Type determines HOW the
answer must be presented.

${summaryTypeInstructions}
`;
      } else {
        taskInstruction = `
No specific user request was provided.

Create the normal study summary of the transcript.

Use the existing selected Summary Type instructions
below.

${summaryTypeInstructions}
`;
      }

      // ----------------------------------------------------
      // SYSTEM PROMPT
      // ----------------------------------------------------

      const systemPrompt = `
You are SmartDoc AI, an AI-powered learning
and study assistant.

You are processing a YouTube video transcript.

==================================================
SOURCE RULE
==================================================

Use the provided transcript as the primary source.

Do not invent facts that are not supported by
the transcript.

Preserve important definitions, concepts,
processes, terminology, facts and explanations.

==================================================
TASK AND FORMAT RULE
==================================================

The user's AI Prompt determines WHAT the AI should
answer or do.

The selected Summary Type determines HOW the
answer should be formatted.

These two functions must work together.

==================================================
TASK
==================================================

${taskInstruction}

==================================================
OUTPUT LANGUAGE
==================================================

Write the final answer in:

${finalLanguage}

==================================================
FINAL OUTPUT RULES
==================================================

Return ONLY the final answer.

Do not mention these instructions.

Do not mention system prompts.

Do not say that you are following a prompt.

Do not add unnecessary introductory phrases.
`;

      // ----------------------------------------------------
      // USER PROMPT
      // ----------------------------------------------------

      const userPrompt = `
${hasCustomPrompt
  ? `USER REQUEST:
${aiPrompt.trim()}

Answer the user's request based ONLY on the
transcript below.

`
  : `Create the normal ${selectedSummaryType}
study summary from the transcript below.

`}

TRANSCRIPT:
${String(transcript).trim()}
`;

      // ----------------------------------------------------
      // PROVIDER TRACKING
      // ----------------------------------------------------

      const providerTracker = [];

      // ----------------------------------------------------
      // CALL AI
      // ----------------------------------------------------

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
              12000,

            providerTracker,
          }
        );

      // ----------------------------------------------------
      // CLEAN OUTPUT
      // ----------------------------------------------------

      const summary =
        cleanSummaryOutput(
          rawSummary,
          selectedSummaryType
        );

      if (
        !summary ||
        !summary.trim()
      ) {
        return res.status(500).json({
          success: false,
          error:
            "AI returned an empty summary.",
        });
      }

      // ----------------------------------------------------
      // RESPONSE
      // ----------------------------------------------------

      return res.json({
        success: true,

        summary,

        language:
          finalLanguage,

        outputLanguage:
          finalLanguage,

        summaryType:
          selectedSummaryType,

        aiPrompt:
          aiPrompt || "",

        promptUsed:
          hasCustomPrompt,

        generatedBy:
          providerTracker[
            providerTracker.length - 1
          ] ||
          "SmartDoc AI",

        providersUsed:
          [
            ...new Set(
              providerTracker
            ),
          ],

        status:
          "completed",
      });
    } catch (error) {
      console.error(
        "Summary Error:",
        error?.message || error
      );

      return res.status(500).json({
        success: false,

        error:
          "Unable to generate summary.",

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

app.post(
  "/api/summarize-multiple-transcripts",
  async (req, res) => {
    try {
      const {
        videos = [],
        transcripts = [],
        language = "English",
        outputLanguage,
        summaryType = "detailed",
        aiPrompt = "",
      } = req.body;

      // ----------------------------------------------------
      // COLLECT VALID VIDEO DATA
      // ----------------------------------------------------

      let validVideos = [];

      if (
        Array.isArray(videos) &&
        videos.length > 0
      ) {
        validVideos =
          videos
            .map((video) => ({
              videoId:
                video?.videoId ||
                null,

              videoUrl:
                video?.videoUrl ||
                video?.url ||
                null,

              title:
                video?.title ||
                null,

              transcript:
                video?.transcript ||
                "",
            }))
            .filter(
              (video) =>
                video.transcript &&
                String(
                  video.transcript
                ).trim()
            );
      } else if (
        Array.isArray(transcripts)
      ) {
        validVideos =
          transcripts
            .map(
              (
                transcript,
                index
              ) => ({
                videoNumber:
                  index + 1,

                videoId:
                  null,

                videoUrl:
                  null,

                title:
                  `Video ${index + 1}`,

                transcript:
                  typeof transcript ===
                  "string"
                    ? transcript
                    : transcript?.transcript ||
                      "",
              })
            )
            .filter(
              (video) =>
                video.transcript &&
                String(
                  video.transcript
                ).trim()
            );
      }

      if (
        validVideos.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "At least one valid transcript is required.",
        });
      }

      // ----------------------------------------------------
      // LANGUAGE
      // ----------------------------------------------------

      const finalLanguage =
        outputLanguage ||
        language ||
        "English";

      // ----------------------------------------------------
      // SUMMARY TYPE
      // ----------------------------------------------------

      const normalizedSummaryType =
        String(summaryType)
          .toLowerCase()
          .trim();

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

      // ----------------------------------------------------
      // EXISTING COMBINED SUMMARY FORMAT
      // ----------------------------------------------------

      let summaryTypeInstructions = "";

      if (
        selectedSummaryType ===
        "detailed"
      ) {
        summaryTypeInstructions = `
Create ONE COMBINED DETAILED STUDY SUMMARY.

Represent the important information from ALL
provided videos.

Merge related information.

Remove unnecessary repetition.

Retain important unique information from each video.

STRICT FORMAT:
- Write connected explanatory paragraphs.
- Provide a detailed and coherent explanation.
- DO NOT use bullet points.
- DO NOT use numbered lists.
- DO NOT create separate summaries for each video.
`;
      } else if (
        selectedSummaryType ===
        "bullet"
      ) {
        summaryTypeInstructions = `
Create ONE COMBINED BULLET-POINT STUDY SUMMARY.

Represent the important information from ALL
provided videos.

Merge related information.

Remove unnecessary repetition.

Retain important unique information from every video.

STRICT FORMAT:
- Use bullet points.
- Each bullet should normally contain ONE short,
  clear sentence.
- Keep each bullet focused on one important idea.
- DO NOT use numbered lists.
`;
      } else {
        summaryTypeInstructions = `
Create ONE COMBINED ACADEMIC ABSTRACT.

Represent the essential information from ALL
videos in one coherent academic overview.

Do NOT write separate abstracts for individual videos.

Combine related information and remove repetition.

Retain the essential unique information from every video.

STRICT FORMAT:
- Write concise, well-structured academic paragraphs.
- Explain the overall topic, central ideas and most important concepts.
- DO NOT use bullet points.
- DO NOT use numbered lists.
`;
      }

      // ----------------------------------------------------
      // CUSTOM PROMPT
      // ----------------------------------------------------

      const hasCustomPrompt =
        typeof aiPrompt === "string" &&
        aiPrompt.trim().length > 0;

      let taskInstruction = "";

      if (hasCustomPrompt) {
        taskInstruction = `
The user has provided a specific request.

USER REQUEST:
${aiPrompt.trim()}

Answer or perform this request using ALL relevant
provided video transcripts.

The user's request determines WHAT the AI should
answer or do.

Do NOT replace the user's request with a generic
combined summary.

If the requested information is not sufficiently
supported by the provided transcripts, clearly
state that the available transcripts do not
provide enough information.

The selected Summary Type determines HOW the
answer must be presented.

${summaryTypeInstructions}
`;
      } else {
        taskInstruction = `
No specific user request was provided.

Create ONE unified combined study summary from
all provided video transcripts.

${summaryTypeInstructions}
`;
      }

      // ----------------------------------------------------
      // COMBINE TRANSCRIPTS
      // ----------------------------------------------------

      const combinedTranscript =
        validVideos
          .map(
            (video, index) =>
              `
==================================================
SOURCE VIDEO ${index + 1}
==================================================

Title:
${video.title || `Video ${index + 1}`}

Transcript:
${String(
  video.transcript
).trim()}
`
          )
          .join("\n\n");

      // ----------------------------------------------------
      // SYSTEM PROMPT
      // ----------------------------------------------------

      const systemPrompt = `
You are SmartDoc AI, an AI-powered learning
and study assistant.

You are processing MULTIPLE YouTube video
transcripts.

==================================================
IMPORTANT TASK RULE
==================================================

The user's AI Prompt determines WHAT the AI
should answer or do.

The selected Summary Type determines HOW the
answer should be formatted.

If there is no AI Prompt, use the existing
combined summary behavior.

If there is an AI Prompt, answer that request
using the provided transcripts instead of
creating an unrelated generic summary.

==================================================
SOURCE RULE
==================================================

Use ONLY information supported by the provided
transcripts.

Combine relevant information from all videos.

If several videos discuss the same concept,
merge the information and avoid unnecessary
repetition.

Retain important unique information from each
video.

Do not invent information.

==================================================
OUTPUT LANGUAGE
==================================================

Final output language:

${finalLanguage}

==================================================
TASK
==================================================

${taskInstruction}

==================================================
FINAL OUTPUT
==================================================

Return ONLY the final answer.

Do not mention these instructions.

Do not mention system prompts.

Do not add unnecessary introductory text.
`;

      // ----------------------------------------------------
      // USER PROMPT
      // ----------------------------------------------------

      const userPrompt = `
${
  hasCustomPrompt
    ? `USER REQUEST:
${aiPrompt.trim()}

Use ALL relevant source transcripts below to answer
the user's request.

`
    : `Create ONE combined ${selectedSummaryType}
study summary using all source transcripts below.

`
}

${combinedTranscript}
`;

      // ----------------------------------------------------
      // PROVIDER TRACKING
      // ----------------------------------------------------

      const providerTracker = [];

      // ----------------------------------------------------
      // AI
      // ----------------------------------------------------

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
              12000,

            providerTracker,
          }
        );

      // ----------------------------------------------------
      // CLEAN OUTPUT
      // ----------------------------------------------------

      const summary =
        cleanSummaryOutput(
          rawSummary,
          selectedSummaryType
        );

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

      // ----------------------------------------------------
      // RESPONSE
      // ----------------------------------------------------

      return res.json({
        success: true,

        summary,

        language:
          finalLanguage,

        outputLanguage:
          finalLanguage,

        summaryType:
          selectedSummaryType,

        aiPrompt:
          aiPrompt || "",

        promptUsed:
          hasCustomPrompt,

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

        providersUsed:
          [
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
        error?.message || error
      );

      return res.status(500).json({
        success: false,

        error:
          "Unable to generate combined summary.",

        details:
          error?.message ||
          "Unknown combined summary error.",
      });
    }
  }
);
// ==========================================================
// MULTIPLE VIDEO TRANSCRIPT FETCH + SUMMARY
// ==========================================================

app.post(
  "/api/process-multiple-videos",
  async (req, res) => {
    try {
      const {
        videos = [],
        outputLanguage,
        language = "English",
        summaryType = "detailed",
        aiPrompt = "",
      } = req.body;

      // ----------------------------------------------------
      // VALIDATE INPUT
      // ----------------------------------------------------

      if (
        !Array.isArray(videos) ||
        videos.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "At least one YouTube video is required.",
        });
      }

      // ----------------------------------------------------
      // NORMALIZE LANGUAGE
      // ----------------------------------------------------

      const finalLanguage =
        outputLanguage ||
        language ||
        "English";

      // ----------------------------------------------------
      // NORMALIZE SUMMARY TYPE
      // ----------------------------------------------------

      const normalizedSummaryType =
        String(summaryType)
          .toLowerCase()
          .trim();

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

      // ----------------------------------------------------
      // PROCESS EACH VIDEO
      // ----------------------------------------------------

      const processedVideos = [];

      for (
        let index = 0;
        index < videos.length;
        index++
      ) {
        const item =
          videos[index];

        const videoUrl =
          item?.videoUrl ||
          item?.url ||
          "";

        if (
          !videoUrl ||
          !String(videoUrl).trim()
        ) {
          continue;
        }

        try {
          // ----------------------------------------------
          // VIDEO ID
          // ----------------------------------------------

          const videoId =
            getYouTubeVideoId(
              String(videoUrl).trim()
            );

          if (!videoId) {
            console.warn(
              `Invalid YouTube URL for video ${
                index + 1
              }`
            );

            continue;
          }

          // ----------------------------------------------
          // EXISTING TRANSCRIPT
          // ----------------------------------------------

          let transcript =
            item?.transcript ||
            "";

          // ----------------------------------------------
          // FETCH TRANSCRIPT IF NOT PROVIDED
          // ----------------------------------------------

          if (
            !String(
              transcript
            ).trim()
          ) {
            const {
              transcriptData,
            } =
              await fetchTranscriptWithLanguageFallback(
                videoId,
                language
              );

            if (
              Array.isArray(
                transcriptData
              ) &&
              transcriptData.length > 0
            ) {
              transcript =
                transcriptData
                  .map(
                    (segment) =>
                      segment?.text ||
                      ""
                  )
                  .join(" ")
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim();
            }
          }

          // ----------------------------------------------
          // SKIP EMPTY TRANSCRIPT
          // ----------------------------------------------

          if (
            !String(
              transcript
            ).trim()
          ) {
            console.warn(
              `No transcript for video ${
                index + 1
              }`
            );

            continue;
          }

          // ----------------------------------------------
          // TITLE
          // ----------------------------------------------

          const title =
            await fetchYouTubeVideoTitle(
              videoUrl
            );

          // ----------------------------------------------
          // STORE VIDEO
          // ----------------------------------------------

          processedVideos.push({
            videoNumber:
              processedVideos.length + 1,

            videoId,

            videoUrl,

            title:
              title ||
              item?.title ||
              `Video ${index + 1}`,

            transcript,
          });
        } catch (error) {
          console.error(
            `Failed to process video ${
              index + 1
            }:`,
            error?.message ||
              error
          );
        }
      }

      // ----------------------------------------------------
      // VALIDATION AFTER PROCESSING
      // ----------------------------------------------------

      if (
        processedVideos.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            "No valid video transcripts could be processed.",
        });
      }

      // ----------------------------------------------------
      // COMBINE TRANSCRIPTS
      // ----------------------------------------------------

      const combinedTranscript =
        processedVideos
          .map(
            (video, index) =>
              `
==================================================
SOURCE VIDEO ${index + 1}
==================================================

Title:
${video.title}

Transcript:
${String(
  video.transcript
).trim()}
`
          )
          .join("\n\n");

      // ----------------------------------------------------
      // CUSTOM PROMPT DETECTION
      // ----------------------------------------------------

      const hasCustomPrompt =
        typeof aiPrompt === "string" &&
        aiPrompt.trim().length > 0;

      // ----------------------------------------------------
      // SUMMARY FORMAT
      // ----------------------------------------------------

      let summaryTypeInstructions =
        "";

      if (
        selectedSummaryType ===
        "detailed"
      ) {
        summaryTypeInstructions = `
DETAILED FORMAT:

Write the answer as a detailed and coherent
study explanation using connected paragraphs.

Do NOT use bullet points.

Do NOT use numbered lists.

Provide enough detail to properly address
the user's request.

When multiple videos contain relevant
information, combine that information
carefully.
`;
      } else if (
        selectedSummaryType ===
        "bullet"
      ) {
        summaryTypeInstructions = `
BULLET FORMAT:

Write the answer using concise bullet points.

Use the Unicode bullet character:

•

Each bullet should normally contain ONE
short, clear sentence.

Keep each bullet focused on one important idea.

Do NOT use numbered lists.
`;
      } else {
        summaryTypeInstructions = `
ABSTRACT FORMAT:

Write the answer as a concise academic-style
abstract.

Use coherent paragraphs.

Focus on the essential information needed
to answer the user's request.

Do NOT use bullet points.

Do NOT use numbered lists.
`;
      }

      // ----------------------------------------------------
      // TASK
      // ----------------------------------------------------

      let taskInstruction = "";

      if (hasCustomPrompt) {
        taskInstruction = `
The user has provided a specific AI request.

USER REQUEST:
${aiPrompt.trim()}

Answer this request using the provided
video transcripts.

The user's request determines WHAT should
be answered.

The selected Summary Type determines HOW
the answer should be presented.

Do NOT replace the user's request with
a generic full-video summary.

If the information requested by the user
is not sufficiently supported by the
available transcripts, clearly state that.

${summaryTypeInstructions}
`;
      } else {
        taskInstruction = `
No custom AI Prompt was provided.

Create the normal combined study summary
using the selected Summary Type.

${summaryTypeInstructions}
`;
      }

      // ----------------------------------------------------
      // SYSTEM PROMPT
      // ----------------------------------------------------

      const systemPrompt = `
You are SmartDoc AI.

You are processing multiple YouTube video
transcripts for a learning application.

==================================================
CORE RULE
==================================================

When an AI Prompt is provided:

AI Prompt = WHAT to answer.

Summary Type = HOW to format the answer.

When no AI Prompt is provided:

Use the existing summary behavior based
on the selected Summary Type.

==================================================
SOURCE RULE
==================================================

Use ONLY information supported by the
provided transcripts.

Do not invent information.

When several videos discuss the same topic,
combine relevant information and avoid
unnecessary repetition.

Retain useful unique information from
different videos.

==================================================
LANGUAGE
==================================================

Write the final answer in:

${finalLanguage}

==================================================
TASK
==================================================

${taskInstruction}

==================================================
FINAL RESPONSE
==================================================

Return ONLY the final answer.

Do not explain the instructions.

Do not mention the system prompt.

Do not mention that you are an AI.

Do not add unnecessary introductory text.
`;

      // ----------------------------------------------------
      // USER PROMPT
      // ----------------------------------------------------

      const userPrompt = `
${
  hasCustomPrompt
    ? `USER REQUEST:
${aiPrompt.trim()}

Use the following transcripts as the
source for answering the request.

`
    : `Create the normal combined
${selectedSummaryType} study summary
from the following transcripts.

`
}

${combinedTranscript}
`;

      // ----------------------------------------------------
      // PROVIDER TRACKER
      // ----------------------------------------------------

      const providerTracker = [];

      // ----------------------------------------------------
      // GENERATE AI RESULT
      // ----------------------------------------------------

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
              12000,

            providerTracker,
          }
        );

      // ----------------------------------------------------
      // CLEAN RESULT
      // ----------------------------------------------------

      const summary =
        cleanSummaryOutput(
          rawSummary,
          selectedSummaryType
        );

      if (
        !summary ||
        !summary.trim()
      ) {
        return res.status(500).json({
          success: false,
          error:
            "AI returned an empty summary.",
        });
      }

      // ----------------------------------------------------
      // RESPONSE
      // ----------------------------------------------------

      return res.json({
        success: true,

        mode:
          processedVideos.length === 1
            ? "single"
            : "multiple",

        summary,

        summaryType:
          selectedSummaryType,

        language:
          finalLanguage,

        outputLanguage:
          finalLanguage,

        aiPrompt:
          aiPrompt || "",

        promptUsed:
          hasCustomPrompt,

        videoCount:
          processedVideos.length,

        videos:
          processedVideos.map(
            (video) => ({
              videoNumber:
                video.videoNumber,

              videoId:
                video.videoId,

              videoUrl:
                video.videoUrl,

              title:
                video.title,
            })
          ),

        generatedBy:
          providerTracker[
            providerTracker.length - 1
          ] ||
          "SmartDoc AI",

        providersUsed:
          [
            ...new Set(
              providerTracker
            ),
          ],

        status:
          "completed",
      });
    } catch (error) {
      console.error(
        "Multiple Video Processing Error:",
        error?.message ||
          error
      );

      return res.status(500).json({
        success: false,

        error:
          "Unable to process multiple videos.",

        details:
          error?.message ||
          "Unknown processing error.",
      });
    }
  }
);

// ==========================================================
// STUDY PLAN GENERATION
// ==========================================================

function buildStudySchedule(sections, durationDays, studyHoursPerDay, startDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const days = Array.from({ length: durationDays }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const section = sections[index % sections.length];
    const topics = Array.isArray(section.topics) ? section.topics.filter(Boolean) : [];
    const activity = (index + 1) % 14 === 0
      ? "Mock test"
      : (index + 1) % 7 === 0
        ? "Revision"
        : index % 2 === 0
          ? "Learn"
          : "Practice";

    return {
      date: date.toISOString().slice(0, 10),
      day: date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
      tasks: [{
        section: section.name,
        topic: topics.length ? topics[Math.floor(index / sections.length) % topics.length] : section.name,
        studyHours: studyHoursPerDay,
        activity,
      }],
    };
  });

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    const weekNumber = weeks.length + 1;
    const weekDays = days.slice(index, index + 7);
    const focusSections = [...new Set(weekDays.map((day) => day.tasks[0].section))];
    weeks.push({
      weekNumber,
      focus: focusSections.join(" and "),
      days: weekDays,
    });
  }
  return weeks;
}

async function askAntigravityStudyPlan(messages, options = {}) {
  console.log("Trying Antigravity...");
  if (!GEMINI_API_KEY || !gemini) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const systemInstruction = messages.find((message) => message.role === "system")?.content || "You are SmartDoc AI.";
  const input = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n\n");
  const interaction = await gemini.interactions.create({
    agent: "antigravity-preview-09-2026",
    environment: "remote",
    system_instruction: systemInstruction,
    input,
    tools: [
      { type: "google_search" },
      { type: "url_context" },
    ],
    agent_config: {
      type: "antigravity",
      model: ANTIGRAVITY_MODEL,
      max_total_tokens: "12000",
    },
  }, { timeout: 300000 });

  const content = interaction?.output_text;
  if (!content) throw new Error("Antigravity returned an empty study plan.");

  recordProvider(STUDY_PLAN_PROVIDER_FLAGS.ANTIGRAVITY, options.providerTracker);
  console.log("Antigravity succeeded.");
  return content.trim();
}

async function askOllamaStudyPlan(messages, options = {}) {
  console.log(`Trying Ollama Cloud (${STUDY_PLAN_OLLAMA_MODEL}) for Study Plan...`);
  if (!OLLAMA_API_KEY) {
    throw new Error("Study Plan Ollama Cloud needs OLLAMA_API_KEY in the backend environment.");
  }
  const response = await fetch(`${STUDY_PLAN_OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(OLLAMA_API_KEY ? { Authorization: `Bearer ${OLLAMA_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: STUDY_PLAN_OLLAMA_MODEL,
      messages,
      format: "json",
      stream: false,
      options: { temperature: 0.2, num_predict: 8192 },
    }),
    signal: AbortSignal.timeout(300000),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error || `Ollama returned HTTP ${response.status}.`);
  }
  const content = result?.message?.content;
  if (!content) throw new Error("Ollama returned an empty study plan.");

  recordProvider(STUDY_PLAN_PROVIDER_FLAGS.OLLAMA, options.providerTracker);
  console.log("Ollama succeeded.");
  return content.trim();
}

function parseStudyPlanJson(responseText) {
  const cleaned = String(responseText || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) throw new Error("Provider returned no JSON study plan.");
  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

function normalizeQuizQuestions(payload, requestedFormat, requestedCount) {
  const rawQuestions = Array.isArray(payload?.questions) ? payload.questions : [];
  const seen = new Set();
  const questions = [];

  for (const [index, item] of rawQuestions.entries()) {
    if (!item || typeof item !== "object") continue;
    const text = String(item.text || item.question || "").trim();
    const dedupeKey = text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!text || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let type = String(item.type || (requestedFormat === "written" ? "written" : "mcq")).toLowerCase();
    type = type === "written" ? "written" : "mcq";
    if (requestedFormat === "mcq") type = "mcq";
    if (requestedFormat === "written") type = "written";

    const question = {
      id: String(item.id || `q${index + 1}`).slice(0, 80),
      type,
      text: text.slice(0, 1500),
      answer: String(item.answer || item.correctAnswer || "").trim().slice(0, 3000),
      explanation: String(item.explanation || item.rubric || "").trim().slice(0, 3000),
      topic: String(item.topic || "General").trim().slice(0, 200),
      chapter: String(item.chapter || "").trim().slice(0, 200),
      sourceTitle: String(item.sourceTitle || "").trim().slice(0, 240),
    };

    if (type === "mcq") {
      question.options = Array.isArray(item.options)
        ? item.options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 4)
        : [];
      const answerLetter = question.answer.toUpperCase().match(/^\(?([A-D])\)?[.)]?$/)?.[1];
      if (answerLetter && question.options.length === 4) {
        question.answer = question.options[answerLetter.charCodeAt(0) - 65];
      }
      if (question.options.length !== 4
        || new Set(question.options.map((option) => option.toLowerCase())).size !== 4
        || !question.answer
        || !question.options.some((option) => option === question.answer)) continue;
    } else if (!question.answer) {
      continue;
    }

    questions.push(question);
    if (questions.length >= requestedCount) break;
  }

  if (requestedFormat === "mixed" && questions.length > 1
    && !questions.some((question) => question.type === "written")) {
    const writtenQuestion = rawQuestions.find((item) => String(item?.type || "").toLowerCase() === "written" && item?.answer);
    if (writtenQuestion) {
      const normalizedWritten = normalizeQuizQuestions({ questions: [writtenQuestion] }, "written", 1)[0];
      if (normalizedWritten) questions[questions.length - 1] = normalizedWritten;
    }
  }

  if (!questions.length) throw new Error("The AI providers did not return any valid questions. Try fewer questions or select more study material.");
  return questions;
}

async function runQuizGenerationWithFallback(messages, requestedFormat, requestedCount) {
  const attempts = [];
  attempts.push(
    { name: "Gemini", run: () => askGemini(messages, { maxCompletionTokens: 8192, responseMimeType: "application/json" }) },
    { name: "Groq", run: () => askGroq(messages, { maxCompletionTokens: 4096 }) },
    { name: "Ollama Cloud", run: () => askOllamaStudyPlan(messages) },
    { name: "Cerebras", run: () => askCerebras(messages, { maxCompletionTokens: 4096 }) },
  );
  if (!IS_VERCEL && OLLAMA_MODEL) {
    attempts.push({ name: "Local Ollama", run: () => askOllama(messages, { maxCompletionTokens: 4096 }) });
  }

  const errors = [];
  for (const attempt of attempts) {
    try {
      const result = await attempt.run();
      const payload = parseStudyPlanJson(result);
      normalizeQuizQuestions(payload, requestedFormat, requestedCount);
      return { payload, provider: attempt.name, errors };
    } catch (error) {
      const message = String(error?.message || "Unknown provider error.");
      errors.push(`${attempt.name}: ${message}`);
      console.error(`Quiz ${attempt.name} failed:`, message);
    }
  }
  throw new Error(`All quiz question providers failed. ${errors.join(" | ")}`);
}

function getQuizImage(imageDataUrl) {
  if (!imageDataUrl) return null;
  const match = String(imageDataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) throw new Error("Upload a PNG, JPG, or WebP image of your answer.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 6 * 1024 * 1024) throw new Error("The answer photo must be 6 MB or smaller.");
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

function parseQuizGrade(responseText) {
  const payload = parseStudyPlanJson(responseText);
  const score = Number(payload?.score);
  if (!Number.isFinite(score)) throw new Error("The grading provider returned no valid score.");
  return {
    score: Math.max(0, Math.min(10, Math.round(score * 10) / 10)),
    extractedText: String(payload?.extractedText || "").trim().slice(0, 12000),
    feedback: String(payload?.feedback || "").trim().slice(0, 4000),
    rubric: String(payload?.rubric || "").trim().slice(0, 4000),
  };
}

function youtubeVideoKey(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      return parsed.searchParams.get("v")
        || parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1]
        || "";
    }
  } catch {
    return "";
  }
  return "";
}

function officialSyllabusHostAllowed(url, exam) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const trustedExamHosts = [exam?.official_notification_url, exam?.official_website_url]
      .map((value) => {
        try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
      })
      .filter(Boolean);
    if (trustedExamHosts.includes(host)) return true;

    const category = String(exam?.category || "").toLowerCase();
    if (category.includes("psc")) return host === "keralapsc.gov.in";
    if (category === "ssc" || category.includes("staff selection")) return host === "ssc.gov.in";
    if (category.includes("upsc") || category.includes("union public")) return ["upsc.gov.in", "upsconline.nic.in"].includes(host);
    if (category.includes("rail") || category.includes("rrb")) return host === "indianrailways.gov.in" || (/^rrb[a-z0-9-]*\.gov\.in$/i).test(host);
    if (category.includes("bank")) return ["ibps.in", "rbi.org.in"].includes(host) || host.endsWith(".bank.in");
    return false;
  } catch {
    return false;
  }
}

async function getOllamaOfficialSyllabusEvidence(exam) {
  if (!OLLAMA_API_KEY) throw new Error("Ollama syllabus search needs OLLAMA_API_KEY in the backend environment.");
  const query = `${exam.exam_name} ${exam.category} ${exam.organization} official syllabus recruitment notification exam pattern`;
  const searchResponse = await fetch("https://ollama.com/api/web_search", {
    method: "POST",
    headers: { Authorization: `Bearer ${OLLAMA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });
  if (!searchResponse.ok) {
    throw new Error(`Ollama web search returned HTTP ${searchResponse.status}.`);
  }
  const searchPayload = await searchResponse.json();
  const officialResults = (Array.isArray(searchPayload?.results) ? searchPayload.results : [])
    .filter((result) => result?.url && officialSyllabusHostAllowed(result.url, exam))
    .slice(0, 3);
  if (!officialResults.length) {
    throw new Error("Ollama Web Search found no results on an allowed official exam authority domain.");
  }

  const evidence = await Promise.all(officialResults.map(async (result) => {
    let fetched = null;
    try {
      const response = await fetch("https://ollama.com/api/web_fetch", {
        method: "POST",
        headers: { Authorization: `Bearer ${OLLAMA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url }),
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) fetched = await response.json();
    } catch (error) {
      console.warn("Ollama Web Fetch failed for official syllabus result:", String(error?.message || error));
    }
    return {
      title: String(fetched?.title || result.title || "Official exam notice"),
      url: result.url,
      searchSnippet: String(result.content || "").slice(0, 2500),
      fetchedText: String(fetched?.content || "").slice(0, 9000),
    };
  }));
  return evidence;
}

async function searchOllamaVideos({ exam, sections, excludedKeys, count }) {
  if (!OLLAMA_API_KEY) {
    throw new Error("Ollama web search needs OLLAMA_API_KEY in the backend environment.");
  }

  const examName = String(exam.exam_name || exam.examName || "").trim();
  const category = String(exam.category || "").trim();
  const seenKeys = new Set(excludedKeys);
  const videos = [];
  const searchSections = sections.slice(0, Math.max(count, 1));

  for (const section of searchSections) {
    if (videos.length >= count) break;
    const sectionName = String(section?.name || "").trim();
    const topics = Array.isArray(section?.topics) ? section.topics.slice(0, 3).join(" ") : "";
    const query = `${examName} ${category} ${sectionName} ${topics} YouTube lessons site:youtube.com/watch`;
    const response = await fetch("https://ollama.com/api/web_search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Ollama web search returned HTTP ${response.status}${details ? `: ${details.slice(0, 300)}` : ""}`);
    }

    const payload = await response.json();
    for (const result of Array.isArray(payload?.results) ? payload.results : []) {
      const url = String(result?.url || "").trim();
      const key = youtubeVideoKey(url);
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      videos.push({
        title: String(result?.title || sectionName || "Recommended lesson").trim(),
        topic: sectionName,
        channel: "YouTube",
        youtubeUrl: url,
        duration: "",
      });
      if (videos.length >= count) break;
    }
  }

  return JSON.stringify({ videos });
}

app.post("/api/study-plan/videos", async (req, res) => {
  const { exam = {}, sections = [], excludedVideoUrls = [], count = 4 } = req.body || {};
  const examName = String(exam.exam_name || exam.examName || "").trim();
  if (!examName || !Array.isArray(sections) || !sections.length) {
    return res.status(400).json({ success: false, error: "Generate a study plan before finding more videos." });
  }

  const safeCount = Math.min(4, Math.max(1, Math.floor(Number(count) || 4)));
  const excludedKeys = new Set(excludedVideoUrls.map(youtubeVideoKey).filter(Boolean));
  const videoPrompt = buildMoreStudyVideosPrompt({
    exam,
    sections,
    excludedVideoUrls,
    count: safeCount,
  });
  const attempts = [
    {
      name: "Gemini",
      run: () => askGemini([
        { role: "system", content: STUDY_PLAN_VIDEO_SYSTEM_INSTRUCTION },
        { role: "user", content: videoPrompt },
      ], { maxCompletionTokens: 4096, enableGoogleSearch: true, responseMimeType: "application/json" }),
    },
    {
      name: "Groq",
      run: () => askGroq([
        { role: "system", content: STUDY_PLAN_VIDEO_SYSTEM_INSTRUCTION },
        { role: "user", content: videoPrompt },
      ], { maxCompletionTokens: 4096, enableBrowserSearch: true }),
    },
    {
      name: "Antigravity",
      run: () => askAntigravityStudyPlan([
        { role: "system", content: STUDY_PLAN_VIDEO_SYSTEM_INSTRUCTION },
        { role: "user", content: videoPrompt },
      ]),
    },
    {
      name: "Ollama Web Search",
      run: () => searchOllamaVideos({ exam, sections, excludedKeys, count: safeCount }),
    },
  ];
  const errors = [];

  for (const attempt of attempts) {
    try {
      const parsed = parseStudyPlanJson(await attempt.run());
      const seenKeys = new Set(excludedKeys);
      const videos = (Array.isArray(parsed?.videos) ? parsed.videos : [])
        .filter((video) => {
          const key = youtubeVideoKey(video?.youtubeUrl || "");
          if (!key || seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        })
        .slice(0, safeCount);
      if (!videos.length) {
        throw new Error("Search returned no new direct YouTube video links; trying the next provider.");
      }
      return res.json({ success: true, videos, provider: attempt.name });
    } catch (error) {
      const message = String(error?.message || "Unknown video search error.");
      errors.push(`${attempt.name}: ${message}`);
      console.error(`Study Plan video search ${attempt.name} failed:`, message);
    }
  }

  return res.status(502).json({
    success: false,
    error: "Could not find more videos right now. Please try again.",
    details: errors.join(" | "),
  });
});

app.post("/api/study-plan/generate", async (req, res) => {
  try {
    const {
      exam = {},
      durationDays: requestedDuration = 30,
      studyHoursPerDay: requestedHours = 3,
      startDate: requestedStartDate,
    } = req.body || {};

    const examName = String(exam.exam_name || exam.examName || "").trim();
    if (!examName) {
      return res.status(400).json({ success: false, error: "Choose an exam before generating a study plan." });
    }

    const durationDays = Math.floor(Number(requestedDuration));
    const studyHoursPerDay = Number(requestedHours);
    if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 180) {
      return res.status(400).json({ success: false, error: "Plan duration must be between 1 and 180 days." });
    }
    if (!Number.isFinite(studyHoursPerDay) || studyHoursPerDay < 0.5 || studyHoursPerDay > 12) {
      return res.status(400).json({ success: false, error: "Daily study time must be between 0.5 and 12 hours." });
    }

    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(requestedStartDate || ""))
      ? String(requestedStartDate)
      : new Date().toISOString().slice(0, 10);
    const examDetails = {
      exam_name: examName,
      category: exam.category || "",
      organization: exam.organization || "",
      description: exam.description || "",
      qualification: exam.qualification || "",
      degree: exam.degree || "",
      stream: exam.stream || "",
      application_last_date: exam.application_last_date || "",
      official_notification_url: exam.official_notification_url || "",
      official_website_url: exam.official_website_url || "",
    };

    const geminiPrompt = buildStudyPlanPrompt({ exam: examDetails, durationDays, studyHoursPerDay, startDate });
    let ollamaSyllabusEvidence = [];
    const attempts = [
      {
        name: "Gemini",
        flag: STUDY_PLAN_PROVIDER_FLAGS.GEMINI,
        messages: [
          { role: "system", content: STUDY_PLAN_SYSTEM_INSTRUCTION },
          { role: "user", content: geminiPrompt },
        ],
        run: (messages, providerTracker) => askGemini(messages, {
          providerTracker,
          maxCompletionTokens: 8192,
          enableGoogleSearch: true,
          responseMimeType: "application/json",
        }),
        webSearchUsed: true,
      },
      {
        name: "Groq",
        flag: STUDY_PLAN_PROVIDER_FLAGS.GROQ,
        messages: [
          { role: "system", content: STUDY_PLAN_SYSTEM_INSTRUCTION },
          { role: "user", content: geminiPrompt },
        ],
        run: (messages, providerTracker) => askGroq(messages, {
          providerTracker,
          maxCompletionTokens: 4096,
          enableBrowserSearch: true,
        }),
        webSearchUsed: true,
      },
      {
        name: "Antigravity",
        flag: STUDY_PLAN_PROVIDER_FLAGS.ANTIGRAVITY,
        messages: [
          { role: "system", content: STUDY_PLAN_SYSTEM_INSTRUCTION },
          { role: "user", content: geminiPrompt },
        ],
        run: (messages, providerTracker) => askAntigravityStudyPlan(messages, {
          providerTracker,
        }),
        webSearchUsed: true,
      },
      {
        name: "Ollama Cloud (DeepSeek V4.1 Flash)",
        flag: STUDY_PLAN_PROVIDER_FLAGS.OLLAMA,
        isOllama: true,
        messages: [],
        run: async (_messages, providerTracker) => {
          ollamaSyllabusEvidence = await getOllamaOfficialSyllabusEvidence(examDetails);
          const prompt = buildOllamaRetrievedSyllabusPrompt({
            exam: examDetails,
            durationDays,
            studyHoursPerDay,
            startDate,
            sources: ollamaSyllabusEvidence,
          });
          return askOllamaStudyPlan([
            { role: "system", content: OLLAMA_RETRIEVED_SYLLABUS_SYSTEM_INSTRUCTION },
            { role: "user", content: prompt },
          ], { providerTracker });
        },
        webSearchUsed: false,
      },
    ];
    const providerErrors = [];

    for (const attempt of attempts) {
      const providerTracker = [];
      try {
        const responseText = await attempt.run(attempt.messages, providerTracker);
        const plan = parseStudyPlanJson(responseText);
        if (!plan || !Array.isArray(plan.sections)) {
          throw new Error(`${attempt.name} returned a study plan in an unexpected format.`);
        }
        plan.sections = plan.sections.filter((section) => section && String(section.name || "").trim());
        if (!plan.sections.length) throw new Error(`${attempt.name} returned no syllabus sections.`);

        const providerIndex = attempts.indexOf(attempt);
        const fallbackUsed = providerIndex > 0;
        let webSearchUsed = attempt.webSearchUsed;
        if (attempt.isOllama) {
          const normalizeEvidence = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          const normalizedName = normalizeEvidence(examDetails.exam_name);
          const sourceText = normalizeEvidence(ollamaSyllabusEvidence.map((source) => `${source.title} ${source.searchSnippet} ${source.fetchedText}`).join(" "));
          const exactSourceMatch = normalizedName.length > 0 && sourceText.includes(normalizedName);
          const modelConfirmsMatch = plan.exactMatch === true
            && plan.syllabusVerified === true
            && normalizeEvidence(plan.matchedExamName) === normalizedName
            && normalizeEvidence(plan.matchedCategory) === normalizeEvidence(examDetails.category);
          if (!exactSourceMatch || !modelConfirmsMatch) {
            throw new Error("Ollama Web Search could not verify the exact post and category from an official syllabus source. Add the syllabus manually.");
          }
          plan.syllabusVerified = true;
          plan.exactMatch = true;
          plan.summary = `${String(plan.summary || "Official syllabus matched.").trim()} Summarized by DeepSeek V4.1 Flash via Ollama Cloud from official source material retrieved with Ollama Web Search.`;
          plan.sections = plan.sections.map((section) => ({ ...section, sourceType: "official" }));
          plan.sources = ollamaSyllabusEvidence.map(({ title, url }) => ({ title, url, type: "official" }));
          plan.videos = [];
        } else {
        plan.sources = Array.isArray(plan.sources)
          ? plan.sources.filter((source) => /^https:\/\//i.test(source?.url || ""))
          : [];
        plan.videos = Array.isArray(plan.videos)
          ? plan.videos.filter((video) => /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(video?.youtubeUrl || ""))
            .slice(0, 4)
          : [];
        }

        if (OLLAMA_API_KEY && plan.sections.length && plan.videos.length < 3) {
          try {
            const excludedKeys = new Set(plan.videos.map((video) => youtubeVideoKey(video.youtubeUrl)).filter(Boolean));
            const supplemental = JSON.parse(await searchOllamaVideos({
              exam: examDetails,
              sections: plan.sections,
              excludedKeys,
              count: Math.min(4 - plan.videos.length, 4),
            }));
            const seenKeys = new Set(excludedKeys);
            const extraVideos = (Array.isArray(supplemental?.videos) ? supplemental.videos : [])
              .filter((video) => {
                const key = youtubeVideoKey(video?.youtubeUrl || "");
                if (!key || seenKeys.has(key)) return false;
                seenKeys.add(key);
                return true;
              });
            plan.videos = [...plan.videos, ...extraVideos].slice(0, 4);
            webSearchUsed = true;
          } catch (videoSearchError) {
            console.warn("Ollama Web Search could not supplement initial Study Plan videos:", String(videoSearchError?.message || videoSearchError));
          }
        }
        plan.weeks = buildStudySchedule(plan.sections, durationDays, studyHoursPerDay, startDate);
        if (!attempt.isOllama) plan.exactMatch = false;

        console.log(`Study Plan generated using ${attempt.name}${fallbackUsed ? " fallback" : " primary"}.`);
        return res.json({
          success: true,
          plan,
          provider: attempt.name,
          providerFlag: attempt.flag,
          fallbackUsed,
          webSearchUsed,
          exactMatch: attempt.isOllama && plan.exactMatch === true,
          needsCustomSyllabus: false,
          attemptedProviders: attempts.slice(0, providerIndex + 1).map(({ name }) => name),
          generatedAt: new Date().toISOString(),
        });
      } catch (providerError) {
        const message = String(providerError?.message || "Unknown provider error.");
        providerErrors.push(`${attempt.name}: ${message}`);
        console.error(`Study Plan ${attempt.name} failed:`, message);
        const attemptIndex = attempts.indexOf(attempt);
        if (attemptIndex < attempts.length - 1) {
          console.log(`Study Plan switching from ${attempt.name} to ${attempts[attemptIndex + 1].name}...`);
        }
      }
    }

    console.error("All Study Plan providers failed:", providerErrors.join(" | "));
    return res.json({
      success: true,
      plan: {
        summary: "An exact official syllabus could not be verified for this post. Add the syllabus below to build your timetable manually.",
        sections: [],
        weeks: [],
        videos: [],
        sources: [],
        needsCustomSyllabus: true,
        syllabusVerified: false,
      },
      provider: "",
      providerFlag: "",
      fallbackUsed: false,
      webSearchUsed: false,
      exactMatch: false,
      needsCustomSyllabus: true,
      attemptedProviders: attempts.map(({ name }) => name),
      providerErrors,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const providerError = String(error?.message || "Unknown study-plan error.");
    console.error("Study Plan Generation Error:", providerError);
    return res.status(502).json({
      success: false,
      error: "Study Plan could not be generated. Please retry in a moment.",
      details: providerError,
    });
  }
});

// ==========================================================
// QUIZ QUESTION GENERATION AND WRITTEN ANSWER GRADING
// ==========================================================

app.post("/api/quiz/generate", async (req, res) => {
  try {
    const {
      exams = [],
      testType = "weekly",
      scope = "",
      questionCount: requestedCount = 20,
      difficulty = "Mixed difficulty",
      format = "mcq",
      language = "English",
      syllabusSections = [],
      transcripts: requestedTranscripts = [],
    } = req.body || {};

    const safeExams = (Array.isArray(exams) ? exams : [exams])
      .filter((exam) => exam && typeof exam === "object")
      .slice(0, 6)
      .map((exam) => ({
        exam_name: String(exam.exam_name || exam.examName || "").trim().slice(0, 240),
        category: String(exam.category || "").trim().slice(0, 80),
        organization: String(exam.organization || "").trim().slice(0, 240),
        qualification: String(exam.qualification || "").trim().slice(0, 1200),
        description: String(exam.description || "").trim().slice(0, 1800),
      }))
      .filter((exam) => exam.exam_name);
    if (!safeExams.length) return res.status(400).json({ success: false, error: "Select at least one exam before creating a test." });

    const allowedTestTypes = new Set(["weekly", "monthly", "chapter", "topic"]);
    const allowedFormats = new Set(["mcq", "written", "mixed"]);
    const safeTestType = allowedTestTypes.has(testType) ? testType : "weekly";
    const safeFormat = allowedFormats.has(format) ? format : "mcq";
    const safeLanguage = ["English", "Malayalam"].includes(String(language)) ? String(language) : "English";
    const questionCount = Math.min(50, Math.max(1, Math.floor(Number(requestedCount) || 20)));

    const safeSections = (Array.isArray(syllabusSections) ? syllabusSections : [])
      .slice(0, 40)
      .map((section) => ({
        name: String(section?.name || "").trim().slice(0, 180),
        topics: (Array.isArray(section?.topics) ? section.topics : [])
          .map((topic) => String(topic || "").trim().slice(0, 240))
          .filter(Boolean)
          .slice(0, 60),
      }))
      .filter((section) => section.name && section.topics.length);

    let transcriptBudget = 85000;
    const safeTranscripts = (Array.isArray(requestedTranscripts) ? requestedTranscripts : [])
      .slice(0, 10)
      .map((transcript) => {
        const content = String(transcript?.transcript || transcript?.text || "").trim();
        if (!content || transcriptBudget <= 0) return null;
        const excerpt = content.slice(0, transcriptBudget);
        transcriptBudget -= excerpt.length;
        return {
          title: String(transcript?.title || "Study video").trim().slice(0, 240),
          topic: String(transcript?.topic || "").trim().slice(0, 180),
          videoUrl: youtubeVideoKey(transcript?.videoUrl || transcript?.url || "")
            ? String(transcript?.videoUrl || transcript?.url || "").slice(0, 500)
            : "",
          transcript: excerpt,
        };
      })
      .filter(Boolean);

    const hasSyllabus = safeSections.length > 0;
    const hasTranscript = safeTranscripts.length > 0;
    if (!hasSyllabus && !hasTranscript) {
      return res.status(400).json({ success: false, error: "Add syllabus topics or select studied videos with available transcripts." });
    }

    const prompt = buildQuizGenerationPrompt({
      exams: safeExams,
      testType: safeTestType,
      scope: String(scope || "").slice(0, 300),
      questionCount,
      difficulty: String(difficulty || "Mixed difficulty").slice(0, 80),
      format: safeFormat,
      language: safeLanguage,
      syllabusSections: safeSections,
      transcripts: safeTranscripts,
    });
    const { payload, provider } = await runQuizGenerationWithFallback([
      { role: "system", content: QUIZ_GENERATION_SYSTEM_INSTRUCTION },
      { role: "user", content: prompt },
    ], safeFormat, questionCount);
    const questions = normalizeQuizQuestions(payload, safeFormat, questionCount);
    return res.json({
      success: true,
      questions,
      provider,
      language: safeLanguage,
      sourcesUsed: {
        syllabusSections: safeSections.length,
        videoTranscripts: safeTranscripts.length,
      },
    });
  } catch (error) {
    const details = String(error?.message || "Unknown quiz generation error.");
    console.error("Quiz generation failed:", details);
    return res.status(502).json({ success: false, error: "Could not generate a valid mock test. Please try again or select different sources.", details });
  }
});

async function askGeminiQuizGrade(prompt, image) {
  if (!GEMINI_API_KEY || !gemini) throw new Error("GEMINI_API_KEY is missing.");
  const contents = image
    ? [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.base64 } }] }]
    : prompt;
  const response = await gemini.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: { systemInstruction: QUIZ_GRADING_SYSTEM_INSTRUCTION, maxOutputTokens: 2048, responseMimeType: "application/json" },
  });
  if (!response?.text) throw new Error("Gemini returned an empty grading response.");
  return response.text.trim();
}

app.post("/api/quiz/grade-written", async (req, res) => {
  try {
    const { question = {}, answerText = "", imageBase64 = "" } = req.body || {};
    const safeAnswer = String(answerText || "").trim().slice(0, 12000);
    const image = getQuizImage(imageBase64);
    if (!safeAnswer && !image) return res.status(400).json({ success: false, error: "Type an answer or upload a photo before requesting feedback." });
    if (!String(question?.text || "").trim() || !String(question?.answer || "").trim()) {
      return res.status(400).json({ success: false, error: "This written question is missing its model answer or rubric." });
    }

    const prompt = buildQuizGradingPrompt({ question, answerText: safeAnswer });
    const gradingMessages = [
      { role: "system", content: QUIZ_GRADING_SYSTEM_INSTRUCTION },
      { role: "user", content: prompt, ...(image ? { images: [image.base64] } : {}) },
    ];
    const attempts = [];
    if (!image && !IS_VERCEL && OLLAMA_MODEL) {
      attempts.push({ name: "Local Ollama", run: () => askOllama(gradingMessages, { maxCompletionTokens: 2048 }) });
    }
    attempts.push({
      name: "DeepSeek V4.1 Flash via Ollama Cloud",
      run: () => askOllamaStudyPlan(gradingMessages),
    });
    attempts.push({ name: "Gemini", run: () => askGeminiQuizGrade(prompt, image) });
    if (!image) attempts.push({ name: "Groq", run: () => askGroq(gradingMessages, { maxCompletionTokens: 2048 }) });

    const errors = [];
    for (const attempt of attempts) {
      try {
        const grade = parseQuizGrade(await attempt.run());
        if (image && !grade.extractedText) throw new Error("The image text could not be read reliably. Please type your answer or upload a clearer photo.");
        return res.json({ success: true, ...grade, provider: attempt.name });
      } catch (error) {
        const message = String(error?.message || "Unknown grading error.");
        errors.push(`${attempt.name}: ${message}`);
        console.error(`Written answer grading with ${attempt.name} failed:`, message);
      }
    }
    throw new Error(errors.join(" | "));
  } catch (error) {
    const details = String(error?.message || "Unknown written-answer grading error.");
    console.error("Written answer grading failed:", details);
    const status = details.startsWith("Upload an") || details.startsWith("The answer photo") ? 400 : 502;
    return res.status(status).json({ success: false, error: "Could not grade this written answer.", details });
  }
});

// ==========================================================
// HEALTH CHECK
// ==========================================================

app.get(
  "/api/health",
  (req, res) => {
    return res.json({
      success: true,

      service:
        "SmartDoc AI",

      status:
        "running",

      providers: {
        gemini:
          Boolean(
            GEMINI_API_KEY
          ),

        cerebras:
          Boolean(
            CEREBRAS_API_KEY
          ),

        groq:
          Boolean(
            GROQ_API_KEY
          ),
      },

      timestamp:
        new Date().toISOString(),
    });
  }
);

// ==========================================================
// ROOT
// ==========================================================

app.get(
  "/",
  (req, res) => {
    return res.json({
      success: true,

      message:
        "SmartDoc AI backend is running.",

      service:
        "SmartDoc AI",

      version:
        "updated-summary-format",
    });
  }
);

// ==========================================================
// ERROR HANDLER
// ==========================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error?.message ||
        error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    return res.status(500).json({
      success: false,

      error:
        "Internal server error.",

      details:
        error?.message ||
        "Unknown server error.",
    });
  }
);

// ==========================================================
// START SERVER
// ==========================================================

app.listen(
  PORT,
  () => {
    console.log(
      "========================================"
    );

    console.log(
      "SmartDoc AI Backend"
    );

    console.log(
      "Server running on port:",
      PORT
    );

    console.log(
      "========================================"
    );
  }
);
