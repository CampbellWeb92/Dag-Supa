DAG DOG MARKETPLACE
===================

Start with:
  1. SETUP-GUIDE.txt
  2. EDITING-GUIDE.txt
  3. assets/supabase-config.js
  4. supabase/schema.sql

The project is organised so every dynamic page has its own JavaScript file inside
assets/pages. This keeps the HTML readable and makes future editing safer.

Main public pages:
  index.html
  breeders.html
  breeder-profile.html
  dog.html
  how-it-works.html
  contact.html

Breeder account pages:
  register.html
  login.html
  forgot-password.html
  update-password.html
  dashboard.html
  edit-profile.html
  add-dog.html
  edit-dog.html

PAYPAL PAYMENT FLOW UPDATE
--------------------------
The public demo confirmation/localStorage sold system has been removed.
Live dog pages now use PayPal Checkout through Supabase Edge Functions.
Run supabase/payment-flow-migration.sql and follow PAYPAL-SETUP.txt before enabling payments.
A completed PayPal capture marks the dog Temporarily unavailable.
Only the owning logged-in breeder can select Confirm Sold in the dashboard.
