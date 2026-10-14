import { handleFeedback } from "../lib/feedback.js";

export function onRequest(context) {
  return handleFeedback(context.request, context.env);
}
