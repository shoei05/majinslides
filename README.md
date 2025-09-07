# MajinSlides

Marp形式のMarkdownをローカルWebエディタで編集（左エディタ/右プレビュー）→ GitHub ActionsでPDF/PPTX/HTMLを生成 → PPTXをGoogleスライドに自動変換する一式。

- エディタ: `slides/index.html`（CDN動作、ビルド不要）
- テーマ: `slides/themes/majin.css`（front‑matterで `theme: majin`）
- Google変換: `.github/workflows/slides.yml` + `scripts/upload-to-gslides.mjs`
- Pagesデプロイ: `.github/workflows/pages.yml`（`slides/` をそのまま公開）

## GitHub Pages
- URL: `https://shoei05.github.io/majinslides/` （デプロイ後に有効）

## 使い方（最短）
1. `slides/index.html` をブラウザで開いて編集。`ダウンロード(.html)` で単一HTML保存可。
2. 「設定」から GitHub Owner/Repo/Branch/Workflow（`slides.yml`）とPATを入力。
3. 「Googleスライド化」を押すと .md をコミット → Actionsをdispatch → PDF/PPTX/HTML生成 → PPTXをGoogleスライドに変換。ActionsサマリにURLが出ます。

## Secrets（Google）
- リポジトリに `GOOGLE_SERVICE_ACCOUNT_JSON` を追加（サービスアカウントのJSON文字列）。
- フォルダに保存したい場合は Driveフォルダをサービスアカウントに共有し、Workflow入力 `folder_id` を指定。
- 変換後に権限付与したい場合は `share_email` にメールを指定。

## 手動実行（Actions）
- `Build Majin Slides` → `Run workflow` → `md_path` に `slides/sample.md` などを指定して実行。

## 注意
- リポジトリを肥大化させないため、動画/音声は `.gitignore` 済みです。

