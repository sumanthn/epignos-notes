import { describe, expect, it } from "vitest";

import { legalNoticeEmail } from "./email";

describe("legal notice email", () => {
  it("links to authenticated review and escapes the HTML display name", () => {
    const message = legalNoticeEmail("Ada <Admin>", "https://epinote.epignos.dev/");

    expect(message.subject).toContain("EpiNote");
    expect(message.html).toContain("Ada &lt;Admin&gt;");
    expect(message.html).not.toContain("Ada <Admin>");
    expect(message.html).toContain("https://epinote.epignos.dev/legal-review");
    expect(message.text).toContain("Clicking this email link alone does not count as acceptance");
  });
});
