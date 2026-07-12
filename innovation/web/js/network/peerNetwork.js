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

  // --- Host side ---
  // callbacks: { onCode(code), onConnected(send), onData(msg), onDisconnected(), onError(err) }
  function createHost(callbacks) {
    var conn = null;
    var peer = null;

    function sendFn(data) { if (conn && conn.open) conn.send(data); }

    function tryCreate(code) {
      if (peer) peer.destroy();
      peer = new Peer(PREFIX + code);

      peer.on('open', function () {
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
        if (err.type === 'unavailable-id') {
          // ID collision – retry silently with a new code
          setTimeout(function () { tryCreate(randomCode()); }, 300);
          return;
        }
        callbacks.onError && callbacks.onError(err);
      });
    }

    tryCreate(randomCode());
    return { destroy: function () { if (peer) peer.destroy(); } };
  }

  // --- Guest side ---
  // callbacks: { onConnected(send), onData(msg), onDisconnected(), onError(err) }
  function joinAsGuest(code, callbacks) {
    var conn = null;
    var peer = new Peer();

    peer.on('open', function () {
      var peerId = PREFIX + code.trim().toUpperCase();
      conn = peer.connect(peerId, { reliable: true, serialization: 'json' });

      conn.on('open', function () {
        callbacks.onConnected && callbacks.onConnected(function (data) { conn.send(data); });
      });
      conn.on('data', function (data) {
        callbacks.onData && callbacks.onData(data);
      });
      conn.on('close', function () {
        callbacks.onDisconnected && callbacks.onDisconnected();
      });
      conn.on('error', function (err) {
        callbacks.onError && callbacks.onError(err);
      });
    });

    peer.on('error', function (err) {
      callbacks.onError && callbacks.onError(err);
    });

    return { destroy: function () { if (peer) peer.destroy(); } };
  }

  return { createHost: createHost, joinAsGuest: joinAsGuest };
});
