# EcoBuild Exchange – Testing Log

This document records tests performed during development. Tests marked "Not Run" have not been verified and should not be treated as passed.

| Test | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Admin overview authentication | Send GET request to `/api/admin/overview` without a logged-in session. | Request is rejected with HTTP 401. | HTTP 401 returned. | Pass |
| Admin sweep authentication | Send POST request to `/api/admin/sweep` without a logged-in session. | Request is rejected with HTTP 401. | HTTP 401 returned. | Pass |
| Duplicate-email registration | Register two accounts using the same email address. | Second registration is rejected with HTTP 409. | HTTP 409 Conflict returned by POST /api/auth/register; duplicate email message displayed. | Pass |
| Wrong-password login | Attempt login with an existing email and an incorrect password. | Login is rejected with HTTP 401. | HTTP 401 Unauthorized returned by POST /api/auth/login; Invalid credentials displayed. | Pass |
| Admin route with BuyerSeller role | Access an Admin-only API using a BuyerSeller account. | Request is rejected with HTTP 403. | HTTP 403 Forbidden returned by GET /api/admin/overview using a BuyerSeller session. | Pass |
| Double furniture purchase | Purchase listing 8, then attempt to purchase it again using the logged-in browser session. | Second purchase is rejected. | HTTP 400 returned; API responded: Listing 8 is not available (status: Sold). | Pass |
| Project carbon recalculation | Add 10 units of Compressed Stabilized Earth Block to T7 Carbon Trigger Test and inspect its carbon report. | Database trigger recalculates the project's carbon values. | Database query confirmed total_co2_saved = 2.06 and total_cost = 55.00. | Pass |
| 90-day listing sweep | Run the Admin sweep with an eligible Active listing older than 90 days. | Eligible listing is moved to Referred. | Not run. | Not Run |
| Earth-block machine filtering | Run the vendor data sync with an earth-block machine listing in the source data. | Machine listing is excluded from canonical material matching. | Not run. | Not Run |
| Plain TMT rebar filtering | Run the vendor data sync with a plain TMT rebar listing in the source data. | Listing is excluded unless it meets the project's accepted recycled-steel matching rules. | Not run. | Not Run |
| T5 production build | Run `npm run build` with the project materials implementation. | Build completes successfully. | Build completed successfully. | Pass |
| T8 production build | Run `npm run build` with the furniture search implementation. | Build completes successfully. | Build completed successfully. | Pass |

## Notes

- HTTP 401 checks were performed without an authenticated session.
- Build success confirms compilation; it does not prove that every feature works at runtime.
- Tests marked Not Run must be executed before reporting them as passed.
