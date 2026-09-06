export interface ExampleTestCase {
  input: string;
  expectedOutput: string;
  context?: string;
}

export const EXAMPLE_DATASET = {
  name: "Customer Support Email Triage (example)",
  description:
    "A small example dataset: classify the support email and give the intended action. Use it to try evaluation end-to-end.",
  version: "v1.0",
  cases: [
    {
      input: "How do I change my billing email address?",
      expectedOutput: "billing-relevant; action=verify-identity, update-email",
      context: "You are a support triage assistant. Every email is either billing-relevant or product-relevant.",
    },
    {
      input: "Your login page is down, I cannot access my dashboard.",
      expectedOutput: "product-relevant; action=escalate-outage",
      context: "You are a support triage assistant. Every email is either billing-relevant or product-relevant.",
    },
    {
      input: "I was charged twice for the same plan.",
      expectedOutput: "billing-relevant; action=refund-review",
      context: "You are a support triage assistant. Every email is either billing-relevant or product-relevant.",
    },
    {
      input: "Where can I find the export button in Settings?",
      expectedOutput: "product-relevant; action=guide-to-export",
      context: "You are a support triage assistant. Every email is either billing-relevant or product-relevant.",
    },
    {
      input: "Do you offer a student discount?",
      expectedOutput: "billing-relevant; action=share-pricing-page",
      context: "You are a support triage assistant. Every email is either billing-relevant or product-relevant.",
    },
    {
      input: "My evaluation run is stuck on 'queued'.",
      expectedOutput: "product-relevant; action=check-run-status",
      context: "You are a support triage assistant. Every email is either billing-relevant or product-relevant.",
    },
  ] as ExampleTestCase[],
};