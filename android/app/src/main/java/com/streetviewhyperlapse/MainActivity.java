package com.streetviewhyperlapse;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {

    // WebViewAssetLoader が使う仮想 HTTPS オリジン
    // → ブラウザがセキュアコンテキストと判定するため WebRTC (PeerJS) が動作する
    private static final String BASE_URL =
        "https://" + WebViewAssetLoader.DEFAULT_DOMAIN + "/assets/";

    private WebView webView;
    private WebViewAssetLoader assetLoader;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // アセットを https://appassets.androidplatform.net/assets/ で配信
        assetLoader = new WebViewAssetLoader.Builder()
            .setDomain(WebViewAssetLoader.DEFAULT_DOMAIN)
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0f1117"));
        setContentView(webView);

        configureWebView();
        setupImmersiveMode();

        // index.html を HTTPS 仮想オリジン経由で読み込む
        webView.loadUrl(BASE_URL + "index.html");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setGeolocationEnabled(true);

        webView.setWebViewClient(new HyperlapseWebViewClient());
        webView.setWebChromeClient(new HyperlapseChromeClient());

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
    private class HyperlapseWebViewClient extends WebViewClient {

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            // WebViewAssetLoader が /assets/ へのリクエストをローカルアセットに解決する
            WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
            if (response != null) return response;
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            String url = request.getUrl().toString();
            return !url.startsWith(BASE_URL) && !url.startsWith("https://");
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            view.evaluateJavascript(
                "(function(){"
                + "  var s = document.createElement('style');"
                + "  s.textContent = '::-webkit-scrollbar{display:none}';"
                + "  document.head.appendChild(s);"
                + "})()", null
            );
        }
    }

    // ===== ChromeClient =====
    private class HyperlapseChromeClient extends WebChromeClient {
        @Override
        public void onGeolocationPermissionsShowPrompt(
            String origin, GeolocationPermissions.Callback callback) {
            callback.invoke(origin, true, false);
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            // WebRTC に必要な権限を自動許可
            request.grant(request.getResources());
        }

        @Override
        public boolean onConsoleMessage(ConsoleMessage msg) {
            android.util.Log.d("InnovationJS",
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
        public boolean isAndroid() { return true; }

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
