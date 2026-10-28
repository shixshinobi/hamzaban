// Drives the official web apps (chatgpt.com, claude.ai, gemini.google.com) inside a
// private Electron window that shares nothing with the user's browser. The user signs
// in once in that window; afterwards translations are typed into a fresh chat in the
// background and the answer is read back while it streams.
//
// Sites change their markup now and then, so every selector has several fallbacks
// and the whole driver is data-driven through SITES.

import { BrowserWindow, session } from "electron"
import fs from "node:fs"
import path from "node:path"
import { log, logFile } from "../log"
import { ICON } from "../windows"
import type { EngineKind, ErrorCode } from "../../shared/types"
import { EngineError, type EngineContext, type EngineRunner } from "./types"

type SiteId = "chatgpt" | "claude" | "gemini"

interface SiteDef {
  title: string
  home: string
  newChat: string
  input: string[]
  send: string[]
  stop: string[]
  reply: string
  /** The user's own message bubbles, used to confirm a prompt was really sent. */
  sent: string
  content: string[]
  /** Attribute that is "true" while the reply streams (Claude). */
  streamingAttr?: string
  /** Attribute that appears on the reply once it has finished (ChatGPT). */
  completeAttr?: string
  attach: "input" | "paste"
  loginUrl: RegExp
  sessionCookie: { url: string; name: string }
}

const SITES: Record<SiteId, SiteDef> = {
  chatgpt: {
    title: "ChatGPT",
    home: "https://chatgpt.com/",
    newChat: "https://chatgpt.com/?temporary-chat=true",
    input: [
      "#prompt-textarea",
      "textarea#mobile-composer-prompt",
      "[data-ds-composer] textarea",
      "div[contenteditable='true'].ProseMirror",
      "form div[contenteditable='true']",
      "textarea",
    ],
    send: [
      "button[data-testid='send-button']",
      "#composer-submit-button",
      "button[aria-label='Send message']",
      "button[aria-label*='Send' i]",
    ],
    stop: ["button[data-testid='stop-button']", "button[aria-label*='Stop' i]"],
    reply:
      "[data-message-author-role='assistant'], [data-message-role='assistant'], [data-turn='assistant']",
    sent: "[data-message-author-role='user'], [data-message-role='user'], [data-turn='user']",
    content: [
      "[data-assistant-markdown-root]",
      "[data-assistant-markdown]",
      ".markdown",
      "[class*='markdown']",
    ],
    completeAttr: "data-message-complete",
    attach: "input",
    loginUrl: /auth\.openai\.com|\/auth\/login/,
    sessionCookie: {
      url: "https://chatgpt.com",
      name: "__Secure-next-auth.session-token",
    },
  },
  claude: {
    title: "Claude",
    home: "https://claude.ai/",
    newChat: "https://claude.ai/new",
    input: [
      "div[contenteditable='true'].ProseMirror",
      "fieldset div[contenteditable='true']",
      "div[contenteditable='true']",
    ],
    send: [
      "button[aria-label='Send message' i]",
      "button[aria-label*='Send' i]",
      "fieldset button[type='button']:last-of-type",
    ],
    stop: ["button[aria-label*='Stop' i]"],
    reply: "[data-is-streaming]",
    sent: "[data-testid='user-message']",
    content: [
      ".font-claude-response",
      ".font-claude-message",
      ".standard-markdown",
    ],
    streamingAttr: "data-is-streaming",
    attach: "input",
    loginUrl: /\/login|\/logout/,
    sessionCookie: { url: "https://claude.ai", name: "sessionKey" },
  },
  gemini: {
    title: "Gemini",
    home: "https://gemini.google.com/app",
    newChat: "https://gemini.google.com/app",
    input: [
      "rich-textarea .ql-editor",
      "div.ql-editor[contenteditable='true']",
      "div[contenteditable='true']",
    ],
    send: [
      "button.send-button:not(.stop)",
      "button[aria-label*='Send' i]",
      "button[aria-label*='ارسال']",
    ],
    stop: ["button.send-button.stop", "button[aria-label*='Stop' i]"],
    reply: "model-response",
    sent: "user-query",
    content: ["message-content .markdown", "message-content"],
    attach: "paste",
    loginUrl: /accounts\.google\.com/,
    sessionCookie: { url: "https://google.com", name: "__Secure-1PSID" },
  },
}

const KIND_TO_SITE: Partial<Record<EngineKind, SiteId>> = {
  "chatgpt-web": "chatgpt",
  "claude-web": "claude",
  "gemini-web": "gemini",
}

