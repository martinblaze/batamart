type ModerationResult = {
  allowed: boolean
  reason?: string
}

const GEMINI_MODEL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

const SYSTEM_PROMPT = `You are a moderator for a Nigerian campus student marketplace. Students sell everyday items. Flag as PROHIBITED: illegal drugs, weapons, explicit/sexual content, human trafficking, counterfeit goods, anything clearly illegal. Return ONLY valid JSON: {"allowed": true} or {"allowed": false, "reason": "brief reason"}.`

function parseGeminiJson(text: string): ModerationResult | null {
  const trimmed = text.trim()
  const jsonText = trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed
  const parsed = JSON.parse(jsonText)

  if (!parsed || typeof parsed.allowed !== 'boolean') return null
  if (parsed.allowed) return { allowed: true }

  return {
    allowed: false,
    reason:
      typeof parsed.reason === 'string' && parsed.reason.trim()
        ? parsed.reason.trim().substring(0, 200)
        : 'Your listing was rejected. It contains prohibited content.',
  }
}

export async function moderateListing(
  name: string,
  description: string
): Promise<ModerationResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { allowed: true }

  try {
    const response = await fetch(`${GEMINI_MODEL_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: JSON.stringify({
                  name: name.substring(0, 300),
                  description: description.substring(0, 5000),
                }),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 100,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) return { allowed: true }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return { allowed: true }

    return parseGeminiJson(text) || { allowed: true }
  } catch (error) {
    console.warn('Gemini listing moderation failed open:', error)
    return { allowed: true }
  }
}
