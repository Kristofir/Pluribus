import { Children, isValidElement, useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  captureFormat,
  inferredCapture,
  structuredCapture,
  type CaptureFormat,
} from "./CaptureFormat";

function FormattedCapture({ value }: { value: CaptureFormat }) {
  switch (value.kind) {
    case "mixed":
      return (
        <>
          <FormattedCapture value={{ kind: "markdown", text: value.text }} />
          <FormattedCapture value={value.table} />
        </>
      );
    case "empty":
      return <p className="capture-empty">No matches returned.</p>;
    case "raw":
      return (
        <>
          {value.error && (
            <p className="capture-format-error" role="status">
              {value.error}
            </p>
          )}
          <pre>
            <code>{value.text}</code>
          </pre>
        </>
      );
    case "table":
      return (
        <>
          <div className="capture-table-wrap">
            <table>
              <thead>
                <tr>
                  {value.columns.map((column, i) => (
                    <th key={i} scope="col">
                      {column || `Column ${i + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.rows.slice(0, 100).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {value.rows.length > 100 && (
            <p className="capture-empty">
              Showing 100 of {value.rows.length} rows. The original response
              contains every row.
            </p>
          )}
        </>
      );
    case "markdown":
      return (
        <Markdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          components={{
            a: ({ children, href }) => (
              <a
                className="nodrag nopan"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            // Captures do not load remote images or run embedded HTML.
            img: ({ alt }) => (
              <span>{alt ? `[Image: ${alt}]` : "[Image]"}</span>
            ),
            table: ({ children }) => (
              <div className="capture-table-wrap">
                <table>{children}</table>
              </div>
            ),
            pre: ({ children }) => {
              const child = Children.toArray(children)[0];
              if (
                isValidElement<{ className?: string; children?: unknown }>(
                  child,
                )
              ) {
                const language = child.props.className?.replace(
                  "language-",
                  "",
                );
                if (
                  (language === "json" || language === "csv") &&
                  typeof child.props.children === "string"
                )
                  return (
                    <FormattedCapture
                      value={captureFormat(child.props.children, language)}
                    />
                  );
              }
              return <pre>{children}</pre>;
            },
          }}
        >
          {value.text}
        </Markdown>
      );
  }
}
export function CaptureText({
  text,
  format,
  preview = false,
}: {
  text: string;
  format?: "json" | "csv" | "markdown";
  preview?: boolean;
}) {
  const value = useMemo<CaptureFormat>(
    () =>
      preview || format === "markdown"
        ? { kind: "markdown", text }
        : captureFormat(text, format),
    [text, format, preview],
  );
  // A preview may end inside a fence; render as plain text rather than diagnose or table it.
  if (preview && /(^|\n)\s*(```|~~~)|^[\s]*[\[{]/.test(text))
    return <div className="capture-preview-text">{text}</div>;
  return (
    <div className="capture-content">
      <FormattedCapture value={value} />
    </div>
  );
}
export function CaptureContent({
  content,
  data,
  table,
  extractionFormat,
}: {
  content?: string;
  data?: string;
  table?: { columns: string[] };
  extractionFormat?: "inferred-v1";
}) {
  const [format, setFormat] = useState<"auto" | "markdown" | "csv" | "json">(
    "auto",
  );
  return (
    <div className="web-page-capture">
      {content !== undefined && (
        <label className="capture-format-control">
          View as{" "}
          <select
            aria-label="Captured text format"
            value={format}
            onChange={(event) => setFormat(event.target.value as typeof format)}
          >
            <option value="auto">Auto</option>
            <option value="markdown">Text / Markdown</option>
            <option value="csv">CSV table</option>
            <option value="json">JSON</option>
          </select>
        </label>
      )}
      {content !== undefined && (
        <CaptureText
          text={content}
          format={format === "auto" ? undefined : format}
        />
      )}
      {data !== undefined && (
        <section className="capture-extraction">
          <h3>Extracted data</h3>
          {extractionFormat === "inferred-v1" ? (
            <div className="capture-content">
              <FormattedCapture value={inferredCapture(data)} />
            </div>
          ) : table ? (
            <div className="capture-content">
              <FormattedCapture
                value={structuredCapture(data, table.columns)}
              />
            </div>
          ) : (
            <CaptureText text={data} format="json" />
          )}
        </section>
      )}
      <details className="capture-original">
        <summary>Original response</summary>
        {content !== undefined && (
          <>
            <h4>Captured text</h4>
            <pre>{content}</pre>
          </>
        )}
        {data !== undefined && (
          <>
            <h4>Extraction JSON</h4>
            <pre>{data}</pre>
          </>
        )}
      </details>
    </div>
  );
}
