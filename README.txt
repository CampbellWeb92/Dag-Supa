DAG DOG MARKETPLACE — CORRECTED BUILD

Use START-HERE.txt first.

DEPLOYMENT FOLDER
Upload the contents of:
  public/

DATABASE FILE
Run this one complete file in Supabase SQL Editor:
  supabase/DATABASE-REPAIR.sql

The repaired build uses:
- a locally bundled Supabase browser library;
- one consistent login/session system;
- owner-only dashboard and listing controls;
- historical listing visibility for the logged-in breeder;
- Add Dog, Edit Dog and Delete Dog actions;
- public approved breeder and dog pages;
- breeder-only Confirm Sold after a verified payment;
- PayPal.Me fallback links and optional secure PayPal Edge Functions.

The old duplicate "public - Copy" folder and conflicting direct-login code were removed.
See FUNCTION-TEST-REPORT.txt for the completed checks.
