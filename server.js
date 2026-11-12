// server.ts
import express from "express";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import path from "path";
var app = express();
app.use(express.json({ limit: "20mb" }));
function isPrivateHost(hostname) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
  if (/^10\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (/^127\./.test(host)) return true;
  return false;
}
function scoreLink(urlStr, text, category) {
  const lowerUrl = urlStr.toLowerCase();
  const lowerText = text.toLowerCase();
  const combined = `${lowerUrl} ${lowerText}`;
  const isFile = /\.(pdf|docx|doc)(\?.*)?$/i.test(lowerUrl);
  let score = isFile ? 5 : 0;
  const keywords = ["cct", "act", "conven\xE7\xE3o", "convencao", "acordo", "coletivo", "coletiva"];
  keywords.forEach((kw) => {
    if (combined.includes(kw)) {
      score += 3;
    }
  });
  if (category) {
    const catWords = category.toLowerCase().split(/[\s,.-]+/).filter((w) => w.length >= 4);
    catWords.forEach((cw) => {
      if (combined.includes(cw)) {
        score += 4;
      }
    });
  }
  const yearMatches = combined.match(/\b(20[0-2][0-9])\b/g);
  if (yearMatches) {
    const years = yearMatches.map((y) => parseInt(y, 10));
    const maxYear = Math.max(...years);
    score += maxYear;
  }
  const penaltyKeywords = ["edital", "assembleia", "boleto", "elei\xE7\xE3o", "eleicao", "estatuto"];
  penaltyKeywords.forEach((kw) => {
    if (combined.includes(kw)) {
      score -= 5;
    }
  });
  return { score, isFile };
}
async function fetchWithTimeout(urlStr, options = {}) {
  const parsed = new URL(urlStr);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Apenas protocolos HTTP/HTTPS s\xE3o permitidos.");
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Acesso a endere\xE7os locais/privados bloqueado por seguran\xE7a.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 2e4);
  try {
    const response = await fetch(urlStr, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
        ...options.headers
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}
app.post("/api/probe", async (req, res) => {
  const { url: targetUrl, category = "" } = req.body;
  if (!targetUrl || typeof targetUrl !== "string") {
    return res.status(400).json({ diagnosis: "ERRO", message: "URL inv\xE1lida ou n\xE3o fornecida." });
  }
  const startTime = Date.now();
  try {
    const initialResponse = await fetchWithTimeout(targetUrl, { timeoutMs: 2e4 });
    const durationMs = Date.now() - startTime;
    const pageStatus = initialResponse.status;
    if (pageStatus === 403 || pageStatus === 429) {
      return res.json({
        pageStatus,
        durationMs,
        fileLinksCount: 0,
        candidates: [],
        bestTest: null,
        diagnosis: "BLOQUEADO"
      });
    }
    if (!initialResponse.ok) {
      return res.json({
        pageStatus,
        durationMs,
        fileLinksCount: 0,
        candidates: [],
        bestTest: null,
        diagnosis: "ERRO",
        message: `HTTP status ${pageStatus}`
      });
    }
    const contentType = (initialResponse.headers.get("content-type") || "").toLowerCase();
    const finalUrl = initialResponse.url || targetUrl;
    const isDirectFile = contentType.includes("application/pdf") || contentType.includes("wordprocessingml") || contentType.includes("msword") || /\.(pdf|docx|doc)(\?.*)?$/i.test(finalUrl);
    if (isDirectFile) {
      let bestTest2 = { status: 200, contentType, totalSize: 0 };
      try {
        const rangeResp = await fetchWithTimeout(finalUrl, { timeoutMs: 1e4, headers: { "Range": "bytes=0-1023" } });
        const cr = rangeResp.headers.get("content-range");
        let total = 0;
        if (cr && cr.includes("/")) {
          total = parseInt(cr.split("/")[1], 10) || 0;
        }
        if (!total) {
          total = parseInt(rangeResp.headers.get("content-length") || "0", 10);
        }
        bestTest2 = { status: rangeResp.status, contentType: rangeResp.headers.get("content-type") || contentType, totalSize: total };
      } catch {
      }
      return res.json({
        pageStatus,
        durationMs,
        fileLinksCount: 1,
        candidates: [{ url: finalUrl, title: "Arquivo Direto", score: 100, isFile: true }],
        bestTest: bestTest2,
        diagnosis: "OK"
      });
    }
    const htmlText = await initialResponse.text();
    if (!htmlText || htmlText.trim().length < 50) {
      return res.json({
        pageStatus,
        durationMs,
        fileLinksCount: 0,
        candidates: [],
        bestTest: null,
        diagnosis: "SEM_LINKS"
      });
    }
    const candidateMap = /* @__PURE__ */ new Map();
    const parseLinksInPage = (pageHtml, baseUrl) => {
      const page$ = cheerio.load(pageHtml);
      page$("a[href]").each((_, el) => {
        const href = page$(el).attr("href");
        const text = page$(el).text().trim() || page$(el).attr("title") || "";
        if (!href) return;
        try {
          const resolvedUrl = new URL(href, baseUrl).href;
          const parsedResolved = new URL(resolvedUrl);
          if (parsedResolved.protocol !== "http:" && parsedResolved.protocol !== "https:") return;
          if (isPrivateHost(parsedResolved.hostname)) return;
          const { score, isFile } = scoreLink(resolvedUrl, text, category);
          if (!candidateMap.has(resolvedUrl) || candidateMap.get(resolvedUrl).score < score) {
            candidateMap.set(resolvedUrl, {
              url: resolvedUrl,
              title: text || resolvedUrl,
              score,
              isFile
            });
          }
        } catch {
        }
      });
    };
    parseLinksInPage(htmlText, finalUrl);
    const initialDomain = new URL(finalUrl).hostname;
    const allCands = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
    if (allCands.length > 0 && !allCands[0].isFile && allCands[0].score > 0) {
      try {
        const subUrl = new URL(allCands[0].url);
        if (subUrl.hostname === initialDomain) {
          const subResp = await fetchWithTimeout(allCands[0].url, { timeoutMs: 8e3 });
          if (subResp.ok && (subResp.headers.get("content-type") || "").includes("text/html")) {
            const subHtml = await subResp.text();
            parseLinksInPage(subHtml, allCands[0].url);
          }
        }
      } catch {
      }
    }
    const sortedCands = Array.from(candidateMap.values()).sort((a, b) => b.score - a.score);
    const fileLinksCount = sortedCands.filter((c) => c.isFile).length;
    const top5 = sortedCands.slice(0, 5).map((c) => ({ url: c.url, title: c.title, score: c.score }));
    if (fileLinksCount === 0 && sortedCands.length === 0) {
      return res.json({
        pageStatus,
        durationMs,
        fileLinksCount: 0,
        candidates: [],
        bestTest: null,
        diagnosis: "SEM_LINKS"
      });
    }
    const best = sortedCands[0];
    let bestTest = { status: 0, contentType: "", totalSize: 0 };
    try {
      const rangeResp = await fetchWithTimeout(best.url, {
        timeoutMs: 15e3,
        headers: { "Range": "bytes=0-1023" }
      });
      const cr = rangeResp.headers.get("content-range");
      let total = 0;
      if (cr && cr.includes("/")) {
        total = parseInt(cr.split("/")[1], 10) || 0;
      }
      if (!total) {
        total = parseInt(rangeResp.headers.get("content-length") || "0", 10);
      }
      bestTest = {
        status: rangeResp.status,
        contentType: rangeResp.headers.get("content-type") || "",
        totalSize: total
      };
    } catch (e) {
      return res.json({
        pageStatus,
        durationMs,
        fileLinksCount,
        candidates: top5,
        bestTest: null,
        diagnosis: "BLOQUEADO"
      });
    }
    const diagnosis = bestTest.status === 200 || bestTest.status === 206 ? "OK" : "ERRO";
    return res.json({
      pageStatus,
      durationMs,
      fileLinksCount,
      candidates: top5,
      bestTest,
      diagnosis
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errMessage = (err.message || "").toLowerCase();
    const isBlock = errMessage.includes("timeout") || errMessage.includes("aborted") || errMessage.includes("enotfound") || errMessage.includes("econnrefused");
    return res.json({
      pageStatus: 0,
      durationMs,
      fileLinksCount: 0,
      candidates: [],
      bestTest: null,
      diagnosis: isBlock ? "BLOQUEADO" : "ERRO",
      message: err.message
    });
  }
});
app.post("/api/fetch", async (req, res) => {
  const { url: targetUrl } = req.body;
  if (!targetUrl || typeof targetUrl !== "string") {
    return res.status(400).json({ error: "requer_navegacao", message: "URL inv\xE1lida ou n\xE3o fornecida." });
  }
  try {
    const response = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const fileName = path.basename(new URL(response.url || targetUrl).pathname) || "documento.pdf";
    return res.json({
      success: true,
      mimeType: response.headers.get("content-type") || "application/pdf",
      dataBase64: base64,
      fileName,
      chosenUrl: response.url || targetUrl,
      candidates: []
    });
  } catch (err) {
    return res.status(400).json({ error: "requer_navegacao", message: err.message });
  }
});
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa"
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
}
var PORT = 3e3;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Express Server executando na porta ${PORT}`);
});
