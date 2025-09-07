# MajinSlides

Marp形式のMarkdownをローカルWebエディタで編集（左エディタ/右プレビュー）→ GitHub ActionsでPDF/PPTX/HTMLを生成 → PPTXをGoogleスライドに自動変換する一式。

- エディタ: `slides/index.html`（CDN動作、ビルド不要）
- テーマ: `slides/themes/majin.css`（front‑matterで `theme: majin`）
- Google変換: `.github/workflows/slides.yml` + `scripts/upload-to-gslides.mjs`
- Pagesデプロイ: `.github/workflows/pages.yml`（`slides/` をそのまま公開）
 - オフラインPPTX出力: 画面左の「PPTX(オフライン)」でクライアントだけでPPTXを生成（要CDN: html2canvas / PptxGenJS）

## GitHub Pages
- URL: `https://shoei05.github.io/majinslides/` （デプロイ後に有効）

## 使い方（最短）
1. `slides/index.html` をブラウザで開き、左で編集すると右にMarpプレビューが出ます。
2. 登録不要で「PPTX(オフライン)」を押すと、PPTXを直接ダウンロードできます（Googleスライドの「PowerPointを開く」でそのまま取り込めます）。
3. さらに自動変換まで行いたい場合は、「設定」で GitHub Owner/Repo/Branch/Workflow（`slides.yml`）とPAT、必要に応じてGoogle設定を入力し、「Googleスライド化」を利用してください。

## Secrets（Google）
- リポジトリに `GOOGLE_SERVICE_ACCOUNT_JSON` を追加（サービスアカウントのJSON文字列）。
- フォルダに保存したい場合は Driveフォルダをサービスアカウントに共有し、Workflow入力 `folder_id` を指定。
- 変換後に権限付与したい場合は `share_email` にメールを指定。

## 手動実行（Actions）
- `Build Majin Slides` → `Run workflow` → `md_path` に `slides/sample.md` などを指定して実行。

## 注意
- リポジトリを肥大化させないため、動画/音声は `.gitignore` 済みです。
 - オフラインPPTXは各スライドを画像化して埋め込みます。外部画像のCORS制約により一部画像がレンダリングできない場合があります（その場合は画像にCORSを許可するか、ローカルに保存して参照してください）。