const CHROME_UA = (() => {
  const chrome = process.versions.chrome
  const os =
    process.platform === "win32"
      ? "Windows NT 10.0; Win64; x64"
      : process.platform === "darwin"
        ? "Macintosh; Intel Mac OS X 10_15_7"
        : "X11; Linux x86_64"
  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chrome} Safari/537.36`
})()

const windows = new Map<SiteId, BrowserWindow>()
const queues = new Map<SiteId, Promise<unknown>>()
let onLoginChange: ((site: SiteId) => void) | null = null
let onGoogleBlocked: ((site: SiteId) => void) | null = null

export function setLoginChangeListener(fn: (site: SiteId) => void) {
  onLoginChange = fn
}

/** Google refuses to sign in inside embedded browsers; the app explains the alternatives. */
export function setGoogleBlockedListener(fn: (site: SiteId) => void) {
  onGoogleBlocked = fn
}

const GOOGLE_REJECTED = /^https:\/\/accounts\.google\.com\/.*\/rejected/
const GOOGLE_REJECTED_TEXT = /may not be secure|ممکن است ایمن نباشد/i
const GOOGLE_REJECTED_TITLE =
  /couldn.t sign you in|ورود به سیستم امکان‌پذیر نبود/i

/** Watch a session window (and the sign-in popups it opens) for Google's rejection page. */
function watchGoogleSignIn(site: SiteId, wc: Electron.WebContents) {
  let warnedAt = 0
  const warn = () => {
    if (Date.now() - warnedAt < 30000) return
    warnedAt = Date.now()
    onGoogleBlocked?.(site)
  }
  // Google's sign-in is a single-page app: the rejection usually arrives as an in-page
  // navigation and a title change, not as a full page load.
  const check = () => {
    if (
      wc.isDestroyed() ||
      !wc.getURL().startsWith("https://accounts.google.com/")
    )
      return
    if (
      GOOGLE_REJECTED.test(wc.getURL()) ||
      GOOGLE_REJECTED_TITLE.test(wc.getTitle())
    )
      return warn()
    wc.executeJavaScript("document.body.innerText", true)
      .then((text: string) => GOOGLE_REJECTED_TEXT.test(text) && warn())
      .catch(() => {})
  }
  wc.on("did-navigate", check)
  wc.on("did-navigate-in-page", () => setTimeout(check, 600))
  wc.on("did-finish-load", check)
  wc.on("page-title-updated", check)
  wc.on("did-create-window", (child) =>
    watchGoogleSignIn(site, child.webContents)
  )
}

function partition(site: SiteId) {
  return `persist:hz-${site}`
}

function getWindow(site: SiteId): BrowserWindow {
  const existing = windows.get(site)
  if (existing && !existing.isDestroyed()) return existing
  const ses = session.fromPartition(partition(site))
  ses.setUserAgent(CHROME_UA)
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 820,
    icon: ICON,
    title: SITES[site].title,
    autoHideMenuBar: true,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      partition: partition(site),
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  win.webContents.setUserAgent(CHROME_UA)
  // A half-finished run leaves a draft (or an attachment) behind and the site then blocks
  // navigation with a "Leave page?" prompt nobody can answer in a hidden window. Always leave.
  win.webContents.on("will-prevent-unload", (e) => e.preventDefault())
  watchGoogleSignIn(site, win.webContents)
  win.webContents.setWindowOpenHandler(() => {
    // OAuth popups (Google / Apple / Microsoft sign-in) must open inside the same session.
    return {
      action: "allow",
      overrideBrowserWindowOptions: {
        webPreferences: { partition: partition(site) },
        autoHideMenuBar: true,
        icon: ICON,
      },
    }
  })
  win.on("close", (e) => {
    // Keep the session window alive; just hide it when the user closes it.
    e.preventDefault()
    win.hide()
    onLoginChange?.(site)
  })
  windows.set(site, win)
  return win
}

export function destroyWebWindows() {
  for (const w of windows.values()) if (!w.isDestroyed()) w.destroy()
  windows.clear()
}

export function siteForKind(kind: EngineKind): SiteId | undefined {
  return KIND_TO_SITE[kind]
}

export async function openWebLogin(kind: EngineKind) {
  const site = KIND_TO_SITE[kind]
  if (!site) return
  // Gemini only accepts Google accounts, and Google refuses sign-in inside embedded
  // browsers, so the window would be a dead end. Explain the working routes instead.
  if (site === "gemini") return onGoogleBlocked?.(site)
  const win = getWindow(site)
  ghost(win, false)
  if (!win.webContents.getURL())
    await win.loadURL(SITES[site].home).catch(() => {})
  win.setTitle(`${SITES[site].title} — Hamzaban`)
  win.center()
  win.show()
  win.focus()
}

export async function webLoggedIn(kind: EngineKind): Promise<boolean> {
  const site = KIND_TO_SITE[kind]
  if (!site) return false
  const { url, name } = SITES[site].sessionCookie
  const cookies = await session
    .fromPartition(partition(site))
    .cookies.get({ url })
  return cookies.some((c) => c.name.startsWith(name))
}

export async function webLogout(kind: EngineKind) {
  const site = KIND_TO_SITE[kind]
  if (!site) return
  await session.fromPartition(partition(site)).clearStorageData()
  const win = windows.get(site)
  if (win && !win.isDestroyed()) win.webContents.loadURL("about:blank")
}

/** Make the worker window render normally (so streaming UIs keep updating) without being visible. */
function ghost(win: BrowserWindow, on: boolean) {
  if (on) {
    if (win.isVisible()) return
    win.setSkipTaskbar(true)
    win.setFocusable(false)
    if (process.platform === "linux") win.setPosition(-4000, -4000)
    else {
      win.setOpacity(0)
      win.setIgnoreMouseEvents(true)
    }
    win.showInactive()
    ;(win as unknown as { __ghost?: boolean }).__ghost = true
  } else if ((win as unknown as { __ghost?: boolean }).__ghost) {
    ;(win as unknown as { __ghost?: boolean }).__ghost = false
    win.hide()
    win.setOpacity(1)
    win.setIgnoreMouseEvents(false)
    win.setFocusable(true)
    win.setSkipTaskbar(false)
  }
}

/** Anything a site shows once a file is attached to the composer. */
const ATTACHMENT = [
  "img[src^='blob:']",
  "[data-testid*='attachment' i]",
  "[data-testid*='file-thumbnail' i]",
  "uploader-file-preview",
  "[class*='file-preview' i]",
]

/** What the page looks like right now; written to the log when a step fails. */
const PAGE_STATE = `
  const b = __q(A.send);
  return { url: location.href, title: document.title.slice(0, 60), input: !!__q(A.input), images: document.images.length,
    attachment: !!__q(A.preview), send: b ? { disabled: b.disabled || b.getAttribute('aria-disabled') === 'true', label: b.getAttribute('aria-label') } : null,
    dialogs: [...document.querySelectorAll('[role=dialog]')].filter(d => d.offsetParent).map(d => d.innerText.slice(0, 80)) }`

/**
 * Outline of the conversation's last turns (tags and data-/role attributes only, never
 * text), so a changed site layout can be diagnosed from the log.
 */
const TURNS_OUTLINE = `
  const pick = (el) => { const o = { tag: el.tagName.toLowerCase() };
    for (const a of el.attributes) if (/^(data-|role$|id$)/.test(a.name)) o[a.name] = a.value.slice(0, 40); return o };
  const root = document.querySelector('main') || document.body;
  const turns = [...root.querySelectorAll('article, section[data-turn], [data-message-author-role], [data-message-role], [data-turn], [data-testid*="turn" i], [data-message-id]')];
  return { url: location.href, turns: turns.length, last: turns.slice(-6).map(pick), stop: !!__q(A.stop) }`

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const HELPERS = `
  const __q = (list) => { for (const s of list) { try { const el = document.querySelector(s); if (el) return el } catch (e) {} } return null };
`

function js(
  wc: Electron.WebContents,
  body: string,
  args: Record<string, unknown> = {}
) {
  const code = `(async () => { ${HELPERS} const A = ${JSON.stringify(args)}; ${body} })()`
  return wc.executeJavaScript(code, true)
}

async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  timeout: number,
  signal: AbortSignal,
  step = 300
): Promise<T | null> {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (signal.aborted) throw new EngineError("cancelled", "cancelled")
    const v = await fn().catch(() => null)
    if (v) return v
    await sleep(step)
  }
  return null
}

async function runSite(site: SiteId, ctx: EngineContext): Promise<string> {
  const def = SITES[site]
  const win = getWindow(site)
  const wc = win.webContents
  const { signal } = ctx
  const started = Date.now()
  // Cancelled while it waited in the queue: nothing to do.
  if (signal.aborted) throw new EngineError("cancelled", "cancelled")
  const step = (name: string, extra?: unknown) =>
    log(
      `web:${site}`,
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
      name,
      ...(extra === undefined ? [] : [extra])
    )
  const pageState = () =>
    js(wc, PAGE_STATE, {
      send: def.send,
      input: def.input,
      preview: ATTACHMENT,
    }).catch((e: Error) => ({ error: e.message }))
  const fail = async (message: string, code: ErrorCode) => {
    step(`fail: ${message}`, await pageState())
    // A picture of the hidden page next to the log says more than any selector dump.
    const shot = await wc.capturePage().catch(() => null)
    if (shot && !shot.isEmpty()) {
      fs.writeFile(
        path.join(path.dirname(logFile()), `failure-${site}.png`),
        shot.toPNG(),
        () => {}
      )
    }
    return new EngineError(message, code)
  }
  const userVisible =
    win.isVisible() && !(win as unknown as { __ghost?: boolean }).__ghost
  if (!userVisible) ghost(win, true)
  step("start", { image: !!ctx.req.image, chars: ctx.prompt.combined.length })
  try {
    // loadURL can hang when a navigation is held up, so it never gets more than 25 s.
    await Promise.race([wc.loadURL(def.newChat).catch(() => {}), sleep(25000)])
    step("loaded", wc.getURL())
    const state = await waitFor(
      async () => {
        const url = wc.getURL()
        if (def.loginUrl.test(url)) return "login"
        return (await js(
          wc,
          `if (document.title.includes('Just a moment') || document.querySelector('#challenge-form, iframe[src*="challenges.cloudflare"]')) return 'challenge';
           return __q(A.input) ? 'ready' : null`,
          { input: def.input }
        )) as string | null
      },
      30000,
      signal
    )
    if (state !== "ready") {
      throw await fail(
        state === "challenge"
          ? `${def.title} wants a human check. Open the sign-in window once.`
          : `Sign in to ${def.title} first.`,
        "needs-login"
      )
    }
    step("ready")

    const counts = () =>
      js(
        wc,
        `return [document.querySelectorAll(A.reply).length, document.querySelectorAll(A.sent).length]`,
        { reply: def.reply, sent: def.sent }
      ) as Promise<[number, number]>
    const [before, sentBefore] = await counts()
    // An attachment shows up as a known preview element or, failing that, as one more <img> on the page.
    const imagesBefore = (await js(
      wc,
      `return document.images.length`
    )) as number
    const attached = () =>
      js(wc, `return !!__q(A.preview) || document.images.length > A.n`, {
        preview: ATTACHMENT,
        n: imagesBefore,
      }) as Promise<boolean>

    if (ctx.req.image) {
      // The composer is in the server-rendered HTML before the site's scripts take over, and a
      // file handed over that early is ignored. Re-offer it until the site shows a preview.
      const attach = () =>
        js(
          wc,
          `const [meta, b64] = A.image.split(',');
           const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/png';
           const bin = atob(b64); const bytes = new Uint8Array(bin.length);
           for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
           const file = new File([bytes], 'hamzaban-capture.png', { type: mime });
           const dt = new DataTransfer(); dt.items.add(file);
           const input = A.mode === 'input' ? document.querySelector('input[type=file][accept*="image"], input[type=file]') : null;
           if (input) { input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true }
           const box = __q(A.input); if (!box) return false; box.focus();
           box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
           return true`,
          { image: ctx.req.image, mode: def.attach, input: def.input }
        ) as Promise<boolean>
      let tries = 0
      const ok = await waitFor(
        async () => {
          if (!(await attach())) return false
          tries++
          return waitFor(attached, 2500, signal)
        },
        20000,
        signal
      )
      if (!ok)
        throw await fail(
          `${def.title}: could not attach the image.`,
          "unsupported"
        )
      step("attached", { tries })
    }

    const typed = await js(
      wc,
      `const box = __q(A.input); if (!box) return false; box.focus();
       if (box.tagName === 'TEXTAREA') {
         const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
         setter.call(box, A.text); box.dispatchEvent(new Event('input', { bubbles: true })); return true }
       const dt = new DataTransfer(); dt.setData('text/plain', A.text);
       box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
       await new Promise(r => setTimeout(r, 250));
       if (!box.innerText.trim() && !document.querySelector('[data-testid*="attachment"], [data-testid*="file"]')) {
         document.execCommand('insertText', false, A.text) }
       return true`,
      { input: def.input, text: ctx.prompt.combined }
    )
    if (!typed)
      throw await fail(`${def.title}: input box not found.`, "unknown")
    step("typed")

    // Sites drop an attachment they will not accept (signed out, quota) a moment after showing it.
    if (ctx.req.image) {
      await sleep(1200)
      if (!(await attached()))
        throw await fail(
          `${def.title}: the image was not accepted.`,
          "unsupported"
        )
    }

    // Click send once it is enabled (uploads finish first) and keep trying until the site
    // shows our message; a click while an upload is still running is silently ignored.
    const isSent = async () => {
      const [r, u] = await counts()
      return (
        r > before ||
        u > sentBefore ||
        !!(await js(wc, `return !!__q(A.stop)`, { stop: def.stop }))
      )
    }
    const sent = await waitFor(
      async () => {
        if (await isSent()) return true
        await js(
          wc,
          `const b = __q(A.send);
           if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true') b.click()`,
          { send: def.send }
        )
        await sleep(1500)
        return isSent()
      },
      ctx.req.image ? 60000 : 30000,
      signal,
      200
    )
    if (!sent) {
      throw await fail(
        ctx.req.image
          ? `${def.title}: the image could not be sent.`
          : `${def.title}: the message could not be sent. Open the sign-in window and check the page.`,
        ctx.req.image ? "unsupported" : "unknown"
      )
    }
    step("sent")

    // Stream the answer by polling the last assistant message.
    let last = ""
    let stableSince = Date.now()
    let outlined = false
    const sentAt = Date.now()
    const outline = () =>
      js(wc, TURNS_OUTLINE, { stop: def.stop }).catch((e: Error) => ({
        error: e.message,
      }))
    const deadline = sentAt + 240000
    while (Date.now() < deadline) {
      if (signal.aborted) {
        await js(wc, `const s = __q(A.stop); s && s.click()`, {
          stop: def.stop,
        }).catch(() => {})
        throw new EngineError("cancelled", "cancelled")
      }
      const snap = (await js(
        wc,
        `const all = document.querySelectorAll(A.reply);
         if (all.length <= A.before) return { has: false, streaming: true };
         const node = all[all.length - 1];
         let el = null; for (const s of A.content) { const f = node.querySelector(s); if (f) { el = f; break } }
         el = el || node;
         const codes = A.smart ? [...el.querySelectorAll('pre code')] : [];
         const text = codes.length ? codes.map(c => c.innerText).join('\\n') : el.innerText;
         const streaming = !!__q(A.stop)
           || (A.attr ? node.getAttribute(A.attr) === 'true' : false)
           // Only trust the "complete" marker when this layout uses it at all.
           || (A.done && document.querySelector('[' + A.done + ']')
                ? !(node.hasAttribute(A.done) || node.closest('[' + A.done + ']') || node.querySelector('[' + A.done + ']'))
                : false)
           || !!node.querySelector('[aria-busy="true"]');
         return { has: true, text, streaming }`,
        {
          reply: def.reply,
          content: def.content,
          before,
          smart: ctx.prompt.smart,
          stop: def.stop,
          attr: def.streamingAttr ?? null,
          done: def.completeAttr ?? null,
        }
      ).catch(() => ({ has: false, streaming: true }))) as {
        has: boolean
        text?: string
        streaming: boolean
      }

      if (snap.has && snap.text !== undefined) {
        const text = cleanup(snap.text)
        if (text !== last) {
          if (!last) step("first text")
          last = text
          stableSince = Date.now()
          ctx.snapshot(text)
        } else if (
          text &&
          Date.now() - stableSince > (snap.streaming ? 60000 : 1200)
        ) {
          // Finished, or the stream stalled for a minute: keep what arrived.
          step(snap.streaming ? "stalled, keeping partial answer" : "done", {
            chars: text.length,
          })
          return text
        }
      } else if (Date.now() - sentAt > 90000) {
        step("no reply found", await outline())
        throw await fail(`${def.title} did not answer.`, "network")
      } else if (Date.now() - sentAt > 30000) {
        // Not even our own message is on the page: the site is holding the request.
        const [r, u] = await counts()
        if (r <= before && u <= sentBefore) {
          step("held", await outline())
          throw await fail(
            `${def.title} accepted the message but is holding it.`,
            "held"
          )
        }
      } else if (!outlined && Date.now() - sentAt > 15000) {
        outlined = true
        step("still waiting for a reply", await outline())
      }
      await sleep(250)
    }
    if (last) return last
    throw await fail(`${def.title} did not answer in time.`, "network")
  } finally {
    if (!userVisible) ghost(win, false)
  }
}

function cleanup(text: string) {
  return text
    .split("\n")
    .filter((l) => !/^(jsonl?|ndjson|Copy code|کپی کد|Copy)$/i.test(l.trim()))
    .join("\n")
    .trim()
}

export const runWeb: EngineRunner = (ctx) => {
  const site = KIND_TO_SITE[ctx.engine.kind]
  if (!site) throw new EngineError("Unknown web engine", "unsupported")
  // One chat at a time per site: requests are queued behind each other.
  const prev = queues.get(site) ?? Promise.resolve()
  const next = prev.catch(() => {}).then(() => runSite(site, ctx))
  queues.set(site, next)
  return next
}
