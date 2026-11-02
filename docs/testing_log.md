# EcoBuild Exchange – Testing Log

This document records tests performed during development. Tests marked "Not Run" have not been verified and should not be treated as passed.

| Test | Steps | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Admin overview authentication | Send GET request to `/api/admin/overview` without a logged-in session. | Request is rejected with HTTP 401. | HTTP 401 returned. | Pass |
| Admin sweep authentication | Send POST request to `/api/admin/sweep` without a logged-in session. | Request is rejected with HTTP 401. | HTTP 401 returned. | Pass |
| Duplicate-email registration | Register two accounts using the same email address. | Second registration is rejected with HTTP 409. | Not run. | Not Run |
| Wrong-password login | Attempt login with an existing email and an incorrect password. | Login is rejected with HTTP 401. | Not run. | Not Run |
| Admin route with BuyerSeller role | Access an Admin-only API using a BuyerSeller account. | Request is rejected with HTTP 403. | Not run. | Not Run |
| Double furniture purchase | Purchase a furniture listing, then attempt to purchase the same listing again. | Second purchase is rejected. | Not run. | Not Run |
| Project carbon recalculation | Add a material to a project and inspect its carbon report. | Database trigger recalculates the project's carbon values. | Not run. | Not Run |
| 90-day listing sweep | Run the Admin sweep with an eligible Active listing older than 90 days. | Eligible listing is moved to Referred. | Not run. | Not Run |
| Earth-block machine filtering | Run the vendor data sync with an earth-block machine listing in the source data. | Machine listing is excluded from canonical material matching. | Not run. | Not Run |
| Plain TMT rebar filtering | Run the vendor data sync with a plain TMT rebar listing in the source data. | Listing is excluded unless it meets the project's accepted recycled-steel matching rules. | Not run. | Not Run |
| T5 production build | Run `npm run build` with the project materials implementation. | Build completes successfully. | Build completed successfully. | Pass |
| T8 production build | Run `npm run build` with the furniture search implementation. | Build completes successfully. | Build completed successfully. | Pass |

## Notes

- HTTP 401 checks were performed without an authenticated session.
- Build success confirms compilation; it does not prove that every feature works at runtime.
- Tests marked Not Run must be executed before reporting them as passed.
