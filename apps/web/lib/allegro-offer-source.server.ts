import {
  FirecrawlError,
  scrapeHtmlWithFirecrawl,
  type Fetcher,
  type FirecrawlProxyMode,
} from "./firecrawl.server.js";

const MAX_OFFER_HTML_CHARACTERS = 5_000_000;
const OFFER_ID_AT_END = /(?:^|-)\d{8,}$/u;

export type AllegroDocumentSource = "public_allegro_page" | "firecrawl_allegro_page";

export type AllegroOfferHtml = {
  html: string;
  finalUrl: URL;
  source: AllegroDocumentSource;
};

export type OfferSourceErrorCode =
  | "invalid_url"
  | "offer_unavailable"
  | "direct_fetch_failed"
  | "firecrawl_not_configured"
  | "firecrawl_access_failed"
  | "firecrawl_credits_exhausted"
  | "firecrawl_rate_limited"
  | "response_too_large";

export class OfferSourceError extends Error {
  readonly code: OfferSourceErrorCode;
  readonly httpStatus: number;

  constructor(code: OfferSourceErrorCode, httpStatus: number, message: string) {
    super(message);
    this.name = "OfferSourceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type FetchAllegroOfferHtmlOptions = {
  directFetch?: Fetcher;
  firecrawlFetch?: Fetcher;
  firecrawlApiKey?: string;
  firecrawlProxyMode?: FirecrawlProxyMode;
  firecrawlMaxAgeMs?: number;
};

export function canonicalAllegroOfferUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new OfferSourceError("invalid_url", 400, "Wpisz poprawny link do oferty Allegro.");
  }

  const validHost = url.hostname === "allegro.pl" || url.hostname === "www.allegro.pl";
  const normalizedPath = url.pathname.replace(/\/+$/u, "");
  const lastSegment = normalizedPath.split("/").at(-1) ?? "";
  if (
    url.protocol !== "https:" ||
    !validHost ||
    !normalizedPath.startsWith("/oferta/") ||
    !OFFER_ID_AT_END.test(lastSegment)
  ) {
    throw new OfferSourceError(
      "invalid_url",
      400,
      "Wklej pełny link do konkretnej oferty Allegro, zakończony numerycznym ID.",
    );
  }

  url.hostname = "allegro.pl";
  url.pathname = normalizedPath;
  url.search = "";
  url.hash = "";
  return url;
}

function ensureSafeHtmlSize(response: Response): void {
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_OFFER_HTML_CHARACTERS) {
    throw new OfferSourceError(
      "response_too_large",
      413,
      "Strona oferty jest zbyt duża do bezpiecznej analizy.",
    );
  }
}

function mapFirecrawlError(error: FirecrawlError): OfferSourceError {
  if (error.code === "missing_api_key") {
    return new OfferSourceError("firecrawl_not_configured", 503, error.message);
  }
  if (error.code === "credits_exhausted") {
    return new OfferSourceError("firecrawl_credits_exhausted", 503, error.message);
  }
  if (error.code === "rate_limited") {
    return new OfferSourceError("firecrawl_rate_limited", 429, error.message);
  }
  if (error.code === "response_too_large") {
    return new OfferSourceError("response_too_large", 413, error.message);
  }
  return new OfferSourceError("firecrawl_access_failed", 503, error.message);
}

async function firecrawlFallback(
  requestedUrl: URL,
  options: FetchAllegroOfferHtmlOptions,
): Promise<AllegroOfferHtml> {
  try {
    const result = await scrapeHtmlWithFirecrawl(requestedUrl, {
      apiKey: options.firecrawlApiKey ?? "",
      ...(options.firecrawlFetch ? { fetcher: options.firecrawlFetch } : {}),
      ...(options.firecrawlProxyMode ? { proxyMode: options.firecrawlProxyMode } : {}),
      ...(options.firecrawlMaxAgeMs !== undefined
        ? { maxAgeMs: options.firecrawlMaxAgeMs }
        : {}),
    });
    return {
      html: result.html,
      finalUrl: canonicalAllegroOfferUrl(result.finalUrl),
      source: "firecrawl_allegro_page",
    };
  } catch (error) {
    if (error instanceof FirecrawlError) throw mapFirecrawlError(error);
    throw new OfferSourceError(
      "firecrawl_access_failed",
      503,
      "Firecrawl nie mógł teraz pobrać oferty. Spróbuj ponownie później.",
    );
  }
}

export async function fetchAllegroOfferHtml(
  rawUrl: string,
  options: FetchAllegroOfferHtmlOptions = {},
): Promise<AllegroOfferHtml> {
  const requestedUrl = canonicalAllegroOfferUrl(rawUrl);
  const directFetch = options.directFetch ?? fetch;
  let response: Response;

  try {
    response = await directFetch(requestedUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pl-PL,pl;q=0.9",
        "User-Agent": "Shoppalyzer-GEO/0.1 (+https://shoppalyzer.pl)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    if (options.firecrawlApiKey) return firecrawlFallback(requestedUrl, options);
    throw new OfferSourceError(
      "direct_fetch_failed",
      502,
      "Nie udało się połączyć z Allegro. Spróbuj ponownie później.",
    );
  }

  if (response.status === 403) return firecrawlFallback(requestedUrl, options);
  if (response.status === 404 || response.status === 410) {
    throw new OfferSourceError(
      "offer_unavailable",
      404,
      "Oferta nie istnieje, została zakończona albo link jest nieaktualny.",
    );
  }
  if (!response.ok) {
    throw new OfferSourceError(
      "direct_fetch_failed",
      502,
      `Allegro chwilowo nie udostępnia oferty (HTTP ${response.status}).`,
    );
  }

  ensureSafeHtmlSize(response);
  const html = await response.text();
  if (html.length > MAX_OFFER_HTML_CHARACTERS) {
    throw new OfferSourceError(
      "response_too_large",
      413,
      "Strona oferty jest zbyt duża do bezpiecznej analizy.",
    );
  }

  return {
    html,
    finalUrl: response.url ? canonicalAllegroOfferUrl(response.url) : requestedUrl,
    source: "public_allegro_page",
  };
}
