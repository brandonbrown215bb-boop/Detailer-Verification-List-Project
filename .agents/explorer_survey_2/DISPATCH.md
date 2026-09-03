## 2026-09-02T12:47:23Z
You are Explorer 2 for the survey phase of the remediation project.
Your working directory for metadata is:
c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_survey_2

Read the authoritative requirements in:
c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\ORIGINAL_REQUEST.md

Investigate the business logic and dual-engine architecture:
1. Map the C# core calculation, parsing, fact extraction, AST evaluation, and Excel export engine (`AHUVerification` / `src/` / `tests/AHUVerification.Tests`).
2. Map TypeScript business logic, AST converters, calculators, and browser preview mode implementations.
3. Identify all points of dual-engine divergence where TypeScript and C# duplicate or compete in calculation/parsing/AST evaluation.
4. Detail the exact decoupling required for browser preview mode vs production native host execution.

Write your detailed findings to:
c:\Users\jbrow263\OneDrive - Johnson Controls\Documents\Detailer-Verification-List-Project\.agents\explorer_survey_2\handoff.md
Send a completion message when done.
