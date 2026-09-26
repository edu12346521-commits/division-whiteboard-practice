# Supabase 排行榜設定

1. 在自己的 Supabase 專案 SQL Editor 執行 `leaderboard.sql`。
2. 在網站伺服器的環境變數設定 `SUPABASE_URL`（Project URL）和 `SUPABASE_PUBLISHABLE_KEY`（publishable key）。不要把密鑰寫入 GitHub。
3. 重新部署網站。網站仍透過 `/api/leaderboard` 驗算和儲存，畫面不需要改動。

這個網站不要求學生登入。排行榜以班別與學號合併分數，資料庫只允許有效數學答案進入，並禁止公開修改或刪除成績。由於學生可以自行選班別與學號，這不是防冒認的正式成績系統。

原有 D1 成績不會自動搬到 Supabase；切換前須另外匯入既有紀錄，否則排行榜會從零開始。
