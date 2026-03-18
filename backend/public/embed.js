/*
Usage:
<script src="https://<host>/embed.js" data-project="default"></script>

Optional attributes:
- data-target="#selector"                 // container selector; default inserts after script
- data-url="https://..."                  // explicit iframe URL (overrides data-app-path)
- data-app-path="/app/"                   // iframe app path on the same host
- data-height="720px"                     // iframe height (px added automatically for numeric values)
- data-title="Roadmap"                    // iframe title attribute
- data-actor-id="user_123"                // optional actor id for write operations
- data-actor-token="payload.signature"    // optional signed token for write operations
- data-api-name="RoadmapEmbed"            // global API name for runtime auth updates
*/
(function () {
  'use strict';

  var EMBED_AUTH_MESSAGE_TYPE = 'roadmap-widget-auth';
  var EMBED_READY_MESSAGE_TYPE = 'roadmap-widget-ready';

  var script = document.currentScript;
  if (!script) {
    return;
  }

  var dataset = script.dataset || {};
  var scriptSrc = script.getAttribute('src') || '';

  var asTrimmed = function (value) {
    return (value || '').trim();
  };

  var toCssSize = function (value, fallback) {
    var raw = asTrimmed(value);
    if (!raw) return fallback;
    if (/^\d+$/.test(raw)) return raw + 'px';
    return raw;
  };

  var ensureLeadingSlash = function (value) {
    if (!value) return '/app/';
    return value.charAt(0) === '/' ? value : '/' + value;
  };

  var hostOrigin = new URL(scriptSrc, window.location.href).origin;
  var appPath = ensureLeadingSlash(dataset.appPath || '/app/');
  var project = asTrimmed(dataset.project);
  var explicitUrl = asTrimmed(dataset.url);
  var frameId = asTrimmed(dataset.frameId);
  var maxHeight = asTrimmed(dataset.maxHeight);
  var apiName = asTrimmed(dataset.apiName) || 'RoadmapEmbed';
  var actorId = asTrimmed(dataset.actorId);
  var actorToken = asTrimmed(dataset.actorToken);

  var query = new URLSearchParams();
  query.set('embed', '1');
  query.set('parentOrigin', window.location.origin);
  if (project) {
    query.set('project', project);
  }

  var baseIframeUrl = explicitUrl || hostOrigin + appPath;
  var iframeOrigin = new URL(baseIframeUrl, window.location.href).origin;

  if (frameId && document.getElementById(frameId)) {
    return;
  }

  var iframe = document.createElement('iframe');
  if (frameId) {
    iframe.id = frameId;
  }
  iframe.src = baseIframeUrl + (baseIframeUrl.indexOf('?') === -1 ? '?' : '&') + query.toString();
  iframe.title = dataset.title || 'Public roadmap widget';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allow = 'clipboard-read; clipboard-write';

  iframe.style.display = 'block';
  iframe.style.width = '100%';
  iframe.style.height = toCssSize(dataset.height, '700px');
  if (maxHeight) {
    iframe.style.maxHeight = toCssSize(maxHeight, '900px');
  }
  iframe.style.border = '0';
  iframe.style.background = '#fff';

  var postAuth = function () {
    if (!iframe.contentWindow) {
      return;
    }

    if (!actorId && !actorToken) {
      return;
    }

    var payload = {
      type: EMBED_AUTH_MESSAGE_TYPE,
    };

    if (project) {
      payload.project = project;
    }
    if (actorId) {
      payload.actorId = actorId;
    }
    if (actorToken) {
      payload.actorToken = actorToken;
    }

    iframe.contentWindow.postMessage(payload, iframeOrigin);
  };

  var onMessage = function (event) {
    if (event.source !== iframe.contentWindow) {
      return;
    }
    if (event.origin !== iframeOrigin) {
      return;
    }

    var data = event.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type !== EMBED_READY_MESSAGE_TYPE) {
      return;
    }

    postAuth();
  };

  window.addEventListener('message', onMessage);
  iframe.addEventListener('load', function () {
    postAuth();
    window.setTimeout(postAuth, 200);
  });

  var globalApi = window[apiName] || {};
  globalApi.setAuth = function (nextAuth) {
    if (!nextAuth || typeof nextAuth !== 'object') {
      return;
    }

    actorId = asTrimmed(nextAuth.actorId);
    actorToken = asTrimmed(nextAuth.actorToken);
    postAuth();
  };
  window[apiName] = globalApi;

  var targetSelector = asTrimmed(dataset.target);
  var target = targetSelector ? document.querySelector(targetSelector) : null;

  if (target) {
    target.appendChild(iframe);
    return;
  }

  if (script.parentNode) {
    script.parentNode.insertBefore(iframe, script.nextSibling);
  }
})();