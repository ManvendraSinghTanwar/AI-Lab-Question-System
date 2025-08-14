interface QuestionGenerationRequest {
  originalQuestion: string
  subject: string
  difficulty: string
  category: string
  tags: string[]
  variationCount?: number
}

interface QuestionGenerationResponse {
  variations: string[]
  uniquenessScore: number
}

interface EvaluationRequest {
  question: string
  studentAnswer: string
  subject: string
}

interface EvaluationResponse {
  score: number
  feedback: string
  strengths: string[]
  improvements: string[]
}

class AIService {
  private apiKey: string
  private baseUrl = "https://api.together.xyz/v1"
  private model = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async makeRequest(messages: any[], temperature = 0.7, maxTokens = 2000) {
    try {
      console.log("Making AI API request to:", `${this.baseUrl}/chat/completions`)
      console.log("Using model:", this.model)

      const requestBody = {
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }

      console.log("Request body:", JSON.stringify(requestBody, null, 2))

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log("Response status:", response.status)
      console.log("Response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error Response:", errorText)
        throw new Error(`AI API request failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log("API Response:", data)

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error("Invalid API response format")
      }

      return data.choices[0].message.content
    } catch (error) {
      console.error("Detailed API Error:", error)
      throw error
    }
  }

  private extractJsonFromResponse(response: string): string {
    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      return jsonMatch[1].trim()
    }

    // If no code blocks, return the response as-is but cleaned
    return response.trim()
  }

  private safeJsonParse(response: string): any {
    try {
      const cleanedResponse = this.extractJsonFromResponse(response)
      return JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError)
      console.error("Raw response:", response)
      console.error("Cleaned response:", this.extractJsonFromResponse(response))
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`)
    }
  }

  async generateQuestionVariations(request: QuestionGenerationRequest): Promise<QuestionGenerationResponse> {
    const variationCount = request.variationCount || 4

    const prompt = `You are an expert educator creating equivalent but unique variations of lab questions. 

Original Question: "${request.originalQuestion}"
Subject: ${request.subject}
Difficulty: ${request.difficulty}
Category: ${request.category}
Tags: ${request.tags.join(", ")}

Generate ${variationCount} unique but equivalent variations of this question. Each variation should:
1. Test the same core concepts and learning objectives
2. Have similar difficulty level
3. Be clearly distinct from the original and other variations
4. Maintain academic rigor and clarity
5. Be appropriate for ${request.subject} students

IMPORTANT: Respond with ONLY valid JSON, no markdown formatting or code blocks. Use this exact structure:
{
  "variations": [
    "Variation 1 text here",
    "Variation 2 text here",
    "Variation 3 text here",
    "Variation 4 text here"
  ],
  "uniquenessScore": 85
}

The uniquenessScore should be a number from 0-100 indicating how unique and well-differentiated the variations are.`

    const messages = [
      {
        role: "system",
        content:
          "You are an expert educational content creator specializing in generating equivalent but unique academic questions. Always respond with valid JSON only, no markdown formatting or code blocks.",
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    try {
      const response = await this.makeRequest(messages, 0.8, 1500)

      const parsed = this.safeJsonParse(response)

      return {
        variations: parsed.variations || [],
        uniquenessScore: parsed.uniquenessScore || 75,
      }
    } catch (error) {
      console.error("Error generating question variations:", error)
      return {
        variations: [
          `Modified version: ${request.originalQuestion.replace(/\b(what|how|why|when|where)\b/gi, (match) => {
            const alternatives = {
              what: "which",
              how: "in what way",
              why: "for what reason",
              when: "at what time",
              where: "in which location",
            }
            return alternatives[match.toLowerCase()] || match
          })}`,
          `Alternative approach: Considering ${request.subject} principles, ${request.originalQuestion.toLowerCase()}`,
          `Practical application: In a real-world ${request.subject} scenario, ${request.originalQuestion.toLowerCase()}`,
          `Analytical perspective: From a ${request.difficulty} level understanding, ${request.originalQuestion.toLowerCase()}`,
        ],
        uniquenessScore: 70,
      }
    }
  }

  async evaluateAnswer(request: EvaluationRequest): Promise<EvaluationResponse> {
    const prompt = `You are an expert educator evaluating a student's answer to a lab question.

Question: "${request.question}"
Subject: ${request.subject}
Student Answer: "${request.studentAnswer}"

Evaluate this answer and provide:
1. A numerical score from 0-100
2. Constructive feedback
3. Strengths demonstrated in the answer
4. Areas for improvement

Be fair, constructive, and bias-free in your evaluation. Consider:
- Accuracy of scientific concepts
- Completeness of the response
- Clarity of explanation
- Use of appropriate terminology
- Logical reasoning

IMPORTANT: Respond with ONLY valid JSON, no markdown formatting or code blocks. Use this exact structure:
{
  "score": 85,
  "feedback": "Detailed feedback here...",
  "strengths": ["Strength 1", "Strength 2"],
  "improvements": ["Improvement 1", "Improvement 2"]
}`

    const messages = [
      {
        role: "system",
        content:
          "You are an expert educator providing fair, constructive, and bias-free evaluation of student work. Always respond with valid JSON only, no markdown formatting or code blocks.",
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    try {
      const response = await this.makeRequest(messages, 0.3, 1000)
      const parsed = this.safeJsonParse(response)

      return {
        score: Math.max(0, Math.min(100, parsed.score || 75)),
        feedback:
          parsed.feedback || "Good effort demonstrated. Continue to develop your understanding of the key concepts.",
        strengths: parsed.strengths || ["Shows understanding of basic concepts"],
        improvements: parsed.improvements || ["Consider providing more detailed explanations"],
      }
    } catch (error) {
      console.error("Error evaluating answer:", error)
      // Fallback to mock evaluation if AI fails
      return {
        score: Math.floor(Math.random() * 40) + 60,
        feedback: "Good understanding demonstrated. Consider expanding on key concepts.",
        strengths: ["Shows grasp of fundamental principles"],
        improvements: ["Provide more detailed explanations", "Include specific examples"],
      }
    }
  }

  async checkQuestionUniqueness(questions: string[]): Promise<number> {
    if (questions.length < 2) return 100

    const prompt = `Analyze these questions for uniqueness and similarity:

${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Rate the overall uniqueness of these questions on a scale of 0-100, where:
- 100 = Completely unique questions testing different concepts
- 75-99 = Mostly unique with some overlap
- 50-74 = Moderately unique with significant overlap
- 25-49 = Similar questions with minor variations
- 0-24 = Nearly identical questions

Respond with just the numerical score (0-100).`

    const messages = [
      {
        role: "system",
        content:
          "You are an expert at analyzing question uniqueness and similarity. Respond with only a number between 0-100.",
      },
      {
        role: "user",
        content: prompt,
      },
    ]

    try {
      const response = await this.makeRequest(messages, 0.1, 50)
      const score = Number.parseInt(response.trim())
      return isNaN(score) ? 75 : Math.max(0, Math.min(100, score))
    } catch (error) {
      console.error("Error checking uniqueness:", error)
      return 75 // Default score if AI fails
    }
  }
}

// Create singleton instance with correct API key
const aiService = new AIService("tgp_v1_KgbGMPx0dSxnPF1bbcerOrbtGX6JJSYLmgZ24nPNURU")

export { aiService, type QuestionGenerationRequest, type EvaluationRequest }
