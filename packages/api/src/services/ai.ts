import Anthropic from "@anthropic-ai/sdk";

export interface EmailClassificationResult {
  matched: boolean;
  confidence: number; // 0-100
  reasoning?: string;
}

export interface RuleDefinition {
  id: string;
  name: string;
  systemPrompt: string;
  actionType: string;
  actionValue?: string | null;
}

export class AIService {
  private anthropic: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Classify an email against a single rule
   */
  async classifyEmail(
    emailBody: string,
    rule: RuleDefinition
  ): Promise<EmailClassificationResult> {
    const response = await this.anthropic.messages.create({
      model: "claude-3-5-haiku-20241022", // Fast and cheap for classification
      max_tokens: 500,
      temperature: 0, // Deterministic for classification
      system: `You are an email classifier. Analyze emails and determine if they match specific criteria.

You must respond with ONLY valid JSON in this exact format:
{
  "matched": true or false,
  "confidence": number between 0-100,
  "reasoning": "brief explanation of why this matched or didn't match"
}

Do not include any text before or after the JSON.`,
      messages: [
        {
          role: "user",
          content: `Email Body:
---
${emailBody}
---

Rule to evaluate:
${rule.systemPrompt}

Does this email match the rule? Respond with JSON only.`,
        },
      ],
    });

    // Parse Claude's response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    try {
      const result = JSON.parse(content.text);
      return {
        matched: result.matched === true,
        confidence: Math.max(0, Math.min(100, result.confidence || 0)),
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error("Failed to parse Claude response:", content.text);
      throw new Error("Failed to parse AI classification response");
    }
  }

  /**
   * Classify an email against multiple rules in parallel
   * Returns all matching rules sorted by confidence
   */
  async classifyAgainstRules(
    emailBody: string,
    rules: RuleDefinition[]
  ): Promise<
    Array<{
      rule: RuleDefinition;
      result: EmailClassificationResult;
    }>
  > {
    // Run all classifications in parallel for speed
    const classifications = await Promise.all(
      rules.map(async (rule) => ({
        rule,
        result: await this.classifyEmail(emailBody, rule),
      }))
    );

    console.log("Classification results:", classifications, emailBody);

    // Filter to only matched rules and sort by confidence
    return classifications
      .filter((c) => c.result.matched)
      .sort((a, b) => b.result.confidence - a.result.confidence);
  }

  /**
   * Generate a system prompt from a user's natural language rule description
   * This helps users create rules in plain English
   */
  async generateSystemPrompt(userDescription: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929", // Use Sonnet for better instruction following
      max_tokens: 500,
      temperature: 0.3,
      system: `You are a prompt engineer. Convert user's natural language email filtering rules into precise system prompts for an AI email classifier.

The system prompt should be:
- Clear and unambiguous
- Focused on identifying specific email characteristics
- Written in a way that can return a boolean match decision

Examples:
User: "Cold sales emails"
Output: "Is this email an unsolicited sales outreach (cold email) trying to sell a product or service? Consider indicators like: mentions of products/services, asks for meetings, sender from sales role, marketing language."

User: "Newsletters I don't read"
Output: "Is this email a newsletter or promotional content? Look for: bulk email indicators, unsubscribe links, marketing language, promotional offers, not personally addressed."`,
      messages: [
        {
          role: "user",
          content: `Convert this user rule into a system prompt:\n\n${userDescription}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return content.text.trim();
  }
}
