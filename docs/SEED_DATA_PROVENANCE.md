# KASA — Provenance of seed data
No public course content should be treated as live database-seeded until the Firestore initializer is run and verified.

## Sources (user-provided)
1. `Curriculum on Headed Paper_merged.pdf` (21 pages), KASA AGRI SPORT Curriculum Framework, issue date 13 October 2026. Programme profile p.1 lists foundation 3 months / 360 contact hours and applied 6 months / 720 contact hours. p.4 outlines 13 modules AS01–AS13. pp.1,6 explicitly say proposed KASA completion certificates are not automatically TEVETA, FAZ or athletics federation equivalence. Public contact p.1: `kasa@zamfirm.com`, `+260 574 203 660`.
2. `Fee Structure 2 -4.pdf` (3 pages), 2027 **proposed** KASA fees. p.1 total tuition 3-month K4,800; 6-month K8,200. Optional accommodation K1,500/K3,000 and food K3,000/K6,000; full optional package K9,300/K17,200. p.1 independent 8-week short-course total full packages: Crop K6,350; Gardening & Irrigation K6,850; Poultry K6,450; Livestock K7,100; Fish K7,350; Pasture/Feed K6,400; Cooperative K7,100. p.2 references planned TEVETA General Agriculture Level III and Level II paths but no accreditation approval evidence is provided. p.3 states proposed Level II module time total 740 notional hours, which must not be confused with AGRI SPORT's 720 contact hours.

## Data normalization decisions
- Integrated AGRI-SPORT foundation and applied courses seeded separately, described as **KASA proposed programmes**, not TEVETA-certified.
- General Agriculture, Sports Development, and Cooperative Development main programme records are independent from short courses.
- Separate 8-week short courses are independently selectable. Football Coaching, Athletics Coaching and Sports Event Personnel have no verified fee in supplied proposed fee document; set amounts to null.
- For 8-week courses, `packageTotal` includes optional food and bed. Cost components retained separately; do not describe optional packages as mandatory.
- Three introductory announcements contain only supported proposed course information and institutional explanations; they make no claim that intake is currently open.
- Fields for course status, fees, notices and applications are administrative and Firestore-backed. The seed JSON is only an initial reference dataset, not UI hardcoding.
- Government CDF document checklist is a KASA-configurable default verification checklist and **not** an assertion that identical official requirements apply in every constituency.
