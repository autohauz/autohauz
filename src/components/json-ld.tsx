// U+2028 LINE SEPARATOR / U+2029 PARAGRAPH SEPARATOR are valid JSON but were
// line terminators in pre-ES2019 JavaScript; built from code points so the
// source file never contains the raw characters.
const LINE_SEPARATORS = new RegExp("[" + String.fromCharCode(0x2028, 0x2029) + "]", "g");

/**
 * Serialises a schema object for inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is not safe here: the values come from staff-entered
 * content (vehicle descriptions, FAQ answers, testimonials), and a string
 * containing `</script>` would terminate the tag and inject markup. Escaping
 * `<`, `>` and `&` as JSON unicode escapes keeps the payload valid JSON while
 * making it inert inside HTML.
 */
export function serializeJsonLd(schema: object): string {
  return JSON.stringify(schema)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATORS, (c) => "\\u" + c.charCodeAt(0).toString(16));
}

/** Renders one or more JSON-LD schema objects as script tags. */
export function JsonLd({ schema }: { schema: object | object[] }) {
  const data = Array.isArray(schema) ? schema : [schema];
  return (
    <>
      {data.map((s, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(s) }}
        />
      ))}
    </>
  );
}
