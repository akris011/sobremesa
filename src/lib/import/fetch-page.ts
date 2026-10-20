import "server-only";

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";
import type { Readable } from "node:stream";

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export class FetchPageError extends Error {}

// Addresses a recipe site never lives at: loopback, private networks, link-local
// (cloud metadata at 169.254.169.254), carrier NAT, multicast and reserved.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(net, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  if (family !== 6) return false;
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return !blocked.check(mapped[1], "ipv4");
  if (/^::ffff:/i.test(address)) return false; // hex-form mapped address; no recipe site needs it
  return !blocked.check(address, "ipv6");
}

/**
 * DNS lookup for the request itself, so the address we check is the address we
 * connect to (a separate check-then-fetch can be beaten by DNS rebinding).
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as unknown as LookupAddress[];
    const ok = list.filter((a) => isPublicAddress(a.address));
    if (ok.length === 0 || ok.length !== list.length) {
      return callback(new FetchPageError("That address isn't a public website."), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, ok);
    callback(null, ok[0].address, ok[0].family);
  });
};

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchPageError("That doesn't look like a web address.");
  }
  if (url.protocol !== "https:") throw new FetchPageError("Use a link that starts with https://.");
  if (url.username || url.password) throw new FetchPageError("That link has a password in it.");
  if (url.port && url.port !== "443") throw new FetchPageError("That link uses an unusual port.");
  // Literal IPs skip DNS, so check them here too.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw new FetchPageError("That address isn't a public website.");
  return url;
}

/** GET one https URL. Resolves with the response, or a redirect target. */
function getOnce(url: URL, signal: AbortSignal): Promise<{ location: string } | { body: string; type: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup,
        signal,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; SobremesaRecipeImport/1.0)",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en, es;q=0.8",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ location: res.headers.location });
        }
        if (status === 401 || status === 403 || status === 429) {
          res.resume();
          return reject(new FetchPageError("That site wouldn't let us read the page."));
        }
        if (status < 200 || status >= 300) {
          res.resume();
          return reject(new FetchPageError(`That page didn't load (error ${status}).`));
        }
        const type = String(res.headers["content-type"] ?? "");
        if (!/text\/html|application\/xhtml|application\/ld\+json/i.test(type)) {
          res.resume();
          return reject(new FetchPageError("That link isn't a web page. For a PDF, choose it under “Photo or PDF”."));
        }
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: Readable = res;
        if (encoding === "gzip") stream = res.pipe(createGunzip());
        else if (encoding === "deflate") stream = res.pipe(createInflate());
        else if (encoding === "br") stream = res.pipe(createBrotliDecompress());

        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(new FetchPageError("That page is too large to read."));
            return;
          }
          chunks.push(chunk);
        });
        stream.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8"), type }));
        stream.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Fetch a public https page's HTML: 8 s total, 2 MB cap, every redirect checked again. */
export async function fetchPage(raw: string): Promise<{ html: string; url: URL }> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = checkUrl(raw.trim());
  try {
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await getOnce(url, signal);
      if ("body" in res) return { html: res.body, url };
      url = checkUrl(new URL(res.location, url).toString());
    }
  } catch (e) {
    if (e instanceof FetchPageError) throw e;
    if (signal.aborted) throw new FetchPageError("That page took too long to load.");
    const code = (e as { code?: string }).code;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new FetchPageError("We couldn't find that website.");
    throw new FetchPageError("We couldn't load that page.");
  }
  throw new FetchPageError("That link redirects too many times.");
}
