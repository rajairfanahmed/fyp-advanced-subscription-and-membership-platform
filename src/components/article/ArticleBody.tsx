"use client";

import React from "react";

/**
 * Lightweight markdown-to-React renderer that covers the syntax our
 * blog editor produces (headings, lists, blockquotes, bold/italic,
 * inline links, paragraphs). We intentionally avoid pulling in a full
 * markdown library so the bundle stays small and we don't have to
 * sanitise arbitrary HTML.
 */

type InlineSegment =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "code"; value: string };

const INLINE_REGEX =
  /\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function parseInline(input: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let cursor = 0;
  for (const match of input.matchAll(INLINE_REGEX)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      segments.push({ kind: "text", value: input.slice(cursor, start) });
    }
    if (match[1] !== undefined) {
      segments.push({ kind: "bold", value: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ kind: "italic", value: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ kind: "code", value: match[3] });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      segments.push({ kind: "link", label: match[4], href: match[5] });
    }
    cursor = start + match[0].length;
  }
  if (cursor < input.length) {
    segments.push({ kind: "text", value: input.slice(cursor) });
  }
  return segments.length > 0 ? segments : [{ kind: "text", value: input }];
}

function renderInline(segments: InlineSegment[], keyPrefix: string) {
  return segments.map((seg, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (seg.kind) {
      case "bold":
        return (
          <strong key={key} className="font-black text-slate-900">
            {seg.value}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic">
            {seg.value}
          </em>
        );
      case "code":
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[0.9em] font-mono"
          >
            {seg.value}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 hover:text-emerald-800 underline underline-offset-2 font-bold"
          >
            {seg.label}
          </a>
        );
      case "text":
      default:
        return <span key={key}>{seg.value}</span>;
    }
  });
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", text: line.slice(2).trim() });
      i += 1;
      continue;
    }
    if (line.startsWith("> ")) {
      const buffer: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        buffer.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push({ kind: "quote", text: buffer.join("\n") });
      continue;
    }
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    const buffer: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("# ") && !lines[i].startsWith("## ") && !lines[i].startsWith("### ") && !lines[i].startsWith("> ") && !/^\s*-\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      buffer.push(lines[i]);
      i += 1;
    }
    if (buffer.length > 0) {
      blocks.push({ kind: "p", text: buffer.join(" ") });
    }
  }
  return blocks;
}

export function ArticleBody({ source }: { source: string }) {
  const trimmed = source?.trim() ?? "";
  if (!trimmed) {
    return (
      <p className="text-slate-500 font-medium italic">
        This article is still being written.
      </p>
    );
  }

  const blocks = parseBlocks(source);
  return (
    <div className="space-y-5">
      {blocks.map((block, idx) => {
        const key = `block-${idx}`;
        switch (block.kind) {
          case "h1":
            return (
              <h2
                key={key}
                className="text-3xl md:text-4xl font-black font-display text-slate-950 tracking-tight pt-2"
              >
                {renderInline(parseInline(block.text), key)}
              </h2>
            );
          case "h2":
            return (
              <h3
                key={key}
                className="text-2xl font-black font-display text-slate-950 tracking-tight pt-2"
              >
                {renderInline(parseInline(block.text), key)}
              </h3>
            );
          case "h3":
            return (
              <h4
                key={key}
                className="text-lg font-black font-display text-slate-950 pt-2"
              >
                {renderInline(parseInline(block.text), key)}
              </h4>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-4 border-emerald-300 bg-emerald-50/40 px-5 py-3 rounded-r-2xl text-slate-700 italic"
              >
                {renderInline(parseInline(block.text), key)}
              </blockquote>
            );
          case "ul":
            return (
              <ul key={key} className="list-disc list-outside pl-6 space-y-2 text-slate-700 leading-relaxed">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>
                    {renderInline(parseInline(item), `${key}-${j}`)}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="list-decimal list-outside pl-6 space-y-2 text-slate-700 leading-relaxed">
                {block.items.map((item, j) => (
                  <li key={`${key}-${j}`}>
                    {renderInline(parseInline(item), `${key}-${j}`)}
                  </li>
                ))}
              </ol>
            );
          case "p":
          default:
            return (
              <p key={key} className="text-lg text-slate-700 leading-relaxed">
                {renderInline(parseInline(block.text), key)}
              </p>
            );
        }
      })}
    </div>
  );
}
