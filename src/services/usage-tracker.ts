import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import consola from "consola"
import { getDataDir } from "~/lib/data-dir"

const USAGE_DIR = getDataDir()
const USAGE_FILE = join(USAGE_DIR, "usage.json")

// Pricing per million tokens (USD)
const PRICING = {
    gpt: { input: 1.75, output: 14.0 },
    claude: { input: 5.0, output: 25.0 },
    gemini: { input: 2.0, output: 12.0 },
} as const

interface ModelUsage {
    input: number
    output: number
}

interface DailyUsage {
    date: string  // YYYY-MM-DD
    cost: number
    input: number
    output: number
}

interface KeyUsage {
    models: Record<string, ModelUsage>
    daily: DailyUsage[]
}

interface UsageData {
    lastUpdated: string
    models: Record<string, ModelUsage>
    daily: DailyUsage[]
    byKey?: Record<string, KeyUsage>
}

// In-memory cache
let usageCache: UsageData = {
    lastUpdated: new Date().toISOString(),
    models: {},
    daily: [],
}

let isDirty = false
let saveTimer: Timer | null = null

// Load usage from file
export function loadUsage(): void {
    try {
        if (existsSync(USAGE_FILE)) {
            const data = JSON.parse(readFileSync(USAGE_FILE, "utf-8"))
            usageCache = {
                lastUpdated: data.lastUpdated || new Date().toISOString(),
                models: data.models || {},
                daily: Array.isArray(data.daily) ? data.daily.map((entry: any) => ({
                    date: entry?.date || getTodayString(),
                    cost: typeof entry?.cost === "number" ? entry.cost : 0,
                    input: typeof entry?.input === "number" ? entry.input : 0,
                    output: typeof entry?.output === "number" ? entry.output : 0,
                })) : [],
            }
        }
    } catch (e) {
        consola.warn("Failed to load usage data:", e)
    }
}

// Save usage to file (debounced)
function saveUsage(): void {
    if (!isDirty) return
    try {
        usageCache.lastUpdated = new Date().toISOString()
        if (!existsSync(USAGE_DIR)) {
            mkdirSync(USAGE_DIR, { recursive: true })
        }
        writeFileSync(USAGE_FILE, JSON.stringify(usageCache, null, 2))
        isDirty = false
    } catch (e) {
        consola.warn("Failed to save usage data:", e)
    }
}

// Schedule save (debounce 5 seconds)
function scheduleSave(): void {
    isDirty = true
    if (saveTimer) return
    saveTimer = setTimeout(() => {
        saveUsage()
        saveTimer = null
    }, 5000)
}

// Detect provider from model name
function detectProvider(model: string): "gpt" | "claude" | "gemini" {
    const m = model.toLowerCase()
    if (m.includes("gpt") || m.includes("o1") || m.includes("o3") || m.includes("o4")) return "gpt"
    if (m.includes("claude") || m.includes("opus") || m.includes("sonnet")) return "claude"
    if (m.includes("gemini") || m.includes("flash") || m.includes("pro")) return "gemini"
    // Default to claude for antigravity models
    return "claude"
}

// Get today's date string (local timezone)
function getTodayString(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

// Helper: update a models+daily pair with usage
function addUsageToStore(
    models: Record<string, ModelUsage>,
    daily: DailyUsage[],
    model: string,
    inputTokens: number,
    outputTokens: number,
    requestCost: number
): void {
    const existing = models[model] || { input: 0, output: 0 }
    models[model] = {
        input: existing.input + inputTokens,
        output: existing.output + outputTokens,
    }
    const today = getTodayString()
    const idx = daily.findIndex(d => d.date === today)
    if (idx >= 0) {
        daily[idx].cost += requestCost
        daily[idx].input += inputTokens
        daily[idx].output += outputTokens
    } else {
        daily.push({ date: today, cost: requestCost, input: inputTokens, output: outputTokens })
        if (daily.length > 14) daily.splice(0, daily.length - 14)
    }
}

// Record usage (fire-and-forget, non-blocking)
export function recordUsage(model: string, inputTokens: number, outputTokens: number, apiKey?: string): void {
    if (!model || (inputTokens <= 0 && outputTokens <= 0)) return

    // Auto-read API key from middleware context if not explicitly passed
    const resolvedKey = apiKey || (globalThis as any).__currentApiKey || undefined

    const provider = detectProvider(model)
    const pricing = PRICING[provider]
    const requestCost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output

    // Update global totals
    addUsageToStore(usageCache.models, usageCache.daily, model, inputTokens, outputTokens, requestCost)

    // Update per-key totals
    if (resolvedKey) {
        if (!usageCache.byKey) usageCache.byKey = {}
        const keyLabel = resolvedKey.length > 8 ? resolvedKey.slice(0, 4) + "..." + resolvedKey.slice(-4) : resolvedKey
        if (!usageCache.byKey[keyLabel]) {
            usageCache.byKey[keyLabel] = { models: {}, daily: [] }
        }
        const keyStore = usageCache.byKey[keyLabel]
        addUsageToStore(keyStore.models, keyStore.daily, model, inputTokens, outputTokens, requestCost)
    }

    scheduleSave()
}

// Calculate cost for a model
function calculateCost(model: string, usage: ModelUsage): { inputCost: number; outputCost: number; total: number } {
    const provider = detectProvider(model)
    const pricing = PRICING[provider]
    const inputCost = (usage.input / 1_000_000) * pricing.input
    const outputCost = (usage.output / 1_000_000) * pricing.output
    return {
        inputCost: Math.round(inputCost * 100) / 100,
        outputCost: Math.round(outputCost * 100) / 100,
        total: Math.round((inputCost + outputCost) * 100) / 100,
    }
}

function buildModelStats(models: Record<string, ModelUsage>) {
    const result = Object.entries(models).map(([model, usage]) => {
        const costs = calculateCost(model, usage)
        return {
            model,
            input: usage.input,
            output: usage.output,
            inputCost: costs.inputCost,
            outputCost: costs.outputCost,
            cost: costs.total,
        }
    })
    result.sort((a, b) => b.cost - a.cost)
    return result
}

function buildDailyStats(daily: DailyUsage[]) {
    return daily.map(d => ({
        date: d.date,
        cost: Math.round(d.cost * 100) / 100,
        input: Math.round(d.input || 0),
        output: Math.round(d.output || 0),
    }))
}

// Get usage statistics
export function getUsage() {
    const models = buildModelStats(usageCache.models)
    const totalCost = models.reduce((sum, m) => sum + m.cost, 0)

    // Build per-key stats
    const byKey: Record<string, { models: typeof models; totalCost: number; daily: ReturnType<typeof buildDailyStats> }> = {}
    if (usageCache.byKey) {
        for (const [key, keyData] of Object.entries(usageCache.byKey)) {
            const keyModels = buildModelStats(keyData.models)
            byKey[key] = {
                models: keyModels,
                totalCost: Math.round(keyModels.reduce((s, m) => s + m.cost, 0) * 100) / 100,
                daily: buildDailyStats(keyData.daily),
            }
        }
    }

    return {
        lastUpdated: usageCache.lastUpdated,
        today: getTodayString(),
        models,
        totalCost: Math.round(totalCost * 100) / 100,
        daily: buildDailyStats(usageCache.daily),
        byKey,
    }
}

// Reset all usage data
export function resetUsage(): void {
    usageCache = {
        lastUpdated: new Date().toISOString(),
        models: {},
        daily: [],
    }
    isDirty = true
    saveUsage()
}

// Initialize on module load
loadUsage()
