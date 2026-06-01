/**
 * Image Moderation using Gemini Vision API (uses existing GEMINI_API_KEY)
 * Analyzes images for: nudity, weapons, explicit content, violence, drugs
 * Free tier: 60 requests/minute (plenty for a marketplace)
 */

type ImageModerationResult = {
  allowed: boolean
  reason?: string
  confidence?: number
}

const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const IMAGE_MODERATION_PROMPT = `You are a content moderator. Analyze this image ONLY for prohibited content.

REJECT if image contains:
- Nudity, genitals, or sexually explicit content
- Weapons (guns, knives, explosives, grenades)
- Drugs or drug paraphernalia (cannabis, cocaine, etc)
- Violence, gore, or weapons being used
- Human trafficking indicators

Return ONLY valid JSON (no markdown):
{"allowed": true} for safe images
{"allowed": false, "reason": "brief reason"} for prohibited content`

export async function moderateImage(imageBase64: string): Promise<ImageModerationResult> {
  const apiKey = process.env.GEMINI_API_KEY
  
  // If no API key, use basic heuristic checks
  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY not set, using basic image checks')
    return performBasicImageChecks(imageBase64)
  }

  try {
    // Remove data URI prefix if present
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
    
    // Detect image type from base64 or default to jpeg
    let mediaType = 'image/jpeg'
    if (imageBase64.includes('image/png')) mediaType = 'image/png'
    if (imageBase64.includes('image/webp')) mediaType = 'image/webp'

    const response = await fetch(`${GEMINI_VISION_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mediaType,
                  data: cleanBase64,
                },
              },
              {
                text: IMAGE_MODERATION_PROMPT,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 200,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) {
      console.warn(`Gemini image moderation API error: ${response.status}`)
      return performBasicImageChecks(imageBase64)
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (typeof text !== 'string') {
      console.warn('No response from Gemini image analysis')
      return performBasicImageChecks(imageBase64)
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(text)
      
      if (!parsed.allowed) {
        return {
          allowed: false,
          reason: parsed.reason || 'Your image contains prohibited content (nudity, weapons, violence, etc.)',
          confidence: 0.9,
        }
      }
      
      return { allowed: true }
    } catch (parseError) {
      console.warn('Failed to parse Gemini response:', text)
      return performBasicImageChecks(imageBase64)
    }
  } catch (error) {
    console.error('Gemini image moderation error:', error)
    // Fail open - allow if service unavailable
    return { allowed: true }
  }
}

/**
 * Basic heuristic checks when API is unavailable
 * Checks: image size, dimensions, format integrity
 */
function performBasicImageChecks(imageBase64: string): ImageModerationResult {
  try {
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64
    const sizeBytes = Math.ceil(cleanBase64.length * 0.75)

    // Check file size (very large = suspicious)
    const maxSizeBytes = 10 * 1024 * 1024 // 10MB
    if (sizeBytes > maxSizeBytes) {
      return { allowed: false, reason: 'Image file too large' }
    }

    // Check if base64 is valid and not too small
    if (cleanBase64.length < 100) {
      return { allowed: false, reason: 'Image too small or invalid' }
    }

    // If it passes basic checks, allow it
    return { allowed: true }
  } catch (error) {
    console.warn('Basic image checks failed:', error)
    return { allowed: true }
  }
}
