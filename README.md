# Verbwerk reliability release candidate

Adds browser Back handling (`popstate`), in-app Back controls on secondary screens, a dedicated Article Training section, a five-noun daily article lesson, article revision/tests, and a practice setup to select Vocabulary or Articles and Quick or Deep. The existing `verbwerk_local_v1` storage key is preserved; new article progress is added as extra fields.

Deploy: export a progress backup first, unzip, upload every file in this folder to the root of `rangane90/verbwerk`, replace matching files, commit, and wait for GitHub Pages. If the iPhone serves an old cached copy, open the site once with `?refresh=3`.

Validation: JavaScript syntax is checked in this build. Real iOS Safari/Home Screen interaction still requires a final check on the target phone. The bundled article set is a curated starter set, not a complete A1–B1 noun database. Mixed vocabulary+article sessions, full case-declension questions, free-text sentence grading and a full adaptive scheduler are not yet complete.
