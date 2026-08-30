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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

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

const GEMINI_MODEL = "gemini-3.6-flash";
const CEREBRAS_MODEL = "gpt-oss-120b";
const GROQ_MODEL = "openai/gpt-oss-120b";

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