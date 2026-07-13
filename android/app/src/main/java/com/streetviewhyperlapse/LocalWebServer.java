package com.streetviewhyperlapse;

import android.content.res.AssetManager;
import android.webkit.MimeTypeMap;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

import fi.iki.elonen.NanoHTTPD;

public class LocalWebServer extends NanoHTTPD {

    public static final int PORT = 8787;
    private final AssetManager assets;

    public LocalWebServer(AssetManager assets) throws IOException {
        super(PORT);
        this.assets = assets;
        start(NanoHTTPD.SOCKET_READ_TIMEOUT, false);
    }

    @Override
    public Response serve(IHTTPSession session) {
        String uri = session.getUri();
        if (uri == null || uri.equals("/")) uri = "/index.html";
        // strip leading slash for AssetManager
        String assetPath = uri.startsWith("/") ? uri.substring(1) : uri;

        try {
            InputStream is = assets.open(assetPath);
            String mime = getMimeType(assetPath);
            return newChunkedResponse(Response.Status.OK, mime, is);
        } catch (IOException e) {
            return newFixedLengthResponse(Response.Status.NOT_FOUND, "text/plain", "Not found: " + assetPath);
        }
    }

    private String getMimeType(String path) {
        String ext = "";
        int dot = path.lastIndexOf('.');
        if (dot >= 0) ext = path.substring(dot + 1).toLowerCase();
        switch (ext) {
            case "html": return "text/html; charset=utf-8";
            case "js":   return "application/javascript; charset=utf-8";
            case "css":  return "text/css; charset=utf-8";
            case "json": return "application/json";
            case "png":  return "image/png";
            case "jpg":
            case "jpeg": return "image/jpeg";
            case "svg":  return "image/svg+xml";
            case "ico":  return "image/x-icon";
            default:     return "application/octet-stream";
        }
    }
}
