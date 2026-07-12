// Host-side controller for the remote (guest) player.
// Each controller method sends a prompt over PeerJS and awaits the guest's response.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InnovationNetworkController = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // sendFn(msg)    – sends a message to the guest
  // getGame()      – returns the current live game object
  // serializeFn(g) – optional; defaults to stripping controllers only.
  //                  Pass a sanitizing function to hide opponent hands / pile contents.
  function makeNetworkController(sendFn, getGame, serializeFn) {
    if (!serializeFn) {
      serializeFn = function (game) {
        return JSON.parse(JSON.stringify(game, function (key, val) {
          return key === 'controller' ? undefined : val;
        }));
      };
    }

    var pending = {};
    var nextId  = 0;

    function sendPrompt(method, payload) {
      var id = nextId++;
      // Send latest (sanitized) game state so the guest can render before answering
      var g = getGame && getGame();
      if (g) sendFn({ type: 'state', game: serializeFn(g) });
      sendFn({ type: 'prompt', id: id, method: method, payload: payload });
      return new Promise(function (resolve) { pending[id] = resolve; });
    }

    var ctrl = {
      // Called by peerNetwork when a response arrives from the guest
      handleResponse: function (msg) {
        if (msg.type === 'response' && pending[msg.id] !== undefined) {
          pending[msg.id](msg.value);
          delete pending[msg.id];
        }
      },

      async chooseAction(player, ctx) {
        return sendPrompt('chooseAction', { legal: ctx.legal });
      },
      async chooseCard(player, opts) {
        return sendPrompt('chooseCard', {
          ids: opts.ids, prompt: opts.prompt, min: opts.min, max: opts.max
        });
      },
      async chooseColor(player, opts) {
        return sendPrompt('chooseColor', {
          colors: opts.colors, prompt: opts.prompt, optional: !!opts.optional
        });
      },
      async chooseSplay(player, opts) {
        return sendPrompt('chooseSplay', {
          options: opts.options, prompt: opts.prompt, optional: !!opts.optional
        });
      },
      async choosePlayer(player, opts) {
        return sendPrompt('choosePlayer', { ids: opts.ids, prompt: opts.prompt });
      },
      async confirm(player, prompt) {
        return sendPrompt('confirm', { prompt: prompt });
      }
    };

    return ctrl;
  }

  return { makeNetworkController: makeNetworkController };
});
