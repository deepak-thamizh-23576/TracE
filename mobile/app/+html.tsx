import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>TracE</title>
        {/* Set title immediately (before React hydrates) and re-assert after */}
        <script dangerouslySetInnerHTML={{ __html: `document.title='TracE'` }} />
        <link
          rel="icon"
          type="image/x-icon"
          href="/favicon.ico"
        />
        <ScrollViewStyleReset />
        <style>{`
          @font-face { font-family: 'ionicons'; src: url('/fonts/Ionicons.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
          @font-face { font-family: 'material'; src: url('/fonts/MaterialIcons.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
          @font-face { font-family: 'entypo'; src: url('/fonts/Entypo.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }
          @font-face { font-family: 'feather'; src: url('/fonts/Feather.ttf') format('truetype'); font-weight: normal; font-style: normal; font-display: swap; }

          /* Loading splash — visible before React hydrates */
          #te-splash {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            background: #ffffff;
          }
          #te-splash-logo {
            width: 64px; height: 64px; border-radius: 16px;
            background: #FFD900; margin-bottom: 20px;
            display: flex; align-items: center; justify-content: center;
            font-size: 28px; font-weight: 800; color: #111827;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          #te-splash-text {
            font-size: 22px; font-weight: 800; color: #111827; letter-spacing: -0.5px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin-bottom: 32px;
          }
          #te-splash-spinner {
            width: 28px; height: 28px;
            border: 3px solid #E5E7EB;
            border-top-color: #FFD900;
            border-radius: 50%;
            animation: te-spin 0.75s linear infinite;
          }
          @keyframes te-spin { to { transform: rotate(360deg); } }

          /* Remove blue focus outline on all inputs */
          input:focus,
          textarea:focus,
          [contenteditable]:focus {
            outline: none !important;
            box-shadow: none !important;
          }
          * {
            -webkit-tap-highlight-color: transparent;
          }
        `}</style>
      </head>
      <body>
        <div id="te-splash">
          <div id="te-splash-logo">T</div>
          <div id="te-splash-text">TracE</div>
          <div id="te-splash-spinner" />
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          // Hide splash once React has mounted and rendered the first frame
          (function() {
            var splash = document.getElementById('te-splash');
            if (!splash) return;
            var observer = new MutationObserver(function() {
              var root = document.getElementById('root');
              if (root && root.children.length > 0) {
                splash.style.transition = 'opacity 0.2s';
                splash.style.opacity = '0';
                setTimeout(function() { splash.remove(); }, 250);
                observer.disconnect();
              }
            });
            observer.observe(document.body, { childList: true, subtree: true });
          })();
        ` }} />
        {children}
      </body>
    </html>
  );
}
