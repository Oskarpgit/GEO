export const FIRECRAWL_SCRAPE_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";

const MAX_FIRECRAWL_RESPONSE_CHARACTERS = 7_000_000;
const MAX_OFFER_HTML_CHARACTERS = 5_000_000;

export type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type FirecrawlProxyMode = "basic" | "enhanced" | "auto";

export type FirecrawlErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "credits_exhausted"
  | "rate_limited"
  | "response_too_large"
  | "invalid_response"
  | "service_unavailable";

export class FirecrawlError extends Error {
  readonly code: FirecrawlErrorCode;

  constructor(code: FirecrawlErrorCode, message: string) {
    super(message);
    this.name = "FirecrawlError";
    this.code = code;
  }
}

export type FirecrawlScrapeResult = {
  html: string;
  finalUrl: string;
};

type FirecrawlScrapeOptions = {
  apiKey: string;
  fetcher?: Fetcher;
  proxyMode?: FirecrawlProxyMode;
  maxAgeMs?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorForStatus(status: number): FirecrawlError {
  if (status === 401 || status === 403) {
    return new FirecrawlError(
      "invalid_api_key",
      "Firecrawl odrzucił konfigurację dostępu. Sprawdź sekret po stronie serwera.",
    );
  }
  if (status === 402) {
    return new FirecrawlError(
      "credits_exhausted",
      "Limit kredytów Firecrawl został wyczerpany.",
    );
  }
  if (status === 429) {
    return new FirecrawlError(
      "rate_limited",
      "Firecrawl chwilowo przekroczył limit zapytań. Spróbuj ponownie później.",
    );
  }
  return new FirecrawlError(
    "service_unavailable",
    "Firecrawl nie mógł teraz pobrać oferty. Spróbuj ponownie później.",
  );
}

export async function scrapeHtmlWithFirecrawl(
  url: URL,
  options: FirecrawlScrapeOptions,
): Promise<FirecrawlScrapeResult> {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new FirecrawlError(
      "missing_api_key",
      "Allegro blokuje automatyczne pobieranie, a Firecrawl nie jest jeszcze skonfigurowany.",
    );
  }

  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(FIRECRAWL_SCRAPE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: url.toString(),
      formats: ["rawHtml"],
      onlyMainContent: false,
      onlyCleanContent: false,
      maxAge: options.maxAgeMs ?? 21_600_000,
      waitFor: 2_000,
      timeout: 45_000,
      location: { country: "PL", languages: ["pl-PL"] },
      removeBase64Images: true,
      blockAds: true,
      proxy: options.proxyMode ?? "basic",
      storeInCache: true,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) throw errorForStatus(response.status);

  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_FIRECRAWL_RESPONSE_CHARACTERS) {
    throw new FirecrawlError(
      "response_too_large",
      "Odpowiedź Firecrawl jest zbyt duża do bezpiecznej analizy.",
    );
  }

  const responseText = await response.text();
  if (responseText.length > MAX_FIRECRAWL_RESPONSE_CHARACTERS) {
    throw new FirecrawlError(
      "response_too_large",
      "Odpowiedź Firecrawl jest zbyt duża do bezpiecznej analizy.",
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new FirecrawlError(
      "invalid_response",
      "Firecrawl zwrócił odpowiedź w nieobsługiwanym formacie.",
    );
  }

  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new FirecrawlError(
      "invalid_response",
      "Firecrawl nie zwrócił kompletnej strony oferty.",
    );
  }

  const html =
    typeof payload.data.rawHtml === "string"
      ? payload.data.rawHtml
      : typeof payload.data.html === "string"
        ? payload.data.html
        : undefined;
  if (!html?.trim()) {
    throw new FirecrawlError(
      "invalid_response",
      "Firecrawl nie zwrócił kodu HTML oferty.",
    );
  }
  if (html.length > MAX_OFFER_HTML_CHARACTERS) {
    throw new FirecrawlError(
      "response_too_large",
      "Strona oferty jest zbyt duża do bezpiecznej analizy.",
    );
  }

  const metadata = isRecord(payload.data.metadata) ? payload.data.metadata : undefined;
  const finalUrl =
    (metadata && typeof metadata.url === "string" && metadata.url) ||
    (metadata && typeof metadata.sourceURL === "string" && metadata.sourceURL) ||
    url.toString();

  return { html, finalUrl };
}
