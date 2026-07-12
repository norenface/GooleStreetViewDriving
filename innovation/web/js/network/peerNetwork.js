// PeerJS wrapper for Innovation online friend play.
// Host creates a room (6-char code), guest joins by entering the code.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationPeerNetwork = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PREFIX = 'inno-';
  var CHARS  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function randomCode() {
    var s = '';
    for (var i = 0; i < 6; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
    return s;
  }

  var PEER_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  };

  var CONNECT_TIMEOUT_MS = 15000;

  function makePeer(peerId) {
    if (typeof Peer === 'undefined') {
      throw new Error('PeerJSライブラリが読み込まれていません。ページを再読み込みしてください。');
    }
    return peerId ? new Peer(peerId, PEER_CONFIG) : new Peer(PEER_CONFIG);
  }

  // --- Host side ---
  // callbacks: { onCode(code), onConnected(send), onData(msg), onDisconnected(), onError(err) }
  function createHost(callbacks) {
    var conn = null;
    var peer = null;
    var openTimer = null;

    function sendFn(data) { if (conn && conn.open) conn.send(data); }

    function tryCreate(code) {
      if (peer) peer.destroy();
      if (openTimer) clearTimeout(openTimer);

      try {
        peer = makePeer(PREFIX + code);
      } catch (e) {
        callbacks.onError && callbacks.onError({ type: 'load-error', message: e.message });
        return;
      }

      // タイムアウト：サーバーに繋がらない場合
      openTimer = setTimeout(function () {
        if (peer && !peer.open) {
          callbacks.onError && callbacks.onError({
            type: 'timeout',
            message: 'PeerJSサーバーへの接続がタイムアウトしました。\nネットワーク接続とHTTPS環境を確認してください。'
          });
        }
      }, CONNECT_TIMEOUT_MS);

      peer.on('open', function () {
        clearTimeout(openTimer);
        callbacks.onCode && callbacks.onCode(code);
      });

      peer.on('connection', function (c) {
        if (conn) { c.close(); return; } // accept first connection only
        conn = c;
        conn.on('open', function () {
          callbacks.onConnected && callbacks.onConnected(sendFn);
        });
        conn.on('data', function (data) {
          callbacks.onData && callbacks.onData(data);
        });
        conn.on('close', function () {
          conn = null;
          callbacks.onDisconnected && callbacks.onDisconnected();
        });
        conn.on('error', function (err) { console.error('[peer] conn error', err); });
      });

      peer.on('error', function (err) {
        clearTimeout(openTimer);
        if (err.type === 'unavailable-id') {
          setTimeout(function () { tryCreate(randomCode()); }, 300);
          return;
        }
        var msg = err.message || err.type || '不明なエラー';
        if (err.type === 'network' || err.type === 'server-error') {
          msg = 'PeerJSサーバーに接続できませんでした。\nネットワーク接続とHTTPS環境を確認してください。';
        }
        callbacks.onError && callbacks.onError({ type: err.type, message: msg });
      });
    }

    tryCreate(randomCode());
    return { destroy: function () { clearTimeout(openTimer); if (peer) peer.destroy(); } };
  }

  // --- Guest side ---
  // callbacks: { onConnected(send), onData(msg), onDisconnected(), onError(err) }
  function joinAsGuest(code, callbacks) {
    var conn = null;
    var peer = null;
    var openTimer = null;

    try {
      peer = makePeer(null);
    } catch (e) {
      setTimeout(function () {
        callbacks.onError && callbacks.onError({ type: 'load-error', message: e.message });
      }, 0);
      return { destroy: function () {} };
    }

    openTimer = setTimeout(function () {
      callbacks.onError && callbacks.onError({
        type: 'timeout',
        message: 'PeerJSサーバーへの接続がタイムアウトしました。\nネットワーク接続とHTTPS環境を確認してください。'
      });
    }, CONNECT_TIMEOUT_MS);

    peer.on('open', function () {
      clearTimeout(openTimer);
      var peerId = PREFIX + code.trim().toUpperCase();
      conn = peer.connect(peerId, { reliable: true });

      var connTimer = setTimeout(function () {
        callbacks.onError && callbacks.onError({
          type: 'timeout',
          message: 'ホストへの接続がタイムアウトしました。ルームコードを確認してください。'
        });
      }, CONNECT_TIMEOUT_MS);

      conn.on('open', function () {
        clearTimeout(connTimer);
        callbacks.onConnected && callbacks.onConnected(function (data) { conn.send(data); });
      });
      conn.on('data', function (data) {
        callbacks.onData && callbacks.onData(data);
      });
      conn.on('close', function () {
        callbacks.onDisconnected && callbacks.onDisconnected();
      });
      conn.on('error', function (err) {
        clearTimeout(connTimer);
        var msg = err.message || err.type || '接続エラー';
        if (err.type === 'peer-unavailable') {
          msg = '指定されたルームコードのホストが見つかりませんでした。コードを確認してください。';
        }
        callbacks.onError && callbacks.onError({ type: err.type, message: msg });
      });
    });

    peer.on('error', function (err) {
      clearTimeout(openTimer);
      var msg = err.message || err.type || '不明なエラー';
      if (err.type === 'network' || err.type === 'server-error') {
        msg = 'PeerJSサーバーに接続できませんでした。\nネットワーク接続とHTTPS環境を確認してください。';
      } else if (err.type === 'peer-unavailable') {
        msg = '指定されたルームコードのホストが見つかりませんでした。コードを確認してください。';
      }
      callbacks.onError && callbacks.onError({ type: err.type, message: msg });
    });

    return { destroy: function () { clearTimeout(openTimer); if (peer) peer.destroy(); } };
  }

  return { createHost: createHost, joinAsGuest: joinAsGuest };
});
