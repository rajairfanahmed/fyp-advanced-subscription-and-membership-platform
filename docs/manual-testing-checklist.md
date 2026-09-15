# Manual testing checklist

Test this yourself on the running app. Tick each bullet. If something fails, note the URL, account, and the exact message — then tell me later.

Do **not** start a second Next server. Use the one already on port 3000.

Stripe: keep `stripe listen --forward-to localhost:3000/api/webhooks/stripe` running, with `STRIPE_WEBHOOK_SECRET` matching the CLI.

Test card: `4242 4242 4242 4242` · any future expiry · any CVC · any ZIP.

---

## 0. Pre-flight (before clicking around)

- [ ] `.env.local` has `DATABASE_URL`, Clerk keys, `ADMIN_EMAILS`, Stripe keys, `STRIPE_WEBHOOK_SECRET`, R2 keys, `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- [ ] Postgres database `AdvancedSubscription_MembershipPlatform` is up
- [ ] `npm run dev` is already running (do not start another)
- [ ] Home loads at http://localhost:3000 without a red error overlay
- [ ] You have **three accounts** ready: subscriber email, creator email, admin email that is listed in `ADMIN_EMAILS`
- [ ] Admin email is **not** a `NEXT_PUBLIC_` variable

---

## 1. Guest (signed out)

- [ ] Open `/` — public home, no login wall
- [ ] Open `/pricing`, `/about`, `/support`, `/contact`, `/terms`, `/privacy` — all load
- [ ] Open `/creators` — only **real published** creators (no fake demo catalog)
- [ ] Open a creator page `/creators/{slug}` while signed out — profile and previews visible
- [ ] Click a **paid** video/title — sent to `/login?redirect_url=…` (not a blank page)
- [ ] Open `/library` signed out — redirect to login with `redirect_url`
- [ ] Open `/subscription`, `/billing`, `/account`, `/creator`, `/admin` signed out — login redirect
- [ ] Open `/this-page-does-not-exist` — **404**, not login
- [ ] In the browser address bar open `/api/checkout` — **401 JSON**, not an HTML login page
- [ ] Contact form: submit a valid message — success
- [ ] Contact form: submit **6 times quickly** — 429 / “Too many messages”

---

## 2. Sign up / login / roles

- [ ] Sign up as **subscriber** (email/password) — lands on `/library` after role is set
- [ ] Sign up as **creator** — lands on `/creator`
- [ ] Google sign-up still only offers subscriber or creator — **no admin option**
- [ ] Password rules on sign-up: 8+ chars, a number, an uppercase letter
- [ ] Forgot-password form works (or Clerk screen appears)
- [ ] Login with wrong password several times — throttle message after repeated tries (login 8 / 15 min)
- [ ] Already logged in, visit `/login` — subscriber → `/library`, creator → `/creator`, admin → `/admin`
- [ ] Sign out works from the nav

---

## 3. Subscriber — follow (free)

- [ ] Sign in as subscriber
- [ ] Open a published creator
- [ ] Click **Follow** / free — no Stripe, membership shows **Free**
- [ ] Free videos/articles for that creator open
- [ ] Basic/Premium items stay locked
- [ ] `/subscription` lists this creator as Free
- [ ] Follow the same creator again — no duplicate membership row / sensible “already following” behaviour
- [ ] As a **creator account**, Follow / Subscribe on another creator is blocked (creators cannot checkout)

---

## 4. Subscriber — paid Checkout (Basic)

- [ ] On the same creator, click **Subscribe · Basic**
- [ ] Button shows a pending state (not both cards stuck on Redirecting)
- [ ] Browser goes to **checkout.stripe.com** (not an instant “You're now on Basic” toast)
- [ ] Pay with `4242…`
- [ ] After success, `/subscription` shows **Basic** for that creator
- [ ] Basic content now plays
- [ ] Premium content still locked
- [ ] Cancel from Stripe Checkout — return URL works, still Free
- [ ] Click Basic again after already Basic — “already have” / no second Checkout

---

## 5. Subscriber — upgrade to Premium

- [ ] From Basic, click **Premium Subscribe**
- [ ] Either hosted Checkout **or** in-place upgrade only if you were already paid Basic with a live Stripe sub
- [ ] After success, Premium items unlock
- [ ] `/billing` opens Stripe Customer Portal (if a Stripe customer exists)
- [ ] Cancel at period end from Subscription — access stays until period end copy is shown

---

## 6. Library, playback, download

- [ ] `/library` shows content you can access
- [ ] Click **play overlay** on a video thumbnail — playback page opens (not just the creator profile)
- [ ] Click the **title** of a video — same playback page
- [ ] Signed-in video plays (R2 or YouTube/Vimeo)
- [ ] Pause / seek still works (Range requests)
- [ ] Article body visible only when access granted; locked article does not dump full body
- [ ] File download saves as a **file** (PDF does not open as a tab)
- [ ] Download response is not a public R2 URL in the page HTML for locked media
- [ ] Guest cannot hit playback URL and get video bytes (401)
- [ ] Wrong content id — 404, not a crash

---

## 7. Download quotas (per creator, 30-day window)

- [ ] Free membership: after **5** successful downloads from that creator, the next one is blocked with quota copy
- [ ] Basic: cap is **30** (spot-check a few; no need to hit 30 unless you want)
- [ ] Premium: download is not capped
- [ ] Quota meter on `/subscription` and/or library matches remaining
- [ ] Owner (the creator) can download their own file without using subscriber quota
- [ ] Failed/broken download does not permanently eat a quota slot (retry works)
- [ ] Downloads from **creator A** do not reduce quota on **creator B**

---

## 8. Creator workspace

- [ ] Sign in as creator — `/creator` dashboard loads
- [ ] `/library` as creator redirects to `/creator` (not the subscriber library)
- [ ] Plans page shows Free / Basic / Premium (defaults $0 / $19 / $49 if first visit)
- [ ] Change Basic price below $1 — validation error
- [ ] Change Basic price to a valid amount — saves; Stripe price id present (or “Checkout not ready” until sync)
- [ ] Create **video** (upload mp4/webm/mov or YouTube/Vimeo HTTPS URL), set required plan, publish
- [ ] Create **article** with body, publish
- [ ] Create **file** PDF/ZIP/RAR, publish
- [ ] Draft does **not** appear on the public creator page
- [ ] Archive hides from public catalog
- [ ] Edit only **your** content (guessing another id should fail / not found)
- [ ] Upload oversize video (>500 MB) rejected (or skip if you have no huge file)
- [ ] Upload wrong type (e.g. `.exe`) rejected
- [ ] Subscribers page lists members + plan + quota label
- [ ] Revenue page lists payments after a test Checkout
- [ ] Analytics page loads (empty state is OK if new)
- [ ] Creator settings / profile publish: unpublished creator does not show on `/creators`

---

## 9. Admin (`ADMIN_EMAILS`)

- [ ] Sign in with the allowlisted email — after login goes to `/admin`
- [ ] Nav shows Admin, not Member
- [ ] `/admin` overview loads
- [ ] Users list + user detail
- [ ] Creators / subscribers / content / plans / payments / subscriptions / analytics / notifications / settings all open
- [ ] Sign in as a **non-admin** and open `/admin` — redirected away (library or creator)
- [ ] Open `/api/auth/check-admin?email=someoneelse@x.com` while logged in — result is about **you**, not that email
- [ ] Open `/api/auth/check-admin` signed out — 401

### Admin actions

- [ ] Suspend a subscriber — they cannot checkout / download / playback (403)
- [ ] Restore the same user — access works again
- [ ] Cannot suspend **another admin** from this screen
- [ ] Cannot use the user screen to change **your own** admin account that way
- [ ] Payments: refund / retry buttons visible (only click refund if you accept a real Stripe test refund)
- [ ] Subscriptions **+7d** — period end moves forward ~7 days
- [ ] **+30d** — period end moves forward ~30 days
- [ ] **Period end** — requires typing `PERIOD END`; Stripe cancel_at_period_end; local access remains until end
- [ ] **Cancel now** — requires typing `CANCEL NOW`; access ends; if Stripe fails, local row must **not** change
- [ ] Settings: toggle **maintenance** — signed-out public site → `/maintenance`; admin can still open `/admin`
- [ ] Turn maintenance **off** — public site back
- [ ] Broadcast / notifications admin page sends without crashing

---

## 10. Stripe webhook & billing honesty

- [ ] With `stripe listen` **stopped**, complete a Checkout — membership may lag until webhook or success-page confirm
- [ ] With listen **running**, Checkout success updates membership without a long wait
- [ ] Stripe Dashboard (test) shows the Checkout session and subscription
- [ ] Duplicate webhook delivery does not create two memberships for the same (subscriber, creator)
- [ ] `/billing` invoices list succeeded test payments
- [ ] Failed-card test (`4000 0000 0000 0341`) → payment failed copy / past_due behaviour (optional)

---

## 11. Notifications

- [ ] After paid Checkout, subscriber gets an in-app payment/membership notification
- [ ] Creator gets a new-subscriber / payment notification (if prefs allow)
- [ ] `/notifications` lists them; mark read works
- [ ] Optional: hit cron `GET /api/cron/renewal-reminders` **without** secret — 401
- [ ] Optional: with `Authorization: Bearer $CRON_SECRET` — 200 JSON `{ ok: true, … }`

---

## 12. Security / ownership extras

- [ ] Subscriber cannot `POST /api/storage/upload` — 403
- [ ] Subscriber cannot open `/api/creator/overview` — 403
- [ ] Creator cannot save content against another creator’s id
- [ ] Suspended creator: public page / subscribe shows “not accepting members”
- [ ] HTML of a locked item does **not** contain the R2 object URL for the video/file
- [ ] Rate-limit headers appear on a 429 (`Retry-After` / `X-RateLimit-Limit`)

---

## 13. Cross-page consistency (after any write)

- [ ] After Follow, creator public page, `/subscription`, and `/library` all agree on Free
- [ ] After Basic pay, those three plus `/billing` agree on Basic
- [ ] After admin suspend, checkout and download fail immediately (no stale “Subscribe” success)
- [ ] After publishing content, `/creators/{slug}` and library both show it; draft does not
- [ ] Mobile width (~375px): nav, plan cards, admin tables still usable (spot-check)

---

## 14. Things that should stay broken / forbidden (pass if they fail)

- [ ] Nobody can sign up as admin
- [ ] Guest cannot download paid files
- [ ] Free user cannot play Basic video
- [ ] Creator cannot subscribe to other creators
- [ ] `/api/auth/check-admin?email=` cannot reveal whether a stranger is admin
- [ ] There is no “Skip payment / applied immediately” on **Free → Basic**

---

## How to report a bug to me later

Send:

- Which bullet failed
- Which role / email (not passwords)
- URL
- What you clicked
- What you expected
- What happened (screenshot or exact toast/error text)
