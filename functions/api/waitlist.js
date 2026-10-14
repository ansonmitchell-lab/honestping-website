import { handleSubmit } from "../lib/submit.js";

export function onRequest(context) {
  return handleSubmit(context.request, context.env);
}
