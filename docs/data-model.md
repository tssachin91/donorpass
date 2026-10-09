# Donor Pass open data model

Donor Pass stores and exchanges records in **FHIR R4**, the standard ABDM uses. Publishing this model lets any lab, hospital or software vendor connect without a custom integration. Source of truth in code: `src/core/types.ts`, `src/core/codes.ts` and `src/core/fhir.ts`.

## Resources

| Donor Pass record | FHIR resource | Key fields |
| --- | --- | --- |
| Donor | `Patient` | name, gender, birthDate, ABHA address as `identifier` (`https://healthid.abdm.gov.in`), blood group extension |
| Donation | `Procedure` | code (whole blood, plateletpheresis, plasmapheresis), `performedDateTime`, `location` = blood centre |
| Test result | `Observation` | LOINC `code`, `valueQuantity` or `valueString`, `effectiveDateTime`, `referenceRange` |
| Deferral | (planned) `Flag` or `Observation` | reason, period |
| Consent | (planned) ABDM consent artefact | purpose, period, recipient |

Every record carries where it came from in `meta.source` and a `verified` or `unverified` tag:

| Source | Meaning | Verified |
| --- | --- | --- |
| `e-raktkosh` | Read from the national blood centre system | Yes |
| `centre-desk` | Recorded at a partner centre through Donor Pass | Yes |
| `abdm` | Lab or hospital report received through ABDM with consent | Yes |
| `lab-sync` | Lab report delivered through the Donor Pass sync connector | Yes |
| `upload` | Donor uploaded a report; values extracted | No |
| `self-reported` | Donor typed it in | No |

## Test codes

| Test | Code | System | Shown to donor |
| --- | --- | --- | --- |
| Haemoglobin | 718-7 | LOINC | Yes |
| Ferritin | 2276-4 | LOINC | Yes |
| Haematocrit | 4544-3 | LOINC | Yes |
| Platelet count | 777-3 | LOINC | Yes |
| White cell count | 6690-2 | LOINC | Yes |
| Red cell count | 789-8 | LOINC | Yes |
| ABO group | 883-9 | LOINC | Yes |
| Rh type | 10331-7 | LOINC | Yes |
| Systolic / diastolic BP | 8480-6 / 8462-4 | LOINC | Yes |
| Body weight | 29463-7 | LOINC | Yes |
| HIV, hepatitis B, hepatitis C, syphilis, malaria screening | `tti-*` | local | **Never** |

Verify LOINC codes against current NRCeS guidance before certification. Infection-screening tests are blocked at import: NBTC requires the blood centre to inform the donor confidentially.

## Lab export format (sync connector)

Labs without ABDM support can send their usual export. The demo accepts CSV with a header row:

```csv
patient_ref,test_name,value,unit,ref_range,collected_on
CP-10519,Haemoglobin,12.4,g/dL,12-15.5,2026-10-08
CP-10519,Blood Group,O Positive,,,2026-10-08
```

- `patient_ref` is the lab's own reference, linked to a donor only after the donor consents (usually through their ABHA address).
- `test_name` is matched against known aliases (for example Hb, HGB, Haemoglobin). Unknown tests are held for review, never guessed.
- Blood group values such as `B Positive` or `O-` become two observations (ABO and Rh).
- Results reach a donor's app only if that donor allows lab sharing. For the lab, Donor Pass acts as a data processor under a data processing agreement.

## Not yet modelled

Consent artefacts, deferrals as FHIR resources, NRCeS profile URLs, SNOMED CT codes for donation procedures, and audit events. These are needed for ABDM certification.
