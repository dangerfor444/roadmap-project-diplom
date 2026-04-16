document.addEventListener('DOMContentLoaded', function () {
  var overlay = document.getElementById('widgetOverlay');
  var shell = document.getElementById('widgetShell');
  var host = document.getElementById('widget-demo-host');
  var openButtons = document.querySelectorAll('[data-widget-open]');
  var closeButtons = document.querySelectorAll('[data-widget-close]');
  var widgetLoaded = false;
  var observer;

  if (!overlay || !shell || !host || !openButtons.length) {
    return;
  }

  function markReady() {
    shell.classList.add('ready');
  }

  function watchIframe() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(function () {
      var frame = host.querySelector('iframe');
      if (!frame) {
        return;
      }

      frame.addEventListener('load', markReady, { once: true });
      window.setTimeout(markReady, 900);
      observer.disconnect();
    });

    observer.observe(host, { childList: true });
  }

  function loadWidget() {
    if (widgetLoaded) {
      return;
    }

    widgetLoaded = true;
    watchIframe();

    var script = document.createElement('script');
    script.src = '/embed.js';
    script.async = true;
    script.dataset.project = 'default';
    script.dataset.target = '#widget-demo-host';
    script.dataset.appPath = '/app/';
    script.dataset.height = '100%';
    script.dataset.maxHeight = '100%';
    script.dataset.frameId = 'unocode-roadmap-frame';
    script.dataset.apiName = 'UnoCodeRoadmapDemo';
    script.dataset.title = 'UnoCode';
    document.body.appendChild(script);
  }

  function openWidget() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('widget-open');
    loadWidget();
  }

  function closeWidget() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('widget-open');
  }

  openButtons.forEach(function (button) {
    button.addEventListener('click', openWidget);
  });

  closeButtons.forEach(function (button) {
    button.addEventListener('click', closeWidget);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && overlay.classList.contains('open')) {
      closeWidget();
    }
  });
});

