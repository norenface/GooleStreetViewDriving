package com.innovation.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {

    // WebViewAssetLoader が使う仮想 HTTPS オリジン
    // → ブラウザがセキュアコンテキストと判定するため WebRTC (PeerJS) が動作する
    private static final String BASE_URL =
        "https://" + WebViewAssetLoader.DEFAULT_DOMAIN + "/assets/";

    private WebView webView;
    private WebViewAssetLoader assetLoader;

    @SuppressLint({"SetJavaScriptEnabled"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        // アセットを https://appassets.androidplatform.net/assets/ で配信
        assetLoader = new WebViewAssetLoader.Builder()
            .setDomain(WebViewAssetLoader.DEFAULT_DOMAIN)
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#1b1f24"));
        setContentView(webView);

        configureWebView();

        // file:// ではなく https:// で読み込む → WebRTC (PeerJS) が動作する
        webView.loadUrl(BASE_URL + "index.html");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        // file:// アクセスは不要（WebViewAssetLoader 経由で配信するため）
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);

        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        webView.setWebViewClient(new InnovationWebViewClient());
        webView.setWebChromeClient(new InnovationChromeClient());
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
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

    private class InnovationWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            // WebViewAssetLoader が /assets/ へのリクエストをローカルアセットに解決する
            WebResourceResponse response = assetLoader.shouldInterceptRequest(request.getUrl());
            if (response != null) return response;
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            // アプリ内アセット以外への画面遷移はブロック
            return !request.getUrl().toString().startsWith(BASE_URL);
        }
    }

    private static class InnovationChromeClient extends WebChromeClient {
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
}
