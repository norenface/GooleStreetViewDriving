package com.innovation.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#1b1f24"));
        setContentView(webView);

        configureWebView();

        // assets/index.html をロード (Innovation web アプリはオフライン動作、
        // ネットワーク/位置情報は一切使用しない)
        webView.loadUrl("file:///android_asset/index.html");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        webView.setWebViewClient(new InnovationWebViewClient());
        webView.setWebChromeClient(new InnovationChromeClient());
    }

    @Override
    public void onBackPressed() {
        // ゲーム中の「戻る」操作はモーダル/アクションバーの取り消しに使わず、
        // ブラウザバック的な挙動も無いので素直に閉じる
        super.onBackPressed();
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

    private static class InnovationWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            // 同梱アセットの file:// 以外への遷移は許可しない (完全オフラインアプリ)
            return !request.getUrl().toString().startsWith("file://");
        }
    }

    private static class InnovationChromeClient extends WebChromeClient {
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
