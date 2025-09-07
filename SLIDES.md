Majin Marp → Googleスライド 自動化一式
=====================================

概要
----
- `slides/index.html`: 左エディタ / 右プレビューの軽量Marpエディタ（ブラウザで開くだけ）。
- `.github/workflows/slides.yml`: GitHub ActionsでMarkdown→PDF/PPTX/HTMLを生成し、PPTXをGoogleスライドに自動変換。
- `scripts/upload-to-gslides.mjs`: Google Drive APIでPPTXをアップロード→Googleスライドに変換するNodeスクリプト。
- `slides/themes/majin.css`: まじん式の雰囲気に寄せたMarpテーマ。front‑matterで `theme: majin` を指定。

使い方（ローカルのエディタ）
------------------------------
1. VS Codeなどで `slides/index.html` をブラウザで開く（Live ServerでもOK）。
2. 左でMarkdownを編集（初期値はMarp front‑matter付きのテンプレ）。
3. 右に即時プレビュー。`ダウンロード(.html)` で単一HTMLを保存可能。
4. `設定` ボタンからGitHub連携情報を入力すると、`Googleスライド化` ボタンでワンクリック実行（後述）。

GitHub Actions 経由でGoogleスライド化
------------------------------------
1. リポジトリのSecretsに以下を追加:
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: サービスアカウントJSONの中身（文字列）。
     - 付与権限: Drive/Slides（scopes: drive, drive.file, presentations）。
     - 変換先のGoogle Driveフォルダをサービスアカウントに共有しておくと便利。
2. ワークフロー: `.github/workflows/slides.yml` は `workflow_dispatch` 入力に対応:
   - `md_path` (必須): 変換対象のMarkdownパス（例: `改良版 まじん式プロンプト.md`）。
   - `title` (任意): スライドタイトル。
   - `folder_id` (任意): Google DriveのフォルダID。
   - `share_email` (任意): 変換後のスライドに編集権限を付与するメールアドレス。
3. 実行結果:
   - `dist/` に `slides.pdf` / `slides.pptx` / `slides.html` を生成（アーティファクトに保存）。
   - `scripts/upload-to-gslides.mjs` がPPTXをDriveへアップロードし、Googleスライドに変換。実URLはActionsのサマリに表示。

エディタから「ワンクリック」実行（任意設定）
--------------------------------------------
`slides/index.html` の設定ダイアログで以下を入力:
- GitHub: Owner / Repo / Branch(例: `main`) / Workflowファイル名（既定: `slides.yml`） / GitHub PAT(Token: `repo`権限)
- 保存パス: `slides/majin-${timestamp}.md` など（自動で新規ファイルを作成）
- Google: DriveフォルダID / 共有メール（任意）

ボタンを押すと：
1) GitHub Contents APIでMarkdownを指定ブランチにコミット → 2) ActionsのWorkflow Dispatch APIを叩いて変換を起動。

Marpフロントマター例
----------------------
```yaml
---
marp: true
theme: majin
paginate: true
size: 16:9
---

# タイトル

- 箇条書き
- 画像やコードもOK
```

備考
----
- サービスアカウントで個人のマイドライブに書き込む場合、対象フォルダをサービスアカウントのメールアドレスに共有してください。
- 企業ドメインでドメイン横断の権限を使う場合は、ドメインワイドデリゲーション＋`subject`の設定が必要です（スクリプト中にコメントあり）。
- マシンによっては、MarpのPDF/PPTX出力に必要なフォント追加があるため、ワークフローでNotoフォントを導入しています。

トラブルシュート
----------------
- Actionsで`puppeteer`系の依存で失敗: ランナーの一時的障害かネットワーク要因。Retryまたはキャッシュ無効化を検討。
- GoogleスライドURLが生成されない: `GOOGLE_SERVICE_ACCOUNT_JSON`のキー漏れ、Driveの共有設定、`folder_id`の妥当性を確認。
- 文字化け: 日本語フォント（Noto）導入済みか、テーマCSS側でフォント指定が効いているかを確認。

