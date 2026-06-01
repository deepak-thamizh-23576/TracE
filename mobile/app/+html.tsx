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
        <link
          rel="icon"
          type="image/x-icon"
          href="/favicon.ico"
        />
        <ScrollViewStyleReset />
        <style>{`
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
      <body>{children}</body>
    </html>
  );
}
