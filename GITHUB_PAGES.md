# GitHub Pages 發布

網站網址：https://edu12346521-commits.github.io/division-whiteboard-practice/

本倉庫的 `docs/` 是可直接部署到 GitHub Pages 的靜態網站。GitHub → Settings → Pages → Build and deployment → Deploy from a branch → `main`、`/docs` → Save。GitHub Pages 使用 `pages/supabase-config.ts` 的公開 Supabase publishable key，資料庫寫入由 RLS 和數學答案約束限制。

修改介面程式後，在專案根目錄執行 `npm run build:pages`，再把新的 `docs/` 一起提交。`docs/.nojekyll` 可以防止 GitHub Pages 用 Jekyll 處理產物。

Sites 版本繼續使用後端 API；兩個網站使用同一個 Supabase 專案，因此排行榜同步。請勿把 Supabase secret/service_role key 放到網頁或 GitHub。
