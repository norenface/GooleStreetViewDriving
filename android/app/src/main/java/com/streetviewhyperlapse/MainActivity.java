package com.streetviewhyperlapse;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // フルスクリーン・没入モード設定
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // WebView をメインビューとして設定
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0f1117"));
        setContentView(webView);

        configureWebView();
        setupImmersiveMode();

        // assets/index.html をロード
        webView.loadUrl("file:///android_asset/index.html");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        // JavaScript と DOM Storage を有効化
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        // ハードウェアアクセラレーション (WebGL 用)
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // キャッシュとリソース読み込み設定
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // レイアウト
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // メディア
        settings.setMediaPlaybackRequiresUserGesture(false);

        // Geolocation
        settings.setGeolocationEnabled(true);

        webView.setWebViewClient(new HyperlapseWebViewClient());
        webView.setWebChromeClient(new HyperlapseChromeClient());

        // JavaScript ブリッジ (Android ↔ WebView 通信)
        webView.addJavascriptInterface(new AndroidBridge(this), "AndroidBridge");
    }

    private void setupImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            );
        }
    }

    @Override
    public void onBackPressed() {
        // WebView 内の戻るナビゲーションを JavaScript に委譲
        webView.evaluateJavascript("typeof backToSetup === 'function' && backToSetup()", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        setupImmersiveMode();
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    // ===== WebViewClient =====
    private static class HyperlapseWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            // file:// と https:// のみ許可
            String url = request.getUrl().toString();
            if (url.startsWith("file://") || url.startsWith("https://")) {
                return false;
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            // Android 向け追加スタイルを注入
            view.evaluateJavascript(
                "(function(){"
                + "  var s = document.createElement('style');"
                + "  s.textContent = '::-webkit-scrollbar{display:none}';"
                + "  document.head.appendChild(s);"
                + "})()", null
            );
        }
    }

    // ===== ChromeClient (Geolocation + Console) =====
    private class HyperlapseChromeClient extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(
            String origin, GeolocationPermissions.Callback callback) {
            callback.invoke(origin, true, false);
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage msg) {
            android.util.Log.d("HyperlapseJS",
                "[" + msg.messageLevel() + "] " + msg.message()
                + " (" + msg.sourceId() + ":" + msg.lineNumber() + ")"
            );
            return true;
        }
    }

    // ===== JavaScript Bridge =====
    public static class AndroidBridge {
        private final Activity activity;

        AndroidBridge(Activity activity) {
            this.activity = activity;
        }

        @android.webkit.JavascriptInterface
        public void showToast(final String message) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
                }
            });
        }

        @android.webkit.JavascriptInterface
        public boolean isAndroid() {
            return true;
        }

        @android.webkit.JavascriptInterface
        public int getScreenWidth() {
            return activity.getResources().getDisplayMetrics().widthPixels;
        }

        @android.webkit.JavascriptInterface
        public int getScreenHeight() {
            return activity.getResources().getDisplayMetrics().heightPixels;
        }
    }
}
