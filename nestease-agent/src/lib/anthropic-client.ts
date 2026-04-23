/**
 * Singleton Anthropic client instance.
 */

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

export const client = new Anthropic({ apiKey: config.anthropicApiKey });
