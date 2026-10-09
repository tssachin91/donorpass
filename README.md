# Donor Pass

A clickable prototype of **Donor Pass**, a blood-health app for donors in India, built on top of e-RaktKosh and ABDM rather than beside them.

> **Demo only.** All people and organisations are fictional, all data stays in the browser, and the e-RaktKosh and ABDM connections are simulated. Do not enter real health data.

## What you can try

| Part | Try this |
| --- | --- |
| **Donor app** | See when you can donate next, a timeline of donations and blood tests, the haemoglobin trend, the Donor Pass, verified requests, consents and a FHIR export. Switch between sample donors on the right. |
| **Front-door form** | From the donor app, tap "Fill your form first", answer the screening questions and get a QR code. |
| **Blood centre desk** | Open that form, record vitals, then approve (the donation is recorded and counts towards the Donor Pass) or defer. Redeem a Donor Pass fee waiver. |
| **Hospital console** | Raise a request, alert matched donors (eligible today, compatible, opted in, nearest first, names masked), simulate replies and mark arrivals. Family requests wait for slip verification. |
| **Lab portal** | Paste a lab export, see it mapped to standard codes with infection-screening rows blocked, and deliver results to consenting donors. |
| **Data model** | View any donor's records as a FHIR R4 bundle and the integration activity log. |

Use **Reset demo** in the top bar to start over. Sample data refreshes daily so dates stay current.

## Rules built in

- **Eligibility (NBTC):** whole blood every 90 days for men and 120 days for women; 28 days between whole blood and apheresis either way; 48 hours between apheresis donations, at most 24 a year; age 18 to 65; weight at least 45 kg. Low recent haemoglobin (below 12.5 g/dL) or ferritin adds an advisory but never blocks: the centre's medical officer decides.
- **Donor Pass:** 3 verified donations within 24 months unlock it; active for 12 months after the latest; one processing-fee waiver a year for the donor or immediate family. It never reserves a unit and never pays anyone.
- **Requests:** only verified requests go out; donors must have opted in, have a centre-verified group, be eligible today and be compatible (red cells, plasma and platelet rules differ); search starts at 5 km and widens to 25 km; at most 10 donors per unit; donors go to the licensed blood centre; numbers stay masked.
- **Safety:** infection-screening results (HIV, hepatitis B and C, syphilis, malaria) are never stored for display; the app shows values and reference ranges, not diagnoses.

## Run it locally

Requires Node 20 or later.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # rule tests (eligibility, compatibility, Donor Pass, matching, lab mapping, FHIR)
npm run build    # production build in dist/
```

## Project layout

```
src/
  core/          Pure domain logic, no UI. Tested in core.test.ts.
    eligibility.ts   NBTC intervals, deferrals, advisories
    compatibility.ts ABO/Rh rules per component
    donorPass.ts     Donor Pass state
    matching.ts      Verified request matching, masking, distance
    screening.ts     Front-door questions and vitals checks
    labMapping.ts    Lab export (CSV) to standard observations
    fhir.ts          FHIR R4 export (the open data model)
    codes.ts         Test catalogue (LOINC and blocked local codes)
  data/seed.ts   Fictional Mumbai sample data
  state/         Browser store and derived selectors
  pages/         Donor app, hospital console, centre desk, lab portal, data model
docs/data-model.md  The open data model in detail
```

## Deploying the demo

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. On a free GitHub plan, Pages needs a public repository.

## From prototype to production

1. Replace the browser store with a backend (API, database, audit log) hosted in India.
2. Add sign-in for donors (phone OTP and ABHA) and for staff at partner facilities.
3. Certify on the ABDM sandbox as an app that receives records, and as a software partner for labs.
4. Agree read and write access to e-RaktKosh with NBTC and C-DAC.
5. Implement DPDP Act consent, deletion and breach processes before the May 2027 obligations.
6. Have a transfusion medicine specialist review every rule in `src/core`.

## Status and licence

Prototype for pitching and testing. No licence has been chosen yet, so all rights are reserved by the owner. The data model in `docs/` is intended to be published openly; choose a licence before doing so.
