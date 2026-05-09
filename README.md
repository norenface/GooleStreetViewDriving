# Street View Hyperlapse

Google Street View 上で始点と終点を指定し、その区間を自動再生して散歩・ドライブ体験を楽しめるアプリです。  
[Hyperlapse.js](https://github.com/TeehanLax/Hyperlapse.js) を使用しています。

## 機能

- 地図上でクリックして始点・終点を選択
- Street View パノラマ画像を自動再生
- **散歩モード** (~5 km/h) と **ドライブモード** (~40 km/h) の切り替え
- 再生/一時停止・コマ送り
- ダークテーマ UI

## 必要な API キー

[Google Cloud Console](https://console.cloud.google.com/) で以下の API を有効化し、キーを取得してください。

| API | 用途 |
|-----|------|
| Maps JavaScript API | 地図表示・クリック選択 |
| Directions API | ルート計算 |
| Street View Static API | パノラマ画像取得 |
| Elevation API | 地形に合わせたカメラ角度 |

---

## PC 版 (Web アプリ)

### セットアップ

1. `web/js/config.js` を編集して API キーを設定:
   ```js
   var GOOGLE_MAPS_API_KEY = 'YOUR_API_KEY_HERE';
   ```

2. ローカルサーバーで開く (file:// では Google Maps API が動作しません):
   ```bash
   cd web
   python3 -m http.server 8080
   # → http://localhost:8080 をブラウザで開く
   ```

### 使い方

1. 地図上で始点をクリック (青マーカー A)
2. 終点をクリック (緑マーカー B)
3. 速度を選択 (散歩 / ドライブ)
4. **Hyperlapse を開始** ボタンを押す
5. 読み込み完了後、自動再生が始まります

---

## Android アプリ

### ディレクトリ構成

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/streetviewhyperlapse/
│   │   │   └── MainActivity.java   ← WebView + Android ブリッジ
│   │   ├── res/                    ← リソース (アイコン・スタイル)
│   │   └── AndroidManifest.xml
│   └── build.gradle                ← web/ を assets/ に自動コピー
└── settings.gradle
```

### ビルド手順

1. `web/js/config.js` に API キーを設定 (PC 版と共通)

2. Android Studio で `android/` ディレクトリを開く

3. ビルド時に Gradle タスク `syncWebAssets` が自動的に  
   `web/` → `app/src/main/assets/` へファイルをコピーします

4. Run (▶) またはビルドして APK を生成

### 動作環境

- Android 7.0 (API 24) 以上
- WebGL 対応端末 (ほぼすべての現行 Android 端末で対応)
- インターネット接続必須

---

## ファイル構成

```
GooleStreetViewDriving/
├── web/                    # PC / ブラウザ版
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── config.js       ← ★ API キーをここに設定
│       ├── app.js
│       ├── hyperlapse.js   (TeehanLax/Hyperlapse.js より)
│       ├── GSVPano.js      (TeehanLax/Hyperlapse.js より)
│       └── three.min.js    (Three.js r57)
└── android/                # Android アプリ
    ├── app/
    └── settings.gradle
```

## ライセンス

- Hyperlapse.js: MIT License © Teehan+Lax
- Three.js: MIT License
- アプリコード: MIT License
